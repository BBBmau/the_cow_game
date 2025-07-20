terraform {
  backend "gcs" {
    credentials = "../../credentials/thecowgame-clustermanager.json"
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
  credentials = "${file(var.credentials)}"
  project     = var.project_id
  region      = var.region
}

provider "google-beta" {
   credentials = "${file(var.credentials)}"
   project     = var.project_id
   region      = var.region
}

