#!/usr/bin/env bash
# ================================================================
# Blue-Green Deploy Orchestrator
# Called by GitHub Actions or manually on EC2
# ================================================================
set -euo pipefail

APP_DIR="/home/ubuntu/ICT_LMS_CUSTOM"
BACKEND_DIR="$APP_DIR/backend"
LOG_DIR="/var/log/lms"
DEPLOY_LOG="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
STATE_FILE="$BACKEND_DIR/.active-slot"
NGINX_CONF="/etc/nginx/sites-available/ict-lms-api"
HEALTH_RETRIES=10
HEALTH_DELAY=3
DRAIN_SECONDS=30

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$DEPLOY_LOG"; }
die() { log "FATAL: $*"; exit 1; }

mkdir -p "$LOG_DIR"
log "=== Blue-Green Deploy Started ==="

# ── Step 1: Pull latest code ──
log "[1/10] Pulling latest code..."
cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main
git clean -fd backend/migrations/versions/

GIT_SHA=$(git rev-parse --short HEAD)
GIT_SHA_FULL=$(git rev-parse HEAD)
log "Git SHA: $GIT_SHA ($GIT_SHA_FULL)"

# ── Step 2: Build Docker image ──
log "[2/10] Building Docker image lms-backend:$GIT_SHA..."
cd "$BACKEND_DIR"
docker build -f deploy/Dockerfile -t "lms-backend:$GIT_SHA" -t "lms-backend:latest" .
log "Image built successfully"

# ── Step 3: Determine active/standby slots ──
if [ -f "$STATE_FILE" ]; then
    ACTIVE_SLOT=$(cat "$STATE_FILE")
else
    ACTIVE_SLOT="none"
fi

if [ "$ACTIVE_SLOT" = "green" ]; then
    DEPLOY_SLOT="blue"
    DEPLOY_PORT=8000
    ACTIVE_PORT=8001
else
    DEPLOY_SLOT="green"
    DEPLOY_PORT=8001
    ACTIVE_PORT=8000
fi

log "[3/10] Active: $ACTIVE_SLOT ($ACTIVE_PORT) -> Deploying: $DEPLOY_SLOT ($DEPLOY_PORT)"

# ── Step 4: Start new container on standby port ──
log "[4/10] Starting $DEPLOY_SLOT container..."
export DEPLOY_IMAGE_TAG="$GIT_SHA"
export GIT_SHA="$GIT_SHA_FULL"
if [ "$DEPLOY_SLOT" = "blue" ]; then
    export BLUE_SCHEDULER=false
    export GREEN_SCHEDULER=true
else
    export BLUE_SCHEDULER=true
    export GREEN_SCHEDULER=false
fi

docker compose -f deploy/docker-compose.yml up -d --force-recreate "lms-$DEPLOY_SLOT"
log "$DEPLOY_SLOT container started"

# ── Step 5: Migration safety checks ──
log "[5/10] Checking migrations..."
NEW_MIGRATIONS=$(git diff HEAD~1 --name-only -- migrations/versions/ 2>/dev/null || echo "")
DANGEROUS=false
if [ -n "$NEW_MIGRATIONS" ]; then
    for mf in $NEW_MIGRATIONS; do
        if [ -f "$mf" ] && grep -qiE "(drop\s+(table|column|index)|alter.*set\s+not\s+null|rename\s+(table|column))" "$mf" 2>/dev/null; then
            log "DANGEROUS: $mf contains destructive operations!"
            DANGEROUS=true
        fi
    done
    if [ "$DANGEROUS" = "true" ] && [ "${FORCE_MIGRATE:-}" != "true" ]; then
        docker compose -f deploy/docker-compose.yml stop "lms-$DEPLOY_SLOT"
        die "Destructive migration detected. Set FORCE_MIGRATE=true to proceed."
    fi
fi

