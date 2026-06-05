# WaveFinder — Security & Auth Audit (02-security)

**Date:** 2026-06-05
**Scope:** better-auth config, Stripe billing/webhooks, all `app/api/*` routes, `proxy.ts` rate limiter, `next.config.ts` CSP/headers, secrets handling, SSRF.
**Stack:** Next.js 16, better-auth (email+password) + Prisma/Postgres, Stripe, Upstash Redis.

> **Note on severities:** The single most important finding is that **there is no server-side paywall** — `hasProAccess()` is never called on any data route, so every "Pro" forecast/data endpoint is fully public. If the business model depends on the paywall, treat **SEC-01** as release-blocking.

---

## Executive summary (prioritized fix list)

| # | Severity | Finding | File |
|---|----------|---------|------|
| SEC-01 | CRITICAL | Paywall is not enforced server-side — free users can hit all "Pro" data via the API directly | all `app/api/*` data routes |
| SEC-02 | CRITICAL | Forged Stripe events can grant Pro via attacker-controlled `metadata.userId` | `app/api/stripe/webhook/route.ts:20-21` |
| SEC-03 | HIGH | Email verification not enforced; unverified/typo'd emails get accounts + Stripe trials | `lib/auth.ts:11-13`, schema |
| SEC-04 | HIGH | No auth-endpoint rate limiting — credential stuffing / brute force on sign-in | `proxy.ts`, `lib/auth.ts` |
| SEC-05 | HIGH | Rate limiter trivially bypassed by spoofing `x-forwarded-for` | `proxy.ts:43-49` |
| SEC-06 | HIGH | `trustedOrigins` not configured in better-auth (CSRF / cross-origin) | `lib/auth.ts` |
| SEC-07 | MEDIUM | No `BETTER_AUTH_SECRET` presence/length validation — silent weak-secret boot | `lib/auth.ts:7` |
| SEC-08 | MEDIUM | Webhook has no idempotency / event-replay protection | `app/api/stripe/webhook/route.ts` |
| SEC-09 | MEDIUM | Open redirect via `?next=` on sign-in | `app/sign-in/page.tsx:28` |
| SEC-10 | MEDIUM | CSP uses `script-src 'unsafe-inline'` — defeats XSS protection | `next.config.ts:16` |
| SEC-11 | MEDIUM | Cookie/session security not explicitly configured (secure, sameSite) | `lib/auth.ts` |
| SEC-12 | LOW | No explicit password policy beyond client `minLength=8` | `lib/auth.ts:11-13`, `app/sign-up/page.tsx:38` |
| SEC-13 | LOW | Rate limiter is per-`(ip+path)`, fail-open, in-memory fallback is per-instance | `proxy.ts` |
| SEC-14 | LOW | Limited SSRF surface via station IDs fed back into WQP result query | `app/api/water-quality/[slug]/route.ts:122` |
| SEC-15 | LOW | `debug/conditions` route gated only by env flag; ensure off in prod | `app/api/debug/conditions/route.ts:10` |
| SEC-16 | INFO | Secrets handling is clean — no committed `.env`, no hardcoded keys | repo-wide |

---

## CRITICAL

### SEC-01 — Paywall not enforced server-side (free users can access all Pro data)
**Severity:** CRITICAL
**Files:** `app/api/forecast/[slug]/route.ts`, `app/api/best-spots/route.ts`, `app/api/surf-reports/[spotSlug]/route.ts`, `app/api/alerts/[slug]/route.ts`, `app/api/water-quality/[slug]/route.ts`, `app/api/webcams/[slug]/route.ts`, `app/api/spots/route.ts` — every data route.

**Vulnerability:** `hasProAccess()` (`lib/entitlements.ts:9`) and `requireUser()` (`lib/session.ts:10`) are imported only by `app/api/account/route.ts`, `billing/checkout`, and `billing/portal`. **No data route calls either one.** Every forecast/best-spots/surf-report/alerts/water-quality/webcam endpoint runs `prisma.surfSpot.findUnique(...)` and returns full data with zero auth and zero entitlement check. The only "Pro" enforcement is cosmetic (the dashboard reads `/api/account` and shows a plan badge). A free or anonymous user can `curl /api/forecast/<slug>` or `/api/best-spots?region=...&date=...` and get the complete paid dataset.

