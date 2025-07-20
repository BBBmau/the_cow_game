// used within the k8s provider block
data "google_client_config" "default" {}

resource "google_compute_network" "cow_cluster" {
  name = "cow-cluster-network"

  auto_create_subnetworks  = false
}

resource "google_compute_subnetwork" "cow_cluster" {
  name = "cow-cluster-subnetwork"

  ip_cidr_range = "10.0.0.0/16"
  region        = "us-west1"

  network = google_compute_network.cow_cluster.id

  secondary_ip_range {
    range_name    = "services-range"
    ip_cidr_range = "192.168.0.0/24"
  }

  secondary_ip_range {
    range_name    = "pod-ranges"
    ip_cidr_range = "192.168.1.0/24"
  }
}

resource "google_container_cluster" "primary" {
  name     = "the-cow-game-cluster"
  location = "us-west1"

lifecycle {

   prevent_destroy = true

 }
  # We can't create a cluster with no node pool defined, but we want to only use
  # separately managed node pools. So we create the smallest possible default
  # node pool and immediately delete it.
  remove_default_node_pool = true
  initial_node_count       = 1
}

resource "google_container_node_pool" "primary_preemptible_nodes" {
  name       = "cow-node-pool"
  location   = "us-west1"
  // TODO: we only care about one zone in each region, we'll need to have multiple clusters if we want to handle server selection based on region
  // west, central, east would each require a cluster matching the region
  node_locations = ["us-west1-a"]

  cluster    = google_container_cluster.primary.name
  node_count = 1

  lifecycle {
    ignore_changes = [
      node_config[0].labels
    ]
  }

  node_config {
    preemptible  = true
    machine_type = "e2-medium"

    tags = ["game-server"]

    labels ={
        "node.kubernetes.io/kube-proxy-ds-ready" = "true"
    }

    # Google recommends custom service accounts that have cloud-platform scope and permissions granted via IAM Roles.
    service_account = "cluster-manager@thecowgame.iam.gserviceaccount.com"
    oauth_scopes    = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
}

resource "google_compute_firewall" "allow_nodeport_31622" {
  name    = "allow-nodeport-31622"
  network = google_container_cluster.primary.network # Change if your cluster uses a different VPC network

  allow {
    protocol = "tcp"
    ports    = ["31622"]
  }

  direction    = "INGRESS"
  priority     = 1000
  source_ranges = ["0.0.0.0/0"]

  target_tags = ["game-server"]  # Replace with the network tag applied to your GKE nodes
}

// used for HTTPS ingress traffic

resource "google_compute_global_address" "default" {
  name = "playthecowgame-ingress-ip"
}

output "playthecowgame_ip_address" {
  value       = google_compute_global_address.default.address
}
