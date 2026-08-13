import { z } from 'zod'

/**
 * Server-side environment schema.
 *
 * Required vars are the ones the app genuinely cannot run without in
 * production (database + auth secret). Everything else is optional so that
 * preview/build environments and local dev never hard-fail on import.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

/** Vars that the production runtime cannot start without. */
const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const

/** Optional vars we warn about when absent (useful but not fatal). */
const RECOMMENDED = [
  'BETTER_AUTH_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const

/**
 * Validate server environment variables.
 *
 * Safe to import at any time — it never throws at module load. It only throws
 * when invoked at runtime in production with a missing required var. During
 * build (`NEXT_PHASE === 'phase-production-build'`) it never throws.
 */
export function validateEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env)

  // If zod itself rejects the shape, surface a readable message but never
  // throw at build time.
  const env: ServerEnv = parsed.success ? parsed.data : (process.env as unknown as ServerEnv)

  const isProduction = process.env.NODE_ENV === 'production'
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build'

  const missingRequired = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key])

  if (isProduction && !isBuild && missingRequired.length > 0) {
    throw new Error(
      `[env] Missing required environment variable(s): ${missingRequired.join(', ')}`,
    )
  }

  if (missingRequired.length > 0) {
    console.warn(
      `[env] Missing required environment variable(s): ${missingRequired.join(
        ', ',
      )} (allowed outside production runtime)`,
    )
  }

  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key])
  if (missingRecommended.length > 0) {
    console.warn(
      `[env] Missing optional environment variable(s): ${missingRecommended.join(', ')}`,
    )
  }

  return env
}
