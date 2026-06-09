# WaveFinder — Claude Code project notes

Free Surfline-style surf forecast app. Next.js 16 App Router, Prisma 5 + Neon
Postgres, better-auth, Stripe (TEST mode), Upstash Redis, deployed on Vercel at
https://wave-finder.vercel.app.

## Current state & open work

- **Latest audit (read this first):** `docs/audit/05-post-deploy-audit-2026-06-09.md`
  — post-deploy audit with the prioritized open-work list. Done since
  (2026-06-09, second pass): Prisma migrations baselined (`0_init` marked
  applied in prod; `migrate deploy` runs in the Vercel build — use
  `npm run migrate:dev` for schema changes now, NOT `db push`), the two
  `proxy.ts` rate-limit HIGHs fixed (platform IP only + per-bucket keys),
  `/api/health` now pings Redis, CI gates `next build` + lint warnings.
  Still open: set `SENTRY_DSN` in Vercel prod, external uptime monitoring,
  email verification, Stripe go-live, session-cleanup cron, CSP nonce.
- Earlier audits: `docs/audit/00-AUDIT-SUMMARY.md` (2026-06-05) + per-area
  reports. Ops runbook: `docs/RUNBOOK.md`.

## Things that will bite you

- **Deploy via `git push` to main** (Vercel auto-deploys). Do NOT use
  `vercel --prod` from this machine.
- **The Vercel build needs `DATABASE_URL`**: all 1,490 spot pages prerender at
  build (`app/spots/[slug]/page.tsx` — `dynamicParams=false` gives real 404s
  for unknown slugs; on-demand ISR cached soft-404 200s, see the 2026-06-09
  audit). Local builds without `DATABASE_URL` skip the prerender by design.
- **`npm run db:reset` force-resets the database** — never run it against prod.
- **Only `/api/best-spots` is Pro-gated — by design.** Forecast/webcams/
  surf-reports/water-quality/alerts are intentionally free per the pricing page.
  Do not "fix" this as a paywall hole.
- Spot data is a static dataset (`lib/spots-data.ts` + `lib/spots/*`, ~1,490
  spots) seeded into Postgres; the DB cuid `id` keys saved-spots localStorage,
  so don't swap id sources.
- Fonts are self-hosted via `next/font` (CSP has no Google Fonts origins).
- `WAVEFINDER_PROJECT.md` and `docs/deployment.md` are partially stale — trust
  the code.

## Verify before claiming done

`npm run typecheck` · `npm run lint` · `npm test` (vitest) · `npm run build`.
CI runs lint (zero-warnings) + typecheck + test + `next build` (build job has
no `DATABASE_URL`, so the spot prerender is skipped there by design).

## Before real customers (Stripe is in TEST mode)

Live price IDs + live webhook endpoint/secret + `sk_live_` key, enforce email
verification first (needs `RESEND_API_KEY`, `requireEmailVerification: true`,
gate checkout on `emailVerified`). Details in the 2026-06-09 audit + RUNBOOK.
