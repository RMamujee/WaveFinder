import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

  const spot = await prisma.surfSpot.findUnique({
    where: { slug },
    select: { lat: true, lng: true },
  })
  if (!spot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? undefined

  const solar = await fetchSolarData(spot.lat, spot.lng, date)
  if (!solar) return NextResponse.json({ error: 'Solar data unavailable' }, { status: 502 })

  return NextResponse.json(solar, {
    headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600' },
  })
}
