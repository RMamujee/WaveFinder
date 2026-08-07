// Pure derivation logic for the animated "break anatomy" panel on a spot page
// (components/forecast/BreakAnimation.tsx). Kept dependency-free and unit
// tested in isolation — see tests/break-animation.test.ts — because these
// rules decide what shape and peel direction render for ~200 real spots and
// silently getting one wrong is invisible without a fixture-backed test.

import type { SurfSpot } from '@/types/spot'

// ── Region gate ─────────────────────────────────────────────────────────────
// Ships for California first. The seed's `region` field is "Town, SubRegion"
// (e.g. "La Jolla, San Diego", "Half Moon Bay, California") and — verified
// against lib/spots-data.ts — most CA spots do NOT contain the literal word
// "California"; a naive `.includes('California')` would miss almost all of
// them. These are the SubRegion strings that actually appear in
// CALIFORNIA_SPOTS today. This is deliberately NOT lib/region-hierarchy.ts:
// that file is a separate filter-UI taxonomy whose spellings don't match the
// stored `region` strings (e.g. it has "Ventura" / "Monterey" as bare state
// entries and reuses "Central Coast" for Oregon too, while the seed stores
// "Ventura County", "Monterey Bay", and Oregon spots as "Town, OR" — no
// collision with the markers below, confirmed against every US region string
// in the seed).
//
// To enable another state/country later, add a `country -> marker[]` entry
// here — do NOT hardcode a slug list. New spots in an enabled region pick up
// the animation automatically because this checks the stored fields, not an
// identity list.
const ANIMATED_REGIONS: Record<string, string[]> = {
  USA: [
    'California',
    'San Diego',
    'Orange County',
    'Los Angeles',
    'Ventura',
    'Santa Barbara',
    'Central Coast',
    'Monterey',
    'NorCal',
  ],
}

export function isBreakAnimationRegion(spot: Pick<SurfSpot, 'country' | 'region'>): boolean {
  const markers = ANIMATED_REGIONS[spot.country]
  if (!markers) return false
  return markers.some((marker) => spot.region.includes(marker))
}

// ── Archetype: where it breaks ──────────────────────────────────────────────
export type BreakArchetype = 'point' | 'reef' | 'beach'

// Prose wins over the stored bottom material where they'd disagree — a "reef
// point" is reef material but peels like a point, and lib/bottom-type.ts's
// own comment notes plain "rocky ... ledge/shelf/slab" text describes a fixed
// reef, not a headland, even though both get bottomType 'rock'. Order matters:
// point is checked first so "reef point" / "rocky point" resolve to point,
// not reef.
const POINT_RE = /\bpoint\s*break\b|\brocky\s+point\b|\breef\s*point\b|\bheadland\b/i
const REEF_RE = /\breef\b|\bledge\b|\bshelf\b|\bslab\b|\boutside\s+bank\b/i
const BEACH_RE = /\bbeach\s*break\b|\bsand\s*bars?\b/i

export function deriveBreakArchetype(
  bottomType: string | null | undefined,
  description: string | null | undefined
): BreakArchetype {
  const text = description ?? ''
  if (POINT_RE.test(text)) return 'point'
  if (REEF_RE.test(text)) return 'reef'
  if (BEACH_RE.test(text)) return 'beach'

  // Prose gave no geometry hint — fall back to the stored bottom material.
  // Rock/cobble bottoms are point breaks by construction in this dataset
  // (see inferBottomType's point-break rule); reef/coral stand up over a
  // fixed bank; sand and anything else (including 'mixed', which is roughly
  // half sand/half reef in this seed) default to a beach break, matching
  // inferBottomType's own last-resort default rather than guessing a specific
  // structural feature the prose never confirmed.
  switch ((bottomType ?? '').toLowerCase()) {
    case 'rock':
      return 'point'
    case 'reef':
    case 'coral':
      return 'reef'
    default:
      return 'beach'
  }
}

// ── Hand: how it breaks ──────────────────────────────────────────────────────
export type BreakHand = 'left' | 'right' | 'a-frame'

const A_FRAME_RE = /\ba-frames?\b|\bpeaks?\s+both\s+ways\b|\bpeaks?\s+(?:in\s+)?both\s+directions\b/i
const LEFT_RE = /\bleft-hand(?:ers?)?\b|\bleft-breaking\b|\blefts\b/i
const RIGHT_RE = /\bright-hand(?:ers?)?\b|\bright-breaking\b|\brights\b/i

export function deriveBreakHand(description: string | null | undefined): BreakHand {
  const text = description ?? ''
  if (A_FRAME_RE.test(text)) return 'a-frame'
  const left = LEFT_RE.test(text)
  const right = RIGHT_RE.test(text)
  if (left && right) return 'a-frame' // "rights and lefts" — the peak breaks both ways
  if (left) return 'left'
  if (right) return 'right'
  return 'a-frame' // prose doesn't say — A-frame is the honest default, not a guessed handedness
}

// ── Timing: forecast swell period -> animation cadence ──────────────────────
// A real wave period is seconds between crests. Scaling it down (rather than
// 1:1) keeps the loop watchable while preserving the *relative* difference
// the brief asks for — a 16s groundswell must read as unmistakably
// slower/more spaced than a 7s windswell, not just technically different.
const PERIOD_TO_SECONDS = 0.6
const MIN_SET_INTERVAL = 2.6 // below this the motion reads as jittery noise, not "long period"
const MAX_SET_INTERVAL = 10.5 // above this it starts to look frozen/broken, not "slow and powerful"

export function periodToSetInterval(period: number): number {
  if (!Number.isFinite(period) || period <= 0) return MAX_SET_INTERVAL
  return Math.min(MAX_SET_INTERVAL, Math.max(MIN_SET_INTERVAL, period * PERIOD_TO_SECONDS))
}

// ── Angle: swell direction relative to the spot's facing direction ──────────
// Signed degrees in (-180, 180]. 0 = swell squarely matches the spot's ideal
// facing direction (IdealConditionsPanel already treats facingDirection as
// the ideal incoming swell bearing). The sign says which side of square the
// swell arrives from, so the diagram tilts the same way the real swell does.
export function relativeSwellAngle(swellDirection: number, facingDirection: number): number {
  // Normalize to [0, 360) first, then fold the far half down to (-180, 0) —
  // NOT the more common "+540 % 360 - 180" shortcut, which maps the exact
  // antipodal case (a 180° swell-vs-facing mismatch) to -180 instead of the
  // +180 this function's own (-180, 180] contract promises.
  const raw = ((swellDirection - facingDirection) % 360 + 360) % 360
  return raw > 180 ? raw - 360 : raw
}
