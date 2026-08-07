import { NextResponse } from 'next/server'
import { spotsInRegion } from '@/lib/spots/static-store'
import { fetchMarineForecast, fetchWindForecast } from '@/lib/api/open-meteo'
import type { OpenMeteoMarineResponse, OpenMeteoWindResponse } from '@/lib/api/open-meteo'
import { rateSurfConditions, degreesToCompass } from '@/lib/forecast/rating'
import type { SwellPartition } from '@/lib/forecast/rating'
import { distanceKm } from '@/lib/forecast/nearest-fallback'
import type { SurfSpot } from '@/types/spot'
import { handleRouteError, cdnCacheHeaders } from '@/lib/route-helpers'

export const maxDuration = 60

// The response depends only on (region, date) — no session, no per-user data —
// so it is share-cacheable. The fresh window matches the hourly cache the
// Open-Meteo fetches already sit behind: nothing new can appear sooner. The
// stale window is a full day because there are only ~105 (region, date) keys
// spread thinly over real traffic, and a key that goes cold costs the next
// visitor the whole fan-out — up to 4 marine + 4 wind fetches with a 28 s
// timeout each. Serving a model run a few hours old in ~0.5 s beats making one
// person wait out the cold path; `date` is in the key, so a stale entry is
// never the wrong day.
const CACHE_MAX_AGE = 3600
const CACHE_STALE_WHILE_REVALIDATE = 86400

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

// Representative lat/lng for regional swell data
const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  'San Diego':      { lat: 32.72, lng: -117.17 },
  'Orange County':  { lat: 33.55, lng: -117.75 },
  'Los Angeles':    { lat: 33.95, lng: -118.42 },
  'Ventura':        { lat: 34.25, lng: -119.25 },
  'Santa Barbara':  { lat: 34.42, lng: -119.70 },
  'Central Coast':  { lat: 35.30, lng: -120.80 },
  'Monterey':       { lat: 36.85, lng: -121.95 },
  'NorCal':         { lat: 38.50, lng: -123.00 },
  'North Shore':    { lat: 21.65, lng: -158.06 },
  'South Shore':    { lat: 21.27, lng: -157.82 },
  'Gold Coast':     { lat: -28.0,  lng: 153.43 },
  'Sydney Northern Beaches': { lat: -33.72, lng: 151.28 },
  'Uluwatu':        { lat: -8.83,  lng: 115.09 },
  'Hossegor':       { lat: 43.66,  lng: -1.43  },
  'Jeffrey\'s Bay': { lat: -34.05, lng: 24.93  },
}

// Scoring a whole region off ONE marine cell is a real error where regions are
// long: NorCal spans 52 spots, 307 km and 85° of coastal facing. Up to four
// cells are fetched and each spot is scored against its nearest one. Four is
// the ceiling because each cell costs a 16-day marine fetch (2 upstream calls)
// plus a wind fetch — all hourly-cached, but the route still has to finish.
const MAX_REGION_CLUSTERS = 4
// Two cells closer than this describe the same swell; spend the budget further
// along the coast instead.
const MIN_CLUSTER_SEPARATION_KM = 40

interface ClusterSeed { lat: number; lng: number }

function buildClusterSeeds(spots: SurfSpot[], region: string): ClusterSeed[] {
  const seeds: ClusterSeed[] = []
  // A hand-authored region centre is a known-good marine cell — keep it first.
  const named = REGION_CENTERS[region]
  if (named) seeds.push(named)

  // Densest 1° cells first, so seeds land where the spots actually are rather
  // than at an arithmetic centroid that can sit inland or offshore.
  const cells = new Map<string, SurfSpot[]>()
  for (const s of spots) {
    const key = `${Math.floor(s.lat)}:${Math.floor(s.lng)}`
    const bucket = cells.get(key)
    if (bucket) bucket.push(s)
    else cells.set(key, [s])
  }

  for (const cell of [...cells.values()].sort((a, b) => b.length - a.length)) {
    if (seeds.length >= MAX_REGION_CLUSTERS) break
    const meanLat = cell.reduce((sum, s) => sum + s.lat, 0) / cell.length
    const meanLng = cell.reduce((sum, s) => sum + s.lng, 0) / cell.length
    // The real spot nearest the cell's mean — a real coastal coordinate always
    // has marine data; a computed midpoint can land on land.
    let rep = cell[0]
    let repDist = Infinity
    for (const s of cell) {
      const d = distanceKm(meanLat, meanLng, s.lat, s.lng)
      if (d < repDist) { repDist = d; rep = s }
    }
    if (seeds.every((seed) => distanceKm(seed.lat, seed.lng, rep.lat, rep.lng) >= MIN_CLUSTER_SEPARATION_KM)) {
      seeds.push({ lat: rep.lat, lng: rep.lng })
    }
  }

  if (!seeds.length) seeds.push({ lat: spots[0].lat, lng: spots[0].lng })
  return seeds
}

