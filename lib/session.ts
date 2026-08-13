import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  })
}

export async function requireUser() {
  const session = await getServerSession()
  if (!session?.user) return null
  return session.user
}
