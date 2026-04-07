import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchBuoyData } from '@/lib/api/noaa-buoy'
import { fetchCurrentConditions } from '@/lib/api/open-meteo'
import { rateSurfConditions, computeWavePower } from '@/lib/forecast/rating'

export const revalidate = 1800
export const maxDuration = 60

// Race a promise against a timeout — returns null on timeout
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q') ?? ''
  const difficulty = searchParams.get('difficulty') ?? ''
  const country = searchParams.get('country') ?? ''
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

  // ── Stage 1: fetch all unique NOAA buoys in parallel (cached 30 min) ─────────
  const uniqueBuoyIds = [...new Set(spots.filter((s) => s.noaaBuoyId).map((s) => s.noaaBuoyId!))]
  const buoyResults = await Promise.all(
    uniqueBuoyIds.map((id) => withTimeout(fetchBuoyData(id), 6000))
  )
  const buoyMap = new Map<string, Awaited<ReturnType<typeof fetchBuoyData>>>()
  uniqueBuoyIds.forEach((id, i) => buoyMap.set(id, buoyResults[i]))

  // ── Stage 2: enrich spots using buoy readings ─────────────────────────────────
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

      // Buoy returned a real wave height (even 0.x is valid — calm day)
      if (buoy && buoy.waveHeight !== null && buoy.waveHeight !== undefined) {
        if (buoy.waveHeight > 0) {
          const { rating } = rateSurfConditions({
            waveHeight:    buoy.waveHeight,
            swellPeriod:   buoy.dominantPeriod ?? 8,
            swellHeight:   buoy.waveHeight * 0.75,
            windSpeed:     buoy.windSpeed ?? 8,
            windDirection: buoy.windDirection ?? 0,
            swellDirection: buoy.meanDirection,
            spotFacing:    spot.facingDirection,
          })
          return {
            ...spot,
            currentRating: rating,
            currentWaveHeight: buoy.waveHeight,
            currentPeriod: buoy.dominantPeriod,
            currentWindSpeed: buoy.windSpeed,
            wavePower: computeWavePower(buoy.waveHeight, buoy.dominantPeriod ?? 8),
            _needsFallback: false,
          }
        }
        // waveHeight === 0: buoy is working but it's flat
        return {
          ...spot, currentRating: 'poor', currentWaveHeight: 0,
          currentPeriod: null, currentWindSpeed: buoy.windSpeed, wavePower: 0,
          _needsFallback: false,
        }
      }

      // Buoy returned null for waveHeight (WVHT sensor is MM/offline) OR fetch failed
      // → use Open-Meteo as fallback so these spots still get data
      return {
        ...spot, currentRating: 'unknown', currentWaveHeight: null,
        currentPeriod: null, currentWindSpeed: null, wavePower: null,
        _needsFallback: true,
      }
    }

    // No buoy ID at all — need Open-Meteo
    return {
      ...spot, currentRating: 'unknown', currentWaveHeight: null,
      currentPeriod: null, currentWindSpeed: null, wavePower: null,
      _needsFallback: true,
    }
  })

  // ── Stage 3: Open-Meteo fallback for spots where buoy sensor was offline ──────
  const needFallback = enriched.filter((s) => s._needsFallback)

  if (needFallback.length > 0) {
    // De-duplicate by rounding lat/lng to 1 decimal (~11 km grid)
    const buckets = new Map<string, { lat: number; lng: number }>()
    for (const spot of needFallback) {
      const key = `${spot.lat.toFixed(1)},${spot.lng.toFixed(1)}`
      if (!buckets.has(key)) buckets.set(key, { lat: spot.lat, lng: spot.lng })
    }

    const bucketKeys = [...buckets.keys()]
    const omResults = await Promise.all(
      bucketKeys.map((k) => withTimeout(fetchCurrentConditions(buckets.get(k)!.lat, buckets.get(k)!.lng), 6000))
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
        spot.currentRating = rating
        spot.currentWaveHeight = om.waveHeight
        spot.currentPeriod = om.wavePeriod
        spot.currentWindSpeed = om.windSpeed
        spot.wavePower = computeWavePower(om.waveHeight, om.wavePeriod)
      }
    }
  }

  const response = enriched.map(({ _needsFallback: _, ...rest }) => rest)
  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=900' },
  })
}