interface Cluster {
  seed: ClusterSeed
  marine: OpenMeteoMarineResponse
  /** Wind speed/direction by local-clock time. An entry exists only when the
   *  API reported a speed — `?? 0` scored a missing hour as a perfect calm. */
  windByTime: Map<string, { speed: number; dir: number | null }>
  /** Marine hourly index by local-clock time, so a spot scored against a
   *  neighbouring cluster still lines up on the primary cluster's time axis. */
  indexByTime: Map<string, number>
}

function buildWindMap(wind: OpenMeteoWindResponse | null): Cluster['windByTime'] {
  const map = new Map<string, { speed: number; dir: number | null }>()
  if (!wind) return map
  wind.hourly.time.forEach((t, i) => {
    if (wind.hourly.wind_speed_10m[i] != null) {
      map.set(t, {
        speed: wind.hourly.wind_speed_10m[i],
        dir: wind.hourly.wind_direction_10m[i] ?? null,
      })
    }
  })
  return map
}

function secondaryAt(marine: OpenMeteoMarineResponse, i: number): SwellPartition | null {
  const height = marine.hourly.secondary_swell_wave_height?.[i] ?? null
  const period = marine.hourly.secondary_swell_wave_period?.[i] ?? null
  if (height == null || height <= 0 || period == null || period <= 0) return null
  return {
    height,
    period,
    direction: marine.hourly.secondary_swell_wave_direction?.[i] ?? null,
  }
}

export interface BestSpotsSwellHour {
  time: string
  // Primary swell (dominant ground swell)
  swellHeight: number
  swellPeriod: number
  swellDirection: number
  swellDirectionLabel: string
  // Secondary (wind wave / local chop)
  windWaveHeight: number
  windWavePeriod: number
  windWaveDirection: number
  windWaveDirectionLabel: string
  // Total
  waveHeight: number
  wavePeriod: number
  // Wind
  windSpeed: number    // km/h
  windDirection: number
  windDirectionLabel: string
  // Water
  seaSurfaceTemperature: number | null  // °C
}

export interface BestSpotsSpotEntry {
  id: string
  name: string
  slug: string
  facingDirection: number
  hours: {
    time: string
    rating: string
    ratingScore: number
    waveHeight: number
    faceHeight: number
    windSpeed: number
    windDirectionLabel: string
  }[]
}

