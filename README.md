# WaveFinder

Free, Surfline-style surf forecasts for 1,490+ surf spots worldwide. WaveFinder
pulls 100% free public data (NOAA NDBC buoys, NOAA CO-OPS tides, and Open-Meteo
marine forecasts) and turns it into wave-height, swell, wind, tide, and live
buoy readings with a surf-condition rating for every spot.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Auth:** better-auth (email + password)
- **ORM / DB:** Prisma 5 + Neon Postgres
- **Payments:** Stripe (Pro subscription)
- **Rate limiting:** Upstash Redis
- **Data / charts:** TanStack Query, Recharts, Leaflet (+ MarkerCluster)
- **Monitoring:** Sentry (optional)
- **Testing:** Vitest

## Required environment variables

All configuration is supplied via environment variables. See
[`.env.example`](./.env.example) for the full list, grouped and documented with
placeholder values. Copy it to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

At minimum the app needs `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`, and `NEXT_PUBLIC_SITE_URL`. Stripe, Upstash, Resend, and
Sentry variables enable their respective features.

## Local development

Node 22 is required (see [`.nvmrc`](./.nvmrc)).

```bash
npm install            # install dependencies
npx prisma generate    # generate the Prisma client
npx prisma db push     # sync the schema to your database
npm run db:seed        # (optional) seed surf spots
npm run dev            # start the dev server at http://localhost:3000
```

## Testing

```bash
npm test               # run the Vitest suite once
npm run test:watch     # watch mode
npm run typecheck      # type-check with tsc --noEmit
npm run lint           # ESLint
```

## Deploy notes

WaveFinder is built to deploy on Vercel.

- Set the same variables from `.env.example` in your Vercel project's
  **Production** environment.
- Use the Neon **pooled** endpoint for `DATABASE_URL`
  (`?sslmode=require&pgbouncer=true&connection_limit=1`) and the **direct**
  (non-pooler) host for `DIRECT_URL`.
- Apply schema changes with `npx prisma db push` (or adopt `prisma migrate`).
- Point an uptime monitor at `/api/health`.

A step-by-step production cutover checklist lives in
[`docs/RUNBOOK.md`](./docs/RUNBOOK.md).
