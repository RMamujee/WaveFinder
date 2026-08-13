import { NextResponse } from 'next/server'
import { listSpots, conditionsBucketKey, conditionsBucketPoint } from '@/lib/spots/static-store'
import { monitor } from '@/lib/monitoring'
import type { SurfSpot } from '@/types/spot'
import { fetchCurrentConditionsBatch } from '@/lib/api/open-meteo'
import type { CurrentMarineConditions } from '@/lib/api/open-meteo'
import { rateSurfConditions, computeWavePower, degreesToCompass, angleDiff } from '@/lib/forecast/rating'
import type { SwellPartition } from '@/lib/forecast/rating'
import { buildSpatialIndex, findNearestInIndex } from '@/lib/forecast/nearest-fallback'
import { inferBottomType } from '@/lib/bottom-type'
import { cdnCacheHeaders } from '@/lib/route-helpers'

export const maxDuration = 60

// A borrowed reading is an approximation, not a measurement. Past these bounds
// it is an invention: simulated against the dataset, 94 spots would otherwise
// borrow from >100 km away, including across basins (Gulf of Thailand ←
// Andaman Sea, Lake Erie ← Lake Ontario). Facing is the cheap proxy for "is
// exposed to the same swell window".
const FALLBACK_MAX_KM = 50
const FALLBACK_MAX_FACING_DIFF = 45

// Above this share of `unknown` ratings the sweep is treated as degraded and
// cached only briefly — see the return at the bottom of the conditions path.
const DEGRADED_UNKNOWN_SHARE = 0.25

interface Bbox { minLat: number; minLng: number; maxLat: number; maxLng: number; wraps: boolean }

/**
 * `bbox=minLat,minLng,maxLat,maxLng` — restrict a conditions request to the
 * area the map is actually showing.
 *
 * THIS IS A BUDGET CONTROL, NOT AN OPTIMISATION. Open-Meteo bills a
 * multi-location request per location, so an unscoped conditions sweep costs
 * 1,194 marine + 1,194 weather = ~2,388 calls against a free tier of 600/min,
 * 5,000/hour and 10,000/day. With the route's own `s-maxage=180` that is up to
 * ~48,000 calls/hour, ~9.6x the hourly allowance, and the whole daily budget
 * inside about four cold sweeps. Past that the fan-out is refused wholesale and
 * every pin on the map renders grey while individual spot pages — one location
 * each — keep working, which is exactly how this failed in production.
 *
 * A viewport at the home map's default zoom is ~80 buckets, i.e. ~160 calls,
 * comfortably inside the allowance. No retry policy or concurrency cap can
 * substitute for this; they only decide how a sweep degrades once it is over
 * budget.
 *
 * Longitudes are normalised into [-180, 180] because Leaflet's worldCopyJump
 * reports bounds off the edge of the world after a pan across the dateline; a
 * box that crosses the antimeridian arrives with minLng > maxLng and is matched
 * as a union of two spans rather than an empty one.
 */
function parseBbox(raw: string | null): Bbox | null {
  if (!raw) return null
  const parts = raw.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [minLat, rawMinLng, maxLat, rawMaxLng] = parts
  if (minLat > maxLat || minLat < -90 || maxLat > 90) return null
  // A span of a full turn or more is the whole world — no point filtering.
  if (Math.abs(rawMaxLng - rawMinLng) >= 360) return null
  const norm = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180
  const minLng = norm(rawMinLng)
  const maxLng = norm(rawMaxLng)
  return { minLat, minLng, maxLat, maxLng, wraps: minLng > maxLng }
}

