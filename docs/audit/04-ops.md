# WaveFinder — Production-Readiness & Ops Audit

**App:** Next.js 16.2.4 (App Router) + Prisma 5 + Neon Postgres + better-auth + Stripe + Upstash, deploying to Vercel (`wave-finder.vercel.app`).
**Overall:** The app is operationally **above average for a solo project** — it has rate limiting, security headers, graceful external-API degradation, SEO/PWA polish, and a smoke test. The critical gaps are **zero automated tests, no error tracking (Sentry), no CI, no `.env.example`, no global-error boundary, and stale/misleading project docs**.

---

## 1. OBSERVABILITY

**`HIGH` — No error tracking / no Sentry.** `lib/monitoring.ts` is a 15-line wrapper that emits JSON to `console.log/warn/error`. On Vercel these land in runtime logs that are ephemeral (retained briefly on Hobby/Pro) and have no alerting, no grouping, no stack-trace capture, no release tagging.
- *Fix:* Add `@sentry/nextjs` (or Vercel-native log drain to an external sink). Wrap `monitor('error', …)` to also call `Sentry.captureException`. Add `instrumentation.ts` with `onRequestError` for server-component/route errors. At minimum configure a Vercel **Log Drain** to a retained store.

**`MEDIUM` — No uptime/alerting on the health check.** `app/api/health/route.ts` is meaningful (it actually does `SELECT 1` against Postgres, returns 503 on failure) — good. But nothing polls it. `smoke-prod.ts` only runs manually post-deploy.
- *Fix:* Point an external uptime monitor (BetterStack/UptimeRobot/Checkly) at `/api/health` with paging. Optionally extend the health check to ping Redis and report `redis: connected|degraded` so rate-limiter fallback is visible.

**`LOW` — No structured request logging / correlation IDs.** Logs are JSON lines but have no request ID, route, latency, or user context, so debugging a prod incident means grepping unstructured Vercel logs.
- *Fix:* Include `requestId` (from `x-vercel-id`), path, and duration in `monitor()` payloads on API routes.

**`LOW` — No feature flags.** Gating is done with raw env vars (`ENABLE_DEBUG_API`, presence of `STRIPE_*`). Fine at this scale; note it as tech debt if billing/experiments grow.

---

## 2. TESTING — `CRITICAL`

**There are ZERO automated tests.** No `*.test.ts`, `*.spec.ts`, `__tests__/`, no Vitest/Jest/Playwright config, no test runner in `package.json`. The only verification is `scripts/smoke-prod.ts` (homepage 200, health 200, debug 404-when-disabled, and Redis rate-limit 429) — useful but runs against **prod after deploy**, not as a gate.

Minimum viable suite before launch (in priority order):
1. **Stripe webhook (`app/api/stripe/webhook/route.ts`)** — unit-test signature rejection (400), unconfigured 503, and `syncSubscription` mapping for `checkout.session.completed` / `subscription.updated` / `.deleted`. This is money + DB writes; highest risk.
2. **Rate limiter (`proxy.ts`)** — per-path limit lookup, 429 + `Retry-After` headers, Redis-failure → in-memory fallback path (`checkRedisLimit().catch(() => null) ?? checkMemoryLimit`).
3. **Forecast API (`app/api/forecast/[slug]/route.ts`)** — slug validation (400), missing spot (404), and the `Promise.allSettled` degradation (marine rejected → 502; wind rejected → still 200 with empty wind). Mock the open-meteo fetchers.
4. **Auth/session guard** — `billing/checkout` returns 401 without session, 503 without Stripe.
5. **Rating engine (`lib/forecast/rating.ts`, `merge.ts`)** — pure functions, cheap to test, core product correctness.
- *Fix:* Add Vitest for units + a couple of Playwright smoke flows (home → spot → forecast renders). Wire into CI (section 6).

---

## 3. ERROR HANDLING

**`HIGH` — No `app/global-error.tsx`.** `app/error.tsx` exists and is decent (reset button, "Go home", shows `error.message`), but it only catches errors **below** the root layout. If `app/layout.tsx` itself throws (e.g., a provider fails), the user gets Next's raw fallback. `global-error.tsx` is required for full coverage and must render its own `<html><body>`.
- *Fix:* Add `app/global-error.tsx`; also wire both boundaries to report to Sentry via `useEffect`.

