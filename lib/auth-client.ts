'use client'

import { useQuery } from '@tanstack/react-query'

export type SessionUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

type Session = { user: SessionUser } | null
type AuthResult = { error: null } | { error: { message: string } }

async function fetchSession(): Promise<Session> {
  const res = await fetch('/api/auth/session')
  if (!res.ok) return null
  return res.json()
}

/** Drop-in replacement for better-auth's useSession. */
export function useSession() {
  const { data = null, isPending } = useQuery<Session>({
    queryKey: ['session'],
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
  })
  return { data, isPending }
}

export const signIn = {
  email: async ({
    email,
    password,
  }: {
    email: string
    password: string
    callbackURL?: string
  }): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json()
      if (!res.ok) return { error: { message: body.error ?? 'Login failed' } }
      return { error: null }
    } catch {
      return { error: { message: 'Network error. Please try again.' } }
    }
  },
}

export const signUp = {
  email: async ({
    name,
    email,
    password,
  }: {
    name: string
    email: string
    password: string
    callbackURL?: string
  }): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const body = await res.json()
      if (!res.ok) return { error: { message: body.error ?? 'Sign up failed' } }
      return { error: null }
    } catch {
      return { error: { message: 'Network error. Please try again.' } }
    }
  },
}

export function signOut(): void {
  fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
    window.location.href = '/'
  })
}
