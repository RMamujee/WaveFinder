import type { ConditionRating } from '@/types/forecast'

export function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

/** Smallest absolute separation between two compass bearings, 0-180. */
export function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

// Linear interpolation over a monotonically-increasing table of [x, y] control
// points. Below the first point returns its y; at or above the last returns the
// caller's `beyond` value. Stepped buckets are the recurring defect this
// replaces: 0.1 s of period or 8 cm of face used to move a rating two bands.
function interpolateCurve(
  curve: ReadonlyArray<readonly [number, number]>,
  x: number,
  beyond: number
): number {
  if (x <= curve[0][0]) return curve[0][1]
  const last = curve[curve.length - 1]
  if (x >= last[0]) return beyond
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]
    if (x <= x1) {
      const [x0, y0] = curve[i - 1]
      const t = (x - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return beyond
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
//
// The curve is expressed for an INTERMEDIATE spot; `difficulty` rescales the
// x-axis (see DIFFICULTY_SCALE), because a beginner beach break and Nazaré do
// not share a sweet spot.
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
  [10.0, 20],  // nobody is paddling out
]

// A spot's difficulty rating IS a statement about the size it is meant for. One
// universal curve rated a beginner's waist-high peeler and a big-wave reef on
// the same scale — the beach break never scored above "fair" on its best day,
// and Nazaré peaked at a size it barely wakes up for. Scaling the curve's
// x-axis is the smallest change that respects both: divide the face height by
// the spot's scale before reading the curve.
const DIFFICULTY_SCALE = {
  beginner: 0.55,
  intermediate: 1,
  advanced: 1.5,
  // Nazaré, Mullaghmore, Dungeons, Jaws. These breaks do not wake up until the
  // size that closes everything else out, so head-high there is a non-event.
  expert: 2.2,
} as const

export type SpotDifficulty = keyof typeof DIFFICULTY_SCALE

function difficultyScale(difficulty?: SpotDifficulty | null): number {
  return (difficulty && DIFFICULTY_SCALE[difficulty]) || 1
}

function scoreFaceHeight(height: number): number {
  if (height <= 0) return 0
  // `beyond` matches the final control point rather than the old hardcoded 30,
  // which sat 5 points BELOW the curve it continued — an 8.0 m face scored 35
  // and an 8.01 m face scored 30.
  return Math.round(interpolateCurve(HEIGHT_CURVE, height, 20))
}

// Open-Meteo's `swell_wave_period` is a MEAN period (Tm), but these thresholds
// were written in peak-period language ("16 s groundswell"). Tm ≈ 0.8-0.85·Tp,
// so the old buckets under-rated exactly the swells worth shouting about: a true
// 16 s groundswell arrives as ~13.2 s and scored 91 instead of 98. Thresholds
// are shifted down ~15% (16→13.5, 14→12, 12→10, 10→8.5, 8→6.5) and interpolated
// — the step buckets flipped bands on 0.1 s of model noise (9.9 s → 79,
// 10.0 s → 84).
const PERIOD_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0],
  [4.0, 15],   // wind slop
  [6.5, 35],   // short-period windswell
  [8.5, 55],
  [10.0, 75],
  [12.0, 90],
  [13.5, 100], // ~16 s peak period — a real groundswell
]

function scorePeriod(period: number): number {
  if (period <= 0) return 0
  return Math.round(interpolateCurve(PERIOD_CURVE, period, 100))
}

// The expectation of dirScore over a uniformly unknown direction:
// mean of ((1+cosθ)/2)^1.5 over θ∈[0,180°] is 4/(3π), so 10 + 90·4/(3π) ≈ 48.
// Used for the unknown-direction branch so it sits between the best and worst
// KNOWN directions at every speed instead of below the worst.
const MEAN_DIR_SCORE = 10 + 90 * (4 / (3 * Math.PI))

