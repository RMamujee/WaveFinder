import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SURF_SPOTS_SEED } from '@/lib/spots-data'
import { SPOT_SLUG_ALIASES } from '@/lib/spots/spot-aliases'
import { distanceKm } from '@/lib/forecast/nearest-fallback'
import { angleDiff } from '@/lib/forecast/rating'
import { BOTTOM_TYPES } from '@/lib/bottom-type'

// The spot dataset is hand-authored and the rating engine multiplies against
// it, so a bad value here is worth more than most code defects: the accuracy
// audit measured facingDirection errors at up to ~60 score points. These are
// the invariants that would have caught what Phase 2 fixed.

interface Seed {
  slug: string
  name: string
  region: string
  country: string
  lat: number
  lng: number
  difficulty: string
  facingDirection: number
  bottomType: string
  noaaTideStationId?: string | null
  noaaBuoyId?: string | null
}
const SPOTS = SURF_SPOTS_SEED as unknown as Seed[]

interface Station { id: string; name: string; lat: number; lng: number; type: string | null }
const STATIONS: Station[] = JSON.parse(
  readFileSync(new URL('../scripts/data/noaa-tide-stations.json', import.meta.url), 'utf8')
).stations
const STATION_BY_ID = new Map(STATIONS.map((s) => [s.id, s]))

// Mirrors MAX_STATION_KM in scripts/map-tide-stations.ts. Duplicated rather
// than imported so the assertion still holds if someone loosens the script.
const MAX_STATION_KM = 75

describe('spot seed — identity', () => {
  it('has no duplicate slugs', () => {
    const seen = new Map<string, number>()
    for (const s of SPOTS) seen.set(s.slug, (seen.get(s.slug) ?? 0) + 1)
    expect([...seen].filter(([, n]) => n > 1)).toEqual([])
  })

  it('has no two spots at identical coordinates', () => {
    // Four pairs shipped as byte-identical records at the same lat/lng, so the
    // map drew two markers on one peak.
    const byCoord = new Map<string, string[]>()
    for (const s of SPOTS) {
      const key = `${s.lat},${s.lng}`
      const bucket = byCoord.get(key)
      if (bucket) bucket.push(s.slug)
      else byCoord.set(key, [s.slug])
    }
    expect([...byCoord.values()].filter((g) => g.length > 1)).toEqual([])
  })

  it('retires each aliased slug and keeps every alias target', () => {
    const live = new Set(SPOTS.map((s) => s.slug))
    for (const [retired, target] of Object.entries(SPOT_SLUG_ALIASES)) {
      expect(live.has(retired), `${retired} is aliased but still in the seed`).toBe(false)
      expect(live.has(target), `${retired} points at missing ${target}`).toBe(true)
    }
  })

  // Coordinates authored to 1 decimal (~11 km) or 0 (~111 km) — coarser than
  // the ~0.04° marine grid they are scored against. Every one of these still
  // resolves to a water cell (scripts/check-spot-coordinates.ts), so they are
  // imprecise rather than broken, and fixing them needs a real position per
  // spot rather than a scripted pass. The list is frozen here so the debt is
  // visible and cannot grow.
  const COARSE_COORDINATE_BACKLOG = new Set([
    'legzira-morocco', 'plage-blanche-morocco', 'el-tunco-el-salvador',
    'playa-escobilla-oaxaca', 'crucita-ecuador', 'el-almejal-colombia',
    'sigatoka-beach-fiji', 'lances-right-mentawai', 'bank-vaults-mentawai',
    'nias-sorake-bay', 'periscopes-sumbawa', 'pacifico-siargao',
    'hollow-trees-hts', 'kamogawa-chiba', 'murudeshwar-karnataka',
    'trois-bassins-reunion', 'salalah-beach-oman', 'masirah-island-oman',
    'lohis-maldives', 'kandooma-rights-maldives', 'nusa-dua-bali',
  ])

  it('adds no new spot coarser than 2 decimal places', () => {
    const decimals = (n: number) => (String(n).split('.')[1] ?? '').length
    const coarse = SPOTS
      .filter((s) => Math.min(decimals(s.lat), decimals(s.lng)) < 2)
      .filter((s) => !COARSE_COORDINATE_BACKLOG.has(s.slug))
      .map((s) => `${s.slug} (${s.lat},${s.lng})`)
    expect(coarse).toEqual([])
  })

  it('keeps the coarse-coordinate backlog honest', () => {
    // A backlog entry that has been fixed (or removed) must leave the list,
    // otherwise the guard above silently stops covering that slug.
    const decimals = (n: number) => (String(n).split('.')[1] ?? '').length
    const stillCoarse = new Set(
      SPOTS.filter((s) => Math.min(decimals(s.lat), decimals(s.lng)) < 2).map((s) => s.slug)
    )
    expect([...COARSE_COORDINATE_BACKLOG].filter((slug) => !stillCoarse.has(slug))).toEqual([])
  })
})

