# WaveFinder — Full Project Reference

> Send this file at the start of a new Claude Code session to get full context.

---

> ## ⚠️ Accuracy notice
>
> This document is the current source of truth for WaveFinder's architecture and
> feature set. All claims are grounded in the actual codebase. See `CLAUDE.md`
> and `docs/audit/` for current issues and implementation status.

---

## App Summary

**WaveFinder** is a free Surfline-style surf forecast web app. Uses 100% free government data (NOAA NDBC buoys, NOAA CO-OPS tides, Open-Meteo marine forecasts). Built with Next.js 16 App Router, TypeScript, Tailwind CSS v4, Prisma v5 + **Neon PostgreSQL**, better-auth, TanStack Query, Leaflet maps (with clustering), and Recharts.

**GitHub:** https://github.com/RMamujee/WaveFinder
**Running locally:** `npm run dev` → http://localhost:3000
**Database:** Neon PostgreSQL (see env vars below)
**Seed spots:** `npx prisma db seed` (134+ California + world spots)

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.7 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Auth | better-auth | ^1.6.11 |
| ORM | Prisma | ^5.22.0 |
| DB | **Neon PostgreSQL** | (provider: postgresql) |
| State | TanStack Query | v5 |
| Maps | Leaflet + MarkerCluster | ^1.9.4 |
| Charts | Recharts | ^3.8.1 |
| Payments | Stripe | ^22.1.0 |
| Rate limiting | Upstash Redis | ^1.37.0 |
| Monitoring | Sentry | ^10.20.0 |
| Testing | Vitest | ^4.1.8 |
| Fonts | Playfair Display + DM Sans | self-hosted via next/font |

---

## Environment Variables

**Required for local development:**
```
DATABASE_URL="postgresql://...?sslmode=require"
DIRECT_URL="postgresql://...?sslmode=require"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="<64-char random string>"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Optional (enable features):**
```
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_MONTHLY_PRICE_ID="price_..."
STRIPE_PRO_ANNUAL_PRICE_ID="price_..."
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
RESEND_API_KEY="re_..."
RESEND_FROM="WaveFinder <noreply@example.com>"
SENTRY_DSN="https://..."
NEXT_PUBLIC_SENTRY_DSN="https://..."
CRON_SECRET="<random secret for Vercel cron>"
ENABLE_DEBUG_API="false"
```

See `.env.example` for full documentation of each variable. Copy it to `.env.local`
and fill in values for your environment.

---

## Project File Tree

```
surf-app/
├── app/
│   ├── globals.css               ← CSS variables, Leaflet overrides, animations
│   ├── layout.tsx                ← Root layout with Navbar + Providers
│   ├── page.tsx                  ← Homepage (hero, features, CTA)
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── dashboard/page.tsx        ← Saved spots dashboard
│   ├── sessions/page.tsx         ← Surf session log (user history)
│   ├── spots/
│   │   ├── page.tsx              ← Map + list view, quick filters, live conditions
│   │   └── [slug]/
│   │       ├── page.tsx          ← Server component (fetches spot from DB)
│   │       └── SpotForecastView.tsx ← Full forecast UI (client component)
│   └── api/
│       ├── auth/[...all]/route.ts          ← better-auth endpoints
│       ├── account/route.ts                ← GET/PUT user account
│       ├── best-spots/route.ts             ← GET optimal-conditions spots (Pro-gated)
│       ├── billing/
│       │   ├── checkout/route.ts           ← POST create checkout session
│       │   └── portal/route.ts             ← GET customer portal link
│       ├── health/route.ts                 ← GET health check (DB + Redis)
│       ├── spots/route.ts                  ← GET spots; slim=true or withConditions=true
│       ├── spots/[slug]/route.ts           ← GET single spot by slug
│       ├── spots/meta/route.ts             ← GET countries/regions for filters
│       ├── forecast/[slug]/route.ts        ← GET 7-day forecast + tides + buoy + best times
│       ├── surf-reports/[spotSlug]/route.ts ← GET NOAA live conditions
│       ├── water-quality/[slug]/route.ts   ← GET EPA water quality (where available)
│       ├── webcams/[slug]/route.ts         ← GET webcam links (multiple sources)
│       ├── alerts/[slug]/route.ts          ← GET/POST/DELETE spot alert subscriptions
│       ├── stripe/webhook/route.ts         ← POST Stripe webhook handler
│       └── debug/conditions/route.ts       ← POST force-refresh forecast cache (dev only)
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Providers.tsx         ← TanStack Query + auth session provider
│   │   └── WaveLoader.tsx
│   ├── spots/
│   │   ├── SpotMap.tsx           ← Leaflet map with MarkerCluster + parking layer
│   │   ├── SpotCard.tsx
│   │   ├── SaveSpotButton.tsx
│   │   └── SeasonCalendar.tsx
│   ├── forecast/
│   │   ├── BestTimePanel.tsx     ← Session window recommendations (tide-aware)
│   │   ├── BuoyReadings.tsx      ← NOAA buoy live data (null-safe for offline sensors)
│   │   ├── ConditionBadge.tsx
│   │   ├── ForecastDayCard.tsx   ← 7-day strip card (22px wave height, redesigned)
│   │   ├── SurfReports.tsx       ← NOAA live conditions panel
│   │   ├── WaveChart.tsx
│   │   ├── WindChart.tsx
│   │   ├── TideChart.tsx
│   │   ├── UVChart.tsx
│   │   ├── SwellPanel.tsx
│   │   ├── GearPanel.tsx
│   │   ├── IdealConditionsPanel.tsx
│   │   ├── SpotSatelliteMap.tsx
│   │   └── WaterQualityPanel.tsx
│   ├── sessions/
│   │   └── QuickLogModal.tsx     ← Log a surf session modal
│   └── webcam/
│       └── WebcamPanel.tsx
├── lib/
│   ├── api/
│   │   ├── open-meteo.ts         ← Marine forecast (SST bundled, single request)
│   │   ├── noaa-buoy.ts          ← NDBC buoy real-time data parser
│   │   └── noaa-tides.ts         ← CO-OPS tide predictions + coastal wind
│   ├── forecast/
│   │   ├── rating.ts             ← rateSurfConditions(), computeWavePower()
│   │   ├── merge.ts              ← Merge Open-Meteo marine + wind → ForecastHour[]
│   │   │                            All fields use time-keyed maps, not raw index
│   │   ├── best-time.ts          ← computeBestTimes() — 5 windows, tide-aware tips
│   │   ├── solar-uv.ts           ← UV index calculation
│   │   └── weather-code.ts       ← WMO code → emoji + label + tempF()
│   ├── spots/                    ← Spot data files by region
│   ├── auth.ts
│   ├── auth-client.ts
│   ├── email.ts                  ← Resend helpers (alert emails)
│   ├── parking-data.ts
│   ├── prisma.ts
│   ├── region-hierarchy.ts
│   ├── spot-seasons.ts
│   └── spots-data.ts             ← 134+ surf spots seed data
├── types/
│   ├── forecast.ts               ← ForecastHour, ForecastDay, BuoyReading, etc.
│   └── spot.ts                   ← SurfSpot, ParkingOption types
├── prisma/
│   ├── schema.prisma             ← PostgreSQL (provider = "postgresql")
│   └── seed.ts
└── WAVEFINDER_PROJECT.md         ← This file
```

---

## Database Schema (PostgreSQL)

```prisma
model SurfSpot {
  id                String   @id @default(cuid())
  slug              String   @unique
  name              String
  region            String   @index
  country           String   @index
  lat               Float
  lng               Float
  description       String?
  difficulty        String   @default("intermediate")
  facingDirection   Float    @default(180)
  noaaTideStationId String?
  noaaBuoyId        String?
  webcamUrl         String?
  webcamType        String?
  parkingOptions    Json?
  activities        String[] @default([])
  createdAt         DateTime @default(now())
}

