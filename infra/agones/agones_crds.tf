resource "kubernetes_manifest" "gameserver_the_first_cow_game_server" {
  manifest = {
    "apiVersion" = "agones.dev/v1"
    "kind" = "GameServer"
    "metadata" = {
      "name" = "the-first-cow-game-server"
      "namespace" = "default"
    }
    "spec" = {
      "ports" = [
        {
          "containerPort" = 8080
	  "name" = "default"
	  "protocol" = "TCP"
          "portPolicy" = "Dynamic"
        },
      ]
      "health" = {
	"disabled" = "true"	
      }
      "template" = {
        "spec" = {
          "containers" = [
            {
              "image" = "us-west1-docker.pkg.dev/thecowgame/game-images/mmo-server@sha256:5cbb059cf7252d471fb557b8d48177c6c8ca382334d615ecaface6e07ec6e785" // first pushed image
              "name" = "thecowgameserver"
              "resources" = {
                "limits" = {
                  "cpu" = "20m"
                  "memory" = "64Mi"
                }
                "requests" = {
                  "cpu" = "20m"
                  "memory" = "64Mi"
                }
              }
            },
          ]
          "imagePullSecrets" = [
            {
              "name" = "artifact-registry-secret"
            }
          ]
        }
      }
    }
  }
}
