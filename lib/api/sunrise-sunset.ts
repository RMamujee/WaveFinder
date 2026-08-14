const BASE = 'https://api.sunrise-sunset.org/json'

export interface SolarData {
  date: string
  sunrise: string            // ISO UTC — convert to local in component
  sunset: string
  solarNoon: string
  civilTwilightBegin: string // first usable light — dawn surf window starts here
  civilTwilightEnd: string
  nauticalTwilightBegin: string
  nauticalTwilightEnd: string
  dayLengthSeconds: number
  moonPhase: number          // 0–1 (0 = new, 0.5 = full)
  moonPhaseName: string
  moonEmoji: string
}

function computeMoonPhase(date: Date): { phase: number; name: string; emoji: string } {
  // Reference new moon: 2000-01-06 00:00 UTC = JD 2451549.5
  const JD = date.getTime() / 86400000 + 2440587.5
  const raw = (JD - 2451549.5) % 29.53058867
  const days = raw < 0 ? raw + 29.53058867 : raw
  const phase = days / 29.53058867

  let name: string
  let emoji: string
  if      (phase < 0.0625) { name = 'New Moon';        emoji = '🌑' }
  else if (phase < 0.1875) { name = 'Waxing Crescent'; emoji = '🌒' }
  else if (phase < 0.3125) { name = 'First Quarter';   emoji = '🌓' }
  else if (phase < 0.4375) { name = 'Waxing Gibbous';  emoji = '🌔' }
  else if (phase < 0.5625) { name = 'Full Moon';       emoji = '🌕' }
  else if (phase < 0.6875) { name = 'Waning Gibbous';  emoji = '🌖' }
  else if (phase < 0.8125) { name = 'Last Quarter';    emoji = '🌗' }
  else if (phase < 0.9375) { name = 'Waning Crescent'; emoji = '🌘' }
  else                     { name = 'New Moon';        emoji = '🌑' }

  return { phase, name, emoji }
}

export async function fetchSolarData(lat: number, lng: number, date?: string): Promise<SolarData | null> {
  try {
    const dateStr = date ?? new Date().toISOString().split('T')[0]
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      date: dateStr,
      formatted: '0',
    })
    const res = await fetch(`${BASE}?${params}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json.status !== 'OK') return null

    const r = json.results
    const moon = computeMoonPhase(new Date(dateStr))

    return {
      date: dateStr,
      sunrise: r.sunrise,
      sunset: r.sunset,
      solarNoon: r.solar_noon,
      civilTwilightBegin: r.civil_twilight_begin,
      civilTwilightEnd: r.civil_twilight_end,
      nauticalTwilightBegin: r.nautical_twilight_begin,
      nauticalTwilightEnd: r.nautical_twilight_end,
      dayLengthSeconds: r.day_length,
      moonPhase: moon.phase,
      moonPhaseName: moon.name,
      moonEmoji: moon.emoji,
    }
  } catch {
    return null
  }
}
