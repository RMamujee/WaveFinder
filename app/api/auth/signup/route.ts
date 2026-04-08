import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSessionToken, sessionCookieOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      accounts: {
        create: {
          accountId: email.toLowerCase(),
          providerId: 'credential',
          password: hashed,
        },
      },
    },
  })

  const token = await createSessionToken(user.id)
  const res = NextResponse.json({ ok: true }, { status: 201 })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
