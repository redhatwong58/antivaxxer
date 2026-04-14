# ANTIVAXXER — New engineer onboarding

Follow this document **in order** from top to bottom. You do **not** need to open other guides to get the app running locally. Optional reading is linked at the end.

**What you will have when finished**

- PostgreSQL running with database `antivaxxer_dev`, schema migrated, demo products seeded  
- Root `.env` configured so the API and Prisma can connect  
- **Next.js** on http://localhost:3000 and **Express API** on http://localhost:4000  
- A passing **`GET /api/health`** check (API + database)

**Rough time:** 20–40 minutes (mostly installs and downloads).

---

## Table of contents

1. [Prerequisites](#1-prerequisites)  
2. [Clone the repository and install Node dependencies](#2-clone-the-repository-and-install-node-dependencies)  
3. [Install PostgreSQL and create the database](#3-install-postgresql-and-create-the-database)  
4. [Create and edit `.env`](#4-create-and-edit-env)  
5. [Run database migrations and seed](#5-run-database-migrations-and-seed)  
6. [Start the application](#6-start-the-application)  
7. [Verify everything works](#7-verify-everything-works)  
8. [Troubleshooting](#8-troubleshooting)  
9. [Optional: Stripe (checkout payments)](#9-optional-stripe-checkout-payments)  
10. [After onboarding](#10-after-onboarding)

---

## 1. Prerequisites

Install these **before** starting the numbered steps.

| Requirement | Version / notes |
|-------------|----------------|
| **Node.js** | **18 or newer** (20 LTS is fine). Check: `node -v` |
| **npm** | **9 or newer**. Check: `npm -v` |
| **Git** | For cloning. Check: `git --version` |
| **PostgreSQL** | **15 or newer** running on your machine (native install; this guide does not use Docker) |

Supported platforms: **macOS**, **Windows**, **Linux** (PostgreSQL install steps differ slightly).

---

## 2. Clone the repository and install Node dependencies

```bash
git clone <YOUR_REPO_URL>
cd antivaxxer
npm install
```

Wait until `npm install` finishes with no errors. The repo uses **npm workspaces** (`frontend`, `api`, `shared`).

---

## 3. Install PostgreSQL and create the database

### macOS (Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16
```

If `createdb` is **not found**, add PostgreSQL’s `bin` directory to your `PATH`. Homebrew prints the exact path in the **Caveats** after install. Typical paths:

- **Apple Silicon:** `/opt/homebrew/opt/postgresql@16/bin`  
- **Intel Mac:** `/usr/local/opt/postgresql@16/bin`

Example (Apple Silicon — adjust if Homebrew says otherwise):

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Create the development database:

```bash
createdb antivaxxer_dev
```

Confirm:

```bash
psql antivaxxer_dev -c "SELECT 1;"
```

You should see a row with `1`.

### Windows

1. Download and install PostgreSQL from  
   https://www.postgresql.org/download/windows/  
2. Remember the password you set for the **`postgres`** superuser (if the installer asks).  
3. Open **pgAdmin** or **SQL Shell (psql)** and run:

   ```sql
   CREATE DATABASE antivaxxer_dev;
   ```

### Linux

Use your distribution’s PostgreSQL packages (e.g. `postgresql` + `postgresql-contrib`), start the service, then:

```bash
sudo -u postgres createdb antivaxxer_dev
# or, as your user if peer auth is configured:
createdb antivaxxer_dev
```

---

## 4. Create and edit `.env`

All configuration for local development starts from the **repository root** (the folder that contains the root `package.json`).

### 4.1 Copy the template

```bash
cp .env.example .env
```

Edit **`.env`** in the root (not only under `api/`). The API loads env via **`api/loadEnv.js`**: it reads **`api/.env`** if present, then **root `.env`** with **override**, so **root wins** for duplicate keys. For your first setup, **only root `.env`** is enough.

### 4.2 Set `DATABASE_URL` (required)

Use a URL that matches **your** PostgreSQL user, password, host, port, and database name.

**macOS Homebrew** — often your Mac login has no password for local connections:

```bash
whoami
```

Put that username into `.env`:

```env
DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/antivaxxer_dev
```

Replace `YOUR_MAC_USERNAME` with the output of `whoami`. **Do not** leave the placeholder text `YOUR_USERNAME` from `.env.example`.

If your Postgres user has a password:

```env
DATABASE_URL=postgresql://YOUR_MAC_USERNAME:yourpassword@localhost:5432/antivaxxer_dev
```

**Windows** (typical installer defaults):

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/antivaxxer_dev
```

If PostgreSQL listens on a non-default port, change `5432` in the URL.

### 4.3 Set `ADMIN_TOKEN` (required)

Pick any long random string. This value is used as a **legacy Bearer token** for **`/api/admin`** when you store it in the browser (see **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md#4-how-the-admin-system-works)**). Example generation:

```bash
openssl rand -hex 16
```

Put the result in `.env`:

```env
ADMIN_TOKEN=paste_the_generated_string_here
```

### 4.4 Set `NEXTAUTH_SECRET` (required for login)

Generate:

```bash
openssl rand -base64 32
```

In `.env`:

```env
NEXTAUTH_SECRET=paste_the_generated_string_here
```

### 4.5 Keep these defaults for local dev (usually no change)

Your `.env.example` already includes sensible local values:

```env
API_PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
```

Leave them unless you deliberately change ports.

### 4.6 Optional variables

- **Stripe** — only needed to complete **payment** on checkout. See [§9](#9-optional-stripe-checkout-payments).  
- **AWS, Shippo, Turnstile, Mailchimp, etc.** — optional; catalog, cart, and basic auth work without them.

Full descriptions: **`.env.example`**.

---

## 5. Run database migrations and seed

Ensure PostgreSQL is **running** and `DATABASE_URL` in root `.env` is correct.

From the **repository root**:

```bash
npm run db:bootstrap
```

This runs:

1. **`npm run db:ready`** — waits until something accepts TCP on the host/port from `DATABASE_URL`  
2. **`npm run db:migrate:dev`** (api workspace) — applies Prisma migrations using **`api/scripts/prisma-env.js`** (loads root `.env`)  
3. **`npm run db:seed`** — inserts demo categories, products, and variants  

**Success looks like:** seed script prints product counts and ends with **“Database seeded successfully.”**

### If `db:bootstrap` fails

- **`P1012` / `DATABASE_URL` not found:** Your `.env` is missing or not at the **repo root**, or the variable name is wrong.  
- **`P1010` / access denied:** Wrong Postgres user or password in `DATABASE_URL`.  
- **Connection refused:** Postgres is not running or port is wrong.

See [§8 Troubleshooting](#8-troubleshooting).

### Manual alternative (same result)

```bash
npm run db:ready
cd api
npm run db:migrate:dev
npm run db:seed
cd ..
```

**Do not** run raw `npx prisma migrate dev` without exporting `DATABASE_URL` unless you know what you are doing — use **`npm run db:migrate:dev`** from **`api/`** instead.

---

## 6. Start the application

From the **repository root**:

```bash
npm run dev
```

This starts **both**:

- **Frontend (Next.js)** — http://localhost:3000  
- **API (Express)** — http://localhost:4000  

Leave this terminal open. Stop with **Ctrl+C**.

---

## 7. Verify everything works

### 7.1 API and database

In a **second** terminal:

```bash
curl -s http://localhost:4000/api/health
```

Expect JSON similar to:

```json
{"status":"ok","timestamp":"...","database":"connected"}
```

If **`database`** is **`disconnected`** or HTTP **503**, Postgres URL or server is wrong — see [§8](#8-troubleshooting).

### 7.2 Frontend

Open **http://localhost:3000** in a browser. You should see the storefront; products should load (from the API + database).

### 7.3 NextAuth route (session)

NextAuth must be served by **Next**, not Express:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/session
```

Expect **`200`** (body may be empty or JSON for an unauthenticated session).

### 7.4 Optional: Prisma Studio

```bash
cd api && npm run db:studio
```

Opens a browser UI (default **http://localhost:5555**) to inspect tables.

---

## 8. Troubleshooting

### `createdb: command not found`

PostgreSQL client tools are not on your `PATH`. Add the `bin` directory from your install (Homebrew “Caveats”, or PostgreSQL’s `bin` on Windows).

### `Environment variable not found: DATABASE_URL` (Prisma)

- Ensure **`.env` exists at the repo root** next to the root `package.json`.  
- Ensure the line is exactly **`DATABASE_URL=...`** with no quotes issues.  
- Run migrations via **`cd api && npm run db:migrate:dev`** so **`prisma-env.js`** loads env.

### `User was denied access` / `password authentication failed`

Your `DATABASE_URL` user or password does not match PostgreSQL. Fix the URL to match a real role that may access `antivaxxer_dev`.

### Port **3000** or **4000** already in use

Stop the other process or set **`API_PORT`** in `.env` for the API and update **`NEXT_PUBLIC_API_URL`** accordingly; for Next, use `next dev -p <port>` via workspace script change or run frontend separately with a custom port.

### Admin UI returns 401 / “Admin access denied”

Admin routes need **`Authorization: Bearer ...`**. Either log in as a user with **`admin`** role in the database, or for local dev set **`sessionStorage`** — see **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md#4-how-the-admin-system-works)**.

### Checkout / Stripe errors

Without Stripe test keys, **catalog and cart still work**; **payment** step will fail until you add keys — [§9](#9-optional-stripe-checkout-payments).

### Reset database (destructive, local only)

```bash
cd api
node scripts/prisma-env.js migrate reset --force
npm run db:seed
cd ..
```

---

## 9. Optional: Stripe (checkout payments)

1. Create a Stripe account and get **test** keys: https://dashboard.stripe.com/apikeys  
2. In root **`.env`**, set:

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

3. **`STRIPE_WEBHOOK_SECRET`** is mainly for webhook endpoints; local card testing may work with publishable + secret keys for Elements.  
4. Restart **`npm run dev`** and walk through **Checkout** from the cart.

---

## 10. After onboarding

- **[README.md](./README.md)** — documentation index (5 root `.md` files), scripts, repo layout.  
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** — architecture (§A–H), manual test flows, schema/API reference.  
- **`.env.example`** — full env catalog.

---

*If any step fails on a clean machine, update this file or open an issue.*