**`LOW` — `error.tsx` leaks raw `error.message` to users.** Acceptable for a hobby app, but in prod a thrown DB/Stripe error message could surface internals. Next already digests server errors in prod, but client-thrown messages render verbatim.
- *Fix:* Show a generic message in production; log the real one.

**External-API degradation — GOOD (notable strength).** `lib/api/open-meteo.ts` and the forecast route degrade gracefully: marine wrapped in retry+timeout, wind failures return empty structures, `Promise.allSettled` everywhere, runtime-cache reads/writes wrapped in try/catch, Cloudflare-HTML-instead-of-JSON handled. Map conditions route batches calls and has a nearest-neighbour fallback so no permanently-grey nodes. External failures do **not** 500 the page.

**`MEDIUM` — Inconsistent API error handling across routes.** Routes that hit Prisma without a try/catch will throw → 500. API routes have no error boundary and return Next's default 500 JSON:
- `app/api/spots/route.ts` — `prisma.surfSpot.findMany` is unguarded; a DB blip yields an unstructured 500 with no `monitor()` call.
- `app/api/forecast/[slug]/route.ts` & `alerts/[slug]/route.ts` — the `prisma.surfSpot.findUnique` calls are unguarded.
- By contrast the Stripe webhook and health route **do** wrap+monitor. Standardize this.
- *Fix:* Add a small `withRouteErrorHandling` wrapper (try/catch → `monitor('error', …)` → consistent `{ error }` 500) and apply to all routes touching the DB or external services.

---

## 4. CONFIG / BUILD

**GOOD:** `next.config.ts` does **not** set `eslint.ignoreDuringBuilds` or `typescript.ignoreBuildErrors` — so type and lint errors **will** fail the build (correct). `tsconfig.json` has `"strict": true`. `vercel.json` build command correctly runs `prisma generate && next build` (matches the buildCommand override; the bare `next build` script in package.json would miss client generation if used directly). `turbopack.root` is pinned (per the known stray-lockfile gotcha). Security headers + a real CSP are configured in `next.config.ts` — strong for a hobby app.

**`MEDIUM` — Node version not pinned.** No `engines` field in `package.json` and no `.nvmrc`. Vercel picks a default Node major that can drift between deploys/local.
- *Fix:* Add `"engines": { "node": "22.x" }` (or your target) and an `.nvmrc`.

**`MEDIUM` — ESLint config is minimal.** `eslint.config.mjs` is just `next/core-web-vitals` + `next/typescript`. No rule to flag stray `console.log`, no import ordering, no a11y beyond Next defaults.
- *Fix:* Add `no-console` (allow `warn`/`error`) so debug logs can't slip into routes; consider `eslint-plugin-security` for the API layer.

**`LOW` — `package.json` name is `surf-app`**, while Vercel project is `wave-finder` and docs reference a `surf-app/` subfolder that no longer matches the flat repo layout. Cosmetic but adds confusion.

**`LOW` — `lint` script is bare `eslint`** (no `--max-warnings 0`), so warnings won't fail local lint. CI should enforce `--max-warnings=0`.

---

## 5. ENV MANAGEMENT — `HIGH`

**No `.env.example` exists.** Required vars are documented only prose-style in `docs/deployment.md` and (inconsistently) in `WAVEFINDER_PROJECT.md`. A fresh clone or a new Vercel env has no machine-checkable manifest, so a missing var surfaces only at runtime.

