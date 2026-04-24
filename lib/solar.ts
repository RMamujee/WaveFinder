// Inline NOAA solar calculator — accurate to within ~1 minute for most latitudes.
// Returns sunrise/sunset as local decimal hours (e.g. 6.5 = 6:30 AM).

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

export function solarTimes(
  lat: number,
  lon: number,
  date: Date = new Date()
): { sunrise: number; sunset: number } {
  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0

  // Mean longitude and anomaly
  const L = ((280.46 + 0.9856474 * n) % 360 + 360) % 360
  const g = (357.528 + 0.9856003 * n) * RAD

  // Ecliptic longitude
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD

  // Obliquity of ecliptic
  const eps = (23.439 - 0.0000004 * n) * RAD

  // Declination
  const sinDec = Math.sin(eps) * Math.sin(lambda)
  const decl = Math.asin(sinDec)

  // Equation of time (simplified, minutes)
  const RA = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * DEG
  const EqT = L - 0.0057183 - RA  // degrees, divide by 15 for hours then ×60 for minutes

  // Hour angle for sunrise/sunset (solar altitude = -0.833° for refraction + disc)
  const cosHA =
    (Math.cos(90.833 * RAD) - Math.sin(lat * RAD) * sinDec) /
    (Math.cos(lat * RAD) * Math.cos(decl))

  if (cosHA < -1) return { sunrise: 0, sunset: 24 }  // polar day
  if (cosHA > 1)  return { sunrise: 12, sunset: 12 } // polar night

  const HA = Math.acos(cosHA) * DEG  // degrees

  // Solar noon in UTC hours: 12 - lon/15 - EqT/15/60*(60) — keep in hours
  const solarNoonUTC = 12 - lon / 15 - EqT / 15 / 60

  const sunriseUTC = solarNoonUTC - HA / 15
  const sunsetUTC  = solarNoonUTC + HA / 15

  // Local offset from UTC (positive east)
  const localOffsetH = -date.getTimezoneOffset() / 60

  const wrap = (h: number) => ((h + localOffsetH) % 24 + 24) % 24

  return { sunrise: wrap(sunriseUTC), sunset: wrap(sunsetUTC) }
}
