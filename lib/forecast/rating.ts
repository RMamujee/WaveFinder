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

// ── Breaking wave height ─────────────────────────────────────────────────────
//
// Open-Meteo reports significant wave height offshore of the surf zone. What a
// surfer sees is the *breaking* height, which for a given offshore height grows
// with period: long-period groundswell shoals far more than short-period slop.
// Scoring the raw model height is why a 1 m / 16 s groundswell and a 1 m / 7 s
// windswell used to receive identical height scores despite breaking at roughly
// double the size.
//
// Komar & Gaughan (1972): Hb = 0.39 · g^0.2 · (T · H0²)^0.4
// With g = 9.81, the leading constant collapses to ~0.6158.
//
// CALIBRATION: the textbook formula assumes true deep-water H0 and a frictionless
// shoal. Open-Meteo's swell partition is already partly shoaled, and real spots
// lose energy to bottom friction and refraction, so the raw formula runs
// generous against observed surf. The 0.85 factor pulls it back into line with
// how surfers actually call size (1 m @ 14 s ≈ 1.5 m / 5 ft faces). Tune here.
const SHOALING_CALIBRATION = 0.85
const KG_CONSTANT = 0.39 * Math.pow(9.81, 0.2)

export function breakingWaveHeight(deepHeight: number, period: number): number {
  if (deepHeight <= 0 || period <= 0) return 0
  const hb = KG_CONSTANT * Math.pow(period * deepHeight * deepHeight, 0.4)
  return Math.round(hb * SHOALING_CALIBRATION * 100) / 100
}

// ── Directional exposure ─────────────────────────────────────────────────────
//
// Swell arriving off-axis delivers a fraction of its energy to the beach. This
// used to be a small additive score (weight 0.15), which let a spot facing 90°
// away from the swell still rate "good" on size alone. Treating it as a
// multiplier on swell height is both physically right and far more decisive: a
// south-facing beach gets almost nothing from a NW swell.
//
// cos(θ)^0.5 rather than pure cosine because refraction bends energy shoreward,
// making the real falloff gentler than the geometric projection. The floor keeps
// a little energy wrapping in past 90° instead of zeroing the spot outright.
const WRAP_FLOOR = 0.12

export function directionalExposure(
  swellDirection: number | null,
  spotFacing: number
): number {
  // Unknown direction (e.g. buoy sensor offline) must not penalise the spot.
  if (swellDirection == null) return 1
  const theta = angleDiff(swellDirection, spotFacing)
  if (theta >= 90) return WRAP_FLOOR
  const exposure = Math.pow(Math.cos((theta * Math.PI) / 180), 0.5)
  return Math.max(WRAP_FLOOR, exposure)
}

// ── Component scores ─────────────────────────────────────────────────────────

// Breaking/face height in metres (not raw model Hs) → 0-100 desirability.
//
// Interpolated rather than stepped: with step buckets, a 2.0 m face and a 2.9 m
// face scored identically, which erased real differences between spots — the
// off-axis penalty in particular vanished whenever both sizes fell in the same
// bucket. Linear interpolation between control points keeps the shape while
// making the score strictly responsive to size.
const HEIGHT_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0],    // flat
  [0.4, 10],   // ankle
  [0.7, 35],   // knee-to-waist
  [1.0, 55],   // chest
  [1.4, 75],   // head high
  [1.8, 90],   // a foot or two overhead
  [2.5, 100],  // solid overhead — the sweet spot
  [3.5, 100],
  [4.5, 88],   // double overhead plus
  [6.0, 62],   // few spots hold it
  [8.0, 35],   // closing out
]

function scoreFaceHeight(height: number): number {
  if (height <= 0) return 0
  const last = HEIGHT_CURVE[HEIGHT_CURVE.length - 1]
  if (height >= last[0]) return 30
  for (let i = 1; i < HEIGHT_CURVE.length; i++) {
    const [x1, y1] = HEIGHT_CURVE[i]
    if (height <= x1) {
      const [x0, y0] = HEIGHT_CURVE[i - 1]
      const t = (height - x0) / (x1 - x0)
      return Math.round(y0 + t * (y1 - y0))
    }
  }
  return 30
}

