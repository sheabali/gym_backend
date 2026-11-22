# Platinum Gym Management System - Production Deployment Guide & Runbook

This guide details the complete production deployment architecture, step-by-step VPS configuration for the Express TypeScript API, Vercel deployment for the Next.js frontend, MongoDB replica set setup, and SSLCommerz payment configuration for **Platinum Gym (Banasree, Dhaka, Bangladesh)**.

---

## 1. System Architecture & Topology

```
                         [ Visitor / Member Browser ]
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v (gym.com)                                               v (api.gym.com)
+-----------------------+                                 +-----------------------+
|  Vercel Edge Network  |                                 |   Production VPS      |
|  (Next.js App Router) |                                 |   (Ubuntu 22.04 LTS)  |
|                       |                                 |                       |
| - Landing & Marketing |                                 | - Nginx (SSL/TLS,     |
| - Member Portal       |                                 |   HSTS, Rate Limit)   |
| - Trainer Portal      |                                 | - PM2 Cluster         |
| - Admin Dashboard     |                                 |   (Node.js/Express)   |
| - Redux Toolkit Query |                                 | - node-cron Jobs      |
+-----------+-----------+                                 +-----------+-----------+
            |                                                         |
            |   HTTP/JSON API requests (Authorization: Bearer <jwt>)  |
            +-------------------------------------------------------->+
            |   Shared Parent Domain Cookies (Domain=.gym.com)        |
            |<--------------------------------------------------------+
                                                                      |
                                +-------------------------------------+-------------------------------------+
                                |                                                                           |
                                v                                                                           v
                   +--------------------------+                                                +--------------------------+
                   |  MongoDB Replica Set     |                                                |  SSLCommerz Gateway      |
                   |  (Atlas or Local 'rs0')  |                                                |  (Order Validation API)  |
                   |                          |                                                |                          |
                   | - Atomic Transactions    |                                                | - Server-to-Server IPN   |
                   | - Snapshot Entitlements  |                                                | - Paisa (1 BDT = 100p)   |
                   +--------------------------+                                                +--------------------------+
```

---

## 2. DNS & Domain Configuration

Set up the following DNS records with your registrar (e.g., Cloudflare, Namecheap, Route 53):

| Type  | Name           | Target / Value                  | TTL       | Purpose                                    |
| :---- | :------------- | :------------------------------ | :-------- | :----------------------------------------- |
| `A`   | `@` (or `www`) | `76.76.21.21` (or Vercel CNAME) | Automatic | Next.js Frontend (`https://gym.com`)       |
| `A`   | `api`          | `<YOUR_VPS_PUBLIC_IP>`          | 300       | Express API Backend (`https://api.gym.com`)|

> [!IMPORTANT]
> Both services must share the same parent domain (e.g. `gym.com` and `api.gym.com`) so that browser security policies permit secure `httpOnly` refresh token cookies via `Domain=.gym.com`.

---

## 3. VPS Backend Deployment (Ubuntu 22.04 LTS)

### Step 3.1: Server Hardening & Base Packages

```bash
# 1. Update OS packages
sudo apt update && sudo apt upgrade -y

# 2. Install essential build tools, git, and curl
sudo apt install -y curl git ufw fail2ban certbot python3-certbot-nginx build-essential

# 3. Configure UFW Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Certbot & redirect)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
```

### Step 3.2: Install Node.js 22 LTS & PM2

```bash
# 1. Install Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Verify Node and npm versions
node -v # v22.x.x
npm -v  # 10.x.x

# 3. Install PM2 and logrotate extension globally
sudo npm install -g pm2
sudo pm2 install pm2-logrotate
sudo pm2 set pm2-logrotate:max_size 20M
sudo pm2 set pm2-logrotate:retain 14
```

### Step 3.3: MongoDB Replica Set Requirement

Prisma transactions **strictly require MongoDB to run as a replica set**. You have two options:

- **Option A (Recommended for High Availability): MongoDB Atlas**
  - Provision an M10+ cluster on MongoDB Atlas (hosted in AWS `ap-southeast-1` Singapore or `ap-south-1` Mumbai for lowest latency to Dhaka).
  - Copy the replica set connection URI:
    ```bash
    DATABASE_URL="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/platinum_gym_prod?retryWrites=true&w=majority"
    ```

- **Option B: Self-Hosted MongoDB 7.0 on VPS**
  ```bash
  # 1. Install MongoDB 7.0
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  sudo apt update && sudo apt install -y mongodb-org

  # 2. Configure MongoDB for Replica Set
  # In /etc/mongod.conf under 'replication:', add:
  # replication:
  #   replSetName: "rs0"
  sudo systemctl restart mongod && sudo systemctl enable mongod

  # 3. Initialize Replica Set
  mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
  ```

### Step 3.4: Deploy Backend Application

```bash
# 1. Clone repository to /var/www/platinum_gym_backend
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <YOUR_GIT_REPO_URL> gym_project
cd gym_project/platinum_gym_backend

# 2. Install production dependencies
npm ci

# 3. Configure production environment
cp .env.example .env
nano .env
```

