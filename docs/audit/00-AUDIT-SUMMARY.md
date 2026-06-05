# WaveFinder — Production-Readiness Audit (Master Summary)

**Date:** 2026-06-05
**Stack:** Next.js 16.2.4 (App Router, React 19, Turbopack) · Prisma 5 · **Neon Postgres** · better-auth (email+password) · Stripe · Upstash Redis · Leaflet · deployed to Vercel.
**Verdict:** Solid engineering for a solo build (great external-API resilience, security headers, SEO/PWA, rate limiting). **Not yet production-ready** — there are 4–5 release-blockers, all fixable in days, not weeks. The right database is the one you already have.

Detailed reports: [`01-database.md`](01-database.md) · [`02-security.md`](02-security.md) · [`03-performance.md`](03-performance.md) · [`04-ops.md`](04-ops.md)

---

## The database question (answered first, since you asked)

**Recommendation: STAY ON NEON. Do not migrate to Supabase.**

Your stated goal — "a better database that stores our logins" — is **already met**. better-auth writes `User` / `Session` / `Account` / `Verification` straight into Neon Postgres today. Neon *is* Postgres, so logins already live in the DB.

- **Supabase's headline feature is its own Auth system (GoTrue)**, which is *incompatible* with better-auth. Moving there means either (a) using Supabase as a plain Postgres host and wasting its main differentiator, or (b) ripping out better-auth and rewriting all auth + the Stripe linkage — high risk, zero user benefit.
- Supabase's pooler (Supavisor) has the **same** Prisma/serverless pooling caveats you'd fix on Neon anyway — you'd do migration work to solve the identical problem.
- Your real DB problems are **operational, not vendor**: no connection pooling, `db push` instead of migrations, and the DB sitting on the static-data hot path. Fix those on Neon (cheap) instead of migrating (expensive).

---

## Release blockers (fix before any real traffic)

| # | Sev | Area | Problem | Fix |
|---|-----|------|---------|-----|
| **B1** | CRIT | Security | **Paywall is not enforced server-side.** `hasProAccess()` is never called on any data route — anyone can `curl /api/forecast/...` or `/api/best-spots` and get the full Pro dataset. (SEC-01) | Add a `requireProAccess()` gate to each Pro route; set `Cache-Control: private, no-store` on gated responses. |
| **B2** | CRIT | Database | **Connection exhaustion.** Plain `new PrismaClient()` on a *direct, unpooled* Neon URL. Every Vercel lambda opens its own TCP pool → `too many connections` under load. (DB §1) | Switch `DATABASE_URL` to Neon's **pooled** endpoint (`-pooler`, `pgbouncer=true&connection_limit=1`); add `DIRECT_URL` + `directUrl` in schema. |
| **B3** | CRIT | Security | **Stripe webhook trust model.** Entitlement is written from `subscription.metadata.userId` with no check that the Stripe customer belongs to that user, and no price-ID validation. Sig verification itself is correct. (SEC-02) | Resolve user by `stripeCustomerId` as source of truth; validate price ID against `STRIPE_PRO_MONTHLY_PRICE_ID`; add `event.id` idempotency. |
| **B4** | CRIT | Performance | **`force-dynamic` on `/api/spots`** strips the CDN caching the route already sets, so the home map re-runs a ~120-bucket Open-Meteo fan-out (10–15s cold) on *every* visitor. (Perf C1/C2) | Delete `export const dynamic = 'force-dynamic'`; the existing `s-maxage`/SWR headers then collapse N visitors → 1 origin compute. |
| **B5** | CRIT | Ops | **Zero automated tests + no CI.** A broken push deploys straight to prod. (Ops §2/§6) | Add Vitest covering webhook, rate limiter, forecast degradation, auth guards, rating engine; gate on GitHub Actions (lint + `tsc` + build + tests). |

---

## High priority (the "make it faster" + "make it safe" tier)

**Performance — biggest speed wins after B4:**
- `refetchOnWindowFocus: true` re-runs the heaviest fan-outs on every tab focus → set **`false`** (`Providers.tsx`).
- Home page does an **uncached DB `count()`** every request → ISR / `'use cache'` / hardcode (`app/page.tsx`).
- A spot page fetches the same row up to **4×** (metadata + page + nearby + client forecast) → wrap lookup in React `cache()`, hydrate forecast server-side.
- **recharts** eagerly bundled into the 660-line `SpotForecastView` → `optimizePackageImports: ['recharts','date-fns']` + dynamic-import the charts.

**Security/auth hardening:**
- **Email verification not enforced** (typo'd emails get accounts + trials) → `requireEmailVerification: true` + a sender.
- **No rate limiting on `/api/auth/*`** (brute force / credential stuffing) → add a strict `proxy.ts` rule + better-auth's built-in limiter.
- **Rate limiter bypassable** via spoofed `x-forwarded-for` → derive IP from Vercel's trusted edge value, not the left-most XFF.
- **`trustedOrigins` unset** in better-auth (CSRF) → set to the canonical HTTPS prod origin.

**Architecture (perf + resilience):**
- **~1,490 surf spots are immutable static TS** but every read round-trips Prisma. Serve them from in-memory maps; reserve Postgres for auth/billing only. Removes ~9 DB hits from the hot path *and* means a DB outage no longer takes down forecast pages.

**Ops:**
- **No error tracking** → add `@sentry/nextjs` + `instrumentation.ts onRequestError`.
- **No `app/global-error.tsx`** → add it (layout-level errors currently fall through).
- **No `.env.example`** + no fail-fast env validation → commit one (only vars the code reads), add a zod boot check.
- **`db push` instead of migrations** → adopt `prisma migrate`, baseline prod, add `migrate deploy` to the Vercel build.
- Standardize API-route error handling (several Prisma calls are unguarded → bare 500s).

---

## Medium / Low (polish + tech debt)
- Pin Node (`engines` + `.nvmrc`); strengthen ESLint (`no-console`, `--max-warnings=0`).
- CSP `script-src 'unsafe-inline'` → move to nonce-based strict CSP.
- Open redirect via `?next=` on sign-in → allow only same-origin relative paths.
- Webhook idempotency, cookie/session security pinned, `BETTER_AUTH_SECRET` length check.
- Downsample 17-day hourly tide payload; `loading="lazy"` on webcam `<img>`; IntersectionObserver-gate below-fold spot-page fetches.
- **Docs are stale/misleading:** `README.md` is create-next-app boilerplate; `WAVEFINDER_PROJECT.md` describes Resend email alerts + a cron route + `saved-spots`/`sessions` routes that **don't exist**. Reconcile before others rely on them.
- Cron-clean expired `Session`/`Verification` rows; confirm `ENABLE_DEBUG_API` unset and `NEXT_PUBLIC_SITE_URL` set in Production.

---

## Suggested execution order
1. **Day 1 (blockers):** B2 pooling → B4 force-dynamic → B1 paywall gate → B3 webhook hardening.
2. **Day 2 (safety net):** Vitest for the 5 critical paths + GitHub Actions CI (B5); Sentry + global-error; `.env.example` + env validation.
3. **Day 3 (speed + auth hardening):** static-spots refactor, `refetchOnWindowFocus:false`, home `count()` cache, React `cache()` dedupe, recharts split; email verification + auth rate limiting + XFF fix + `trustedOrigins`.
4. **Day 4 (polish):** migrations, Node pin, ESLint, CSP nonce, docs rewrite, payload trims.

Nothing here requires a rewrite or a new database — it's hardening an already-decent app.
