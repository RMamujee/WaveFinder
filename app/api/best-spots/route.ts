import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchMarineForecast, fetchWindForecast } from '@/lib/api/open-meteo'
import { rateSurfConditions, degreesToCompass } from '@/lib/forecast/rating'

export const revalidate = 1800
export const maxDuration = 60

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

// Representative lat/lng for regional swell data
const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  'San Diego':      { lat: 32.72, lng: -117.17 },
  'Orange County':  { lat: 33.55, lng: -117.75 },
  'Los Angeles':    { lat: 33.95, lng: -118.42 },
  'Ventura':        { lat: 34.25, lng: -119.25 },
  'Santa Barbara':  { lat: 34.42, lng: -119.70 },
  'Central Coast':  { lat: 35.30, lng: -120.80 },
  'Monterey':       { lat: 36.85, lng: -121.95 },
  'NorCal':         { lat: 38.50, lng: -123.00 },
  'North Shore':    { lat: 21.65, lng: -158.06 },
  'South Shore':    { lat: 21.27, lng: -157.82 },
  'Gold Coast':     { lat: -28.0,  lng: 153.43 },
  'Sydney Northern Beaches': { lat: -33.72, lng: 151.28 },
  'Uluwatu':        { lat: -8.83,  lng: 115.09 },
  'Hossegor':       { lat: 43.66,  lng: -1.43  },
  'Jeffrey\'s Bay': { lat: -34.05, lng: 24.93  },
}

export interface BestSpotsSwellHour {
  time: string
  // Primary swell (dominant ground swell)
  swellHeight: number
  swellPeriod: number
  swellDirection: number
  swellDirectionLabel: string
  // Secondary (wind wave / local chop)
  windWaveHeight: number
  windWavePeriod: number
  windWaveDirection: number
  windWaveDirectionLabel: string
  // Total
  waveHeight: number
  wavePeriod: number
  // Wind
  windSpeed: number    // km/h
  windDirection: number
  windDirectionLabel: string
  // Water
  seaSurfaceTemperature: number | null  // °C
}

export interface BestSpotsSpotEntry {
  id: string
  name: string
  slug: string
  facingDirection: number
  hours: {
    time: string
    rating: string
    ratingScore: number
    waveHeight: number
    windSpeed: number
    windDirectionLabel: string
  }[]
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const region = (searchParams.get('region') ?? '').slice(0, 100)
  const date   = (searchParams.get('date') ?? '').slice(0, 10)

  if (!region) return NextResponse.json({ error: 'region is required' }, { status: 400 })
  if (!/^[\w\s',.()-]{1,100}$/.test(region)) return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

  const spots = await prisma.surfSpot.findMany({
    where: { region: { contains: region, mode: 'insensitive' } },
    orderBy: { name: 'asc' },
  })

  if (!spots.length) {
    return NextResponse.json({ spots: [], regionalSwell: [], date })
  }

  const center = REGION_CENTERS[region] ?? { lat: spots[0].lat, lng: spots[0].lng }

  const [marineResult, windResult] = await Promise.allSettled([
    withTimeout(fetchMarineForecast(center.lat, center.lng), 28000),
    withTimeout(fetchWindForecast(center.lat, center.lng), 28000),
  ])

  const marine = marineResult.status === 'fulfilled' ? marineResult.value : null
  if (!marine) return NextResponse.json({ error: 'Could not fetch marine forecast' }, { status: 502 })

  const wind = windResult.status === 'fulfilled' ? windResult.value : null

  // Find hour indices for the selected date
  const hourIndices: number[] = []
  marine.hourly.time.forEach((t, i) => {
    if (t.startsWith(date)) hourIndices.push(i)
  })

  // Build wind lookup by time
  const windMap = new Map<string, { speed: number; dir: number }>()
  if (wind) {
    wind.hourly.time.forEach((t, i) => {
      windMap.set(t, {
        speed: wind.hourly.wind_speed_10m[i] ?? 0,
        dir:   wind.hourly.wind_direction_10m[i] ?? 0,
      })
    })
  }

  // Regional swell per hour
  const regionalSwell: BestSpotsSwellHour[] = hourIndices.map((i) => {
    const time        = marine.hourly.time[i]
    const w           = windMap.get(time) ?? { speed: 0, dir: 270 }
    const swellDir    = marine.hourly.swell_wave_direction[i] ?? 270
    const windWaveDir = marine.hourly.wind_wave_direction[i]  ?? 270
    return {
      time,
      swellHeight:          marine.hourly.swell_wave_height[i]    ?? 0,
      swellPeriod:          marine.hourly.swell_wave_period[i]    ?? 0,
      swellDirection:       swellDir,
      swellDirectionLabel:  degreesToCompass(swellDir),
      windWaveHeight:       marine.hourly.wind_wave_height[i]     ?? 0,
      windWavePeriod:       marine.hourly.wind_wave_period[i]     ?? 0,
      windWaveDirection:    windWaveDir,
      windWaveDirectionLabel: degreesToCompass(windWaveDir),
      waveHeight:           marine.hourly.wave_height[i]          ?? 0,
      wavePeriod:           marine.hourly.wave_period[i]          ?? 0,
      windSpeed:            w.speed,
      windDirection:        w.dir,
      windDirectionLabel:   degreesToCompass(w.dir),
      seaSurfaceTemperature: marine.hourly.sea_surface_temperature?.[i] ?? null,
    }
  })

  // Per-spot hourly scores using regional swell + each spot's facing direction
  const spotsData: BestSpotsSpotEntry[] = spots.map((spot) => ({
    id:             spot.id,
    name:           spot.name,
    slug:           spot.slug,
    facingDirection: spot.facingDirection,
    hours: hourIndices.map((i) => {
      const time         = marine.hourly.time[i]
      const w            = windMap.get(time) ?? { speed: 0, dir: 270 }
      const waveHeight   = marine.hourly.wave_height[i]          ?? 0
      const swellHeight  = marine.hourly.swell_wave_height[i]    ?? 0
      const swellPeriod  = marine.hourly.swell_wave_period[i]    ?? 0
      const swellDir     = marine.hourly.swell_wave_direction[i] ?? 270

      const { score, rating } = rateSurfConditions({
        waveHeight,
        swellPeriod,
        swellHeight,
        windSpeed:     w.speed,
        windDirection: w.dir,
        swellDirection: swellDir,
        spotFacing:    spot.facingDirection,
      })

      return {
        time,
        rating,
        ratingScore:        score,
        waveHeight,
        windSpeed:          w.speed,
        windDirectionLabel: degreesToCompass(w.dir),
      }
    }),
  }))

  return NextResponse.json(
    { spots: spotsData, regionalSwell, date },
    { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=900' } }
  )
}
