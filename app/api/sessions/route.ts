import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await prisma.surfSession.findMany({
    where: { userId: session.user.id },
    orderBy: { sessionDate: 'desc' },
  })
  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.spotName || !body.sessionDate) {
    return NextResponse.json({ error: 'spotName and sessionDate are required' }, { status: 400 })
  }

  const newSession = await prisma.surfSession.create({
    data: {
      userId: session.user.id,
      spotName: body.spotName,
      spotSlug: body.spotSlug || null,
      region: body.region || null,
      sessionDate: new Date(body.sessionDate),
      duration: body.duration ? parseInt(body.duration) : null,
      waveHeightFt: body.waveHeightFt ? parseFloat(body.waveHeightFt) : null,
      wavePeriod: body.wavePeriod ? parseInt(body.wavePeriod) : null,
      windSpeed: body.windSpeed ? parseFloat(body.windSpeed) : null,
      windDir: body.windDir || null,
      waterTempC: body.waterTempC ? parseFloat(body.waterTempC) : null,
      boardType: body.boardType || null,
      wetsuitMm: body.wetsuitMm || null,
      rating: body.rating ? parseInt(body.rating) : null,
      highlights: body.highlights || null,
      buddies: body.buddies || null,
    },
  })
  return NextResponse.json(newSession, { status: 201 })
}
