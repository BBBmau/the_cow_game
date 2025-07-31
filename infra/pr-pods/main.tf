# Redis Deployment
resource "kubernetes_deployment_v1" "redis" {
  metadata {
    name      = "${local.pr_prefix}-redis"
    namespace = "default"
    labels = merge(local.common_labels, {
      component = "redis"
      app       = "cow-game-redis"
    })
  }

  spec {
    replicas = 1
    
    selector {
      match_labels = {
        app         = "cow-game-redis"
        environment = var.environment
        component   = "redis"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          component = "redis"
          app       = "cow-game-redis"
        })
      }

      spec {
        container {
          name  = "redis"
          image = "redis:7-alpine"

          port {
            name           = "redis"
            container_port = 6379
          }

          resources {
            requests = {
              memory = "64Mi"
              cpu    = "50m"
            }
            limits = {
              memory = "128Mi"
              cpu    = "100m"
            }
          }

          command = [
            "redis-server",
            "--appendonly", "yes",
            "--maxmemory", "200mb",
            "--maxmemory-policy", "allkeys-lru"
          ]
        }

        # Prefer to schedule on existing nodes to avoid triggering autoscaling
        affinity {
          node_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100
              preference {
                match_expressions {
                  key      = "cloud.google.com/gke-nodepool"
                  operator = "Exists"
                }
              }
            }
          }
        }
      }
    }
  }
}

# Redis Service
resource "kubernetes_service_v1" "redis" {
  metadata {
    name      = "${local.pr_prefix}-redis"
    namespace = "default"
    labels = merge(local.common_labels, {
      component = "redis"
      app       = "cow-game-redis"
    })
  }

  spec {
    type = "ClusterIP"
    
    port {
      name        = "redis"
      port        = 6379
      target_port = 6379
      protocol    = "TCP"
    }

    selector = {
      app         = "cow-game-redis"
      environment = var.environment
    }
  }
}

# Game Server Deployment
resource "kubernetes_deployment_v1" "gameserver" {
  metadata {
    name      = "${local.pr_prefix}-server"
    namespace = "default"
    labels = merge(local.common_labels, {
      component = "gameserver"
      app       = "cow-game-server"
    })
  }

  spec {
    replicas = 1
    
    selector {
      match_labels = {
        app         = "cow-game-server"
        environment = var.environment
        component   = "gameserver"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          component = "gameserver"
          app       = "cow-game-server"
        })
        annotations = {
          # Force pod restart when image changes
          "deployment.kubernetes.io/revision" = var.image_sha
        }
      }

      spec {
        container {
          name  = "game-server"
          image = "us-west1-docker.pkg.dev/thecowgame/game-images/mmo-server:${var.image_sha}"

          port {
            name           = "http"
            container_port = 3000
          }

          port {
            name           = "gameport"
            container_port = 6060
          }

          env {
            name  = "REDIS_HOST"
            value = "${local.pr_prefix}-redis"
          }

          env {
            name  = "REDIS_PORT"
            value = "6379"
          }

          env {
            name  = "PR_NUMBER"
            value = var.pr_number
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }

          resources {
            requests = {
              memory = "128Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "256Mi"
              cpu    = "200m"
            }
          }
        }

        image_pull_secrets {
          name = "artifact-registry-secret"
        }
        
        # Prefer to schedule on existing nodes to avoid triggering autoscaling
        affinity {
          node_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100
              preference {
                match_expressions {
                  key      = "cloud.google.com/gke-nodepool"
                  operator = "Exists"
                }
              }
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment_v1.redis]
}

# Game Server Service
resource "kubernetes_service_v1" "gameserver" {
  metadata {
    name      = "${local.pr_prefix}-server"
    namespace = "default"
    labels = merge(local.common_labels, {
      component = "gameserver"
      app       = "cow-game-server"
    })
  }

  spec {
    type = "LoadBalancer"
    
    port {
      name        = "http"
      port        = 80
      target_port = 3000
      protocol    = "TCP"
    }

    port {
      name        = "gameport"
      port        = 6060
      target_port = 6060
      protocol    = "TCP"
    }

    selector = {
      app         = "cow-game-server"
      environment = var.environment
    }
  }
} 