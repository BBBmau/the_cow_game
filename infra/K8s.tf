provider "kubernetes" {
  host                   = "https://${google_container_cluster.primary.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.primary.master_auth[0].cluster_ca_certificate)
}

// we moved away from pods in order to have auto provisioning every day - perhaps we can prevent this from happening
resource "kubernetes_deployment" "game_server" {
  metadata {
    name = "the-cow-game-server"
    labels = {
      "app" = "cow-game"
    }
  }

  spec {
    replicas = 1

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = 1
        max_unavailable = 0
      }
    }

    selector {
      match_labels = {
        "app" = "cow-game"
      }
    }

    template {
      metadata {
        labels = {
          "app" = "cow-game"
        }
      }

      spec {
        container {
          image = "us-west1-docker.pkg.dev/thecowgame/game-images/mmo-server:${var.image_sha}"
          name  = "thecowgameserver"
          image_pull_policy = "Always"

          port {
            container_port = 6060
          }

          resources {
            limits = {
              cpu    = "750m"
              memory = "512Mi"  # Increased from 64Mi to support multiple players
            }
            requests = {
              cpu    = "20m"
              memory = "128Mi"  # Increased from 64Mi for baseline requirements
            }
          }

          # Add environment variables for better Node.js memory management
          env {
            name  = "NODE_OPTIONS"
            value = "--max-old-space-size=384"  # Set heap size to 384MB (75% of limit)
          }

          # Redis connection configuration
          env {
            name  = "REDIS_HOST"
            value = "redis"  # This matches the Redis service name
          }

          env {
            name  = "REDIS_PORT"
            value = "6379"
          }
        }
        
        image_pull_secrets {
          name = "artifact-registry-secret"
        }
      }
    }
  }

  depends_on = [
    kubernetes_secret.artifact_registry_secret,
    kubernetes_service.redis
  ]
}

// Redis Deployment
resource "kubernetes_deployment" "redis" {
  metadata {
    name = "redis"
    labels = {
      "app" = "redis"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app" = "redis"
      }
    }

    template {
      metadata {
        labels = {
          "app" = "redis"
        }
      }

      spec {
        container {
          image = "redis:7-alpine"
          name  = "redis"

          port {
            container_port = 6379
          }

          # Redis configuration for persistence
          args = ["redis-server", "--appendonly", "yes"]

          resources {
            limits = {
              cpu    = "500m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "10m"
              memory = "64Mi"
            }
          }

          # Volume mount for persistence
          volume_mount {
            name       = "redis-data"
            mount_path = "/data"
          }

          # Health check
          liveness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }

        # Persistent volume for Redis data
        volume {
          name = "redis-data"
          persistent_volume_claim {
            claim_name = "redis-pvc"
          }
        }
      }
    }
  }
}

// Redis Service
resource "kubernetes_service" "redis" {
  metadata {
    name = "redis"
    labels = {
      "app" = "redis"
    }
  }

  spec {
    selector = {
      "app" = "redis"
    }

    port {
      port        = 6379
      target_port = 6379
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

// Persistent Volume Claim for Redis
resource "kubernetes_persistent_volume_claim" "redis" {
  metadata {
    name = "redis-pvc"
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    
    resources {
      requests = {
        storage = "1Gi"
      }
    }
  }
}

resource "kubernetes_secret" "artifact_registry_secret" {
  metadata {
    name = "artifact-registry-secret"
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "us-west1-docker.pkg.dev" = {
          username = "_json_key"
          password = file("../../../credentials/thecowgame-clustermanager.json")
          email    = "cluster-manager@thecowgame.iam.gserviceaccount.com"
          auth     = base64encode(format("%s:%s", "_json_key", file("../../../credentials/thecowgame-clustermanager.json")))
        }
      }
    })
  }
}


resource "kubernetes_service" "headless_service" {
  metadata{
    name = "single-pod-service"
  }
  
  spec {
    type = "NodePort"   # Headless service disables load balancing
    selector = {
      "app" = "cow-game"
    }
    port{
      port = 80
      target_port = 6060
    }
  }
}

