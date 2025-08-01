output "redis_service_name" {
  description = "Name of the Redis service"
  value       = kubernetes_service_v1.redis.metadata[0].name
}

output "gameserver_service_name" {
  description = "Name of the game server service"
  value       = kubernetes_service_v1.gameserver.metadata[0].name
}

output "gameserver_load_balancer_ip" {
  description = "Load balancer IP for the game server (may be pending)"
  value       = try(kubernetes_service_v1.gameserver.status[0].load_balancer[0].ingress[0].ip, "pending")
}

output "redis_deployment_name" {
  description = "Name of the Redis deployment"
  value       = kubernetes_deployment_v1.redis.metadata[0].name
}

output "gameserver_deployment_name" {
  description = "Name of the game server deployment"
  value       = kubernetes_deployment_v1.gameserver.metadata[0].name
}

output "redis_pod_selector" {
  description = "Label selector for Redis pods"
  value       = "app=cow-game-redis,environment=${var.environment}"
}

output "gameserver_pod_selector" {
  description = "Label selector for game server pods"
  value       = "app=cow-game-server,environment=${var.environment}"
}

output "pr_environment" {
  description = "PR environment identifier"
  value       = var.environment
}

output "access_instructions" {
  description = "Instructions for accessing the PR environment"
  value = <<-EOT
    PR Environment: ${var.environment}
    
    Game Server Service: ${kubernetes_service_v1.gameserver.metadata[0].name}
    Redis Service: ${kubernetes_service_v1.redis.metadata[0].name}
    
    To check status:
    kubectl get deployments -l pr-number=${var.pr_number}
    kubectl get pods -l pr-number=${var.pr_number}
    kubectl get services -l pr-number=${var.pr_number}
    
    To view logs (use deployment name):
    kubectl logs deployment/${kubernetes_deployment_v1.gameserver.metadata[0].name}
    kubectl logs deployment/${kubernetes_deployment_v1.redis.metadata[0].name}
    
    To access game server (once LoadBalancer gets IP):
    kubectl get service ${kubernetes_service_v1.gameserver.metadata[0].name} -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
    
    To update deployment with new image:
    kubectl set image deployment/${kubernetes_deployment_v1.gameserver.metadata[0].name} game-server=us-west1-docker.pkg.dev/thecowgame/game-images/mmo-server:NEW_SHA
  EOT
} 