**Fix:** Add a server-side gate to every Pro-only route. Centralize it:
```ts
// lib/entitlements.ts
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'

export async function requireProAccess() {
  const session = await getServerSession()
  if (!session?.user) return { ok: false, status: 401 as const }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeSubscriptionStatus: true, stripeCurrentPeriodEnd: true, stripeTrialEndsAt: true },
  })
  return hasProAccess(user) ? { ok: true as const, user } : { ok: false, status: 403 as const }
}
```
Then at the top of each gated route:
```ts
const gate = await requireProAccess()
if (!gate.ok) return NextResponse.json({ error: 'Pro required' }, { status: gate.status })
```
Decide explicitly which routes are free (e.g. `spots` list, basic `forecast`) vs Pro (e.g. `best-spots`, `surf-reports`, `water-quality`, `webcams`) and document it. Note these routes use `revalidate`/`s-maxage` shared CDN caching — gated responses must set `Cache-Control: private, no-store` (or move the gate ahead of cache) so a paid response is never served to an anonymous user from the edge cache.

---

### SEC-02 — Forged Stripe event can grant Pro to any user via `metadata.userId`
**Severity:** CRITICAL (conditional on SEC sig handling — see below)
**File:** `app/api/stripe/webhook/route.ts:20-21`, `:46-50`

**Signature handling is correct:** the route reads the raw body with `await req.text()` (not parsed JSON) and passes it to `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`, returns 400 on failure, and refuses to run if `STRIPE_WEBHOOK_SECRET` is unset (`:37-39`). Good.

**The vulnerability is in the trust model after verification.** `syncSubscription` derives the target user from `subscription.metadata.userId` and writes an arbitrary subscription status onto that row:
```ts
const userId = subscription.metadata.userId
const where = userId ? { id: userId } : { stripeCustomerId: customerId }
await prisma.user.update({ where, data: { stripeSubscriptionStatus: subscription.status, ... }})
```
`metadata` is attacker-influenceable in several flows. Because checkout sets `client_reference_id` and `subscription_data.metadata.userId` from the *session* user, the legitimate path is fine — but the webhook will honor **any** subscription whose `metadata.userId` points at a victim. A user who can create their own Stripe subscription object with `metadata.userId=<victim>` (or whose own legitimately-signed `active` subscription is replayed/retargeted) can flip another account's entitlement. More importantly, the entitlement is written purely from `subscription.status` with no verification that the subscription's `customer` actually matches the WaveFinder user's `stripeCustomerId`.

**Fix:**
1. Resolve the user by **`stripeCustomerId` as the source of truth**, and only *fall back* to `metadata.userId` after confirming `customerId` belongs to no other user. Better: look up the user by `stripeCustomerId`; if found, ignore `metadata.userId`. Reject (log + 200) if the customer maps to a different user than the metadata claims.
2. Validate the price ID against `STRIPE_PRO_MONTHLY_PRICE_ID` before granting Pro, so an unrelated/cheaper subscription can't unlock Pro.
3. Keep `metadata.userId` only for the first-time `checkout.session.completed` linkage, then rely on `stripeCustomerId`.

---

## HIGH

### SEC-03 — Email verification not enforced
**Severity:** HIGH
**File:** `lib/auth.ts:11-13`; `prisma/schema.prisma` (`emailVerified` defaults `false`)

