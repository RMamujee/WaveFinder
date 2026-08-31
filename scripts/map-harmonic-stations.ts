/**
 * Assign every spot a harmonic tide station from @neaps/tide-database.
 *
 * Why this exists: 887 of 1,482 spots (59.9%) have no NOAA CO-OPS station,
 * because CO-OPS is US-only. Those spots render no tide chart at all and the
 * rating engine renormalises the tide factor away — so Portugal, Indonesia,
 * Australia and the rest have been getting a forecast with a whole factor
 * missing. `@neaps/tide-database` ships 6,115 stations across 126 countries as
 * harmonic constituents, which `@neaps/tide-predictor` turns into an hourly
 * series in-process with ZERO network calls.
 *
 *   npx tsx scripts/map-harmonic-stations.ts            # dry run + estuary guard
 *   npx tsx scripts/map-harmonic-stations.ts --write    # guard, then write the JSON
 *   npx tsx scripts/map-harmonic-stations.ts --skip-guard   # distance only (UNSAFE, debug)
 *
 * The 58 MB @neaps/tide-database is a devDependency and MUST NEVER be imported
 * by app code — exactly like scripts/data/noaa-tide-stations.json today. Only
 * the generated JSON and @neaps/tide-predictor (MIT, zero deps, 217 KB) are
 * importable at runtime.
 *
 * THE ESTUARY GUARD IS THE POINT OF THIS SCRIPT.
 * Nearest-by-distance is wrong for ~9% of assignments, and wrong in a way that
 * looks perfectly reasonable: the closest gauge sits inside a bay, estuary,
 * river or lagoon whose tidal regime has nothing to do with the open-coast
 * break. Bells Beach matches a gauge 26 km away inside Port Phillip Bay and
 * correlates at r = -0.28 — an inverted tide. So every assignment is
 * cross-checked against Open-Meteo's `sea_level_height_msl`, which is an
 * independent field (a Copernicus ocean model, not a tide gauge) and therefore
 * actually capable of catching a gauge in the wrong body of water.
 *
 * Both halves of the test are required. radhanagar-havelock-andaman correlates
 * at r = 0.96 — perfect phase — while carrying 42% of the real amplitude. A
 * phase-only check passes it and the spot then scores every reef tide as too
 * shallow, forever, silently.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { near, type Station } from '@neaps/tide-database'
import { SURF_SPOTS_SEED } from '../lib/spots-data'
import { distanceKm } from '../lib/forecast/nearest-fallback'

// Beyond 100 km a gauge is describing different water. The research measured
// coverage at 50/75/100/150 km: 100 km buys +6.0 pp over the repo's existing
// 75 km NOAA threshold and +17.9 pp over 50 km, while 150 km adds only 7 pp
// for a doubling of distance error. The estuary guard, not this number, is
// what actually keeps bad assignments out.
export const MAX_HARMONIC_KM = 100

// Pearson r between the harmonic series and Open-Meteo's independent field.
// The 209 passing pairs in the research had median r = 0.955; every one of the
// 21 failures fell below 0.8 with a clear physical explanation.
export const MIN_CORRELATION = 0.8
// Ratio of harmonic tidal range to Open-Meteo's. Catches the phase-correct,
// amplitude-wrong case that correlation alone cannot see.
export const MIN_AMP_RATIO = 0.6
export const MAX_AMP_RATIO = 1.6
// RMSE ceiling against CO-OPS ground truth, metres. Phase and amplitude both
// pass under a pure datum shift, so this is the only test that catches a station
// whose ladder is referenced to different ground — the Santa Margarita river
// gauge sat 0.805 m out at r = 0.99 and amp = 1.00.
//
// Set from what scoreTide can absorb rather than from the observed spread. The
// tide factor carries weight 0.10 and a reef tolerance of 0.7 m, and the score
// falls as (bias/tolerance)² × 55 — so 0.35 m costs ~1.4 points of final score
// (noise) while 0.8 m costs ~7 and can move a spot a whole rating band. At
// 0.25 m this rejected Morro Bay and Monterey at r = 1.00, amp = 1.00 and
// rmse ≈ 0.28: real geographic variation between two valid gauges 30 km apart,
// not a datum error.
export const MAX_NOAA_RMSE_M = 0.35

// @neaps/tide-predictor is ESM-only and publishes no `require` condition, so a
// static import fails under tsx (this repo transpiles scripts to CJS). Loaded
// once in main() via dynamic import, which Node resolves natively. App code has
// no such problem — Next.js consumes the ESM build directly.
type UseStation = (station: never) => {
  getTimelinePrediction: (opts: {
    start: Date; end: Date; timeFidelity: number; datum: string
  }) => { timeline: { time: Date; level: number }[] }
}
let createStationPredictor: UseStation

const OUT_PATH = join(__dirname, '..', 'lib', 'tides', 'data', 'harmonic-stations.json')
const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const NOAA_TIDES_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

/**
 * A station is usable only if it can answer the exact query the app makes.
 *
 * - `reference`: subordinate stations carry offsets from another station rather
 *   than their own constituents. Same trap map-tide-stations.ts documents for
 *   CO-OPS type 'S'.
 * - `commercial_use`: the repo has Stripe wired. 286 TICON-4 stations are
 *   CC-BY-NC and must not ship. Costs 1.8 pp of coverage.
 * - `datums.MLLW` AND `datums.MSL`: scoreTide's TIDE_PREFERENCE table is in
 *   metres above a LOW-WATER datum (reef ideal 1.2 m). An MSL-referenced
 *   series oscillates through zero and goes negative, which would score every
 *   reef as dry for half of every day. Requiring MLLW is what makes
 *   `datum: 'MLLW'` at predict time legitimate for all six chart datums in the
 *   dataset.
 */
