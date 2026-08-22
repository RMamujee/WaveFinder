import { describe, it, expect } from 'vitest'
import { computeSunriseSunset } from '@/lib/forecast/sun-times'

// The values are LOCAL SOLAR time for a local-clock axis. The regression this
// pins: a lng/15 term converted them to UTC, so Los Angeles plotted sunrise at
// 1:17 PM and sunset at 2:31 AM — sunset before sunrise on the axis. Solar
// time can differ from the zone clock by ~±1 h (longitude-within-zone + DST),
// so the assertions are coarse on purpose.
describe('computeSunriseSunset', () => {
  const AUG = new Date('2026-08-21T12:00:00Z')
  const DEC = new Date('2026-12-21T12:00:00Z')

  it('puts sunrise in the morning and sunset in the evening, everywhere', () => {
    const places: [number, number][] = [
      [34.0, -118.5],  // Los Angeles
      [21.7, -158.0],  // North Shore, Oahu
      [-28.0, 153.4],  // Gold Coast, AU
      [43.7, -1.4],    // Hossegor, FR
      [-34.1, 24.9],   // Jeffrey's Bay, ZA
    ]
    for (const [lat, lng] of places) {
      for (const date of [AUG, DEC]) {
        const { sunrise, sunset } = computeSunriseSunset(lat, lng, date)
        expect(sunrise, `sunrise ${lat},${lng}`).toBeGreaterThan(3)
        expect(sunrise, `sunrise ${lat},${lng}`).toBeLessThan(10)
        expect(sunset, `sunset ${lat},${lng}`).toBeGreaterThan(14)
        expect(sunset, `sunset ${lat},${lng}`).toBeLessThan(22)
        expect(sunset).toBeGreaterThan(sunrise)
      }
    }
  })

  it('gives Los Angeles a longer day in August than in December', () => {
    const summer = computeSunriseSunset(34.0, -118.5, AUG)
    const winter = computeSunriseSunset(34.0, -118.5, DEC)
    expect(summer.sunset - summer.sunrise).toBeGreaterThan(winter.sunset - winter.sunrise)
  })

  it('flips the seasons in the Southern Hemisphere', () => {
    const augGoldCoast = computeSunriseSunset(-28.0, 153.4, AUG)
    const decGoldCoast = computeSunriseSunset(-28.0, 153.4, DEC)
    expect(decGoldCoast.sunset - decGoldCoast.sunrise)
      .toBeGreaterThan(augGoldCoast.sunset - augGoldCoast.sunrise)
  })

  it('is longitude-independent: same latitude, same solar times', () => {
    const la = computeSunriseSunset(34.0, -118.5, AUG)
    const sameLatJapan = computeSunriseSunset(34.0, 135.0, AUG)
    expect(sameLatJapan.sunrise).toBeCloseTo(la.sunrise, 1)
    expect(sameLatJapan.sunset).toBeCloseTo(la.sunset, 1)
  })

  it('falls back to defaults at polar latitudes with no sunrise', () => {
    const { sunrise, sunset } = computeSunriseSunset(80, 0, DEC)
    expect(sunrise).toBe(6.25)
    expect(sunset).toBe(19.6)
  })
})