// Continuous speed penalty (piecewise-linear between the old tier anchors).
// Stepped tiers put a 30-point cliff at 45 km/h that landed on a veto
// boundary — 0.2 km/h of model noise moved "epic" to "good".
function windSpeedPenalty(windSpeed: number): number {
  if (windSpeed <= 15) return 0
  if (windSpeed <= 20) return (windSpeed - 15) * 2             // 0 → 10
  if (windSpeed <= 30) return 10 + (windSpeed - 20)            // 10 → 20
  // 20 → 60 by 45 km/h: a perfect offshore (dirScore 100) lands exactly on the
  // windScore <= 40 veto at 45 km/h, so the documented ">45 km/h is capped
  // regardless of direction" holds without reintroducing a cliff. (A gentler
  // ramp here once let a 50 km/h offshore gale rate "epic".)
  if (windSpeed <= 45) return 20 + ((windSpeed - 30) * 8) / 3
  return Math.min(70, 60 + (windSpeed - 45) * 2)               // 60 → 70 by 50; unpaddleable
}

// A gusty wind is worse than a steady one at the same mean speed: the face is
// groomed then wrecked, then groomed again. Gusts were fetched and displayed
// but never scored, so 12 km/h gusting 35 rated exactly like 12 km/h steady.
// Blending part of the excess into the speed the engine scores is the smallest
// change that captures it — and it keeps a genuine calm calm, because 2 km/h
// gusting 8 still lands below the 5 km/h glassy threshold.
const GUST_WEIGHT = 0.4

function effectiveWindSpeed(windSpeed: number, windGust: number | null | undefined): number {
  if (windGust == null || windGust <= windSpeed) return windSpeed
  return windSpeed + GUST_WEIGHT * (windGust - windSpeed)
}

function scoreWind(
  rawWindSpeed: number,
  windDirection: number | null,
  spotFacing: number,
  windGust?: number | null
): number {
  const windSpeed = effectiveWindSpeed(rawWindSpeed, windGust)
  if (windSpeed < 5) return 100

  // Speed-gate the direction penalty: wind damage scales with SPEED — direction
  // only sets its character. The old shape applied direction at full strength
  // from 5 km/h up, so a near-glassy 6 km/h onshore drift vetoed a spot exactly
  // like a 30 km/h gale (a 0.1 km/h change at the threshold moved three rating
  // bands). Below ~8-10 km/h neither direction materially textures the face;
  // the gate fades direction in over 5→20 km/h.
  const gate = Math.min(1, Math.max(0, (windSpeed - 5) / 15))
  const speedPenalty = windSpeedPenalty(windSpeed)

  // Direction unknown (e.g. a borrowed nearest-neighbour reading): score the
  // MEAN direction, gated exactly like a known one. We know it is windy; we do
  // not know whether that wind is grooming the faces or destroying them, so
  // neither reward nor condemn it — and never below the worst known direction.
  if (windDirection == null) {
    const directed = 100 - (100 - MEAN_DIR_SCORE) * gate
    return Math.max(0, Math.round(directed - speedPenalty))
  }

  const offshoreDirection = (spotFacing + 180) % 360
  const diff = angleDiff(windDirection, offshoreDirection)

  // Continuous direction score. The old 4-step buckets meant 2° of model noise
  // (224° vs 226° at 12 km/h) moved the final rating two bands.
  const dirScore = 10 + 90 * Math.pow((1 + Math.cos((diff * Math.PI) / 180)) / 2, 1.5)
  const directed = 100 - (100 - dirScore) * gate

  return Math.max(0, Math.round(directed - speedPenalty))
}