export function isUsableStation(st: Station): boolean {
  return (
    st.type === 'reference' &&
    st.license?.commercial_use === true &&
    (st.harmonic_constituents ?? []).length > 0 &&
    st.datums?.MSL != null &&
    st.datums?.MLLW != null
  )
}

/**
 * Thrown when a referee is unreachable rather than merely disagreeing.
 *
 * The distinction is the whole point: "every assignment failed the check" and
 * "the check could not run" produce the same empty table, and writing that
 * table would look like a legitimate result showing nothing qualified. This
 * repo has been bitten by exactly that shape before — a subordinate CO-OPS
 * station answering with an empty prediction list gave yakutat-surf-ak a
 * permanently blank tide chart that nobody noticed.
 */
class GateUnavailableError extends Error {}

interface Assignment {
  slug: string
  name: string
  lat: number
  lng: number
  stationId: string
  km: number
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 12) return NaN
  let sa = 0, sb = 0
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i] }
  const ma = sa / n, mb = sb / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb
    num += x * y; da += x * x; db += y * y
  }
  if (da <= 0 || db <= 0) return NaN
  return num / Math.sqrt(da * db)
}

const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs)

/** Hourly harmonic levels at the given UTC instants, in metres above MLLW. */
function harmonicSeries(station: Station, startUtc: Date, hours: number): number[] {
  const end = new Date(startUtc.getTime() + (hours - 1) * 3600_000)
  const { timeline } = createStationPredictor(station as never).getTimelinePrediction({
    start: startUtc,
    end,
    timeFidelity: 3600,
    datum: 'MLLW',
  })
  return timeline.map((p: { level: number }) => p.level)
}

/**
 * Open-Meteo `sea_level_height_msl` for many coordinates at once.
 *
 * timezone is deliberately GMT: the guard compares two series point-by-point,
 * so both must be on the same clock. `timezone=auto` would return each spot on
 * its own local clock and silently misalign the comparison by the UTC offset —
 * which for a semidiurnal tide can invert the correlation outright.
 */
