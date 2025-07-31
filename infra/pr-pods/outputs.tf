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

output "redis_pod_name" {
  description = "Name of the Redis pod"
  value       = kubernetes_pod_v1.redis.metadata[0].name
}

output "gameserver_pod_name" {
  description = "Name of the game server pod"
  value       = kubernetes_pod_v1.gameserver.metadata[0].name
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
    kubectl get pods -l pr-number=${var.pr_number}
    kubectl get services -l pr-number=${var.pr_number}
    
    To view logs:
    kubectl logs ${kubernetes_pod_v1.gameserver.metadata[0].name}
    kubectl logs ${kubernetes_pod_v1.redis.metadata[0].name}
    
    To access game server (once LoadBalancer gets IP):
    kubectl get service ${kubernetes_service_v1.gameserver.metadata[0].name} -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
  EOT
} 