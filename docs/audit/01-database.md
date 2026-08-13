# WaveFinder — Database & Data Layer Production Readiness Audit

**Stack confirmed:** Next.js 16.2.4, Prisma `^5.22.0` (client + CLI), PostgreSQL on **Neon** (per `WAVEFINDER_PROJECT.md:40` and project notes), `better-auth ^1.6.9` via `prismaAdapter`, deployed to Vercel serverless. Rate limiting via Upstash Redis in `proxy.ts`. External weather/marine data from Open-Meteo + NOAA (not in DB).

---

## 1. CONNECTION POOLING — **CRITICAL**

**Finding (CRITICAL):** `lib/prisma.ts:9` instantiates a plain `new PrismaClient()` bound to `DATABASE_URL`, and the documented `DATABASE_URL` is a **direct, unpooled** Neon string: `postgresql://neondb_owner:...@<host>/neondb?sslmode=require` (`WAVEFINDER_PROJECT.md:40`, `docs/deployment.md:16`). There is **no** `-pooler` host, **no** `?pgbouncer=true`, **no** `connection_limit`, **no** `DIRECT_URL`, **no** Prisma Accelerate, and **no** driver adapter (`@prisma/adapter-neon` / `@neondatabase/serverless` are absent from `package.json`).

**Why it's critical:** Each Vercel serverless invocation (and each concurrent lambda) opens its own pool of raw Postgres TCP connections. Prisma defaults to `num_cpus*2+1` connections **per instance**. Under even modest concurrency the app will exhaust Postgres' `max_connections` and throw `Can't reach database server` / `too many connections`. This is the single biggest production risk. Every route on the hot path hits the DB (see §2), so this fails fast under load.

**Exact fix (Neon, recommended — minimal change):**
1. In Neon, use the **pooled** connection string (host contains `-pooler`, e.g. `ep-xxx-pooler.region.aws.neon.tech`) and append `?sslmode=require&pgbouncer=true&connection_limit=1`. Set that as `DATABASE_URL` on Vercel.
2. Add a `DIRECT_URL` (the **non**-pooler host) for migrations, and wire it in `schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // pooled, pgbouncer=true
  directUrl = env("DIRECT_URL")        // direct, for migrate/db push
}
```
   `connection_limit=1` is the correct setting for serverless-through-PgBouncer: each lambda holds one transaction-pooled connection.

**Alternative (best raw latency, more change):** Install `@prisma/adapter-neon` + `@neondatabase/serverless` and pass the adapter to `PrismaClient` (`driverAdapters` preview feature). This uses Neon's HTTP/WebSocket driver and removes TCP pool exhaustion entirely. Slightly more code; ideal if you stay on Neon. Prisma Accelerate is a third option (adds external pooler + caching) but costs money and adds a hop.

---

## 2. Spots: served from DB, but the DB is pure static seed data — **HIGH (architecture)**

**Finding (HIGH):** All surf-spot content is **static TypeScript** — `lib/spots-data.ts` (212 inline California spots) plus 10 region files under `lib/spots/*` (1,278 more), ~**1,490 immutable spots total**. `prisma/seed.ts` upserts that exact array into the `SurfSpot` table. Then **every read goes back through Prisma over the network**:
- `app/api/spots/route.ts:30` — `findMany` (the home-map hot path)
- `app/api/spots/[slug]/route.ts:12`, `forecast/[slug]:19`, `alerts/[slug]:17`, `webcams/[slug]:19`, `water-quality/[slug]:72`, `surf-reports/[spotSlug]:77` — `findUnique` per spot
- `app/api/best-spots/route.ts:79`, `spots/meta/route.ts:13,23`
- `app/sitemap.ts:10`, `app/page.tsx:6` (`count`), `app/spots/[slug]/page.tsx:42,58,65`

