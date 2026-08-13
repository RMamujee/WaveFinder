# WaveFinder

Free, Surfline-style surf forecasts for 1,490+ surf spots worldwide. WaveFinder
pulls 100% free public data (NOAA NDBC buoys, NOAA CO-OPS tides, and Open-Meteo
marine forecasts) and turns it into wave-height, swell, wind, tide, and live
buoy readings with a surf-condition rating for every spot.

**Deployed:** https://wave-finder.vercel.app

## Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Auth:** better-auth (email + password)
- **ORM / DB:** Prisma 5 + Neon Postgres
- **Payments:** Stripe (Pro subscription, TEST mode)
- **Rate limiting:** Upstash Redis
- **Maps:** Leaflet + MarkerCluster
- **Charts:** Recharts
- **Query:** TanStack Query
- **Monitoring:** Sentry
- **Testing:** Vitest

## Getting started

Node 22 is required (see [`.nvmrc`](./.nvmrc)).

**1. Install dependencies:**

```bash
npm install
```

**2. Set up environment variables:**

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

At minimum, you need `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`, and `NEXT_PUBLIC_SITE_URL`. Optional features (Stripe,
Upstash, Sentry) are enabled by setting their respective variables.

**3. Generate the Prisma client and sync the database:**

```bash
npx prisma generate
npx prisma migrate deploy   # apply committed migrations
npm run db:seed             # (optional) seed 1,490 surf spots
```

**4. Start the development server:**

```bash
npm run dev
```

Visit http://localhost:3000.

## npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server at http://localhost:3000 |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint (zero warnings) |
| `npm run typecheck` | Type-check with tsc --noEmit |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:push` | Sync schema to database |
| `npm run db:seed` | Seed 1,490 surf spots |
| `npm run db:studio` | Open Prisma Studio (DB browser) |
| `npm run db:reset` | Force-reset and reseed database |
| `npm run migrate:dev` | Create a new schema migration |
| `npm run migrate:deploy` | Run pending migrations (used in Vercel build) |
| `npm run smoke:prod` | Smoke-test the production deployment |

## Verification

Before committing or deploying:

```bash
npm run typecheck    # TypeScript check
npm run lint         # ESLint (fails on warnings)
npm test             # Vitest suite
npm run build        # Full Next.js build
```

## Deploy to production

WaveFinder is built to deploy on Vercel. Push to the `main` branch to trigger
a deploy:

```bash
git push origin main
```

Vercel runs `next build` and `prisma migrate deploy` automatically. 

**Setup steps for a new Vercel project:**

1. Set all variables from `.env.example` in Vercel's **Production** environment.
2. For `DATABASE_URL`, use the Neon **pooled** endpoint with the query string:
   ```
   ?sslmode=require&pgbouncer=true&connection_limit=1
   ```
3. For `DIRECT_URL`, use the Neon **direct** (non-pooler) endpoint.
4. Point an external uptime monitor at `/api/health`.

See [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) for the full production cutover
checklist.

## Pricing model

The app is free, except for:

- **Pro tier:** `/api/best-spots` is gated behind a Stripe subscription. All
  other endpoints (forecast, webcams, surf-reports, water-quality, alerts) are
  intentionally free.

## Documentation

- **Architecture & design:** [`WAVEFINDER_PROJECT.md`](./WAVEFINDER_PROJECT.md)
- **Codebase notes:** [`CLAUDE.md`](./CLAUDE.md)
- **Security & ops audits:** [`docs/audit/`](./docs/audit/)
- **Production runbook:** [`docs/RUNBOOK.md`](./docs/RUNBOOK.md)
