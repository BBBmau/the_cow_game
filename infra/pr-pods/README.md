# PR Pod Environment Management

This directory contains Terraform configuration for managing lightweight PR environments using Kubernetes pods instead of creating entire clusters.

## Overview

When a PR is opened, synchronize, or reopened, this system will:
1. Build and push a Docker image with the PR changes
2. Deploy Redis and game server deployments
3. Create LoadBalancer services for external access
4. Comment on the PR with access information

**On PR Updates (new commits):**
- Builds new Docker image with latest code
- Updates deployments with new image SHA
- Deployments automatically roll out updates to pods
- Zero-downtime updates using Kubernetes rolling deployment strategy

When a PR is closed or merged, all resources are automatically cleaned up.

## Architecture

```
PR Environment (per PR):
├── Redis Deployment (cow-game-pr-{number}-redis)
│   ├── Internal ClusterIP service
│   ├── 64Mi memory, 50m CPU limit
│   ├── 32Mi memory, 25m CPU request
│   └── Auto-updates when PR is updated
└── Game Server Deployment (cow-game-pr-{number}-server)
    ├── LoadBalancer service (ports 80, 6060)
    ├── 128Mi memory, 100m CPU limit
    ├── 64Mi memory, 50m CPU request
    ├── Node affinity: prefers existing nodes
    ├── Auto-updates when PR is updated
    ├── Low priority: can be preempted if needed
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
- **Lightweight**: Optimized resource requests to coexist with production workloads
- **Node Efficient**: Prefers scheduling on existing nodes to avoid autoscaling
- **Auto-Updating**: Deployments automatically update when PR code changes
- **Zero-Downtime**: Rolling updates ensure no service interruption

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

Check deployment and pod status:
```bash
kubectl get deployments -l pr-number=123
kubectl get pods -l pr-number=123
kubectl get services -l pr-number=123

# Check node resource usage
kubectl top nodes
kubectl describe nodes

# Check pod resource requests vs available capacity
kubectl describe node | grep -A 5 "Allocated resources"
```

View logs:
```bash
kubectl logs deployment/cow-game-pr-123-server -f
kubectl logs deployment/cow-game-pr-123-redis -f
```

## Prerequisites

- Existing GKE cluster (`the-cow-game-cluster`)
- Docker registry secret (`artifact-registry-secret`)
- Proper IAM permissions for the service account
- Terraform backend bucket (`cow_game_k8s_tfstate`) 