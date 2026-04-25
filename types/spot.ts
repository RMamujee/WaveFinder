import type { ConditionRating } from './forecast'

export interface ParkingOption {
  name: string
  lat: number
  lng: number
  type: 'lot' | 'street' | 'structure' | 'pullout'
  isFree: boolean
  pricePerHour?: number | null
  dailyMax?: number | null
  hours?: string
  maxStayHours?: number | null
  notes?: string
}

export interface SurfSpot {
  id: string
  slug: string
  name: string
  region: string
  country: string
  lat: number
  lng: number
  description?: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  facingDirection: number
  noaaTideStationId?: string | null
  noaaBuoyId?: string | null
  webcamUrl?: string | null
  webcamType?: string | null
  parkingOptions?: ParkingOption[] | null
  bottomType?: string | null
}

export interface SurfSpotWithRating extends SurfSpot {
  currentRating: ConditionRating
  currentWaveHeight: number
  currentPeriod: number
}
