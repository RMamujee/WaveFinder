import { prisma } from './prisma'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const SESSION_COOKIE = 'wf_session'
const SESSION_DURATION_S = 60 * 60 * 24 * 7 // 7 days

export type SessionUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Read the session cookie and return the authenticated user, or null.
 * Use in server components and API route handlers.
 */
export async function getSession(): Promise<{ user: SessionUser } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { token } }).catch(() => {})
    }
    return null
  }

  return { user: session.user }
}

/** Create a new session row and return the token. */
export async function createSessionToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_S * 1000)
  await prisma.session.create({ data: { userId, token, expiresAt } })
  return token
}

/** Delete a session by token. */
export async function deleteSessionToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } })
}

/** Returns the cookie options object for setting the session cookie. */
export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DURATION_S,
  }
}
