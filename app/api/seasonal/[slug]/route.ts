import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchSeasonalClimate } from '@/lib/api/nasa-power'

export const revalidate = 2592000 // 30 days — climatology data is stable

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

  const climate = await fetchSeasonalClimate(spot.lat, spot.lng)
  if (!climate) return NextResponse.json({ error: 'Seasonal data unavailable' }, { status: 502 })

  return NextResponse.json({ climate }, {
    headers: { 'Cache-Control': 's-maxage=2592000, stale-while-revalidate=86400' },
  })
}
