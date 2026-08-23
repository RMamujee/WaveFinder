export type ConditionRating = 'poor' | 'fair' | 'good' | 'epic'

export interface SwellComponent {
  height: number
  period: number
  direction: number
  directionLabel: string
}

export interface WindData {
  /** km/h. NULL when the weather API had no entry for the hour and there was no
   *  windsea partition to estimate one from. Rendered as "—", never as 0 —
   *  a 0 reads as dead glassy, which is the opposite of "unknown". */
  speed: number | null
  /** km/h. Null alongside a null speed; otherwise either the measured gust or a
   *  `speed × 1.25` display stand-in (the stand-in is never scored). */
  gust: number | null
  direction: number
  directionLabel: string
}

export interface ForecastHour {
  time: string
  /** Significant height of the combined sea from the model (m). */
  waveHeight: number
  /** Estimated breaking wave height at the spot (m) — the model swell shoaled
   *  by period and reduced by how square-on it hits this beach. This is the
   *  number that corresponds to the size a surfer would call it. */
  faceHeight: number
  wavePeriod: number
  waveDirection: number
  swellHeight: number
  swellPeriod: number
  swellDirection: number
  windWaveHeight: number
  wind: WindData
  rating: ConditionRating
  ratingScore: number
  wavePower: number
  uvIndex: number
  waterTemp: number | null
  airTempC: number | null
  weatherCode: number | null
  precipProb: number | null
  // True for hours past day ~10 where the long-range model substitutes total
  // wave for swell components; consumers (alerts, ratings UI) can treat these
  // as lower-confidence and avoid triggering hard notifications on them.
  isLongRange?: boolean
}

export interface ForecastDay {
  date: string
  hours: ForecastHour[]
  maxWaveHeight: number
  maxFaceHeight: number
  avgPeriod: number
  dominantRating: ConditionRating
  minTempC: number | null
  maxTempC: number | null
  weatherCode: number | null
  maxPrecipProb: number | null
}

export interface TidePoint {
  time: string
  height: number
  type: 'H' | 'L' | null
}

export interface BuoyReading {
  time: string
  waveHeight: number | null   // null when WVHT sensor is offline/missing (MM)
  dominantPeriod: number | null
  averagePeriod: number | null
  meanDirection: number | null  // null when MWD sensor is offline/missing (MM)
  waterTemp: number | null
  airTemp: number | null
  windSpeed: number | null
  windDirection: number | null
}

export interface CoastalWindReading {
  time: string         // "YYYY-MM-DD HH:MM" local time
  speedMps: number     // m/s
  directionDeg: number // degrees true, meteorological (FROM)
  gustMps: number | null
  stationId: string
}

export interface SpotForecast {
  spotId: string
  fetchedAt: string
  /** Spot's UTC offset from Open-Meteo — lets the client pick the current hour
   *  from forecast[] instead of trusting the CDN-frozen currentCondition.
   *  Optional: absent on payloads cached before 2026-08-05. */
  utcOffsetSeconds?: number
  /** The spot's IANA zone name from Open-Meteo (`timezone=auto`). Used to
   *  render absolute instants — solar times, alert expiries — on the SPOT's
   *  clock rather than the viewer's. Preferred over utcOffsetSeconds because
   *  it stays right across a DST change. Optional/null: payloads cached before
   *  2026-08-22 have no such field, and consumers must degrade to
   *  utcOffsetSeconds (then to rendering nothing) rather than to the viewer's
   *  timezone. See lib/forecast/local-time.ts. */
  timezone?: string | null
  forecast: ForecastDay[]
  tides: TidePoint[]
  buoy: BuoyReading | null
  currentCondition: ForecastHour | null
  coastalWind: CoastalWindReading | null
}