resource "google_compute_backend_service" "ingress_backend" {
  name        = "k8s-be-31622--109cb19e972eba76"
  protocol    = "HTTP"
  timeout_sec = 3600

  connection_draining_timeout_sec = 300  # replaces connection_draining block

  health_checks = [
    "https://www.googleapis.com/compute/v1/projects/thecowgame/global/healthChecks/k8s1-109cb19e-kube-system-default-http-backend-80-cb1c11b2"
  ]

  backend {
    group = "https://www.googleapis.com/compute/v1/projects/thecowgame/zones/us-west1-a/instanceGroups/k8s-ig--109cb19e972eba76"
  }

  lifecycle {
    ignore_changes = [
      health_checks,
      description
    ]
  }
}


resource "kubernetes_ingress_v1" "gke_ingress" {
  metadata {
    name = "playhtecowgame-ingress"
    annotations = {
      "kubernetes.io/ingress.global-static-ip-name" = google_compute_global_address.default.name
      "networking.gke.io/managed-certificates"       = kubernetes_manifest.managed_certificate.manifest["metadata"]["name"]
    }
  }

  spec {
    rule {
      http {
        path {
          path     = "/*"
          path_type = "ImplementationSpecific"
          backend {
            service {
              name = kubernetes_service.headless_service.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_manifest.managed_certificate]
}

# Create the ManagedCertificate Kubernetes resource
resource "kubernetes_manifest" "managed_certificate" {
  manifest = {
    apiVersion = "networking.gke.io/v1beta1"
    kind       = "ManagedCertificate"
    metadata = {
      name      = "playthecowgame-cert"
      namespace = "default"
    }
    spec = {
      domains = [
        "www.playthecowgame.com"
      ]
    }
  }
}

resource "kubernetes_manifest" "managed_certificate_2" {
  manifest = {
    apiVersion = "networking.gke.io/v1beta1"
    kind       = "ManagedCertificate"
    metadata = {
      name      = "playthecowgame-cert-2"
      namespace = "default"
    }
    spec = {
      domains = [
        "playthecowgame.com"
      ]
    }
  }
}

// Redis Exporter for Grafana monitoring
resource "kubernetes_deployment" "redis_exporter" {
  metadata {
    name = "redis-exporter"
    labels = {
      "app" = "redis-exporter"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app" = "redis-exporter"
      }
    }

    template {
      metadata {
        labels = {
          "app" = "redis-exporter"
        }
      }

      spec {
        container {
          image = "oliver006/redis_exporter:latest"
          name  = "redis-exporter"

          port {
            container_port = 9121
          }

          env {
            name  = "REDIS_ADDR"
            value = "redis://redis:6379"
          }

          resources {
            limits = {
              cpu    = "100m"
              memory = "64Mi"
            }
            requests = {
              cpu    = "10m"
              memory = "32Mi"
            }
          }
        }
      }
    }
  }
}

// Redis Exporter Service
resource "kubernetes_service" "redis_exporter" {
  metadata {
    name = "redis-exporter"
    labels = {
      "app" = "redis-exporter"
    }
  }

  spec {
    selector = {
      "app" = "redis-exporter"
    }

    port {
      port        = 9121
      target_port = 9121
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

// Grafana Deployment
resource "kubernetes_deployment" "grafana" {
  metadata {
    name = "grafana"
    labels = {
      "app" = "grafana"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app" = "grafana"
      }
    }

    template {
      metadata {
        labels = {
          "app" = "grafana"
        }
      }

      spec {
        container {
          image = "grafana/grafana:latest"
          name  = "grafana"

          port {
            container_port = 3000
          }

          # Grafana admin credentials
          env {
            name  = "GF_SECURITY_ADMIN_USER"
            value = "admin"
          }

          env {
            name  = "GF_SECURITY_ADMIN_PASSWORD"
            value = "your-secure-password-123"  # Change this!
          }

          # Disable anonymous access
          env {
            name  = "GF_AUTH_ANONYMOUS_ENABLED"
            value = "false"
          }

          # Security settings
          env {
            name  = "GF_SECURITY_ALLOW_EMBEDDING"
            value = "false"
          }

          env {
            name  = "GF_SECURITY_COOKIE_SECURE"
            value = "true"
          }

          resources {
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
          }

          # Persistent storage for Grafana data
          volume_mount {
            name       = "grafana-data"
            mount_path = "/var/lib/grafana"
          }
        }

        volume {
          name = "grafana-data"
          persistent_volume_claim {
            claim_name = "grafana-pvc"
          }
        }
      }
    }
  }
}

// Grafana Service (LoadBalancer for external access)
resource "kubernetes_service" "grafana" {
  metadata {
    name = "grafana"
    labels = {
      "app" = "grafana"
    }
  }

  spec {
    selector = {
      "app" = "grafana"
    }

    port {
      port        = 80
      target_port = 3000
      protocol    = "TCP"
    }

    type = "LoadBalancer"
  }
}

// Persistent Volume Claim for Grafana
resource "kubernetes_persistent_volume_claim" "grafana" {
  metadata {
    name = "grafana-pvc"
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    
    resources {
      requests = {
        storage = "2Gi"
      }
    }
  }
}

// ConfigMap for Grafana Prometheus data source
resource "kubernetes_config_map" "grafana_datasources" {
  metadata {
    name = "grafana-datasources"
  }

  data = {
    "datasources.yaml" = <<-EOT
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          access: proxy
          url: http://prometheus:9090
          isDefault: true
          editable: true
    EOT
  }
}

// Prometheus for metrics collection
resource "kubernetes_deployment" "prometheus" {
  metadata {
    name = "prometheus"
    labels = {
      "app" = "prometheus"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app" = "prometheus"
      }
    }

    template {
      metadata {
        labels = {
          "app" = "prometheus"
        }
      }

      spec {
        container {
          image = "prom/prometheus:latest"
          name  = "prometheus"

          port {
            container_port = 9090
          }

          args = [
            "--config.file=/etc/prometheus/prometheus.yml",
            "--storage.tsdb.path=/prometheus/",
            "--web.console.libraries=/etc/prometheus/console_libraries",
            "--web.console.templates=/etc/prometheus/consoles",
            "--storage.tsdb.retention.time=200h",
            "--web.enable-lifecycle"
          ]

          resources {
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
          }

          volume_mount {
            name       = "prometheus-config"
            mount_path = "/etc/prometheus"
          }

          volume_mount {
            name       = "prometheus-data"
            mount_path = "/prometheus"
          }
        }

        volume {
          name = "prometheus-config"
          config_map {
            name = "prometheus-config"
          }
        }

        volume {
          name = "prometheus-data"
          persistent_volume_claim {
            claim_name = "prometheus-pvc"
          }
        }
      }
    }
  }
}

// Prometheus Service
resource "kubernetes_service" "prometheus" {
  metadata {
    name = "prometheus"
    labels = {
      "app" = "prometheus"
    }
  }

  spec {
    selector = {
      "app" = "prometheus"
    }

    port {
      port        = 9090
      target_port = 9090
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

// Prometheus PVC
resource "kubernetes_persistent_volume_claim" "prometheus" {
  metadata {
    name = "prometheus-pvc"
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    
    resources {
      requests = {
        storage = "5Gi"
      }
    }
  }
}

// Prometheus Configuration
resource "kubernetes_config_map" "prometheus_config" {
  metadata {
    name = "prometheus-config"
  }

  data = {
    "prometheus.yml" = <<-EOT
      global:
        scrape_interval: 15s
        evaluation_interval: 15s

      scrape_configs:
        - job_name: 'redis-exporter'
          static_configs:
            - targets: ['redis-exporter:9121']
          scrape_interval: 30s
          metrics_path: /metrics

        - job_name: 'prometheus'
          static_configs:
            - targets: ['localhost:9090']
    EOT
  }
}
