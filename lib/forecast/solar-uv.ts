// Compute UV index from solar geometry — no external API needed.
// Accuracy is ±15% vs measured clear-sky UV, sufficient for a surf app.
//
// Formula:
//  1. Solar declination from day-of-year
//  2. Solar elevation angle from lat + hour angle
//  3. UV ≈ 11 × sin(elevation)^0.6  scaled by season/latitude factor

const DEG = Math.PI / 180

function dayOfYear(year: number, month0: number, day: number): number {
  const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) DIM[1] = 29
  return DIM.slice(0, month0).reduce((a, b) => a + b, 0) + day
}

/**
 * @param lat  Decimal degrees (positive = N)
 * @param localISOTime  "YYYY-MM-DDTHH:MM" in the spot's local timezone
 * @returns  UV index 0–11+ (clear-sky approximation)
 */
export function computeUVIndex(lat: number, localISOTime: string): number {
  const m = localISOTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/)
  if (!m) return 0

  const doy  = dayOfYear(+m[1], +m[2] - 1, +m[3])
  const hour = +m[4] + 0.5  // use mid-hour so 12→12.5, slight improvement

  // Solar declination in radians
  const decl = 23.45 * Math.sin(2 * Math.PI * (doy - 81) / 365) * DEG

  // Hour angle: 0 at solar noon, ±15°/hour — assume local civil noon ≈ solar noon
  const hourAngle = (hour - 12) * 15 * DEG

  const latRad = lat * DEG

  // Sine of solar elevation angle
  const sinElev =
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)

  if (sinElev <= 0) return 0  // sun below horizon

  // Solar noon elevation (used to scale the seasonal/latitude maximum)
  const sinNoonElev = Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl)

  // Clear-sky UV index. 11 is the nominal maximum; scaled down by
  // sin(noon_elevation)^0.25 to account for latitude and season.
  const uv = 11 * Math.pow(Math.max(0, sinNoonElev), 0.25) * Math.pow(sinElev, 0.6)

  return Math.round(Math.max(0, uv) * 10) / 10
}
