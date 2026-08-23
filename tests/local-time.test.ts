import { describe, it, expect } from 'vitest'
import { formatSpotLocalTime } from '@/lib/forecast/local-time'

// 2026-08-22T13:24:07Z — the instant every case below is formatted from unless
// stated otherwise. Chosen in August so the northern-hemisphere zones are on
// summer time and a fixed-offset fallback can be told apart from a real zone.
const AUGUST_INSTANT = '2026-08-22T13:24:07+00:00'

describe('formatSpotLocalTime', () => {
  it('formats on the spot IANA zone, not the runner timezone (Bali, +8)', () => {
    expect(formatSpotLocalTime(AUGUST_INSTANT, { timezone: 'Asia/Makassar' })).toBe('9:24 PM')
  })

  it('formats Los Angeles at its August offset (−7, not the −8 standard offset)', () => {
    expect(formatSpotLocalTime(AUGUST_INSTANT, { timezone: 'America/Los_Angeles' })).toBe('6:24 AM')
  })

  it('gives the same spot two different clock offsets across a DST boundary', () => {
    // US DST ends 2026-11-01 at 02:00 local. 18:30 UTC is 11:30 PDT on the
    // Saturday before and 10:30 PST on the Sunday after. A stored
    // utcOffsetSeconds cannot express both; the IANA name can, which is the
    // whole reason it is preferred.
    const zone = { timezone: 'America/Los_Angeles' }
    expect(formatSpotLocalTime('2026-10-31T18:30:00Z', zone)).toBe('11:30 AM')
    expect(formatSpotLocalTime('2026-11-01T18:30:00Z', zone)).toBe('10:30 AM')
  })

  it('applies the offset fallback uniformly, DST change or not', () => {
    // Same two instants, same spot, with only the summer offset recorded: the
    // post-change reading is an hour fast. Documented as the known limit of the
    // fallback — it is second in line precisely for this.
    const zone = { utcOffsetSeconds: -7 * 3600 }
    expect(formatSpotLocalTime('2026-10-31T18:30:00Z', zone)).toBe('11:30 AM')
    expect(formatSpotLocalTime('2026-11-01T18:30:00Z', zone)).toBe('11:30 AM')
  })

  it('shifts by utcOffsetSeconds when no IANA name is present', () => {
    expect(formatSpotLocalTime(AUGUST_INSTANT, { utcOffsetSeconds: 8 * 3600 })).toBe('9:24 PM')
    expect(formatSpotLocalTime(AUGUST_INSTANT, { utcOffsetSeconds: -7 * 3600 })).toBe('6:24 AM')
    expect(formatSpotLocalTime(AUGUST_INSTANT, { utcOffsetSeconds: 0 })).toBe('1:24 PM')
  })

  it('falls back to the offset when the zone name is invalid', () => {
    expect(
      formatSpotLocalTime(AUGUST_INSTANT, { timezone: 'Not/AZone', utcOffsetSeconds: 8 * 3600 })
    ).toBe('9:24 PM')
  })

  it('renders nothing rather than the viewer timezone when the zone name is invalid and no offset exists', () => {
    expect(formatSpotLocalTime(AUGUST_INSTANT, { timezone: 'Not/AZone' })).toBeNull()
  })

  it('renders nothing when the payload carries no zone information', () => {
    expect(formatSpotLocalTime(AUGUST_INSTANT, {})).toBeNull()
    expect(formatSpotLocalTime(AUGUST_INSTANT, null)).toBeNull()
    expect(formatSpotLocalTime(AUGUST_INSTANT, undefined)).toBeNull()
  })

  it('returns null for a missing or unparseable instant', () => {
    const zone = { timezone: 'Asia/Makassar' }
    expect(formatSpotLocalTime(null, zone)).toBeNull()
    expect(formatSpotLocalTime(undefined, zone)).toBeNull()
    expect(formatSpotLocalTime('', zone)).toBeNull()
    expect(formatSpotLocalTime('not-a-date', zone)).toBeNull()
  })

  it('treats a zero offset as a real offset, not as missing', () => {
    // `utcOffsetSeconds: 0` is Greenwich, not "unknown" — the same ?? 0 trap
    // CLAUDE.md pins for the rating engine's nulls.
    expect(formatSpotLocalTime(AUGUST_INSTANT, { utcOffsetSeconds: 0 })).not.toBeNull()
  })

  it('prefixes the weekday on request', () => {
    expect(
      formatSpotLocalTime(AUGUST_INSTANT, { timezone: 'Asia/Makassar' }, { weekday: true })
    ).toBe('Sat 9:24 PM')
  })

  it('crosses the date line into the next weekday on the spot clock', () => {
    // 22:00 UTC Saturday is already Sunday morning in Bali.
    expect(
      formatSpotLocalTime('2026-08-22T22:00:00Z', { timezone: 'Asia/Makassar' }, { weekday: true })
    ).toBe('Sun 6:00 AM')
  })
})
