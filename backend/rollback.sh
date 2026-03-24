#!/usr/bin/env bash
# ================================================================
# Instant Rollback — switch back to previous container
# Usage: ./rollback.sh
# ================================================================
set -euo pipefail

BACKEND_DIR="/home/ubuntu/ICT_LMS_CUSTOM/backend"
STATE_FILE="$BACKEND_DIR/.active-slot"
NGINX_CONF="/etc/nginx/sites-available/ict-lms-api"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ROLLBACK: $*"; }

CURRENT_SLOT=$(cat "$STATE_FILE" 2>/dev/null || echo "unknown")

if [ "$CURRENT_SLOT" = "blue" ]; then
    ROLLBACK_SLOT="green"
    ROLLBACK_PORT=8001
elif [ "$CURRENT_SLOT" = "green" ]; then
    ROLLBACK_SLOT="blue"
    ROLLBACK_PORT=8000
else
    echo "Cannot determine current slot. State file: $STATE_FILE"
    exit 1
fi

log "Rolling back from $CURRENT_SLOT -> $ROLLBACK_SLOT (port $ROLLBACK_PORT)"

# Start the old container
cd "$BACKEND_DIR"
if docker ps -a --format '{{.Names}}' | grep -q "lms-$ROLLBACK_SLOT"; then
    docker start "lms-$ROLLBACK_SLOT" 2>/dev/null || docker compose up -d "lms-$ROLLBACK_SLOT"
else
    log "Container lms-$ROLLBACK_SLOT not found — starting from compose..."
    docker compose up -d "lms-$ROLLBACK_SLOT"
fi

# Wait for health
log "Waiting for lms-$ROLLBACK_SLOT to become healthy..."
for i in $(seq 1 10); do
    if curl -sf --max-time 5 "http://127.0.0.1:$ROLLBACK_PORT/api/health" > /dev/null 2>&1; then
        log "Health check passed"
        break
    fi
    sleep 2
done

# Switch Nginx
sudo sed -i "s|proxy_pass http://127.0.0.1:[0-9]*;|proxy_pass http://127.0.0.1:$ROLLBACK_PORT;|g" "$NGINX_CONF"
sudo nginx -t && sudo nginx -s reload

# Transfer scheduler
redis-cli SET "lms:scheduler:owner" "$ROLLBACK_SLOT" EX 86400 > /dev/null 2>&1 || true

# Stop broken container
docker compose stop "lms-$CURRENT_SLOT" 2>/dev/null || true

echo "$ROLLBACK_SLOT" > "$STATE_FILE"

# Discord notification
if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
    curl -sf -X POST "$DISCORD_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"**ROLLBACK** from $CURRENT_SLOT -> $ROLLBACK_SLOT (port $ROLLBACK_PORT)\"}" \
        > /dev/null 2>&1 || true
fi

log "Rollback complete. Active: $ROLLBACK_SLOT on port $ROLLBACK_PORT"
