import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  tracesSampleRate: 0.1,
  enabled: Boolean(dsn),
})

// Capture client-side navigation transitions when the export is available in
// the installed Sentry build. Guarded so a missing export never breaks builds.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
