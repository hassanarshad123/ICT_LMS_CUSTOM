# ICT Institute LMS — Deployment Guide

> Step-by-step setup for every service. Follow in order — each section depends on the previous ones.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [AWS RDS PostgreSQL Setup](#2-aws-rds-postgresql-setup)
3. [AWS EC2 Setup](#3-aws-ec2-setup)
4. [AWS S3 Setup](#4-aws-s3-setup)
5. [Bunny.net Setup](#5-bunnynet-setup)
6. [Zoom OAuth App Setup](#6-zoom-oauth-app-setup)
7. [Resend Email Setup](#7-resend-email-setup)
8. [Deploy FastAPI to EC2](#8-deploy-fastapi-to-ec2)
9. [Vercel Frontend Setup](#9-vercel-frontend-setup)
10. [Domain & SSL](#10-domain--ssl)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Post-Deployment Checklist](#12-post-deployment-checklist)

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] AWS account (for EC2 + S3 + RDS)
- [ ] Bunny.net account (https://bunny.net)
- [ ] Zoom Developer account (https://marketplace.zoom.us)
- [ ] Resend account (https://resend.com — free tier)
- [ ] GitHub repository with the monorepo
- [ ] Domain name (optional but recommended, e.g., `ictlms.com`)
- [ ] Python 3.11+ installed locally
- [ ] Node.js 18+ installed locally
- [ ] AWS CLI installed and configured (`aws configure`)

---

## 2. AWS RDS PostgreSQL Setup

### 2.1 Create RDS Instance

You can create the instance via the AWS Console or AWS CLI.

**Via AWS CLI:**

```bash
aws rds create-db-instance \
  --db-instance-identifier ict-lms-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username lms_admin \
  --master-user-password '<strong-password>' \
  --allocated-storage 20 \
  --storage-type gp3 \
  --region ap-south-1 \
  --vpc-security-group-ids <sg-id> \
  --db-name ict_lms \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --storage-encrypted

# Wait for the instance to become available
aws rds wait db-instance-available --db-instance-identifier ict-lms-db --region ap-south-1

# Verify the instance is running
aws rds describe-db-instances --db-instance-identifier ict-lms-db --region ap-south-1 \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}'
```

**Via AWS Console:**

1. Go to AWS Console --> RDS --> Create database
2. **Engine:** PostgreSQL 16
3. **Template:** Free tier (or Dev/Test)
4. **DB instance identifier:** `ict-lms-db`
5. **Instance class:** `db.t4g.micro`
6. **Storage:** 20 GB gp3
7. **Master username:** `lms_admin`
8. **Master password:** Use a strong password
9. **VPC:** Same VPC as EC2 instance
10. **Public access:** No (EC2 connects via private network)
11. **DB name:** `ict_lms`
12. **Backup retention:** 7 days
13. **Encryption:** Enable

### 2.2 Configure Security Group

The RDS security group must allow inbound PostgreSQL traffic from the EC2 instance:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| PostgreSQL | 5432 | EC2 security group ID | Backend access |

```bash
# Add inbound rule allowing EC2 to reach RDS on port 5432
aws ec2 authorize-security-group-ingress \
  --group-id <rds-sg-id> \
  --protocol tcp \
  --port 5432 \
  --source-group <ec2-sg-id> \
  --region ap-south-1
```

### 2.3 Get Connection String

The RDS endpoint for this instance is:

```
ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com:5432
```

Connection string format for the backend `.env`:

```bash
# For FastAPI (async)
DATABASE_URL="postgresql+asyncpg://lms_admin:<password>@ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com:5432/ict_lms?ssl=require"

# For Alembic migrations (sync driver)
DATABASE_URL_DIRECT="postgresql+asyncpg://lms_admin:<password>@ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com:5432/ict_lms?ssl=require"
```

Since RDS does not use a connection pooler like pgBouncer by default, the same endpoint is used for both application traffic and migrations. If you add RDS Proxy later, the proxy endpoint replaces `DATABASE_URL` while the direct RDS endpoint stays in `DATABASE_URL_DIRECT`.

### 2.4 Run Initial Migration

```bash
cd backend

# Set the DATABASE_URL in .env (see 2.3 above), then:
alembic upgrade head

# Seed initial data (admin user + system settings)
python -m app.scripts.seed
```

### 2.5 Day-to-Day RDS Management

```bash
# Check instance status
aws rds describe-db-instances --db-instance-identifier ict-lms-db --region ap-south-1 \
  --query 'DBInstances[0].DBInstanceStatus'

# Create a manual snapshot before risky operations
aws rds create-db-snapshot \
  --db-instance-identifier ict-lms-db \
  --db-snapshot-identifier ict-lms-pre-migration-$(date +%Y%m%d) \
  --region ap-south-1

# List available snapshots
aws rds describe-db-snapshots --db-instance-identifier ict-lms-db --region ap-south-1 \
  --query 'DBSnapshots[*].{ID:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime}'

# Restore from a snapshot (creates a new instance)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ict-lms-db-restored \
  --db-snapshot-identifier <snapshot-id> \
  --region ap-south-1

# Point-in-time restore (to any second within the backup retention window)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier ict-lms-db \
  --target-db-instance-identifier ict-lms-db-restored \
  --restore-time 2026-03-10T12:00:00Z \
  --region ap-south-1

# Connect via psql from the EC2 instance
psql -h ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com -U lms_admin -d ict_lms

# Modify instance (e.g., scale up)
aws rds modify-db-instance \
  --db-instance-identifier ict-lms-db \
  --db-instance-class db.t4g.small \
  --apply-immediately \
  --region ap-south-1
```

---

## 3. AWS EC2 Setup

### 3.1 Launch Instance

1. Go to AWS Console → EC2 → Launch Instance
2. **Name:** `ict-lms-api`
3. **AMI:** Ubuntu 22.04 LTS (64-bit, x86)
4. **Instance type:** `t3.small` (2 vCPU, 2 GB RAM)
5. **Key pair:** Create new or select existing (for SSH)
6. **Security group:** Create new with rules:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | My IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | HTTP redirect |
| HTTPS | 443 | 0.0.0.0/0 | API + WebSocket |

7. **Storage:** 20 GB gp3 (sufficient)
8. Launch

### 3.2 Elastic IP

1. EC2 → Elastic IPs → Allocate
2. Associate with the `ict-lms-api` instance
3. Note the Elastic IP — this is your permanent server IP

### 3.3 Initial Server Setup

```bash
# SSH into the server
ssh -i your-key.pem ubuntu@<elastic-ip>

# Update packages
sudo apt update && sudo apt upgrade -y

# Install Python 3.11
sudo apt install python3.11 python3.11-venv python3.11-dev python3-pip -y

# Install Nginx
sudo apt install nginx -y

# Install Certbot (for SSL)
sudo apt install certbot python3-certbot-nginx -y

# Install Git
sudo apt install git -y

# Verify installations
python3.11 --version  # Python 3.11.x
nginx -v               # nginx/1.18.x
git --version           # git 2.x
```

---

## 4. AWS S3 Setup

### 4.1 Create Buckets

Go to AWS Console → S3 → Create bucket for each:

| Bucket Name | Region | Block Public Access |
|-------------|--------|-------------------|
| `ict-lms-resumes` | ap-south-1 | Block ALL public access |
| `ict-lms-avatars` | ap-south-1 | Block ALL public access |
| `ict-lms-materials` | ap-south-1 | Block ALL public access |
| `ict-lms-exports` | ap-south-1 | Block ALL public access |

### 4.2 Lifecycle Rule for Exports

On `ict-lms-exports` bucket, add a lifecycle rule:
- **Rule name:** `auto-delete-exports`
- **Action:** Expire current versions after **1 day**
- This auto-deletes temporary export files

### 4.3 Create IAM User

1. AWS Console → IAM → Users → Create user
2. **Name:** `ict-lms-s3-user`
3. **Access type:** Programmatic access only
4. Attach inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ict-lms-resumes",
        "arn:aws:s3:::ict-lms-resumes/*",
        "arn:aws:s3:::ict-lms-avatars",
        "arn:aws:s3:::ict-lms-avatars/*",
        "arn:aws:s3:::ict-lms-materials",
        "arn:aws:s3:::ict-lms-materials/*",
        "arn:aws:s3:::ict-lms-exports",
        "arn:aws:s3:::ict-lms-exports/*"
      ]
    }
  ]
}
```

5. Save the **Access Key ID** and **Secret Access Key**

### 4.4 CORS Configuration

On `ict-lms-materials` and `ict-lms-resumes` buckets (needed for browser direct upload):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["https://ict-lms.vercel.app", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 5. Bunny.net Setup

### 5.1 Create Stream Library

1. Log in to Bunny.net dashboard
2. Go to **Stream** → **Add Video Library**
3. **Library name:** `ict-lms-videos`
4. **Primary region:** Asia (or closest)

### 5.2 Enable Security

In the library settings:

1. **Token Authentication:** Enable → Copy the **Token Authentication Key** → `BUNNY_SIGNING_KEY`
2. **DRM:** Enable (prevents unauthorized playback)
3. **Watermarking:** Enable and configure position (bottom-right recommended)

### 5.3 Get API Keys

1. **API Key** (from Account → API Keys): `BUNNY_API_KEY`
2. **Library ID** (from Stream → Library → Settings): `BUNNY_LIBRARY_ID`
3. **CDN Hostname** (from Library → Overview): `BUNNY_CDN_HOSTNAME` (e.g., `vz-abc123.b-cdn.net`)

### 5.4 Test Upload

```bash
# Test that the API key works
curl -X GET "https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}" \
  -H "AccessKey: ${BUNNY_API_KEY}"
```

---

## 6. Zoom OAuth App Setup

### 6.1 Create Server-to-Server OAuth App

1. Go to https://marketplace.zoom.us
2. **Develop** → **Build App** → **Server-to-Server OAuth**
3. **App Name:** `ICT LMS Integration`

### 6.2 Configure Scopes

Add these scopes:
- `meeting:write:admin` — Create meetings
- `meeting:read:admin` — Read meeting details
- `report:read:admin` — Get past meeting participants

### 6.3 Configure Webhooks

1. In the app → **Feature** → **Event Subscriptions** → Enable
2. **Event notification endpoint URL:** `https://api.ictlms.com/api/v1/zoom/webhook`
3. Subscribe to events:
   - `meeting.started`
   - `meeting.ended`
   - `recording.completed`
4. Copy the **Secret Token** → `ZOOM_WEBHOOK_SECRET`

### 6.4 Get Credentials

From the app page:
- **Account ID** — stored in `zoom_accounts` table (per-account)
- **Client ID** — stored in `zoom_accounts` table (per-account)
- **Client Secret** — stored encrypted in `zoom_accounts` table (per-account)

These are entered via the Admin Settings page in the LMS, NOT as env vars (except `ZOOM_WEBHOOK_SECRET`).

---

## 7. Resend Email Setup

### 7.1 Create Account

1. Sign up at https://resend.com
2. Free tier: 100 emails/day, 3,000 emails/month

### 7.2 Verify Domain

1. **Domains** → **Add Domain** → `ictlms.com` (or your domain)
2. Add the DNS records Resend provides (DKIM, SPF, DMARC)
3. Wait for verification (usually < 1 hour)

### 7.3 Get API Key

1. **API Keys** → **Create API Key**
2. **Name:** `ict-lms-production`
3. **Permission:** Sending access
4. Copy → `RESEND_API_KEY`

### 7.4 Test Send

```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer ${RESEND_API_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "noreply@ictlms.com",
    "to": ["test@example.com"],
    "subject": "Test Email",
    "text": "If you see this, Resend is working."
  }'
```

---

## 8. Deploy Backend to EC2 (Docker Blue-Green)

The backend runs as Docker containers with zero-downtime blue-green deployment. See `docs/blue-green.md` for the full architecture.

### 8.1 Clone Repository

```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220
cd /home/ubuntu
git clone https://github.com/hassanarshad123/ICT_LMS_CUSTOM.git
cd ICT_LMS_CUSTOM/backend
```

### 8.2 Configure Environment

```bash
cp .env.example .env
nano .env
# Fill in all values from the services set up above (RDS, S3, Bunny, Zoom, Resend, JWT)
```

Generate security keys:
```bash
# JWT signing key
python3 -c "import secrets; print(secrets.token_hex(32))"

# Fernet encryption key (for Zoom credentials)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 8.3 One-Time Docker Setup

```bash
cd /home/ubuntu/ICT_LMS_CUSTOM/backend/deploy
chmod +x setup-docker.sh deploy-bg.sh rollback.sh
./setup-docker.sh  # Installs Docker, creates /var/log/lms, disables old systemd service
```

Logout and login again (for Docker group to take effect).

### 8.4 First Deploy

```bash
cd /home/ubuntu/ICT_LMS_CUSTOM/backend/deploy
./deploy-bg.sh
```

This will: build Docker image, start first container (green on port 8001), run migrations, health check, configure nginx, and write `.active-slot`.

### 8.5 Key Files on EC2

| File | Purpose |
|------|---------|
| `backend/.active-slot` | Tracks active container (blue or green) |
| `backend/.env` | Environment variables (shared by both containers) |
| `backend/deploy/deploy-bg.sh` | 10-step blue-green deploy orchestrator |
| `backend/deploy/rollback.sh` | Instant rollback (~10 seconds) |
| `backend/deploy/Dockerfile` | Multi-stage Python 3.11 build |
| `backend/deploy/docker-compose.yml` | Blue (port 8000) + Green (port 8001) services |
| `/var/log/lms/deploy-*.log` | Timestamped deploy logs |

### 8.6 Manual Deploy / Rollback

```bash
# Deploy latest code
cd /home/ubuntu/ICT_LMS_CUSTOM/backend/deploy
./deploy-bg.sh

# Instant rollback to previous version
./rollback.sh
```

### 8.7 Nginx Configuration

Located at `/etc/nginx/sites-available/ict-lms-api`. The deploy script automatically switches `proxy_pass` between ports 8000 (blue) and 8001 (green) using sed + `nginx -s reload`. No manual nginx changes needed.

### 8.8 Monitoring

```bash
docker ps                                    # container status
docker logs lms-green --tail 50             # container logs
cat backend/.active-slot                     # active slot
redis-cli GET "lms:scheduler:owner"         # scheduler ownership
curl -sf http://127.0.0.1:8000/api/health   # blue health
curl -sf http://127.0.0.1:8001/api/health   # green health
```

---

## 9. Vercel Frontend Setup

### 9.1 Connect Repository

1. Go to https://vercel.com → **New Project**
2. Import the GitHub repository
3. **Framework Preset:** Next.js
4. **Root Directory:** `frontend` (the Next.js app is inside the frontend/ folder)

### 9.2 Environment Variables

In Vercel project settings → **Environment Variables**:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://apiict.zensbot.site` |

### 9.3 Deploy

Push to `main` branch → Vercel auto-deploys.

### 9.4 Custom Domain (Optional)

1. Vercel → Project Settings → Domains
2. Add `lms.ictlms.com` (or `ictlms.com`)
3. Add the DNS records Vercel provides

---

## 10. Domain & SSL

### 10.1 DNS Configuration

Set up these DNS records (using your domain registrar or Cloudflare):

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | `api` | `<EC2 Elastic IP>` | Backend API |
| CNAME | `lms` | `cname.vercel-dns.com` | Frontend (Vercel) |

### 10.2 SSL Certificate (Let's Encrypt)

```bash
# On EC2 — get SSL certificate
sudo certbot --nginx -d api.ictlms.com

# Auto-renewal is set up automatically
# Test renewal:
sudo certbot renew --dry-run
```

Certbot auto-renews every 90 days via a systemd timer.

---

## 11. CI/CD Pipeline (Blue-Green Auto-Deploy)

The workflow is defined in `.github/workflows/deploy-backend.yml` and triggers automatically on push to `main` with `backend/**` changes.

### Pipeline Flow

1. **CI Job (Validate Backend):**
   - Python 3.11 + pip cache
   - `python -m compileall -q app/ main.py` (syntax check)
   - Import validation: walks all `app.*` submodules to catch broken imports

2. **Deploy Job (Blue-Green via SSH):**
   - Requires CI to pass; only runs on push (not PRs)
   - SSHs into EC2 using `appleboy/ssh-action@v1`
   - Runs `deploy-bg.sh` which handles the full 10-step blue-green process
   - External health check: `curl https://apiict.zensbot.site/api/health`
   - Auto-rollback: if health fails 60s after switch, reverts automatically

### GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `EC2_HOST` | `13.204.107.220` (Elastic IP) |
| `EC2_USERNAME` | `ubuntu` |
| `EC2_SSH_KEY` | Private key (PEM contents) for SSH |

### GitHub Environment

The deploy job uses a `production` environment with URL `https://apiict.zensbot.site`. Configure this in GitHub repo Settings → Environments.

### How the Deploy Works

See `docs/blue-green.md` for the full 10-step architecture. Key points:
- Zero downtime: new container starts, health checks pass, nginx switches, old container drains
- Instant rollback: `./rollback.sh` switches back in ~10 seconds
- Scheduler deduplication: only one container runs APScheduler jobs (tracked via Redis)
- Deploy logs: `/var/log/lms/deploy-YYYYMMDD-HHMMSS.log`

---

## 12. Post-Deployment Checklist

### Verify Services

```bash
# Check FastAPI is running
curl https://api.ictlms.com/health
# Expected: {"status": "ok"}

# Check API docs load
open https://api.ictlms.com/docs

# Check frontend loads
open https://lms.ictlms.com

# Check WebSocket (use wscat)
npx wscat -c "wss://api.ictlms.com/ws/class-status/test?token=..."
```

### Verify Security

- [ ] HTTPS works (no mixed content warnings)
- [ ] HTTP redirects to HTTPS
- [ ] API returns 401 without token
- [ ] API returns 403 for wrong role
- [ ] Login rate limiting works (11th attempt in 1 minute should fail)
- [ ] CORS blocks requests from unauthorized origins
- [ ] S3 buckets are not publicly accessible

### Verify Data

- [ ] Admin can login with seeded credentials
- [ ] System settings are seeded (`max_device_limit`, `post_batch_grace_period_days`)
- [ ] Can create a batch, course, and lecture
- [ ] Student enrollment works
- [ ] Zoom class scheduling works (if Zoom OAuth app is configured)

### Set Up Monitoring

```bash
# On EC2 — check Docker container logs
docker logs lms-green --tail 50 -f   # or lms-blue, depending on active slot
cat backend/.active-slot              # check which container is active

# Deploy logs
ls -lt /var/log/lms/                  # list deploy logs
tail -50 /var/log/lms/deploy-*.log    # latest deploy output

# Nginx access/error logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Optional: Set up AWS CloudWatch alarm for EC2 auto-recovery (restarts instance if it becomes unreachable).

### Backup Strategy

- **Database:** RDS automated backups with point-in-time recovery (7-day retention, configurable up to 35 days). Manual snapshots available for pre-migration safety nets.
- **S3 files:** Enable versioning on all S3 buckets for accidental deletion protection
- **Code:** GitHub is the source of truth
- **Env vars:** Back up `.env` file securely (do NOT commit to git)
