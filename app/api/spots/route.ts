import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchCurrentConditions } from '@/lib/api/open-meteo'
import { rateSurfConditions, computeWavePower } from '@/lib/forecast/rating'

export const dynamic = 'force-dynamic'
export const maxDuration = 60


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  // Sanitize: strip SQL wildcard chars that could widen LIKE matches
  const search     = (searchParams.get('q') ?? '').slice(0, 200).replace(/[%_\\]/g, '')
  const VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced'])
  const rawDiff    = searchParams.get('difficulty') ?? ''
  const difficulty = VALID_DIFFICULTIES.has(rawDiff) ? rawDiff : ''
  const country    = (searchParams.get('country') ?? '').slice(0, 100).replace(/[%_\\]/g, '')
  // Validate each ID looks like a cuid/uuid before querying
  const ids        = (searchParams.get('ids') ?? '').split(',')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9]{20,36}$/i.test(s))
    .slice(0, 50)
  const withConditions = searchParams.get('withConditions') === 'true'

  const spots = await prisma.surfSpot.findMany({
    where: {
      AND: [
        ids.length ? { id: { in: ids } } : {},
        search ? { OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { region: { contains: search, mode: 'insensitive' } },
          { country: { contains: search, mode: 'insensitive' } },
        ]} : {},
        difficulty ? { difficulty } : {},
        country ? { country } : {},
      ],
    },
    orderBy: { name: 'asc' },
  })

  if (!withConditions) return NextResponse.json(spots)

  // ── Conditions: Open-Meteo current conditions at actual beach coordinates ─────
  // Open-Meteo's nearshore marine model is the same source used by the individual
  // spot forecast pages, so map node heights are always consistent with the
  // forecast you see after clicking through. Offshore buoys with attenuation
  // factors were producing values that diverged from the per-spot forecast.
  //
  // Spots within ~11 km of each other share one API call (1-decimal lat/lng bucket)
  // — this keeps parallel calls to ~35–50 for the full world dataset.
  const buckets = new Map<string, { lat: number; lng: number }>()
  for (const spot of spots) {
    const key = `${spot.lat.toFixed(1)},${spot.lng.toFixed(1)}`
    if (!buckets.has(key)) buckets.set(key, { lat: spot.lat, lng: spot.lng })
  }
  const bucketKeys = [...buckets.keys()]

  // Process in batches of 25 to avoid overwhelming Open-Meteo with too many
  // simultaneous connections from a single serverless function instance.
  const BATCH = 25
  const omResults: (Awaited<ReturnType<typeof fetchCurrentConditions>>)[] = []
  for (let i = 0; i < bucketKeys.length; i += BATCH) {
    const slice = bucketKeys.slice(i, i + BATCH)
    const batch = await Promise.all(
      slice.map((k) => fetchCurrentConditions(buckets.get(k)!.lat, buckets.get(k)!.lng)
        .catch(() => null))
    )
    omResults.push(...batch)
  }

  const omMap = new Map<string, Awaited<ReturnType<typeof fetchCurrentConditions>>>()
  bucketKeys.forEach((k, i) => omMap.set(k, omResults[i]))

  type EnrichedSpot = (typeof spots)[0] & {
    currentRating: string
    currentWaveHeight: number | null
    currentPeriod: number | null
    currentWindSpeed: number | null
    wavePower: number | null
    _needsFallback: boolean
  }

  const enriched: EnrichedSpot[] = spots.map((spot) => {
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
      return {
        ...spot,
        currentRating:     rating,
        currentWaveHeight: om.waveHeight,
        currentPeriod:     om.wavePeriod,
        currentWindSpeed:  om.windSpeed,
        wavePower:         computeWavePower(om.waveHeight, om.wavePeriod),
        _needsFallback:    false,
      }
    }

    // om returned an object but waveHeight === 0 → genuinely flat
    // om === null → API timeout/error → use nearest-neighbour below
    return {
      ...spot,
      currentRating:     om ? 'poor' : 'unknown',
      currentWaveHeight: om ? 0 : null,
      currentPeriod:     null,
      currentWindSpeed:  null,
      wavePower:         om ? 0 : null,
      _needsFallback:    om === null,
    }
  })

  // ── Nearest-neighbour fallback — no permanently-grey nodes ───────────────────
  // Only fires for spots where Open-Meteo timed out (not for genuine flat days).
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
      swellDirection: null, spotFacing: spot.facingDirection,
    })
    spot.currentRating     = rating
    spot.currentWaveHeight = wh
    spot.currentPeriod     = period
    spot.currentWindSpeed  = closest.currentWindSpeed
    spot.wavePower         = computeWavePower(wh, period)
  }

  const response = enriched.map(({ _needsFallback: _, ...rest }) => rest)
  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=180, stale-while-revalidate=60' },
  })
}
