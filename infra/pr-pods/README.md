# PR Pod Environment Management

This directory contains Terraform configuration for managing lightweight PR environments using Kubernetes pods instead of creating entire clusters.

## Overview

When a PR is opened, synchronize, or reopened, this system will:
1. Build and push a Docker image with the PR changes
2. Deploy a Redis pod for data storage
3. Deploy a game server pod using the new image
4. Create LoadBalancer services for external access
5. Comment on the PR with access information

When a PR is closed or merged, all resources are automatically cleaned up.

## Architecture

```
PR Environment (per PR):
├── Redis Pod (cow-game-pr-{number}-redis)
│   ├── Internal ClusterIP service
│   └── 256Mi memory, 200m CPU limit
└── Game Server Pod (cow-game-pr-{number}-server)
    ├── LoadBalancer service (ports 80, 6060)
    ├── 512Mi memory, 500m CPU limit
    └── Environment variables:
        ├── REDIS_HOST=cow-game-pr-{number}-redis
        ├── PR_NUMBER={number}
        └── ENVIRONMENT=pr-{number}
```

## Benefits vs Full Cluster Approach

- **Cost Efficient**: Only creates pods, not entire clusters
- **Fast Deployment**: ~2-3 minutes vs 10+ minutes for clusters
- **Resource Sharing**: Uses existing production cluster
- **Simpler Management**: Fewer resources to track and clean up
- **Isolated**: Each PR gets its own pods and services

## Files

- `terraform.tf` - Provider and backend configuration
- `variables.tf` - Variable definitions and locals
- `main.tf` - Kubernetes resources (pods and services)
- `outputs.tf` - Useful outputs for GitHub Actions

## Usage

This is automatically triggered by the GitHub Actions workflow `.github/workflows/pr-pods.yaml`.

### Manual Usage

```bash
cd infra/pr-pods

# Initialize Terraform
terraform init

# Create workspace for PR
terraform workspace new pr-123

# Set variables
cat > terraform.tfvars <<EOF
project_id = "thecowgame"
region = "us-west1"
image_sha = "abc123f"
environment = "pr-123"
pr_number = "123"
EOF

# Deploy
terraform plan
terraform apply

# Clean up
terraform destroy
terraform workspace select default
terraform workspace delete pr-123
```

## Monitoring

Check pod status:
```bash
kubectl get pods -l pr-number=123
kubectl get services -l pr-number=123
```

View logs:
```bash
kubectl logs cow-game-pr-123-server
kubectl logs cow-game-pr-123-redis
```

## Prerequisites

- Existing GKE cluster (`the-cow-game-cluster`)
- Docker registry secret (`artifact-registry-secret`)
- Proper IAM permissions for the service account
- Terraform backend bucket (`cow_game_k8s_tfstate`) 