function scorePeriod(period: number): number {
  if (period >= 16) return 100
  if (period >= 14) return 90
  if (period >= 12) return 75
  if (period >= 10) return 55
  if (period >= 8) return 35
  return 15
}

function scoreWind(
  windSpeed: number,
  windDirection: number | null,
  spotFacing: number
): number {
  if (windSpeed < 5) return 100

  // Direction unknown (e.g. a borrowed nearest-neighbour reading): score on
  // speed alone. We know it is windy; we do not know whether that wind is
  // grooming the faces or destroying them, so neither reward nor condemn it.
  if (windDirection == null) {
    if (windSpeed < 10) return 70
    if (windSpeed < 15) return 55
    if (windSpeed < 20) return 40
    if (windSpeed < 30) return 25
    return 10
  }

  const offshoreDirection = (spotFacing + 180) % 360
  const diff = angleDiff(windDirection, offshoreDirection)

  let dirScore: number
  if (diff <= 45) dirScore = 100
  else if (diff <= 90) dirScore = 75
  else if (diff <= 135) dirScore = 40
  else dirScore = 10

  let speedPenalty = 0
  if (windSpeed > 30) speedPenalty = 40
  else if (windSpeed > 20) speedPenalty = 20
  else if (windSpeed > 15) speedPenalty = 10

  return Math.max(0, dirScore - speedPenalty)
}

// How much of the sea state is disorganised local windsea versus clean
// groundswell. This is the factor that separates "3 ft and glassy" from
// "3 ft of onshore mush" — the old engine could not tell them apart because it
// scored the combined sea height and ignored the wind-wave partition entirely.
export function scoreCleanliness(swellHeight: number, windWaveHeight: number): number {
  const total = swellHeight + windWaveHeight
  if (total <= 0) return 50
  const chopRatio = windWaveHeight / total
  if (chopRatio <= 0.15) return 100  // groundswell-dominated, organised
  if (chopRatio <= 0.30) return 80
  if (chopRatio <= 0.50) return 55
  if (chopRatio <= 0.70) return 30
  return 10                          // windsea-dominated victory-at-sea
}

export interface TideContext {
  height: number  // tide height at this hour (m, MLLW)
  min: number     // lowest predicted tide across the forecast window
  max: number     // highest predicted tide across the forecast window
}

