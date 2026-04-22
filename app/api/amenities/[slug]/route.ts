import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchNearbyAmenities } from '@/lib/api/overpass'

export const revalidate = 86400 // 24h — amenities change infrequently

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

  const amenities = await fetchNearbyAmenities(spot.lat, spot.lng)
  return NextResponse.json({ amenities }, {
    headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600' },
  })
}
