# the cow game cluster
This repo is for managing of GCP infrastructure used by `playthecowgame.com`

It involves setting up a simple autopilot k8s cluster that utilizes [agones](https://github.com/googleforgames/agones/) for ease in managing game servers through the use of the agones helm chart

Everything is provisioned through Terraform with the use of google, kubernetes, and helm provider.

We utilize a GCS backend for our terraform state management

## Installing the Agones Helm Chart

To reproduce the installation of agones upon the setup of the GKE cluster, we'll first want to

### Add the agones repo
`helm repo add agones https://agones.dev/chart/stable`

once added we can proceed with the `helm.tf` configuration of the chart being added to our cluster. Once installed we can proceed with utilizing the CRDs for setting up game servers with the help of agones

### Setting up agones server

After setup we can utilize the cowgame docker image made from [`the_cow_game`](https://github.com/BBBmau/the_cow_game) repo to begin creating game servers, `GameServers` act as pods and `Fleets` act as deployments in the world of agones.

# TODO
- [ ] explanation of simple single server implementation for the cow game MMO
- [ ] investigate how we can move away from autopilot GKE cluster (perhaps cheaper?)
- [ ] investiate how we can have dynamic game servers that are made available as servers get filled up (this would be v2 where we allow users to pick the game server rather than joining one server - may or may not happen)
