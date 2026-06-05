import { describe, it, expect } from 'vitest'
import {
  degreesToCompass,
  computeWavePower,
  rateSurfConditions,
} from '@/lib/forecast/rating'

describe('degreesToCompass', () => {
  it('maps the cardinal directions', () => {
    expect(degreesToCompass(0)).toBe('N')
    expect(degreesToCompass(90)).toBe('E')
    expect(degreesToCompass(180)).toBe('S')
    expect(degreesToCompass(270)).toBe('W')
  })

  it('maps the primary intercardinal directions', () => {
    expect(degreesToCompass(45)).toBe('NE')
    expect(degreesToCompass(135)).toBe('SE')
    expect(degreesToCompass(225)).toBe('SW')
    expect(degreesToCompass(315)).toBe('NW')
  })

  it('rounds to the nearest 22.5 degree sector and wraps at 360', () => {
    // 350 / 22.5 = 15.56 -> rounds to 16 -> 16 % 16 = 0 -> 'N'
    expect(degreesToCompass(350)).toBe('N')
    expect(degreesToCompass(360)).toBe('N')
    // 22 -> sector 1 -> 'NNE'
    expect(degreesToCompass(22)).toBe('NNE')
  })
})

describe('computeWavePower', () => {
  it('uses P = 0.5 * Hs^2 * T rounded to one decimal', () => {
    // 0.5 * 2^2 * 10 = 20
    expect(computeWavePower(2, 10)).toBe(20)
    // 0.5 * 1.5^2 * 12 = 13.5
    expect(computeWavePower(1.5, 12)).toBe(13.5)
  })

  it('returns 0 for non-positive height or period', () => {
    expect(computeWavePower(0, 10)).toBe(0)
    expect(computeWavePower(2, 0)).toBe(0)
    expect(computeWavePower(-1, 10)).toBe(0)
  })
})

describe('rateSurfConditions', () => {
  it('rates big, clean, well-aligned long-period surf as epic', () => {
    const { score, rating } = rateSurfConditions({
      waveHeight: 2.2,
      swellPeriod: 16,
      swellHeight: 2.2,
      windSpeed: 2, // < 5 -> perfect wind score
      windDirection: 0,
      swellDirection: 270, // aligned with spotFacing
      spotFacing: 270,
    })
    expect(rating).toBe('epic')
    expect(score).toBeGreaterThanOrEqual(80)
  })

  it('rates tiny knee-high waves as poor regardless of other factors', () => {
    const { score, rating } = rateSurfConditions({
      waveHeight: 0.2, // < 0.4 -> capped at 29
      swellPeriod: 18,
      swellHeight: 0.2,
      windSpeed: 0,
      windDirection: 0,
      swellDirection: 270,
      spotFacing: 270,
    })
    expect(rating).toBe('poor')
    expect(score).toBeLessThanOrEqual(29)
  })

  it('caps chest-to-head surf at "good" via the hard height cap', () => {
    const { score, rating } = rateSurfConditions({
      waveHeight: 1.0, // 0.7..1.5 -> capped at 72
      swellPeriod: 16,
      swellHeight: 1.0,
      windSpeed: 0,
      windDirection: 0,
      swellDirection: 270,
      spotFacing: 270,
    })
    expect(score).toBeLessThanOrEqual(72)
    expect(rating).not.toBe('epic')
  })

  it('uses a neutral direction score (50) when swellDirection is null', () => {
    const withNull = rateSurfConditions({
      waveHeight: 2.2,
      swellPeriod: 14,
      swellHeight: 2.2,
      windSpeed: 0,
      windDirection: 0,
      swellDirection: null,
      spotFacing: 270,
    })
    const withAligned = rateSurfConditions({
      waveHeight: 2.2,
      swellPeriod: 14,
      swellHeight: 2.2,
      windSpeed: 0,
      windDirection: 0,
      swellDirection: 270, // perfect alignment -> 100
      spotFacing: 270,
    })
    // Aligned (100) must score at least as high as the neutral (50) fallback.
    expect(withAligned.score).toBeGreaterThanOrEqual(withNull.score)
  })

  it('penalises strong onshore wind', () => {
    const offshore = rateSurfConditions({
      waveHeight: 2.0,
      swellPeriod: 14,
      swellHeight: 2.0,
      windSpeed: 25,
      windDirection: 90, // offshore for a 270-facing spot ((270+180)%360 = 90)
      swellDirection: 270,
      spotFacing: 270,
    })
    const onshore = rateSurfConditions({
      waveHeight: 2.0,
      swellPeriod: 14,
      swellHeight: 2.0,
      windSpeed: 25,
      windDirection: 270, // straight onshore
      swellDirection: 270,
      spotFacing: 270,
    })
    expect(offshore.score).toBeGreaterThan(onshore.score)
  })

  it('returns one of the four valid rating labels', () => {
    const { rating } = rateSurfConditions({
      waveHeight: 0.9,
      swellPeriod: 10,
      swellHeight: 0.9,
      windSpeed: 12,
      windDirection: 200,
      swellDirection: 240,
      spotFacing: 270,
    })
    expect(['poor', 'fair', 'good', 'epic']).toContain(rating)
  })
})
