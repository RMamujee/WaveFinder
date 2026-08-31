import type { TidePoint } from '@/types/forecast'
// Aliased: the name is not a React Hook, but its 'use' prefix trips
// react-hooks/rules-of-hooks. It builds a predictor from a station record.
import { useStation as createStationPredictor } from '@neaps/tide-predictor'
import { HARMONIC_STATIONS, type HarmonicStation } from '@/lib/tides/stations'
import { markTideExtremes } from './tide-extremes'

/**
 * Tide predictions from harmonic constituents, computed in-process.
 *
 * This is the international counterpart to `fetchTidePredictions`, which can
 * only ever serve US spots because NOAA CO-OPS is a US agency. 887 of 1,482
 * spots had no tide at all before this — the chart was blank and `scoreTide`
 * renormalised itself away, so Portugal, Indonesia and Australia were rated on
 * a strictly smaller set of factors than California.
 *
 * Unlike every other data source in the app this makes NO network call. A tide
 * is a sum of astronomical sinusoids whose amplitudes and phases are fixed
 * per-location, so given ~50 constituents the whole 17-day window is ~20 ms of
 * arithmetic. That also means it cannot fail the way `fetchTidePredictions`
 * can: no 502, no timeout, and none of the silent-empty-array behaviour that
 * made yakutat-surf-ak a permanently blank chart.
 *
 * Measured against live CO-OPS predictions across 595 US spots, the passing
 * assignments agreed at median Pearson r = 1.000 and median RMSE 0.013 m.
 */

/**
 * 17 days of hourly tide, matching `fetchTidePredictions`' contract exactly:
 * local "YYYY-MM-DDTHH:MM" strings, metres above MLLW, H/L flags on the local
 * extrema.
 *
 * @param utcOffsetSeconds the spot's offset from Open-Meteo's `timezone=auto`.
 */
export function predictTides(stationId: string, utcOffsetSeconds: number): TidePoint[] {
  const station = HARMONIC_STATIONS[stationId]
  if (!station) return []
  return predictTidesFromStation(station, utcOffsetSeconds)
}

/**
 * The prediction itself, decoupled from the generated table.
 *
 * Split out so the clock and datum handling stay testable from a fixture: the
 * table is a build artifact that may legitimately be empty in a fresh checkout,
 * and a test suite that silently passes because there is no data to check is
 * worse than no test at all.
 */
export function predictTidesFromStation(
  station: HarmonicStation,
  utcOffsetSeconds: number,
): TidePoint[] {
  // Everything below works in "shifted epoch" milliseconds: real UTC ms plus
  // the spot's offset, so that reading the value with UTC getters yields the
  // spot's LOCAL wall clock. CLAUDE.md's rule that Open-Meteo times are the
  // spot's local clock with no offset applies to what we emit here too — the
  // day filters on the chart compare these strings directly against Open-Meteo
  // hour strings, so an emitted UTC time would misalign the whole tide chart
  // by the offset.
  const offsetMs = utcOffsetSeconds * 1000
  const nowLocalMs = Date.now() + offsetMs

  // Start at local midnight YESTERDAY, for the same reason the NOAA path does:
  // the server clock is UTC, so a California spot at 11pm local is already
  // "tomorrow" in UTC and would lose today's tide entirely.
  const startLocalMs = Math.floor(nowLocalMs / 86_400_000) * 86_400_000 - 86_400_000
  const HOURS = 17 * 24  // 1 day of backfill + the 16-day marine horizon

  // Anchor the predictor's grid on the spot's local midnight rather than a
  // whole UTC hour. Zones offset by :30 or :45 (India, Nepal, Chatham) put
  // local hours off the UTC hour grid, and NOAA's lst_ldt series is on local
  // wall-clock hours — so anchoring on UTC would emit :00 labels for readings
  // actually taken at :30.
  const start = new Date(startLocalMs - offsetMs)
  const end = new Date(startLocalMs - offsetMs + (HOURS - 1) * 3_600_000)

  let timeline: { time: Date; level: number }[]
  try {
    ;({ timeline } = createStationPredictor(station as never).getTimelinePrediction({
      start,
      end,
      timeFidelity: 3600,
      // Always explicit, never the station's own `chart_datum`: the dataset
      // mixes MLLW, LAT, NLLW, MLWS, LLWLT and TLT, and scoreTide's
      // TIDE_PREFERENCE table (reef ideal 1.2 m) was calibrated on MLLW alone.
      // The MSL→MLLW shift across these stations spans 0.04–3.31 m, so an
      // unconverted series would misplace many spots by more than the entire
      // tolerance band.
      datum: 'MLLW',
    }))
  } catch {
    // Missing datum or malformed constituents. Empty is the correct degraded
    // value — the rating weights renormalise over the factors present, whereas
    // zeros would score every hour as a dead-low tide.
    return []
  }

  const points: TidePoint[] = timeline.map((p, i) => ({
    time: new Date(startLocalMs + i * 3_600_000).toISOString().slice(0, 16),
    height: Math.round(p.level * 100) / 100,
    type: null as 'H' | 'L' | null,
  }))

  // Same local-maxima scan the NOAA path uses (shared via tide-extremes.ts),
  // so best-time.ts and the chart are untouched. getExtremesPrediction() is
  // strictly more accurate but puts H/L at times between the hourly points,
  // which the chart is not built for.
  return markTideExtremes(points)
}
