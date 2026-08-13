/**
 * Re-derive every spot's NOAA tide station from its coordinates.
 *
 * The hand-authored mapping had drifted badly: 14 Oahu spots pulled tides from
 * Midway Atoll 2,081 km away, Alaskan spots from Anchorage, Gulf Coast spots
 * from Tampa, and one spot (yakutat-surf-ak) referenced station 9453380, which
 * does not exist — CO-OPS answers with an empty prediction list forever, so it
 * fails silently. Median spot→station distance was 44 km.
 *
 * A tide station is a pure function of position, so it should not be authored
 * by hand at all. This assigns the nearest CO-OPS tide-prediction station
 * within MAX_STATION_KM and null beyond it. Null is safe: the rating weights
 * renormalise over the factors present, so a spot with no station is not
 * penalised — whereas a station 500 km away is scored as though it were real.
 *
 *   npx tsx scripts/map-tide-stations.ts              # dry run, prints the diff
 *   npx tsx scripts/map-tide-stations.ts --write      # rewrite the seed files
 *   npx tsx scripts/map-tide-stations.ts --refresh    # re-fetch the station list first
 *   npx tsx scripts/map-tide-stations.ts --verify     # probe every station live
 *
 * The station snapshot lives in scripts/data/noaa-tide-stations.json so both
 * this script and tests/spots-seed.test.ts read the same list without a network
 * call. Re-run with --refresh when NOAA adds or retires stations.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SURF_SPOTS_SEED } from '../lib/spots-data'
import { distanceKm } from '../lib/forecast/nearest-fallback'

// Beyond this the station is describing a different body of water. NOAA's own
// harmonic predictions are only meaningful near the station; the audit found
// 5.3% of mapped spots pulling from >500 km away.
export const MAX_STATION_KM = 75

const STATIONS_PATH = join(__dirname, 'data', 'noaa-tide-stations.json')
const STATIONS_URL =
  'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions'

export interface TideStation {
  id: string
  name: string
  lat: number
  lng: number
  state: string | null
  /** 'R' = reference/harmonic, 'S' = subordinate. */
  type: string | null
}

/**
 * Only reference (harmonic) stations can answer the hourly, MLLW-datum query
 * `fetchTidePredictions` sends. Subordinate stations are two thirds of the
 * published list and are the trap this whole script exists to avoid: they
 * resolve, they are often the closest thing to a spot, and they return
 * `{"error":"No Predictions data was found"}` — which the fetch turns into an
 * empty array, silently and permanently. Verified against the live API: 1612668
 * Haleiwa (type S, 9 km from Pipeline) returns nothing; 1612340 Honolulu
 * (type R, 30 km) returns 72 hourly points.
 */
export function supportsHourlyPredictions(station: TideStation): boolean {
  return station.type === 'R'
}

const SEED_FILES = [
  'lib/spots-data.ts',
  'lib/spots/asia-indian-ocean.ts',
  'lib/spots/australia-nz.ts',
  'lib/spots/east-coast.ts',
  'lib/spots/europe-atlantic.ts',
  'lib/spots/europe-med-africa.ts',
  'lib/spots/hawaii-gulf-lakes-carib.ts',
  'lib/spots/mexico-central-america.ts',
  'lib/spots/pacific-islands.ts',
  'lib/spots/pnw-alaska.ts',
  'lib/spots/south-america.ts',
]

export function loadStations(): TideStation[] {
  return JSON.parse(readFileSync(STATIONS_PATH, 'utf8')).stations as TideStation[]
}

export function nearestStation(
  lat: number,
  lng: number,
  stations: TideStation[]
): { station: TideStation; km: number } | null {
  let best: TideStation | null = null
  let bestKm = Infinity
  for (const s of stations) {
    if (!supportsHourlyPredictions(s)) continue
    const km = distanceKm(lat, lng, s.lat, s.lng)
    if (km < bestKm) { bestKm = km; best = s }
  }
  return best && bestKm <= MAX_STATION_KM ? { station: best, km: bestKm } : null
}

async function refresh(): Promise<void> {
  const res = await fetch(STATIONS_URL, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`CO-OPS metadata API: ${res.status}`)
  const raw = await res.json() as {
    stations: Array<{ id: string | number; name: string; lat: number; lng: number; state?: string; type?: string }>
  }
  const seen = new Set<string>()
  const stations = raw.stations
    .map((s) => ({
      id: String(s.id), name: s.name, lat: Number(s.lat), lng: Number(s.lng),
      state: s.state ?? null, type: s.type ?? null,
    }))
    .filter((s) => s.id && isFinite(s.lat) && isFinite(s.lng))
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => a.id.localeCompare(b.id))
  writeFileSync(STATIONS_PATH, JSON.stringify({
    source: STATIONS_URL,
    fetchedAt: new Date().toISOString().slice(0, 10),
    note: 'type R = reference/harmonic (supports interval=h predictions); type S = subordinate (high/low only)',
    count: stations.length,
    harmonicCount: stations.filter((s) => s.type === 'R').length,
    stations,
  }) + '\n')
  console.log(`refreshed ${stations.length} stations (${stations.filter((s) => s.type === 'R').length} harmonic)`)
}

/**
 * Rewrite `noaaTideStationId:` in place, keyed by the `slug:` line above it.
 *
 * Every spot object in every seed file carries exactly one `slug:` and one
 * `noaaTideStationId:` line, in that order — asserted below rather than
 * assumed, because a silent mismatch would write a station onto the wrong spot.
 */
