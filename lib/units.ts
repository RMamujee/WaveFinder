export type UnitSystem = 'imperial' | 'metric'

// Wave/swell height: meters input
export function fmtHeight(m: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${m.toFixed(1)}m` : `${Math.round(m * 3.281)}ft`
}

// Same but one decimal place (for buoy/swell panel)
export function fmtHeightDec(m: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${m.toFixed(1)}m` : `${(m * 3.281).toFixed(1)}ft`
}

// Wind from km/h (Open-Meteo)
export function fmtWind(kmh: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${Math.round(kmh)} km/h` : `${Math.round(kmh * 0.621371)} mph`
}

// Wind from m/s (NOAA buoy / coastal)
export function fmtWindMps(mps: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${Math.round(mps * 3.6)} km/h` : `${Math.round(mps * 2.237)} mph`
}

// Temperature from °C
export function fmtTemp(c: number | null, unit: UnitSystem): string {
  if (c === null) return '—'
  return unit === 'metric' ? `${Math.round(c)}°C` : `${Math.round(c * 9 / 5 + 32)}°F`
}

// Tide/map elevation from meters
export function fmtTide(m: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${m.toFixed(1)}m` : `${(m * 3.281).toFixed(1)}ft`
}

// Unit label strings for display
export function windLabel(unit: UnitSystem): string {
  return unit === 'metric' ? 'km/h' : 'mph'
}

export function heightLabel(unit: UnitSystem): string {
  return unit === 'metric' ? 'm' : 'ft'
}

export function tempLabel(unit: UnitSystem): string {
  return unit === 'metric' ? '°C' : '°F'
}
