terraform {
  backend "gcs" {
    bucket      = "cow_game_k8s_tfstate"
    prefix      = "pr-pods/terraform/state"
    # Workspace-specific state files will be stored as:
    # pr-pods/terraform/state/env:/pr-{number}/default.tfstate
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.38.0"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# Get cluster information from the main infra
data "google_container_cluster" "primary" {
  name     = "the-cow-game-cluster"  # Production cluster name
  location = var.region
  project  = var.project_id
}

# Get credentials for the cluster
data "google_client_config" "default" {}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "kubernetes" {
  host  = "https://${data.google_container_cluster.primary.endpoint}"
  token = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(
    data.google_container_cluster.primary.master_auth[0].cluster_ca_certificate,
  )
} 