**The DB is on the read hot path for data that never changes at runtime.** The only fields read from `SurfSpot` (slug, name, region, country, lat, lng, facingDirection, noaaTideStationId, noaaBuoyId, description) are 100% present in the static source. The DB round-trip adds latency and is the thing that breaks under the §1 pooling bug — for zero benefit.

**What actually needs a DB:** only **user/auth/billing** state — `User`, `Session`, `Account`, `Verification` (better-auth) and the Stripe columns. Those are genuinely dynamic and must stay in Postgres.

**Concrete fix (biggest perf win):** Serve spots from the static module instead of Prisma. The static array is already imported app-wide (`SURF_SPOTS_SEED`). Build O(1) lookup maps once at module load:
```ts
// lib/spots-source.ts
export const SPOTS = SURF_SPOTS_SEED
export const SPOT_BY_SLUG = new Map(SPOTS.map(s => [s.slug, s]))
```
Replace `prisma.surfSpot.findUnique({where:{slug}})` with `SPOT_BY_SLUG.get(slug)` and `findMany` with in-memory filter. This removes ~9 DB round-trips from the hot path, makes spot routes serverless-cold-start-cheap, and means a Postgres outage no longer takes down spot/forecast pages (only login/billing). The `SurfSpot` table, `seed.ts`, and the `id`-based `?ids=` query param can then be retired. **If you keep the DB for spots**, at minimum fix §1 first and add the indexes in §3.

---

## 3. Schema Review — `prisma/schema.prisma`

**MEDIUM — `SurfSpot` has no index on `country`, and `region`/`name` filters can't use the indexes that exist.**
- `spots/meta/route.ts:13` filters `where:{country}` and `best-spots/route.ts:80` filters `region: {contains, mode:'insensitive'}`; `spots/route.ts:34-38` does `contains/insensitive` on name/region/country. `schema.prisma:29-30` only indexes `region` and `difficulty`. A `contains`/`insensitive` (`ILIKE %x%`) query **cannot use a normal B-tree index** anyway — these are sequential scans. At ~1,490 rows that's tolerable but not free on every map load. **Fix:** if spots stay in the DB, add `@@index([country])` for the exact-match meta query, and for substring search add a `pg_trgm` GIN index (raw SQL migration) on `name`/`region`. (Eliminated entirely if you adopt §2.)

**LOW — `Session.token` lookup is fine.** `schema.prisma:65` has `@@unique([token])`, which creates a unique index — better-auth's per-request session lookup by token is indexed. Good. `Session.userId` (`:66`) and `Account.userId` (`:86`) are indexed. Good.

**LOW — Stripe columns adequately indexed.** `stripeCustomerId` and `stripeSubscriptionId` are `@unique` (`:41-42`) → indexed; the webhook's `where:{stripeCustomerId}` fallback (`webhook/route.ts:21`) hits that index. `stripeSubscriptionStatus` is unindexed but only ever read for the already-fetched current user, so no index needed.

**MEDIUM — `User.email` is `@unique` but not case-folded / not citext.** `schema.prisma:50` enforces uniqueness on the raw string. better-auth lower-cases emails itself, so this is usually fine, but if any path inserts a mixed-case email you can get duplicate accounts. Acceptable; note for awareness.

**LOW — `User.id`/`Session.id`/`Account.id` are `String @id` with no `@default`.** That's correct — better-auth generates the IDs. Don't add `@default(cuid())` here or you'll desync from better-auth.

**MEDIUM — `Verification` has no cleanup / TTL and `expiresAt` is unindexed.** `schema.prisma:90-99`. Expired verification/session rows accumulate forever. **Fix:** add a scheduled job (Vercel Cron) to `deleteMany({where:{expiresAt:{lt:now}}})` on `Verification` and `Session`, or rely on better-auth's session cleanup if enabled.

**LOW — `parkingOptions Json?` and `activities String[]`** (`:25-26`) are fine as-is; they're read-only and never queried by content.

---

## 4. N+1 / pagination / SELECT * — mostly clean, a few items

