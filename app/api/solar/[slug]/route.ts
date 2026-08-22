import { NextResponse } from 'next/server'
import { getSpotBySlug } from '@/lib/spots/static-store'
import { fetchSolarData } from '@/lib/api/sunrise-sunset'

export const revalidate = 86400 // 24h

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const spot = getSpotBySlug(slug)
  if (!spot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? undefined
  // The date is forwarded to an upstream API, so it is validated here rather
  // than trusted. The shape check alone still passes 2026-13-45, and parsing
  // alone is not enough either: V8 rejects an out-of-range month but silently
  // rolls 2026-02-31 over to 2026-03-03, which would answer a request for a
  // date that does not exist with a different day's data. Round-tripping the
  // parsed value is what makes this a real calendar check.
  if (date !== undefined) {
    const parsed = new Date(`${date}T00:00:00Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
  }

  const solar = await fetchSolarData(spot.lat, spot.lng, date)
  if (!solar) return NextResponse.json({ error: 'Solar data unavailable' }, { status: 502 })

  return NextResponse.json(solar, {
    headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600' },
  })
}
