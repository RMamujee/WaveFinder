import { createAuthClient } from 'better-auth/react'

// In the browser, use the current origin so auth works on any deployment URL.
// Fall back to NEXT_PUBLIC_APP_URL (set in Vercel env vars) during SSR.
const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

export const authClient = createAuthClient({ baseURL })

export const { signIn, signUp, signOut, useSession } = authClient
