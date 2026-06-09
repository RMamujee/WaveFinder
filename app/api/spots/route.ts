import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchCurrentConditions } from '@/lib/api/open-meteo'
import { rateSurfConditions, computeWavePower } from '@/lib/forecast/rating'
import { buildSpatialIndex, findNearestInIndex } from '@/lib/forecast/nearest-fallback'
import { inferBottomType } from '@/lib/bottom-type'

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
  // ?slim=true returns only the fields needed to render markers on a map.
  // Cuts the home payload from ~500 KB to ~150 KB so first paint on mobile
  // is faster.
  const slim = searchParams.get('slim') === 'true'

  let spots
  try {
    spots = await prisma.surfSpot.findMany({
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
      ...(slim ? {
        select: {
          id: true, slug: true, name: true, region: true, country: true,
          lat: true, lng: true, difficulty: true, facingDirection: true,
        },
      } : {}),
    })
  } catch (err) {
    console.error('[api/spots] findMany failed', err)
    return NextResponse.json({ error: 'Failed to load spots' }, { status: 500 })
  }

  if (!withConditions) {
    if (slim) {
      return NextResponse.json(spots, {
        headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' },
      })
    }
    return NextResponse.json(spots.map(s => ({
      ...s,
      bottomType: inferBottomType(s.description ?? null, s.name),
    })), {
      headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' },
    })
  }

  // ── Conditions: Open-Meteo current conditions at actual beach coordinates ─────
  // Open-Meteo's nearshore marine model is the same source used by the individual
  // spot forecast pages, so map node heights are always consistent with the
  // forecast you see after clicking through. Offshore buoys with attenuation
  // factors were producing values that diverged from the per-spot forecast.
  //
  // Spots within ~11 km of each other share one API call (1-decimal lat/lng bucket).
  // 212 spots → ~100–130 unique buckets.  The in-memory cache in fetchCurrentConditions
  // turns subsequent requests (within 5 min on the same warm instance) into instant hits.
  const buckets = new Map<string, { lat: number; lng: number }>()
  for (const spot of spots) {
    const key = `${spot.lat.toFixed(1)},${spot.lng.toFixed(1)}`
    if (!buckets.has(key)) buckets.set(key, { lat: spot.lat, lng: spot.lng })
  }
  const bucketKeys = [...buckets.keys()]

  // Process in batches of 40.  Each call times out at 5 s, so worst-case a
  // batch of 40 takes 5 s.  ~120 unique buckets → 3 batches → ≤15 s total.
  const BATCH = 40
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
  // Spatial-grid lookup keeps this cheap when the upstream API degrades; spots
  // with no data within ~300 km stay "unknown" rather than borrowing conditions
  // from a different coastline.
  const withData = enriched.filter((s) => s.currentWaveHeight !== null)
  const dataIndex = buildSpatialIndex(withData)
  for (const spot of enriched) {
    if (spot.currentWaveHeight !== null) continue
    const closest = findNearestInIndex(dataIndex, spot.lat, spot.lng)
    if (!closest) continue
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

  const response = enriched.map((spot) => {
    const { _needsFallback, ...rest } = spot
    void _needsFallback
    return { ...rest, bottomType: inferBottomType(rest.description, rest.name) }
  })
  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=180, stale-while-revalidate=60' },
  })
}
