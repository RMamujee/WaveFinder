# WaveFinder — Full Project Reference

> Send this file at the start of a new Claude Code session. It contains the complete architecture, all key source files, and context to continue development immediately.

---

## App Summary

**WaveFinder** is a free Surfline-style surf forecast web app. It uses 100% free government data (NOAA NDBC buoys, NOAA CO-OPS tides, Open-Meteo marine forecasts). Built with Next.js 16 App Router, TypeScript, Tailwind CSS v4, Prisma v5 + SQLite, better-auth, TanStack Query, Leaflet maps, and Recharts.

**Running locally:** `npm run dev` → http://localhost:3000  
**Database:** `prisma/dev.db` (SQLite)  
**Seed spots:** `npx prisma db seed` (134 California + world spots)

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.2 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Auth | better-auth | ^1.6.0 |
| ORM | Prisma | ^5.22.0 |
| DB | SQLite | (via dev.db) |
| State | TanStack Query | v5 |
| Maps | Leaflet | ^1.9.4 |
| Charts | Recharts | ^3.8.1 |
| Fonts | Playfair Display + DM Sans | via Google Fonts |

---

## Environment Files

**`.env` and `.env.local`** (both needed):
```
DATABASE_URL="file:dev.db"
BETTER_AUTH_SECRET="change-this-to-a-random-64-char-string-in-production"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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
│       └── surf-reports/[spotSlug]/route.ts ← NOAA live conditions report
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx            ← WaveFinder logo + nav + auth
│   │   └── Providers.tsx         ← TanStack Query + auth session provider
│   ├── spots/
│   │   ├── SpotMap.tsx           ← Leaflet map; pins show wave height in ft
│   │   ├── SpotCard.tsx          ← Compact spot card for list/dashboard
│   │   └── SaveSpotButton.tsx    ← Heart button to save/unsave spot
│   ├── forecast/
│   │   ├── BestTimePanel.tsx     ← Session window recommendations
│   │   ├── BuoyReadings.tsx      ← NOAA buoy live data card
│   │   ├── ConditionBadge.tsx    ← Poor/Fair/Good/Epic badge
│   │   ├── ForecastDayCard.tsx   ← 7-day strip card
│   │   ├── SurfReports.tsx       ← NOAA live conditions panel (replaced Reddit)
│   │   ├── WaveChart.tsx         ← 7-day wave height area chart
│   │   ├── WindChart.tsx         ← Wind speed bar chart
│   │   └── TideChart.tsx         ← 48-hour tide line chart
│   └── webcam/
│       └── WebcamPanel.tsx       ← Webcam embed or OpenStreetMap fallback
├── lib/
│   ├── api/
│   │   ├── open-meteo.ts         ← Marine forecast + current conditions fetch
│   │   ├── noaa-buoy.ts          ← NDBC buoy real-time data parser
│   │   └── noaa-tides.ts         ← CO-OPS tide predictions
│   ├── forecast/
│   │   ├── rating.ts             ← rateSurfConditions(), computeWavePower()
│   │   ├── merge.ts              ← Merge Open-Meteo marine + wind → ForecastHour[]
│   │   └── best-time.ts          ← computeBestTimes() → 5 session windows
│   ├── auth.ts                   ← better-auth server config
│   ├── auth-client.ts            ← better-auth client
│   ├── prisma.ts                 ← Prisma singleton
│   └── spots-data.ts             ← 134 surf spots seed data
├── types/
│   ├── forecast.ts               ← ForecastHour, ForecastDay, BuoyReading, etc.
│   └── spot.ts                   ← SurfSpot type
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── dev.db
└── WAVEFINDER_PROJECT.md         ← This file
```

---

## Key Source Files

