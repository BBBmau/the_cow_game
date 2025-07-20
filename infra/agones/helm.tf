provider "helm" {
  kubernetes = {
    config_path = "~/.kube/config"
  }
}

// we use agones for setting up a game server on our kubernetes cluster
//resource "helm_release" "agones" {
//  name  = "agones"
//  chart = "agones/agones"
//}