// Tide preference by bottom type. Reef and coral need water over the shelf, so
// they favour mid-to-high and get dangerous/unrideable at the bottom of the
// range. Sand bars generally break best around mid tide, and extreme high tide
// tends to fatten and back off most breaks regardless of bottom.
export function scoreTide(tide: TideContext, bottomType?: string | null): number {
  const range = tide.max - tide.min
  // A station with no meaningful range (some Gulf/Med stations) tells us nothing.
  if (!isFinite(range) || range < 0.15) return 50

  // Normalised 0 = lowest tide of the window, 1 = highest.
  const t = Math.min(1, Math.max(0, (tide.height - tide.min) / range))

  // Ideal normalised tide and tolerance per bottom type.
  let ideal: number
  let tolerance: number
  switch (bottomType) {
    case 'coral':
    case 'reef':
      ideal = 0.62      // needs water over the reef
      tolerance = 0.30
      break
    case 'rock':
      ideal = 0.45      // points often prefer mid-to-low
      tolerance = 0.32
      break
    case 'sand':
      ideal = 0.50      // beach breaks: mid tide, fairly forgiving
      tolerance = 0.38
      break
    default:
      ideal = 0.50
      tolerance = 0.45  // unknown bottom — stay near neutral
  }

  const offset = Math.abs(t - ideal) / tolerance
  const score = 100 - offset * offset * 55
  return Math.max(15, Math.min(100, Math.round(score)))
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

export interface SurfRatingInput {
  /** Total significant wave height (m) — combined sea. Used only as a fallback
   *  when the swell partition is unavailable (e.g. long-range model hours). */
  waveHeight: number
  /** Groundswell partition height (m) — the surfable component. */
  swellHeight: number
  swellPeriod: number
  swellDirection: number | null
  /** Local windsea partition height (m). Omit when unknown; the cleanliness
   *  factor is then dropped and remaining weights renormalise. */
  windWaveHeight?: number | null
  windSpeed: number       // km/h
  /** Null when the wind reading is borrowed or unavailable — the wind factor
   *  then falls back to a speed-only score. */
  windDirection: number | null
  spotFacing: number
  /** Omit when the spot has no tide station; tide weight renormalises away. */
  tide?: TideContext | null
  bottomType?: string | null
}

export interface SurfRating {
  score: number
  rating: ConditionRating
  /** Estimated breaking wave height (m) after shoaling and directional exposure. */
  faceHeight: number
  /** Per-factor 0-100 scores, for "why is it rated this way" UI. */
  factors: {
    height: number
    period: number
    wind: number
    cleanliness: number | null
    tide: number | null
    exposure: number
  }
}

export function rateSurfConditions(input: SurfRatingInput): SurfRating {
  // Prefer the groundswell partition. Past day ~10 the long-range model has no
  // swell decomposition (open-meteo.ts substitutes total wave), and some hours
  // legitimately have no swell at all — fall back to total sea so the engine
  // still has something to score rather than reporting flat.
  const swellHeight = input.swellHeight > 0 ? input.swellHeight : input.waveHeight
  const windWaveHeight = input.windWaveHeight ?? null

  const exposure = directionalExposure(input.swellDirection, input.spotFacing)
  const effectiveSwell = swellHeight * exposure
  const faceHeight = breakingWaveHeight(effectiveSwell, input.swellPeriod)

  const heightScore = scoreFaceHeight(faceHeight)
  const periodScore = scorePeriod(input.swellPeriod)
  const windScore = scoreWind(input.windSpeed, input.windDirection, input.spotFacing)
  const cleanScore = windWaveHeight != null
    ? scoreCleanliness(swellHeight, windWaveHeight)
    : null
  const tideScore = input.tide ? scoreTide(input.tide, input.bottomType) : null

  // Weighted mean over the factors we actually have. Renormalising means a spot
  // with no tide station is not silently penalised for missing data.
  const weighted: Array<[number, number]> = [
    [heightScore, 0.32],
    [periodScore, 0.22],
    [windScore, 0.26],
  ]
  if (cleanScore != null) weighted.push([cleanScore, 0.10])
  if (tideScore != null) weighted.push([tideScore, 0.10])

  const totalWeight = weighted.reduce((sum, [, w]) => sum + w, 0)
  const rawScore = Math.round(
    weighted.reduce((sum, [s, w]) => sum + s * w, 0) / totalWeight
  )

  // Hard caps: calm wind and a long period can otherwise push tiny surf to
  // "epic". Applied to breaking height, so a small-but-long-period swell that
  // genuinely stands up overhead is no longer capped the way raw Hs capped it.
  let score = rawScore
  if (faceHeight < 0.6) score = Math.min(score, 29)       // knee-high: always poor
  else if (faceHeight < 1.0) score = Math.min(score, 49)  // waist-high: fair at best
  else if (faceHeight < 1.6) score = Math.min(score, 72)  // chest-to-head: good at best

  // Veto caps. A weighted mean lets one catastrophic factor be averaged away by
  // strong numbers elsewhere — a 4.5 m swell at 13 s under 40 km/h of straight
  // onshore wind scored "good" on size and period alone, when it is in fact
  // unsurfable. Conditions this bad are disqualifying, not merely a deduction.
  if (windScore <= 10) score = Math.min(score, 29)
  else if (windScore <= 25) score = Math.min(score, 45)
  else if (windScore <= 40) score = Math.min(score, 62)

  if (cleanScore != null) {
    if (cleanScore <= 10) score = Math.min(score, 29)       // windsea-dominated
    else if (cleanScore <= 30) score = Math.min(score, 52)
  }

  let rating: ConditionRating
  if (score >= 80) rating = 'epic'
  else if (score >= 55) rating = 'good'
  else if (score >= 30) rating = 'fair'
  else rating = 'poor'

  return {
    score,
    rating,
    faceHeight,
    factors: {
      height: heightScore,
      period: periodScore,
      wind: windScore,
      cleanliness: cleanScore,
      tide: tideScore,
      exposure: Math.round(exposure * 100) / 100,
    },
  }
}
