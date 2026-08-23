/**
 * Rendering an absolute instant on the SPOT's clock, never the viewer's.
 *
 * Most times on the forecast page are Open-Meteo hourly strings, which are
 * already the spot's local wall clock with no offset ("2026-08-22T14:00") — a
 * date-fns `format(parseISO(t))` round-trips those correctly in any viewer
 * timezone and must NOT be routed through here.
 *
 * This is for the other kind: a real instant carrying an offset or `Z`
 * (sunrise-sunset.org solar times, NWS alert expiries). `format(parseISO(iso))`
 * on one of those renders it in whatever timezone the browser happens to sit
 * in, so a Bali spot showed California clock times. That is the bug SolarPanel
 * was left unmounted over.
 *
 * Resolution order, deliberately ending in `null` rather than a guess:
 *   1. The spot's IANA zone name (`timezone=auto` gives it free) — the only
 *      option that is right across a DST boundary, because the offset that
 *      applies on the formatted date is looked up, not assumed.
 *   2. `utcOffsetSeconds`, shifted and formatted in UTC. Open-Meteo reports the
 *      offset in force when the forecast was fetched, so this is off by an hour
 *      for instants on the far side of a clock change — acceptable as a
 *      fallback, which is why it is second.
 *   3. Nothing. Falling back to the viewer's zone is the defect, not a
 *      degradation of it: it renders a confident, wrong clock time.
 */

export interface SpotZone {
  /** IANA zone name from Open-Meteo, e.g. "Asia/Makassar". */
  timezone?: string | null
  /** Seconds east of UTC, from Open-Meteo's `utc_offset_seconds`. */
  utcOffsetSeconds?: number | null
}

export interface SpotLocalTimeOptions {
  /** Prefix the short weekday ("Fri 6:00 PM") — for times that may not be today. */
  weekday?: boolean
}

function optionsFor(opts: SpotLocalTimeOptions | undefined, timeZone: string): Intl.DateTimeFormatOptions {
  return {
    ...(opts?.weekday ? { weekday: 'short' as const } : {}),
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }
}

/**
 * Format an absolute instant on the spot's clock.
 *
 * Returns null — meaning "render nothing" — for a missing/unparseable instant
 * or when the payload carries no zone information at all.
 */
export function formatSpotLocalTime(
  iso: string | null | undefined,
  zone: SpotZone | null | undefined,
  opts?: SpotLocalTimeOptions
): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null

  const timezone = zone?.timezone
  if (timezone) {
    try {
      return new Intl.DateTimeFormat('en-US', optionsFor(opts, timezone)).format(ms)
    } catch {
      // An unknown or malformed zone name throws a RangeError. Open-Meteo has
      // no business sending one, but a stale cached payload or a hand-built
      // fixture can, and a whole panel must not disappear over it.
    }
  }

  const offsetSeconds = zone?.utcOffsetSeconds
  if (offsetSeconds != null && Number.isFinite(offsetSeconds)) {
    // Shift the instant, then read it in UTC: the wall clock of a UTC reading
    // taken `offset` seconds later IS the local wall clock.
    return new Intl.DateTimeFormat('en-US', optionsFor(opts, 'UTC')).format(ms + offsetSeconds * 1000)
  }

  return null
}