describe('spot seed — rating inputs', () => {
  it('uses only known difficulty values', () => {
    // 'expert' used to be silently coerced to 'intermediate', which made
    // Nazaré, Mullaghmore and Dungeons filterable as intermediate — a
    // safety-relevant label, not a cosmetic one.
    const allowed = new Set(['beginner', 'intermediate', 'advanced', 'expert'])
    expect([...new Set(SPOTS.map((s) => s.difficulty))].filter((d) => !allowed.has(d))).toEqual([])
  })

  it('stores a valid bottom type on every spot', () => {
    const valid = new Set<string>(BOTTOM_TYPES)
    const bad = SPOTS.filter((s) => !valid.has(s.bottomType)).map((s) => `${s.slug}=${s.bottomType}`)
    expect(bad).toEqual([])
  })

  it('keeps facingDirection a bearing', () => {
    const bad = SPOTS
      .filter((s) => !Number.isFinite(s.facingDirection) || s.facingDirection < 0 || s.facingDirection >= 360)
      .map((s) => `${s.slug}=${s.facingDirection}`)
    expect(bad).toEqual([])
  })

  it('does not let two spots 500 m apart disagree on facing by more than 45°', () => {
    // Backdoor was stored 50° from Pipeline while breaking off the same peak
    // 56 m away — worth 17 points on a standard NW swell. Two breaks that
    // close share a swell window whatever their names.
    const conflicts: string[] = []
    for (let i = 0; i < SPOTS.length; i++) {
      for (let j = i + 1; j < SPOTS.length; j++) {
        if (Math.abs(SPOTS[i].lat - SPOTS[j].lat) > 0.02) continue
        const km = distanceKm(SPOTS[i].lat, SPOTS[i].lng, SPOTS[j].lat, SPOTS[j].lng)
        if (km > 0.5) continue
        const delta = angleDiff(SPOTS[i].facingDirection, SPOTS[j].facingDirection)
        if (delta > 45) {
          conflicts.push(`${SPOTS[i].slug}(${SPOTS[i].facingDirection}) vs ${SPOTS[j].slug}(${SPOTS[j].facingDirection}) — ${(km * 1000).toFixed(0)} m apart, ${delta}° apart`)
        }
      }
    }
    expect(conflicts).toEqual([])
  })
})

describe('spot seed — Postgres compatibility', () => {
  // prisma/seed.ts spreads each seed record into `surfSpot.upsert`. A field the
  // table has no column for throws "Unknown argument" at runtime, and
  // TypeScript does NOT catch it: excess-property checking applies to object
  // literals passed directly to a typed parameter, not to a variable. Adding
  // `bottomType` broke `npm run db:seed` in exactly this way.
  const SEED_ONLY_FIELDS = new Set(['bottomType'])

  function surfSpotColumns(): Set<string> {
    const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
    const model = /model SurfSpot \{([\s\S]*?)\n\}/.exec(schema)
    if (!model) throw new Error('SurfSpot model not found in schema.prisma')
    const columns = new Set<string>()
    for (const line of model[1].split('\n')) {
      const field = /^\s*(\w+)\s+\w/.exec(line)
      if (field) columns.add(field[1])
    }
    return columns
  }

  it('carries no field that is neither a SurfSpot column nor a declared seed-only field', () => {
    const columns = surfSpotColumns()
    expect(columns.size).toBeGreaterThan(5)   // guard against a parse regression
    const unknown = new Set<string>()
    for (const spot of SPOTS as unknown as Array<Record<string, unknown>>) {
      for (const key of Object.keys(spot)) {
        if (!columns.has(key) && !SEED_ONLY_FIELDS.has(key)) unknown.add(key)
      }
    }
    expect([...unknown]).toEqual([])
  })

  it('keeps the seed-only list minimal', () => {
    // A field listed as seed-only that IS a column would be silently dropped
    // from Postgres by prisma/seed.ts.
    const columns = surfSpotColumns()
    expect([...SEED_ONLY_FIELDS].filter((f) => columns.has(f))).toEqual([])
  })
})

