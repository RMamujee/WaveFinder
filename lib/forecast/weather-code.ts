import type { WFIconName } from '@/components/ui/Icon'

export function weatherIcon(code: number | null): WFIconName {
  if (code === null) return 'wave'
  if (code === 0) return 'sun'
  if (code <= 2) return 'sun'
  if (code === 3) return 'wind'
  if (code <= 48) return 'wind'
  if (code <= 57) return 'droplet'
  if (code <= 67) return 'droplet'
  if (code <= 77) return 'temp'
  if (code <= 82) return 'droplet'
  if (code <= 86) return 'temp'
  if (code <= 99) return 'wind'
  return 'wave'
}

export function weatherLabel(code: number | null): string {
  if (code === null) return 'Unknown'
  if (code === 0) return 'Clear'
  if (code === 1) return 'Mainly Clear'
  if (code === 2) return 'Partly Cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 48) return 'Foggy'
  if (code <= 55) return 'Drizzle'
  if (code <= 57) return 'Freezing Drizzle'
  if (code <= 65) return 'Rain'
  if (code <= 67) return 'Freezing Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain Showers'
  if (code <= 86) return 'Snow Showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}

export function tempF(c: number | null): string {
  if (c === null) return '—'
  return `${Math.round(c * 9 / 5 + 32)}°F`
}
