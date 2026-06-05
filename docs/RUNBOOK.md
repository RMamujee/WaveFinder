# WaveFinder — Production Cutover Runbook

This runbook lists the **manual steps a human must perform** to take WaveFinder
to production. These steps are **deliberately not automated** — they involve
production secrets, the production database, and external dashboards, and should
be done intentionally by an operator.

Work through them in order. Each step is independent unless noted.

---

## 1. Database connection strings (Neon)

In the Vercel project's **Production** environment:

- **`DATABASE_URL`** → the Neon **pooled** (PgBouncer) endpoint, with the query
  string:

  ```
  ?sslmode=require&pgbouncer=true&connection_limit=1
  ```

  The pooled endpoint host typically contains `-pooler`. `connection_limit=1`
  is important for serverless functions sharing a PgBouncer pool.

- **`DIRECT_URL`** → the Neon **direct** (non-pooler) host. Prisma uses this for
  schema operations (`db push` / `migrate`). Do **not** point `DIRECT_URL` at
  the pooler.

> Both values use the same database/credentials — only the host (and the
> pooler query params) differ.

---

## 2. Apply the schema indexes

The Prisma schema includes the indexes the app relies on. Apply them to the
production database from a machine that has `DIRECT_URL` set:

```bash
npx prisma db push
```

If/when you adopt a migration history instead of `db push`, use:

```bash
npx prisma migrate deploy
```

Run `npx prisma generate` first if the client is stale.

---

## 3. Required production secrets

Confirm these are set in the Vercel **Production** environment:

- **`BETTER_AUTH_SECRET`** — a **64-character random** string. The app refuses
  to start in production if this is missing or shorter than 32 characters. Do
  not reuse the dev value. Generate one with, e.g.:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

- **`STRIPE_PRO_MONTHLY_PRICE_ID`** — the live Stripe price ID for the Pro
  monthly plan. Without it, checkout for the Pro plan cannot be created.

- **`NEXT_PUBLIC_SITE_URL`** — the canonical production URL
  (e.g. `https://wavefinder.app`). Used for metadata, sitemap, robots, auth
  trusted origins, and Stripe redirect URLs.

Also confirm `BETTER_AUTH_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` are present (see
`.env.example` for the complete list).

---

## 4. (Optional) Email verification via Resend

Email verification is wired up but disabled by default so signups work without
an email provider.

To enable it:

1. Set **`RESEND_API_KEY`** in Production (and optionally `RESEND_FROM`).
2. In `lib/auth.ts`, set `requireEmailVerification: true` under the
   `emailVerification` config, then redeploy.

If `RESEND_API_KEY` is unset, the verification URL is only logged via the
monitor (no email is sent), so do **not** require verification until the key is
configured.

---

## 5. (Optional) Error monitoring via Sentry

Set **`SENTRY_DSN`** (and **`NEXT_PUBLIC_SENTRY_DSN`** for client-side errors)
in Production to enable Sentry reporting. The app runs fine without them.

---

## 6. Uptime monitoring

Point an external uptime monitor at:

```
GET /api/health
```

It returns `200 { status: "ok", db: "connected" }` when the database is
reachable, and `503 { status: "error", db: "unreachable" }` otherwise — so it
doubles as a database connectivity check.

---

## Post-cutover sanity check

- Hit `/api/health` and confirm `200`.
- Sign up / log in to confirm auth works against the production secret.
- Run a test Stripe checkout (test/live mode as appropriate) and confirm the
  webhook at `/api/stripe/webhook` receives events.
