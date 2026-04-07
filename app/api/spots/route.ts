import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchBuoyData } from '@/lib/api/noaa-buoy'
import { fetchCurrentConditions } from '@/lib/api/open-meteo'
import { rateSurfConditions, computeWavePower } from '@/lib/forecast/rating'

export const revalidate = 1800
export const maxDuration = 60

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search     = searchParams.get('q') ?? ''
  const difficulty = searchParams.get('difficulty') ?? ''
  const country    = searchParams.get('country') ?? ''
  const withConditions = searchParams.get('withConditions') === 'true'

  const spots = await prisma.surfSpot.findMany({
    where: {
      AND: [
        search ? { OR: [
          { name: { contains: search } },
          { region: { contains: search } },
          { country: { contains: search } },
        ]} : {},
        difficulty ? { difficulty } : {},
        country ? { country } : {},
      ],
    },
    orderBy: { name: 'asc' },
  })

  if (!withConditions) return NextResponse.json(spots)

  // ── Build lat/lng buckets for ALL spots (1-decimal ≈ 11 km grid) ─────────────
  // We fetch Open-Meteo marine current at each unique coordinate — this is the
  // SAME data source the individual forecast pages use, so node and page agree.
  const bucketMap = new Map<string, { lat: number; lng: number }>()
  for (const spot of spots) {
    const key = `${spot.lat.toFixed(1)},${spot.lng.toFixed(1)}`
    if (!bucketMap.has(key)) bucketMap.set(key, { lat: spot.lat, lng: spot.lng })
  }
  const bucketKeys = [...bucketMap.keys()]

  // ── Unique buoy IDs (for supplementary wind / period data) ───────────────────
  const uniqueBuoyIds = [...new Set(spots.filter((s) => s.noaaBuoyId).map((s) => s.noaaBuoyId!))]

  // ── Fetch everything in parallel ─────────────────────────────────────────────
  const [omResults, buoyResults] = await Promise.all([
    // Open-Meteo marine current — primary wave height source (matches forecast page)
    Promise.all(bucketKeys.map((k) =>
      withTimeout(fetchCurrentConditions(bucketMap.get(k)!.lat, bucketMap.get(k)!.lng), 8000)
    )),
    // NOAA buoys — supplementary wind speed / swell period
    Promise.all(uniqueBuoyIds.map((id) => withTimeout(fetchBuoyData(id), 6000))),
  ])

  const omMap = new Map<string, Awaited<ReturnType<typeof fetchCurrentConditions>>>()
  bucketKeys.forEach((k, i) => omMap.set(k, omResults[i]))

  const buoyMap = new Map<string, Awaited<ReturnType<typeof fetchBuoyData>>>()
  uniqueBuoyIds.forEach((id, i) => buoyMap.set(id, buoyResults[i]))

  // ── Enrich each spot ──────────────────────────────────────────────────────────
  type EnrichedSpot = (typeof spots)[0] & {
    currentRating: string
    currentWaveHeight: number | null
    currentPeriod: number | null
    currentWindSpeed: number | null
    wavePower: number | null
  }

  const enriched: EnrichedSpot[] = spots.map((spot) => {
    const key  = `${spot.lat.toFixed(1)},${spot.lng.toFixed(1)}`
    const om   = omMap.get(key) ?? null
    const buoy = spot.noaaBuoyId ? (buoyMap.get(spot.noaaBuoyId) ?? null) : null

    // Wave height — always from Open-Meteo at spot coordinates (matches forecast page)
    const waveHeight = om?.waveHeight ?? null

    // Period — prefer buoy (more accurate offshore reading), fall back to Open-Meteo
    const period = (buoy?.dominantPeriod ?? null) ?? (om?.wavePeriod ?? null)

    // Wind — prefer buoy, fall back to Open-Meteo estimate
    const windSpeed = buoy?.windSpeed ?? om?.windSpeed ?? null
    const windDir   = buoy?.windDirection ?? om?.windDirection ?? 270

    if (waveHeight === null) {
      return {
        ...spot, currentRating: 'unknown', currentWaveHeight: null,
        currentPeriod: null, currentWindSpeed: null, wavePower: null,
      }
    }

    if (waveHeight === 0) {
      return {
        ...spot, currentRating: 'poor', currentWaveHeight: 0,
        currentPeriod: period, currentWindSpeed: windSpeed, wavePower: 0,
      }
    }

    const { rating } = rateSurfConditions({
      waveHeight,
      swellPeriod:   period ?? 8,
      swellHeight:   waveHeight * 0.7,
      windSpeed:     windSpeed ?? 8,
      windDirection: windDir,
      swellDirection: om?.swellDirection ?? 270,
      spotFacing:    spot.facingDirection,
    })

    return {
      ...spot,
      currentRating: rating,
      currentWaveHeight: waveHeight,
      currentPeriod: period,
      currentWindSpeed: windSpeed,
      wavePower: computeWavePower(waveHeight, period ?? 8),
    }
  })

  // ── Nearest-neighbor fallback — guarantee zero gray nodes ─────────────────────
  // If Open-Meteo returned null for a bucket (e.g. request timed out), copy from
  // the closest spot that has real data. Surf conditions are nearly identical
  // within a few miles so this is a reasonable estimate.
  const withData = enriched.filter((s) => s.currentWaveHeight !== null)

  for (const spot of enriched) {
    if (spot.currentWaveHeight !== null) continue
    if (withData.length === 0) continue

    let closest = withData[0]
    let minDist = Infinity
    for (const s of withData) {
      const d = Math.hypot(s.lat - spot.lat, s.lng - spot.lng)
      if (d < minDist) { minDist = d; closest = s }
    }

    const wh     = closest.currentWaveHeight ?? 0
    const period = closest.currentPeriod ?? 8
    const { rating } = rateSurfConditions({
      waveHeight: wh, swellPeriod: period, swellHeight: wh * 0.7,
      windSpeed: closest.currentWindSpeed ?? 8, windDirection: 270,
      swellDirection: 270, spotFacing: spot.facingDirection,
    })
    spot.currentRating     = rating
    spot.currentWaveHeight = wh
    spot.currentPeriod     = period
    spot.currentWindSpeed  = closest.currentWindSpeed
    spot.wavePower         = computeWavePower(wh, period)
  }

  return NextResponse.json(enriched, {
    headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=900' },
  })
}