async function fetchSeaLevelBatch(
  coords: { lat: number; lng: number }[],
  days: number,
): Promise<(number[] | null)[]> {
  const params = new URLSearchParams({
    latitude: coords.map((c) => c.lat).join(','),
    longitude: coords.map((c) => c.lng).join(','),
    hourly: 'sea_level_height_msl',
    timezone: 'GMT',
    forecast_days: String(days),
  })
  const res = await fetch(`${MARINE_BASE}?${params}`, { signal: AbortSignal.timeout(45_000) })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const list = Array.isArray(json) ? json : [json]
  // A length mismatch means the positional zip below would attribute one spot's
  // tide to another. Discard the whole chunk rather than guess — the same guard
  // fetchCurrentConditionsBatch applies.
  if (list.length !== coords.length) {
    throw new Error(`length mismatch: sent ${coords.length}, got ${list.length}`)
  }
  return list.map((entry: { hourly?: { sea_level_height_msl?: (number | null)[] } }) => {
    const vals = entry?.hourly?.sea_level_height_msl
    if (!Array.isArray(vals)) return null
    // Nulls are load-bearing: a land cell returns them and must not become 0.
    if (vals.some((v) => v == null)) return null
    return vals as number[]
  })
}

interface GuardResult {
  slug: string
  gate: 'noaa' | 'open-meteo'
  r: number
  ampRatio: number
  /** RMSE against CO-OPS, metres. NOAA gate only — it is true ground truth, so
   *  a constant offset here is a real datum error rather than model bias. */
  rmse?: number
  pass: boolean
  reason?: string
}

/**
 * US gate — cross-check against the CO-OPS series the app already serves.
 *
 * Strictly stronger than the Open-Meteo gate where it applies: CO-OPS publishes
 * official MLLW predictions, so this validates the datum conversion as well as
 * the phase and amplitude. That third test matters — the Santa Margarita River
 * gauge (a USGS river station in TICON-4) is a `reference` station with a
 * complete datums ladder and a permissive licence, so it passes every static
 * filter, yet its ladder sits ~2 m above the coastal one and it carries a third
 * of the real tidal range. It was silently assigned to Trestles, San Onofre,
 * Cottons and five other North County spots.
 */