function inBbox(spot: { lat: number; lng: number }, b: Bbox): boolean {
  if (spot.lat < b.minLat || spot.lat > b.maxLat) return false
  return b.wraps
    ? spot.lng >= b.minLng || spot.lng <= b.maxLng
    : spot.lng >= b.minLng && spot.lng <= b.maxLng
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  // Sanitize: strip SQL wildcard chars that could widen LIKE matches
  const search     = (searchParams.get('q') ?? '').slice(0, 200).replace(/[%_\\]/g, '')
  const VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced', 'expert'])
  const rawDiff    = searchParams.get('difficulty') ?? ''
  const difficulty = VALID_DIFFICULTIES.has(rawDiff) ? rawDiff : ''
  const country    = (searchParams.get('country') ?? '').slice(0, 100).replace(/[%_\\]/g, '')
  // Accept both slug-shaped tokens (spots are now keyed by slug in the
  // in-memory store) and legacy cuid-shaped tokens (saved-spot localStorage
  // still holds prod cuids until the client migration runs). Slugs resolve via
  // the store; cuids fall through to the Postgres fallback below. The widened
  // pattern (lowercase alnum + hyphen, ≤120) is a superset of the old cuid
  // pattern, so cuids keep validating.
  const ids        = (searchParams.get('ids') ?? '').split(',')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}$/i.test(s))
    .slice(0, 50)
  const withConditions = searchParams.get('withConditions') === 'true'
  const bbox = parseBbox(searchParams.get('bbox'))
  // ?slim=true returns only the fields needed to render markers on a map.
  // Cuts the home payload from ~500 KB to ~150 KB so first paint on mobile
  // is faster.
  const slim = searchParams.get('slim') === 'true'

  // Resolve from the in-memory static store. The store's `id` is the slug, so
  // an ids= filter matches slug-shaped tokens; cuid-shaped tokens never match
  // the store and fall through to the Postgres fallback below.
  let spots: SurfSpot[]
  try {
    spots = listSpots({ q: search, difficulty, country, ids: ids.length ? ids : undefined })

    // Transitional cuid fallback: any ids the store couldn't resolve are looked
    // up in Postgres (legacy saved-spot cuids). Disabled for slim/condition
    // paths only insofar as those never pass ids=.
    if (ids.length) {
      const resolved = new Set(spots.map((s) => s.id))
      const unresolved = ids.filter((id) => !resolved.has(id))
      if (unresolved.length) {
        // Telemetry: residual cuid traffic still hitting Postgres. Tracks how
        // much the client-side slug migration has drained so the transitional
        // cuid bridge (and the SurfSpot table) can be retired in a follow-up.
        monitor('info', 'spots.ids.cuid_resolved', { count: unresolved.length })
        // Imported here, not at module scope. A top-level import constructs a
        // PrismaClient on every cold start of the app's hottest route — for a
        // bridge whose telemetry is meant to read ~0 — and the map's first
        // paint waits on it. Nothing else in this route touches Postgres.
        const { prisma } = await import('@/lib/prisma')
        const dbSpots = await prisma.surfSpot.findMany({
          where: {
            AND: [
              { id: { in: unresolved } },
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
        const merged: SurfSpot[] = [
          ...spots,
          ...dbSpots.map((s): SurfSpot => ({
            id: s.id,
            slug: s.slug,
            name: s.name,
            region: s.region,
            country: s.country,
            lat: s.lat,
            lng: s.lng,
            description: s.description,
            difficulty: s.difficulty as SurfSpot['difficulty'],
            facingDirection: s.facingDirection,
            noaaTideStationId: s.noaaTideStationId,
            noaaBuoyId: s.noaaBuoyId,
            webcamUrl: s.webcamUrl,
            webcamType: s.webcamType,
            parkingOptions: s.parkingOptions as SurfSpot['parkingOptions'],
            bottomType: inferBottomType(s.description ?? null, s.name),
          })),
        ]
        merged.sort((a, b) => a.name.localeCompare(b.name))
        spots = merged
      }
    }
  } catch (err) {
    console.error('[api/spots] listSpots failed', err)
    return NextResponse.json({ error: 'Failed to load spots' }, { status: 500 })
  }

  if (!withConditions) {
    if (slim) {
      // Match the previous Prisma slim projection field-for-field.
      const slimSpots = spots.map((s) => ({
        id: s.id, slug: s.slug, name: s.name, region: s.region, country: s.country,
        lat: s.lat, lng: s.lng, difficulty: s.difficulty, facingDirection: s.facingDirection,
      }))
      return NextResponse.json(slimSpots, { headers: cdnCacheHeaders(600, 1800) })
    }
    // Store spots already carry precomputed bottomType; DB-fallback spots get
    // it set where they're merged above — so no re-map is needed here.
    return NextResponse.json(spots, { headers: cdnCacheHeaders(600, 1800) })
  }

  // ── Conditions: Open-Meteo current conditions at actual beach coordinates ─────
  // Open-Meteo's nearshore marine model is the same source used by the individual
  // spot forecast pages, so map node heights are always consistent with the
  // forecast you see after clicking through. Offshore buoys with attenuation
  // factors were producing values that diverged from the per-spot forecast.
  //
  // Spots within ~5.5 km of each other share one reading (0.05° lat/lng
  // bucket, down from 0.1° — see CONDITIONS_BUCKET_DEG). fetchCurrentConditionsBatch
  // sends the misses as multi-location requests of 50 coordinates each rather
  // than one request per coordinate, and its runtime cache turns repeat
  // requests within 5 min into instant hits.
  //
  // The representative coordinate comes from the full dataset, so it does not
  // shift when the caller filters by difficulty/country — which previously
  // changed both the conditions and the cache key for 229 spots.
  // Scope to the visible area before any upstream work is planned. The client
  // merges this projection onto the full spot list it already holds, so spots
  // outside the box keep their pins — they just carry no rating until they are
  // panned into view.
  if (bbox) spots = spots.filter((s) => inBbox(s, bbox))

  const buckets = new Map<string, { lat: number; lng: number }>()
  for (const spot of spots) {
    const key = conditionsBucketKey(spot.lat, spot.lng)
    if (!buckets.has(key)) buckets.set(key, conditionsBucketPoint(spot.lat, spot.lng))
  }
  const bucketKeys = [...buckets.keys()]

  const omResults = await fetchCurrentConditionsBatch(
    bucketKeys.map((k) => buckets.get(k)!)
  ).catch(() => bucketKeys.map(() => null))

  const omMap = new Map<string, CurrentMarineConditions | null>()
  bucketKeys.forEach((k, i) => omMap.set(k, omResults[i] ?? null))

  type EnrichedSpot = (typeof spots)[0] & {
    currentRating: string
    currentWaveHeight: number | null
    currentFaceHeight: number | null
    currentPeriod: number | null
    currentWindSpeed: number | null
    currentWindDirection: number | null
    wavePower: number | null
    _needsFallback: boolean
    // Internal only — the response projection below is an allow-list, so these
    // never reach the client. They exist so a fallback borrows the neighbour's
    // actual sea state rather than a flattened summary of it.
    _conditions: CurrentMarineConditions | null
  }

  // Wave power is the sum over partitions: charging the whole sea at the
  // groundswell's period overstated mixed seas by up to 2x, and the map popup
  // renders this number directly.
  function powerOf(om: CurrentMarineConditions): number {
    return computeWavePower([
      { height: om.swellHeight > 0 ? om.swellHeight : om.waveHeight, period: om.swellPeriod > 0 ? om.swellPeriod : om.wavePeriod },
      { height: om.secondarySwellHeight, period: om.secondarySwellPeriod },
      { height: om.windWaveHeight, period: om.windWavePeriod },
    ])
  }

  function secondaryOf(om: CurrentMarineConditions): SwellPartition | null {
    return om.secondarySwellHeight != null && om.secondarySwellHeight > 0
      && om.secondarySwellPeriod != null && om.secondarySwellPeriod > 0
      ? {
          height: om.secondarySwellHeight,
          period: om.secondarySwellPeriod,
          direction: om.secondarySwellDirection,
        }
      : null
  }

  const enriched: EnrichedSpot[] = spots.map((spot) => {
    const key = conditionsBucketKey(spot.lat, spot.lng)
    const om = omMap.get(key)

    if (om && om.waveHeight > 0) {
      // Real swell/windsea partition from the model — no more `waveHeight * 0.7`
      // stand-in, which made every spot look like it had 70% clean groundswell.
      const { rating, faceHeight } = rateSurfConditions({
        waveHeight:     om.waveHeight,
        swellHeight:    om.swellHeight,
        swellPeriod:    om.swellPeriod > 0 ? om.swellPeriod : om.wavePeriod,
        swellDirection: om.swellDirection,
        secondarySwell: secondaryOf(om),
        windWaveHeight: om.windWaveHeight,
        windSpeed:      om.windSpeed,
        windDirection:  om.windDirection,
        spotFacing:     spot.facingDirection,
        bottomType:     spot.bottomType,
        difficulty:     spot.difficulty,
      })
      return {
        ...spot,
        currentRating:        rating,
        currentWaveHeight:    om.waveHeight,
        currentFaceHeight:    faceHeight,
        currentPeriod:        om.wavePeriod,
        currentWindSpeed:     om.windSpeed,
        currentWindDirection: om.windDirection,
        wavePower:            powerOf(om),
        _needsFallback:       false,
        _conditions:          om,
      }
    }

    // om returned an object but waveHeight === 0 → genuinely flat
    // om === null → API timeout/error → use nearest-neighbour below
    return {
      ...spot,
      currentRating:        om ? 'poor' : 'unknown',
      currentWaveHeight:    om ? 0 : null,
      currentFaceHeight:    om ? 0 : null,
      currentPeriod:        null,
      currentWindSpeed:     null,
      currentWindDirection: null,
      wavePower:            om ? 0 : null,
      _needsFallback:       om === null,
      _conditions:          om ?? null,
    }
  })

  // ── Nearest-neighbour fallback — no permanently-grey nodes ───────────────────
  // Only fires for spots where Open-Meteo timed out (not for genuine flat days).
  // Spatial-grid lookup keeps this cheap when the upstream API degrades; spots
  // with no acceptable neighbour stay "unknown" rather than borrowing
  // conditions from a different coastline.
  const withData = enriched.filter((s) => s._conditions !== null)
  const dataIndex = buildSpatialIndex(withData)
  for (const spot of enriched) {
    if (spot.currentWaveHeight !== null) continue
    const closest = findNearestInIndex(dataIndex, spot.lat, spot.lng, {
      maxDistanceKm: FALLBACK_MAX_KM,
      accept: (c) =>
        angleDiff(c.facingDirection, spot.facingDirection) <= FALLBACK_MAX_FACING_DIFF,
    })
    if (!closest?._conditions) continue
    const om = closest._conditions
    const period = om.swellPeriod > 0 ? om.swellPeriod : om.wavePeriod
    // Borrow the neighbour's *observed* wind direction. This used to hardcode
    // 270, so every fallback spot on Earth was scored against a due-west wind —
    // which reads as perfectly offshore for an east-facing coast and dead
    // onshore for a west-facing one, purely by accident of geography.
    const windDirection = om.windDirection
    const { rating, faceHeight } = rateSurfConditions({
      waveHeight: om.waveHeight,
      swellHeight: om.swellHeight,
      swellPeriod: period,
      // Borrow the neighbour's swell DIRECTION too and score it against THIS
      // spot's facing — exactly what already happens for the borrowed wind.
      // Passing null instead handed every fallback spot a neutral exposure of
      // 1.0, i.e. the maximum possible face height precisely where the data is
      // least reliable.
      swellDirection: om.swellDirection,
      secondarySwell: secondaryOf(om),
      windWaveHeight: om.windWaveHeight,
      windSpeed: om.windSpeed,
      windDirection,
      spotFacing: spot.facingDirection,
      bottomType: spot.bottomType,
      difficulty: spot.difficulty,
    })
    spot.currentRating        = rating
    spot.currentWaveHeight    = om.waveHeight
    spot.currentFaceHeight    = faceHeight
    spot.currentPeriod        = om.wavePeriod
    spot.currentWindSpeed     = om.windSpeed
    spot.currentWindDirection = windDirection
    spot.wavePower            = powerOf(om)
  }

  // A marker projection, not a full spot record. /spots merges this onto the
  // full list it already fetched; the home map renders from it directly, so it
  // carries every field the map and its popups read and drops the rest.
  // Measured against prod (582 US spots, 394 KB): `description` alone was 27%
  // of the payload, and the webcam/NOAA-station ids another 13% — none of which
  // any map surface reads. Adding a field to the map means adding it here.
  const response = enriched.map((spot) => ({
    id:              spot.id,
    slug:            spot.slug,
    name:            spot.name,
    region:          spot.region,
    country:         spot.country,
    lat:             spot.lat,
    lng:             spot.lng,
    difficulty:      spot.difficulty,
    facingDirection: spot.facingDirection,
    bottomType:      spot.bottomType,
    parkingOptions:  spot.parkingOptions,
    currentRating:      spot.currentRating,
    currentWaveHeight:  spot.currentWaveHeight,
    currentFaceHeight:  spot.currentFaceHeight,
    currentPeriod:      spot.currentPeriod,
    currentWindSpeed:   spot.currentWindSpeed,
    // Compass label rather than degrees: the map popup reads `currentWindDir`
    // and has been rendering an empty string, because the route only ever sent
    // the numeric `currentWindDirection` under a different name.
    currentWindDir:     spot.currentWindDirection != null
      ? degreesToCompass(spot.currentWindDirection)
      : null,
    wavePower:          spot.wavePower,
  }))
  // A long stale window is the point: conditions up to 15 min old served
  // instantly beat a 5 s block on a cold Open-Meteo fan-out, and the client
  // refetches every 5 min anyway.
  //
  // UNLESS THE SWEEP CAME BACK MOSTLY EMPTY. That same long window is what
  // turned one refused fan-out into a map that stayed grey for a quarter of an
  // hour for every visitor, and the client refetching against a pinned edge
  // entry could not clear it — the response looked like a successful one. A
  // degraded sweep is cached just long enough to absorb a thundering herd, then
  // allowed to retry.
  const unknownCount = response.filter((s) => s.currentRating === 'unknown').length
  const degraded = response.length > 0 && unknownCount / response.length > DEGRADED_UNKNOWN_SHARE
  if (degraded) {
    monitor('warn', 'spots.conditions.degraded', {
      unknown: unknownCount,
      total: response.length,
      buckets: bucketKeys.length,
      scoped: !!bbox,
    })
  }
  return NextResponse.json(response, {
    headers: degraded ? cdnCacheHeaders(20, 60) : cdnCacheHeaders(180, 900),
  })
}