**LOW — No N+1 loops.** No Prisma calls inside `.map`/`for` over query results. `spots/route.ts` loops over spots only to call the **external** Open-Meteo API (batched, bucketed by 0.1° lat/lng, `:82-91`) — that's well-designed, not a DB N+1.

**MEDIUM — `SELECT *` (implicit) on the main spots list.** `spots/route.ts:30` `findMany` with no `select` (unless `?slim=true`) returns all columns including the large `description` and `parkingOptions` Json for up to ~1,490 rows. The route mitigates payload size with `?slim=true` (`:44-49`) but the **default** call still pulls everything. `forecast/[slug]:19`, `surf-reports:77`, `spots/[slug]:12` also `findUnique` with no `select` (fetch all columns when they need ~6). **Fix:** add explicit `select` to every spot query to cut row width (or moot via §2).

**MEDIUM — No pagination / no `take` on the list endpoints.** `spots/route.ts:30` and `spots/meta` return the **entire** matching set unbounded. With ~1,490 spots and growth, the non-slim `/api/spots` response is large (the code comments note ~500 KB). Add `take`/cursor pagination, or keep relying on `slim` + client clustering. `best-spots/route.ts:79` is bounded by region (fine). `spots/[slug]/page.tsx:65` correctly uses `take: 8`.

**LOW — `spots/[slug]/page.tsx:42` + `:58` query the same spot twice** (once in `generateMetadata`, once in the page). Next dedupes identical Prisma calls within a request only if wrapped in React `cache()`; here they're separate awaits → 2 round-trips per spot page render. **Fix:** wrap the spot fetch in `react`'s `cache()` (or move to the static map per §2).

---

## 5. Migrations — `prisma db push`, no migration history — **HIGH**

**Finding (HIGH):** `package.json:10` `"db:push": "prisma db push"`, `:13` `"db:reset": "prisma db push --force-reset && ... seed"`. There is **no `prisma/migrations/` directory and no migration history**. `vercel.json:2` build command is `prisma generate && next build` — it does **not** run migrations at deploy.

**Why it's a problem for prod:** `db push` introspects and force-syncs the schema with no versioned, reviewable, reversible history. It's fine for prototyping but in production it can silently drop columns/data on a diff it considers destructive, and you have no audit trail or rollback. `--force-reset` (in `db:reset`) **wipes the entire database** — dangerous to have a step away from prod. Because schema changes aren't applied at deploy, a schema change requires a manual out-of-band `db push` against prod, which is error-prone.

**Concrete fix:**
1. Adopt migrations: `prisma migrate dev --name init` locally to baseline the current schema into `prisma/migrations/`.
2. For an existing prod DB, **baseline** it: `prisma migrate resolve --applied <init_migration>` so Prisma marks the current state as already applied (no data loss).
3. Deploy migrations in CI/build: change `vercel.json` build to `prisma generate && prisma migrate deploy && next build` (uses `DIRECT_URL`). `migrate deploy` is the safe, forward-only production command.
4. Keep `db:reset` for local only; never expose it to prod env.

---

## 6. DATABASE RECOMMENDATION — **Stay on Neon. Do not move to Supabase.**

**Recommendation: Keep Neon + better-auth. Fix the pooling (§1) and migrations (§5).** This is the decisive, lower-risk, lower-cost path.

**Why Neon wins here:**
- **Auth/logins already live in your DB.** The user's stated goal — "a better DB that also stores logins/auth" — is **already satisfied**. better-auth persists `User`/`Session`/`Account`/`Verification` directly in Postgres via `prismaAdapter` (`lib/auth.ts:8`). Neon *is* Postgres, so logins are stored in the DB today. There is no missing capability that Supabase would add.
- **Vercel-native + serverless pooling.** Neon has a built-in PgBouncer pooler endpoint and a serverless HTTP/WS driver designed exactly for Vercel lambdas. Your §1 fix is a connection-string change (or adapter swap) — **no application rewrite**.
- **Migration cost of switching is high and the payoff is zero.** Moving to Supabase means: migrate the Postgres data, re-point `DATABASE_URL`, re-test better-auth, and re-do RLS/security posture. You'd gain Supabase Storage/Realtime/Edge Functions you don't use.

