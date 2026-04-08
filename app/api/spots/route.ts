import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchBuoyData } from '@/lib/api/noaa-buoy'
import { fetchCurrentConditions } from '@/lib/api/open-meteo'
import { rateSurfConditions, computeWavePower } from '@/lib/forecast/rating'

export const revalidate = 1800
export const maxDuration = 60

// Offshore NOAA buoys read open-ocean swell before it loses height approaching
// shore. Multiply by this factor to approximate nearshore surf height — keeps
// node labels consistent with the Open-Meteo nearshore forecast on each spot page.
const BUOY_NEARSHORE_FACTOR = 0.65

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search     = searchParams.get('q') ?? ''
  const difficulty = searchParams.get('difficulty') ?? ''
  const country    = searchParams.get('country') ?? ''
  const ids        = searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  const withConditions = searchParams.get('withConditions') === 'true'

  const spots = await prisma.surfSpot.findMany({
    where: {
      AND: [
        ids.length ? { id: { in: ids } } : {},
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

  // ── Stage 1: fetch the ~15 unique NOAA buoys in parallel ─────────────────────
  // Buoy fetches are few (15 unique IDs), fast, and cached 30 min by Next.js.
  const uniqueBuoyIds = [...new Set(spots.filter((s) => s.noaaBuoyId).map((s) => s.noaaBuoyId!))]
  const buoyResults = await Promise.all(
    uniqueBuoyIds.map((id) => withTimeout(fetchBuoyData(id), 6000))
  )
  const buoyMap = new Map<string, Awaited<ReturnType<typeof fetchBuoyData>>>()
  uniqueBuoyIds.forEach((id, i) => buoyMap.set(id, buoyResults[i]))

  // ── Stage 2: Open-Meteo fallback only for spots with no/offline buoy ─────────
  // Keep this set small to avoid hammering the API with 70+ parallel calls.
  type EnrichedSpot = (typeof spots)[0] & {
    currentRating: string
    currentWaveHeight: number | null
    currentPeriod: number | null
    currentWindSpeed: number | null
    wavePower: number | null
    _needsFallback: boolean
  }

  const enriched: EnrichedSpot[] = spots.map((spot) => {
    if (spot.noaaBuoyId) {
      const buoy = buoyMap.get(spot.noaaBuoyId) ?? null

      if (buoy && buoy.waveHeight !== null) {
        // Apply nearshore attenuation so node height matches the forecast page
        const nearshoreHeight = Math.round(buoy.waveHeight * BUOY_NEARSHORE_FACTOR * 10) / 10

        if (nearshoreHeight > 0) {
          const period = buoy.dominantPeriod ?? 8
          const { rating } = rateSurfConditions({
            waveHeight:    nearshoreHeight,
            swellPeriod:   period,
            swellHeight:   nearshoreHeight * 0.75,
            windSpeed:     buoy.windSpeed ?? 8,
            windDirection: buoy.windDirection ?? 270,
            swellDirection: buoy.meanDirection,
            spotFacing:    spot.facingDirection,
          })
          return {
            ...spot,
            currentRating: rating,
            currentWaveHeight: nearshoreHeight,
            currentPeriod: period,
            currentWindSpeed: buoy.windSpeed,
            wavePower: computeWavePower(nearshoreHeight, period),
            _needsFallback: false,
          }
        }

        // Buoy reports 0 — flat/calm
        return {
          ...spot, currentRating: 'poor', currentWaveHeight: 0,
          currentPeriod: null, currentWindSpeed: buoy.windSpeed,
          wavePower: 0, _needsFallback: false,
        }
      }

      // Buoy WVHT sensor offline (null) — fall through to Open-Meteo
      return {
        ...spot, currentRating: 'unknown', currentWaveHeight: null,
        currentPeriod: null, currentWindSpeed: null,
        wavePower: null, _needsFallback: true,
      }
    }

    // No buoy ID — fall through to Open-Meteo
    return {
      ...spot, currentRating: 'unknown', currentWaveHeight: null,
      currentPeriod: null, currentWindSpeed: null,
      wavePower: null, _needsFallback: true,
    }
  })

  // ── Stage 3: Open-Meteo for the small set with no buoy data ──────────────────
  const needFallback = enriched.filter((s) => s._needsFallback)

  if (needFallback.length > 0) {
    const buckets = new Map<string, { lat: number; lng: number }>()
    for (const spot of needFallback) {
      const key = `${spot.lat.toFixed(1)},${spot.lng.toFixed(1)}`
      if (!buckets.has(key)) buckets.set(key, { lat: spot.lat, lng: spot.lng })
    }
    const bucketKeys = [...buckets.keys()]
    const omResults = await Promise.all(
      bucketKeys.map((k) =>
        withTimeout(fetchCurrentConditions(buckets.get(k)!.lat, buckets.get(k)!.lng), 6000)
      )
    )
    const omMap = new Map<string, Awaited<ReturnType<typeof fetchCurrentConditions>>>()
    bucketKeys.forEach((k, i) => omMap.set(k, omResults[i]))

    for (const spot of enriched) {
      if (!spot._needsFallback) continue
      const key = `${spot.lat.toFixed(1)},${spot.lng.toFixed(1)}`
      const om = omMap.get(key)
      if (om && om.waveHeight > 0) {
        const { rating } = rateSurfConditions({
          waveHeight:    om.waveHeight,
          swellPeriod:   om.wavePeriod,
          swellHeight:   om.waveHeight * 0.7,
          windSpeed:     om.windSpeed,
          windDirection: om.windDirection,
          swellDirection: om.swellDirection,
          spotFacing:    spot.facingDirection,
        })
        spot.currentRating     = rating
        spot.currentWaveHeight = om.waveHeight
        spot.currentPeriod     = om.wavePeriod
        spot.currentWindSpeed  = om.windSpeed
        spot.wavePower         = computeWavePower(om.waveHeight, om.wavePeriod)
      }
    }
  }

  // ── Stage 4: nearest-neighbor guarantee — no gray nodes ──────────────────────
  const withData = enriched.filter((s) => s.currentWaveHeight !== null)
  for (const spot of enriched) {
    if (spot.currentWaveHeight !== null) continue
    if (withData.length === 0) continue
    let closest = withData[0], minDist = Infinity
    for (const s of withData) {
      const d = Math.hypot(s.lat - spot.lat, s.lng - spot.lng)
      if (d < minDist) { minDist = d; closest = s }
    }
    const wh = closest.currentWaveHeight ?? 0
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

  const response = enriched.map(({ _needsFallback: _, ...rest }) => rest)
  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=900' },
  })
}