### `prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  emailVerified Boolean  @default(false)
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  sessions      Session[]
  accounts      Account[]
  savedSpots    SavedSpot[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model SurfSpot {
  id                String      @id @default(cuid())
  slug              String      @unique
  name              String
  region            String
  country           String      @default("USA")
  lat               Float
  lng               Float
  description       String?
  difficulty        String      @default("intermediate")
  facingDirection   Int         @default(270)
  noaaTideStationId String?
  noaaBuoyId        String?
  webcamUrl         String?
  webcamType        String      @default("none")
  savedBy           SavedSpot[]
}

model SavedSpot {
  id        String   @id @default(cuid())
  userId    String
  spotId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  spot      SurfSpot @relation(fields: [spotId], references: [id], onDelete: Cascade)
  @@unique([userId, spotId])
}
```

---

### `types/forecast.ts`
```typescript
export type ConditionRating = 'poor' | 'fair' | 'good' | 'epic'

export interface WindData {
  speed: number; gust: number; direction: number; directionLabel: string
}

export interface ForecastHour {
  time: string
  waveHeight: number
  wavePeriod: number
  waveDirection: number
  swellHeight: number
  swellPeriod: number
  swellDirection: number
  windWaveHeight: number
  wind: WindData
  rating: ConditionRating
  ratingScore: number
  wavePower: number
}

export interface ForecastDay {
  date: string
  hours: ForecastHour[]
  maxWaveHeight: number
  avgPeriod: number
  dominantRating: ConditionRating
}

export interface TidePoint {
  time: string; height: number; type: 'H' | 'L' | null
}

export interface BuoyReading {
  time: string
  waveHeight: number
  dominantPeriod: number
  averagePeriod: number
  meanDirection: number
  waterTemp: number | null
  airTemp: number | null
  windSpeed: number | null
  windDirection: number | null
}

export interface SpotForecast {
  spotId: string
  fetchedAt: string
  forecast: ForecastDay[]
  tides: TidePoint[]
  buoy: BuoyReading | null
  currentCondition: ForecastHour | null
}
```

---

### `lib/forecast/rating.ts`
```typescript
import type { ConditionRating } from '@/types/forecast'

export function degreesToCompass(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

export function computeWavePower(waveHeight: number, period: number): number {
  if (waveHeight <= 0 || period <= 0) return 0
  return Math.round(0.5 * waveHeight * waveHeight * period * 10) / 10
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function scoreWind(windSpeed: number, windDirection: number, spotFacing: number): number {
  if (windSpeed < 5) return 100
  const offshoreDirection = (spotFacing + 180) % 360
  const diff = angleDiff(windDirection, offshoreDirection)
  let dirScore = diff <= 45 ? 100 : diff <= 90 ? 75 : diff <= 135 ? 40 : 10
  let speedPenalty = windSpeed > 30 ? 40 : windSpeed > 20 ? 20 : windSpeed > 15 ? 10 : 0
  return Math.max(0, dirScore - speedPenalty)
}

function scorePeriod(period: number): number {
  if (period >= 16) return 100
  if (period >= 14) return 90
  if (period >= 12) return 75
  if (period >= 10) return 55
  if (period >= 8)  return 35
  return 15
}

function scoreHeight(height: number): number {
  if (height < 0.3) return 5
  if (height < 0.5) return 25
  if (height < 0.8) return 50
  if (height < 1.2) return 75
  if (height < 2.0) return 95
  if (height < 2.5) return 100
  if (height < 3.5) return 85
  if (height < 5.0) return 60
  return 30
}

function scoreDirection(swellDirection: number, spotFacing: number): number {
  const diff = angleDiff(swellDirection, spotFacing)
  if (diff <= 20) return 100
  if (diff <= 45) return 85
  if (diff <= 70) return 60
  if (diff <= 90) return 35
  return 10
}

export function rateSurfConditions(input: {
  waveHeight: number; swellPeriod: number; swellHeight: number
  windSpeed: number; windDirection: number; swellDirection: number; spotFacing: number
}): { score: number; rating: ConditionRating } {
  const score = Math.round(
    scoreHeight(input.waveHeight)                              * 0.25 +
    scorePeriod(input.swellPeriod)                             * 0.30 +
    scoreWind(input.windSpeed, input.windDirection, input.spotFacing) * 0.30 +
    scoreDirection(input.swellDirection, input.spotFacing)     * 0.15
  )
  const rating: ConditionRating = score >= 80 ? 'epic' : score >= 60 ? 'good' : score >= 35 ? 'fair' : 'poor'
  return { score, rating }
}
```

---

### `lib/api/open-meteo.ts`
```typescript
const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast'

export interface CurrentMarineConditions {
  waveHeight: number; wavePeriod: number; swellDirection: number
  windSpeed: number; windDirection: number
}

export async function fetchCurrentConditions(lat: number, lng: number): Promise<CurrentMarineConditions | null> {
  try {
    const marineParams = new URLSearchParams({
      latitude: lat.toString(), longitude: lng.toString(),
      current: 'wave_height,wave_period,swell_wave_direction,wind_speed_10m,wind_direction_10m',
      wind_speed_unit: 'kmh', timezone: 'auto',
    })
    const windParams = new URLSearchParams({
      latitude: lat.toString(), longitude: lng.toString(),
      current: 'wind_speed_10m,wind_direction_10m',
      wind_speed_unit: 'kmh', timezone: 'auto',
    })
    const [marineRes, windRes] = await Promise.all([
      fetch(`${MARINE_BASE}?${marineParams}`, { next: { revalidate: 1800 } }),
      fetch(`${WEATHER_BASE}?${windParams}`, { next: { revalidate: 1800 } }),
    ])
    if (!marineRes.ok) return null
    const marine = await marineRes.json()
    const wind = windRes.ok ? await windRes.json() : null
    const c = marine?.current
    if (!c) return null
    return {
      waveHeight:    c.wave_height ?? 0,
      wavePeriod:    c.wave_period ?? 0,
      swellDirection: c.swell_wave_direction ?? 0,
      windSpeed:     wind?.current?.wind_speed_10m ?? 0,
      windDirection: wind?.current?.wind_direction_10m ?? 0,
    }
  } catch { return null }
}

// Full 7-day forecast functions (fetchMarineForecast, fetchWindForecast) remain unchanged
```

---

### `app/api/spots/route.ts` — Live Conditions Logic
```typescript
// GET /api/spots?withConditions=true
// Stage 1: batch-fetch NOAA buoys (grouped by unique buoyId, ~13 calls for all CA)
// Stage 2: for spots with no valid buoy data, fetch Open-Meteo current conditions
//          de-duplicated by 0.1° lat/lng bucket (~11km grid) → typically <20 extra calls
// Result: every spot gets currentRating, currentWaveHeight, currentPeriod, wavePower
```

---

### `app/api/surf-reports/[spotSlug]/route.ts` — Live Conditions Report
- Replaces Reddit; fetches NOAA NDBC buoy `.txt` file directly
- Parses current + 6-hour-ago readings to compute trend (rising ↑ / dropping ↓ / steady →)
- Returns: `{ report: LiveConditionReport }` with waveHeight, period, wavePower, wind, waterTemp, trend, summary text, link to NOAA station page

---

### `lib/forecast/best-time.ts` — Session Windows
5 windows per day: Dawn (5–8am), Morning (8am–noon), Midday (noon–3pm), Afternoon (3–6pm), Evening (6–9pm).
Each rated with avg score, dominant rating, wind quality label (glassy/light offshore/light onshore/choppy), and a plain-English tip.

---

### `components/spots/SpotMap.tsx` — Map Pins
- Leaflet with CartoDB Voyager tiles
- Each pin = colored circle (grey=poor, amber=fair, green=good, purple=epic) showing **wave height in feet** (e.g. `4ft`)
- `"—"` shown only if both NOAA buoy and Open-Meteo return no data
- Hover: tooltip with spot name, region, difficulty, wave height, period, wave power, wind
- Click: popup with wave stats + "View Forecast →" link

---

## NOAA Buoy IDs Used

| Buoy | Location | Covers |
|---|---|---|
| 46086 | San Clemente Basin | San Diego, South OC |
| 46222 | San Pedro Channel | OC, LA South |
| 46221 | Santa Monica Bay | LA County |
| 46025 | Santa Monica (offshore) | Malibu, PCH |
| 46053 | Santa Barbara Channel | Ventura, SB |
| 46011 | Point Arguello | SLO County |
| 46028 | Cape San Martin | North SLO |
| 46042 | Monterey | Monterey Bay, Santa Cruz |
| 46012 | Half Moon Bay | Mavericks, HMB |
| 46026 | San Francisco | Ocean Beach SF, Marin |
| 46013 | Bodega Bay | Sonoma Coast |
| 46014 | Point Arena | Mendocino |
| 46022 | Eel River | Humboldt County |
| 51001 | Hawaii | Pipeline, Sunset |

---

## Spots by Region (134 total)

- **San Diego** (20): Black's Beach, Windansea, Big Rock, OB Pier, Sunset Cliffs, Pacific Beach, Tourmaline, Cardiff Reef, Swami's, Moonlight, Grandview, Tabletops, South Carlsbad, Oceanside Pier, Del Mar, Solana Beach, Torrey Pines, Mission Beach, Imperial Beach, Coronado
- **Orange County** (18): Trestles, San Clemente Pier, Salt Creek, Doheny, Trail 6, The Church, Brooks Street, 1000 Steps, Newport/Wedge, Blackie's, HB Pier, Bolsa Chica, Seal Beach, Cotton's Point, San Onofre, Crystal Cove, Crescent Bay, Treasure Island
- **Los Angeles** (20): El Porto, Manhattan Pier, Hermosa, Redondo Breakwater, RAT Beach, Lunada Bay, Point Fermin, Venice, Santa Monica, Topanga, Zuma, Malibu, Leo Carrillo, County Line, Playa del Rey, El Segundo, Nicholas Canyon, El Matador, Point Dume, Will Rogers
- **Ventura** (9): Rincon, Pitas Point, Ventura Pier, La Conchita, Mussel Shoals, Emma Wood, Oxnard Shores, Hollywood Beach, Point Mugu
- **Santa Barbara** (10): Carpinteria, Leadbetter, Hammond's Reef, Jalama, Gaviota, El Capitán, Refugio, Campus Point, Coal Oil Point, Hendry's Beach
- **Central Coast SLO** (8): Pismo Beach, Shell Beach, Cayucos, Morro Bay, San Simeon, Avila Beach, Oceano Dunes, Montaña de Oro, Cambria Moonstone
- **Monterey Bay** (11): Asilomar, Monastery Beach, Pleasure Point, Cowell's, Moss Landing, Marina, Capitola, Natural Bridges, Scott Creek, Davenport Landing, Año Nuevo
- **NorCal Bay Area** (11): Linda Mar, Ocean Beach SF, Fort Point, Bolinas, Stinson Beach, Pigeon Point, Pescadero, HMB Beach, El Granada, Sharp Park, Baker Beach, Rodeo Beach, Muir Beach
- **Sonoma/Marin** (5): Salmon Creek, Bodega Bay, Goat Rock, Dillon Beach, Gualala
- **Mendocino** (7): Fort Ross, Point Arena, Ten Mile Beach, Fort Bragg/Noyo, Caspar, Mendocino Bay, Elk
- **Humboldt** (4): Trinidad, Clam Beach/Mad River, Centerville, Shelter Cove
- **Classic/International** (7): Steamer Lane, Mavericks, Pipeline, Sunset Beach, Cocoa Beach, Cape Hatteras, Hossegor, Uluwatu

---

## Design System

**Fonts:** Playfair Display (headings, numbers, serif) + DM Sans (body, UI)

**Colors (CSS variables in globals.css):**
```css
--sand-50: #fdfaf5   /* page background */
--sand-100: #f7f0e6  /* surface 2 */
--sand-200: #ede0cc  /* border */
--ocean-500: #1b7fcb
--ocean-600: #1362a8 /* primary button */
--ocean-700: #0e4d88
--seafoam: #4dbfca   /* accent, WaveFinder italic */
--coral: #e07a5f
--sunset: #f4a261
```

**Condition colors:**
- Poor: grey (#e5e7eb border, #9ca3af)
- Fair: amber (#fef3c7 bg, #f59e0b border)
- Good: green (#d1fae5 bg, #16a34a border)
- Epic: purple (#ede9fe bg, #7c3aed border)

---

## Data Flow

```
User visits /spots
  → GET /api/spots?withConditions=true
    → Prisma: fetch all spots from SQLite
    → NOAA NDBC: batch fetch ~13 buoys in parallel
    → Open-Meteo: current conditions for spots with failed buoys (~0.1° bucket)
    → Returns enriched SpotWithRating[] with wave height, period, rating, power
  → SpotMap renders pins with wave height in feet, color-coded by rating

User clicks spot → /spots/[slug]
  → GET /api/forecast/[slug]
    → Open-Meteo: 7-day marine forecast (wave height, period, swell, direction)
    → Open-Meteo: 7-day wind forecast
    → NOAA CO-OPS: 48-hour tide predictions
    → NOAA NDBC: latest buoy reading
    → Merge + rate → ForecastHour[] (168 hours)
    → Returns SpotForecast

  → GET /api/surf-reports/[spotSlug]
    → NOAA NDBC: latest ~20 readings from buoy .txt file
    → Compute trend (rising/dropping/steady)
    → Returns LiveConditionReport

  → SpotForecastView renders:
    - Hero: wave height, period, swell direction, wind speed, wave power, rating score
    - 7-day strip, session time recommendations, hourly table
    - Wave/wind/tide charts, live buoy panel, NOAA conditions report
```

---

## Known Issues / Next Steps

1. **Wave power label "?" could still appear** for spots where Open-Meteo also returns 0 (very calm ocean). This is genuinely 0ft surf, not an error.
2. **Webcams**: No free public surf webcam API exists. Currently shows OpenStreetMap embed as placeholder. Could integrate Windy.com iframe widgets.
3. **Mobile app**: The user wants this to become a mobile app eventually. The API architecture (all data from free government sources, cached, no external subscriptions) is already mobile-friendly.
4. **More spots**: The user requested expanding beyond California to Oregon, Washington, East Coast.
5. **User alerts**: "Notify me when [spot] hits Good or Epic conditions" — would need email/push infrastructure.
6. **Surf reports section**: Currently shows NOAA buoy data formatted as a live report. Original intent was Reddit, but Reddit requires OAuth for reliable access. NOAA is more accurate anyway.

---

## Commands to Know

```bash
# Start dev server
npm run dev

# Re-seed spots after editing lib/spots-data.ts
npx prisma db seed

# Generate Prisma client after schema changes
npx prisma generate

# TypeScript check
npx tsc --noEmit

# Push schema changes to DB
npx prisma db push
```

---

## How Surf Rating Works

`rateSurfConditions()` in `lib/forecast/rating.ts`:
- **Height score** (25%): 0–100 based on wave height in meters. Peak at 2–2.5m. Too small or too big scores lower.
- **Period score** (30%): Longer period = cleaner = higher score. 16s+ = 100, 8s = 35.
- **Wind score** (30%): Offshore wind = 100. Onshore = 10. Speed penalty for strong winds.
- **Direction score** (15%): Swell hitting the spot face-on = 100. Wrong direction = 10.

Final score 0–100 → Poor (<35) / Fair (35–59) / Good (60–79) / Epic (80+)

**Wave Power:** `P = 0.5 × H² × T` kW/m (simplified wave energy flux formula)

---

## Session Window Algorithm

`computeBestTimes()` in `lib/forecast/best-time.ts`:
5 windows (Dawn/Morning/Midday/Afternoon/Evening), each assigned hours from `ForecastHour[]`.
Best window = highest average score. Wind quality:
- Glassy: avg wind < 8 km/h
- Light offshore: < 15 km/h and offshore direction
- Light onshore: < 15 km/h onshore
- Choppy: > 15 km/h

Returns `BestTimeSlot[]` with `{ window, avgScore, rating, windQuality, tip }`.
