import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 43200 // 12 hours — bacterial data updates daily at most

export interface WaterQualityReading {
  date: string          // ISO date string
  value: number         // CFU/100mL
  stationId: string
  stationName: string
}

export interface WaterQualityResponse {
  source: 'usgs' | 'none'
  beachName: string | null
  latestReading: WaterQualityReading | null
  history: WaterQualityReading[]   // up to 10 most recent
  status: 'safe' | 'caution' | 'unsafe' | 'closed' | 'no_data'
  lastUpdated: string
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  // Handle quoted fields (some names contain commas)
  function splitLine(line: string): string[] {
    const result: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuote = !inQuote }
      else if (line[i] === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
      else { cur += line[i] }
    }
    result.push(cur.trim())
    return result
  }
  const headers = splitLine(lines[0])
  return lines.slice(1).map(line => {
    const vals = splitLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

function getStatus(value: number): WaterQualityResponse['status'] {
  if (value <= 35)  return 'safe'
  if (value <= 100) return 'caution'
  if (value <= 200) return 'unsafe'
  return 'closed'
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WaveFinder/1.0 (surf forecast app)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }
  const spot = await prisma.surfSpot.findUnique({ where: { slug }, select: { lat: true, lng: true, name: true } })

  if (!spot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 })

  const noData: WaterQualityResponse = {
    source: 'none',
    beachName: null,
    latestReading: null,
    history: [],
    status: 'no_data',
    lastUpdated: new Date().toISOString(),
  }

  // Bacterial indicators used by different agencies (CA uses Enterococcus; some use E. coli)
  const CHAR_NAMES = ['Enterococcus', 'E. coli', 'Fecal Coliform']
  const charParam = CHAR_NAMES.map(c => `characteristicName=${encodeURIComponent(c)}`).join('&')

  // Step 1 — find BEACH program monitoring stations within 25 miles
  const stationUrl = `https://www.waterqualitydata.us/data/Station/search?lat=${spot.lat}&long=${spot.lng}&within=25&${charParam}&mimeType=csv`
  const stationCSV = await fetchText(stationUrl)
  if (!stationCSV) {
    return NextResponse.json(noData, {
      headers: { 'Cache-Control': 's-maxage=43200, stale-while-revalidate=86400' },
    })
  }

  const stations = parseCSV(stationCSV)
  if (stations.length === 0) {
    return NextResponse.json(noData, {
      headers: { 'Cache-Control': 's-maxage=43200, stale-while-revalidate=86400' },
    })
  }

  // Use up to 5 nearest stations (CSV is already sorted by distance)
  const siteIds = stations
    .slice(0, 5)
    .map(s => s['MonitoringLocationIdentifier'])
    .filter((id): id is string => typeof id === 'string' && /^[\w:.-]{1,60}$/.test(id))

  if (siteIds.length === 0) {
    return NextResponse.json(noData, {
      headers: { 'Cache-Control': 's-maxage=43200, stale-while-revalidate=86400' },
    })
  }

  const beachName = stations[0]['MonitoringLocationName'] ?? null

  // Step 2 — fetch results from the last 180 days for those stations, all characteristic names
  const since = new Date(Date.now() - 180 * 24 * 3600 * 1000)
  const sinceStr = `${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}-${since.getFullYear()}`
  const resultUrl = `https://www.waterqualitydata.us/data/Result/search?siteid=${siteIds.map(encodeURIComponent).join(';')}&${charParam}&startDateLo=${sinceStr}&mimeType=csv`
  const resultCSV = await fetchText(resultUrl)
  if (!resultCSV) {
    return NextResponse.json(noData, {
      headers: { 'Cache-Control': 's-maxage=43200, stale-while-revalidate=86400' },
    })
  }

  const rows = parseCSV(resultCSV)
  if (rows.length === 0) {
    return NextResponse.json(noData, {
      headers: { 'Cache-Control': 's-maxage=43200, stale-while-revalidate=86400' },
    })
  }

  // Parse readings — keep only rows with numeric values
  const readings: WaterQualityReading[] = rows
    .map(row => {
      const rawVal = row['ResultMeasureValue']?.trim()
      const value = parseFloat(rawVal)
      const date = row['ActivityStartDate']?.trim()
      const stationId = row['MonitoringLocationIdentifier']?.trim()
      const stationName = row['MonitoringLocationName']?.trim() ?? stationId
      if (!rawVal || isNaN(value) || !date) return null
      return { date, value, stationId, stationName }
    })
    .filter((r): r is WaterQualityReading => r !== null)
    .sort((a, b) => b.date.localeCompare(a.date))  // newest first
    .slice(0, 10)

  if (readings.length === 0) {
    return NextResponse.json(noData, {
      headers: { 'Cache-Control': 's-maxage=43200, stale-while-revalidate=86400' },
    })
  }

  const latest = readings[0]
  return NextResponse.json(
    {
      source: 'usgs',
      beachName,
      latestReading: latest,
      history: readings,
      status: getStatus(latest.value),
      lastUpdated: new Date().toISOString(),
    } satisfies WaterQualityResponse,
    { headers: { 'Cache-Control': 's-maxage=43200, stale-while-revalidate=86400' } }
  )
}
