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
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  facingDirection: number
  noaaTideStationId?: string | null
  /** Harmonic-constituent station id (@neaps/tide-database), assigned at build
   *  time by scripts/map-harmonic-stations.ts. Deliberately NOT overloaded onto
   *  noaaTideStationId: the two id namespaces are unrelated, and CO-OPS remains
   *  the source for coastal wind observations even where harmonics serve tide. */
  harmonicTideStationId?: string | null
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


