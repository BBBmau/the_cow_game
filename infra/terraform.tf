terraform {
  backend "gcs" {
    bucket      = "cow_game_k8s_tfstate"
    prefix      = "terraform/state"
  }

  required_providers {

    google = {
      version     = "6.38.0"
    }

    google-beta = {
      version     = "6.38.0"
    }
  }
}

provider "google" {
  project     = var.project_id
  region      = var.region
}

provider "google-beta" {
   project     = var.project_id
   region      = var.region
}