**Production `.env` Configuration:**
```ini
NODE_ENV=production
PORT=8000
DATABASE_URL="mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/platinum_gym_prod?retryWrites=true&w=majority"
CORS_ORIGIN=https://gym.com
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

JWT_SECRET="<GENERATE_SECURE_RANDOM_SECRET_MIN_32_CHARS>"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_DAYS=30
COOKIE_DOMAIN=".gym.com"
COOKIE_SAME_SITE="lax"

BACKEND_URL="https://api.gym.com"
FRONTEND_URL="https://gym.com"

# SSLCommerz Production Credentials
SSLCOMMERZ_STORE_ID="<YOUR_LIVE_STORE_ID>"
SSLCOMMERZ_STORE_PASS="<YOUR_LIVE_STORE_PASS>"
SSLCOMMERZ_IS_SANDBOX=false
SSLCOMMERZ_GATEWAY_MODE=live
```

### Step 3.5: Database Migration, Seeding & Build

```bash
# 1. Generate Prisma Client
npm run prisma:generate

# 2. Push schema to MongoDB
npm run prisma:push

# 3. Seed Master Administrator, Initial Trainers & Plans
npm run prisma:seed

# 4. Compile TypeScript to production dist/
npm run build
```

### Step 3.6: Start PM2 Cluster & Configure Autostart

```bash
# 1. Start cluster via ecosystem file
npm run start:pm2

# 2. Save PM2 state and configure systemd autostart on reboot
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER
```

### Step 3.7: Configure Nginx & SSL/TLS

```bash
# 1. Copy Nginx site configuration
sudo cp deploy/nginx/api.gym.com.conf /etc/nginx/sites-available/api.gym.com.conf
sudo ln -s /etc/nginx/sites-available/api.gym.com.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 2. Test configuration and obtain Let's Encrypt certificate
sudo nginx -t
sudo certbot --nginx -d api.gym.com --agree-tos --email webmaster@gym.com --no-eff-email

# 3. Reload Nginx
sudo systemctl reload nginx
```

---

## 4. Alternative: Docker & Docker Compose Deployment

If deploying to a containerized VPS or staging environment:

```bash
cd platinum_gym_backend

# 1. Configure production environment
cp .env.example .env

# 2. Build and launch MongoDB (replica set) + API container
docker compose up -d --build

# 3. Verify health
docker compose ps
curl http://localhost:8000/api/v1/health
```

---

## 5. Vercel Frontend Deployment

### Step 5.1: Deploy via Vercel Dashboard

1. Import `platinum_gym_fronend` repository into [Vercel](https://vercel.com).
2. Set Framework Preset: **Next.js**.
3. Build Command: `npm run build`.
4. Add Environment Variables in Vercel Project Settings:
   - `NEXT_PUBLIC_BASE_URL`: `https://api.gym.com/api/v1`
   - `NODE_ENV`: `production`

### Step 5.2: Add Custom Domain in Vercel

1. In Vercel Project Settings > **Domains**, add `gym.com` and `www.gym.com`.
2. Vercel will automatically provision SSL certificates.

---

## 6. SSLCommerz Production Cutover Checklist

Before switching `SSLCOMMERZ_GATEWAY_MODE=live`:

1. [ ] Confirm merchant account approval with SSLCommerz Bangladesh.
2. [ ] Retrieve the production `STORE_ID` and `STORE_PASS` from your merchant portal.
3. [ ] Register IPN webhook URL: `https://api.gym.com/api/v1/payments/sslcommerz/ipn`.
4. [ ] In `platinum_gym_backend/.env`, set:
   - `SSLCOMMERZ_IS_SANDBOX=false`
   - `SSLCOMMERZ_GATEWAY_MODE=live`
5. [ ] Execute a live test transaction of BDT 10.00 to verify end-to-end checkout, card/bKash debit, and auto-activation.

---

## 7. Zero-Downtime Rolling Update Runbook

When deploying updates to the backend:

```bash
cd /var/www/gym_project/platinum_gym_backend

# 1. Pull latest verified changes
git pull origin main

# 2. Install any updated dependencies
npm ci

# 3. Apply schema updates (if any)
npm run prisma:generate
npm run prisma:push

# 4. Rebuild production bundle
npm run build

# 5. Reload PM2 cluster with zero dropped connections
npm run reload:pm2
```

---

## 8. Backup & Maintenance Procedures

### Daily Automated MongoDB Backup Script
Place in `/usr/local/bin/backup-platinum-gym.sh`:

```bash
#!/usr/bin/env bash
set -e
BACKUP_DIR="/var/backups/platinum_gym"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

mongodump --uri="mongodb://127.0.0.1:27017/platinum_gym?replicaSet=rs0" --gzip --archive="$BACKUP_DIR/gym_backup_$DATE.gz"

# Retain backups for 30 days
find "$BACKUP_DIR" -type f -name "gym_backup_*.gz" -mtime +30 -delete
```

Add to cron (`sudo crontab -e`):
```cron
0 3 * * * /usr/local/bin/backup-platinum-gym.sh > /dev/null 2>&1
```

---

## 9. Verification & Health Monitoring

Verify the live deployment using these endpoints:

- **System Health:** `curl -sS https://api.gym.com/api/v1/health | jq`
- **Swagger Documentation:** `https://api.gym.com/api-docs`
- **Active Plans:** `curl -sS https://api.gym.com/api/v1/plans | jq`
