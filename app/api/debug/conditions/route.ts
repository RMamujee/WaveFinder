import { NextResponse } from 'next/server'
import { fetchCurrentConditions } from '@/lib/api/open-meteo'

export const dynamic = 'force-dynamic'

// Test endpoint: /api/debug/conditions?lat=33.87&lng=-118.41
// Returns raw fetchCurrentConditions output + timing, useful for diagnosing
// gray-node issues without needing server logs.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '33.87')   // default: El Porto, CA
  const lng = parseFloat(searchParams.get('lng') ?? '-118.41')

  const t0 = Date.now()
  const result = await fetchCurrentConditions(lat, lng)
  const ms = Date.now() - t0

  return NextResponse.json({
    lat, lng,
    durationMs: ms,
    result,
    cached: ms < 10, // <10 ms → definitely served from in-memory cache
  })
}