**Vulnerability:** `emailAndPassword: { enabled: true }` with no `requireEmailVerification: true` and no `emailVerification` sender configured. Users sign up with any email (including typos or someone else's address), immediately land on `/pricing`, and can start a Stripe trial. There is no verification email flow, and nothing checks `emailVerified` before granting access. This enables account takeover-by-typo, trial abuse, and spam signups.

**Fix:** Configure email verification and enforce it:
```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  minPasswordLength: 10,
},
emailVerification: {
  sendOnSignUp: true,
  sendVerificationEmail: async ({ user, url }) => { /* Resend (RESEND_API_KEY already planned) */ },
},
```
Gate billing/checkout on `session.user.emailVerified === true`.

### SEC-04 — No rate limiting on auth endpoints (brute force / credential stuffing)
**Severity:** HIGH
**Files:** `proxy.ts:6-16` (no `/api/auth` pattern), `lib/auth.ts` (no `rateLimit` block)

**Vulnerability:** `proxy.ts` rate-limits `/api/spots`, `/api/forecast`, etc., but has **no rule for `/api/auth/*`**, so sign-in/sign-up fall through to `DEFAULT_LIMIT = 80/min` — far too high to stop password brute force or credential stuffing, and per-IP only (easily distributed). better-auth's own rate limiter is also not enabled.

**Fix:** Add a strict pattern in `proxy.ts` (e.g. `{ pattern: /^\/api\/auth\//, limit: 10 }`), and enable better-auth's built-in limiter scoped to sensitive paths:
```ts
rateLimit: { enabled: true, window: 60, max: 10, storage: 'database' },
```
Apply tighter limits specifically to sign-in/sign-up/forgot-password. Combine with SEC-05 so the limit can't be bypassed via header spoofing.

### SEC-05 — Rate limiter bypass via `x-forwarded-for` spoofing
**Severity:** HIGH
**File:** `proxy.ts:43-49`

**Vulnerability:** `rateLimitKey` trusts the first value of the client-supplied `x-forwarded-for` header (then `x-real-ip`). An attacker rotates `X-Forwarded-For: <random>` on every request and each one is a fresh bucket — the limiter is fully defeated. On Vercel the trustworthy client IP is the platform-injected value; arbitrary upstream `x-forwarded-for` is attacker-controlled.

**Fix:** On Vercel use the trusted edge IP. In middleware/proxy use `request.ip` (when available) or the right-most XFF entry that the platform appends, not the left-most. Prefer Vercel's `x-vercel-forwarded-for` / the platform-provided geo-IP. Do **not** derive identity from the client-supplied left-most XFF. Better still, gate auth attempts by account/email as well as IP.

### SEC-06 — `trustedOrigins` not configured
**Severity:** HIGH
**File:** `lib/auth.ts`

**Vulnerability:** No `trustedOrigins` set. better-auth uses this to validate Origin on state-changing requests and to scope cookies/redirects. Without it, cross-origin requests and callback/redirect origins are not constrained, weakening CSRF protection for the auth endpoints.

**Fix:**
```ts
trustedOrigins: [process.env.BETTER_AUTH_URL!, 'https://<your-prod-domain>'],
```
Set `BETTER_AUTH_URL` to the canonical HTTPS production origin (it is read at `lib/auth.ts:6`).

---

## MEDIUM

### SEC-07 — No `BETTER_AUTH_SECRET` validation
**Severity:** MEDIUM
**File:** `lib/auth.ts:7`

**Vulnerability:** `secret: process.env.BETTER_AUTH_SECRET` with no presence/length check. If the env var is missing or short in production, better-auth may fall back to a dev default or a weak key, and session tokens become forgeable. The app boots silently either way.

**Fix:** Fail fast:
```ts
const secret = process.env.BETTER_AUTH_SECRET
if (!secret || secret.length < 32) throw new Error('BETTER_AUTH_SECRET missing or too short')
```
Ensure a 64-char random value is set in Vercel prod env.

### SEC-08 — No webhook idempotency / replay protection
**Severity:** MEDIUM
**File:** `app/api/stripe/webhook/route.ts`

**Vulnerability:** Each delivery re-runs `syncSubscription` with no dedupe on `event.id`. Stripe legitimately retries and may deliver out of order; a captured-but-valid event body+signature can also be replayed within the tolerance window. Out-of-order delivery (e.g. `deleted` arriving before a later `updated`) can leave a stale `active` status.

**Fix:** Record processed `event.id` (unique row / Redis `SETNX` with TTL) and no-op duplicates. Guard ordering by comparing the incoming subscription's `current_period_end`/`status` timestamp against what's stored, or always re-`retrieve` the subscription from Stripe (source of truth) rather than trusting the event payload's freshness.

### SEC-09 — Open redirect via `?next=`
**Severity:** MEDIUM
**File:** `app/sign-in/page.tsx:28`

**Vulnerability:** `router.push(searchParams.get('next') ?? '/dashboard')` pushes an unvalidated `next` value. A crafted link `…/sign-in?next=https://evil.example` can redirect a just-authenticated user off-site (phishing). Next's client router will follow absolute URLs.

**Fix:** Allow only same-origin relative paths:
```ts
const next = searchParams.get('next') ?? '/dashboard'
router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard')
```

### SEC-10 — CSP `script-src 'unsafe-inline'`
**Severity:** MEDIUM
**File:** `next.config.ts:16`

**Vulnerability:** `script-src 'self' 'unsafe-inline'` allows any inline `<script>`, which neutralizes CSP as an XSS mitigation — an injected inline script executes freely. (`unsafe-eval` was correctly removed; `object-src 'none'` and `base-uri 'self'` are good.) The comment cites Next.js hydration; Next supports a nonce-based strict CSP instead.

**Fix:** Move to a per-request nonce. Generate a nonce in `proxy.ts`/middleware, inject it into the CSP header (`script-src 'self' 'nonce-<value>' 'strict-dynamic'`) and pass it to Next so framework scripts carry it. If a nonce is infeasible short-term, at minimum document the residual XSS risk and ensure all user-influenced output is escaped. Note `style-src 'unsafe-inline'` is lower-risk but ideally also tightened (Leaflet/inline styles).

### SEC-11 — Session/cookie security not explicitly set
**Severity:** MEDIUM
**File:** `lib/auth.ts`

**Vulnerability:** No explicit `advanced.cookies` / `useSecureCookies` / session config. better-auth defaults are generally sane (httpOnly, sameSite=lax, secure in prod), but defaults aren't pinned here, and `secure` depends on better-auth correctly detecting HTTPS via `BETTER_AUTH_URL`/baseURL. If `BETTER_AUTH_URL` is left as the `http://localhost` value from the project doc, cookies may not be marked `Secure`.

**Fix:** Pin it explicitly and set a sane session lifetime:
```ts
advanced: { useSecureCookies: true, defaultCookieAttributes: { sameSite: 'lax', secure: true, httpOnly: true } },
session: { expiresIn: 60*60*24*7, updateAge: 60*60*24 },
```
Verify `BETTER_AUTH_URL` is the HTTPS prod origin.

---

## LOW

### SEC-12 — Weak/implicit password policy
**Severity:** LOW
**Files:** `lib/auth.ts:11-13`, `app/sign-up/page.tsx:38`

**Vulnerability:** Only client-side `minLength={8}` on the sign-up input; no server-side minimum, so a scripted signup can set a 1-char password. better-auth default min is low.

**Fix:** Set `emailAndPassword.minPasswordLength` (10+) server-side; optionally check against a breached-password list. (Folded into SEC-03's config block.)

### SEC-13 — Rate limiter design caveats (fail-open, per-instance fallback, per-path keying)
**Severity:** LOW
**File:** `proxy.ts:66-89`

**Observations:** (1) `checkRedisLimit(...).catch(() => null) ?? checkMemoryLimit(key)` is **fail-open** to in-memory on any Redis error — acceptable, but a Redis outage degrades to per-serverless-instance counters that don't share state, so effective limits multiply by instance count. (2) Keying on `ip:pathname` means each slug is its own bucket, so a single IP can hit `/api/forecast/<slug-1..N>` at `limit` each — total throughput is `limit × number-of-slugs`. (3) In-memory `Map` doesn't survive across instances or cold starts.

**Fix:** Prefer Redis as primary with fixed/sliding window; consider keying auth and expensive routes by route-group (not full path) so per-slug fan-out can't multiply the budget; alert on Redis fallback. Acceptable for launch but document the limits.

### SEC-14 — Limited SSRF reflection in water-quality flow
**Severity:** LOW
**File:** `app/api/water-quality/[slug]/route.ts:90-122`

**Vulnerability:** All outbound fetches target fixed hosts (`waterqualitydata.us`, `ndbc.noaa.gov`, `open-meteo.com`, `googleapis.com`) with coordinates pulled from the DB by validated slug — **not** user-supplied URLs, so classic SSRF is not present. The one reflective spot: station identifiers parsed from the first WQP CSV response are interpolated into the second WQP query (`siteid=...`). They are constrained by `/^[\w:.-]{1,60}$/` and `encodeURIComponent`, and the host is fixed, so this is low risk (response-data injection into a same-host query at worst).

**Fix:** Keep the regex + `encodeURIComponent` (already present). Maintain an allowlist of outbound hosts. No URL parameter should ever be taken from the request; current design is sound — just don't regress it.

### SEC-15 — Debug route gated only by env flag
**Severity:** LOW
**File:** `app/api/debug/conditions/route.ts:10`

**Vulnerability:** `/api/debug/conditions` returns 404 unless `ENABLE_DEBUG_API === 'true'`. Safe as long as that flag is never set in prod, but it's an easy footgun and the route is `force-dynamic` and unauthenticated when enabled.

**Fix:** Confirm `ENABLE_DEBUG_API` is unset in Vercel prod; consider additionally requiring an authenticated admin session. Low coordinate-only data exposure even if enabled.

---

## INFO / Positive findings

### SEC-16 — Secrets handling is clean
- **No `.env*` files are tracked** in git (`git ls-files` shows none; `.gitignore:34` ignores `.env*`). No `.env` in history.
- **No hardcoded secrets** in source — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET`, `YOUTUBE_API_KEY`, `WINDY_WEBCAM_API_KEY`, Upstash tokens are all read from `process.env`.
- `WAVEFINDER_PROJECT.md` shows env **placeholders only** (`<password>`, `re_...`, `<64-char random string>`), no live values.
- **`lib/monitoring.ts` is reasonable** but note it spreads arbitrary `data` into JSON logs (`monitor(level, event, {...})`). Callers currently log only `userId`/`customerId`/error messages — safe — but enforce a rule that secrets, tokens, full Stripe objects, and PII are never passed to `monitor()`.
- **No secret is exposed via `NEXT_PUBLIC_`** — only `NEXT_PUBLIC_SITE_URL`/`APP_URL`/`BASE_URL` (non-sensitive) are used (`lib/stripe.ts:11-13`).

### Other positives
- Stripe webhook verifies the signature against the **raw** body (`req.text()`), refuses to run without `STRIPE_WEBHOOK_SECRET`, and `force-dynamic` prevents body caching. (Core signature handling is correct — the issue is post-verification trust, SEC-02.)
- Slug params are validated with `/^[a-z0-9-]{1,120}$/` before DB lookup on every dynamic route; `spots` search strips SQL `LIKE` wildcards and validates IDs. Prisma parameterizes queries — no SQL injection observed.
- Good baseline security headers: HSTS w/ preload, `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `object-src 'none'`, `base-uri 'self'`, scoped `Permissions-Policy`.
- Billing checkout/portal correctly require a session and resolve the customer from the authenticated user (`session.user.id`), not from the request body.

---

## Recommended remediation order
1. **SEC-01** — add server-side Pro gating to data routes (+ `Cache-Control: private` on gated responses). *Release blocker if paywall matters.*
2. **SEC-02** — harden webhook to trust `stripeCustomerId` + validate price ID; stop trusting `metadata.userId` for entitlement.
3. **SEC-03 / SEC-04 / SEC-05 / SEC-06** — email verification, auth rate limiting, fix IP derivation, set `trustedOrigins`.
4. **SEC-07 / SEC-08 / SEC-09 / SEC-10 / SEC-11** — secret validation, webhook idempotency, redirect allowlist, CSP nonce, pin cookie/session security.
5. **SEC-12 / SEC-13 / SEC-15** — password policy, rate-limiter hardening, confirm debug flag off in prod.
