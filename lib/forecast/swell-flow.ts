// ── Pure math for the map's animated swell-flow layer ──────────────────────
//
// Kept separate from components/spots/SpotMap.tsx (which owns the canvas,
// the requestAnimationFrame loop and all DOM/Leaflet wiring) for the same
// reason lib/api/ww3-overview.ts keeps its network layer thin: this is the
// part worth unit-testing with fixtures, and it must never import anything
// that only exists in a browser (canvas, Leaflet, window).
//
// Only a TYPE is imported from lib/api/ww3-overview.ts, never a value — that
// module pulls in `@vercel/functions` at module scope, and a value import
// here would drag it into the client bundle that ships to every visitor.
import type { WaveGridCellTuple } from '@/lib/api/ww3-overview'

/**
 * Native spacing of the stored grid, degrees. Duplicated from
 * `WW3_GRID_DEG * WW3_SPATIAL_STRIDE` on the server rather than imported —
 * see the module comment above — and pinned by a test against those exported
 * constants so the two can never silently drift apart.
 */
export const FLOW_GRID_STEP_DEG = 2

export interface FlowSample {
  /** Swell height, metres — scales trail intensity. */
  heightM: number
  /** Swell period, seconds — scales particle speed. */
  periodS: number
  /**
   * Compass bearing the swell TRAVELS TOWARD (0 = N, clockwise), already
   * flipped from the tuple's stored `dirDeg`.
   *
   * WW3's `sdir` — like `swellDirection` everywhere else in this app (see
   * lib/api/ww3-overview.ts, "stored flow grid") — is the oceanographic
   * convention: the bearing the swell is coming FROM. A visual flow particle
   * has to move the other way, hence `+ 180`.
   */
  headingDeg: number
}

interface FlowPoint extends FlowSample {
  lat: number
  lng: number
}

export type FlowIndex = Map<string, FlowPoint>

function flowKey(latIdx: number, lngIdx: number): string {
  return `${latIdx},${lngIdx}`
}

