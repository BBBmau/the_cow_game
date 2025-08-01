variable "project_id" {
  type        = string
  description = "The project ID to deploy resources in"
}

variable "region" {
  type        = string
  description = "The region where the GKE cluster is located"
}

variable "pr_number" {
  type        = string
  description = "PR number for resource naming"
}

variable "image_sha" {
  type        = string
  description = "The SHA of the Docker image to deploy"
}

variable "environment" {
  type        = string
  description = "Environment name (pr-123)"
}

# Locals for consistent naming
locals {
  pr_prefix = "cow-game-pr-${var.pr_number}"
  
  common_labels = {
    app         = "cow-game"
    environment = var.environment
    pr-number   = var.pr_number
    managed-by  = "terraform"
  }
} 