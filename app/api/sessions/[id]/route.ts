import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.surfSession.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.surfSession.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.surfSession.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.surfSession.update({
    where: { id },
    data: {
      spotName: body.spotName ?? existing.spotName,
      spotSlug: body.spotSlug ?? existing.spotSlug,
      region: body.region ?? existing.region,
      sessionDate: body.sessionDate ? new Date(body.sessionDate) : existing.sessionDate,
      duration: body.duration !== undefined ? (body.duration ? parseInt(body.duration) : null) : existing.duration,
      waveHeightFt: body.waveHeightFt !== undefined ? (body.waveHeightFt ? parseFloat(body.waveHeightFt) : null) : existing.waveHeightFt,
      wavePeriod: body.wavePeriod !== undefined ? (body.wavePeriod ? parseInt(body.wavePeriod) : null) : existing.wavePeriod,
      windSpeed: body.windSpeed !== undefined ? (body.windSpeed ? parseFloat(body.windSpeed) : null) : existing.windSpeed,
      windDir: body.windDir !== undefined ? (body.windDir || null) : existing.windDir,
      waterTempC: body.waterTempC !== undefined ? (body.waterTempC ? parseFloat(body.waterTempC) : null) : existing.waterTempC,
      boardType: body.boardType !== undefined ? (body.boardType || null) : existing.boardType,
      wetsuitMm: body.wetsuitMm !== undefined ? (body.wetsuitMm || null) : existing.wetsuitMm,
      rating: body.rating !== undefined ? (body.rating ? parseInt(body.rating) : null) : existing.rating,
      highlights: body.highlights !== undefined ? (body.highlights || null) : existing.highlights,
      buddies: body.buddies !== undefined ? (body.buddies || null) : existing.buddies,
    },
  })
  return NextResponse.json(updated)
}