/** Index a timestep's cell tuples for O(1) lattice lookups by `sampleFlow`. */
export function buildFlowIndex(cells: readonly WaveGridCellTuple[]): FlowIndex {
  const index: FlowIndex = new Map()
  const step = FLOW_GRID_STEP_DEG
  for (const [lat, lng, heightM, periodS, dirDeg] of cells) {
    const headingDeg = (dirDeg + 180) % 360
    index.set(
      flowKey(Math.round(lat / step), Math.round(lng / step)),
      { lat, lng, heightM, periodS, headingDeg }
    )
  }
  return index
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Bilinearly interpolate a flow sample at an arbitrary (lat, lng) from the
 * four lattice cells surrounding it.
 *
 * Direction is interpolated as a unit vector — sin/cos of each corner's
 * heading, averaged, then converted back with `atan2` — never as raw
 * degrees. Averaging degrees directly breaks at any wrap boundary: a point
 * between corners heading 350° and 10° would average to 180°, the exact
 * opposite of both.
 *
 * Returns null when ANY of the four corners has no data. A missing corner is
 * land, an unmodelled cell, or ocean with no swell partition — there is
 * nothing physically meaningful to interpolate through it, so the caller
 * (the particle sim) kills the particle there rather than inventing a flow.
 */
export function sampleFlow(index: FlowIndex, lat: number, lng: number): FlowSample | null {
  const step = FLOW_GRID_STEP_DEG
  const latIdx0 = Math.floor(lat / step)
  const lngIdx0 = Math.floor(lng / step)
  const latIdx1 = latIdx0 + 1
  const lngIdx1 = lngIdx0 + 1

  const p00 = index.get(flowKey(latIdx0, lngIdx0))
  const p01 = index.get(flowKey(latIdx0, lngIdx1))
  const p10 = index.get(flowKey(latIdx1, lngIdx0))
  const p11 = index.get(flowKey(latIdx1, lngIdx1))
  if (!p00 || !p01 || !p10 || !p11) return null

  const tLat = lat / step - latIdx0
  const tLng = lng / step - lngIdx0

  const heightM = lerp(lerp(p00.heightM, p01.heightM, tLng), lerp(p10.heightM, p11.heightM, tLng), tLat)
  const periodS = lerp(lerp(p00.periodS, p01.periodS, tLng), lerp(p10.periodS, p11.periodS, tLng), tLat)

  const rad = Math.PI / 180
  const toUV = (p: FlowPoint): [number, number] => [Math.sin(p.headingDeg * rad), Math.cos(p.headingDeg * rad)]
  const [u00, v00] = toUV(p00)
  const [u01, v01] = toUV(p01)
  const [u10, v10] = toUV(p10)
  const [u11, v11] = toUV(p11)
  const u = lerp(lerp(u00, u01, tLng), lerp(u10, u11, tLng), tLat)
  const v = lerp(lerp(v00, v01, tLng), lerp(v10, v11, tLng), tLat)
  const headingDeg = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360

  return { heightM, periodS, headingDeg }
}

// ── Visual scaling ──────────────────────────────────────────────────────────
//
// These map physical readings onto stylised 0..1 multipliers for the canvas
// renderer. They are deliberately not physically accurate speeds/opacities —
// this is a particle-flow VISUALISATION, and the goal is a curve that reads
// as "bigger/longer-period swell moves faster and glows brighter," clamped so
// an outlier reading (a freak 25 s period, a 6 m storm swell) can't send
// particles streaking off-screen or blow out the trail to solid white.

const MIN_PERIOD_S = 6
const MAX_PERIOD_S = 20

/** 0..1 — longer-period groundswell reads as faster-moving energy than short
 *  wind chop, which is the physically correct direction even though the
 *  on-screen number is a stylised multiplier, not m/s (real group velocity
 *  does scale with period). */
export function speedFactorForPeriod(periodS: number): number {
  const clamped = Math.min(MAX_PERIOD_S, Math.max(MIN_PERIOD_S, periodS))
  return (clamped - MIN_PERIOD_S) / (MAX_PERIOD_S - MIN_PERIOD_S)
}

const MIN_HEIGHT_M = 0.2
const MAX_HEIGHT_M = 4

/** 0..1 — small windswell barely traces the map, a big groundswell reads as
 *  bold and luminous. */
export function intensityFactorForHeight(heightM: number): number {
  const clamped = Math.min(MAX_HEIGHT_M, Math.max(MIN_HEIGHT_M, heightM))
  return (clamped - MIN_HEIGHT_M) / (MAX_HEIGHT_M - MIN_HEIGHT_M)
}

// ── Particle budget ──────────────────────────────────────────────────────────

const PARTICLES_PER_MILLION_DEVICE_PX = 90
const MIN_PARTICLES = 40
const MAX_PARTICLES = 900
// A 3x-DPR phone has 9x the device pixels of the same CSS viewport at 1x for
// no visible benefit at this trail's line width — capping the multiplier
// before squaring it is what keeps a high-DPR phone from tripling the
// particle count (and the per-frame cost) over a 1x display of the same size.
const MAX_EFFECTIVE_DPR = 2

/**
 * Particle count for a canvas of the given CSS size, DPR-aware, so a phone
 * and a wide desktop monitor both stay "buttery" rather than sharing one
 * fixed count that is either sparse on the desktop or laggy on the phone.
 */
export function particleCountForViewport(widthCss: number, heightCss: number, dpr: number): number {
  if (widthCss <= 0 || heightCss <= 0) return MIN_PARTICLES
  const effectiveDpr = Math.min(Math.max(dpr, 1), MAX_EFFECTIVE_DPR)
  const devicePixels = widthCss * heightCss * effectiveDpr * effectiveDpr
  const raw = Math.round((devicePixels / 1_000_000) * PARTICLES_PER_MILLION_DEVICE_PX)
  return Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, raw))
}

// ── Web Mercator pixel scale ─────────────────────────────────────────────────

/**
 * Metres per CSS pixel at a given latitude and Leaflet zoom, under the Web
 * Mercator projection Leaflet's default CRS uses. Standard formula (the same
 * one behind every "meters per pixel" tile-math reference); 256 is the tile
 * size Leaflet assumes at zoom 0. Used to convert a stylised on-screen
 * particle speed into a lat/lng step that stays visually constant across
 * zoom levels rather than crawling at low zoom and streaking at high zoom.
 */
export function metersPerPixel(lat: number, zoom: number): number {
  const EARTH_CIRCUMFERENCE_M = 40_075_016.686
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (256 * Math.pow(2, zoom))
}
