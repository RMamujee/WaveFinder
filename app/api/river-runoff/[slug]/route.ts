import { NextResponse } from 'next/server'
import { getSpotBySlug } from '@/lib/spots/static-store'
import { fetchRiverRunoff } from '@/lib/api/usgs-river'

export const revalidate = 3600

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const spot = getSpotBySlug(slug)
  if (!spot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 })

  const stations = await fetchRiverRunoff(spot.lat, spot.lng)
  return NextResponse.json({ stations }, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' },
  })
}