# ── Step 6: Run database migrations ──
log "[6/10] Running database migrations (timeout: 120s)..."
timeout 120 docker exec "lms-$DEPLOY_SLOT" alembic upgrade head || {
    log "MIGRATION FAILED or TIMED OUT"
    docker compose -f deploy/docker-compose.yml stop "lms-$DEPLOY_SLOT"
    die "Migration failed. $ACTIVE_SLOT still serving traffic."
}
log "Migrations complete"

# ── Step 7: Health check ──
log "[7/10] Health checking $DEPLOY_SLOT on port $DEPLOY_PORT..."
HEALTHY=false
for i in $(seq 1 $HEALTH_RETRIES); do
    if curl -sf --max-time 5 "http://127.0.0.1:$DEPLOY_PORT/api/health" > /dev/null 2>&1; then
        HEALTHY=true
        log "Health check passed (attempt $i/$HEALTH_RETRIES)"
        break
    fi
    log "Health check attempt $i/$HEALTH_RETRIES failed, retrying in ${HEALTH_DELAY}s..."
    sleep "$HEALTH_DELAY"
done

if [ "$HEALTHY" != "true" ]; then
    log "HEALTH CHECK FAILED"
    docker compose -f deploy/docker-compose.yml logs "lms-$DEPLOY_SLOT" >> "$DEPLOY_LOG" 2>&1 || true
    docker compose -f deploy/docker-compose.yml stop "lms-$DEPLOY_SLOT"
    die "Deployment aborted. $ACTIVE_SLOT still serving traffic."
fi

# ── Step 8: Switch traffic ──
log "[8/10] Switching Nginx to $DEPLOY_SLOT (port $DEPLOY_PORT)..."
sudo sed -i "s|proxy_pass http://127.0.0.1:[0-9]*;|proxy_pass http://127.0.0.1:$DEPLOY_PORT;|g" "$NGINX_CONF"
sudo nginx -t || die "Nginx config test failed!"
sudo nginx -s reload
log "Nginx reloaded — traffic now on $DEPLOY_SLOT"

# Transfer scheduler to new container
redis-cli SET "lms:scheduler:owner" "$DEPLOY_SLOT" EX 86400 > /dev/null 2>&1 || true

# ── Step 9: Post-deploy monitoring (60s) ──
log "[9/10] Post-deploy monitoring (60s window)..."
sleep 60
if ! curl -sf --max-time 5 "http://127.0.0.1:$DEPLOY_PORT/api/health" > /dev/null 2>&1; then
    log "POST-DEPLOY HEALTH CHECK FAILED — auto-rolling back!"
    chmod +x "$BACKEND_DIR/rollback.sh"
    "$BACKEND_DIR/rollback.sh"
    exit 1
fi
log "Post-deploy health check passed"

# ── Step 10: Drain and stop old container ──
if [ "$ACTIVE_SLOT" != "none" ]; then
    log "[10/10] Draining $ACTIVE_SLOT for ${DRAIN_SECONDS}s..."
    sleep "$DRAIN_SECONDS"
    docker compose -f deploy/docker-compose.yml stop "lms-$ACTIVE_SLOT" 2>/dev/null || true
    log "$ACTIVE_SLOT stopped"
else
    log "[10/10] No previous container to stop (first deploy)"
fi

echo "$DEPLOY_SLOT" > "$STATE_FILE"

# Cleanup old images (keep last 3)
docker images lms-backend --format '{{.Tag}} {{.ID}}' | \
    sort -rV | tail -n +4 | awk '{print $2}' | \
    xargs -r docker rmi 2>/dev/null || true

# Discord notification
if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
    curl -sf -X POST "$DISCORD_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"Deployed **$GIT_SHA** to **$DEPLOY_SLOT** (port $DEPLOY_PORT)\"}" \
        > /dev/null 2>&1 || true
fi

log "=== Deploy Complete ==="
log "Active: $DEPLOY_SLOT on port $DEPLOY_PORT"
log "Image: lms-backend:$GIT_SHA"
exit 0
