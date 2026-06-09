# WaveFinder — Full Project Reference

> Send this file at the start of a new Claude Code session to get full context.

---

> ## ⚠️ Accuracy notice — trust the code, not this doc
>
> Parts of this reference describe features that are **PLANNED / NOT IMPLEMENTED**
> in the current codebase. When in doubt, **read the source — the code is the
> source of truth, not this document.** Specifically, as of this writing the
> following do **not** exist in the repo:
>
> - **Resend email alerts** (`lib/email.ts` and alert-email sending). Resend is
>   only wired into `lib/auth.ts` for optional account email verification.
> - **The `/api/cron/check-alerts` cron route** — there is no `app/api/cron/`
>   directory at all.
> - **The saved-spots and sessions sync API routes** (`/api/saved-spots/**`,
>   `/api/sessions/**`) — these are not present.
> - **The `SpotAlert`, `SavedSpot`, and `SurfSession` Prisma models** — the
>   current `prisma/schema.prisma` only defines `SurfSpot`, `User`, `Session`,
>   `Account`, and `Verification`. Any feature described below that depends on
>   those models may not exist.
>
> The historical content below is retained for context, but verify against the
> actual code before relying on it.

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
| Framework | Next.js App Router | 16.2.2 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Auth | better-auth | ^1.6.0 |
| ORM | Prisma | ^5.22.0 |
| DB | **Neon PostgreSQL** | (migrated from SQLite) |
| State | TanStack Query | v5 |
| Maps | Leaflet + MarkerCluster | ^1.9.4 |
| Charts | Recharts | ^3.8.1 |
| Email | Resend | ^6.10.0 |
| Fonts | Playfair Display + DM Sans | self-hosted via next/font |

---

## Environment Variables

**`.env.local`** (all required):
```
DATABASE_URL="postgresql://neondb_owner:<password>@<host>/neondb?sslmode=require"
BETTER_AUTH_SECRET="<64-char random string>"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RESEND_API_KEY="re_..."
CRON_SECRET="<random secret for cron auth>"
```

For production add:
```
NEXT_PUBLIC_BASE_URL="https://your-domain.vercel.app"
```

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
│       ├── auth/[...all]/route.ts
│       ├── spots/route.ts        ← GET spots; withConditions=true adds live data
│       ├── spots/[slug]/route.ts ← GET single spot by slug
│       ├── forecast/[slug]/route.ts ← Full 7-day forecast + tides + buoy
│       ├── saved-spots/route.ts  ← GET/POST saved spots
│       ├── saved-spots/[spotId]/route.ts ← DELETE saved spot
│       ├── sessions/route.ts     ← GET/POST surf sessions (user log)
│       ├── sessions/[id]/route.ts ← PATCH/DELETE surf session
│       ├── alerts/route.ts       ← GET/POST spot alerts
│       ├── alerts/[id]/route.ts  ← DELETE alert
│       ├── cron/check-alerts/route.ts ← Daily cron — send alert emails
│       ├── surf-reports/[spotSlug]/route.ts ← NOAA live conditions report
│       └── water-quality/[spotSlug]/route.ts
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
  id, slug, name, region, country, lat, lng
  description, difficulty, facingDirection (Float)
  noaaTideStationId, noaaBuoyId
  webcamUrl, webcamType, parkingOptions (Json)
  createdAt DateTime
  savedBy SavedSpot[]
  alerts  SpotAlert[]
}

model SavedSpot { userId, spotId, createdAt — @@unique([userId, spotId]) }

model SpotAlert {
  userId, spotId, spotName
  minRating  String   // 'good' | 'epic'
  email      String
  active     Boolean  @default(true)
  lastSentAt DateTime?
  — @@unique([userId, spotId])
}

model SurfSession {
  userId, spotName, spotSlug?, region?
  sessionDate DateTime            // stored at T12:00:00 to avoid timezone date-shift
  duration?, waveHeightFt?, wavePeriod?
  windSpeed?, windDir?, waterTempC?
  boardType?, wetsuitMm?
  rating (Int 1-10)?, highlights?, buddies?
}
```

---

## Key Architecture Notes

### Why time-keyed maps in merge.ts
Both Open-Meteo API calls (marine + weather) use `next: { revalidate: 3600 }` independently.
If they were cached at different times they start at different hours. Using raw index `i` from
the marine array to index into the weather array caused misaligned data (wrong temp/weatherCode
for many spots). All fields now use `Map<time, value>` lookups.

### Cron auth
`/api/cron/check-alerts` requires `Authorization: Bearer <CRON_SECRET>`.
Guard is `if (!process.env.CRON_SECRET || auth !== ...)` — missing env var **blocks** all requests.
Previously the `&&` form would have passed all requests if the env var was unset.

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

## Commands

```bash
npm run dev                 # localhost:3000
npx prisma db push          # Push schema to Neon
npx prisma db seed          # Seed 134+ spots
npx prisma generate         # Regenerate client after schema change
npx prisma studio           # DB browser
npx tsc --noEmit            # Type check
npm run db:reset            # Force reset + reseed (destructive)
```

---

## Known Issues / Remaining Work

1. **Email validation**: `/api/alerts` stores email with no format check — invalid emails fail silently.
2. **No rate limiting** on `/api/spots?withConditions=true` — triggers 13+ NOAA + N Open-Meteo calls per request.
3. **Webcams**: No free public API. Shows OpenStreetMap embed as placeholder.
4. **Marine model coverage**: Open-Meteo has ~9km resolution. Very sheltered spots may show 0ft (accurate — no swell reaches them — but looks like a bug).
5. **More spots**: Oregon, Washington, full East Coast not yet seeded.
6. **Session social**: Buddies field in schema, no sharing UI yet.
