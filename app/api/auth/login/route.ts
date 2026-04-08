import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSessionToken, sessionCookieOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential' },
  })
  if (!account?.password) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, account.password)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = await createSessionToken(user.id)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
