import { NextResponse } from 'next/server'
import { getSpotBySlug } from '@/lib/spots/static-store'
import { fetchAirQuality } from '@/lib/api/open-meteo-air'

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

  const airQuality = await fetchAirQuality(spot.lat, spot.lng)
  if (!airQuality) return NextResponse.json({ error: 'Air quality data unavailable' }, { status: 502 })

  return NextResponse.json(airQuality, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' },
  })
}