// How much of the sea state is disorganised local windsea versus clean
// groundswell. This is the factor that separates "3 ft and glassy" from
// "3 ft of onshore mush" — the old engine could not tell them apart because it
// scored the combined sea height and ignored the wind-wave partition entirely.
//
// The share is taken in QUADRATURE (H² is proportional to energy), not as a
// linear height ratio. The linear form over-penalised modest chop by 20-25
// points and let genuine victory-at-sea (0.6 m swell under 1.0 m of windsea)
// escape the strong veto. Buckets are re-anchored to the energy scale.
//
// `swellHeight` should be the EXPOSURE-REDUCED swell actually reaching the
// spot: an off-axis spot whose groundswell mostly sails past still rated
// "clean" when the raw partition height was used, even though its sea surface
// is windsea-dominated.
export function scoreCleanliness(swellHeight: number, windWaveHeight: number): number {
  const swellEnergy = swellHeight * swellHeight
  const chopEnergy = windWaveHeight * windWaveHeight
  const total = swellEnergy + chopEnergy
  if (total <= 0) return 50
  const chopRatio = chopEnergy / total
  if (chopRatio <= 0.05) return 100  // groundswell-dominated, organised
  if (chopRatio <= 0.15) return 80
  if (chopRatio <= 0.40) return 55
  if (chopRatio <= 0.65) return 30
  return 10                          // windsea-dominated victory-at-sea
}

export interface TideContext {
  height: number  // tide height at this hour (m, MLLW)
  min: number     // lowest predicted tide across the forecast window
  max: number     // highest predicted tide across the forecast window
  /** True when the tide is pushing in at this hour, false when draining, null
   *  when the series can't say (first hour, or a flat pair). */
  rising?: boolean | null
}

// Tide preference by bottom type, in METRES of water above the station datum —
// not as a rank within the day's range. Rank-scoring made "ideal reef tide"
// (0.62 normalised) mean 1.31 m at a 2.6 m-range station and 2.72 m at a 6 m
// one, and at a station barely clearing the old range guard ±5 cm swung the
// factor 75 points. A reef sits at a fixed depth below datum: what it needs is
// an absolute amount of water over it, and the same amount is too much water
// once the tide is metres above that.
//
// Tolerance is asymmetric — a dry reef is unrideable, a fat high tide is merely
// disappointing.
interface TidePreference {
  ideal: number
  lowTolerance: number
  highTolerance: number
}

const TIDE_PREFERENCE: Record<string, TidePreference> = {
  coral: { ideal: 1.2, lowTolerance: 0.7, highTolerance: 1.4 },
  reef:  { ideal: 1.2, lowTolerance: 0.7, highTolerance: 1.4 },
  rock:  { ideal: 1.0, lowTolerance: 0.8, highTolerance: 1.4 },
  sand:  { ideal: 0.9, lowTolerance: 0.9, highTolerance: 1.3 },
}

// Unknown bottom — stay near neutral rather than guessing a depth preference.
const TIDE_PREFERENCE_DEFAULT: TidePreference = {
  ideal: 1.0, lowTolerance: 1.1, highTolerance: 1.6,
}

// Surf lore with a physical basis: a pushing tide carries water (and swell
// energy) shoreward, a draining one works against it. Small on purpose — it
// nudges between hours, it does not decide a session.
const TIDE_TREND_BONUS = 4

export function scoreTide(tide: TideContext, bottomType?: string | null): number {
  const range = tide.max - tide.min
  // A station with no meaningful range (some Gulf/Med stations, and any station
  // whose series failed to load properly) tells us nothing about depth. Widened
  // from 0.15 m: below ~0.5 m of range the tide is not what decides the session.
  if (!isFinite(range) || range < 0.5) return 50
  if (!isFinite(tide.height)) return 50

  const pref = (bottomType && TIDE_PREFERENCE[bottomType]) || TIDE_PREFERENCE_DEFAULT
  const delta = tide.height - pref.ideal
  const tolerance = delta < 0 ? pref.lowTolerance : pref.highTolerance

  const offset = Math.abs(delta) / tolerance
  let score = 100 - offset * offset * 55
  if (tide.rising != null) score += tide.rising ? TIDE_TREND_BONUS : -TIDE_TREND_BONUS

  return Math.max(15, Math.min(100, Math.round(score)))
}

/**
 * Wave energy flux (power) in kW per metre of crest width.
 *
 * P ≈ 0.5 · H² · T, summed over the sea's PARTITIONS rather than applied once
 * to the combined height. Energy is additive across partitions but period is
 * not: feeding the total sea height with the swell's period charges the short,
 * choppy windsea at the groundswell's period, which measured 1.79-2.0× too
 * high in mixed seas. It is a user-facing number in three places (the map
 * popup, the gear panel's power line, and the surf-report energy card), so a
 * 2x error is read, not just stored.
 *
 * Partitions with no height or no period contribute nothing.
 */
