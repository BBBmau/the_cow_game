# Redis Pod
resource "kubernetes_pod_v1" "redis" {
  metadata {
    name      = "${local.pr_prefix}-redis"
    namespace = "default"
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
          memory = "128Mi"
          cpu    = "100m"
        }
        limits = {
          memory = "256Mi"
          cpu    = "200m"
        }
      }

      command = [
        "redis-server",
        "--appendonly", "yes",
        "--maxmemory", "200mb",
        "--maxmemory-policy", "allkeys-lru"
      ]
    }

    restart_policy = "Always"
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

# Game Server Pod
resource "kubernetes_pod_v1" "gameserver" {
  metadata {
    name      = "${local.pr_prefix}-server"
    namespace = "default"
    labels = merge(local.common_labels, {
      component = "gameserver"
      app       = "cow-game-server"
    })
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
          memory = "256Mi"
          cpu    = "250m"
        }
        limits = {
          memory = "512Mi"
          cpu    = "500m"
        }
      }
    }

    restart_policy = "Always"

    image_pull_secrets {
      name = "artifact-registry-secret"
    }
  }

  depends_on = [kubernetes_pod_v1.redis]
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