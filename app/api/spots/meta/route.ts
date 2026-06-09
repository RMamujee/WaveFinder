import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 86400

// Returns distinct countries and (optionally) regions for a given country
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const country = (searchParams.get('country') ?? '').slice(0, 100) || null

  if (country) {
    // Return distinct region values for this country
    const rows = await prisma.surfSpot.findMany({
      where: { country },
      select: { region: true },
      distinct: ['region'],
      orderBy: { region: 'asc' },
    })
    return NextResponse.json(
      { regions: rows.map((r) => r.region) },
      { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=86400' } }
    )
  }

  // Return distinct countries
  const rows = await prisma.surfSpot.findMany({
    select: { country: true },
    distinct: ['country'],
    orderBy: { country: 'asc' },
  })
  return NextResponse.json(
    { countries: rows.map((r) => r.country) },
    { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=86400' } }
  )
}
