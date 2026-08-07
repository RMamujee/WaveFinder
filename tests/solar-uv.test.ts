import { describe, it, expect } from 'vitest'
import { computeUVIndex, cloudAttenuation } from '@/lib/forecast/solar-uv'

// Los Angeles, 34.05 N. The audit measured the old formula at 6.5 here against
// a reference 2.7 — 2.4x high, and high in the direction that tells a surfer
// they need sunscreen they do not.
const LA = 34.05

describe('computeUVIndex', () => {
  it('matches the reference at Los Angeles winter noon', () => {
    const uv = computeUVIndex(LA, '2026-12-21T12:00')
    expect(uv).toBeGreaterThan(2.2)
    expect(uv).toBeLessThan(3.4)
  })

  it('matches the reference at Los Angeles summer noon', () => {
    const uv = computeUVIndex(LA, '2026-06-21T12:00')
    expect(uv).toBeGreaterThan(9.5)
    expect(uv).toBeLessThan(12.5)
  })

  it('separates summer from winter by roughly 4x, not 1.7x', () => {
    // The old exponent was far too shallow, which is why it only agreed with
    // reality near the point it had been eyeballed at.
    const summer = computeUVIndex(LA, '2026-06-21T12:00')
    const winter = computeUVIndex(LA, '2026-12-21T12:00')
    expect(summer / winter).toBeGreaterThan(3)
  })

  it('reports zero when the sun is below the horizon', () => {
    expect(computeUVIndex(LA, '2026-06-21T02:00')).toBe(0)
    expect(computeUVIndex(LA, '2026-12-21T23:00')).toBe(0)
  })

  it('peaks around solar noon and falls off symmetrically', () => {
    // Each row is evaluated at its mid-hour (the 12:00 row means 12:00-13:00,
    // so 12.5), which puts solar noon exactly between the 11:00 and 12:00
    // rows — they should tie, and pairs step outward from there.
    const at = (h: string) => computeUVIndex(LA, `2026-06-21T${h}:00`)
    const all = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17'].map(at)
    expect(Math.max(...all)).toBe(at('11'))
    expect(at('11')).toBeCloseTo(at('12'), 5)
    expect(at('10')).toBeCloseTo(at('13'), 5)
    expect(at('08')).toBeCloseTo(at('15'), 5)
  })

  it('rises toward the equator at equinox', () => {
    const equator = computeUVIndex(0, '2026-03-21T12:00')
    const midLat = computeUVIndex(LA, '2026-03-21T12:00')
    const highLat = computeUVIndex(60, '2026-03-21T12:00')
    expect(equator).toBeGreaterThan(midLat)
    expect(midLat).toBeGreaterThan(highLat)
  })

  it('returns 0 for an unparseable timestamp', () => {
    expect(computeUVIndex(LA, 'not-a-time')).toBe(0)
  })
})

describe('cloudAttenuation', () => {
  it('is unaffected by broken cloud but halves under overcast', () => {
    // UV is far less cloud-sensitive than visible light: scattered light
    // replaces most of what is blocked until cover is nearly total.
    expect(cloudAttenuation(0)).toBe(1)
    expect(cloudAttenuation(50)).toBeGreaterThan(0.9)
    expect(cloudAttenuation(100)).toBeCloseTo(0.44, 2)
  })

  it('treats unknown cloud cover as clear sky rather than as overcast', () => {
    expect(cloudAttenuation(null)).toBe(1)
    expect(cloudAttenuation(undefined)).toBe(1)
    expect(cloudAttenuation(NaN)).toBe(1)
  })

  it('clamps out-of-range values', () => {
    expect(cloudAttenuation(-10)).toBe(1)
    expect(cloudAttenuation(150)).toBeCloseTo(0.44, 2)
  })

  it('decreases monotonically with cover', () => {
    const values = [0, 20, 40, 60, 80, 100].map(cloudAttenuation)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1])
    }
  })
})

describe('computeUVIndex — cloud', () => {
  it('cuts a clear-sky peak roughly in half under solid overcast', () => {
    const clear = computeUVIndex(LA, '2026-06-21T12:00', 0)
    const overcast = computeUVIndex(LA, '2026-06-21T12:00', 100)
    expect(overcast).toBeLessThan(clear * 0.5)
    expect(overcast).toBeGreaterThan(clear * 0.4)
  })

  it('defaults to clear sky when cloud cover is not supplied', () => {
    expect(computeUVIndex(LA, '2026-06-21T12:00')).toBe(computeUVIndex(LA, '2026-06-21T12:00', 0))
  })
})
