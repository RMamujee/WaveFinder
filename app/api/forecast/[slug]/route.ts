import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchMarineForecast, fetchWindForecast } from '@/lib/api/open-meteo'
import { fetchTidePredictions, fetchCoastalWind } from '@/lib/api/noaa-tides'
import { fetchBuoyData } from '@/lib/api/noaa-buoy'
import { mergeForecastData, groupHoursByDay, findNearestFutureHour } from '@/lib/forecast/merge'
import { handleRouteError } from '@/lib/route-helpers'

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
  const spot = await prisma.surfSpot.findUnique({ where: { slug } })

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
    return NextResponse.json(
      { error: 'Failed to fetch wave forecast data' },
      { status: 502 }
    )
  }

  // Wind data is best-effort — if unavailable, forecast still loads without wind ratings
  const windData = (windResult.status === 'fulfilled' && windResult.value)
    ? windResult.value
    : { hourly: { time: [] as string[], wind_speed_10m: [] as number[], wind_direction_10m: [] as number[], wind_gusts_10m: [] as number[], temperature_2m: [] as number[], weather_code: [] as number[], precipitation_probability: [] as number[] } }

  let hours, forecast
  try {
    hours = mergeForecastData(
      marineResult.value,
      windData,
      spot.facingDirection,
      spot.lat
    )
    forecast = groupHoursByDay(hours)
  } catch (mergeErr) {
    return NextResponse.json(
      { error: 'Failed to process forecast data', detail: String(mergeErr) },
      { status: 502 }
    )
  }
  const tides = tidesResult.status === 'fulfilled' ? tidesResult.value : []
  const buoy = buoyResult.status === 'fulfilled' ? buoyResult.value : null
  const coastalWind = coastalWindResult.status === 'fulfilled' ? coastalWindResult.value : null
  const currentCondition = findNearestFutureHour(hours, marineResult.value.utc_offset_seconds)

  return NextResponse.json(
    {
      spotId: spot.id,
      fetchedAt: new Date().toISOString(),
      forecast,
      tides,
      buoy,
      currentCondition,
      coastalWind,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
      },
    }
  )
  } catch (error) {
    return handleRouteError(error, 'forecast_error')
  }
}