model User {
  id                   String    @id
  name                 String
  email                String    @unique
  emailVerified        Boolean   @default(false)
  image                String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  stripeCustomerId     String?   @unique
  stripeSubscriptionId String?   @unique
  stripePriceId        String?
  stripeSubscriptionStatus String?
  stripeCurrentPeriodEnd DateTime?
  stripeTrialEndsAt    DateTime?
  sessions             Session[]
  accounts             Account[]
}

model Session {
  id        String   @id
  expiresAt DateTime @index
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String   @index
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String    @index
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model Verification {
  id         String   @id
  identifier String   @index
  value      String
  expiresAt  DateTime @index
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Notes:**
- `SurfSpot` is immutable, seeded once from `lib/spots-data.ts` (1,490+ spots worldwide).
- `User`, `Session`, `Account`, and `Verification` are managed by better-auth (email + password auth).
- All spot data lives in the `SurfSpot` table; historical user data would use separate collections if implemented.

---

## Key Architecture Notes

### Why time-keyed maps in merge.ts
Both Open-Meteo API calls (marine + weather) use `next: { revalidate: 3600 }` independently.
If they were cached at different times they start at different hours. Using raw index `i` from
the marine array to index into the weather array caused misaligned data (wrong temp/weatherCode
for many spots). All fields now use `Map<time, value>` lookups.

### Cron cleanup
`/api/cron/cleanup` is invoked daily by Vercel's cron service. It purges expired
`Session` and `Verification` rows (better-auth doesn't delete them automatically).
The route requires `Authorization: Bearer <CRON_SECRET>`. If the header or secret
is missing or wrong, the request returns 401. Set `CRON_SECRET` in Vercel's
production environment.

### Session date storage
`sessionDate` is stored as `new Date(body.sessionDate + 'T12:00:00')` (noon UTC).
Using midnight UTC caused date-shift bugs for US West Coast users whose "today" is still
yesterday in UTC.

### SST fetch
Sea surface temperature is now bundled into the main marine API request as `sea_surface_temperature`.
Previously it made a second sequential request per spot page load.

---

## Surf Rating Algorithm

`rateSurfConditions()` in `lib/forecast/rating.ts`:
- **Height** (25%): peak at 2–2.5m
- **Period** (30%): 16s+ = 100, 8s = 35
- **Wind** (30%): offshore = 100, onshore = 10
- **Direction** (15%): swell face-on = 100

Score 0–100 → Poor (<35) / Fair (35–59) / Good (60–79) / Epic (80+)

**Wave Power:** `P = 0.5 × H² × T` kW/m

### Session Windows
`computeBestTimes(hours, spotFacing, tides?)` in `lib/forecast/best-time.ts`:
- 5 windows: Dawn (5–8am), Morning (8–noon), Midday (noon–3pm), Afternoon (3–6pm), Evening (6–9pm)
- Tide trend (rising/dropping) appended to tip text when tides data available
- Returns `BestTimeSlot[]` with avgScore, rating, windQuality, tip

---

## NOAA Buoys (California)

| Buoy | Location |
|---|---|
| 46086 | San Clemente Basin — San Diego, South OC |
| 46222 | San Pedro Channel — OC, LA South |
| 46221 | Santa Monica Bay — LA County |
| 46025 | Santa Monica (offshore) — Malibu, PCH |
| 46053 | Santa Barbara Channel — Ventura, SB |
| 46011 | Point Arguello — SLO County |
| 46028 | Cape San Martin — North SLO |
| 46042 | Monterey — Monterey Bay, Santa Cruz |
| 46012 | Half Moon Bay — Mavericks, HMB |
| 46026 | San Francisco — Ocean Beach, Marin |
| 46013 | Bodega Bay — Sonoma Coast |
| 46014 | Point Arena — Mendocino |
| 46022 | Eel River — Humboldt County |
| 51001 | Hawaii — Pipeline, Sunset |

---

## Design System

**Fonts:** Playfair Display (headings, hero numbers) + DM Sans (body, UI)

**Colors:**
```css
--sand-50: #fdfaf5   --sand-100: #f7f0e6   --sand-200: #ede0cc
--ocean-500: #1b7fcb  --ocean-600: #1362a8  --ocean-700: #0e4d88
--seafoam: #4dbfca    --coral: #e07a5f       --sunset: #f4a261
```

Condition: Poor=grey, Fair=amber (#fde68a), Good=green (#bbf7d0), Epic=purple (#ddd6fe)

---

## Common Commands

```bash
# Development
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Build for production
npm start                      # Run production build

# Database
npm run db:push                # Sync schema to database (development)
npm run db:seed                # Seed 1,490 spots
npm run db:studio              # Open Prisma Studio (interactive DB browser)
npm run db:reset               # Force-reset + reseed (destructive, dev only)
npm run migrate:dev            # Create a new migration
npm run migrate:deploy         # Apply pending migrations (runs in Vercel build)

# Quality checks
npm run typecheck              # Type-check with tsc --noEmit
npm run lint                   # Run ESLint (fails on warnings)
npm test                       # Run Vitest once
npm run test:watch             # Run Vitest in watch mode

# Deployment
npm run smoke:prod             # Smoke-test the production deployment
```

---

## Known Issues / Remaining Work

See [`docs/audit/05-post-deploy-audit-2026-06-09.md`](./docs/audit/05-post-deploy-audit-2026-06-09.md)
for the most current list, prioritized by impact.

**Summary of notable gaps:**

- **Email verification not enforced**: Unverified emails can currently reach Stripe checkout. Before going live with real payments, enforce `requireEmailVerification: true` in better-auth and gate checkout on `user.emailVerified`.
- **Sentry DSN not set in production**: Error monitoring is wired but disabled. Set `SENTRY_DSN` in Vercel environment.
- **No external uptime monitoring**: No service currently monitors `/api/health`. Set up a basic HTTP probe.
- **Forecast is client-fetched after hydration**: Adds a waterfall on slow networks. Can be folded into a future static-spots refactor.
- **Spot data still hits Postgres**: 1,490 immutable spots round-trip the database. Switching to an in-memory map from `SURF_SPOTS_SEED` would cut latency and decouple forecast uptime from Neon.
- **Marine model coverage**: Open-Meteo has ~9 km resolution. Very sheltered spots may correctly show 0 ft (no swell reaches them), but it can look like a bug.
- **Webcam data**: No single free API covers all spots. Currently pulls from multiple sources and falls back gracefully.
- **East Coast and Alaska coverage**: Spot data is seeded but incomplete. More regions can be added to `lib/spots/` files.
