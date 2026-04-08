import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ spotId: string }> }
) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { spotId } = await params

  await prisma.savedSpot.deleteMany({
    where: { userId: session.user.id, spotId },
  })

  return NextResponse.json({ success: true })
}
