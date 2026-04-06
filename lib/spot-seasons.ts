export interface MonthData {
  month: number // 1-12
  quality: 'poor' | 'fair' | 'good' | 'epic'
  label: string
}

export interface SeasonData {
  months: MonthData[]
  peakSeason: string
  offSeason: string
  swellSource: string
  notes: string
}

// ── Region season definitions ─────────────────────────────────────────────────

const NORTHERN_CA: SeasonData = {
  peakSeason: 'October – March',
  offSeason: 'June – August',
  swellSource: 'North Pacific groundswells',
  notes:
    'Powerful NW groundswells from Aleutian and North Pacific storm tracks dominate fall and winter. Summer brings small, weak NW windswell with frequent fog. Spring and fall offer occasional epic days with lighter crowds.',
  months: [
    { month: 1,  quality: 'epic', label: 'Peak NW groundswells' },
    { month: 2,  quality: 'epic', label: 'Peak NW groundswells' },
    { month: 3,  quality: 'good', label: 'Consistent groundswells' },
    { month: 4,  quality: 'fair', label: 'Fading winter swells' },
    { month: 5,  quality: 'fair', label: 'Mixed NW windswell' },
    { month: 6,  quality: 'poor', label: 'Flat summer, strong onshores' },
    { month: 7,  quality: 'poor', label: 'Flat, foggy, onshore' },
    { month: 8,  quality: 'poor', label: 'Flat, foggy, onshore' },
    { month: 9,  quality: 'fair', label: 'Early season NW swells' },
    { month: 10, quality: 'good', label: 'Season opening, NW groundswells' },
    { month: 11, quality: 'epic', label: 'Peak season begins' },
    { month: 12, quality: 'epic', label: 'Peak NW groundswells' },
  ],
}

const SAN_FRANCISCO: SeasonData = {
  peakSeason: 'October – March',
  offSeason: 'June – August',
  swellSource: 'North Pacific groundswells',
  notes:
    'Ocean Beach and the SF coast pick up powerful NW swells in winter, often too big and stormy for most surfers. Fall is the sweet spot — cleaner, consistent swell with light winds. Summer is typically flat and windy.',
  months: [
    { month: 1,  quality: 'epic', label: 'Powerful winter swells, stormy' },
    { month: 2,  quality: 'epic', label: 'Powerful winter swells, stormy' },
    { month: 3,  quality: 'good', label: 'Solid NW swells, cleaning up' },
    { month: 4,  quality: 'fair', label: 'Transition — lighter swells' },
    { month: 5,  quality: 'fair', label: 'Small NW windswell' },
    { month: 6,  quality: 'poor', label: 'Flat, strong onshore winds' },
    { month: 7,  quality: 'poor', label: 'Flat, foggy, persistent onshore' },
    { month: 8,  quality: 'poor', label: 'Flat, foggy, onshore' },
    { month: 9,  quality: 'fair', label: 'Early fall groundswells' },
    { month: 10, quality: 'good', label: 'Consistent groundswells, cleaner' },
    { month: 11, quality: 'epic', label: 'Strong NW swells, offshore mornings' },
    { month: 12, quality: 'epic', label: 'Peak swell season' },
  ],
}

const CENTRAL_CA: SeasonData = {
  peakSeason: 'October – April',
  offSeason: 'June – August',
  swellSource: 'North Pacific groundswells + some southern hemi',
  notes:
    'Santa Cruz and the Central Coast are slightly more consistent year-round than NorCal proper. The region receives NW groundswells in winter and can pick up Southern Hemisphere swells in summer that NorCal misses. Point breaks here can work on a wider range of swells.',
  months: [
    { month: 1,  quality: 'epic', label: 'Consistent NW groundswells' },
    { month: 2,  quality: 'epic', label: 'Consistent NW groundswells' },
    { month: 3,  quality: 'good', label: 'Strong NW, occasional epic days' },
    { month: 4,  quality: 'good', label: 'Solid spring swells' },
    { month: 5,  quality: 'fair', label: 'Fading NW + small S hemi pulses' },
    { month: 6,  quality: 'fair', label: 'Small, semi-consistent' },
    { month: 7,  quality: 'poor', label: 'Small summer swells, onshore' },
    { month: 8,  quality: 'fair', label: 'S hemi swells possible' },
    { month: 9,  quality: 'fair', label: 'Early NW season starts' },
    { month: 10, quality: 'good', label: 'Good NW groundswells return' },
    { month: 11, quality: 'epic', label: 'Peak season, offshore mornings' },
    { month: 12, quality: 'epic', label: 'Peak winter swells' },
  ],
}

