import type { ConditionRating } from '@/types/forecast'

export function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function scoreWind(windSpeed: number, windDirection: number, spotFacing: number): number {
  if (windSpeed < 5) return 100

  const offshoreDirection = (spotFacing + 180) % 360
  const diff = angleDiff(windDirection, offshoreDirection)

  let dirScore: number
  if (diff <= 45)       dirScore = 100
  else if (diff <= 90)  dirScore = 75
  else if (diff <= 135) dirScore = 40
  else                  dirScore = 10

  let speedPenalty = 0
  if (windSpeed > 30)      speedPenalty = 40
  else if (windSpeed > 20) speedPenalty = 20
  else if (windSpeed > 15) speedPenalty = 10

  return Math.max(0, dirScore - speedPenalty)
}

function scorePeriod(period: number): number {
  if (period >= 16) return 100
  if (period >= 14) return 90
  if (period >= 12) return 75
  if (period >= 10) return 55
  if (period >= 8)  return 35
  return 15
}

function scoreHeight(height: number): number {
  if (height < 0.3)  return 5
  if (height < 0.5)  return 25
  if (height < 0.8)  return 50
  if (height < 1.2)  return 75
  if (height < 2.0)  return 95
  if (height < 2.5)  return 100
  if (height < 3.5)  return 85
  if (height < 5.0)  return 60
  return 30
}

function scoreDirection(swellDirection: number, spotFacing: number): number {
  const diff = angleDiff(swellDirection, spotFacing)
  if (diff <= 20)  return 100
  if (diff <= 45)  return 85
  if (diff <= 70)  return 60
  if (diff <= 90)  return 35
  return 10
}

/**
 * Wave energy flux (power) in kW per meter of crest width.
 * Simplified formula: P ≈ 0.5 × Hs² × T
 * where Hs is significant wave height (m) and T is dominant period (s).
 */
export function computeWavePower(waveHeight: number, period: number): number {
  if (waveHeight <= 0 || period <= 0) return 0
  return Math.round(0.5 * waveHeight * waveHeight * period * 10) / 10
}

export function rateSurfConditions(input: {
  waveHeight: number
  swellPeriod: number
  swellHeight: number
  windSpeed: number
  windDirection: number
  swellDirection: number
  spotFacing: number
}): { score: number; rating: ConditionRating } {
  const heightScore    = scoreHeight(input.waveHeight)
  const periodScore    = scorePeriod(input.swellPeriod)
  const windScore      = scoreWind(input.windSpeed, input.windDirection, input.spotFacing)
  const directionScore = scoreDirection(input.swellDirection, input.spotFacing)

  const rawScore = Math.round(
    heightScore    * 0.25 +
    periodScore    * 0.30 +
    windScore      * 0.30 +
    directionScore * 0.15
  )

  // Hard caps: calm wind + long period can otherwise push tiny waves to "epic".
  // A wave must be overhead+ (≥1.5m / ~5ft) to ever achieve epic.
  let score = rawScore
  if (input.waveHeight < 0.4)      score = Math.min(rawScore, 29)  // knee-high: always poor
  else if (input.waveHeight < 0.7) score = Math.min(rawScore, 49)  // waist-high: fair at best
  else if (input.waveHeight < 1.5) score = Math.min(rawScore, 72)  // chest-to-head: good at best

  let rating: ConditionRating
  if (score >= 80)      rating = 'epic'
  else if (score >= 55) rating = 'good'
  else if (score >= 30) rating = 'fair'
  else                  rating = 'poor'

  return { score, rating }
}
