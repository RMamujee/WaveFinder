import * as Sentry from '@sentry/nextjs'

import { validateEnv } from '@/lib/env'

export async function register() {
  // Fail fast in production if required env vars are missing; warn otherwise.
  validateEnv()

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/sentry.server.config')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('@/sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
