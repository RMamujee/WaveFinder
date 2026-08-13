import { NextResponse } from 'next/server'
import { fetchCurrentConditions } from '@/lib/api/open-meteo'

export const dynamic = 'force-dynamic'

// Test endpoint: /api/debug/conditions?lat=33.87&lng=-118.41
// Returns raw fetchCurrentConditions output + timing, useful for diagnosing
// gray-node issues without needing server logs.
export async function GET(req: Request) {
  if (process.env.ENABLE_DEBUG_API !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '33.87')   // default: El Porto, CA
  const lng = parseFloat(searchParams.get('lng') ?? '-118.41')

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

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
