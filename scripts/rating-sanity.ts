// Prints the rating engine's verdict on a set of hand-described sea states.
// Not a test — a human-readable sanity check for when the scoring constants in
// lib/forecast/rating.ts are tuned. Run: npx tsx scripts/rating-sanity.ts
import { rateSurfConditions } from '../lib/forecast/rating'

const FACING = 270 // a west-facing California beach

const CASES: Array<{ label: string; input: Parameters<typeof rateSurfConditions>[0] }> = [
  {
    label: 'Flat summer morning',
    input: { waveHeight: 0.3, swellHeight: 0.25, swellPeriod: 8, swellDirection: 270,
             windWaveHeight: 0.05, windSpeed: 3, windDirection: 90, spotFacing: FACING },
  },
  {
    label: 'Small clean longboard day (0.6m @ 14s, glassy)',
    input: { waveHeight: 0.7, swellHeight: 0.6, swellPeriod: 14, swellDirection: 270,
             windWaveHeight: 0.1, windSpeed: 4, windDirection: 90, spotFacing: FACING },
  },
  {
    label: 'Classic head-high groundswell (1.2m @ 15s, offshore)',
    input: { waveHeight: 1.3, swellHeight: 1.2, swellPeriod: 15, swellDirection: 270,
             windWaveHeight: 0.1, windSpeed: 8, windDirection: 90, spotFacing: FACING },
  },
  {
    label: 'SAME height, all wind chop, onshore 30km/h',
    input: { waveHeight: 1.3, swellHeight: 0.3, swellPeriod: 6, swellDirection: 270,
             windWaveHeight: 1.1, windSpeed: 30, windDirection: 270, spotFacing: FACING },
  },
  {
    label: 'Pumping overhead swell (2.2m @ 17s, light offshore)',
    input: { waveHeight: 2.4, swellHeight: 2.2, swellPeriod: 17, swellDirection: 270,
             windWaveHeight: 0.2, windSpeed: 6, windDirection: 90, spotFacing: FACING },
  },
  {
    label: 'Same swell, but arriving 70 deg off-axis',
    input: { waveHeight: 2.4, swellHeight: 2.2, swellPeriod: 17, swellDirection: 200,
             windWaveHeight: 0.2, windSpeed: 6, windDirection: 90, spotFacing: FACING },
  },
  {
    label: 'Same swell, spot faces away entirely (south-facing)',
    input: { waveHeight: 2.4, swellHeight: 2.2, swellPeriod: 17, swellDirection: 270,
             windWaveHeight: 0.2, windSpeed: 6, windDirection: 90, spotFacing: 180 },
  },
  {
    label: 'Huge and stormy (4.5m @ 13s, 40km/h onshore)',
    input: { waveHeight: 4.8, swellHeight: 4.5, swellPeriod: 13, swellDirection: 270,
             windWaveHeight: 1.4, windSpeed: 40, windDirection: 270, spotFacing: FACING },
  },
  {
    label: 'Reef break, good swell, tide too low',
    input: { waveHeight: 1.6, swellHeight: 1.5, swellPeriod: 15, swellDirection: 270,
             windWaveHeight: 0.1, windSpeed: 5, windDirection: 90, spotFacing: FACING,
             tide: { height: 0.05, min: 0, max: 2 }, bottomType: 'reef' },
  },
  {
    label: 'Same reef, workable mid-high tide',
    input: { waveHeight: 1.6, swellHeight: 1.5, swellPeriod: 15, swellDirection: 270,
             windWaveHeight: 0.1, windSpeed: 5, windDirection: 90, spotFacing: FACING,
             tide: { height: 1.25, min: 0, max: 2 }, bottomType: 'reef' },
  },
]

const pad = (s: string, n: number) => s.padEnd(n)
const toFt = (m: number) => `${(m * 3.281).toFixed(1)}ft`

console.log(pad('SCENARIO', 52), pad('FACE', 10), pad('SCORE', 7), 'RATING')
console.log('-'.repeat(88))
for (const { label, input } of CASES) {
  const r = rateSurfConditions(input)
  console.log(
    pad(label, 52),
    pad(`${r.faceHeight}m/${toFt(r.faceHeight)}`, 10),
    pad(String(r.score), 7),
    r.rating
  )
}
