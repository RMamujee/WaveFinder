import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchBuoyData } from '@/lib/api/noaa-buoy'
import { fetchCurrentConditions } from '@/lib/api/open-meteo'
import { rateSurfConditions, computeWavePower } from '@/lib/forecast/rating'

export const revalidate = 1800
export const maxDuration = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q') ?? ''
  const difficulty = searchParams.get('difficulty') ?? ''
  const country = searchParams.get('country') ?? ''
  const withConditions = searchParams.get('withConditions') === 'true'

  const spots = await prisma.surfSpot.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search } },
                { region: { contains: search } },
                { country: { contains: search } },
              ],
            }
          : {},
        difficulty ? { difficulty } : {},
        country ? { country } : {},
      ],
    },
    orderBy: { name: 'asc' },
  })

  if (!withConditions) return NextResponse.json(spots)

  // ── Stage 1: batch-fetch unique NOAA buoys in parallel ───────────────────────
  // With 15 unique buoy IDs across 134 spots, this is 15 parallel fetches.
  // Each buoy response is cached 30 min by Next.js fetch cache.
  const uniqueBuoyIds = [...new Set(spots.filter((s) => s.noaaBuoyId).map((s) => s.noaaBuoyId!))]

  // Race each buoy fetch against a 6s timeout so a slow/down buoy doesn't stall everything
  const withTimeout = (p: Promise<unknown>, ms: number) =>
    Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))])

  const buoyResults = await Promise.all(
    uniqueBuoyIds.map((id) => withTimeout(fetchBuoyData(id), 6000))
  )
  const buoyMap = new Map<string, Awaited<ReturnType<typeof fetchBuoyData>>>()
  uniqueBuoyIds.forEach((id, i) => {
    buoyMap.set(id, buoyResults[i] as Awaited<ReturnType<typeof fetchBuoyData>>)
  })

  // ── Stage 2: enrich each spot from its buoy reading ──────────────────────────
  // Key rule: if a spot HAS a buoy ID, trust the buoy (even waveHeight = 0 means
  // calm / flat). Only use Open-Meteo fallback for the rare spots with NO buoy ID.
  type EnrichedSpot = (typeof spots)[0] & {
    currentRating: string
    currentWaveHeight: number | null
    currentPeriod: number | null
    currentWindSpeed: number | null
    wavePower: number | null
    _needsFallback: boolean
  }

  const enriched: EnrichedSpot[] = spots.map((spot) => {
    // Spots WITH a buoy ID — always use buoy data, never fall back to Open-Meteo
    if (spot.noaaBuoyId) {
      const buoy = buoyMap.get(spot.noaaBuoyId) ?? null

      if (buoy && buoy.waveHeight > 0) {
        const { rating } = rateSurfConditions({
          waveHeight:     buoy.waveHeight,
          swellPeriod:    buoy.dominantPeriod,
          swellHeight:    buoy.waveHeight * 0.75,
          windSpeed:      buoy.windSpeed ?? 8,
          windDirection:  buoy.windDirection ?? 0,
          swellDirection: buoy.meanDirection,
          spotFacing:     spot.facingDirection,
        })
        return {
          ...spot,
          currentRating: rating,
          currentWaveHeight: buoy.waveHeight,
          currentPeriod: buoy.dominantPeriod,
          currentWindSpeed: buoy.windSpeed,
          wavePower: computeWavePower(buoy.waveHeight, buoy.dominantPeriod),
          _needsFallback: false,
        }
      }

      // Buoy fetch failed or returned 0 — mark as poor/flat, no Open-Meteo needed
      return {
        ...spot,
        currentRating: buoy !== null ? 'poor' : 'unknown',
        currentWaveHeight: buoy !== null ? 0 : null,
        currentPeriod: null,
        currentWindSpeed: null,
        wavePower: null,
        _needsFallback: false,
      }
    }

    // Spots with NO buoy ID — need Open-Meteo fallback
    return {
      ...spot,
      currentRating: 'unknown',
      currentWaveHeight: null,
      currentPeriod: null,
      currentWindSpeed: null,
      wavePower: null,
      _needsFallback: true,
    }
  })

  // ── Stage 3: Open-Meteo only for the small number of no-buoy spots ────────────
  const needFallback = enriched.filter((s) => s._needsFallback)

  if (needFallback.length > 0) {
    // De-duplicate by rounding to 1 decimal degree (~11 km grid)
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
    bucketKeys.forEach((k, i) => {
      omMap.set(k, omResults[i] as Awaited<ReturnType<typeof fetchCurrentConditions>>)
    })

    for (const spot of enriched) {
      if (!spot._needsFallback) continue
      const key = `${spot.lat.toFixed(1)},${spot.lng.toFixed(1)}`
      const om = omMap.get(key)
      if (om && om.waveHeight > 0) {
        const { rating } = rateSurfConditions({
          waveHeight:     om.waveHeight,
          swellPeriod:    om.wavePeriod,
          swellHeight:    om.waveHeight * 0.7,
          windSpeed:      om.windSpeed,
          windDirection:  om.windDirection,
          swellDirection: om.swellDirection,
          spotFacing:     spot.facingDirection,
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
    headers: {
      // Serve cached data immediately; refresh in background after 15 min
      'Cache-Control': 's-maxage=900, stale-while-revalidate=900',
    },
  })
}
