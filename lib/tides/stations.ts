import STATION_DATA from './data/harmonic-stations.json'

/**
 * The build-time harmonic station table (scripts/map-harmonic-stations.ts).
 *
 * Split out from lib/api/harmonic-tides.ts so that looking up *which* station a
 * spot uses does not drag @neaps/tide-predictor into every module that touches
 * a spot record — static-store only needs the mapping, not the tide engine.
 */

export interface HarmonicStation {
  id: string
  name: string
  latitude: number
  longitude: number
  timezone: string
  type: 'reference' | 'subordinate'
  chart_datum?: string
  datums: Record<string, number>
  harmonic_constituents: { name: string; amplitude: number; phase: number }[]
}

export const HARMONIC_STATIONS = STATION_DATA.stations as unknown as Record<string, HarmonicStation>

const SPOT_STATIONS = STATION_DATA.spots as unknown as Record<string, { stationId: string; km: number }>

/**
 * True when the generated table was produced with the estuary guard active.
 *
 * A distance-only table is not safe to serve: ~9% of nearest-by-distance
 * matches are a gauge inside a bay, estuary or river with a different tidal
 * regime from the open-coast break, and Bells Beach's nearest gauge correlates
 * at r = -0.28 — an inverted tide, scored as real. See the script header.
 */
export const HARMONIC_GUARD_RAN = STATION_DATA.guard != null

/** The station assigned to a spot at build time, or null if none survived. */
export function harmonicStationForSpot(slug: string): string | null {
  if (!HARMONIC_GUARD_RAN) return null
  return SPOT_STATIONS[slug]?.stationId ?? null
}

/** Distance in km from the spot to its assigned station — for provenance UI. */
export function harmonicStationDistanceKm(slug: string): number | null {
  return SPOT_STATIONS[slug]?.km ?? null
}
