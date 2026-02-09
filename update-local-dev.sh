# Update kind cluster with latest images. Run from repo root. Requires kind and kubectl.
# Setup: see the-cow-game-infra/local

docker build -t mmo-server:local .
kind load docker-image mmo-server:local
kubectl rollout restart deployment the-cow-game-server

docker build -f Dockerfile.web -t mmo-web:local .
kind load docker-image mmo-web:local
kubectl rollout restart deployment the-cow-game-web

docker build -f Dockerfile.api -t cow-game-api:local .
kind load docker-image cow-game-api:local
kubectl rollout restart deployment cow-api-server

kubectl port-forward --namespace=ingress-nginx service/ingress-nginx-controller 7777:80