# Deploy

Blue-green deployment infrastructure. Zero-downtime deploys with instant rollback.

- `deploy-bg.sh` — Main orchestrator (build → start → health check → switch Nginx → drain)
- `rollback.sh` — Instant rollback to previous container (~10s)
- `Dockerfile` — Multi-stage Python 3.11 image
- `docker-compose.yml` — Blue (port 8000) + Green (port 8001) service definitions
- `setup-docker.sh` — One-time EC2 Docker installation

See docs/blue-green.md for full deployment guide.
