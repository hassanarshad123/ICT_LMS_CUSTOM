#!/usr/bin/env bash
# ================================================================
# One-time setup: Install Docker on EC2 for blue-green deployment
# Run ONCE on the EC2 instance before first blue-green deploy
# ================================================================
set -euo pipefail

echo "=== Docker Setup for Blue-Green Deployment ==="

echo "[1/5] Installing Docker..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "[2/5] Adding ubuntu to docker group..."
sudo usermod -aG docker ubuntu

echo "[3/5] Creating log directory..."
sudo mkdir -p /var/log/lms
sudo chown ubuntu:ubuntu /var/log/lms

echo "[4/5] Disabling old systemd service..."
sudo systemctl stop ict-lms-api 2>/dev/null || true
sudo systemctl disable ict-lms-api 2>/dev/null || true

echo "[5/5] Setup complete!"
echo ""
echo "IMPORTANT: Log out and back in for docker group to take effect."
echo "Then run: cd /home/ubuntu/ICT_LMS_CUSTOM/backend && chmod +x deploy-bg.sh && ./deploy-bg.sh"
