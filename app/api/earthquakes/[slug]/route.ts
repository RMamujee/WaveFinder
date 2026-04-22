import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchNearbyEarthquakes } from '@/lib/api/usgs-earthquake'

export const revalidate = 3600

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const spot = await prisma.surfSpot.findUnique({
    where: { slug },
    select: { lat: true, lng: true },
  })
  if (!spot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 })

  const earthquakes = await fetchNearbyEarthquakes(spot.lat, spot.lng)
  return NextResponse.json({ earthquakes }, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' },
  })
}
