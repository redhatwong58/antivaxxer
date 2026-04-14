# ANTIVAXXER — Streetwear with a Statement

Premium streetwear ecommerce platform for the health freedom movement.

## New engineers — start here

**[ONBOARDING.md](./ONBOARDING.md)** is the single guide to run the project locally: prerequisites, PostgreSQL, `.env`, migrations, seed, `npm run dev`, verification, and troubleshooting. Follow it **top to bottom**; you do not need other docs to get a working stack.

| Doc | Purpose |
|-----|---------|
| **[ONBOARDING.md](./ONBOARDING.md)** | **Zero → running app** (complete checklist) |
| **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** | Architecture overview (§A–H), then env, migrations, servers, admin, cart, API, file reference |
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Production / hosting (Vercel + AWS hybrid) |
| **[AMPLIFY_DEPLOYMENT_GUIDE.md](./AMPLIFY_DEPLOYMENT_GUIDE.md)** | All-AWS (Amplify, App Runner, RDS, …) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (React + SSR) + Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL + Prisma ORM |
| Validation | Zod |
| Auth | bcrypt + NextAuth.js |
| Payments | Stripe + Stripe Tax |
| Shipping | Shippo |
| Images | AWS S3 + CloudFront |
| Email | AWS SES (transactional) + Mailchimp (marketing) |
| Bot Protection | Cloudflare Turnstile |

---

## Project Structure

```
antivaxxer/
├── frontend/              ← Next.js app (SSR + React + Tailwind)
│   ├── src/
│   │   ├── app/           ← App Router pages + NextAuth API routes
│   │   ├── components/    ← React components
│   │   ├── lib/           ← API client, utilities
│   │   └── styles/        ← Global CSS, Tailwind entry
│   ├── public/            ← Static assets
│   ├── next.config.js
│   └── tailwind.config.js
├── api/                   ← Express API
│   ├── src/               ← Routes, middleware, services, validators
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   ├── loadEnv.js         ← Loads api/.env then root .env (root wins)
│   └── scripts/           ← prisma-env.js, run-migrations.js
├── shared/                ← Constants shared between frontend and API
├── scripts/               ← wait-for-postgres.js (db:ready)
├── ONBOARDING.md          ← New engineer setup (start here)
├── DEVELOPER_GUIDE.md     ← Architecture + technical reference
├── .env.example           ← Environment variable template
├── .gitignore
└── README.md
```

---

## Quick reference (after setup)

Prerequisites and step-by-step setup live in **[ONBOARDING.md](./ONBOARDING.md)**. After your machine is configured:

```bash
npm install          # once
npm run db:bootstrap # DB migrate + seed (when needed)
npm run dev          # Next :3000 + API :4000
```

- Frontend: http://localhost:3000  
- API: http://localhost:4000  
- Health: http://localhost:4000/api/health  

---

## Available Scripts

### Root (monorepo)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend + API in development |
| `npm run dev:frontend` | Frontend only |
| `npm run dev:api` | API only |
| `npm run build` | Production build (frontend workspace) |
| `npm run lint` | Lint frontend + API |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm run db:ready` | Wait for Postgres (reads root `.env` `DATABASE_URL`) |
| `npm run db:bootstrap` | `db:ready` + migrate + seed |

### API (`cd api`)

| Script | Description |
|--------|-------------|
| `npm run dev` | API with nodemon |
| `npm run start` | API production mode |
| `npm run db:migrate` | `prisma migrate deploy` (with env loader) |
| `npm run db:migrate:dev` | `prisma migrate dev` (with env loader) |
| `npm run db:seed` | Run `prisma/seed.js` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:generate` | `prisma generate` |

---

## Environment Variables

Copy **`.env.example`** to **`.env`** at the **repository root**. Never commit `.env`. Details and required keys: **ONBOARDING.md §4** and **`.env.example`**.

---

## Contributing

1. Branch: `feature/AV-{ticket}-{description}`  
2. Commits: `[AV-{ticket}] {type}: {description}`  
3. PR with template; 1 approval + green CI  

---

## Documentation index (5 files)

All Markdown lives in the repo root:

| File | Purpose |
|------|---------|
| [README.md](./README.md) | This file — index, scripts, structure, release naming |
| [ONBOARDING.md](./ONBOARDING.md) | First machine: Postgres, `.env`, migrate, seed, run, verify |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Product/architecture (§A–H), then `loadEnv`, servers, admin, cart, API, files |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Deploy patterns (Vercel + AWS) |
| [AMPLIFY_DEPLOYMENT_GUIDE.md](./AMPLIFY_DEPLOYMENT_GUIDE.md) | Full AWS Amplify-style deploy |

### Release / zip naming

Deliverable zips use:

`antivaxxer-v{MAJOR}.{MINOR}.{PATCH}-{description}.zip`

- **MAJOR** — phase or large milestone (e.g. v1.0.0 phase 1 done).  
- **MINOR** — meaningful step within a phase.  
- **PATCH** — fix or doc-only tweak on an already-delivered step.  
- **description** — short lowercase hyphenated label (2–4 words).

Examples: `antivaxxer-v1.0.0-phase1-complete.zip`, `antivaxxer-v2.1.1-stripe-webhook-fix.zip`.
