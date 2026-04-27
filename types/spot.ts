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
  activities?: string[]
}

export interface SurfSpotWithRating extends SurfSpot {
  currentRating: ConditionRating
  currentWaveHeight: number
  currentPeriod: number
}

export type WaterActivity = 'surfing' | 'fishing' | 'boating' | 'jetski' | 'spearfishing' | 'bodysurfing' | 'parasailing' | 'paddleboarding'

export const ACTIVITY_META: Record<WaterActivity, { label: string; icon: string; color: string; bg: string }> = {
  surfing:      { label: 'Surfing',      icon: 'surfer',   color: '#1b7fcb', bg: '#dbeafe' },
  fishing:      { label: 'Fishing',      icon: 'fish',     color: '#15803d', bg: '#dcfce7' },
  boating:      { label: 'Boating',      icon: 'boat',     color: '#0e4d88', bg: '#bfdbfe' },
  jetski:       { label: 'Jet Ski',      icon: 'jetski',   color: '#7c3aed', bg: '#ede9fe' },
  spearfishing: { label: 'Spearfishing', icon: 'snorkel',  color: '#0891b2', bg: '#cffafe' },
  bodysurfing:  { label: 'Bodysurfing',  icon: 'swimmer',  color: '#0d9488', bg: '#ccfbf1' },
  parasailing:  { label: 'Parasailing',  icon: 'parasail', color: '#d97706', bg: '#fef3c7' },
  paddleboarding:{ label: 'Paddleboarding', icon: 'paddle', color: '#be185d', bg: '#fce7f3' },
}