Vars the app actually reads (from code): `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `UPSTASH_REDIS_REST_URL/TOKEN` (or `KV_*` / `WaveFinderStorage_KV_*`), `ENABLE_DEBUG_API`, `VERCEL_URL` (auto).

**Doc drift / risk:** `docs/deployment.md` lists `SESSION_SECRET`, `YOUTUBE_API_KEY`, `WINDY_WEBCAM_API_KEY` as required, and `WAVEFINDER_PROJECT.md` lists `RESEND_API_KEY` + `CRON_SECRET` — **none of these appear in the current code** (no Resend, no cron route, no `CRON_SECRET` reference). So the env docs over-state requirements *and* the two markdown files disagree with each other.

- *Fix:* Commit a `.env.example` enumerating only the vars the code reads, grouped (app/db, auth, billing, redis, debug). Add a fail-fast env validation module (e.g., a small zod schema imported in `lib/prisma.ts`/`lib/auth.ts` boot path) so prod refuses to boot with a missing `DATABASE_URL`/`BETTER_AUTH_SECRET` rather than 500ing on first request.

**Good safety behavior:** Billing fails *closed* (503) when Stripe env is absent, and `sitemap.ts` guards on `DATABASE_URL` presence with `.catch(() => [])` so a DB outage doesn't break sitemap generation.

---

## 6. CI/CD — `HIGH`

**No CI whatsoever.** No `.github/workflows/`, no pre-deploy checks. `docs/deployment.md` says to run `npm audit`, `npm run lint`, `npm run build`, then `smoke:prod` **manually**. Nothing enforces this; a broken push goes straight to a Vercel deploy.
- *Fix:* Add `.github/workflows/ci.yml` running on PR + push: `npm ci` → `prisma generate` → `npm run lint -- --max-warnings=0` → `tsc --noEmit` → `npm run build` → (once tests exist) `vitest run`. Add a post-deploy job (or Vercel deploy hook) that runs `smoke:prod` against the preview URL. Enable Vercel preview deployments as a required status check before merge to `main`.

---

## 7. DOCS — what the project itself says is unfinished

**`WAVEFINDER_PROJECT.md` "Known Issues / Remaining Work":**
1. **Email validation** — `/api/alerts` stores emails with no format check (silent failures).
2. **No rate limiting on `/api/spots?withConditions=true`** — *(now partially addressed: `proxy.ts` applies a 120/min limit to `/api/spots`, but a single request still fans out to ~100+ Open-Meteo calls; the underlying cost concern remains).*
3. **Webcams** — no free public API; shows an OpenStreetMap embed placeholder.
4. **Marine model coverage** — Open-Meteo ~9 km resolution; very sheltered spots show 0 ft (looks like a bug to users).
5. **More spots** — Oregon/Washington/full East Coast not seeded.
6. **Session social** — `buddies` field exists, no sharing UI.

**`MEDIUM` — Documentation is stale and contradicts the code (operational hazard):**
- `README.md` is the **default create-next-app boilerplate** — provides zero real onboarding (wrong app description, references Geist font the app doesn't use).
- `WAVEFINDER_PROJECT.md` describes a `surf-app/` subfolder layout, **Resend email alerts**, a **`/api/cron/check-alerts`** route, `saved-spots`, and `sessions` API routes — several of which **do not exist** in the current `app/api` tree. The documented `SpotAlert` email-alert/cron feature is **not implemented** in the audited code (the `alerts/[slug]` route is a read-only NOAA weather-alert fetch, unrelated to email subscriptions). Anyone trusting these docs will set up env/infra for features that aren't there.
- `docs/deployment.md` and `WAVEFINDER_PROJECT.md` disagree on the required env set (see §5).
- *Fix:* Rewrite `README.md` with real setup steps; reconcile `WAVEFINDER_PROJECT.md` against the actual routes (or mark the alert/cron/email sections as "planned, not built").

---

## 8. SEO / PWA — GOOD (notable strength)

- `app/sitemap.ts` — dynamic, includes all spot slugs, DB-guarded with `.catch`.  ✔
- `app/robots.ts` — disallows `/api/`, `/dashboard`, `/sessions`; references sitemap.  ✔
- `app/manifest.ts` — full PWA manifest, icons (any + maskable), theme color, categories.  ✔ (minor: `description` says "every California spot" while the app claims 1,490+ worldwide — copy drift).
- `app/layout.tsx` — proper `metadataBase`, OG + Twitter cards, Apple web-app meta, viewport/themeColor, Vercel Analytics + Speed Insights wired.  ✔
- Service worker (`public/sw.js`) + `InstallPrompt`/`PWAInit` present.  ✔

**`LOW`:** sitemap/robots/manifest rely on `NEXT_PUBLIC_SITE_URL`; if unset in prod they fall back to the `VERCEL_URL` preview host, which would publish preview URLs into the sitemap/canonical. Ensure `NEXT_PUBLIC_SITE_URL` is set in the Production environment (and ideally fail-fast if missing — ties to §5).

---

## Prioritized Pre-Launch Checklist

**CRITICAL (do before launch)**
1. Add a minimum test suite — Stripe webhook, rate limiter, forecast-degradation, auth guards, rating engine (Vitest). *(§2)*
2. Wire those tests + lint + `tsc` + `build` into a GitHub Actions CI gate on PRs. *(§6)*

**HIGH**
3. Add error tracking — `@sentry/nextjs` + `instrumentation.ts onRequestError`, report from both error boundaries. *(§1)*
4. Add `app/global-error.tsx`. *(§3)*
5. Commit a `.env.example` (only vars the code reads) + a fail-fast env-validation module. *(§5)*
6. Standardize API-route error handling (try/catch + `monitor()` + consistent 500) for all DB/external routes, esp. `spots`, `forecast/[slug]`, `alerts/[slug]`. *(§3)*
7. Add external uptime monitoring + alerting on `/api/health`; ensure `NEXT_PUBLIC_SITE_URL` is set in Production. *(§1, §8)*

**MEDIUM**
8. Pin Node via `engines` + `.nvmrc`. *(§4)*
9. Strengthen ESLint (`no-console`, `--max-warnings=0` in CI/lint). *(§4)*
10. Reconcile docs — rewrite the boilerplate `README.md`; fix `WAVEFINDER_PROJECT.md`/`deployment.md` drift (Resend/cron/email features and env lists). *(§7)*
11. Suppress raw `error.message` to users in production. *(§3)*

**LOW**
12. Add request IDs / latency to log payloads. *(§1)*
13. Fix manifest "California" copy + package name `surf-app`. *(§4, §8)*
14. Address documented backlog: email validation on alerts, webcam placeholder, sheltered-spot 0 ft UX. *(§7)*

---

## Known-Incomplete Items (from the project's own docs)

Summarized from `WAVEFINDER_PROJECT.md`'s "Known Issues / Remaining Work" section, plus doc-drift discovered during the audit:

1. **Email validation** — `/api/alerts` stores email with no format check; invalid emails fail silently.
2. **No rate limiting** on `/api/spots?withConditions=true` — triggers 13+ NOAA + N Open-Meteo calls per request. *(Partially mitigated by `proxy.ts`, but fan-out cost remains.)*
3. **Webcams** — no free public API; shows an OpenStreetMap embed as a placeholder.
4. **Marine model coverage** — Open-Meteo ~9 km resolution; very sheltered spots may show 0 ft (accurate, but looks like a bug).
5. **More spots** — Oregon, Washington, and the full East Coast not yet seeded.
6. **Session social** — `buddies` field in schema, but no sharing UI yet.
7. **Doc/code divergence (found in audit, not self-reported):** docs describe Resend email alerts, a `/api/cron/check-alerts` cron, and `saved-spots`/`sessions` API routes that are **not present** in the current codebase; `README.md` is still create-next-app boilerplate.

---

### Key files referenced
- Config/build: `package.json`, `vercel.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`
- Ops: `lib/monitoring.ts`, `app/api/health/route.ts`, `proxy.ts`, `scripts/smoke-prod.ts`, `docs/deployment.md`
- Error handling: `app/error.tsx` (no `app/global-error.tsx`), `app/not-found.tsx`, `app/loading.tsx`
- Billing/auth: `app/api/stripe/webhook/route.ts`, `app/api/billing/checkout/route.ts`, `lib/stripe.ts`, `lib/auth.ts`
- Degradation example (strength): `lib/api/open-meteo.ts`, `app/api/forecast/[slug]/route.ts`, `app/api/spots/route.ts`
- SEO/PWA: `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, `app/layout.tsx`
- Docs/drift: `README.md` (boilerplate), `WAVEFINDER_PROJECT.md` (stale)

**Confirmed absent:** any test files, `.github/workflows/`, `.env.example`, Sentry config, `app/global-error.tsx`, `engines` field, and the Resend/cron/email-alert implementation the docs describe.