const SOUTHERN_CA: SeasonData = {
  peakSeason: 'May – September',
  offSeason: 'December – February',
  swellSource: 'Southern Hemisphere groundswells + NW groundswells',
  notes:
    'SoCal is uniquely positioned to receive both NW groundswells in winter and Southern Hemisphere swells in summer — making it relatively surf-able year-round. Summer S swells from NZ/Tasman storms light up beach breaks and points. Winter NW swells can be epic but are less frequent.',
  months: [
    { month: 1,  quality: 'fair', label: 'Occasional NW groundswells' },
    { month: 2,  quality: 'fair', label: 'NW swells, small but fun' },
    { month: 3,  quality: 'fair', label: 'NW season winding down' },
    { month: 4,  quality: 'fair', label: 'Transition — light swells' },
    { month: 5,  quality: 'good', label: 'S swells begin, warm water' },
    { month: 6,  quality: 'good', label: 'S hemi pulses, offshore mornings' },
    { month: 7,  quality: 'epic', label: 'Peak S hemi season' },
    { month: 8,  quality: 'epic', label: 'Strong S hemi swells, warm' },
    { month: 9,  quality: 'good', label: 'Late S swells + early NW' },
    { month: 10, quality: 'good', label: 'NW season opens, clean conditions' },
    { month: 11, quality: 'fair', label: 'NW groundswells, cooler' },
    { month: 12, quality: 'fair', label: 'Winter NW, inconsistent' },
  ],
}

const DEFAULT_CA: SeasonData = {
  peakSeason: 'October – March',
  offSeason: 'June – August',
  swellSource: 'North Pacific groundswells',
  notes:
    'California surf spots generally peak during winter when North Pacific storm tracks push consistent groundswells down the coast. Summer months are typically smaller and more onshore.',
  months: [
    { month: 1,  quality: 'good', label: 'Winter groundswells' },
    { month: 2,  quality: 'good', label: 'Winter groundswells' },
    { month: 3,  quality: 'good', label: 'Late winter swells' },
    { month: 4,  quality: 'fair', label: 'Spring transition' },
    { month: 5,  quality: 'fair', label: 'Mixed conditions' },
    { month: 6,  quality: 'poor', label: 'Summer flat spell' },
    { month: 7,  quality: 'poor', label: 'Summer flat spell' },
    { month: 8,  quality: 'fair', label: 'Occasional pulses' },
    { month: 9,  quality: 'fair', label: 'Early fall swells' },
    { month: 10, quality: 'good', label: 'NW season returning' },
    { month: 11, quality: 'good', label: 'Consistent winter swells' },
    { month: 12, quality: 'good', label: 'Peak winter begins' },
  ],
}

// ── Keyword matching ──────────────────────────────────────────────────────────

const NORTHERN_CA_KEYWORDS = [
  'mavericks', 'half moon bay', 'pacifica', 'linda mar',
  'fort bragg', 'bodega', 'jenner', 'shelter cove',
  'mendocino', 'humboldt', 'crescent city', 'trinidad',
]

const SF_KEYWORDS = [
  'san francisco', 'ocean beach', 'baker beach', 'sf',
]

const CENTRAL_CA_KEYWORDS = [
  'santa cruz', 'capitola', 'aptos', 'moss landing',
  'monterey', 'carmel', 'big sur', 'pismo', 'shell beach',
  'avila beach', 'morro bay', 'cayucos', 'cambria',
  'central coast',
]

const SOUTHERN_CA_KEYWORDS = [
  'los angeles', 'malibu', 'venice', 'santa monica', 'redondo',
  'manhattan beach', 'hermosa', 'el segundo', 'zuma',
  'ventura', 'oxnard', 'rincon',
  'santa barbara', 'carpinteria', 'lompoc',
  'san diego', 'la jolla', 'encinitas', 'carlsbad', 'oceanside',
  'del mar', 'solana beach', 'leucadia',
  'orange county', 'huntington', 'newport', 'laguna',
  'san clemente', 'dana point', 'trestles',
]

function matchesKeywords(region: string, keywords: string[]): boolean {
  const lower = region.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

export function getSpotSeasons(region: string, _difficulty: string): SeasonData {
  if (matchesKeywords(region, SF_KEYWORDS)) return SAN_FRANCISCO
  if (matchesKeywords(region, NORTHERN_CA_KEYWORDS)) return NORTHERN_CA
  if (matchesKeywords(region, CENTRAL_CA_KEYWORDS)) return CENTRAL_CA
  if (matchesKeywords(region, SOUTHERN_CA_KEYWORDS)) return SOUTHERN_CA
  return DEFAULT_CA
}
