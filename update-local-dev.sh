// this script is used to update the kind cluster with the latest image. be sure to setup the local dev found in the-cow-game-infra/local

docker build -t mmo-server:local .
kind load docker-image mmo-server:local
kubectl rollout restart deployment the-cow-game-server
sleep 3
kubectl port-forward deployment/the-cow-game-server 6060:80