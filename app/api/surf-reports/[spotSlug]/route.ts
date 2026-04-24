import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { degreesToCompass, computeWavePower } from '@/lib/forecast/rating'

export const revalidate = 1800

export interface LiveConditionReport {
  source: 'noaa_buoy' | 'open_meteo' | 'none'
  buoyId?: string
  stationName?: string
  time: string
  waveHeight: number | null
  dominantPeriod: number | null
  wavePower: number | null
  swellDirection: string | null
  windSpeed: number | null
  windDirection: string | null
  waterTemp: number | null
  trend: 'rising' | 'dropping' | 'steady' | 'unknown'
  summary: string
  detailUrl?: string
}

function getTrend(current: number, previous: number | undefined): 'rising' | 'dropping' | 'steady' {
  if (previous == null) return 'steady'
  const diff = current - previous
  if (diff > 0.15) return 'rising'
  if (diff < -0.15) return 'dropping'
  return 'steady'
}

function buildSummary(
  waveHeight: number | null,
  period: number | null,
  windSpeed: number | null,
  windDir: string | null,
  waterTemp: number | null,
  trend: string,
  spotName: string
): string {
  const parts: string[] = []

  if (waveHeight != null && waveHeight > 0) {
    const ft = Math.round(waveHeight * 3.281)
    const trendWord = trend === 'rising' ? ', building' : trend === 'dropping' ? ', fading' : ''
    parts.push(`Waves ${waveHeight.toFixed(1)}m (${ft}ft)${trendWord}`)
  } else {
    parts.push('Wave data currently unavailable from nearby buoy')
  }

  if (period != null && period > 0) {
    parts.push(`${Math.round(period)}s period`)
  }

  if (windSpeed != null) {
    const windDesc = windSpeed < 5 ? 'glassy calm' : windSpeed < 15 ? 'light winds' : windSpeed < 25 ? 'moderate winds' : 'strong winds'
    parts.push(`${windDesc} at ${Math.round(windSpeed)} km/h ${windDir ?? ''}`.trim())
  }

  if (waterTemp != null) {
    const tempF = Math.round(waterTemp * 9 / 5 + 32)
    parts.push(`water ${waterTemp.toFixed(1)}°C (${tempF}°F)`)
  }

  return `${spotName}: ${parts.join(', ')}.`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spotSlug: string }> }
) {
  const { spotSlug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(spotSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const spot = await prisma.surfSpot.findUnique({ where: { slug: spotSlug } })

  if (!spot) {
    return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
  }

  if (!spot.noaaBuoyId) {
    const report: LiveConditionReport = {
      source: 'none',
      time: new Date().toISOString(),
      waveHeight: null,
      dominantPeriod: null,
      wavePower: null,
      swellDirection: null,
      windSpeed: null,
      windDirection: null,
      waterTemp: null,
      trend: 'unknown',
      summary: 'No live buoy data available for this spot. Check the 7-day forecast below.',
    }
    return NextResponse.json({ report })
  }

  // Fetch the buoy's last ~20 observations (NOAA provides ~45 days of data)
  try {
    const res = await fetch(
      `https://www.ndbc.noaa.gov/data/realtime2/${spot.noaaBuoyId}.txt`,
      {
        headers: { 'User-Agent': 'WaveFinder/1.0 (surf forecast; contact@wavefinder.app)' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 1800 },
      }
    )

    if (!res.ok) throw new Error(`NDBC ${res.status}`)

    const text = await res.text()
    const lines = text.split('\n').filter((l) => l.trim())

    if (lines.length < 4) throw new Error('Insufficient buoy data')

    const headerLine = lines[0].replace(/^#\s*/, '').trim()
    const headers = headerLine.split(/\s+/)

    const get = (values: string[], col: string): number | null => {
      const idx = headers.indexOf(col)
      if (idx === -1 || idx >= values.length) return null
      const v = values[idx]
      if (v === 'MM' || v === 'N/A' || v === 'nan') return null
      const n = parseFloat(v)
      return isNaN(n) ? null : n
    }

    const parseRow = (line: string) => {
      const values = line.trim().split(/\s+/)
      const year  = values[0]
      const month = values[1]?.padStart(2, '0')
      const day   = values[2]?.padStart(2, '0')
      const hour  = values[3]?.padStart(2, '0')
      const min   = values[4]?.padStart(2, '0')
      return {
        time: `${year}-${month}-${day}T${hour}:${min}:00Z`,
        waveHeight: get(values, 'WVHT'),
        dominantPeriod: get(values, 'DPD'),
        averagePeriod: get(values, 'APD'),
        meanDirection: get(values, 'MWD'),
        waterTemp: get(values, 'WTMP'),
        windSpeed: get(values, 'WSPD'),
        windDirection: get(values, 'WDIR'),
      }
    }

    // lines[0] = headers, lines[1] = units, lines[2+] = data (newest first)
    const dataLines = lines.slice(2).filter(l => !l.startsWith('#'))
    if (dataLines.length < 1) throw new Error('No data lines')

    const current = parseRow(dataLines[0])
    // Look back ~6 hours (each reading is 30 min, so index 12)
    const previous = dataLines[12] ? parseRow(dataLines[12]) : null

    const trend = current.waveHeight != null && previous?.waveHeight != null
      ? getTrend(current.waveHeight, previous.waveHeight)
      : 'unknown'

    const wavePower = current.waveHeight != null && current.dominantPeriod != null
      ? computeWavePower(current.waveHeight, current.dominantPeriod)
      : null

    const windDir = current.windDirection != null ? degreesToCompass(current.windDirection) : null

    const report: LiveConditionReport = {
      source: 'noaa_buoy',
      buoyId: spot.noaaBuoyId,
      stationName: `NOAA NDBC Station ${spot.noaaBuoyId}`,
      time: current.time,
      waveHeight: current.waveHeight,
      dominantPeriod: current.dominantPeriod,
      wavePower,
      swellDirection: current.meanDirection != null ? degreesToCompass(current.meanDirection) : null,
      windSpeed: current.windSpeed != null ? Math.round(current.windSpeed * 3.6) : null, // m/s → km/h
      windDirection: windDir,
      waterTemp: current.waterTemp,
      trend,
      summary: buildSummary(
        current.waveHeight,
        current.dominantPeriod,
        current.windSpeed != null ? current.windSpeed * 3.6 : null,
        windDir,
        current.waterTemp,
        trend,
        spot.name,
      ),
      detailUrl: `https://www.ndbc.noaa.gov/station_page.php?station=${spot.noaaBuoyId}`,
    }

    return NextResponse.json({ report })
  } catch {
    const report: LiveConditionReport = {
      source: 'none',
      time: new Date().toISOString(),
      waveHeight: null,
      dominantPeriod: null,
      wavePower: null,
      swellDirection: null,
      windSpeed: null,
      windDirection: null,
      waterTemp: null,
      trend: 'unknown',
      summary: 'Live buoy data temporarily unavailable. Check the forecast charts for expected conditions.',
    }
    return NextResponse.json({ report })
  }
}