async function runNoaaGate(
  assignments: Assignment[],
  stationById: Map<string, Station>,
  noaaBySlug: Map<string, string>,
): Promise<GuardResult[]> {
  const GUARD_HOURS = 72
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  const begin = new Date()
  const end = new Date(begin.getTime() + 3 * 86_400_000)
  const results: GuardResult[] = []
  // CO-OPS throttles aggressive clients with a bare {"message":"Forbidden"} —
  // no 429, no Retry-After — and the block outlasts the run. Two defences:
  // fetch each DISTINCT station once (595 spots share ~200 stations, since
  // neighbouring breaks map to the same gauge) and pace the batches.
  const CONCURRENCY = 2
  const BATCH_PAUSE_MS = 400
  // CO-OPS throttles on a short rolling window and says so only as a bare
  // {"message":"Forbidden"} — no 429, no Retry-After. It is a pause, not a
  // verdict, so back off and retry rather than recording a rejection: treating
  // it as a failed check would silently drop good spots from the table.
  const BACKOFF_MS = [15_000, 45_000, 90_000]
  const seriesCache = new Map<string, { values: number[]; startUtc: Date } | null>()

  async function fetchNoaaSeries(stationId: string) {
    if (seriesCache.has(stationId)) return seriesCache.get(stationId)!
    const params = new URLSearchParams({
      begin_date: fmt(begin), end_date: fmt(end), station: stationId,
      product: 'predictions', datum: 'MLLW', time_zone: 'gmt', interval: 'h',
      units: 'metric', application: 'wavefinder_harmonic_guard', format: 'json',
    })

    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
      try {
        const res = await fetch(`${NOAA_TIDES_BASE}?${params}`, { signal: AbortSignal.timeout(20_000) })
        const data = await res.json()
        if (data?.predictions?.length) {
          const out = {
            values: data.predictions.map((p: { v: string }) => parseFloat(p.v)).slice(0, GUARD_HOURS),
            startUtc: new Date(data.predictions[0].t.replace(' ', 'T') + ':00Z'),
          }
          seriesCache.set(stationId, out)
          return out
        }
        // An error *message* is a throttle; an empty predictions array is a
        // subordinate or retired station, which is a real (permanent) answer.
        if (!data?.message) break
      } catch { /* network hiccup — same backoff path */ }

      if (attempt === BACKOFF_MS.length) { throttled = true; break }
      const wait = BACKOFF_MS[attempt]
      process.stdout.write(`\r  NOAA throttled — backing off ${wait / 1000}s (attempt ${attempt + 1}/${BACKOFF_MS.length})   `)
      await new Promise((r) => setTimeout(r, wait))
    }

    seriesCache.set(stationId, null)
    return null
  }

  let throttled = false
  let done = 0

  // Preflight against a station that always answers, so a throttled CO-OPS
  // costs one request instead of hundreds that deepen the block.
  const probe = await fetchNoaaSeries('9410840')  // Santa Monica Municipal Pier
  if (!probe) {
    throw new GateUnavailableError(
      'NOAA CO-OPS is not answering (it returns a bare {"message":"Forbidden"} when throttled,\n' +
      '  with no 429 and no Retry-After). Wait for the block to clear and re-run.',
    )
  }

  async function one(a: Assignment): Promise<GuardResult> {
    try {
      const series = await fetchNoaaSeries(noaaBySlug.get(a.slug)!)
      if (!series) {
        // Subordinate, retired, or refusing. Either way it cannot judge — fail
        // closed, and let the caller decide whether the whole gate is void.
        return { slug: a.slug, gate: 'noaa', r: NaN, ampRatio: NaN, pass: false, reason: 'no CO-OPS reference series' }
      }
      const noaa = series.values
      const startUtc = series.startUtc
      const harm = harmonicSeries(stationById.get(a.stationId)!, startUtc, noaa.length)
      const n = Math.min(harm.length, noaa.length)
      const h = harm.slice(0, n), o = noaa.slice(0, n)
      const r = pearson(h, o)
      const hr = range(h), or = range(o)
      const ampRatio = or > 0 ? hr / or : NaN
      let se = 0
      for (let i = 0; i < n; i++) se += (h[i] - o[i]) ** 2
      const rmse = Math.sqrt(se / n)

      const microTidal = hr < 0.5 && or < 0.5
      const rOk = r >= MIN_CORRELATION
      const ampOk = microTidal || (ampRatio >= MIN_AMP_RATIO && ampRatio <= MAX_AMP_RATIO)
      const datumOk = rmse <= MAX_NOAA_RMSE_M
      return {
        slug: a.slug, gate: 'noaa', r, ampRatio, rmse,
        pass: rOk && ampOk && datumOk,
        reason: rOk && ampOk && datumOk ? undefined
          : !rOk ? 'phase (wrong body of water)'
          : !ampOk ? 'amplitude'
          : 'datum offset',
      }
    } catch {
      return { slug: a.slug, gate: 'noaa', r: NaN, ampRatio: NaN, pass: false, reason: 'guard fetch failed' }
    }
  }

  for (let i = 0; i < assignments.length; i += CONCURRENCY) {
    const batch = assignments.slice(i, i + CONCURRENCY)
    results.push(...await Promise.all(batch.map(one)))
    done += batch.length
    process.stdout.write(`\r  NOAA gate ${done}/${assignments.length} (${seriesCache.size} stations fetched)`)
    if (throttled) {
      process.stdout.write('\n')
      throw new GateUnavailableError(
        'NOAA CO-OPS is refusing requests ({"message":"Forbidden"}) — it throttles after a few\n' +
        '  hundred rapid calls and the block lasts minutes to hours. Wait and re-run; the gate\n' +
        '  cannot judge anything while the referee is down.',
      )
    }
    await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS))
  }
  process.stdout.write('\n')
  return results
}

/**
 * One cheap probe before 25 chunked requests.
 *
 * Open-Meteo is firewalled on some networks (CLAUDE.md notes the same for
 * `parseCurrentConditions`), and without this the guard spends ~4 minutes
 * collecting identical connect timeouts before reporting a blockage a single
 * request would have shown instantly.
 */
async function openMeteoReachable(): Promise<boolean> {
  try {
    const res = await fetch(
      `${MARINE_BASE}?latitude=34.03&longitude=-118.68&hourly=sea_level_height_msl&timezone=GMT&forecast_days=1`,
      { signal: AbortSignal.timeout(15_000) },
    )
    return res.ok
  } catch {
    return false
  }
}

