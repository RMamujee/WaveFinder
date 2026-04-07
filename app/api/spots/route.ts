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

  // ── Stage 1: batch-fetch NOAA buoys ──────────────────────────────────────────
  const uniqueBuoyIds = [...new Set(spots.filter((s) => s.noaaBuoyId).map((s) => s.noaaBuoyId!))]
  const buoyResults = await Promise.allSettled(uniqueBuoyIds.map((id) => fetchBuoyData(id)))
  const buoyMap = new Map<string, Awaited<ReturnType<typeof fetchBuoyData>>>()
  uniqueBuoyIds.forEach((id, i) => {
    const r = buoyResults[i]
    if (r.status === 'fulfilled') buoyMap.set(id, r.value)
  })

  // ── Stage 2: identify spots still missing a wave height ───────────────────────
  // Build initial enrichment; collect spots that need an Open-Meteo fallback
  type EnrichedSpot = (typeof spots)[0] & {
    currentRating: string
    currentWaveHeight: number | null
    currentPeriod: number | null
    currentWindSpeed: number | null
    wavePower: number | null
    _needsFallback: boolean
  }

  const enriched: EnrichedSpot[] = spots.map((spot) => {
    const buoy = spot.noaaBuoyId ? buoyMap.get(spot.noaaBuoyId) ?? null : null
    const hasValidBuoy = buoy !== null && buoy.waveHeight > 0

    if (hasValidBuoy) {
      const { rating } = rateSurfConditions({
        waveHeight:     buoy!.waveHeight,
        swellPeriod:    buoy!.dominantPeriod,
        swellHeight:    buoy!.waveHeight * 0.75,
        windSpeed:      buoy!.windSpeed ?? 10,
        windDirection:  buoy!.windDirection ?? 0,
        swellDirection: buoy!.meanDirection,
        spotFacing:     spot.facingDirection,
      })
      return {
        ...spot,
        currentRating: rating,
        currentWaveHeight: buoy!.waveHeight,
        currentPeriod: buoy!.dominantPeriod,
        currentWindSpeed: buoy!.windSpeed,
        wavePower: computeWavePower(buoy!.waveHeight, buoy!.dominantPeriod),
        _needsFallback: false,
      }
    }

    return { ...spot, currentRating: 'unknown', currentWaveHeight: null, currentPeriod: null, currentWindSpeed: null, wavePower: null, _needsFallback: true }
  })

  // ── Stage 3: Open-Meteo fallback for spots with no buoy reading ───────────────
  const needFallback = enriched.filter((s) => s._needsFallback)

  if (needFallback.length > 0) {
    // De-duplicate by rounding lat/lng to 1 decimal (~11 km grid) to avoid redundant calls
    const buckets = new Map<string, { lat: number; lng: number }>()
    for (const spot of needFallback) {
      const key = `${(spot.lat).toFixed(1)},${(spot.lng).toFixed(1)}`
      if (!buckets.has(key)) buckets.set(key, { lat: spot.lat, lng: spot.lng })
    }

    // Fetch Open-Meteo for each unique bucket in parallel
    const bucketKeys = [...buckets.keys()]
    const omResults = await Promise.allSettled(
      bucketKeys.map((k) => {
        const { lat, lng } = buckets.get(k)!
        return fetchCurrentConditions(lat, lng)
      })
    )
    const omMap = new Map<string, Awaited<ReturnType<typeof fetchCurrentConditions>>>()
    bucketKeys.forEach((k, i) => {
      const r = omResults[i]
      if (r.status === 'fulfilled') omMap.set(k, r.value)
    })

    // Apply Open-Meteo data to fallback spots
    for (const spot of enriched) {
      if (!spot._needsFallback) continue
      const key = `${(spot.lat).toFixed(1)},${(spot.lng).toFixed(1)}`
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

  // Strip internal flag before returning
  const response = enriched.map(({ _needsFallback: _, ...rest }) => rest)
  return NextResponse.json(response)
}
