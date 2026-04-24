# ANTIVAXXER — Streetwear with a Statement

Premium streetwear ecommerce platform for the health freedom movement.

**Current version:** v5.6.1
**Status:** Feature-complete. Pre-launch operator runbook is in [`PRE_LAUNCH_CHECKLIST.md`](./PRE_LAUNCH_CHECKLIST.md).

## Documentation Map (handover)

Read these in order if you're picking up this project:

| Read this | When you need to |
|---|---|
| `README.md` (this file) | Get the high-level lay of the land |
| `SETUP.md` | Run the project locally for the first time |
| `SITE_WORKFLOW_SPEC.md` | Understand any feature in depth — source of truth for system behavior |
| `PRE_LAUNCH_CHECKLIST.md` | **Deploy to production for the first time** — operator setup tasks (SES, Stripe, Shippo, Turnstile, cron, first admin user) |
| `DEPLOYMENT_GUIDE.md` | Per-deploy instructions for Vercel + Railway / Render / AWS |
| `AMPLIFY_DEPLOYMENT_GUIDE.md` | AWS Amplify + App Runner deployment specifically |
| `DEVELOPER_GUIDE.md` | Day-to-day development conventions |
| `CONTRIBUTING.md` | Branch strategy, commit conventions, code review checklist |
| `GAP_TRACKER.md` | History of every gap found and fixed (closed) |
| `VERSION_NAMING.md` | What shipped in each release |
| `CHANGELOG_v5.*.md` | Per-release detail |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (React + SSR) + Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL (AWS RDS) + Prisma ORM |
| Validation | Zod |
| Auth | bcrypt + NextAuth.js (server-gated admin layout, password reset via SHA-256 token) |
| Payments | Stripe + Stripe Tax |
| Shipping | Shippo (v5.4.0 — full lifecycle automation) |
| Images | AWS S3 + CloudFront |
| Email | AWS SES (transactional) + Mailchimp (marketing) |
| Bot Protection | Cloudflare Turnstile (v5.4.6 — wired on register + login) |
| Tests | Jest + supertest (v5.4.5 — 18 integration test cases) |

## Project Structure

```
antivaxxer/
├── frontend/              ← Next.js app (SSR + React + Tailwind)
│   ├── src/
│   │   ├── app/           ← Next.js App Router pages
│   │   │   ├── admin/     ← Admin pages — server-gated layout (v5.3.5)
│   │   │   ├── account/   ← Login, register, forgot/reset password (v5.3.5)
│   │   │   ├── 403/       ← Forbidden page (non-admin → /admin) (v5.3.5)
│   │   │   └── api/       ← Next.js route handlers (NextAuth)
│   │   ├── components/    ← React components
│   │   │   ├── layout/    ← Header, Footer, Nav
│   │   │   ├── product/   ← ProductGrid, ProductCard, ProductModal
│   │   │   ├── cart/      ← CartDrawer, CartItem
│   │   │   └── ui/        ← Toast, Skeleton, Modal (shared UI)
│   │   ├── lib/           ← API client, utilities, NextAuth authOptions (v5.3.5)
│   │   └── styles/        ← Global CSS, Tailwind entry
│   ├── public/            ← Static assets (favicon, images, us-map.html)
│   ├── next.config.js
│   └── tailwind.config.js
├── api/                   ← Express.js API server
│   ├── src/
│   │   ├── routes/        ← Route handlers
│   │   ├── middleware/     ← Auth, rate limiting, error handling
│   │   ├── services/      ← Business logic (orders, payments, email)
│   │   ├── validators/    ← Zod schemas for request validation
│   │   ├── utils/         ← Helper functions
│   │   └── lib/           ← Prisma client, AWS SDK clients
│   └── prisma/
│       ├── schema.prisma  ← Database schema
│       └── seed.js        ← Database seed script
├── shared/                ← Constants shared between frontend and API
├── .env.example           ← Environment variable template
├── .gitignore
└── README.md
```

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 15 (local for development, AWS RDS for staging/production)
- **npm** >= 9

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/antivaxxer.git
cd antivaxxer
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Only two values need real entries right now:
#   DATABASE_URL  — your local PostgreSQL connection string
#   NEXTAUTH_SECRET — generate with: openssl rand -base64 32
# Everything else is documented for future phases. See .env.example for details.
```

### 3. Set up the database

```bash
# Create the database
createdb antivaxxer_dev

# Run migrations
cd api
npx prisma migrate dev

# Seed with product data
npm run db:seed
cd ..
```

### 4. Start development servers

```bash
# Starts both frontend (port 3000) and API (port 4000) concurrently
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000
- API Health: http://localhost:4000/api/health
- Prisma Studio: `cd api && npm run db:studio`

## Available Scripts

### Root (monorepo)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both frontend and API in development mode |
| `npm run dev:frontend` | Start frontend only |
| `npm run dev:api` | Start API only |
| `npm run build` | Build frontend for production |
| `npm run lint` | Lint both frontend and API |
| `npm run format` | Format all files with Prettier |

### API (`cd api`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API with hot reload (nodemon) |
| `npm run start` | Start API in production mode |
| `npm run db:migrate` | Run pending migrations (production) |
| `npm run db:migrate:dev` | Create and run migrations (development) |
| `npm run db:seed` | Seed database with product data |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## Environment Variables

See `.env.example` for the complete list with documentation.

**Critical:** Never commit `.env` files. Only `.env.example` is tracked in Git.

## Developer Guide

See `DEVELOPER_GUIDE.md` for detailed documentation on how everything works, common tasks, adding new pages and endpoints, the product data model, and file-by-file reference.

## Git Workflow

See `CONTRIBUTING.md` for branching strategy, commit standards, code review process, and deployment procedures.

## Contributing

1. Create a feature branch: `feature/AV-{ticket}-{description}`
2. Follow commit message format: `[AV-{ticket}] {type}: {description}`
3. Submit PR with completed PR template
4. Requires 1 approval + passing CI before merge