describe('spot seed — NOAA references', () => {
  it('references only tide stations NOAA actually publishes', () => {
    // yakutat-surf-ak pointed at 9453380, which does not exist. CO-OPS answers
    // with an empty prediction list rather than an error, so the tide chart was
    // simply blank forever with nothing to notice.
    const unknown = SPOTS
      .filter((s) => s.noaaTideStationId && !STATION_BY_ID.has(s.noaaTideStationId))
      .map((s) => `${s.slug} → ${s.noaaTideStationId}`)
    expect(unknown).toEqual([])
  })

  it('references only reference (harmonic) stations', () => {
    // Subordinate stations are two thirds of the published list and are often
    // the closest one to a spot, but they cannot answer the hourly MLLW query
    // fetchTidePredictions sends — they fail exactly like a missing station.
    const subordinate = SPOTS
      .filter((s) => s.noaaTideStationId)
      .map((s) => ({ s, station: STATION_BY_ID.get(s.noaaTideStationId!) }))
      .filter((x) => x.station && x.station.type !== 'R')
      .map((x) => `${x.s.slug} → ${x.station!.id} ${x.station!.name} (type ${x.station!.type})`)
    expect(subordinate).toEqual([])
  })

  it('keeps every spot within 75 km of its tide station', () => {
    // 14 Oahu spots pulled tides from Midway Atoll, 2,081 km away; Alaskan
    // spots from Anchorage; Gulf Coast spots from Tampa. A station that far off
    // is not describing the same water, and the tide factor scored it as real.
    const far = SPOTS
      .filter((s) => s.noaaTideStationId)
      .map((s) => {
        const st = STATION_BY_ID.get(s.noaaTideStationId!)!
        return { slug: s.slug, km: distanceKm(s.lat, s.lng, st.lat, st.lng) }
      })
      .filter((x) => x.km > MAX_STATION_KM)
      .map((x) => `${x.slug} — ${x.km.toFixed(0)} km`)
    expect(far).toEqual([])
  })

  it('assigns the nearest usable station, not merely a nearby one', () => {
    // The mapping is scripted (scripts/map-tide-stations.ts). This fails if
    // someone hand-edits a station back to a worse one.
    const harmonic = STATIONS.filter((s) => s.type === 'R')
    const suboptimal: string[] = []
    for (const spot of SPOTS) {
      let best: Station | null = null
      let bestKm = Infinity
      for (const st of harmonic) {
        const km = distanceKm(spot.lat, spot.lng, st.lat, st.lng)
        if (km < bestKm) { bestKm = km; best = st }
      }
      const expected = best && bestKm <= MAX_STATION_KM ? best.id : null
      const actual = spot.noaaTideStationId ?? null
      if (actual !== expected) suboptimal.push(`${spot.slug}: ${actual} (expected ${expected})`)
    }
    expect(suboptimal).toEqual([])
  })

  it('references only plausibly-shaped NDBC buoy ids', () => {
    // fetchBuoyData rejects anything else outright, so a malformed id is a
    // permanently missing buoy panel.
    const bad = SPOTS
      .filter((s) => s.noaaBuoyId && !/^\d{4,5}$/.test(s.noaaBuoyId))
      .map((s) => `${s.slug} → ${s.noaaBuoyId}`)
    expect(bad).toEqual([])
  })
})
