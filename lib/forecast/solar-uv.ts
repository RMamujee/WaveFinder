// Compute UV index from solar geometry — no external API needed.
//
// Formula:
//  1. Solar declination from day-of-year
//  2. Solar elevation angle from lat + hour angle
//  3. UVI ≈ 12.5 · μ^2.42, where μ = sin(elevation), then attenuated by cloud
//
// The old shape was `11 · sin(noonElev)^0.25 · sin(elev)^0.6`. Its exponent was
// far too shallow, so it only agreed with reality near the point it had been
// eyeballed at: measured against a reference at Los Angeles winter noon it read
// 6.5 against an actual 2.7 — 2.4× high, and high in the direction that tells a
// surfer they need sunscreen they don't. 12.5·μ^2.42 is the standard clear-sky
// relation (the ozone-dependent form UVI = 12.5·μ^2.42·(Ω/300)^−1.23 evaluated
// at the 300 DU global mean), which puts LA winter noon at 2.8 and LA summer
// noon at 12.0.
//
// Remaining known simplifications: fixed 300 DU ozone, no altitude or albedo
// term, and local civil noon is assumed to be solar noon (worth up to ~30 min
// of hour angle at the edges of a timezone). Clear-sky accuracy is roughly
// ±15%, which is what a surf app needs.

const DEG = Math.PI / 180

function dayOfYear(year: number, month0: number, day: number): number {
  const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) DIM[1] = 29
  return DIM.slice(0, month0).reduce((a, b) => a + b, 0) + day
}

// Clear-sky constant and exponent — see the module header.
const UV_CLEAR_SKY_MAX = 12.5
const UV_ELEVATION_EXPONENT = 2.42

/**
 * Cloud attenuation of erythemal UV.
 *
 * UV is far less sensitive to cloud than visible light is: broken cloud barely
 * touches it (scattered light replaces what is blocked), while full overcast
 * removes a little over half. `1 − 0.56·C^3.4` is the standard empirical curve
 * for that shape — 5% down at half cover, 56% down at full. Ignoring cloud
 * entirely, as the old formula did, reported a peak UV index through solid
 * winter overcast.
 */
export function cloudAttenuation(cloudCoverPercent: number | null | undefined): number {
  if (cloudCoverPercent == null || !isFinite(cloudCoverPercent)) return 1
  const cover = Math.min(1, Math.max(0, cloudCoverPercent / 100))
  return 1 - 0.56 * Math.pow(cover, 3.4)
}

/**
 * @param lat  Decimal degrees (positive = N)
 * @param localISOTime  "YYYY-MM-DDTHH:MM" in the spot's local timezone
 * @param cloudCoverPercent  Total cloud cover 0–100; omit for clear-sky
 * @returns  UV index 0–12+
 */
export function computeUVIndex(
  lat: number,
  localISOTime: string,
  cloudCoverPercent?: number | null
): number {
  const m = localISOTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/)
  if (!m) return 0

  const doy  = dayOfYear(+m[1], +m[2] - 1, +m[3])
  const hour = +m[4] + 0.5  // use mid-hour so 12→12.5, slight improvement

  // Solar declination in radians
  const decl = 23.45 * Math.sin(2 * Math.PI * (doy - 81) / 365) * DEG

  // Hour angle: 0 at solar noon, ±15°/hour — assume local civil noon ≈ solar noon
  const hourAngle = (hour - 12) * 15 * DEG

  const latRad = lat * DEG

  // Sine of solar elevation angle == cosine of the solar zenith angle (μ).
  const sinElev =
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)

  if (sinElev <= 0) return 0  // sun below horizon

  const clearSky = UV_CLEAR_SKY_MAX * Math.pow(sinElev, UV_ELEVATION_EXPONENT)
  const uv = clearSky * cloudAttenuation(cloudCoverPercent)

  return Math.round(Math.max(0, uv) * 10) / 10
}