**The Supabase Auth trap (the key consideration):** Supabase's headline feature is **Supabase Auth (GoTrue)** — a *separate* auth system that stores users in the `auth.users` schema and issues its own JWTs. You currently use **better-auth**, which is incompatible with Supabase Auth. So on Supabase you'd either:
- **(a)** keep better-auth and use Supabase *only as a Postgres host* — in which case Supabase's main differentiator is wasted and you've taken on a migration for nothing; **or**
- **(b)** rip out better-auth and adopt Supabase Auth — a real auth rewrite (sign-in/up flows, session handling, the Stripe-column linkage on `User`, all of `lib/auth.ts`/`lib/session.ts`/`app/api/auth/[...all]`), plus rewiring RLS. High effort, high regression risk, no user-facing benefit.

Both Supabase paths are worse than staying put. Supabase's transaction pooler (Supavisor) also defaults to port 6543 and has its own prepared-statement caveats with Prisma — you'd be solving the *same* pooling problem you have on Neon, just with extra migration work.

**Tradeoff summary:**

| | **Neon (recommended)** | **Supabase** |
|---|---|---|
| Auth in DB | ✅ already (better-auth in Postgres) | ✅ but pushes you toward replacing better-auth |
| Keep better-auth | ✅ no change | ⚠️ works only if you ignore Supabase Auth |
| Serverless pooling | ✅ pooler endpoint + serverless driver | ✅ Supavisor pooler (similar Prisma caveats) |
| Vercel integration | ✅ first-class | ✅ good |
| Migration cost now | **~0** (connection string + migrations baseline) | **High** (data move + auth re-test or rewrite) |
| Extra features you'd use | n/a | Storage/Realtime/RLS — **none needed** here |

**Bottom line:** The user's "better DB that stores auth" desire is met by the current Neon + better-auth setup. The app's real problems are operational (no pooling, `db push` instead of migrations, DB on the static-data hot path), not the database vendor. Switching to Supabase would add migration risk while solving none of those. **Recommendation: stay on Neon, apply fixes §1, §2, §5.**

---

## Priority-ordered fix list

1. **CRITICAL §1** — Switch `DATABASE_URL` to Neon's pooled endpoint (`pgbouncer=true&connection_limit=1`), add `DIRECT_URL` + `directUrl` in schema. (Blocks production.)
2. **HIGH §5** — Adopt `prisma migrate` (baseline existing prod), add `prisma migrate deploy` to `vercel.json` build.
3. **HIGH §2** — Serve the ~1,490 immutable spots from the static module via in-memory maps; reserve Postgres for auth/billing only. (Biggest latency + resilience win.)
4. **MEDIUM §3/§4** — If spots stay in DB: add `@@index([country])` + pg_trgm GIN for search; add explicit `select`/`take`; wrap spot-page fetch in `cache()`. Add cron cleanup for expired `Session`/`Verification`.
5. **Decision §6** — **Stay on Neon + better-auth.**

**Key files:** `lib/prisma.ts:9`, `prisma/schema.prisma:7,29-30,65,90-99`, `prisma/seed.ts`, `lib/spots-data.ts` + `lib/spots/*` (~1,490 static spots), `app/api/spots/route.ts:30`, `app/api/spots/[slug]/route.ts:12`, `app/api/forecast/[slug]/route.ts:19`, `app/spots/[slug]/page.tsx:42,58,65`, `app/sitemap.ts:10`, `app/page.tsx:6`, `lib/auth.ts:8`, `package.json:10-13`, `vercel.json:2`, `WAVEFINDER_PROJECT.md:40`, `docs/deployment.md:16`.
