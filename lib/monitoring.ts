import * as Sentry from '@sentry/nextjs'

type MonitorLevel = 'info' | 'warn' | 'error'

export function monitor(level: MonitorLevel, event: string, data: Record<string, unknown> = {}) {
  // Error objects don't JSON-serialize their message/stack, so render them to a
  // readable string for the log line while keeping the originals for Sentry.
  const serializable: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    serializable[key] = value instanceof Error ? (value.stack ?? value.message) : value
  }

  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...serializable,
  }

  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)

  if (level === 'error') {
    // Best-effort: forward errors to Sentry. Guarded so a missing/unconfigured
    // Sentry never throws and never breaks the calling code path.
    try {
      const err = data.error
      if (err instanceof Error) {
        Sentry.captureException(err, { extra: { event, ...serializable } })
      } else {
        Sentry.captureMessage(event, { level: 'error', extra: serializable })
      }
    } catch {
      // swallow — monitoring must never throw
    }
  }
}
