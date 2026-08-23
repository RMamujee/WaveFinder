import { NextResponse } from 'next/server'
import { getSpotBySlug } from '@/lib/spots/static-store'
import { fetchMarineForecast, fetchWindForecast } from '@/lib/api/open-meteo'
import { fetchTidePredictions, fetchCoastalWind } from '@/lib/api/noaa-tides'
import { fetchBuoyData } from '@/lib/api/noaa-buoy'
import { mergeForecastData, groupHoursByDay, findNearestFutureHour } from '@/lib/forecast/merge'
import { handleRouteError, cdnCacheHeaders } from '@/lib/route-helpers'
import { monitor } from '@/lib/monitoring'

export const revalidate = 3600
export const maxDuration = 60

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }
  try {
  const spot = getSpotBySlug(slug)

  if (!spot) {
    return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
  }

  const [marineResult, windResult, tidesResult, buoyResult, coastalWindResult] = await Promise.allSettled([
    fetchMarineForecast(spot.lat, spot.lng),
    fetchWindForecast(spot.lat, spot.lng),
    spot.noaaTideStationId ? fetchTidePredictions(spot.noaaTideStationId) : Promise.resolve([]),
    spot.noaaBuoyId ? fetchBuoyData(spot.noaaBuoyId) : Promise.resolve(null),
    spot.noaaTideStationId ? fetchCoastalWind(spot.noaaTideStationId) : Promise.resolve(null),
  ])

  if (marineResult.status === 'rejected') {
    // This is the only fatal fetch on the page, and it used to return 502 with
    // no record of why — so "some spots fail to load" was unanswerable. It now
    // means upstream failed AND there was no last-known-good copy within
    // STALE_IF_ERROR_TTL (see withCache), which is a genuinely notable event.
    monitor('error', 'forecast.marine_unavailable', { slug, error: marineResult.reason })
    return NextResponse.json(
      { error: 'Failed to fetch wave forecast data' },
      { status: 502 }
    )
  }

  // Wind data is best-effort — if unavailable, the forecast still loads and the
  // rating engine simply renormalises the wind factor away. `fetchWindForecast`
  // rejects on an upstream failure (it used to resolve an empty structure,
  // which the runtime cache then wrote over the last-known-good copy for 24 h),
  // so null here is the expected degraded value and mergeForecastData takes it.
  const windData = windResult.status === 'fulfilled' ? windResult.value : null

  // Resolved before the merge: tide height now feeds the surf rating, not just
  // the tide chart.
  const tides = tidesResult.status === 'fulfilled' ? tidesResult.value : []
  const buoy = buoyResult.status === 'fulfilled' ? buoyResult.value : null

  let hours, forecast
  try {
    hours = mergeForecastData(marineResult.value, windData, {
      spotFacing: spot.facingDirection,
      lat: spot.lat,
      tides,
      bottomType: spot.bottomType,
      difficulty: spot.difficulty,
      // The buoy was already fetched for display; the rating now uses it too,
      // for the handful of hours a point observation actually describes.
      buoy,
    })
    forecast = groupHoursByDay(hours)
  } catch (mergeErr) {
    return NextResponse.json(
      { error: 'Failed to process forecast data', detail: String(mergeErr) },
      { status: 502 }
    )
  }
  const coastalWind = coastalWindResult.status === 'fulfilled' ? coastalWindResult.value : null
  const currentCondition = findNearestFutureHour(hours, marineResult.value.utc_offset_seconds)

  return NextResponse.json(
    {
      spotId: spot.id,
      fetchedAt: new Date().toISOString(),
      // Lets the client re-derive the current hour from forecast[] on its own
      // clock — the server-computed currentCondition freezes into CDN-cached
      // JSON for up to s-maxage+swr and silently drifts stale. Omitted (not 0)
      // when the upstream lacks it, so the client's == null guard falls back to
      // currentCondition instead of silently deriving with a fake UTC offset.
      ...(marineResult.value.utc_offset_seconds != null
        ? { utcOffsetSeconds: marineResult.value.utc_offset_seconds }
        : {}),
      // The spot's IANA zone, free from `timezone=auto`. Lets the client render
      // absolute instants (solar times, alert expiries) on the SPOT's clock —
      // formatting those in the viewer's browser timezone is why SolarPanel sat
      // unmounted. Spread conditionally for the same reason as the offset
      // above: absent, not null, so a marine payload cached before this field
      // existed degrades to utcOffsetSeconds instead of being handed a zone
      // name of `null` to try.
      ...(marineResult.value.timezone ? { timezone: marineResult.value.timezone } : {}),
      forecast,
      tides,
      buoy,
      currentCondition,
      coastalWind,
    },
    {
      headers: cdnCacheHeaders(3600, 3600),
    }
  )
  } catch (error) {
    return handleRouteError(error, 'forecast_error')
  }
}
