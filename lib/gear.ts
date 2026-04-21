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

export const BOARD_TYPES: BoardType[] = ['Shortboard', 'Longboard', 'Fish', 'Mid-length', 'Gun', 'Foil', 'Bodyboard', 'Other']
export const WETSUIT_OPTIONS: WetsuitThickness[] = ['None / Boardshorts', '2mm', '3/2mm', '4/3mm', '5/4mm', 'Drysuit']

const BOARD_TYPE_SET = new Set<string>(BOARD_TYPES)
const WETSUIT_SET = new Set<string>(WETSUIT_OPTIONS)

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateItem(raw: unknown): GearItem | null {
  if (!isRecord(raw)) return null
  const { id, kind, name, createdAt } = raw

  if (typeof id !== 'string' || !id) return null
  if (typeof name !== 'string') return null
  if (typeof createdAt !== 'string') return null

  if (kind === 'board') {
    if (!BOARD_TYPE_SET.has(String(raw.boardType ?? ''))) return null
    return {
      id,
      kind: 'board',
      name,
      boardType: raw.boardType as BoardType,
      lengthFt: String(raw.lengthFt ?? ''),
      volume: String(raw.volume ?? ''),
      notes: String(raw.notes ?? ''),
      createdAt,
    }
  }

  if (kind === 'wetsuit') {
    if (!WETSUIT_SET.has(String(raw.thickness ?? ''))) return null
    return {
      id,
      kind: 'wetsuit',
      name,
      thickness: raw.thickness as WetsuitThickness,
      notes: String(raw.notes ?? ''),
      createdAt,
    }
  }

  return null
}

export function getGear(): GearItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(GEAR_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(validateItem).filter((item): item is GearItem => item !== null)
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
