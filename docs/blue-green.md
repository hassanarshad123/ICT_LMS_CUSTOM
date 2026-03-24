# Blue-Green Deployment Guide — ICT LMS

## Architecture

```
  Cloudflare (apiict.zensbot.site)
         │
         ▼
  ┌─── EC2 t3.medium (4GB RAM) ──────────────────────┐
  │                                                    │
  │  Nginx (80/443, SSL via Let's Encrypt)             │
  │    ↓                                               │
  │  proxy_pass → 127.0.0.1:PORT                      │
  │    ├── lms-blue  (Docker, host port 8000)          │
  │    └── lms-green (Docker, host port 8001)          │
  │                                                    │
  │  Redis (6379) — shared cache + Pub/Sub             │
  └────────────────────────────────────────────────────┘
         │
         ▼
  RDS PostgreSQL (shared by both containers)
```

- Only ONE container serves traffic at a time
- Nginx gracefully switches between ports (zero downtime)
- Both containers share the same database and Redis

## How Deploy Works

Every push to `main` with backend changes triggers GitHub Actions:

```
1. SSH into EC2, run deploy-bg.sh
2. git fetch + reset to latest main
3. docker build -t lms-backend:$GIT_SHA
4. Detect active slot (read .active-slot file)
   - If blue is active → deploy to GREEN (port 8001)
   - If green is active → deploy to BLUE (port 8000)
5. Start new container on standby port
6. Validate migrations (check for destructive ops)
7. Run: alembic upgrade head (from new container)
8. Health check new container (10 retries, 3s apart)
9. IF HEALTHY:
   - sed Nginx proxy_pass → new port
   - nginx -s reload (graceful, zero downtime)
   - Transfer scheduler ownership via Redis
   - Wait 60s post-deploy monitoring
   - Wait 30s drain (WebSocket connections)
   - Stop old container
   - Update .active-slot
10. IF UNHEALTHY:
    - Stop new container
    - Old container keeps serving (no impact)
    - CI reports failure
```

## How Rollback Works

### Automatic Rollback
- If health check fails during deploy → old container keeps running
- If health check fails 60s AFTER switch → auto-rollback via rollback.sh

### Manual Rollback
```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220
cd /home/ubuntu/ICT_LMS_CUSTOM/backend
./rollback.sh
```

What it does:
1. Reads `.active-slot` to find current container
2. Starts the OTHER container (was stopped, image preserved)
3. Health checks it
4. Switches Nginx back
5. Stops the broken container
6. **Total time: ~10 seconds**

## Key Files

| File | Purpose |
|------|---------|
| `backend/deploy-bg.sh` | Main deploy orchestrator |
| `backend/rollback.sh` | Instant rollback |
| `backend/Dockerfile` | Multi-stage Python 3.11 image |
| `backend/docker-compose.yml` | Blue/green service definitions |
| `backend/.active-slot` | Current active container (blue or green) |
| `/var/log/lms/deploy-*.log` | Deploy logs with timestamps |
| `/etc/nginx/sites-available/ict-lms-api` | Nginx config (proxy_pass port) |

## Scheduler Deduplication

Only ONE container runs background jobs (APScheduler):
- `SCHEDULER_ENABLED` env var controls which container has the scheduler
- Deploy script sets this per-container
- `scheduler_lock.py` provides Redis-based distributed lock as safety net

## Redis Caching

| Cache | Key Pattern | TTL | Invalidation |
|-------|-------------|-----|-------------|
| User auth | `lms:user_index:{user_id}` | 5 min | Logout, password change |
| Dashboard | `lms:{institute_id}:dashboard` | 2 min fresh, 10 min stale | Batch create/delete |
| Insights | `lms:{institute_id}:insights` | 5 min fresh, 15 min stale | Batch create/delete |
| Branding | `lms:{institute_id}:branding` | 1 hour | Admin branding update |

Stale-While-Revalidate: expired data is served instantly while background refresh happens.

## Sentry Integration

- Release: `ict-lms@{git_sha}` (unique per deploy)
- Tags: `deploy_slot: blue|green`, `git_sha`
- User context: id, email, role (attached on every request)

## Monitoring

### Check system status
```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220

# Container status
sudo docker ps

# Active slot
cat /home/ubuntu/ICT_LMS_CUSTOM/backend/.active-slot

# Health check
curl http://127.0.0.1:8000/api/health  # blue
curl http://127.0.0.1:8001/api/health  # green

# Container logs
sudo docker logs lms-blue --tail 50
sudo docker logs lms-green --tail 50

# Deploy logs
ls -la /var/log/lms/
cat /var/log/lms/deploy-*.log | tail -50

# Redis
redis-cli info memory | grep used_memory_human
redis-cli dbsize
redis-cli keys "lms:*"

# Memory
free -h
```

### Check cache stats (requires admin auth)
```
GET /api/v1/monitoring/cache-stats
```

## Troubleshooting

### 502 Bad Gateway
Nginx is pointing to a stopped container.
```bash
# Check which port Nginx uses
grep proxy_pass /etc/nginx/sites-available/ict-lms-api

# Check which containers are running
sudo docker ps

# Fix: point Nginx to the running container
sudo sed -i "s|proxy_pass http://127.0.0.1:[0-9]*;|proxy_pass http://127.0.0.1:8000;|g" /etc/nginx/sites-available/ict-lms-api
sudo nginx -s reload
```

### Container won't start
```bash
# Check logs
sudo docker logs lms-green --tail 100

# Common issues:
# - Missing .env file → check /home/ubuntu/ICT_LMS_CUSTOM/backend/.env
# - Redis unreachable → redis-cli ping
# - Database unreachable → check DATABASE_URL in .env
```

### Deploy failed mid-switch
```bash
# The old container should still be running
sudo docker ps

# If both stopped, start the one with the last known good image
sudo docker start lms-blue  # or lms-green
```

### Redis not accessible from Docker
```bash
# Check Redis bind address
sudo grep "^bind" /etc/redis/redis.conf
# Should include: 127.0.0.1 172.17.0.1

# Check protected mode
sudo grep "protected-mode" /etc/redis/redis.conf
# Should be: protected-mode no
```

## Cost

| Resource | Monthly |
|----------|---------|
| EC2 t3.medium | ~$30 |
| RDS db.t4g.micro | ~$15 |
| Redis (same EC2) | $0 |
| Docker | $0 |
| **Total** | **~$45/mo** |
