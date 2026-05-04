export type ConditionRating = 'poor' | 'fair' | 'good' | 'epic'

export interface SwellComponent {
  height: number
  period: number
  direction: number
  directionLabel: string
}

export interface WindData {
  speed: number
  gust: number
  direction: number
  directionLabel: string
}

export interface ForecastHour {
  time: string
  waveHeight: number
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
  forecast: ForecastDay[]
  tides: TidePoint[]
  buoy: BuoyReading | null
  currentCondition: ForecastHour | null
  coastalWind: CoastalWindReading | null
}
