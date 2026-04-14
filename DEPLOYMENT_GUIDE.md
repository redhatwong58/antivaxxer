# ANTIVAXXER — Deployment Guide

**Version:** 5.1.0
**Last Updated:** April 2026
**Audience:** DevOps engineer or full-stack developer deploying to production.

**Local dev:** [ONBOARDING.md](./ONBOARDING.md) · **All docs:** [README.md](./README.md#documentation-index-5-files)

This document covers deploying the full ANTIVAXXER stack to AWS. The architecture is designed for AWS but can be adapted to other cloud providers.

---

## Production Architecture

```
                    ┌─────────────────┐
                    │   CloudFront    │
                    │   (CDN + SSL)   │
                    └────┬───────┬────┘
                         │       │
              ┌──────────┘       └──────────┐
              ▼                              ▼
    ┌──────────────────┐          ┌──────────────────┐
    │     Vercel        │          │   S3 Bucket      │
    │  (Next.js SSR)    │          │  (Product Images) │
    └────────┬─────────┘          └──────────────────┘
             │
             ▼
    ┌──────────────────┐
    │   EC2 / ECS      │
    │  (Express API)    │──── port 4000
    └────────┬─────────┘
             │
    ┌────────┴─────────┐
    │   RDS PostgreSQL  │
    │   (Prisma ORM)    │
    └──────────────────┘
```

External services: Stripe (payments), AWS SES (email), Cloudflare Turnstile (CAPTCHA), CookiesYes (consent), Google Analytics 4, Mailchimp (marketing).

---

## Option A: Recommended Stack (Vercel + AWS)

Best for: fast deployment, auto-scaling frontend, minimal DevOps.

### 1. Database — AWS RDS PostgreSQL

Create a PostgreSQL 15 instance in RDS.

**Settings:**
- Instance: `db.t3.micro` for launch ($15/mo), upgrade to `db.t3.small` when needed
- Storage: 20 GB GP3, auto-scaling enabled
- Multi-AZ: No for launch, Yes when revenue justifies ($30/mo extra)
- Public access: No (API server connects via VPC)
- Security group: Allow port 5432 from your API server's security group only

**After creation:**
```
DATABASE_URL=postgresql://antivaxxer_user:PASSWORD@your-rds-endpoint.us-east-1.rds.amazonaws.com:5432/antivaxxer_prod
```

Run migrations from a machine that can reach the RDS instance:
```bash
DATABASE_URL=postgresql://... npx prisma migrate deploy
DATABASE_URL=postgresql://... npx prisma db seed  # optional: load demo products
```

### 2. API Server — EC2 or ECS

**Option 2a: EC2 (simplest)**

Launch an `t3.micro` or `t3.small` Ubuntu 24 instance.

```bash
# On the EC2 instance
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone or upload the project
cd /opt
unzip antivaxxer-v5.1.0-detail-page-recovery-alerts.zip
cd antivaxxer

# Install dependencies
npm install --production
cd api && npx prisma generate && cd ..

# Create .env
cp .env.example .env
nano .env  # Set all production values (see Environment Variables below)

# Test
cd api && node src/index.js
# Should see: [antivaxxer-api] Server running on port 4000

# Install PM2 for process management
sudo npm install -g pm2
cd /opt/antivaxxer/api
pm2 start src/index.js --name antivaxxer-api
pm2 save
pm2 startup  # auto-restart on reboot
```

**Security group:** Allow port 4000 from your Vercel IP range (or use a load balancer with HTTPS termination).

**Option 2b: ECS Fargate (auto-scaling)**

Create a `Dockerfile` in the `api/` directory:
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["node", "src/index.js"]
```

Push to ECR, create an ECS service with Fargate, attach an ALB. Environment variables go in the ECS task definition.

### 3. Frontend — Vercel

Vercel auto-detects Next.js and handles SSR, CDN, and SSL.

```bash
# Install Vercel CLI
npm install -g vercel

# From the frontend directory
cd antivaxxer/frontend
vercel

# Set environment variables in Vercel dashboard:
#   NEXT_PUBLIC_API_URL=https://api.antivaxxer.com/api
#   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
#   NEXT_PUBLIC_SITE_URL=https://antivaxxer.com
#   NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
#   NEXT_PUBLIC_COOKIESYES_ID=your_id
#   NEXTAUTH_URL=https://antivaxxer.com
#   NEXTAUTH_SECRET=your-generated-secret
```

**Custom domain:** Add `antivaxxer.com` in Vercel dashboard → Domains. Point your DNS `A` record to Vercel's IP.

### 4. Image Storage — S3 + CloudFront

**S3 Bucket:**
```bash
aws s3 mb s3://antivaxxer-images-prod --region us-east-1
```

Bucket policy: block all public access. CloudFront will serve via OAI.

**CloudFront Distribution:**
- Origin: your S3 bucket
- Origin Access Identity: create one and grant it `s3:GetObject` on the bucket
- Default cache: 1 year (images have content-hash filenames, immutable)
- SSL: use the default `*.cloudfront.net` cert, or attach your own for `images.antivaxxer.com`

**IAM for API server:**
The API needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the bucket. Create an IAM user or role with these permissions.

### 5. Email — AWS SES

**Setup:**
1. Verify your domain in SES (add DKIM + SPF DNS records)
2. Request production access (sandbox limits to 200 emails/day)
3. Set sender address in `.env`: `SES_FROM_EMAIL=orders@antivaxxer.com`

**DNS records (from SES console):**
- 3 CNAME records for DKIM
- 1 TXT record for SPF: `v=spf1 include:amazonses.com ~all`
- 1 MX record if receiving email

### 6. SSL / Domain

**For the API:** Use an ALB with an ACM certificate, or Nginx as a reverse proxy on EC2:

```nginx
server {
    listen 443 ssl;
    server_name api.antivaxxer.com;

    ssl_certificate /etc/letsencrypt/live/api.antivaxxer.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.antivaxxer.com/privkey.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Install with certbot: `sudo certbot --nginx -d api.antivaxxer.com`

**DNS summary:**
| Record | Type | Value |
|--------|------|-------|
| `antivaxxer.com` | A | Vercel IP |
| `www.antivaxxer.com` | CNAME | `cname.vercel-dns.com` |
| `api.antivaxxer.com` | A | EC2 Elastic IP or ALB DNS |
| `images.antivaxxer.com` | CNAME | CloudFront distribution domain |

---

## Option B: All-AWS (EC2 for everything)

If you don't want Vercel, run the Next.js frontend on EC2 alongside the API.

```bash
# Build the frontend
cd /opt/antivaxxer/frontend
npm run build

# Start with PM2
pm2 start npm --name antivaxxer-frontend -- start -- -p 3000

# Nginx serves both
# api.antivaxxer.com → localhost:4000
# antivaxxer.com → localhost:3000
```

This costs less ($5-15/mo for one EC2) but you lose Vercel's CDN, auto-scaling, and preview deployments.

---

## Option C: Railway / Render (Simplest)

For the fastest deployment with zero infrastructure management.

**Railway ($5/mo):**
1. Connect GitHub repo
2. Railway auto-detects Node.js, deploys both services
3. Add PostgreSQL plugin (one click)
4. Set environment variables in Railway dashboard
5. Custom domain in settings

**Render:**
1. Create a Web Service for the API (Node.js, build command: `npm install && cd api && npx prisma generate`)
2. Create a Static Site or Web Service for the frontend
3. Create a PostgreSQL database
4. Wire them together via environment variables

---

## Environment Variables — Production Values

Copy `.env.example` and replace every placeholder. This is the complete list with production notes.

```bash
# === REQUIRED ===
DATABASE_URL=postgresql://user:pass@your-rds-endpoint:5432/antivaxxer_prod
NEXT_PUBLIC_API_URL=https://api.antivaxxer.com/api
NODE_ENV=production
API_PORT=4000

# Stripe (LIVE keys — not sk_test_)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Auth
NEXTAUTH_URL=https://antivaxxer.com
NEXTAUTH_SECRET=  # Generate: openssl rand -base64 32

# === EMAIL ===
AWS_REGION=us-east-1
SES_FROM_EMAIL=orders@antivaxxer.com
SES_REPLY_TO_EMAIL=support@antivaxxer.com

# === IMAGES ===
S3_BUCKET_NAME=antivaxxer-images-prod
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# === INTEGRATIONS ===
NEXT_PUBLIC_SITE_URL=https://antivaxxer.com
NEXT_PUBLIC_COOKIESYES_ID=your_id
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
MAILCHIMP_API_KEY=abc123-us21
MAILCHIMP_SERVER_PREFIX=us21
MAILCHIMP_LIST_ID=abc123def

# === OPTIONAL ===
TURNSTILE_SECRET_KEY=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
ABANDONED_CART_DELAY_MS=3600000
INVENTORY_ALERT_EMAIL=ops@antivaxxer.com
INVENTORY_WARNING_THRESHOLD=15
INVENTORY_REORDER_THRESHOLD=5
```

**Do NOT set `ADMIN_TOKEN` in production.** Use NextAuth admin accounts instead. If you must use it during initial setup, remove it immediately after creating the first admin user.

---

## Stripe Configuration

### Webhook Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.antivaxxer.com/api/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

### Testing Payments

Use Stripe test cards before going live:
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 9995` — declines
- `4000 0027 6000 3184` — requires 3D Secure

### Going Live

1. Complete Stripe account activation (business details, bank account)
2. Switch from `sk_test_` to `sk_live_` keys in `.env`
3. Create a new webhook endpoint for production (test and live have separate secrets)
4. Test a real $1 purchase, then refund it

---

## Cron Jobs

Two scheduled tasks need external triggers.

### Abandoned Cart Recovery

Runs every 15 minutes. Finds carts older than 1 hour with no completed order, sends recovery email.

**EC2 crontab:**
```bash
*/15 * * * * cd /opt/antivaxxer && node -e "require('./api/src/services/abandonedCart').processAbandonedCarts().then(n => n > 0 && console.log('Processed', n, 'carts'))" >> /var/log/antivaxxer-cron.log 2>&1
```

**AWS CloudWatch Events + Lambda:**
Create a Lambda that makes an HTTP request to a protected endpoint, or runs the function directly.

### Abandoned Cart Cleanup

Runs daily. Deletes recovered or expired carts older than 7 days.

```bash
0 3 * * * cd /opt/antivaxxer && node -e "require('./api/src/services/abandonedCart').cleanupAbandonedCarts()" >> /var/log/antivaxxer-cron.log 2>&1
```

---

## Monitoring

### Application Logs

**PM2:**
```bash
pm2 logs antivaxxer-api      # real-time logs
pm2 logs antivaxxer-api --lines 100  # last 100 lines
```

**Key log patterns to monitor:**
- `[WEBHOOK]` — order processing events
- `[EMAIL]` — transactional email failures
- `[INVENTORY ALERT]` — stock threshold crossings
- `[NEWSLETTER]` — Mailchimp sync issues
- `[ERROR]` — unhandled errors (error middleware catches these)

### Health Check

```bash
curl https://api.antivaxxer.com/api/health
# Returns: { "status": "ok", "timestamp": "..." }
```

Set up an uptime monitor (UptimeRobot, Pingdom, or AWS Route 53 health check) to hit this endpoint every 60 seconds.

### Database

Monitor RDS in the AWS console: CPU, connections, storage. Set a CloudWatch alarm for CPU > 80% sustained.

---

## Backup Strategy

### Database

RDS automated backups: enable with 7-day retention. Manual snapshots before major deployments.

**Manual backup:**
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Product Images

S3 versioning: enable on the bucket. Deleted images can be recovered from version history.

### Application Code

Git is the backup. Tag every deployment: `git tag -a v5.1.0 -m "Production deploy"`

---

## Deployment Checklist

Run through this before every production deploy.

```
[ ] All tests pass locally (npm run build, node --check on all files)
[ ] Environment variables set correctly (no test keys in production)
[ ] Database migrations applied (npx prisma migrate deploy)
[ ] Stripe webhook endpoint configured and tested
[ ] SES domain verified and out of sandbox
[ ] S3 bucket permissions correct (CloudFront OAI has access)
[ ] SSL certificates valid and not expiring soon
[ ] PM2 process running and set to auto-restart
[ ] Health check endpoint responding
[ ] Uptime monitor configured
[ ] First admin user created and ADMIN_TOKEN removed
[ ] CookiesYes configured for production domain
[ ] Legal pages reviewed by attorney
[ ] Cron jobs scheduled (abandoned cart, cleanup)
```

---

## Cost Estimate (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Pro | $20 |
| EC2 | t3.small | $15 |
| RDS PostgreSQL | db.t3.micro | $15 |
| S3 + CloudFront | First 50 GB | $2-5 |
| SES | First 62K emails | $0 (free tier) |
| Stripe | 2.9% + $0.30 per transaction | Variable |
| CookiesYes | Free or $49/mo | $0-49 |
| Domain + SSL | Annual | $12/yr |

**Estimated total: $55-105/mo** before Stripe transaction fees. Scales with traffic — the first 1000 orders/month won't require any infrastructure upgrades.
