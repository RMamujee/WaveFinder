import type { TidePoint } from '@/types/forecast'

/**
 * Flag local maxima as 'H' and local minima as 'L' in an hourly tide series.
 *
 * The H/L markers the chart and `best-time.ts` read are DERIVED from the hourly
 * series, not fetched — neither NOAA's `interval=h` product nor the harmonic
 * predictor labels them. Both tide sources therefore have to run the identical
 * scan or the two would disagree about which hour is the high: shared here
 * rather than duplicated so a future change (e.g. plateau handling) lands on
 * both at once.
 *
 * Mutates and returns `points`; the first and last entries are never flagged
 * because neither has a neighbour on both sides to compare against.
 */
export function markTideExtremes(points: TidePoint[]): TidePoint[] {
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].height
    const curr = points[i].height
    const next = points[i + 1].height
    if (curr > prev && curr > next) points[i].type = 'H'
    else if (curr < prev && curr < next) points[i].type = 'L'
  }
  return points
}
