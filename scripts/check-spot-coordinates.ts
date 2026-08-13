/**
 * Ask Open-Meteo whether every spot's coordinates are actually in the water.
 *
 * A spot whose lat/lng lands on a land cell gets null wave heights forever: the
 * map shows it permanently flat (or grey), and the spot page has nothing to
 * rate. The accuracy audit found three live examples by hand
 * (nexpa-michoacan, plage-blanche-morocco, punta-roquitas-lima); this finds all
 * of them, and re-finds them whenever a spot is added or moved.
 *
 * It also reports how far the nearest water cell is, which is the concrete
 * version of "this coordinate is only accurate to 1 decimal place": a coarse
 * coordinate that still resolves to water is survivable, one that does not is
 * a broken spot.
 *
 *   npx tsx scripts/check-spot-coordinates.ts
 *   npx tsx scripts/check-spot-coordinates.ts --suggest        # probe a ring for water
 *   npx tsx scripts/check-spot-coordinates.ts --only=a,b       # just these slugs
 *
 * Requires network access to marine-api.open-meteo.com. Use --only when
 * re-checking a handful of spots: a full sweep costs ~1,500 of the free tier's
 * hourly call budget.
 */
import { SURF_SPOTS_SEED } from '../lib/spots-data'
import { distanceKm } from '../lib/forecast/nearest-fallback'

const MARINE = 'https://marine-api.open-meteo.com/v1/marine'
const CHUNK = 50

// Open-Meteo bills a multi-location request as one call PER LOCATION, so the
// full dataset is ~1,500 calls against a ~600/minute free-tier budget. Pace to
// roughly 400 locations a minute; the whole sweep then takes ~4 minutes and
// never trips the limiter (which answers 200 with an error body, i.e. it looks
// exactly like a land cell if you don't check).
const PACE_MS = Math.ceil((CHUNK / 400) * 60_000)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Spots whose coordinates are right but which Open-Meteo's marine model simply
// does not cover. Verified by probing outward: no water cell exists within
// ~11 km of Duluth in any direction, while Marquette, Pictured Rocks and Grand
// Marais — further east on the same lake — all resolve. Western Lake Superior
// is an upstream coverage gap, not a bad coordinate, so it is reported
// separately instead of looking like something to fix.
const NO_UPSTREAM_COVERAGE = new Set(['duluth-canal-park-mn'])

interface Probe { lat: number; lng: number }

/** True when Open-Meteo has a marine grid cell here (i.e. it is water). */
async function probeChunk(points: Probe[]): Promise<(boolean | null)[]> {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(','),
    longitude: points.map((p) => p.lng.toFixed(4)).join(','),
    hourly: 'wave_height',
    forecast_days: '1',
  })
  try {
    const res = await fetch(`${MARINE}?${params}`, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return points.map(() => null)
    const json = JSON.parse(await res.text()) as unknown
    // The rate limiter answers 200 with {"error":true,...}. Treating that as a
    // response would mark every spot in the chunk as a land cell.
    if (json && !Array.isArray(json) && (json as { error?: boolean }).error) {
      return points.map(() => null)
    }
    const list = Array.isArray(json) ? json : [json]
    if (list.length !== points.length) return points.map(() => null)
    return list.map((entry) => {
      const heights = (entry as { hourly?: { wave_height?: (number | null)[] } })?.hourly?.wave_height
      return Array.isArray(heights) ? heights.some((h) => h != null) : null
    })
  } catch {
    return points.map(() => null)
  }
}

async function probeAll(points: Probe[]): Promise<(boolean | null)[]> {
  const out: (boolean | null)[] = []
  for (let i = 0; i < points.length; i += CHUNK) {
    if (i > 0) await sleep(PACE_MS)
    out.push(...await probeChunk(points.slice(i, i + CHUNK)))
    process.stdout.write(`\r  probed ${Math.min(i + CHUNK, points.length)}/${points.length}`)
  }
  console.log()
  return out
}

/** Candidate offsets on expanding rings, nearest first (~1.1 km per 0.01°). */
function ring(lat: number, lng: number): Probe[] {
  const out: Probe[] = []
  for (const r of [0.01, 0.02, 0.03, 0.05, 0.08]) {
    for (let bearing = 0; bearing < 360; bearing += 45) {
      const rad = (bearing * Math.PI) / 180
      out.push({
        lat: Number((lat + r * Math.cos(rad)).toFixed(4)),
        lng: Number((lng + (r * Math.sin(rad)) / Math.cos((lat * Math.PI) / 180)).toFixed(4)),
      })
    }
  }
  return out
}

async function main() {
  const all = SURF_SPOTS_SEED as unknown as Array<{ slug: string; name: string; country: string; lat: number; lng: number }>
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim())) : null
  const spots = only ? all.filter((s) => only.has(s.slug)) : all
  if (only) {
    for (const slug of only) {
      if (!spots.some((s) => s.slug === slug)) console.log(`  (no such spot: ${slug})`)
    }
  }
  console.log(`probing ${spots.length} spots against the Open-Meteo marine grid…`)
  const results = await probeAll(spots.map((s) => ({ lat: s.lat, lng: s.lng })))

  const allDry = spots.filter((_, i) => results[i] === false)
  const dry = allDry.filter((s) => !NO_UPSTREAM_COVERAGE.has(s.slug))
  const uncovered = allDry.filter((s) => NO_UPSTREAM_COVERAGE.has(s.slug))
  const unknown = spots.filter((_, i) => results[i] === null)
  console.log(`\n${spots.length - allDry.length - unknown.length} resolve to water · ${dry.length} land/invalid cells · ${uncovered.length} known upstream gaps · ${unknown.length} inconclusive`)

  if (dry.length) {
    console.log('\nLAND OR INVALID CELLS — these render permanently flat:')
    for (const s of dry) console.log(`  ${s.slug.padEnd(30)} ${s.country.padEnd(18)} ${s.lat},${s.lng}`)
    process.exitCode = 1
  }
  if (uncovered.length) {
    console.log('\nKNOWN UPSTREAM GAPS (coordinates correct, no marine model here):')
    for (const s of uncovered) console.log(`  ${s.slug.padEnd(30)} ${s.country.padEnd(18)} ${s.lat},${s.lng}`)
  }
  if (unknown.length) {
    console.log('\nINCONCLUSIVE (upstream error, retry):')
    for (const s of unknown) console.log(`  ${s.slug.padEnd(30)} ${s.lat},${s.lng}`)
  }

  if (!process.argv.includes('--suggest') || !dry.length) return

  console.log('\nnearest water cell for each land spot:')
  for (const s of dry) {
    const candidates = ring(s.lat, s.lng)
    const found = await probeAll(candidates)
    const hit = candidates.find((_, i) => found[i] === true)
    if (!hit) { console.log(`  ${s.slug.padEnd(30)} no water within ~9 km — needs a real coordinate`); continue }
    console.log(`  ${s.slug.padEnd(30)} ${s.lat},${s.lng} → ${hit.lat},${hit.lng}  (${distanceKm(s.lat, s.lng, hit.lat, hit.lng).toFixed(1)} km)`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
