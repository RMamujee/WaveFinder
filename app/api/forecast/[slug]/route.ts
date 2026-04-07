import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchMarineForecast, fetchWindForecast } from '@/lib/api/open-meteo'
import { fetchTidePredictions } from '@/lib/api/noaa-tides'
import { fetchBuoyData } from '@/lib/api/noaa-buoy'
import { mergeForecastData, groupHoursByDay, findNearestFutureHour } from '@/lib/forecast/merge'

export const revalidate = 3600
export const maxDuration = 60

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const spot = await prisma.surfSpot.findUnique({ where: { slug } })

  if (!spot) {
    return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
  }

  const [marineResult, windResult, tidesResult, buoyResult] = await Promise.allSettled([
    fetchMarineForecast(spot.lat, spot.lng),
    fetchWindForecast(spot.lat, spot.lng),
    spot.noaaTideStationId ? fetchTidePredictions(spot.noaaTideStationId) : Promise.resolve([]),
    spot.noaaBuoyId ? fetchBuoyData(spot.noaaBuoyId) : Promise.resolve(null),
  ])

  if (marineResult.status === 'rejected' || windResult.status === 'rejected') {
    return NextResponse.json(
      { error: 'Failed to fetch forecast data' },
      { status: 502 }
    )
  }

  const hours = mergeForecastData(
    marineResult.value,
    windResult.value,
    spot.facingDirection
  )

  const forecast = groupHoursByDay(hours)
  const tides = tidesResult.status === 'fulfilled' ? tidesResult.value : []
  const buoy = buoyResult.status === 'fulfilled' ? buoyResult.value : null
  const currentCondition = findNearestFutureHour(hours)

  return NextResponse.json(
    {
      spotId: spot.id,
      fetchedAt: new Date().toISOString(),
      forecast,
      tides,
      buoy,
      currentCondition,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
      },
    }
  )
}
