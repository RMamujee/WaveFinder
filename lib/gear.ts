export type BoardType = 'Shortboard' | 'Longboard' | 'Fish' | 'Mid-length' | 'Gun' | 'Foil' | 'Bodyboard' | 'Other'
export type WetsuitThickness = 'None / Boardshorts' | '2mm' | '3/2mm' | '4/3mm' | '5/4mm' | 'Drysuit'

export interface GearBoard {
  id: string
  kind: 'board'
  name: string
  boardType: BoardType
  lengthFt: string
  volume: string
  notes: string
  createdAt: string
}

export interface GearWetsuit {
  id: string
  kind: 'wetsuit'
  name: string
  thickness: WetsuitThickness
  notes: string
  createdAt: string
}

export type GearItem = GearBoard | GearWetsuit

const GEAR_KEY = 'wavefinder_gear'

export function getGear(): GearItem[] {
  try {
    return JSON.parse(localStorage.getItem(GEAR_KEY) ?? '[]') as GearItem[]
  } catch {
    return []
  }
}

export function saveGear(items: GearItem[]): void {
  localStorage.setItem(GEAR_KEY, JSON.stringify(items))
}

export function getBoards(): GearBoard[] {
  return getGear().filter((g): g is GearBoard => g.kind === 'board')
}

export function getWetsuits(): GearWetsuit[] {
  return getGear().filter((g): g is GearWetsuit => g.kind === 'wetsuit')
}

export const BOARD_TYPES: BoardType[] = ['Shortboard', 'Longboard', 'Fish', 'Mid-length', 'Gun', 'Foil', 'Bodyboard', 'Other']
export const WETSUIT_OPTIONS: WetsuitThickness[] = ['None / Boardshorts', '2mm', '3/2mm', '4/3mm', '5/4mm', 'Drysuit']
