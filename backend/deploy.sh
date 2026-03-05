#!/bin/bash
# ================================================================
# ICT LMS Backend — EC2 Deployment Script
#
# Run this ON your EC2 instance (Ubuntu 22.04 or 24.04):
#   chmod +x deploy.sh && ./deploy.sh
#
# Prerequisites:
#   - Ubuntu EC2 with SSH access
#   - Elastic IP assigned
#   - Domain apiict.zensbot.site pointing to the Elastic IP
# ================================================================

set -e  # Exit on any error

DOMAIN="apiict.zensbot.site"
REPO="https://github.com/hassanarshad123/ICT_LMS_CUSTOM.git"
APP_DIR="/home/ubuntu/ICT_LMS_CUSTOM"
BACKEND_DIR="$APP_DIR/backend"

echo "========================================="
echo "  ICT LMS Backend — EC2 Deployment"
echo "========================================="

# ─── Step 1: System packages ───
echo ""
echo "[1/8] Installing system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-dev python3-pip \
    nginx certbot python3-certbot-nginx git

# Detect Python version
PYTHON=$(command -v python3)
echo "  Python: $($PYTHON --version)"
echo "  Nginx:  $(nginx -v 2>&1)"
echo "  Git:    $(git --version)"

# ─── Step 2: Clone or pull repo ───
echo ""
echo "[2/8] Setting up repository..."
if [ -d "$APP_DIR" ]; then
    echo "  Repo exists, pulling latest..."
    cd "$APP_DIR" && git pull origin main
else
    echo "  Cloning repo..."
    cd /home/ubuntu && git clone "$REPO"
fi

# ─── Step 3: Python virtual environment ───
echo ""
echo "[3/8] Setting up Python environment..."
cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
    $PYTHON -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "  Dependencies installed."

# ─── Step 4: Environment file ───
echo ""
echo "[4/8] Checking .env file..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"

    # Generate secure JWT secret
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i "s|JWT_SECRET_KEY=.*|JWT_SECRET_KEY=$JWT_SECRET|" "$BACKEND_DIR/.env"

    # Set production values
    sed -i "s|APP_ENV=development|APP_ENV=production|" "$BACKEND_DIR/.env"
    sed -i "s|APP_DEBUG=true|APP_DEBUG=false|" "$BACKEND_DIR/.env"

    echo ""
    echo "  ┌──────────────────────────────────────────────────┐"
    echo "  │  .env created! You MUST edit it now:              │"
    echo "  │                                                   │"
    echo "  │  nano $BACKEND_DIR/.env     │"
    echo "  │                                                   │"
    echo "  │  Fill in:                                         │"
    echo "  │   - DATABASE_URL (Neon pooler URL)                │"
    echo "  │   - DATABASE_URL_DIRECT (Neon direct URL)         │"
    echo "  │   - ALLOWED_ORIGINS                               │"
    echo "  │                                                   │"
    echo "  │  Then re-run this script.                         │"
    echo "  └──────────────────────────────────────────────────┘"
    echo ""
    exit 0
else
    echo "  .env exists — OK"
fi

# ─── Step 5: Test database connection ───
echo ""
echo "[5/8] Testing database connection..."
source venv/bin/activate
python3 -c "
import asyncio
from app.database import engine
from sqlalchemy import text

async def test():
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT count(*) FROM users'))
        count = result.scalar()
        print(f'  DB connected. Users: {count}')

asyncio.run(test())
"

# ─── Step 6: systemd service ───
echo ""
echo "[6/8] Setting up systemd service..."
sudo tee /etc/systemd/system/ict-lms-api.service > /dev/null <<SVCEOF
[Unit]
Description=ICT LMS FastAPI Backend
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$BACKEND_DIR/venv/bin:/usr/bin"
EnvironmentFile=$BACKEND_DIR/.env
ExecStart=$BACKEND_DIR/venv/bin/uvicorn main:app --workers 2 --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable ict-lms-api
sudo systemctl restart ict-lms-api
sleep 2

if sudo systemctl is-active --quiet ict-lms-api; then
    echo "  Service running ✓"
else
    echo "  Service FAILED — check: sudo journalctl -u ict-lms-api -n 20"
    exit 1
fi

# ─── Step 7: Nginx reverse proxy ───
echo ""
echo "[7/8] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/ict-lms-api > /dev/null <<'NGXEOF'
server {
    listen 80;
    server_name apiict.zensbot.site;

    client_max_body_size 110M;

    # API routes
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
    }

    # WebSocket routes
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }
}
NGXEOF

sudo ln -sf /etc/nginx/sites-available/ict-lms-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
echo "  Nginx configured ✓"

# ─── Step 8: SSL certificate ───
echo ""
echo "[8/8] Setting up SSL with Let's Encrypt..."
echo "  Make sure $DOMAIN DNS points to this server's IP!"
echo ""
read -p "  Continue with SSL setup? (y/n): " ssl_choice
if [ "$ssl_choice" = "y" ]; then
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@zensbot.site
    echo "  SSL configured ✓"
else
    echo "  Skipping SSL — you can run later:"
    echo "  sudo certbot --nginx -d $DOMAIN"
fi

# ─── Done ───
echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "  API URL:    http://$DOMAIN/api/health"
echo "  Swagger UI: http://$DOMAIN/docs"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status ict-lms-api    # Check service"
echo "    sudo journalctl -u ict-lms-api -f    # View logs"
echo "    sudo systemctl restart ict-lms-api   # Restart"
echo "    cd $BACKEND_DIR && git pull && sudo systemctl restart ict-lms-api  # Update"
echo ""