async function runEstuaryGuard(assignments: Assignment[], stationById: Map<string, Station>) {
  const CHUNK = 50
  const GUARD_HOURS = 72

  if (!(await openMeteoReachable())) {
    throw new GateUnavailableError(
      'Open-Meteo is unreachable from this network, so the international gate cannot run.\n' +
      '  Nothing outside the US can be verified here, and an unverified assignment is exactly\n' +
      '  the ~9%-wrong case this guard exists to prevent.\n' +
      '  Re-run from a network with access to marine-api.open-meteo.com, or pass --us-only\n' +
      '  to deliberately generate a US-only table.',
    )
  }
  // Start at the next whole UTC hour so the harmonic grid lines up with
  // Open-Meteo's hourly grid, which always begins at 00:00 UTC today.
  const start = new Date(Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(),
  ))
  const results: GuardResult[] = []

  for (let i = 0; i < assignments.length; i += CHUNK) {
    const chunk = assignments.slice(i, i + CHUNK)
    let series: (number[] | null)[]
    try {
      series = await fetchSeaLevelBatch(chunk, 3)
    } catch (err) {
      // A failed chunk must not silently pass its spots. Fail them closed.
      console.error(`  chunk ${i / CHUNK + 1}: ${(err as Error).message}`)
      for (const a of chunk) {
        results.push({ slug: a.slug, gate: 'open-meteo', r: NaN, ampRatio: NaN, pass: false, reason: 'guard fetch failed' })
      }
      continue
    }

    chunk.forEach((a, j) => {
      const om = series[j]
      if (!om || om.length < GUARD_HOURS) {
        results.push({ slug: a.slug, gate: 'open-meteo', r: NaN, ampRatio: NaN, pass: false, reason: 'no model tide at spot' })
        return
      }
      const omSlice = om.slice(0, GUARD_HOURS)
      const st = stationById.get(a.stationId)!
      const harm = harmonicSeries(st, start, GUARD_HOURS)
      const r = pearson(harm, omSlice)
      const hr = range(harm), omr = range(omSlice)
      const ampRatio = omr > 0 ? hr / omr : NaN

      // A micro-tidal coast (Mediterranean, Caribbean, parts of Indonesia) has
      // a genuinely tiny range, where the ratio of two small numbers is noise
      // and scoreTide returns a neutral 50 anyway. Judge those on phase only.
      const microTidal = hr < 0.5 && omr < 0.5
      const ampOk = microTidal || (ampRatio >= MIN_AMP_RATIO && ampRatio <= MAX_AMP_RATIO)
      const rOk = r >= MIN_CORRELATION

      results.push({
        slug: a.slug, gate: 'open-meteo', r, ampRatio, pass: rOk && ampOk,
        reason: rOk && ampOk ? undefined
          : !rOk && !ampOk ? 'phase and amplitude'
          : !rOk ? 'phase (wrong body of water)'
          : 'amplitude',
      })
    })
    process.stdout.write(`\r  guarded ${Math.min(i + CHUNK, assignments.length)}/${assignments.length}`)
    // Open-Meteo bills per LOCATION on a 600/minute window, so ~13 chunks of
    // 50 fired back-to-back trip the minutely limit around chunk 12-13 and
    // everything after fails closed (observed 2026-08-31: 47 spots lost to one
    // 429). Spreading the chunks keeps the whole run under the window; a retry
    // would be worse because failed requests are billed too.
    if (i + CHUNK < assignments.length) {
      await new Promise((r) => setTimeout(r, 5_500))
    }
  }
  process.stdout.write('\n')
  return results
}


