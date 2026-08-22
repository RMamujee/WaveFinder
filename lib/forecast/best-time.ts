import type { ForecastHour, ConditionRating, TidePoint } from '@/types/forecast'
import { format, parseISO, getHours } from 'date-fns'

export type SessionWindow = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening'

export interface BestTimeSlot {
  window: SessionWindow
  label: string
  timeRange: string
  hours: ForecastHour[]
  avgScore: number
  rating: ConditionRating
  avgWaveHeight: number
  avgPeriod: number
  /** Averaged over the window's hours that HAVE a wind reading; null when none do. */
  avgWindSpeed: number | null
  windQuality: 'glassy' | 'light offshore' | 'light onshore' | 'choppy' | 'unknown'
  tip: string
  recommended: boolean
}

const WINDOWS: Record<SessionWindow, { label: string; start: number; end: number }> = {
  dawn:      { label: 'Dawn Patrol', start: 5,  end: 8  },
  morning:   { label: 'Morning',     start: 8,  end: 12 },
  midday:    { label: 'Midday',      start: 12, end: 15 },
  afternoon: { label: 'Afternoon',   start: 15, end: 18 },
  evening:   { label: 'Evening',     start: 18, end: 21 },
}

function isOffshore(avgWindDir: number, spotFacing: number): boolean {
  const offshoreDir = (spotFacing + 180) % 360
  const diff = Math.abs(avgWindDir - offshoreDir) % 360
  return (diff <= 90 || diff >= 270)
}

function classifyWindQuality(avgWindSpeed: number | null, avgWindDir: number, spotFacing: number): BestTimeSlot['windQuality'] {
  // No wind reading for the window: say so — "glassy" is the opposite of unknown.
  if (avgWindSpeed == null) return 'unknown'
  if (avgWindSpeed < 8) return 'glassy'
  const offshore = isOffshore(avgWindDir, spotFacing)
  if (avgWindSpeed < 15) return offshore ? 'light offshore' : 'light onshore'
  return 'choppy'
}

function generateTip(
  window: SessionWindow,
  rating: ConditionRating,
  waveHeight: number,
  windQuality: BestTimeSlot['windQuality']
): string {
  const heightFt = Math.round(waveHeight * 3.281)

  if (rating === 'epic') {
    return `Don't miss this! ${heightFt}ft ${windQuality === 'glassy' || windQuality === 'light offshore' ? 'with clean conditions' : ''}. All-time session potential.`
  }
  if (rating === 'good') {
    if (windQuality === 'glassy') return `${heightFt}ft of glassy ${window === 'dawn' ? 'dawn patrol' : 'surf'} — get out there early before the wind picks up.`
    if (window === 'dawn') return `Dawn patrol window looks solid at ${heightFt}ft. Offshore winds keep it clean early.`
    return `Quality surf at ${heightFt}ft. ${windQuality === 'light offshore' ? 'Light offshore winds helping the faces.' : 'Worth checking out.'}`
  }
  if (rating === 'fair') {
    if (window === 'dawn' || window === 'morning') return `Small but fun at ${heightFt}ft. Good for longboards or a quick pre-work session.`
    if (windQuality === 'choppy') return `${heightFt}ft but onshore wind is making it messy. Consider earlier windows.`
    return `Rideable at ${heightFt}ft. Manage expectations.`
  }
  // poor
  if (window === 'dawn') return `Conditions are challenging early. Only worth it if you need the paddle.`
  return `Skip this window unless you're desperate for water time.`
}

function getTideNote(startTime: string, endTime: string, tides: TidePoint[]): string {
  const before = [...tides].filter((t) => t.time <= startTime).pop()
  const after  = tides.find((t) => t.time >= endTime)
  if (!before || !after) return ''
  const diff = after.height - before.height
  if (diff > 0.1) return ' Tide rising through this window.'
  if (diff < -0.1) return ' Tide dropping through this window.'
  return ''
}

export function computeBestTimes(todayHours: ForecastHour[], spotFacing: number, tides?: TidePoint[]): BestTimeSlot[] {
  const slots: BestTimeSlot[] = []

  for (const [key, win] of Object.entries(WINDOWS) as [SessionWindow, typeof WINDOWS[SessionWindow]][]) {
    const hours = todayHours.filter((h) => {
      const hr = getHours(parseISO(h.time))
      return hr >= win.start && hr < win.end
    })

    if (hours.length === 0) continue

    const avgScore = hours.reduce((s, h) => s + h.ratingScore, 0) / hours.length
    const avgWaveHeight = hours.reduce((s, h) => s + h.waveHeight, 0) / hours.length
    const avgPeriod = hours.reduce((s, h) => s + h.swellPeriod, 0) / hours.length
    const knownWinds = hours.map((h) => h.wind.speed).filter((v): v is number => v != null)
    const avgWindSpeed = knownWinds.length > 0
      ? knownWinds.reduce((s, v) => s + v, 0) / knownWinds.length
      : null
    const sinSum = hours.reduce((s, h) => s + Math.sin(h.wind.direction * Math.PI / 180), 0)
    const cosSum = hours.reduce((s, h) => s + Math.cos(h.wind.direction * Math.PI / 180), 0)
    const avgWindDir = ((Math.atan2(sinSum, cosSum) * 180 / Math.PI) + 360) % 360

    // Rating from avg score
    let rating: ConditionRating
    if (avgScore >= 80) rating = 'epic'
    else if (avgScore >= 60) rating = 'good'
    else if (avgScore >= 35) rating = 'fair'
    else rating = 'poor'

    const windQuality = classifyWindQuality(avgWindSpeed, avgWindDir, spotFacing)
    const tideNote = tides?.length
      ? getTideNote(hours[0].time, hours[hours.length - 1].time, tides)
      : ''
    const tip = generateTip(key, rating, avgWaveHeight, windQuality) + tideNote

    const startHour = hours[0]
    const endHour = hours[hours.length - 1]
    const timeRange = `${format(parseISO(startHour.time), 'h:mm a')} – ${format(parseISO(endHour.time), 'h:mm a')}`

    slots.push({
      window: key,
      label: win.label,
      timeRange,
      hours,
      avgScore: Math.round(avgScore),
      rating,
      avgWaveHeight: Math.round(avgWaveHeight * 10) / 10,
      avgPeriod: Math.round(avgPeriod * 10) / 10,
      avgWindSpeed: avgWindSpeed == null ? null : Math.round(avgWindSpeed),
      windQuality,
      tip,
      recommended: rating === 'good' || rating === 'epic',
    })
  }

  return slots
}

// Find the single best 3-hour window within a day
export function findBestWindow(todayHours: ForecastHour[]): {
  start: string
  end: string
  score: number
  rating: ConditionRating
} | null {
  if (todayHours.length < 2) return null

  let best = { idx: 0, score: 0 }

  for (let i = 0; i < todayHours.length - 1; i++) {
    const window = todayHours.slice(i, i + 3)
    const avg = window.reduce((s, h) => s + h.ratingScore, 0) / window.length
    if (avg > best.score) best = { idx: i, score: avg }
  }

  const window = todayHours.slice(best.idx, best.idx + 3)
  let rating: ConditionRating
  if (best.score >= 80) rating = 'epic'
  else if (best.score >= 60) rating = 'good'
  else if (best.score >= 35) rating = 'fair'
  else rating = 'poor'

  return {
    start: format(parseISO(window[0].time), 'h a'),
    end: format(parseISO(window[window.length - 1].time), 'h a'),
    score: Math.round(best.score),
    rating,
  }
}