export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url)
  const region = (searchParams.get('region') ?? '').slice(0, 100)
  const date   = (searchParams.get('date') ?? '').slice(0, 10)

  if (!region) return NextResponse.json({ error: 'region is required' }, { status: 400 })
  if (!/^[\w\s',.()-]{1,100}$/.test(region)) return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

  const spots = spotsInRegion(region)

  if (!spots.length) {
    return NextResponse.json(
      { spots: [], regionalSwell: [], date },
      { headers: cdnCacheHeaders(CACHE_MAX_AGE, CACHE_STALE_WHILE_REVALIDATE) }
    )
  }

  const seeds = buildClusterSeeds(spots, region)

  const settled = await Promise.all(seeds.map(async (seed): Promise<Cluster | null> => {
    const [marineResult, windResult] = await Promise.allSettled([
      withTimeout(fetchMarineForecast(seed.lat, seed.lng), 28000),
      withTimeout(fetchWindForecast(seed.lat, seed.lng), 28000),
    ])
    const clusterMarine = marineResult.status === 'fulfilled' ? marineResult.value : null
    if (!clusterMarine) return null
    const clusterWind = windResult.status === 'fulfilled' ? windResult.value : null
    const indexByTime = new Map<string, number>()
    clusterMarine.hourly.time.forEach((t, i) => indexByTime.set(t, i))
    return { seed, marine: clusterMarine, windByTime: buildWindMap(clusterWind), indexByTime }
  }))

  const clusters = settled.filter((c): c is Cluster => c !== null)
  if (!clusters.length) {
    return NextResponse.json({ error: 'Could not fetch marine forecast' }, { status: 502 })
  }

  // The first successful cluster owns the time axis: every spot reports the
  // same hours regardless of which cell scored it, so the client's hourly table
  // has no holes.
  const primary = clusters[0]
  const marine = primary.marine
  const hourIndices: number[] = []
  marine.hourly.time.forEach((t, i) => {
    if (t.startsWith(date)) hourIndices.push(i)
  })

  // Regional swell per hour — the primary cluster, as displayed context.
  const regionalSwell: BestSpotsSwellHour[] = hourIndices.map((i) => {
    const time        = marine.hourly.time[i]
    const w           = primary.windByTime.get(time) ?? { speed: 0, dir: 270 }
    // Display-only stand-ins below (the rating path in spotsData passes
    // honest nulls); wDir keeps the compass label renderable.
    const wDir        = w.dir ?? 270
    const swellDir    = marine.hourly.swell_wave_direction[i] ?? 270
    const windWaveDir = marine.hourly.wind_wave_direction[i]  ?? 270
    return {
      time,
      swellHeight:          marine.hourly.swell_wave_height[i]    ?? 0,
      swellPeriod:          marine.hourly.swell_wave_period[i]    ?? 0,
      swellDirection:       swellDir,
      swellDirectionLabel:  degreesToCompass(swellDir),
      windWaveHeight:       marine.hourly.wind_wave_height[i]     ?? 0,
      windWavePeriod:       marine.hourly.wind_wave_period[i]     ?? 0,
      windWaveDirection:    windWaveDir,
      windWaveDirectionLabel: degreesToCompass(windWaveDir),
      waveHeight:           marine.hourly.wave_height[i]          ?? 0,
      wavePeriod:           marine.hourly.wave_period[i]          ?? 0,
      windSpeed:            w.speed,
      windDirection:        wDir,
      windDirectionLabel:   degreesToCompass(wDir),
      seaSurfaceTemperature: marine.hourly.sea_surface_temperature?.[i] ?? null,
    }
  })

  // Per-spot hourly scores against the NEAREST cluster's swell, not one cell
  // for the whole region.
  const spotsData: BestSpotsSpotEntry[] = spots.map((spot) => {
    let cluster = clusters[0]
    let clusterDist = Infinity
    for (const c of clusters) {
      const d = distanceKm(spot.lat, spot.lng, c.seed.lat, c.seed.lng)
      if (d < clusterDist) { clusterDist = d; cluster = c }
    }
    const h = cluster.marine.hourly

    return {
      id:             spot.id,
      name:           spot.name,
      slug:           spot.slug,
      facingDirection: spot.facingDirection,
      hours: hourIndices.map((primaryIndex) => {
        const time = marine.hourly.time[primaryIndex]
        // Index into THIS cluster by time. A cluster that doesn't carry the
        // hour (different timezone at a region edge) is skipped rather than
        // read at a wrong offset.
        const i = cluster.indexByTime.get(time)
        const src = i != null ? cluster : primary
        const hourly = i != null ? h : marine.hourly
        const idx = i ?? primaryIndex

        const wReal        = src.windByTime.get(time)
        const w            = wReal ?? { speed: 0, dir: 270 }
        const waveHeight   = hourly.wave_height[idx]          ?? 0
        const wavePeriod   = hourly.wave_period[idx]          ?? 0
        const swellHeight  = hourly.swell_wave_height[idx]    ?? 0
        const swellPeriod  = hourly.swell_wave_period[idx]    ?? 0
        // Null rather than 0: a 0 makes the cleanliness factor read "perfectly
        // clean" instead of dropping out of the weighting.
        const windWaveH    = hourly.wind_wave_height[idx]     ?? null
        // Null rather than a 270 stand-in: an invented swell direction would be
        // scored as real exposure against each spot's facing.
        const swellDir     = hourly.swell_wave_direction[idx] ?? null

        // No wind entry for this hour (per-hour null, or the whole wind fetch
        // failed): estimate speed from the windsea like merge.ts does. Feeding a
        // literal 0 scored a weather-API outage as a perfectly glassy coast.
        const windSpeed = wReal
          ? wReal.speed
          : windWaveH != null && windWaveH > 0
            ? Math.round(Math.sqrt(windWaveH / 0.0248) * 3.6)
            : 0

        const { score, rating, faceHeight } = rateSurfConditions({
          waveHeight,
          swellHeight,
          // Mirror the engine's total-sea fallback for period, or a missing
          // partition computes a 0 m face while wave_period sits unused.
          swellPeriod: swellPeriod > 0 ? swellPeriod : wavePeriod,
          swellDirection: swellDir,
          secondarySwell: secondaryAt(src.marine, idx),
          windWaveHeight: windWaveH,
          windSpeed,
          // Direction unknown when the wind fetch had no entry for this hour —
          // score on speed alone rather than against a fabricated due-west wind.
          windDirection: wReal ? wReal.dir : null,
          spotFacing:    spot.facingDirection,
          bottomType:    spot.bottomType,
          difficulty:    spot.difficulty,
        })

        return {
          time,
          rating,
          ratingScore:        score,
          waveHeight,
          faceHeight,
          windSpeed,
          windDirectionLabel: degreesToCompass(w.dir ?? 270),
        }
      }),
    }
  })

  return NextResponse.json(
    { spots: spotsData, regionalSwell, date },
    { headers: cdnCacheHeaders(CACHE_MAX_AGE, CACHE_STALE_WHILE_REVALIDATE) }
  )
  } catch (error) {
    return handleRouteError(error, 'best_spots_error')
  }
}