async function main() {
  ;({ useStation: createStationPredictor } = (await import('@neaps/tide-predictor')) as unknown as { useStation: UseStation })

  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const skipGuard = args.includes('--skip-guard')
  const usOnly = args.includes('--us-only')

  const spots = SURF_SPOTS_SEED as unknown as {
    slug: string; name: string; lat: number; lng: number; noaaTideStationId?: string | null
  }[]

  console.log(`${spots.length} spots; ${spots.filter((s) => !s.noaaTideStationId).length} with no CO-OPS station\n`)

  const assignments: Assignment[] = []
  const stationById = new Map<string, Station>()

  for (const spot of spots) {
    const hit = near({
      lat: spot.lat, lon: spot.lng,
      maxDistance: MAX_HARMONIC_KM, maxResults: 1,
      filter: isUsableStation,
    })[0]
    if (!hit) continue
    const [st] = hit
    // Recompute with the repo's own haversine so the pinned km matches what
    // tests/spots-seed.test.ts recomputes.
    const km = distanceKm(spot.lat, spot.lng, st.latitude, st.longitude)
    assignments.push({ slug: spot.slug, name: spot.name, lat: spot.lat, lng: spot.lng, stationId: st.id, km })
    stationById.set(st.id, st)
  }

  console.log(`matched ${assignments.length} spots to ${stationById.size} stations within ${MAX_HARMONIC_KM} km`)

  let kept = assignments
  const guard: GuardResult[] = []
  const gateCounts = { noaa: 0, 'open-meteo': 0 }

  if (!skipGuard) {
    // Route each assignment to the strongest independent referee available to
    // it. CO-OPS is ground truth but US-only; Open-Meteo's model field is
    // weaker but global. Neither is derived from the harmonic database, which
    // is the property that makes both able to catch a gauge in the wrong water.
    const noaaBySlug = new Map(
      (SURF_SPOTS_SEED as { slug: string; noaaTideStationId?: string | null }[])
        .filter((s) => s.noaaTideStationId)
        .map((s) => [s.slug, s.noaaTideStationId!]),
    )
    const usSide = assignments.filter((a) => noaaBySlug.has(a.slug))
    const intlSide = assignments.filter((a) => !noaaBySlug.has(a.slug))
    gateCounts.noaa = usSide.length
    gateCounts['open-meteo'] = intlSide.length

    console.log(`\nguard: ${usSide.length} spots vs NOAA CO-OPS (ground truth), ${intlSide.length} vs Open-Meteo (model)`)

    if (usSide.length) guard.push(...await runNoaaGate(usSide, stationById, noaaBySlug))
    if (intlSide.length && !usOnly) guard.push(...await runEstuaryGuard(intlSide, stationById))
    else if (intlSide.length) {
      console.log('  --us-only: international gate skipped, those spots stay out of the table')
      guard.push(...intlSide.map((a): GuardResult => ({
        slug: a.slug, gate: 'open-meteo', r: NaN, ampRatio: NaN, pass: false, reason: 'guard fetch failed',
      })))
    }

    const dumpIdx = args.indexOf('--dump-guard')
    if (dumpIdx !== -1 && args[dumpIdx + 1]) {
      writeFileSync(args[dumpIdx + 1], JSON.stringify(guard, null, 0))
      console.log(`  wrote guard verdicts to ${args[dumpIdx + 1]}`)
    }

    const failed = new Map(guard.filter((g) => !g.pass).map((g) => [g.slug, g]))
    kept = assignments.filter((a) => !failed.has(a.slug))

    for (const gate of ['noaa', 'open-meteo'] as const) {
      const sub = guard.filter((g) => g.gate === gate)
      if (!sub.length) continue
      const pass = sub.filter((g) => g.pass)
      const rs = pass.map((g) => g.r).filter(isFinite).sort((a, b) => a - b)
      console.log(`  ${gate}: pass ${pass.length}/${sub.length}, median r ${rs[Math.floor(rs.length / 2)]?.toFixed(3) ?? 'n/a'}`)
      const unreachable = sub.filter((g) => g.reason === 'guard fetch failed').length
      if (unreachable) console.log(`    ${unreachable} could not be checked (referee unreachable) — failed closed`)
    }

    const shown = [...failed.values()].filter((g) => isFinite(g.r))
      .sort((a, b) => a.r - b.r).slice(0, 15)
    if (shown.length) {
      console.log('\n  worst rejections:')
      for (const g of shown) {
        const a = assignments.find((x) => x.slug === g.slug)!
        const rmse = g.rmse != null ? ` rmse=${g.rmse.toFixed(2)}` : ''
        console.log(`    r=${g.r.toFixed(2).padStart(5)} amp=${g.ampRatio.toFixed(2).padStart(4)}${rmse}  ${a.slug} → ${a.stationId} (${a.km.toFixed(0)} km) — ${g.reason}`)
      }
    }
    console.log(`\n  total pass ${kept.length}  reject ${failed.size}  (${(100 * failed.size / assignments.length).toFixed(1)}%)`)
  } else {
    console.warn('\n!! --skip-guard: assignments are distance-only and ~9% will be hydraulically wrong')
  }


  // Only stations that survived for at least one spot.
  const keptStationIds = new Set(kept.map((a) => a.stationId))
  const stationsOut: Record<string, unknown> = {}
  for (const id of [...keptStationIds].sort()) {
    const st = stationById.get(id)!
    // The whole datums ladder, not a precomputed offset: useStation() reads it
    // directly, so a later change of target datum costs nothing.
    stationsOut[id] = {
      id: st.id, name: st.name, latitude: st.latitude, longitude: st.longitude,
      timezone: st.timezone, type: st.type, chart_datum: st.chart_datum,
      country: st.country, continent: st.continent,
      datums: st.datums,
      harmonic_constituents: st.harmonic_constituents,
      source: st.source, license: st.license,
    }
  }
  const spotsOut: Record<string, { stationId: string; km: number }> = {}
  for (const a of [...kept].sort((x, y) => x.slug.localeCompare(y.slug))) {
    spotsOut[a.slug] = { stationId: a.stationId, km: Math.round(a.km * 10) / 10 }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    maxDistanceKm: MAX_HARMONIC_KM,
    // `guard: null` means the table is distance-only. lib/tides/stations.ts
    // refuses to serve such a table at all, so an unguarded generation is inert
    // rather than quietly shipping ~9% wrong tides.
    guard: skipGuard ? null : {
      minCorrelation: MIN_CORRELATION,
      minAmpRatio: MIN_AMP_RATIO,
      maxAmpRatio: MAX_AMP_RATIO,
      maxNoaaRmseM: MAX_NOAA_RMSE_M,
      checked: assignments.length,
      rejected: assignments.length - kept.length,
      byGate: {
        noaa: { checked: gateCounts.noaa, passed: guard.filter((g) => g.gate === 'noaa' && g.pass).length },
        'open-meteo': { checked: gateCounts['open-meteo'], passed: guard.filter((g) => g.gate === 'open-meteo' && g.pass).length },
      },
    },
    stationCount: keptStationIds.size,
    spotCount: kept.length,
    stations: stationsOut,
    spots: spotsOut,
  }

  const json = JSON.stringify(payload, null, 0)
  console.log(`\noutput: ${kept.length} spots, ${keptStationIds.size} stations, ${(json.length / 1024).toFixed(0)} KB raw`)

  if (!write) {
    if (existsSync(OUT_PATH)) {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf8'))
      const prevSlugs = new Set(Object.keys(prev.spots ?? {}))
      const nowSlugs = new Set(Object.keys(spotsOut))
      const added = [...nowSlugs].filter((s) => !prevSlugs.has(s))
      const removed = [...prevSlugs].filter((s) => !nowSlugs.has(s))
      console.log(`diff vs existing: +${added.length} -${removed.length}`)
      if (removed.length) console.log(`  removed: ${removed.slice(0, 10).join(', ')}${removed.length > 10 ? ' …' : ''}`)
    }
    console.log('\ndry run — pass --write to update lib/tides/data/harmonic-stations.json')
    return
  }

  writeFileSync(OUT_PATH, json)
  console.log(`wrote ${OUT_PATH}`)
}

// Only when invoked directly — tests and sibling scripts import isUsableStation
// and the thresholds, and must not trigger a generation run by doing so.
if (require.main === module) {
  main().catch((e) => {
    if (e instanceof GateUnavailableError) {
      // Not a crash — a refusal to write an unverifiable table. Say so plainly
      // rather than dumping a stack, and leave the existing table untouched.
      console.error(`\nAborted without writing: ${e.message}`)
      process.exit(2)
    }
    console.error(e)
    process.exit(1)
  })
}
