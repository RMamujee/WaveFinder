// NOAA-approximation sunrise/sunset — no external lib.
//
// Returns { sunrise, sunset } as decimal hours in LOCAL SOLAR time, which is
// what the timeline's sky strip plots against: its axis is the region's local
// clock. NO longitude/UTC term belongs here — subtracting lng/15 converts to
// UTC, and with that offset in, Los Angeles showed sunrise at 1:17 PM and
// sunset at 2:31 AM (sunset BEFORE sunrise on the axis) with the night stars
// rendered across the whole daytime band. Solar time differs from the zone
// clock by longitude-within-zone and DST — up to ~1-2 h in the worst zones,
// fine for a sky gradient.
export function computeSunriseSunset(
  lat: number,
  _lng: number,
  date: Date,
): { sunrise: number; sunset: number } {
  const rad  = Math.PI / 180
  const jd   = date.getTime() / 86400000 + 2440587.5
  const n    = jd - 2451545.0
  const L    = (280.46 + 0.9856474 * n) % 360
  const g    = (357.528 + 0.9856003 * n) % 360
  const lam  = L + 1.915 * Math.sin(g * rad) + 0.02 * Math.sin(2 * g * rad)
  const eps  = 23.439 - 0.0000004 * n
  const sinDec = Math.sin(eps * rad) * Math.sin(lam * rad)
  const dec  = Math.asin(sinDec)
  const cosH = (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(dec))
             / (Math.cos(lat * rad) * Math.cos(dec))

  // Clamp: if |cosH| > 1 the sun never rises/sets — fall back to defaults
  if (Math.abs(cosH) > 1) return { sunrise: 6.25, sunset: 19.6 }

  const H  = Math.acos(cosH) / rad
  const sunrise = 12 - H / 15
  const sunset  = 12 + H / 15

  return { sunrise: ((sunrise % 24) + 24) % 24, sunset: ((sunset % 24) + 24) % 24 }
}
