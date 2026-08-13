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

// ─────────────────────────────────────────────────────────────────────────────
// CALIFORNIA
// ─────────────────────────────────────────────────────────────────────────────

const NORTHERN_CA: SeasonData = {
  peakSeason: 'October – March',
  offSeason: 'June – August',
  swellSource: 'North Pacific groundswells',
  notes: 'Powerful NW groundswells from Aleutian and North Pacific storm tracks dominate fall and winter. Summer brings small, weak NW windswell with frequent fog. Spring and fall offer occasional epic days with lighter crowds.',
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
  notes: 'Ocean Beach and the SF coast pick up powerful NW swells in winter, often too big and stormy for most surfers. Fall is the sweet spot — cleaner, consistent swell with light winds. Summer is typically flat and windy.',
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
  notes: 'Santa Cruz and the Central Coast are slightly more consistent year-round than NorCal proper. The region receives NW groundswells in winter and can pick up Southern Hemisphere swells in summer that NorCal misses. Point breaks here can work on a wider range of swells.',
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
  notes: 'SoCal is uniquely positioned to receive both NW groundswells in winter and Southern Hemisphere swells in summer — making it relatively surf-able year-round. Summer S swells from NZ/Tasman storms light up beach breaks and points. Winter NW swells can be epic but are less frequent.',
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

// ─────────────────────────────────────────────────────────────────────────────
// HAWAII
// ─────────────────────────────────────────────────────────────────────────────

const HAWAII_NORTH_SHORE: SeasonData = {
  peakSeason: 'November – February',
  offSeason: 'May – August',
  swellSource: 'North Pacific groundswells',
  notes: "Oahu's North Shore is the proving ground of professional surfing. Massive NW groundswells from North Pacific storms power Pipeline, Sunset, and Waimea from November through February. The Triple Crown runs November–December. Summer turns the North Shore flat and glassy — ideal for snorkeling, not surfing.",
  months: [
    { month: 1,  quality: 'epic', label: 'Peak North Pacific groundswells' },
    { month: 2,  quality: 'epic', label: 'Consistent NW swells, Pipeline on fire' },
    { month: 3,  quality: 'good', label: 'Late season NW swells' },
    { month: 4,  quality: 'fair', label: 'Fading swells, transition' },
    { month: 5,  quality: 'poor', label: 'Flat, calm summer sets in' },
    { month: 6,  quality: 'poor', label: 'Flat, small trade windswell only' },
    { month: 7,  quality: 'poor', label: 'Flat, summer doldrums' },
    { month: 8,  quality: 'poor', label: 'Flat, occasional small S swell' },
    { month: 9,  quality: 'fair', label: 'Early season NW pulses' },
    { month: 10, quality: 'good', label: 'NW season opening, building swell' },
    { month: 11, quality: 'epic', label: 'Season peaks — Triple Crown begins' },
    { month: 12, quality: 'epic', label: 'Peak Eddie season, enormous swells' },
  ],
}

const HAWAII_SOUTH_SHORE: SeasonData = {
  peakSeason: 'May – September',
  offSeason: 'November – February',
  swellSource: 'Southern Hemisphere groundswells',
  notes: "Oahu's South Shore (Waikiki, Ala Moana, Diamond Head) comes alive with Southern Hemisphere groundswells during summer. Long-period S swells wrap around the island and provide fun, rolling waves ideal for longboards and beginners. North swells are blocked by the island in winter — this is the off season here.",
  months: [
    { month: 1,  quality: 'poor', label: 'S swells blocked, very small' },
    { month: 2,  quality: 'poor', label: 'Small and inconsistent' },
    { month: 3,  quality: 'fair', label: 'Occasional early S pulses' },
    { month: 4,  quality: 'fair', label: 'S swells begin building' },
    { month: 5,  quality: 'good', label: 'S hemi swells arrive, warm water' },
    { month: 6,  quality: 'good', label: 'Consistent S groundswells' },
    { month: 7,  quality: 'epic', label: 'Peak S hemi season' },
    { month: 8,  quality: 'epic', label: 'Strong S swells, glassy mornings' },
    { month: 9,  quality: 'good', label: 'Late S swells still firing' },
    { month: 10, quality: 'fair', label: 'S swells fading' },
    { month: 11, quality: 'poor', label: 'Transition to winter flatness' },
    { month: 12, quality: 'poor', label: 'Minimal surf on South Shore' },
  ],
}

const HAWAII_MAUI: SeasonData = {
  peakSeason: 'November – March',
  offSeason: 'May – August',
  swellSource: 'North Pacific + trade wind swell',
  notes: "Maui's North Shore (Hookipa, Jaws/Pe'ahi) receives powerful NW and N swells in winter that produce world-class big waves and windsurfing. Jaws is one of the heaviest tow-in spots on Earth, best December–February. Honolua Bay peaks November–February with perfect, long rights. Summers are smaller with trade wind swell.",
  months: [
    { month: 1,  quality: 'epic', label: 'Jaws firing, Hookipa world-class' },
    { month: 2,  quality: 'epic', label: 'Peak NW swells, Jaws season' },
    { month: 3,  quality: 'good', label: 'Strong NW swells, Honolua Bay closing' },
    { month: 4,  quality: 'fair', label: 'Transition, lighter swells' },
    { month: 5,  quality: 'poor', label: 'Small trade windswell' },
    { month: 6,  quality: 'poor', label: 'Flat, trade wind chop' },
    { month: 7,  quality: 'poor', label: 'Small, windy' },
    { month: 8,  quality: 'poor', label: 'Trade wind swell only' },
    { month: 9,  quality: 'fair', label: 'Early season NW pulses' },
    { month: 10, quality: 'good', label: 'Honolua Bay waking up' },
    { month: 11, quality: 'epic', label: 'Honolua Bay season opens' },
    { month: 12, quality: 'epic', label: 'Peak swell, Jaws potential' },
  ],
}

const HAWAII_KAUAI: SeasonData = {
  peakSeason: 'November – February',
  offSeason: 'May – August',
  swellSource: 'North Pacific groundswells + trade swell',
  notes: "Kauai's North Shore (Hanalei Bay, Tunnels, Cannons) is paradise in winter with powerful NW groundswells. The Garden Isle is more remote and less crowded than Oahu. South Shore breaks like Pakala work on summer S swells. Kauai's exposed position picks up more swell than any other Hawaiian island.",
  months: [
    { month: 1,  quality: 'epic', label: 'Powerful NW groundswells, Hanalei Bay' },
    { month: 2,  quality: 'epic', label: 'Consistent North Shore swell' },
    { month: 3,  quality: 'good', label: 'Late season NW swells' },
    { month: 4,  quality: 'fair', label: 'Transition, fading NW' },
    { month: 5,  quality: 'poor', label: 'Small, trade windswell' },
    { month: 6,  quality: 'poor', label: 'Flat summer, snorkeling season' },
    { month: 7,  quality: 'poor', label: 'Minimal surf' },
    { month: 8,  quality: 'fair', label: 'Occasional S pulses at south breaks' },
    { month: 9,  quality: 'fair', label: 'Early NW season' },
    { month: 10, quality: 'good', label: 'NW swells arriving' },
    { month: 11, quality: 'epic', label: 'North Shore season opens' },
    { month: 12, quality: 'epic', label: 'Peak Hanalei Bay conditions' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// PACIFIC NORTHWEST & ALASKA
// ─────────────────────────────────────────────────────────────────────────────

const PACIFIC_NORTHWEST: SeasonData = {
  peakSeason: 'October – March',
  offSeason: 'June – August',
  swellSource: 'North Pacific groundswells',
  notes: 'Oregon and Washington receive some of the most powerful surf in North America. Winter NW groundswells produce heavy beach and reef breaks — often too big and stormy for average surfers. Fall is the sweet spot with solid, cleaner swells. Water is cold year-round (50–55°F) requiring a 4/3 or 5/4 wetsuit.',
  months: [
    { month: 1,  quality: 'epic', label: 'Massive winter NW swells, stormy' },
    { month: 2,  quality: 'epic', label: 'Powerful NW groundswells' },
    { month: 3,  quality: 'good', label: 'Solid swells, occasional breaks' },
    { month: 4,  quality: 'fair', label: 'Fading winter swells' },
    { month: 5,  quality: 'fair', label: 'Mixed NW windswell' },
    { month: 6,  quality: 'poor', label: 'Small summer, onshore winds' },
    { month: 7,  quality: 'poor', label: 'Flat, foggy conditions' },
    { month: 8,  quality: 'poor', label: 'Small, inconsistent' },
    { month: 9,  quality: 'fair', label: 'Early fall NW swells' },
    { month: 10, quality: 'good', label: 'Season opening, quality swells' },
    { month: 11, quality: 'epic', label: 'Consistent winter swells begin' },
    { month: 12, quality: 'epic', label: 'Peak season — powerful and raw' },
  ],
}

const ALASKA: SeasonData = {
  peakSeason: 'September – February',
  offSeason: 'May – July',
  swellSource: 'North Pacific storm swells',
  notes: "Alaska's surf is centered around massive North Pacific storms generating enormous long-period swells. Yakutat is the most accessible destination. A drysuit or 6mm wetsuit with hood, gloves, and booties is essential year-round — water is 38–45°F. Fall (September–November) offers the best balance of swell size and daylight.",
  months: [
    { month: 1,  quality: 'good', label: 'Powerful swells, extreme cold, short days' },
    { month: 2,  quality: 'good', label: 'Consistent N Pacific swells' },
    { month: 3,  quality: 'fair', label: 'Waning winter swells' },
    { month: 4,  quality: 'fair', label: 'Transition season' },
    { month: 5,  quality: 'poor', label: 'Small, calm spring' },
    { month: 6,  quality: 'poor', label: 'Flat, windy summer' },
    { month: 7,  quality: 'poor', label: 'Minimal swell' },
    { month: 8,  quality: 'fair', label: 'Early storm season building' },
    { month: 9,  quality: 'epic', label: 'Prime fall — size + light + cleaner' },
    { month: 10, quality: 'epic', label: 'Biggest swells of the year' },
    { month: 11, quality: 'good', label: 'Consistent powerful swells' },
    { month: 12, quality: 'good', label: 'Peak storm season, extreme cold' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// EAST COAST USA
// ─────────────────────────────────────────────────────────────────────────────

const EAST_COAST_NEW_ENGLAND: SeasonData = {
  peakSeason: 'September – February',
  offSeason: 'May – July',
  swellSource: "NE storm swells + hurricane groundswells",
  notes: "New England surf is driven by powerful Nor'easters in fall and winter that create punchy, often hollow beach breaks. Late summer (August–October) can be epic during hurricane season. Water drops to 34–40°F in winter — a 6mm wetsuit with hood, gloves, and booties is required.",
  months: [
    { month: 1,  quality: 'good', label: "Nor'easter swells, frigid water" },
    { month: 2,  quality: 'good', label: 'Consistent NE storm swells' },
    { month: 3,  quality: 'fair', label: 'Fading winter, spring transition' },
    { month: 4,  quality: 'fair', label: 'Inconsistent spring swells' },
    { month: 5,  quality: 'poor', label: 'Small, flat spring' },
    { month: 6,  quality: 'poor', label: 'Small summer, crowded beaches' },
    { month: 7,  quality: 'poor', label: 'Typically flat, warm water' },
    { month: 8,  quality: 'fair', label: 'Hurricane groundswells possible' },
    { month: 9,  quality: 'epic', label: 'Prime — hurricane swell + clean winds' },
    { month: 10, quality: 'epic', label: "Nor'easters begin, powerful surf" },
    { month: 11, quality: 'good', label: 'Consistent NE storm surf' },
    { month: 12, quality: 'good', label: 'Solid winter swells' },
  ],
}

const EAST_COAST_MID_ATLANTIC: SeasonData = {
  peakSeason: 'August – January',
  offSeason: 'April – June',
  swellSource: 'Hurricane groundswells + NE storm swells',
  notes: "New York, New Jersey, and the Mid-Atlantic hit their stride from late summer through early winter. Hurricane groundswells from August–October can produce some of the best surf on the East Coast. Winter Nor'easters provide consistent, punchy surf. Water ranges from 75°F in summer to 35°F in winter.",
  months: [
    { month: 1,  quality: 'good', label: "Nor'easter swells, very cold" },
    { month: 2,  quality: 'fair', label: 'Inconsistent winter swells' },
    { month: 3,  quality: 'fair', label: 'Spring transition, light surf' },
    { month: 4,  quality: 'poor', label: 'Small, inconsistent' },
    { month: 5,  quality: 'poor', label: 'Flat spring' },
    { month: 6,  quality: 'poor', label: 'Small summer, onshore winds' },
    { month: 7,  quality: 'fair', label: 'Small fun waves, warm water' },
    { month: 8,  quality: 'good', label: 'Hurricane swells begin' },
    { month: 9,  quality: 'epic', label: 'Peak hurricane season — potential for epic surf' },
    { month: 10, quality: 'epic', label: "Hurricane + Nor'easter crossover season" },
    { month: 11, quality: 'good', label: 'NE storms consistent and powerful' },
    { month: 12, quality: 'good', label: 'Solid winter swell, cold water' },
  ],
}

const EAST_COAST_CAROLINAS: SeasonData = {
  peakSeason: 'August – November',
  offSeason: 'April – June',
  swellSource: 'Hurricane groundswells + NE storm swells',
  notes: 'North and South Carolina are prime hurricane swell territory. The Outer Banks juts far into the Atlantic, intercepting long-period swell from storms hundreds of miles offshore. Late summer and fall (August–November) is peak season. Water is warmer than New England — 75°F summer, 45°F winter.',
  months: [
    { month: 1,  quality: 'fair', label: 'NE storm swells, cold but less crowded' },
    { month: 2,  quality: 'fair', label: 'Inconsistent winter swells' },
    { month: 3,  quality: 'fair', label: 'Spring transition' },
    { month: 4,  quality: 'poor', label: 'Small, inconsistent' },
    { month: 5,  quality: 'poor', label: 'Flat spring' },
    { month: 6,  quality: 'poor', label: 'Small summer, warm water' },
    { month: 7,  quality: 'fair', label: 'Small fun surf, occasional S swell' },
    { month: 8,  quality: 'good', label: 'Hurricane season begins' },
    { month: 9,  quality: 'epic', label: 'Peak hurricane groundswells' },
    { month: 10, quality: 'epic', label: 'Late hurricane season + NE storms' },
    { month: 11, quality: 'good', label: 'Consistent NE swell, cooler' },
    { month: 12, quality: 'fair', label: 'Winter NE swells, cold' },
  ],
}

const EAST_COAST_FLORIDA: SeasonData = {
  peakSeason: 'September – November',
  offSeason: 'February – May',
  swellSource: 'Hurricane groundswells + Atlantic storm swells',
  notes: "Florida's Atlantic coast (Space Coast, Sebastian Inlet, New Smyrna Beach) gets consistent small waves year-round averaging 2–4ft, with hurricane groundswells (August–November) producing the biggest and best surf. Sebastian Inlet is the crown jewel — a tidal pass that concentrates energy into hollow, fast waves. Water stays warm (72–82°F) year-round.",
  months: [
    { month: 1,  quality: 'fair', label: 'Small Atlantic swells, cold fronts help' },
    { month: 2,  quality: 'fair', label: 'Inconsistent, small' },
    { month: 3,  quality: 'poor', label: 'Spring flat spell begins' },
    { month: 4,  quality: 'poor', label: 'Small, inconsistent' },
    { month: 5,  quality: 'poor', label: 'Flat season' },
    { month: 6,  quality: 'fair', label: 'Small waves, start of hurricane season' },
    { month: 7,  quality: 'fair', label: 'Small fun surf, warm water' },
    { month: 8,  quality: 'good', label: 'Hurricane swells possible' },
    { month: 9,  quality: 'epic', label: 'Peak hurricane season, best surf of year' },
    { month: 10, quality: 'epic', label: 'Late hurricane season + N Atlantic swells' },
    { month: 11, quality: 'good', label: 'Consistent Atlantic storm swells' },
    { month: 12, quality: 'fair', label: 'Cold fronts generate small swells' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// MEXICO & CENTRAL AMERICA
// ─────────────────────────────────────────────────────────────────────────────

const MEXICO_BAJA: SeasonData = {
  peakSeason: 'October – April',
  offSeason: 'June – August',
  swellSource: 'North Pacific groundswells + Southern Hemisphere swells',
  notes: 'Baja California receives the same North Pacific groundswells as Southern California, producing quality point and reef breaks along its rugged coastline. Classic road-trip breaks like San Miguel and Todos Santos offer world-class waves in an uncrowded setting. Also picks up S hemisphere swells in summer.',
  months: [
    { month: 1,  quality: 'good', label: 'NW groundswells, mild weather' },
    { month: 2,  quality: 'good', label: 'Consistent NW swells' },
    { month: 3,  quality: 'good', label: 'Solid NW, beautiful conditions' },
    { month: 4,  quality: 'fair', label: 'Transition, lighter swells' },
    { month: 5,  quality: 'fair', label: 'S hemi swells beginning' },
    { month: 6,  quality: 'poor', label: 'Small, hot, onshore' },
    { month: 7,  quality: 'poor', label: 'Hurricane swell possible' },
    { month: 8,  quality: 'fair', label: 'S swell + hurricane potential' },
    { month: 9,  quality: 'fair', label: 'Late summer, hurricane swell' },
    { month: 10, quality: 'good', label: 'NW season opens, fewer crowds' },
    { month: 11, quality: 'epic', label: 'Peak NW groundswells arrive' },
    { month: 12, quality: 'epic', label: 'Consistent NW groundswells' },
  ],
}

const MEXICO_PACIFIC_MAINLAND: SeasonData = {
  peakSeason: 'April – October',
  offSeason: 'December – February',
  swellSource: 'Southern Hemisphere groundswells + tropical storm swells',
  notes: "Mexico's Pacific mainland (Nayarit, Guerrero, Oaxaca) is one of the world's premier surf destinations. Puerto Escondido — the 'Mexican Pipeline' — produces arguably the heaviest shorebreak barrel on Earth when big S hemisphere swells arrive in June–August. Warm water (80–85°F), perfect barrels, and uncrowded lineups in shoulder months.",
  months: [
    { month: 1,  quality: 'fair', label: 'Small, dry season, light NW swells' },
    { month: 2,  quality: 'fair', label: 'Small, clean conditions' },
    { month: 3,  quality: 'fair', label: 'S hemi swells beginning' },
    { month: 4,  quality: 'good', label: 'S swells building, warm water' },
    { month: 5,  quality: 'good', label: 'Consistent S swell + tropical energy' },
    { month: 6,  quality: 'epic', label: 'Puerto Escondido fires — huge S swells' },
    { month: 7,  quality: 'epic', label: 'Peak S hemi season, Zicatela at its best' },
    { month: 8,  quality: 'epic', label: 'Powerful S swells + tropical storms' },
    { month: 9,  quality: 'good', label: 'Late S swells + hurricane potential' },
    { month: 10, quality: 'good', label: 'Late season swells, fewer crowds' },
    { month: 11, quality: 'fair', label: 'Season winding down' },
    { month: 12, quality: 'fair', label: 'Small, dry season begins' },
  ],
}

const CENTRAL_AMERICA: SeasonData = {
  peakSeason: 'April – October',
  offSeason: 'December – February',
  swellSource: 'Southern Hemisphere groundswells + tropical swells',
  notes: "Costa Rica, El Salvador, Nicaragua, and Panama receive consistent Southern Hemisphere swells that peel off world-class point and beach breaks. Pavones (Costa Rica) is one of the world's longest left-hand waves. Punta Roca (El Salvador) and Popoyo (Nicaragua) are highly regarded. Warm water (80–85°F) year-round.",
  months: [
    { month: 1,  quality: 'fair', label: 'Dry season, consistent small swells' },
    { month: 2,  quality: 'fair', label: 'Small but clean, offshore winds' },
    { month: 3,  quality: 'good', label: 'S swells building, perfect conditions' },
    { month: 4,  quality: 'good', label: 'Strong S swells, Pavones firing' },
    { month: 5,  quality: 'good', label: 'Consistent S hemi energy' },
    { month: 6,  quality: 'epic', label: 'Big S swells, world-class surf' },
    { month: 7,  quality: 'epic', label: 'Peak season, powerful and consistent' },
    { month: 8,  quality: 'epic', label: 'Peak S hemi swells + tropical energy' },
    { month: 9,  quality: 'good', label: 'Late season swells' },
    { month: 10, quality: 'good', label: 'Good surf, fewer crowds' },
    { month: 11, quality: 'fair', label: 'Season tapering' },
    { month: 12, quality: 'fair', label: 'Small, clean dry season begins' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUTH AMERICA
// ─────────────────────────────────────────────────────────────────────────────

const SOUTH_AMERICA_PACIFIC: SeasonData = {
  peakSeason: 'March – October',
  offSeason: 'December – February',
  swellSource: 'Southern Hemisphere groundswells (Roaring Forties)',
  notes: "Peru and Chile receive powerful, long-period swells from storms in the Roaring Forties. Chicama (Peru) is the world's longest left-hand point break, stretching nearly 4km. Pico Alto and Punta de Lobos host big-wave events. Cold Humboldt Current keeps water at 59–68°F — a 3/2 wetsuit is typical.",
  months: [
    { month: 1,  quality: 'fair', label: 'Summer, lighter S swells' },
    { month: 2,  quality: 'fair', label: 'Small to moderate swells' },
    { month: 3,  quality: 'good', label: 'S hemi autumn swell building' },
    { month: 4,  quality: 'good', label: 'Consistent powerful S groundswells' },
    { month: 5,  quality: 'epic', label: 'Chicama and Pichilemu firing' },
    { month: 6,  quality: 'epic', label: 'Peak S hemisphere winter swells' },
    { month: 7,  quality: 'epic', label: 'Biggest swells of the year' },
    { month: 8,  quality: 'epic', label: 'Powerful consistent groundswells' },
    { month: 9,  quality: 'good', label: 'Late season swells' },
    { month: 10, quality: 'good', label: 'Solid autumn swells continue' },
    { month: 11, quality: 'fair', label: 'Spring transition, lighter swells' },
    { month: 12, quality: 'fair', label: 'Summer begins, smaller surf' },
  ],
}

const BRAZIL: SeasonData = {
  peakSeason: 'March – August',
  offSeason: 'October – December',
  swellSource: 'South Atlantic swells + NE trade swells',
  notes: "Brazil's surf scene stretches from Saquarema (RJ) to Fernando de Noronha and Jericoacoara. The southeastern coast receives the best S and SE swells from Southern Ocean storms during autumn and winter. Fernando de Noronha peaks May–August with epic, powerful waves. Water is warm (72–82°F) in most regions year-round.",
  months: [
    { month: 1,  quality: 'fair', label: 'Summer, inconsistent swells, crowded' },
    { month: 2,  quality: 'fair', label: 'Small summer surf' },
    { month: 3,  quality: 'good', label: 'Autumn — S swells begin arriving' },
    { month: 4,  quality: 'good', label: 'Consistent S and SE swells' },
    { month: 5,  quality: 'epic', label: 'Fernando de Noronha peak season' },
    { month: 6,  quality: 'epic', label: 'Best surf of the year, S hemi winter' },
    { month: 7,  quality: 'epic', label: 'Peak groundswells, offshore winds' },
    { month: 8,  quality: 'good', label: 'Solid swells, trade wind surf' },
    { month: 9,  quality: 'fair', label: 'Spring transition, fading swells' },
    { month: 10, quality: 'poor', label: 'Low swell, spring calm' },
    { month: 11, quality: 'poor', label: 'Small, summer approaching' },
    { month: 12, quality: 'fair', label: 'Transition, occasional SE swells' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// EUROPE – ATLANTIC
// ─────────────────────────────────────────────────────────────────────────────

const PORTUGAL: SeasonData = {
  peakSeason: 'October – April',
  offSeason: 'June – August',
  swellSource: 'North Atlantic groundswells',
  notes: "Portugal is Europe's surf capital. Nazare's canyon amplifies NW Atlantic swells into some of the largest rideable waves on Earth (November–February). Ericeira is a World Surfing Reserve. Supertubos at Peniche is one of Europe's best beach breaks. Surf-able year-round, but October–April is peak for size and quality. Water is 57–65°F in winter.",
  months: [
    { month: 1,  quality: 'epic', label: 'Nazare giant swells, WSL events' },
    { month: 2,  quality: 'epic', label: 'Powerful NW Atlantic swells' },
    { month: 3,  quality: 'good', label: 'Strong swells, cleaner conditions' },
    { month: 4,  quality: 'good', label: 'Solid spring swells, lighter crowds' },
    { month: 5,  quality: 'fair', label: 'Transition, fading swells' },
    { month: 6,  quality: 'poor', label: 'Small summer, N trade winds onshore' },
    { month: 7,  quality: 'poor', label: 'Small, windy (Nortada trade winds)' },
    { month: 8,  quality: 'poor', label: 'Small summer surf' },
    { month: 9,  quality: 'fair', label: 'Early autumn swell season opens' },
    { month: 10, quality: 'good', label: 'NW swells consistent and clean' },
    { month: 11, quality: 'epic', label: 'Peak season — Nazare on fire' },
    { month: 12, quality: 'epic', label: 'Big NW swells, epic beach breaks' },
  ],
}

const SPAIN_FRANCE_BAY_OF_BISCAY: SeasonData = {
  peakSeason: 'September – April',
  offSeason: 'June – July',
  swellSource: 'North Atlantic groundswells (Bay of Biscay)',
  notes: "The Bay of Biscay funnels powerful North Atlantic swells onto some of Europe's best beach and reef breaks. Hossegor (France) and Mundaka (Spain) are two of the world's best waves, hosting the WSL Championship Tour. Hossegor's beach break is known for explosively hollow barrels — best September–November. Water is cool: 53–63°F.",
  months: [
    { month: 1,  quality: 'good', label: 'Powerful Atlantic swells, cold and stormy' },
    { month: 2,  quality: 'good', label: 'Consistent NW swells' },
    { month: 3,  quality: 'good', label: 'Spring swells, cleaner days possible' },
    { month: 4,  quality: 'fair', label: 'Lighter swells, spring transition' },
    { month: 5,  quality: 'fair', label: 'Mixed conditions' },
    { month: 6,  quality: 'poor', label: 'Small summer, onshore winds' },
    { month: 7,  quality: 'poor', label: 'Flat, crowded beaches' },
    { month: 8,  quality: 'fair', label: 'Some early Atlantic swells' },
    { month: 9,  quality: 'epic', label: 'Hossegor fires — WSL event season' },
    { month: 10, quality: 'epic', label: 'Peak season, most consistent' },
    { month: 11, quality: 'good', label: 'Strong NW swells, Mundaka firing' },
    { month: 12, quality: 'good', label: 'Powerful Atlantic winter swells' },
  ],
}

const IRELAND_UK: SeasonData = {
  peakSeason: 'September – March',
  offSeason: 'May – July',
  swellSource: 'North Atlantic groundswells',
  notes: "Ireland and the UK are raw and powerful. The Wild Atlantic Way and Scotland's reef breaks come alive when North Atlantic depressions send massive groundswells to exposed coastlines. Bundoran (Ireland) is the surf capital of Ireland; Thurso East (Scotland) is the best right-hand reef in Europe. Water is 43–58°F — full winter suit required most of the year.",
  months: [
    { month: 1,  quality: 'epic', label: 'Massive NW Atlantic swells, cold and raw' },
    { month: 2,  quality: 'epic', label: 'Peak swell season, powerful and consistent' },
    { month: 3,  quality: 'good', label: 'Strong swells, slightly improving conditions' },
    { month: 4,  quality: 'fair', label: 'Fading winter, spring swells' },
    { month: 5,  quality: 'fair', label: 'Lighter swells, cleaner windows' },
    { month: 6,  quality: 'poor', label: 'Small summer, some fun beach break' },
    { month: 7,  quality: 'poor', label: 'Small, inconsistent, long daylight' },
    { month: 8,  quality: 'fair', label: 'Early season NW swells arriving' },
    { month: 9,  quality: 'good', label: 'Autumn — quality swells return' },
    { month: 10, quality: 'epic', label: 'Peak autumn swells, Thurso and Bundoran fire' },
    { month: 11, quality: 'epic', label: 'Consistent powerful groundswells' },
    { month: 12, quality: 'good', label: 'Winter swells, challenging conditions' },
  ],
}

const MOROCCO: SeasonData = {
  peakSeason: 'October – April',
  offSeason: 'June – August',
  swellSource: 'North Atlantic groundswells',
  notes: "Morocco's Atlantic coast — Taghazout, Anchor Point, and Imsouane — offers some of the best point break surf in the world. The Taghazout area has a cluster of right-hand points that work on long-period NW Atlantic swells. Pleasant warm climate even in winter (65–75°F air temp). Water is 63–68°F. Crowd levels are much lower than European surf hubs.",
  months: [
    { month: 1,  quality: 'epic', label: 'Anchor Point and Killers firing, consistent' },
    { month: 2,  quality: 'epic', label: 'Best NW swells of the year' },
    { month: 3,  quality: 'good', label: 'Solid swells, warm sunny days' },
    { month: 4,  quality: 'good', label: 'Good NW swells, lighter crowds' },
    { month: 5,  quality: 'fair', label: 'Lighter swells, spring transition' },
    { month: 6,  quality: 'poor', label: 'Small, Alize trade winds onshore' },
    { month: 7,  quality: 'poor', label: 'Flat, hot, strong N winds' },
    { month: 8,  quality: 'poor', label: 'Small, windy summer' },
    { month: 9,  quality: 'fair', label: 'Swells returning, less wind' },
    { month: 10, quality: 'good', label: 'Season opening, quality surf returns' },
    { month: 11, quality: 'epic', label: 'Consistent NW groundswells' },
    { month: 12, quality: 'epic', label: 'Peak winter swell, iconic point breaks' },
  ],
}

const CANARY_ISLANDS: SeasonData = {
  peakSeason: 'October – March',
  offSeason: 'June – August',
  swellSource: 'North Atlantic groundswells + trade wind swell',
  notes: "The Canary Islands (Fuerteventura, Lanzarote, Gran Canaria, Tenerife) enjoy a year-round surf season off the West African coast. Fuerteventura's right-hand points and Lanzarote's El Quemao are iconic. Peak season October–March brings powerful NW Atlantic groundswells. Water stays warm (65–72°F) all year — a 3/2 wetsuit is sufficient even in winter.",
  months: [
    { month: 1,  quality: 'epic', label: 'Powerful NW groundswells, consistent' },
    { month: 2,  quality: 'epic', label: 'Best of the winter swell season' },
    { month: 3,  quality: 'good', label: 'Solid NW swells, warm weather' },
    { month: 4,  quality: 'good', label: 'Good surf, trade wind swell' },
    { month: 5,  quality: 'fair', label: 'Lighter swells, spring transition' },
    { month: 6,  quality: 'fair', label: 'Small, trade swell only' },
    { month: 7,  quality: 'poor', label: 'Small summer, trade winds messy' },
    { month: 8,  quality: 'poor', label: 'Small and choppy' },
    { month: 9,  quality: 'fair', label: 'Early autumn swells returning' },
    { month: 10, quality: 'good', label: 'NW groundswells arrive' },
    { month: 11, quality: 'epic', label: 'Consistent powerful groundswells' },
    { month: 12, quality: 'epic', label: 'Peak swell season' },
  ],
}

const MEDITERRANEAN: SeasonData = {
  peakSeason: 'November – March',
  offSeason: 'May – September',
  swellSource: 'Mediterranean storm swells (Tramontane, Mistral, Gregale)',
  notes: "The Mediterranean produces rideable waves when powerful local wind-storms (Mistral in France, Tramontane in Spain, Gregale in Sicily) generate short-period swells. Tarifa at the Strait of Gibraltar intercepts Atlantic swell. Surf windows are short and unpredictable — not a primary surf destination. Summer is typically flat.",
  months: [
    { month: 1,  quality: 'good', label: 'Mistral and Tramontane generate swells' },
    { month: 2,  quality: 'good', label: 'Consistent storm-generated swell' },
    { month: 3,  quality: 'fair', label: 'Occasional spring storms' },
    { month: 4,  quality: 'poor', label: 'Small, inconsistent' },
    { month: 5,  quality: 'poor', label: 'Mostly flat, summer approaching' },
    { month: 6,  quality: 'poor', label: 'Flat summer' },
    { month: 7,  quality: 'poor', label: 'Flat, crowded with tourists' },
    { month: 8,  quality: 'poor', label: 'Flat' },
    { month: 9,  quality: 'poor', label: 'Still mostly flat' },
    { month: 10, quality: 'fair', label: 'Autumn storms begin' },
    { month: 11, quality: 'good', label: 'Storm season begins, best swells' },
    { month: 12, quality: 'good', label: 'Cold storms generate quality surf' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// AUSTRALIA
// ─────────────────────────────────────────────────────────────────────────────

const AUSTRALIA_QUEENSLAND: SeasonData = {
  peakSeason: 'February – August',
  offSeason: 'October – December',
  swellSource: 'South Pacific groundswells + cyclone swells',
  notes: "Queensland's Gold Coast (Snapper Rocks, Kirra, Burleigh Heads) and Noosa are world-class destinations. The Superbank can produce 2km-long right-handers when SE swell and north winds align. Cyclone season (January–April) generates powerful groundswells. SE trade winds blow offshore from April to October. Water is warm (68–78°F) year-round.",
  months: [
    { month: 1,  quality: 'fair', label: 'Cyclone swell possible, onshore winds' },
    { month: 2,  quality: 'good', label: 'Cyclone groundswells, Superbank firing' },
    { month: 3,  quality: 'good', label: 'Late cyclone season, powerful surf' },
    { month: 4,  quality: 'epic', label: 'Trade winds offshore — perfect conditions' },
    { month: 5,  quality: 'epic', label: 'SE swells + SE trade winds = glassy barrels' },
    { month: 6,  quality: 'epic', label: 'Peak season — consistent, powerful, offshore' },
    { month: 7,  quality: 'epic', label: 'Best month — Kirra and Snapper fire' },
    { month: 8,  quality: 'good', label: 'Solid SE swells, offshore conditions' },
    { month: 9,  quality: 'good', label: 'SE swells continue' },
    { month: 10, quality: 'fair', label: 'Transition, lighter swells' },
    { month: 11, quality: 'fair', label: 'Spring, small and inconsistent' },
    { month: 12, quality: 'fair', label: 'Summer begins, onshore winds' },
  ],
}

const AUSTRALIA_NSW: SeasonData = {
  peakSeason: 'March – September',
  offSeason: 'November – January',
  swellSource: 'Tasman Sea groundswells + Southern Ocean swells',
  notes: "New South Wales (Byron Bay, Newcastle, Sydney, Wollongong) receives a wide variety of swell from the Tasman Sea and Southern Ocean. Cyclone-generated groundswells (Feb–Apr) can produce epic sand bars. SE swells from Southern Ocean depressions dominate May–August. Sydney's Northern Beaches (Manly, Narrabeen) are the most famous. Water is warm year-round (64–74°F).",
  months: [
    { month: 1,  quality: 'fair', label: 'Summer, small and onshore' },
    { month: 2,  quality: 'good', label: 'Cyclone groundswells possible' },
    { month: 3,  quality: 'good', label: 'Cyclone swells, quality surf' },
    { month: 4,  quality: 'epic', label: 'Autumn — SE swells build, offshore mornings' },
    { month: 5,  quality: 'epic', label: 'Consistent powerful SE groundswells' },
    { month: 6,  quality: 'epic', label: 'Peak Southern Ocean swells' },
    { month: 7,  quality: 'good', label: 'Consistent SE swells, offshore winds' },
    { month: 8,  quality: 'good', label: 'Good SE groundswells' },
    { month: 9,  quality: 'fair', label: 'Spring transition, fading swells' },
    { month: 10, quality: 'fair', label: 'Mixed swells, inconsistent' },
    { month: 11, quality: 'poor', label: 'Small summer approaching' },
    { month: 12, quality: 'poor', label: 'Small and onshore' },
  ],
}

const AUSTRALIA_VICTORIA: SeasonData = {
  peakSeason: 'April – September',
  offSeason: 'November – January',
  swellSource: 'Southern Ocean groundswells',
  notes: "Victoria's Surf Coast (Bells Beach, Jan Juc, Winki Pop) faces the raw power of the Southern Ocean. Bells Beach is one of the world's most legendary surf spots, hosting the Rip Curl Pro every Easter (April). Massive swells from Antarctic storms roll in unimpeded. Water is cold year-round (55–63°F) — a 4/3 or 5/4 wetsuit is standard.",
  months: [
    { month: 1,  quality: 'fair', label: 'Summer, smaller swells, warm days' },
    { month: 2,  quality: 'fair', label: 'Mixed S swells, transition' },
    { month: 3,  quality: 'good', label: 'Autumn swell building' },
    { month: 4,  quality: 'epic', label: 'Bells Beach Pro — peak conditions' },
    { month: 5,  quality: 'epic', label: 'Powerful Southern Ocean groundswells' },
    { month: 6,  quality: 'epic', label: 'Peak winter swells, massive and hollow' },
    { month: 7,  quality: 'epic', label: 'Biggest swells of the year' },
    { month: 8,  quality: 'good', label: 'Consistent powerful swells' },
    { month: 9,  quality: 'good', label: 'Solid winter/spring swells' },
    { month: 10, quality: 'fair', label: 'Spring transition, smaller swells' },
    { month: 11, quality: 'poor', label: 'Small, onshore winds' },
    { month: 12, quality: 'fair', label: 'Mixed swells, warm weather' },
  ],
}

const AUSTRALIA_WESTERN: SeasonData = {
  peakSeason: 'April – October',
  offSeason: 'December – February',
  swellSource: 'Southern Ocean + Indian Ocean groundswells',
  notes: "Western Australia's Margaret River region is one of the most powerful and consistent surfing destinations on Earth. The Box, Surfers Point, and Bombies are world-class waves that can hold swells up to 20ft+. The Indian Ocean delivers massive S and SW groundswells from the Roaring Forties. Water is cold (60–68°F) despite the sunny climate. Annual WSL event held in April.",
  months: [
    { month: 1,  quality: 'fair', label: 'Summer, smaller and onshore' },
    { month: 2,  quality: 'fair', label: 'Transition, occasional S swells' },
    { month: 3,  quality: 'good', label: 'Autumn swell building' },
    { month: 4,  quality: 'epic', label: 'Margaret River Pro — peak conditions' },
    { month: 5,  quality: 'epic', label: 'Powerful S swells, offshore winds' },
    { month: 6,  quality: 'epic', label: 'Peak winter swells, The Box on fire' },
    { month: 7,  quality: 'epic', label: 'Biggest Indian Ocean swells' },
    { month: 8,  quality: 'good', label: 'Consistent powerful swells' },
    { month: 9,  quality: 'good', label: 'Good swells continue' },
    { month: 10, quality: 'fair', label: 'Swells tapering, spring transition' },
    { month: 11, quality: 'poor', label: 'Small, hot, onshore Fremantle Doctor' },
    { month: 12, quality: 'poor', label: 'Small summer surf' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW ZEALAND
// ─────────────────────────────────────────────────────────────────────────────

const NEW_ZEALAND: SeasonData = {
  peakSeason: 'March – September',
  offSeason: 'November – January',
  swellSource: 'Southern Ocean groundswells + Tasman Sea swells',
  notes: "New Zealand is a surfer's paradise with uncrowded waves and dramatic scenery. Raglan's perfectly peeling left-hand point break is world-famous and can hold swell from 2–15ft. The North Island's west coast picks up powerful SW swells from the Tasman. Autumn and winter bring the best conditions. Water is cold (55–65°F) — a 4/3 or 5/4 wetsuit is standard.",
  months: [
    { month: 1,  quality: 'fair', label: 'Summer, smaller Tasman swells' },
    { month: 2,  quality: 'fair', label: 'Occasional large swells possible' },
    { month: 3,  quality: 'good', label: 'Autumn — Southern Ocean swells building' },
    { month: 4,  quality: 'epic', label: 'Raglan firing, powerful groundswells' },
    { month: 5,  quality: 'epic', label: 'Best winter swells arrive' },
    { month: 6,  quality: 'epic', label: 'Peak season — consistent and powerful' },
    { month: 7,  quality: 'good', label: 'Solid winter swells' },
    { month: 8,  quality: 'good', label: 'Good consistent swell' },
    { month: 9,  quality: 'fair', label: 'Late winter / spring transition' },
    { month: 10, quality: 'fair', label: 'Mixed swells, lighter winds' },
    { month: 11, quality: 'poor', label: 'Small, spring to summer transition' },
    { month: 12, quality: 'poor', label: 'Summer, small and inconsistent' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// PACIFIC ISLANDS
// ─────────────────────────────────────────────────────────────────────────────

const PACIFIC_ISLANDS: SeasonData = {
  peakSeason: 'April – October',
  offSeason: 'December – February',
  swellSource: 'Southern Hemisphere groundswells',
  notes: "Fiji, Tahiti, and the South Pacific islands receive powerful Southern Hemisphere groundswells producing some of the most spectacular reef breaks on Earth. Cloudbreak (Fiji) and Teahupoo (Tahiti) are among the heaviest waves in the world — Teahupoo hosts the WSL Championship Tour annually. Peak season April–October when Antarctic storms generate long-period S/SW swells. Water is warm (80–84°F) year-round.",
  months: [
    { month: 1,  quality: 'poor', label: 'Cyclone season, inconsistent swells' },
    { month: 2,  quality: 'poor', label: 'Cyclone risk, unsettled conditions' },
    { month: 3,  quality: 'fair', label: 'Transition — early S swells' },
    { month: 4,  quality: 'good', label: 'S swells building, peak season begins' },
    { month: 5,  quality: 'epic', label: 'Teahupoo and Cloudbreak firing' },
    { month: 6,  quality: 'epic', label: 'WSL Tahiti event — massive S swells' },
    { month: 7,  quality: 'epic', label: 'Peak S hemi groundswells' },
    { month: 8,  quality: 'epic', label: 'Consistent powerful swells' },
    { month: 9,  quality: 'good', label: 'Solid swells continue' },
    { month: 10, quality: 'good', label: 'Late season swells' },
    { month: 11, quality: 'fair', label: 'Swells tapering' },
    { month: 12, quality: 'poor', label: 'Cyclone season begins, smaller swells' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// INDONESIA & SOUTHEAST ASIA
// ─────────────────────────────────────────────────────────────────────────────

const BALI_INDONESIA: SeasonData = {
  peakSeason: 'April – October',
  offSeason: 'December – February',
  swellSource: 'Indian Ocean groundswells (Southern Hemisphere)',
  notes: "Bali is the world's most popular surf travel destination. The island's south- and southwest-facing reefs — Uluwatu, Padang Padang, Keramas, Canggu — light up when Indian Ocean groundswells arrive from April through October. This coincides with Bali's dry season: sunny skies, offshore morning winds, and warm water (80–84°F). The wet season (November–March) brings onshore SW monsoon winds and smaller, messier surf.",
  months: [
    { month: 1,  quality: 'poor', label: 'SW monsoon, onshore, wet season' },
    { month: 2,  quality: 'poor', label: 'Onshore winds, inconsistent swell' },
    { month: 3,  quality: 'fair', label: 'Transition — early dry season' },
    { month: 4,  quality: 'good', label: 'Dry season begins, S swells arrive' },
    { month: 5,  quality: 'epic', label: 'Uluwatu and Padang firing' },
    { month: 6,  quality: 'epic', label: 'Peak dry season — offshore winds, big swell' },
    { month: 7,  quality: 'epic', label: 'Best month — powerful and consistent' },
    { month: 8,  quality: 'epic', label: 'Peak season continues, offshore mornings' },
    { month: 9,  quality: 'good', label: 'Good swells, dry season closing' },
    { month: 10, quality: 'good', label: 'Last of the S swells' },
    { month: 11, quality: 'fair', label: 'Wet season approaching, lighter swell' },
    { month: 12, quality: 'poor', label: 'SW monsoon, onshore, wet season' },
  ],
}

const MENTAWAI_ISLANDS: SeasonData = {
  peakSeason: 'April – October',
  offSeason: 'December – February',
  swellSource: 'Indian Ocean groundswells',
  notes: "The Mentawai Islands (Sumatra, Indonesia) are widely considered the world's best surfing archipelago per square mile. Spots like Lance's Right, Macaroni's, Rifles, and Bank Vaults offer perfect, powerful waves over shallow reef. Peak season April–October coincides with the SW monsoon offshore conditions. A surf charter or resort is the only way to access most breaks. Water is 82–84°F year-round.",
  months: [
    { month: 1,  quality: 'poor', label: 'NW monsoon, onshore, rough seas' },
    { month: 2,  quality: 'poor', label: 'Monsoon season, heavy rain' },
    { month: 3,  quality: 'fair', label: 'Transition — first swells arriving' },
    { month: 4,  quality: 'good', label: 'Dry season opens, swells building' },
    { month: 5,  quality: 'epic', label: "HT's and Macaroni's firing" },
    { month: 6,  quality: 'epic', label: 'Peak Indian Ocean groundswells' },
    { month: 7,  quality: 'epic', label: 'Best month — powerful and consistent' },
    { month: 8,  quality: 'epic', label: 'Consistent, powerful, warm' },
    { month: 9,  quality: 'good', label: 'Good swells, fewer charter boats' },
    { month: 10, quality: 'good', label: 'Late season groundswells' },
    { month: 11, quality: 'fair', label: 'NW monsoon approaching' },
    { month: 12, quality: 'poor', label: 'NW monsoon, onshore, rough' },
  ],
}

const SRI_LANKA_EAST: SeasonData = {
  peakSeason: 'March – October',
  offSeason: 'November – January',
  swellSource: 'Indian Ocean swells (SW monsoon season)',
  notes: "Sri Lanka's east coast (Arugam Bay, Pottuvil Point, Whiskey Point) comes alive from April through October when Indian Ocean swells wrap around the island. Arugam Bay is famous for its right-hand point breaks and relaxed atmosphere. Water is warm (82–84°F) year-round.",
  months: [
    { month: 1,  quality: 'poor', label: 'NE monsoon on east coast, closed' },
    { month: 2,  quality: 'poor', label: 'Still NE monsoon, rough seas' },
    { month: 3,  quality: 'fair', label: 'Season beginning, early swells' },
    { month: 4,  quality: 'good', label: 'Arugam Bay opens for season' },
    { month: 5,  quality: 'epic', label: 'SW monsoon swells build, best of year' },
    { month: 6,  quality: 'epic', label: 'Peak season — consistent powerful surf' },
    { month: 7,  quality: 'epic', label: 'Best month — point breaks firing' },
    { month: 8,  quality: 'good', label: 'Consistent surf, slightly less powerful' },
    { month: 9,  quality: 'good', label: 'Good swells continue' },
    { month: 10, quality: 'fair', label: 'Late season, season closing' },
    { month: 11, quality: 'poor', label: 'NE monsoon begins, rough' },
    { month: 12, quality: 'poor', label: 'NE monsoon, east coast closed' },
  ],
}

const MALDIVES: SeasonData = {
  peakSeason: 'March – October',
  offSeason: 'November – February',
  swellSource: 'Indian Ocean groundswells (SW monsoon)',
  notes: "The Maldives offers world-class left-hand reef breaks (Cokes, Sultans, Jailbreaks) in a tropical paradise setting. The best surf arrives with the SW monsoon from March through October, when Indian Ocean groundswells generated by Southern Ocean storms produce long-period energy. Peak season is June–September. Water is 82–84°F year-round.",
  months: [
    { month: 1,  quality: 'poor', label: 'NE monsoon, small swells, flat' },
    { month: 2,  quality: 'poor', label: 'Transitioning, small surf' },
    { month: 3,  quality: 'fair', label: 'SW monsoon approaching, swells building' },
    { month: 4,  quality: 'good', label: 'Swells building, surf season starts' },
    { month: 5,  quality: 'good', label: 'Consistent swells, warm water' },
    { month: 6,  quality: 'epic', label: 'Peak — Cokes and Sultans firing' },
    { month: 7,  quality: 'epic', label: 'Most consistent month of the year' },
    { month: 8,  quality: 'epic', label: 'Powerful Indian Ocean groundswells' },
    { month: 9,  quality: 'good', label: 'Good swells, transition beginning' },
    { month: 10, quality: 'good', label: 'Late season swell, less consistent' },
    { month: 11, quality: 'fair', label: 'NE monsoon starting, tapering surf' },
    { month: 12, quality: 'poor', label: 'NE monsoon, small and inconsistent' },
  ],
}

const PHILIPPINES: SeasonData = {
  peakSeason: 'October – March',
  offSeason: 'May – August',
  swellSource: 'North Pacific + typhoon swells (NE monsoon / Amihan)',
  notes: "The Philippines' best surfing is driven by the Amihan (NE monsoon) season from October to March. Cloud 9 (Siargao) is the country's crown jewel — a powerful, hollow right-hand reef break that hosts the annual Siargao International Surfing Cup. The Habagat (SW monsoon, June–September) is the off season for east-facing breaks. Water is warm (82–84°F) year-round.",
  months: [
    { month: 1,  quality: 'good', label: 'Amihan season — Cloud 9 firing' },
    { month: 2,  quality: 'good', label: 'Consistent NE trade swells' },
    { month: 3,  quality: 'good', label: 'Late Amihan, still good' },
    { month: 4,  quality: 'fair', label: 'Transition — lighter swells' },
    { month: 5,  quality: 'poor', label: 'Habagat begins, east coast flat' },
    { month: 6,  quality: 'poor', label: 'SW monsoon, east coast flat and rainy' },
    { month: 7,  quality: 'poor', label: 'Typhoon season, unpredictable' },
    { month: 8,  quality: 'poor', label: 'Typhoon season, rough conditions' },
    { month: 9,  quality: 'fair', label: 'Siargao Cup — transitional swell' },
    { month: 10, quality: 'good', label: 'Amihan season begins, Cloud 9 wakes up' },
    { month: 11, quality: 'epic', label: 'Peak Amihan — best NE swell' },
    { month: 12, quality: 'epic', label: 'Prime Cloud 9 season' },
  ],
}

const JAPAN: SeasonData = {
  peakSeason: 'September – February',
  offSeason: 'April – June',
  swellSource: 'Typhoon swells + North Pacific winter swells',
  notes: "Japan's surf is anchored by the Pacific-facing coasts of Chiba, Shonan, and Miyazaki. Typhoon season (August–October) produces spectacular groundswells. Winter (November–February) brings consistent NE and NW swells from North Pacific storms. Water ranges from 59–77°F — a 3/2 to 5/4 wetsuit is needed depending on the season.",
  months: [
    { month: 1,  quality: 'good', label: 'North Pacific winter swells, cold' },
    { month: 2,  quality: 'good', label: 'Consistent winter swells' },
    { month: 3,  quality: 'fair', label: 'Fading winter, spring transition' },
    { month: 4,  quality: 'poor', label: 'Small spring, inconsistent' },
    { month: 5,  quality: 'poor', label: 'Small, calm spring' },
    { month: 6,  quality: 'fair', label: 'South swells begin, warm water' },
    { month: 7,  quality: 'fair', label: 'Summer S swells, hot and humid' },
    { month: 8,  quality: 'good', label: 'Typhoon season begins, big swell events' },
    { month: 9,  quality: 'epic', label: 'Peak typhoon season — epic swells' },
    { month: 10, quality: 'epic', label: 'Late typhoon season, powerful swells' },
    { month: 11, quality: 'good', label: 'Winter N Pacific swells begin' },
    { month: 12, quality: 'good', label: 'Consistent cold-water winter surf' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CA: SeasonData = {
  peakSeason: 'October – March',
  offSeason: 'June – August',
  swellSource: 'North Pacific groundswells',
  notes: 'California surf spots generally peak during winter when North Pacific storm tracks push consistent groundswells down the coast. Summer months are typically smaller and more onshore.',
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

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD LISTS
// ─────────────────────────────────────────────────────────────────────────────

const SF_KEYWORDS           = ['san francisco', 'ocean beach', 'baker beach', 'sf']
const NORTHERN_CA_KEYWORDS  = ['mavericks', 'half moon bay', 'pacifica', 'linda mar', 'fort bragg', 'bodega', 'jenner', 'shelter cove', 'mendocino', 'humboldt', 'crescent city', 'trinidad']
const CENTRAL_CA_KEYWORDS   = ['santa cruz', 'capitola', 'aptos', 'moss landing', 'monterey', 'carmel', 'big sur', 'pismo', 'shell beach', 'avila beach', 'morro bay', 'cayucos', 'cambria', 'central coast']
const SOUTHERN_CA_KEYWORDS  = ['los angeles', 'malibu', 'venice', 'santa monica', 'redondo', 'manhattan beach', 'hermosa', 'el segundo', 'zuma', 'ventura', 'oxnard', 'rincon', 'santa barbara', 'carpinteria', 'lompoc', 'san diego', 'la jolla', 'encinitas', 'carlsbad', 'oceanside', 'del mar', 'solana beach', 'leucadia', 'orange county', 'huntington', 'newport', 'laguna', 'san clemente', 'dana point', 'trestles']

const HAWAII_NORTH_KEYWORDS = ['north shore, oahu', 'north shore, maui', 'north shore, big island', 'north shore, kauai', 'waimea', 'pipeline', 'sunset beach', 'off the wall', 'backdoor', 'ehukai', 'velzyland', 'banzai', 'haleiwa', 'laniakea']
const HAWAII_SOUTH_KEYWORDS = ['south shore, oahu', 'waikiki', 'ala moana', 'diamond head', 'kaisers', 'canoes', 'queens']
const HAWAII_MAUI_KEYWORDS  = ['north shore, maui', 'west maui', 'south shore, maui', 'hookipa', 'honolua', "pe'ahi", 'pe`ahi', 'jaws', 'maui']
const HAWAII_KAUAI_KEYWORDS = ['north kauai', 'north shore, kauai', 'south shore, kauai', 'hanalei', 'tunnels', 'cannons', 'pakala', 'kauai']

const ALASKA_KEYWORDS       = ['kodiak', 'yakutat', 'sitka', 'homer, ak', 'alaska', ', ak', 'juneau', 'ketchikan']
// Note: ', or' is fine as Oregon abbrev; ', wa' is intentionally excluded to avoid
// matching Australian "Western Australia" addresses like "Margaret River, WA"
const PNW_KEYWORDS          = ['brookings', 'gold beach', 'bandon', 'coos bay', 'florence, or', 'lincoln city', 'pacific city', 'newport, or', 'waldport', 'cannon beach', 'manzanita', 'seaside, or', 'astoria', 'westport, wa', 'moclips', 'la push', 'cape flattery', ', or', 'oregon']

const FLORIDA_KEYWORDS      = ['brevard county, florida', 'brevard county, fl', 'miami', 'fort lauderdale', 'palm beach', 'st. augustine', 'jacksonville', 'daytona beach', 'new smyrna', 'sebastian inlet', 'fort pierce', 'vero beach', 'melbourne beach', 'pensacola', 'panama city beach', 'destin', ', fl', ', florida', 'florida']
const CAROLINAS_KEYWORDS    = ['outer banks', 'cape hatteras', 'emerald isle', 'wrightsville beach', 'carolina beach', 'folly beach', 'isle of palms', 'myrtle beach', "sullivan's island", 'tybee island', 'jekyll island', ', nc', ', sc', ', ga', 'north carolina', 'south carolina', 'georgia']
const MID_ATLANTIC_KEYWORDS = ['long island', 'montauk', 'the hamptons', 'long beach, ny', 'rockaway', 'asbury park', 'point pleasant', 'sea girt', 'manasquan', 'ocean city, nj', 'wildwood', 'cape may', 'rehoboth', 'dewey beach', 'bethany beach', 'ocean city, md', 'assateague', 'virginia beach', 'sandbridge', ', ny', ', nj', ', de', ', md', ', va', 'new york', 'new jersey', 'delaware', 'maryland', 'virginia']
// ', ma' intentionally excluded — it would false-match "Tavarua, Mamanuca" (Fiji)
const NEW_ENGLAND_KEYWORDS  = [', me', ', nh', 'maine', 'new hampshire', 'york, me', 'ogunquit', 'wells, me', 'kennebunk', 'portland, me', 'hampton beach', 'rye, nh', 'seabrook', 'salisbury, ma', 'plum island', 'rockport, ma', 'gloucester, ma', 'cape ann', 'nahant', 'revere, ma', 'scituate', 'marshfield', 'duxbury', 'plymouth, ma', 'cape cod', 'nantucket', "martha's vineyard", 'westport, ma', 'narragansett', 'westerly, ri', 'block island', 'groton, ct', 'niantic', 'old saybrook', ', ri', ', ct', 'massachusetts', 'rhode island', 'connecticut']

const MEXICO_PACIFIC_KEYWORDS = ['nayarit', 'sayulita', 'san pancho', 'punta de mita', 'puerto escondido', 'oaxaca', 'zicatela', 'playa zicatela', 'ixtapa', 'troncones', 'zihuatanejo', 'guerrero', 'huatulco', 'mazunte', 'jalisco', 'manzanillo', 'michoacan', 'sinaloa']
const MEXICO_BAJA_KEYWORDS    = ['ensenada', 'baja california', 'la fonda', 'todos santos', 'cerritos', 'san jose del cabo', 'cabo san lucas', 'baja', 'cuatro casas']

const CENTRAL_AMERICA_KEYWORDS     = ['pavones', 'dominical', 'jaco', 'santa teresa', 'nosara', 'tamarindo', 'playa grande', 'costa rica', 'la libertad, el', 'sunzal', 'punta roca', 'el tunco', 'el salvador', 'san juan del sur', 'popoyo', 'maderas', 'nicaragua', 'bocas del toro', 'santa catalina', 'panama', 'guatemala', 'belize', 'honduras']
const SOUTH_AMERICA_PACIFIC_KEYWORDS = ['mancora', 'lima', 'pico alto', 'chicama', 'huanchaco', 'peru', 'montanita', 'montañita', 'salinas', 'ecuador', 'pichilemu', 'arica', 'iquique', 'punta de lobos', 'chile']
const BRAZIL_KEYWORDS               = ['florianopolis', 'florianópolis', 'saquarema', 'fernando de noronha', 'praia do rosa', 'maresias', 'ubatuba', 'taiba', 'jericoacoara', 'itacare', 'itacaré', 'brazil', 'brasil', 'rio de janeiro', 'santa catarina']

const PORTUGAL_KEYWORDS             = ['nazare', 'nazaré', 'peniche', 'ericeira', 'cascais', 'sintra', 'figueira da foz', 'sagres', 'lagos, faro', 'alentejo', 'supertubos', 'praia do norte', 'portugal', 'leiria', 'lisboa', 'faro', 'setúbal', 'setubal']
const BAY_OF_BISCAY_KEYWORDS        = ['mundaka', 'bizkaia', 'zarautz', 'gipuzkoa', 'zurriola', 'san sebastian', 'basque', 'somo, cantabria', 'santander', 'llanes', 'asturias', 'galicia', 'pantin', 'pantín', 'hossegor', 'landes', 'biarritz', 'lacanau', 'biscarrosse', 'mimizan', 'nouvelle-aquitaine', 'gironde', 'pyrénées', 'anglet', 'bayonne']
const IRELAND_UK_KEYWORDS           = ['bundoran', 'donegal', 'sligo', 'kerry', 'clare', 'lahinch', 'ireland', 'cornwall', 'newquay', 'devon', 'watergate bay', 'fistral', 'thurso', 'caithness', 'scotland', 'gower', 'pembrokeshire', 'wales', 'england, uk', 'united kingdom', ', ireland']
const MOROCCO_KEYWORDS              = ['taghazout', 'souss-massa', 'agadir', 'imsouane', 'imesouane', 'anchor point', 'boilers', 'morocco', 'maroc']
const CANARY_ISLANDS_KEYWORDS       = ['fuerteventura', 'gran canaria', 'lanzarote', 'tenerife', 'el hierro', 'la gomera', 'canary', 'las palmas']
const MEDITERRANEAN_KEYWORDS        = ['barcelona', 'catalonia', 'tarifa', 'almería', 'almeria', 'ibiza', 'mallorca', 'palavas', 'hérault', 'herault', 'la grande-motte', 'marseille', 'sardinia', 'sicily', 'tel aviv', 'israel', 'mediterranean', 'aegean', 'adriatic', 'tunisia', 'algeria', 'libya', 'turkey', 'greece']

const AUSTRALIA_QLD_KEYWORDS = ['coolangatta', 'gold coast', 'kirra', 'burleigh', 'snapper', 'noosa', 'sunshine coast', 'rainbow bay', 'stradbroke', 'queensland', ', qld']
const AUSTRALIA_NSW_KEYWORDS = ['byron bay', 'ballina', 'newcastle, nsw', 'sydney', 'manly', 'bondi', 'cronulla', 'narrabeen', 'wollongong', 'kiama', 'jervis bay', 'batemans bay', 'merimbula', 'eden, nsw', ', nsw', 'new south wales']
const AUSTRALIA_VIC_KEYWORDS = ['torquay', 'bells beach', 'jan juc', 'point addis', 'johanna', 'warrnambool', 'cactus beach', 'yorke peninsula', 'victoria, australia', ', vic', 'south australia', ', sa']
const AUSTRALIA_WA_KEYWORDS  = ['margaret river', 'yallingup', 'gracetown', 'prevelly', 'bunker bay', 'perth', 'scarborough', 'trigg', 'geraldton', 'kalbarri', 'exmouth', 'ningaloo', 'rottnest', 'western australia', ', wa,']

const NEW_ZEALAND_KEYWORDS   = ['raglan', 'waikato', 'piha', 'muriwai', 'gisborne', 'mahia', 'wainui', 'new plymouth', 'taranaki', 'fitzroy beach', 'kaikoura', 'westport, west coast', 'punakaiki', 'new zealand', ', nz']

// Fiji/Tahiti: check before New England — "Tavarua, Mamanuca" contains ", ma"
const PACIFIC_ISLANDS_KEYWORDS = ['tavarua', 'namotu', 'cloudbreak', 'mamanuca', 'fiji', 'teahupoo', 'papara', 'french polynesia', 'tahiti', 'samoa', 'tonga', 'vanuatu', 'solomon', 'kiribati', 'tuvalu']

const BALI_KEYWORDS        = ['kuta, bali', 'legian, bali', 'seminyak', 'canggu', 'bali', 'pecatu', 'jembrana', 'selemadeg', 'uluwatu', 'bukit peninsula', 'nusa dua', 'sanur', 'keramas', 'padang padang', 'bingin']
const MENTAWAI_KEYWORDS    = ['mentawai', 'sumatra', 'banyuwangi', 'east java', 'pelabuhan ratu', 'west java', 'lombok', 'sumbawa', 'g-land']
const SRI_LANKA_KEYWORDS   = ['arugam bay', 'pottuvil', 'hikkaduwa', 'galle', 'sri lanka', 'unawatuna', 'weligama', 'midigama']
const MALDIVES_KEYWORDS    = ['male atoll', 'malé atoll', 'ari atoll', 'gaafu atoll', 'maldives', 'maldivian']
const PHILIPPINES_KEYWORDS = ['la union', 'ilocos', 'siargao', 'surigao', 'cloud 9', 'philippines', 'filipinas', 'boracay', 'samar']
const JAPAN_KEYWORDS       = ['chiba', 'kamakura', 'kanagawa', 'shonan', 'miyazaki', 'niijima', 'shikoku', 'japan', ', japan', 'okinawa', 'hokkaido', 'shizuoka']

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

function matchesKeywords(region: string, keywords: string[]): boolean {
  const lower = region.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

export function getSpotSeasons(region: string, _difficulty: string): SeasonData {
  void _difficulty
  // Check specific international regions FIRST to prevent false positives from
  // generic US state abbreviations (e.g. "Tavarua, Mamanuca" contains ", ma").
  // Australia WA must be checked before Pacific NW since both use ", wa".

  // Pacific Islands (before New England)
  if (matchesKeywords(region, PACIFIC_ISLANDS_KEYWORDS)) return PACIFIC_ISLANDS

  // Australia & New Zealand (before PNW)
  if (matchesKeywords(region, AUSTRALIA_QLD_KEYWORDS)) return AUSTRALIA_QUEENSLAND
  if (matchesKeywords(region, AUSTRALIA_NSW_KEYWORDS)) return AUSTRALIA_NSW
  if (matchesKeywords(region, AUSTRALIA_VIC_KEYWORDS)) return AUSTRALIA_VICTORIA
  if (matchesKeywords(region, AUSTRALIA_WA_KEYWORDS))  return AUSTRALIA_WESTERN
  if (matchesKeywords(region, NEW_ZEALAND_KEYWORDS))   return NEW_ZEALAND

  // Asia & Indian Ocean
  if (matchesKeywords(region, MENTAWAI_KEYWORDS))    return MENTAWAI_ISLANDS
  if (matchesKeywords(region, BALI_KEYWORDS))        return BALI_INDONESIA
  if (matchesKeywords(region, SRI_LANKA_KEYWORDS))   return SRI_LANKA_EAST
  if (matchesKeywords(region, MALDIVES_KEYWORDS))    return MALDIVES
  if (matchesKeywords(region, PHILIPPINES_KEYWORDS)) return PHILIPPINES
  if (matchesKeywords(region, JAPAN_KEYWORDS))       return JAPAN

  // Europe
  if (matchesKeywords(region, PORTUGAL_KEYWORDS))          return PORTUGAL
  if (matchesKeywords(region, BAY_OF_BISCAY_KEYWORDS))     return SPAIN_FRANCE_BAY_OF_BISCAY
  if (matchesKeywords(region, IRELAND_UK_KEYWORDS))        return IRELAND_UK
  if (matchesKeywords(region, CANARY_ISLANDS_KEYWORDS))    return CANARY_ISLANDS
  if (matchesKeywords(region, MOROCCO_KEYWORDS))           return MOROCCO
  if (matchesKeywords(region, MEDITERRANEAN_KEYWORDS))     return MEDITERRANEAN

  // Latin America
  if (matchesKeywords(region, CENTRAL_AMERICA_KEYWORDS))        return CENTRAL_AMERICA
  if (matchesKeywords(region, SOUTH_AMERICA_PACIFIC_KEYWORDS))  return SOUTH_AMERICA_PACIFIC
  if (matchesKeywords(region, BRAZIL_KEYWORDS))                 return BRAZIL
  if (matchesKeywords(region, MEXICO_PACIFIC_KEYWORDS))         return MEXICO_PACIFIC_MAINLAND
  if (matchesKeywords(region, MEXICO_BAJA_KEYWORDS))            return MEXICO_BAJA

  // US — California
  if (matchesKeywords(region, SF_KEYWORDS))          return SAN_FRANCISCO
  if (matchesKeywords(region, NORTHERN_CA_KEYWORDS)) return NORTHERN_CA
  if (matchesKeywords(region, CENTRAL_CA_KEYWORDS))  return CENTRAL_CA
  if (matchesKeywords(region, SOUTHERN_CA_KEYWORDS)) return SOUTHERN_CA

  // US — Hawaii
  if (matchesKeywords(region, HAWAII_NORTH_KEYWORDS)) return HAWAII_NORTH_SHORE
  if (matchesKeywords(region, HAWAII_SOUTH_KEYWORDS)) return HAWAII_SOUTH_SHORE
  if (matchesKeywords(region, HAWAII_MAUI_KEYWORDS))  return HAWAII_MAUI
  if (matchesKeywords(region, HAWAII_KAUAI_KEYWORDS)) return HAWAII_KAUAI

  // US — Pacific Northwest & Alaska
  if (matchesKeywords(region, ALASKA_KEYWORDS)) return ALASKA
  if (matchesKeywords(region, PNW_KEYWORDS))    return PACIFIC_NORTHWEST

  // US — East Coast (most specific first)
  if (matchesKeywords(region, FLORIDA_KEYWORDS))      return EAST_COAST_FLORIDA
  if (matchesKeywords(region, CAROLINAS_KEYWORDS))    return EAST_COAST_CAROLINAS
  if (matchesKeywords(region, MID_ATLANTIC_KEYWORDS)) return EAST_COAST_MID_ATLANTIC
  if (matchesKeywords(region, NEW_ENGLAND_KEYWORDS))  return EAST_COAST_NEW_ENGLAND

  return DEFAULT_CA
}