export function computeWavePower(
  partitions: ReadonlyArray<{ height: number | null; period: number | null }>
): number {
  let total = 0
  for (const p of partitions) {
    if (p.height == null || p.period == null) continue
    if (p.height <= 0 || p.period <= 0) continue
    total += 0.5 * p.height * p.height * p.period
  }
  return Math.round(total * 10) / 10
}

/** One swell train reported by the model (or observed by a buoy). */
export interface SwellPartition {
  height: number
  period: number
  direction: number | null
}

export interface SurfRatingInput {
  /** Total significant wave height (m) — combined sea. Used only as a fallback
   *  when the swell partition is unavailable (e.g. long-range model hours). */
  waveHeight: number
  /** Primary groundswell partition height (m) — the surfable component. */
  swellHeight: number
  swellPeriod: number
  swellDirection: number | null
  /** Open-Meteo's second swell train. Partitions are ranked by HEIGHT, so the
   *  longer-period (and usually more surfable) train is frequently the second
   *  one — scoring only the first meant scoring 6-second slop while the actual
   *  surf sat in the ignored partition. Omit when unavailable. */
  secondarySwell?: SwellPartition | null
  /** Local windsea partition height (m). Omit when unknown; the cleanliness
   *  factor is then dropped and remaining weights renormalise. */
  windWaveHeight?: number | null
  windSpeed: number       // km/h
  /** Peak gust (km/h). Omit when unknown; the wind factor is then scored on the
   *  mean speed alone, exactly as before. */
  windGust?: number | null
  /** Null when the wind reading is borrowed or unavailable — the wind factor
   *  then falls back to a speed-only score. */
  windDirection: number | null
  spotFacing: number
  /** Omit when the spot has no tide station; tide weight renormalises away. */
  tide?: TideContext | null
  bottomType?: string | null
  /** Rescales the height curve — a beginner break peaks far below Nazaré.
   *  Defaults to 'intermediate' (scale 1), i.e. the unscaled curve. */
  difficulty?: SpotDifficulty | null
}

export interface SurfRating {
  score: number
  rating: ConditionRating
  /** Estimated breaking wave height (m) — every swell partition shoaled,
   *  reduced by directional exposure, and combined in quadrature. */
  faceHeight: number
  /** The swell trains folded into one: height in quadrature, period and
   *  direction weighted by each train's breaking energy AT THIS SPOT. Callers
   *  should DISPLAY this rather than the model's primary partition, or the UI
   *  shows a 6 s period beside a rating computed from an 11 s one. Null when
   *  nothing breaks (no height, or no period to shoal it with). */
  combinedSwell: SwellPartition | null
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

// Hard caps on small surf, as a continuous ramp rather than three steps. The
// stepped form released discontinuously: 8 cm of face (4 cm of model swell)
// across the 1.6 m boundary was worth 20 points and moved "good" → "epic".
//
// The control points are the old step's own values at the sizes where it
// changed — knee-high still can't beat "poor", the release is still complete at
// 1.6 m — so the ramp reproduces the intended judgement at every boundary and
// only removes the cliffs between them.
//
// Read against the DIFFICULTY-SCALED face height, so a beginner break at
// waist-high is not permanently capped at "fair" on its best day.
const HEIGHT_CAP_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0],    // flat
  [0.6, 29],   // knee-high: poor at best
  [1.0, 72],   // chest-high: good at best
  [1.6, 100],  // head-high and over: nothing withheld
]

function heightCap(scaledFace: number): number {
  return interpolateCurve(HEIGHT_CAP_CURVE, scaledFace, 100)
}

