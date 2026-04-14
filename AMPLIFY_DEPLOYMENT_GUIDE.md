# ANTIVAXXER — AWS Amplify Deployment Guide

**Version:** 5.2.1
**Last Updated:** April 2026
**Audience:** DevOps engineer or developer deploying to AWS for the first time.

**Local dev:** [ONBOARDING.md](./ONBOARDING.md) · **Doc index:** [README.md](./README.md#documentation-index-5-files) · **Vercel-style alternative:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

This guide deploys ANTIVAXXER with Amplify (frontend) + App Runner (API) and related AWS services. Follow phases in order.

---

## AWS Services Used

| Service | Purpose | Estimated Monthly Cost |
|---------|---------|----------------------|
| **Amplify Hosting** | Next.js frontend, GitHub auto-deploy, SSL, CDN | $0-15 |
| **App Runner** | Express API, GitHub auto-deploy, SSL, scaling | $25-45 |
| **RDS PostgreSQL** | Primary database (db.t4g.micro) | $13 |
| **S3** | Product image storage | $1-3 |
| **CloudFront** | CDN in front of S3 | $1-2 |
| **SES** | Transactional email | $0 (free tier) |
| **Secrets Manager** | Encrypted env vars (~8 secrets) | $3 |
| **Parameter Store** | Non-sensitive config | $0 |
| **EventBridge + Lambda** | Cron jobs | $0 (free tier) |
| **IAM** | Roles and permissions | $0 |
| **Certificate Manager** | SSL certificates (auto-managed) | $0 |
| **CloudWatch Logs** | Log aggregation | $0-2 |
| **CloudWatch Alarms** | Monitoring alerts | $0 |
| **Route 53** | DNS (optional, can use external registrar) | $0.50 + queries |
| **EC2** (temporary) | Bastion for migrations | <$1 if terminated quickly |
| **Total** | | **$45-85/mo** |

Plus Stripe transaction fees (paid to Stripe, not AWS).

---

## Prerequisites

Complete these before starting Phase 1. They have no dependencies and can be done in any order.

- **AWS account** — sign up at aws.amazon.com. Enable MFA on the root user immediately.
- **GitHub repository** — push the codebase to a private GitHub repo.
- **Domain name** — registered with any registrar (Route 53, Namecheap, GoDaddy, etc.).
- **Stripe account** — sign up at stripe.com. Test mode is fine for first deploy.
- **Local AWS CLI** (optional but recommended) — `brew install awscli` or equivalent.

---

## Phase 1 — AWS Account Foundation

**Estimated time: 15 minutes**

### 1.1 Create billing alarm

1. AWS Console → Billing → Budgets → Create budget
2. Budget type: Cost budget
3. Period: Monthly
4. Budgeted amount: $100 (your safety net)
5. Alert: 80% of budget → email yourself
6. Create

### 1.2 Create admin IAM user

Never use the root account for daily work.

1. AWS Console → IAM → Users → Create user
2. Username: `antivaxxer-admin`
3. Console access: enabled
4. Permissions: Attach `AdministratorAccess` policy directly
5. Create user
6. Save the password and sign-in URL
7. Sign out, sign in as the new user, enable MFA on this user too

### 1.3 Pick your region

Pick `us-east-1` (N. Virginia) unless you have a strong reason otherwise. It has the most services and is the default for most AWS examples. **Every resource you create from this point must be in the same region.**

---

## Phase 2 — Networking Foundation

**Estimated time: 15 minutes**

### 2.1 Use the default VPC

Your AWS account comes with a default VPC. It has public subnets in multiple availability zones and an internet gateway. For this deployment, the default VPC is fine.

1. AWS Console → VPC → Your VPCs
2. Note the VPC ID of the one marked "default" (looks like `vpc-0123abc`)
3. Note the subnet IDs in VPC → Subnets (you'll have 2-6 depending on region)

### 2.2 Create three security groups

1. VPC → Security Groups → Create security group

**Group 1: RDS access**
- Name: `antivaxxer-rds-sg`
- Description: Allow PostgreSQL from App Runner
- VPC: default
- Inbound rules: leave empty for now (we'll add the App Runner rule after creating that SG)
- Create

**Group 2: App Runner egress**
- Name: `antivaxxer-apprunner-sg`
- Description: App Runner outbound for RDS, Stripe, SES
- VPC: default
- Inbound rules: empty (App Runner doesn't accept inbound directly)
- Outbound rules: All traffic (0.0.0.0/0) — default
- Create

**Group 3: Bastion for migrations** (optional, for Phase 6)
- Name: `antivaxxer-bastion-sg`
- Description: SSH access for migration runner
- Inbound: SSH (port 22) from "My IP"
- Create

### 2.3 Wire RDS security group

Now go back to `antivaxxer-rds-sg` and add inbound rules:
- Type: PostgreSQL (port 5432)
- Source: `antivaxxer-apprunner-sg` (select from dropdown)
- Add another rule:
- Type: PostgreSQL (port 5432)
- Source: `antivaxxer-bastion-sg`
- Save rules

---

## Phase 3 — Data Layer

**Estimated time: 30 minutes (most is RDS provisioning wait)**

### 3.1 Create RDS PostgreSQL instance

1. AWS Console → RDS → Create database
2. **Engine:** PostgreSQL
3. **Version:** PostgreSQL 15.x (latest 15 patch)
4. **Template:** Free tier (or Production for Multi-AZ)
5. **DB instance identifier:** `antivaxxer-prod`
6. **Master username:** `antivaxxer_admin`
7. **Master password:** click "Auto generate password" — save it when shown (it's only shown once)
8. **Instance class:** db.t4g.micro (Free tier eligible)
9. **Storage:**
   - Type: GP3
   - Allocated: 20 GiB
   - Storage autoscaling: enabled, max 100 GiB
10. **Connectivity:**
    - VPC: default
    - DB subnet group: default
    - Public access: **No**
    - VPC security group: select existing → `antivaxxer-rds-sg`
    - Availability zone: no preference
    - RDS proxy: not now
11. **Database authentication:** Password authentication
12. **Additional configuration:**
    - Initial database name: `antivaxxer_prod`
    - Backup retention: 7 days
    - Encryption: enabled (default)
    - Performance Insights: enabled (free for 7 days retention)
    - Auto minor version upgrade: enabled
13. Create database
14. Wait for status "Available" (~10 minutes)
15. **Save the endpoint URL** — Connectivity & security tab → Endpoint (looks like `antivaxxer-prod.cxyz.us-east-1.rds.amazonaws.com`)

### 3.2 Create S3 bucket

1. AWS Console → S3 → Create bucket
2. **Bucket name:** `antivaxxer-images-prod` (must be globally unique — append a suffix if taken)
3. **Region:** same as RDS
4. **Object Ownership:** ACLs disabled (recommended)
5. **Block Public Access:** Block all public access — **enabled** (CloudFront serves via OAC)
6. **Versioning:** Enable (cheap insurance against accidental deletion)
7. **Encryption:** SSE-S3 (default)
8. Create bucket
9. **Save the bucket name** (you'll need it for env vars)

### 3.3 Create CloudFront distribution

1. AWS Console → CloudFront → Create distribution
2. **Origin:**
   - Origin domain: select your S3 bucket from the dropdown
   - Origin access: **Origin access control settings (recommended)**
   - Click "Create new OAC", accept defaults, create
   - When prompted: copy the bucket policy CloudFront generates
3. **Default cache behavior:**
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Cache policy: CachingOptimized
4. **Settings:**
   - Price class: Use only North America and Europe (cheapest)
   - Default root object: leave blank
5. Create distribution
6. **Update S3 bucket policy:**
   - Go to S3 → your bucket → Permissions → Bucket policy
   - Paste the policy CloudFront generated
   - Save
7. Wait for distribution status "Deployed" (~5-10 minutes)
8. **Save the distribution domain name** (looks like `d1abc234.cloudfront.net`)

---

## Phase 4 — Email (SES)

**Estimated time: 15 minutes + DNS propagation wait**

Start this early — verification takes time.

### 4.1 Verify your domain in SES

1. AWS Console → SES → Verified identities → Create identity
2. Identity type: Domain
3. Domain: `antivaxxer.com`
4. Easy DKIM: enabled
5. Use a custom MAIL FROM domain: optional (recommended for deliverability)
6. Create
7. SES gives you DNS records to add — typically 3 CNAME records for DKIM
8. Add these CNAME records at your domain registrar (or Route 53 if you're using it)
9. SES will mark the domain as Verified once DNS propagates (15 min - 24 hr, usually under 1 hr)

### 4.2 Verify a sender email address

While waiting for the domain, also verify a specific email address:
1. SES → Verified identities → Create identity
2. Identity type: Email address
3. Email: `orders@antivaxxer.com`
4. Create
5. Check that inbox for a verification email, click the link

### 4.3 Request production access

By default SES is in sandbox mode (200 emails/day, only to verified addresses). For production:
1. SES → Account dashboard → Request production access
2. Mail type: Transactional
3. Website URL: https://antivaxxer.com
4. Use case description:
   ```
   Order confirmations, shipping notifications, password resets,
   abandoned cart recovery, and inventory alerts for an ecommerce
   storefront. All recipients are customers who have made a purchase
   or signed up for an account. Unsubscribe links included where
   applicable. Bounce and complaint rates monitored.
   ```
5. Submit
6. Approval typically 24-48 hours

You can continue with the rest of this guide while waiting. Sandbox mode works for testing.

---

## Phase 5 — Secrets and IAM

**Estimated time: 25 minutes**

### 5.1 Generate the secrets you control

Run these locally and save the outputs temporarily:

```bash
# NextAuth signing secret (for JWT signing)
openssl rand -base64 32

# Cron token (for Lambda → API authentication)
openssl rand -base64 32
```

Get these from external services:
- **Stripe secret key**: Stripe Dashboard → Developers → API keys → Secret key (use test mode `sk_test_*` for first deploy)
- **Stripe webhook secret**: Will create in Phase 8 — leave blank for now
- **Mailchimp API key** (optional): Mailchimp → Account → Extras → API keys

### 5.2 Create secrets in Secrets Manager

For each secret below, repeat this flow:
1. AWS Console → Secrets Manager → Store a new secret
2. Secret type: Other type of secret
3. Plaintext (single value):
4. Secret name: as listed below
5. Description: brief
6. Encryption key: aws/secretsmanager (default)
7. Rotation: not now
8. Store
9. **Click into the secret and copy the ARN** — save in a notes doc

**Required secrets:**

| Secret name | Value |
|-------------|-------|
| `antivaxxer/prod/database-url` | `postgresql://antivaxxer_admin:RDS_PASSWORD@RDS_ENDPOINT:5432/antivaxxer_prod` |
| `antivaxxer/prod/nextauth-secret` | from `openssl rand -base64 32` above |
| `antivaxxer/prod/cron-token` | from `openssl rand -base64 32` above |
| `antivaxxer/prod/stripe-secret-key` | `sk_test_...` from Stripe |
| `antivaxxer/prod/stripe-webhook-secret` | placeholder `whsec_pending` (update in Phase 8) |
| `antivaxxer/prod/ses-from-email` | `orders@antivaxxer.com` |
| `antivaxxer/prod/s3-bucket-name` | `antivaxxer-images-prod` (your bucket name) |
| `antivaxxer/prod/cloudfront-domain` | `d1abc234.cloudfront.net` (your distribution) |
| `antivaxxer/prod/inventory-alert-email` | `ops@antivaxxer.com` |

**Optional secrets (skip if not used):**
- `antivaxxer/prod/mailchimp-api-key`
- `antivaxxer/prod/turnstile-secret-key`

### 5.3 Create IAM role for App Runner

1. AWS Console → IAM → Roles → Create role
2. Trusted entity type: AWS service
3. Use case: App Runner — search for "App Runner", select "App Runner — Tasks"
4. Next
5. Permissions policies (attach all four):
   - `AmazonS3FullAccess` (or scope to just your bucket — see custom policy below)
   - `AmazonSESFullAccess`
   - Click "Create policy" for the secrets policy:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Action": "secretsmanager:GetSecretValue",
         "Resource": [
           "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:antivaxxer/prod/*"
         ]
       }]
     }
     ```
   - Save as `AntivaxxerSecretsAccess`
6. Role name: `AntivaxxerAppRunnerRole`
7. Create role
8. **Save the role ARN**

**Tighter S3 policy (recommended after first deploy works):**
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::antivaxxer-images-prod/*"
  }]
}
```

### 5.4 Create IAM role for Lambda (cron)

1. IAM → Roles → Create role
2. Trusted entity: AWS service → Lambda
3. Permissions: `AWSLambdaBasicExecutionRole` (CloudWatch logs)
4. Add another policy: `AntivaxxerSecretsAccess` (created above, lets Lambda read CRON_TOKEN)
5. Role name: `AntivaxxerCronLambdaRole`
6. Create
7. **Save the role ARN**

---

## Phase 6 — Run Initial Database Migration

**Estimated time: 20 minutes**

The database is empty. Migrations need to run before the API can deploy.

### 6.1 Launch a temporary bastion EC2

1. AWS Console → EC2 → Launch instances
2. Name: `antivaxxer-bastion`
3. AMI: Amazon Linux 2023 (free tier eligible)
4. Instance type: t2.micro
5. Key pair: create new key pair, download the .pem file, save it securely
6. Network settings:
   - VPC: default (same as RDS)
   - Subnet: any public subnet
   - Auto-assign public IP: enabled
   - Security group: existing → `antivaxxer-bastion-sg`
7. Storage: 8 GiB gp3 (default)
8. Launch instance
9. **Save the public IP address**

### 6.2 SSH in and run migrations

```bash
# From your local machine
chmod 400 antivaxxer-bastion-key.pem
ssh -i antivaxxer-bastion-key.pem ec2-user@BASTION_PUBLIC_IP

# On the bastion
sudo dnf install -y nodejs git
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO/api
npm install
export DATABASE_URL="postgresql://antivaxxer_admin:RDS_PASSWORD@RDS_ENDPOINT:5432/antivaxxer_prod"
npx prisma migrate deploy

# Optional: load demo products (16 products, 114 SKUs)
npx prisma db seed

# Verify
psql $DATABASE_URL -c "\dt"  # should list 15 tables
psql $DATABASE_URL -c "SELECT COUNT(*) FROM products;"  # 16 if seeded
```

### 6.3 Decide: keep or terminate the bastion

**Keep it** if you want easy ad-hoc database access during development. Stop it when not in use (free) but you'll pay for storage.

**Terminate it** if you only needed it for migrations. Future migrations will run automatically as part of every App Runner deploy via the build phase.

To terminate: EC2 → select instance → Instance state → Terminate.

---

## Phase 7 — Deploy the API (App Runner)

**Estimated time: 25 minutes**

### 7.1 Push your code to GitHub

If you haven't already:
```bash
cd /path/to/antivaxxer
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/antivaxxer.git
git push -u origin main
```

### 7.2 Create App Runner service

1. AWS Console → App Runner → Create service
2. **Source type:** Source code repository
3. **Provider:** GitHub
4. Click "Add new" to authorize AWS Connector for GitHub (one-time OAuth)
5. Repository: select your repo
6. Branch: main
7. Source directory: `api` (the monorepo path)
8. Deployment trigger: Automatic
9. Next

### 7.3 Configure build

1. Configuration source: Use a configuration file
2. Configuration file: `apprunner.yaml` (lives at repo root, App Runner finds it automatically)
3. Next

### 7.4 Configure service

1. Service name: `antivaxxer-api`
2. Virtual CPU: 1 vCPU
3. Virtual memory: 2 GB
4. Environment variables: leave blank (apprunner.yaml handles them)
5. Port: 4000
6. Health check:
   - Protocol: HTTP
   - Path: `/api/health`
   - Interval: 10 seconds
   - Timeout: 5 seconds
   - Healthy threshold: 1
   - Unhealthy threshold: 3
7. **Security:**
   - Instance role: select `AntivaxxerAppRunnerRole`
8. **Networking:**
   - Outgoing network traffic: Custom VPC
   - VPC connector: Create new
     - Name: `antivaxxer-vpc-connector`
     - VPC: default
     - Subnets: select all subnets in the VPC
     - Security groups: `antivaxxer-apprunner-sg`
9. **Observability:**
   - X-Ray tracing: not now (optional for later)
10. Next, review, Create & deploy

### 7.5 Update apprunner.yaml with real ARNs

Before App Runner can succeed, edit `apprunner.yaml` and replace `ACCOUNT_ID` placeholders with your real AWS account ID. Find your account ID in the top-right corner of the AWS Console.

```bash
# In your local repo
sed -i 's/ACCOUNT_ID/123456789012/g' apprunner.yaml  # use your real ID
git add apprunner.yaml
git commit -m "Set Secrets Manager ARNs"
git push
```

App Runner will auto-redeploy with the corrected config. First successful deploy takes 5-10 minutes total.

### 7.6 Verify the API is up

App Runner gives you a URL like `https://abc123.us-east-1.awsapprunner.com`. Test it:

```bash
curl https://YOUR_APPRUNNER_URL/api/health
# Expected: {"status":"ok","timestamp":"...","database":"connected"}
```

If you see `database: disconnected`, the App Runner VPC connector isn't reaching RDS. Check that the App Runner security group is in the RDS security group's allowed inbound list.

**Save the App Runner service URL.**

---

## Phase 8 — Stripe Webhook

**Estimated time: 5 minutes**

The webhook URL only exists after App Runner deploys, so this comes after Phase 7.

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://YOUR_APPRUNNER_URL/api/webhooks/stripe`
3. Events to send:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Add endpoint
5. Click into the endpoint → Reveal signing secret → copy it (starts with `whsec_`)
6. AWS Console → Secrets Manager → `antivaxxer/prod/stripe-webhook-secret` → Retrieve secret value → Edit
7. Replace `whsec_pending` with the real value
8. Save
9. App Runner detects the secret change and auto-redeploys (or trigger manual redeploy)

---

## Phase 9 — Deploy the Frontend (Amplify)

**Estimated time: 20 minutes**

### 9.1 Create Amplify app

1. AWS Console → Amplify → New app → Host web app
2. Source: GitHub
3. Authorize AWS Amplify (one-time OAuth)
4. Repository: same as App Runner
5. Branch: main
6. **Monorepo:** check the box "Connecting a monorepo? Pick a folder."
7. Monorepo root: `frontend`
8. Next

### 9.2 Build settings

1. App name: `antivaxxer-frontend`
2. Build settings: Amplify auto-detects from `amplify.yml` at repo root
3. Service role: let Amplify create one (or use an existing one)

### 9.3 Environment variables

Click "Advanced settings" and add these:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR_APPRUNNER_URL/api` |
| `NEXT_PUBLIC_SITE_URL` | `https://antivaxxer.com` (use Amplify URL until custom domain is set) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` from Stripe |
| `NEXTAUTH_URL` | same as NEXT_PUBLIC_SITE_URL |
| `NEXTAUTH_SECRET` | same value as in Secrets Manager (Amplify doesn't pull from Secrets Manager directly — paste the value here) |
| `NEXT_PUBLIC_GA4_ID` | optional, your GA4 measurement ID |
| `NEXT_PUBLIC_COOKIESYES_ID` | optional, your CookiesYes ID |

**Note:** Amplify environment variables are stored encrypted at rest but visible in the console. For maximum security, use the AWS Systems Manager Parameter Store integration via build commands instead. Document this in your runbook for after first deploy works.

4. Next, review, Save and deploy
5. Wait for the first build (~5-10 minutes)
6. **Save the Amplify URL** (something like `https://main.d1234.amplifyapp.com`)

### 9.4 Verify the frontend is up

Open the Amplify URL in a browser. You should see:
- The hero section with the ANTIVAXXER text logo
- Product grid with "AV" placeholders (no images uploaded yet)
- Working navigation
- The promo popup after 2 seconds

If products don't load, check the browser console for CORS or network errors. Most likely the `NEXT_PUBLIC_API_URL` is wrong or App Runner isn't reachable.

---

## Phase 10 — Custom Domain

**Estimated time: 15 minutes + DNS propagation**

### 10.1 Add custom domain to Amplify

1. Amplify Console → your app → Hosting → Custom domains → Add domain
2. Domain: `antivaxxer.com`
3. Configure subdomains:
   - `antivaxxer.com` → main branch
   - `www.antivaxxer.com` → main branch
4. Save
5. Amplify gives you DNS records to add (CNAME for SSL verification + A/CNAME for the domain)
6. Add these records at your domain registrar
7. Wait for SSL provisioning (15 min - few hours)

### 10.2 Add API subdomain to App Runner

1. App Runner Console → your service → Custom domains → Link domain
2. Domain: `api.antivaxxer.com`
3. App Runner gives you DNS records (CNAME for verification + CNAME for the subdomain)
4. Add at your registrar
5. Wait for SSL provisioning
6. **Update Amplify env var** `NEXT_PUBLIC_API_URL=https://api.antivaxxer.com/api`
7. Trigger a new Amplify build (push a commit, or click "Redeploy this version")
8. **Update Stripe webhook URL** to `https://api.antivaxxer.com/api/webhooks/stripe`

---

## Phase 11 — Cron Jobs (EventBridge + Lambda)

**Estimated time: 20 minutes**

### 11.1 Create the abandoned cart Lambda

1. AWS Console → Lambda → Create function
2. Author from scratch
3. Function name: `antivaxxer-abandoned-cart-cron`
4. Runtime: Node.js 20.x
5. Architecture: x86_64
6. Permissions: Use existing role → `AntivaxxerCronLambdaRole`
7. Create function

8. **Code:** Replace the index.mjs contents with:
   ```javascript
   export const handler = async () => {
     const url = `${process.env.API_URL}/api/admin/cron/abandoned-carts`;
     const response = await fetch(url, {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${process.env.CRON_TOKEN}` },
     });
     const result = await response.json();
     console.log('Cron result:', result);
     if (!response.ok) throw new Error(`Cron failed: ${response.status}`);
     return result;
   };
   ```
9. Deploy

10. **Configuration → Environment variables:**
    - `API_URL` = `https://api.antivaxxer.com`
    - `CRON_TOKEN` = same value as `antivaxxer/prod/cron-token` in Secrets Manager
    - For better security: use Lambda's Secrets Manager integration to read CRON_TOKEN at runtime instead of as a plain env var

11. **Test:** Configuration → Test → Create new test event → empty `{}` → Test
    - Should see "Cron result: { success: true, processed: 0, ... }" in the execution log

### 11.2 Create the cleanup Lambda

Repeat 11.1 with:
- Function name: `antivaxxer-cleanup-cron`
- Same code, but URL: `${process.env.API_URL}/api/admin/cron/cleanup`

### 11.3 Schedule with EventBridge

1. AWS Console → EventBridge → Rules → Create rule
2. Name: `antivaxxer-abandoned-cart-schedule`
3. Event bus: default
4. Rule type: Schedule
5. Continue in EventBridge Scheduler
6. Schedule pattern: Recurring schedule
7. Schedule type: Rate-based
8. Rate expression: `rate(15 minutes)`
9. Flexible time window: Off
10. Next
11. Target: AWS Lambda → Invoke → Lambda function → `antivaxxer-abandoned-cart-cron`
12. Next, defaults, create

Repeat for cleanup:
- Name: `antivaxxer-cleanup-schedule`
- Schedule: `rate(1 day)` or `cron(0 3 * * ? *)` for 3 AM UTC daily
- Target: `antivaxxer-cleanup-cron`

---

## Phase 12 — First Admin User and Smoke Test

**Estimated time: 10 minutes**

### 12.1 Create your admin account

1. Visit `https://antivaxxer.com/account/register`
2. Create an account with your real email
3. SSH into the bastion (or recreate one if you terminated it):
   ```bash
   psql $DATABASE_URL -c "UPDATE users SET role = 'admin' WHERE email = 'YOUR_EMAIL';"
   ```
4. Log out and log back in to refresh your session
5. Visit `/admin` — you should see the admin dashboard

### 12.2 Smoke test the full purchase flow

1. Browse products at `/`
2. Click a product → detail page loads
3. Add to cart → cart drawer opens
4. Click checkout
5. Enter address (use real address for tax/shipping calculations)
6. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
7. Complete payment
8. Verify:
   - Order confirmation page loads
   - Confirmation email arrives in your inbox
   - `/account/orders` shows the order
   - `/admin/orders` shows the order from admin side
   - Stripe Dashboard shows the test payment

### 12.3 Set up CloudWatch alarms

1. CloudWatch → Alarms → Create alarm
2. Create these alarms:

| Alarm | Metric | Threshold |
|-------|--------|-----------|
| App Runner high CPU | App Runner / CPUUtilization | > 80% for 10 min |
| App Runner errors | App Runner / 5xxStatusResponses | > 5 in 5 min |
| RDS high CPU | RDS / CPUUtilization | > 80% for 10 min |
| RDS storage low | RDS / FreeStorageSpace | < 4 GB |
| Lambda failures | Lambda / Errors | > 0 in 5 min |

For each alarm: action → Send notification to SNS topic → create new topic → add your email.

---

## Post-Deploy Tasks

These don't need to happen immediately but should be done within the first week.

- **Remove `ADMIN_TOKEN` from Secrets Manager** if you set it (the codebase has a fallback path that's not needed once a real admin user exists)
- **Switch Stripe to live mode** when ready to take real payments — update `stripe-secret-key` in Secrets Manager and re-register the webhook with the live signing secret
- **Configure CookiesYes** for your production domain
- **Have legal pages reviewed** by an attorney
- **Upload real product images** through `/admin`
- **Replace text logo** by uploading `logo.png` and `logo-nav.png` to your S3 bucket and serving via CloudFront, then update the logo paths in `HeroSection.js` and `Header.js`

---

## Rollback Procedures

### Rolling back the frontend

Amplify keeps deployment history. Console → your app → Hosting → main branch → click any previous deploy → "Redeploy this version".

### Rolling back the API

App Runner keeps deployment history. Console → your service → Activity → click any previous deployment → "Redeploy".

### Rolling back a database migration

Prisma migrations are forward-only. If a migration causes issues:

1. **Immediate:** rollback the API to the previous version (it has the previous schema in mind, but new columns will be ignored)
2. **Fix forward:** write a new migration that reverses the change, push it, deploy
3. **Nuclear option:** restore RDS from a snapshot
   - RDS → Snapshots → select the most recent automated snapshot → Restore snapshot
   - Creates a new RDS instance from the snapshot
   - Update `database-url` in Secrets Manager to point at the new instance
   - App Runner auto-redeploys with the new endpoint
   - Delete the broken old instance

### Full deployment rollback

If everything is broken and you need to start over:
1. Roll back the API in App Runner to the last known good version
2. Roll back the frontend in Amplify to the last known good version
3. If migrations are the issue, restore the database from snapshot (above)

---

## Cost Optimization

After the first month of running, review:

1. **App Runner concurrency settings.** Default is 100 concurrent requests per instance. If you're not getting that traffic, lower the max instances to 1.
2. **RDS instance size.** db.t4g.micro handles surprising loads. Don't upgrade until CloudWatch shows sustained CPU > 70%.
3. **CloudFront price class.** Already set to NA + EU only — saves vs. global.
4. **Secrets Manager.** Move non-sensitive values to Parameter Store (free).
5. **Bastion EC2.** If you kept it running, stop it when not in use.

---

## Ongoing Operations

### Deploying changes

```bash
git add .
git commit -m "Your change"
git push origin main
```

That's it. Amplify rebuilds the frontend, App Runner rebuilds the API. Database migrations run automatically as part of the API build.

### Viewing logs

- **Frontend build logs:** Amplify Console → your app → main branch → click latest deploy → "Build" tab
- **Frontend runtime logs:** Amplify uses CloudFront — there are no app-level runtime logs in the traditional sense, just request logs in CloudFront access logs (if enabled)
- **API build logs:** App Runner Console → your service → Logs → Application logs (build phase)
- **API runtime logs:** App Runner Console → your service → Logs → Application logs (runtime)
- **Lambda logs:** Lambda → your function → Monitor → View CloudWatch logs
- **Database logs:** RDS → your instance → Logs & events

### Rotating secrets

1. Generate new secret value
2. Secrets Manager → secret name → Retrieve secret value → Edit → paste new value → Save
3. App Runner detects the change and auto-redeploys
4. Update any external services (Stripe webhook secret, etc.) to match

### Scaling

- **App Runner** auto-scales based on concurrent requests. Default range: 1-25 instances. Adjust in service settings if needed.
- **RDS** does not auto-scale compute. To scale up: Modify instance → choose larger instance class → apply during maintenance window or immediately (causes brief downtime).
- **RDS storage** auto-scales up to your configured max (set in Phase 3.1).

---

## Troubleshooting

### App Runner deploy fails

- Check the build logs: App Runner → Activity → click failed deploy → Build logs
- Common causes:
  - Missing or wrong Secrets Manager ARN in `apprunner.yaml`
  - Migration failure (look for `[MIGRATE]` in logs)
  - Prisma client generation failure (usually missing system deps in Dockerfile)

### API runs but `database: disconnected`

- VPC connector not reaching RDS
- Check security groups: App Runner SG must be in RDS SG's inbound rules for port 5432
- Check VPC connector configuration: must use the same VPC as RDS

### Amplify deploy fails

- Check the build logs: Amplify → your app → main → click failed deploy → Build
- Common causes:
  - Missing env var (frontend can't build without `NEXT_PUBLIC_API_URL`)
  - Prisma generate failure (the build runs `cd ../api && npx prisma generate`)
  - Next.js build error (check for type errors or missing imports)

### "Cannot reach api.antivaxxer.com"

- DNS propagation incomplete (wait or check with `dig api.antivaxxer.com`)
- SSL still provisioning (check ACM certificate status)
- App Runner custom domain not yet linked (check in App Runner console)

### Stripe webhook signature verification fails

- Wrong webhook secret in Secrets Manager
- Webhook secret doesn't match the registered endpoint URL
- Re-copy the signing secret from Stripe Dashboard

### CloudWatch shows high error rate

- Click into the alarm → View metrics → check the timeline
- Cross-reference with App Runner logs to find which endpoint is failing
- Common causes: database connection pool exhausted, third-party API rate limits, memory pressure

---

## Comparison with Vercel + Railway

If you're considering switching:

| Aspect | AWS (this guide) | Vercel + Railway |
|--------|------------------|------------------|
| Vendors | 1 | 2 |
| Setup time | 4-6 hours | 30-60 minutes |
| Monthly cost | $45-85 | $20-40 |
| Vendor lock-in | High | Medium |
| Scaling | Automatic | Automatic |
| Custom domains | Built-in (ACM) | Built-in |
| Free tier | Generous (12 months) | Generous (forever) |
| Best for | Long-term, AWS ecosystem | Fast launch, simplicity |

You can move between them later if needed. The Prisma schema, all the code, and the Stripe/SES configuration are platform-independent.
