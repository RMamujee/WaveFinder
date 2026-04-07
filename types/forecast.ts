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
}

export interface ForecastDay {
  date: string
  hours: ForecastHour[]
  maxWaveHeight: number
  avgPeriod: number
  dominantRating: ConditionRating
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
  meanDirection: number
  waterTemp: number | null
  airTemp: number | null
  windSpeed: number | null
  windDirection: number | null
}

export interface SpotForecast {
  spotId: string
  fetchedAt: string
  forecast: ForecastDay[]
  tides: TidePoint[]
  buoy: BuoyReading | null
  currentCondition: ForecastHour | null
}