export function rateSurfConditions(input: SurfRatingInput): SurfRating {
  // Prefer the groundswell partition. Past day ~10 the long-range model has no
  // swell decomposition (open-meteo.ts substitutes total wave), and some hours
  // legitimately have no swell at all — fall back to total sea so the engine
  // still has something to score rather than reporting flat.
  const primaryHeight = input.swellHeight > 0 ? input.swellHeight : input.waveHeight
  const windWaveHeight = input.windWaveHeight ?? null

  // Score every swell train separately: each shoals by its OWN period and is
  // reduced by its OWN angle to the beach. A 0.34 m / 11 s secondary can break
  // bigger than a 0.54 m / 6 s primary, and combining them in quadrature (the
  // sea-state energy sum) is what makes the reported face match the water.
  const raw: SwellPartition[] = [
    { height: primaryHeight, period: input.swellPeriod, direction: input.swellDirection },
  ]
  if (input.secondarySwell && input.secondarySwell.height > 0 && input.secondarySwell.period > 0) {
    raw.push(input.secondarySwell)
  }

  let faceEnergy = 0          // Σ Hb² — the breaking energy, weight for the blend
  let effectiveEnergy = 0     // Σ (H·exposure)² — the swell energy reaching the spot
  let rawEnergy = 0           // Σ H² — the sea state, independent of this spot
  let weightedPeriod = 0
  let dirX = 0
  let dirY = 0
  let dirWeight = 0
  let weightedExposure = 0

  for (const partition of raw) {
    const exposure = directionalExposure(partition.direction, input.spotFacing)
    const effective = partition.height * exposure
    const breaking = breakingWaveHeight(effective, partition.period)
    const energy = breaking * breaking

    faceEnergy += energy
    effectiveEnergy += effective * effective
    rawEnergy += partition.height * partition.height
    weightedPeriod += energy * partition.period
    weightedExposure += energy * exposure
    if (partition.direction != null) {
      const rad = (partition.direction * Math.PI) / 180
      dirX += energy * Math.cos(rad)
      dirY += energy * Math.sin(rad)
      dirWeight += energy
    }
  }

  const faceHeight = Math.round(Math.sqrt(faceEnergy) * 100) / 100
  const effectiveSwell = Math.sqrt(effectiveEnergy)

  // Blend the trains rather than picking one. Picking the "dominant" partition
  // reintroduces exactly the defect the audit measured on the model's own
  // ranking: one uniform SoCal swell produced periods spanning 6.7-11.9 s
  // across 16 adjacent spots, purely from rank flips between trains of nearly
  // equal size. A continuous energy-weighted blend cannot flip.
  const combinedSwell: SwellPartition | null = faceEnergy > 0
    ? {
        height: Math.round(Math.sqrt(rawEnergy) * 100) / 100,
        period: Math.round((weightedPeriod / faceEnergy) * 100) / 100,
        direction: dirWeight > 0 && (dirX !== 0 || dirY !== 0)
          ? Math.round((((Math.atan2(dirY, dirX) * 180) / Math.PI) + 360) % 360) % 360
          : null,
      }
    : null

  const scale = difficultyScale(input.difficulty)
  const scaledFace = faceHeight / scale

  const heightScore = scoreFaceHeight(scaledFace)
  // The period that matters is the one carrying the surf, not whichever train
  // the model happened to rank first.
  const periodScore = scorePeriod(combinedSwell?.period ?? raw[0].period)
  const windScore = scoreWind(input.windSpeed, input.windDirection, input.spotFacing, input.windGust)
  const cleanScore = windWaveHeight != null
    ? scoreCleanliness(effectiveSwell, windWaveHeight)
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

  // Size cap: calm wind and a long period can otherwise push tiny surf to
  // "epic". Applied to breaking height, so a small-but-long-period swell that
  // genuinely stands up overhead is no longer capped the way raw Hs capped it.
  let score = Math.min(rawScore, Math.round(heightCap(scaledFace)))

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
    combinedSwell,
    factors: {
      height: heightScore,
      period: periodScore,
      wind: windScore,
      cleanliness: cleanScore,
      tide: tideScore,
      exposure: faceEnergy > 0
        ? Math.round((weightedExposure / faceEnergy) * 100) / 100
        : Math.round(directionalExposure(raw[0].direction, input.spotFacing) * 100) / 100,
    },
  }
}
