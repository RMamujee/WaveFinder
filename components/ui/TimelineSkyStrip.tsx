'use client'

// Sky gradient strip with day/night representation, sun/moon markers, and tick marks.
// Rendered as a static SVG — no animation.

interface Props {
  sunrise: number  // decimal hours, e.g. 6.25 = 6:15 AM
  sunset: number   // decimal hours, e.g. 19.75 = 7:45 PM
  currentHour: number
  width?: number
  height?: number
}

// Maps a hour (0-24) to an x position fraction (0-1)
function hFrac(h: number) { return h / 24 }

// Sky colours at each hour of the day (96 stops, i.e. every 15 min)
// Approximated as: night → dawn → day → dusk → night
const SKY_STOPS: [number, string][] = [
  [0,    '#0e4d88'],
  [0.15, '#0e4d88'],
  [0.25, '#1b6ab5'],
  [0.33, '#f4a261'],  // dawn
  [0.375,'#dbeeff'],  // morning
  [0.5,  '#dbeeff'],  // midday
  [0.625,'#dbeeff'],  // afternoon
  [0.7,  '#f4a261'],  // dusk
  [0.75, '#1b6ab5'],
  [0.85, '#0e4d88'],
  [1,    '#0e4d88'],
]

const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const TICK_LABELS: Record<number, string> = {
  0: '12a', 3: '3a', 6: '6a', 9: '9a', 12: '12p', 15: '3p', 18: '6p', 21: '9p', 24: '12a',
}

export function TimelineSkyStrip({
  sunrise,
  sunset,
  currentHour,
  width = 800,
  height = 56,
}: Props) {
  const gradId   = 'sky-grad'
  const maskId   = 'sky-mask'
  const barH     = height - 20  // leave bottom 20px for tick labels
  const sunX     = hFrac(sunset)  * width
  const riseX    = hFrac(sunrise) * width
  const curX     = hFrac(currentHour) * width

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
      aria-label="Sky timeline"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {SKY_STOPS.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        <clipPath id={maskId}>
          <rect x={0} y={0} width={width} height={barH} rx={8} />
        </clipPath>
      </defs>

      {/* Sky bar */}
      <rect
        x={0} y={0} width={width} height={barH}
        fill={`url(#${gradId})`}
        rx={8}
        clipPath={`url(#${maskId})`}
      />

      {/* Day band overlay (sunrise → sunset) */}
      <rect
        x={riseX} y={0}
        width={Math.max(0, sunX - riseX)}
        height={barH}
        fill="rgba(255,255,255,0.12)"
        clipPath={`url(#${maskId})`}
      />

      {/* Sun marker */}
      <circle cx={sunX > riseX ? (riseX + sunX) / 2 : riseX} cy={barH / 2} r={9}
        fill="rgba(244,162,97,0.9)" />
      <circle cx={sunX > riseX ? (riseX + sunX) / 2 : riseX} cy={barH / 2} r={5.5}
        fill="#fff8e1" />

      {/* Moon marker — placed in the night portion */}
      {(() => {
        const moonX = sunX < width * 0.85 ? width * 0.92 : width * 0.08
        return (
          <>
            <circle cx={moonX} cy={barH / 2} r={8} fill="rgba(200,220,255,0.7)" />
            <circle cx={moonX + 3} cy={barH / 2 - 2} r={5.5} fill="#0e4d88" />
          </>
        )
      })()}

      {/* Current-hour needle */}
      <line
        x1={curX} y1={0} x2={curX} y2={barH}
        stroke="white" strokeWidth={2} strokeDasharray="3 2" opacity={0.9}
      />
      <circle cx={curX} cy={barH / 2} r={5}
        fill="white" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />

      {/* Tick marks + labels */}
      {TICKS.map((h) => {
        const x = hFrac(h) * width
        return (
          <g key={h}>
            <line x1={x} y1={barH} x2={x} y2={barH + 4} stroke="#aaa" strokeWidth={1} />
            <text
              x={x} y={height - 2}
              textAnchor="middle"
              fontSize={9}
              fill="#888"
              fontFamily="DM Sans, sans-serif"
            >
              {TICK_LABELS[h]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
