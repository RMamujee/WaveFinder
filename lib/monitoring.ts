type MonitorLevel = 'info' | 'warn' | 'error'

export function monitor(level: MonitorLevel, event: string, data: Record<string, unknown> = {}) {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...data,
  }

  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
