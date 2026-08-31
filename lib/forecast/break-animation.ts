// Pure derivation logic for the animated "break anatomy" panel on a spot page
// (components/forecast/BreakAnimation.tsx). Kept dependency-free and unit
// tested in isolation — see tests/break-animation.test.ts — because these
// rules decide what shape and peel direction render for ~200 real spots and
// silently getting one wrong is invisible without a fixture-backed test.

import type { SurfSpot } from '@/types/spot'

// ── Coverage gate ────────────────────────────────────────────────────────────
// Used to ship for California only via an ANIMATED_REGIONS country->marker[]
// allowlist. Audited 2026-08-31 before widening: every derivation below reads
// only plain compass bearings (`facingDirection`, `hour.swellDirection`) and
// free-text prose (`description`, `bottomType`), none of which are
// hemisphere- or region-specific.
//   - `deriveBreakHand` never touches facingDirection/swellDirection at all —
//     handedness comes entirely from real-world prose ("left-hand", "right
//     rand"...) written for the actual wave, so it is already correct for a
//     Southern Ocean right-hander (Bells) or a Bukit Peninsula left (Padang
//     Padang) the same way it is for a Malibu right.
//   - `relativeSwellAngle` is `swellDirection - facingDirection` on plain
//     0-360 compass bearings (same convention `directionalExposure`/
//     `angleDiff` use in lib/forecast/rating.ts) folded into (-180, 180]. That
//     arithmetic has no latitude term and needs none: a bearing of 210 means
//     "from the SSW" identically north and south of the equator, so the sign
//     of the offset is not something a hemisphere could flip.
//   - `deriveBreakArchetype`/`crestCountForPeriod`/`periodToSetInterval` read
//     bottom material, prose, and swell period only.
// Verified against the seed (`SURF_SPOTS_SEED`, 1,482 spots): every spot has
// a numeric `facingDirection`, a `bottomType`, and a non-empty `description`
// today, and both derivations already degrade to an honest default (`beach`,
// `a-frame`) when prose gives no geometry/hand hint — see
// `deriveBreakArchetype`'s and `deriveBreakHand`'s fallback branches. So there
// is no region-specific class of spot to exclude; the only real requirement
// is a finite `facingDirection`, since that one (unlike bottomType/
// description) is used directly, unguarded, in `relativeSwellAngle`. Gating
// on that field — not geography — is what makes a legacy/transitional row
// (e.g. an unmigrated Postgres-cuid spot) degrade to "no animation" instead
// of a NaN rotation, while every spot with real data renders automatically.
export function hasBreakAnimationData(spot: Pick<SurfSpot, 'facingDirection'>): boolean {
  return Number.isFinite(spot.facingDirection)
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
// Retuned 2026-08-07 after watching it: the original 0.6x mapping produced a
// 7.4 s loop for a mid-period swell, which in a 360x232 panel is a crest
// crawling at ~21 px/s. It was genuinely animating and read as a still image.
// The RATIO between periods is the informative part and is preserved exactly;
// only the absolute scale is compressed, so a set now reads in a glance.
const PERIOD_TO_SECONDS = 0.2
const MIN_SET_INTERVAL = 1.2 // below this the motion reads as jittery noise, not "long period"
const MAX_SET_INTERVAL = 3.6 // above this a small panel reads as static, not "slow and powerful"

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

// ── Spacing: how many crests are on screen at once ──────────────────────────
// Period reads twice over in the diagram: as cadence, and as spacing. Deep-water
// wavelength grows with the square of period, so a long-period groundswell puts
// far fewer crests in the same stretch of water than short-period windswell.
// Encoding that as crest COUNT means the difference is visible in a still
// frame, before any motion is read — which is also what makes the
// reduced-motion fallback informative rather than merely present.
export const MIN_CRESTS = 2
export const MAX_CRESTS = 5

export function crestCountForPeriod(period: number): number {
  if (!Number.isFinite(period) || period <= 0) return MIN_CRESTS
  return Math.min(MAX_CRESTS, Math.max(MIN_CRESTS, Math.round(30 / period)))
}
