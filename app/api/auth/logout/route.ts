import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) await deleteSessionToken(token)

  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