function rewriteFile(path: string, assignments: Map<string, string | null>): number {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  let slug: string | null = null
  let changed = 0

  for (let i = 0; i < lines.length; i++) {
    const slugMatch = /^(\s*)slug: '([^']+)',\s*$/.exec(lines[i])
    if (slugMatch) { slug = slugMatch[2]; continue }
    const stationMatch = /^(\s*)noaaTideStationId: (.+),\s*$/.exec(lines[i])
    if (!stationMatch) continue
    if (!slug) throw new Error(`${path}:${i + 1} noaaTideStationId with no preceding slug`)
    if (!assignments.has(slug)) { slug = null; continue }

    const next = assignments.get(slug)!
    const replacement = `${stationMatch[1]}noaaTideStationId: ${next === null ? 'null' : `'${next}'`},`
    if (lines[i] !== replacement) { lines[i] = replacement; changed++ }
    slug = null
  }
  writeFileSync(path, lines.join('\n'))
  return changed
}

const DATAGETTER = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

/**
 * Ask CO-OPS for the exact query `fetchTidePredictions` sends. "Station exists
 * in the published list" is not the same as "station answers this query" —
 * that gap is what left yakutat-surf-ak with an empty tide chart indefinitely,
 * and what a nearest-station rule would have recreated at scale by picking
 * subordinate stations.
 */
async function probeStation(id: string): Promise<{ ok: boolean; detail: string }> {
  const params = new URLSearchParams({
    begin_date: '20260806', end_date: '20260808', station: id,
    product: 'predictions', datum: 'MLLW', time_zone: 'lst_ldt',
    interval: 'h', units: 'metric', application: 'surf_forecast_app', format: 'json',
  })
  try {
    const res = await fetch(`${DATAGETTER}?${params}`, { signal: AbortSignal.timeout(25_000) })
    if (!res.ok) return { ok: false, detail: `http ${res.status}` }
    const json = await res.json() as { predictions?: Array<{ v: string }>; error?: { message: string } }
    if (json.error) return { ok: false, detail: json.error.message.slice(0, 70) }
    if (!json.predictions?.length) return { ok: false, detail: 'empty predictions' }
    const heights = json.predictions.map((p) => parseFloat(p.v)).filter((n) => isFinite(n))
    const range = Math.max(...heights) - Math.min(...heights)
    return { ok: true, detail: `${heights.length} points, ${range.toFixed(2)} m range` }
  } catch (err) {
    return { ok: false, detail: String(err).slice(0, 70) }
  }
}

async function verify(assignments: Map<string, string | null>, byId: Map<string, TideStation>) {
  const ids = [...new Set([...assignments.values()].filter((v): v is string => v !== null))]
  console.log(`\nprobing ${ids.length} distinct stations against the live CO-OPS API…`)
  const results: Array<{ id: string; ok: boolean; detail: string }> = []
  for (let i = 0; i < ids.length; i += 12) {
    const batch = await Promise.all(ids.slice(i, i + 12).map(async (id) => ({ id, ...await probeStation(id) })))
    results.push(...batch)
  }
  const failing = results.filter((r) => !r.ok)
  console.log(`  ${results.length - failing.length} answer hourly MLLW predictions · ${failing.length} do not`)
  for (const f of failing) {
    console.log(`    ${f.id.padEnd(12)} ${byId.get(f.id)?.name ?? '?'} → ${f.detail}`)
  }
  if (failing.length) process.exitCode = 1
}

async function main() {
  const write = process.argv.includes('--write')
  if (process.argv.includes('--refresh')) await refresh()

  const stations = loadStations()
  const byId = new Map(stations.map((s) => [s.id, s]))
  const spots = SURF_SPOTS_SEED as unknown as Array<{
    slug: string; name: string; lat: number; lng: number; noaaTideStationId?: string | null
  }>

  const assignments = new Map<string, string | null>()
  const rows: Array<{ slug: string; from: string | null; to: string | null; fromKm: number | null; toKm: number | null; name: string }> = []

  for (const spot of spots) {
    const found = nearestStation(spot.lat, spot.lng, stations)
    const to = found?.station.id ?? null
    assignments.set(spot.slug, to)

    const from = spot.noaaTideStationId ?? null
    if (from === to) continue
    const fromStation = from ? byId.get(from) : undefined
    rows.push({
      slug: spot.slug,
      from,
      to,
      fromKm: fromStation ? distanceKm(spot.lat, spot.lng, fromStation.lat, fromStation.lng) : null,
      toKm: found?.km ?? null,
      name: found?.station.name ?? '',
    })
  }

  const gained = rows.filter((r) => r.from === null).length
  const dropped = rows.filter((r) => r.to === null).length
  const moved = rows.filter((r) => r.from !== null && r.to !== null).length
  const unknownBefore = rows.filter((r) => r.from !== null && r.fromKm === null).length

  console.log(`${spots.length} spots · ${rows.length} changes`)
  console.log(`  ${moved} remapped · ${gained} gained a station · ${dropped} dropped to null`)
  console.log(`  ${unknownBefore} were pointing at a station id CO-OPS does not publish`)
  const far = rows.filter((r) => r.fromKm != null && r.fromKm > 200).sort((a, b) => b.fromKm! - a.fromKm!)
  console.log(`  ${far.length} were further than 200 km from their station; worst:`)
  for (const r of far.slice(0, 10)) {
    console.log(`    ${r.slug.padEnd(30)} ${r.fromKm!.toFixed(0).padStart(5)} km → ${r.toKm!.toFixed(1)} km (${r.to} ${r.name})`)
  }

  if (process.argv.includes('--verify')) await verify(assignments, byId)

  if (!write) {
    console.log('\ndry run — pass --write to apply')
    return
  }
  let total = 0
  for (const file of SEED_FILES) total += rewriteFile(file, assignments)
  console.log(`\nrewrote ${total} lines across ${SEED_FILES.length} files`)
}

main().catch((err) => { console.error(err); process.exit(1) })
