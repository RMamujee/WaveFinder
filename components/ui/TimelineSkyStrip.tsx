// Static SVG sky gradient — no animation loop, pure rendering from props
// sunrise / sunset are decimal hours (e.g. 6.25 = 06:15, 19.6 = 19:36)

interface Props {
  sunrise: number  // decimal hour
  sunset:  number  // decimal hour
  height?: number
  currentHour?: number  // decimal hour — draws a "now" marker if provided
}

// Sky colour at any given hour of the day (interpolated palette)
const SKY_STOPS: Array<{ h: number; color: string }> = [
  { h:  0.0, color: '#06122a' },  // midnight
  { h:  4.0, color: '#06122a' },  // deep night
  { h:  4.8, color: '#0d2240' },  // pre-dawn blue
  { h:  5.5, color: '#1a3a6b' },  // nautical twilight
  { h:  6.0, color: '#5e3a24' },  // civil dawn (warm brown)
  { h:  6.5, color: '#d4824a' },  // sunrise orange
  { h:  7.0, color: '#f4b860' },  // golden hour gold
  { h:  8.0, color: '#87ceeb' },  // morning blue
  { h: 10.0, color: '#5bb3e8' },  // late morning
  { h: 12.0, color: '#3a9de8' },  // solar noon
  { h: 15.0, color: '#5bb3e8' },  // afternoon
  { h: 17.5, color: '#87ceeb' },  // late afternoon
  { h: 18.5, color: '#f4b860' },  // golden hour
  { h: 19.0, color: '#e87030' },  // sunset orange
  { h: 19.5, color: '#b03a20' },  // deep sunset
  { h: 20.0, color: '#1a3a6b' },  // civil dusk
  { h: 20.5, color: '#0d2240' },  // twilight
  { h: 21.0, color: '#06122a' },  // night
  { h: 24.0, color: '#06122a' },  // midnight
]

function skyColorAt(hour: number): string {
  const stops = SKY_STOPS
  for (let i = 1; i < stops.length; i++) {
    if (hour <= stops[i].h) {
      const t  = (hour - stops[i - 1].h) / (stops[i].h - stops[i - 1].h)
      const c0 = parseHex(stops[i - 1].color)
      const c1 = parseHex(stops[i].color)
      return rgbStr(lerp(c0, c1, t))
    }
  }
  return stops[stops.length - 1].color
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerp(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function rgbStr([r,g,b]: [number,number,number]): string {
  return `rgb(${r},${g},${b})`
}

function pct(h: number): string {
  return ((h / 24) * 100).toFixed(2) + '%'
}

// Build ~96 gradient stops across 24 hours (one every 15 min)
function buildStops() {
  const stops: Array<{ offset: string; color: string }> = []
  for (let i = 0; i <= 96; i++) {
    const h = (i / 96) * 24
    stops.push({ offset: pct(h), color: skyColorAt(h) })
  }
  return stops
}

const GRADIENT_STOPS = buildStops()
const GRAD_ID = 'sky-strip-gradient'

export function TimelineSkyStrip({ sunrise, sunset, height = 28, currentHour }: Props) {
  const sunriseX = `${((sunrise / 24) * 100).toFixed(2)}%`
  const sunsetX  = `${((sunset  / 24) * 100).toFixed(2)}%`
  const nowX     = currentHour !== undefined
    ? `${((currentHour / 24) * 100).toFixed(2)}%`
    : null

  return (
    <div
      style={{ width: '100%', position: 'relative', userSelect: 'none' }}
      aria-label={`Sky gradient: sunrise ${sunrise.toFixed(1)}h, sunset ${sunset.toFixed(1)}h`}
      role="img"
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 1000 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ display: 'block', borderRadius: 6, overflow: 'hidden' }}
      >
        <defs>
          <linearGradient id={GRAD_ID} x1="0" x2="1" y1="0" y2="0" gradientUnits="objectBoundingBox">
            {GRADIENT_STOPS.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>

        {/* Sky band */}
        <rect x="0" y="0" width="1000" height={height} fill={`url(#${GRAD_ID})`} />

        {/* Star dots in the night section (before sunrise) */}
        {[80, 180, 320, 420].map((sx) => {
          const h = (sx / 1000) * 24
          if (h >= sunrise - 0.5) return null
          return <circle key={sx} cx={sx} cy={height * 0.35} r="1.2" fill="white" opacity="0.7" />
        })}
        {[580, 700, 820, 940].map((sx) => {
          const h = (sx / 1000) * 24
          if (h <= sunset + 0.5) return null
          return <circle key={sx} cx={sx} cy={height * 0.35} r="1.2" fill="white" opacity="0.7" />
        })}

        {/* Sunrise marker */}
        <line
          x1={`${((sunrise / 24) * 1000).toFixed(0)}`}
          y1="0"
          x2={`${((sunrise / 24) * 1000).toFixed(0)}`}
          y2={height}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />

        {/* Sunset marker */}
        <line
          x1={`${((sunset / 24) * 1000).toFixed(0)}`}
          y1="0"
          x2={`${((sunset / 24) * 1000).toFixed(0)}`}
          y2={height}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />

        {/* Now marker */}
        {currentHour !== undefined && (
          <line
            x1={`${((currentHour / 24) * 1000).toFixed(0)}`}
            y1="0"
            x2={`${((currentHour / 24) * 1000).toFixed(0)}`}
            y2={height}
            stroke="white"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Labels */}
      <div style={{ position: 'relative', marginTop: 3, height: 14 }}>
        <span
          style={{
            position: 'absolute',
            left: sunriseX,
            transform: 'translateX(-50%)',
            fontSize: 9,
            fontWeight: 600,
            color: '#d4824a',
            whiteSpace: 'nowrap',
          }}
        >
          {formatHour(sunrise)}
        </span>
        <span
          style={{
            position: 'absolute',
            left: sunsetX,
            transform: 'translateX(-50%)',
            fontSize: 9,
            fontWeight: 600,
            color: '#d4824a',
            whiteSpace: 'nowrap',
          }}
        >
          {formatHour(sunset)}
        </span>
        {nowX && (
          <span
            style={{
              position: 'absolute',
              left: nowX,
              transform: 'translateX(-50%)',
              fontSize: 9,
              fontWeight: 700,
              color: 'white',
              background: 'rgba(0,0,0,0.5)',
              padding: '0 3px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
            }}
          >
            now
          </span>
        )}
      </div>
    </div>
  )
}

function formatHour(h: number): string {
  // Round to whole minutes FIRST: rounding the fraction separately produced
  // ":60" (e.g. 6.9917 h → "6:60 AM") whenever the minutes rounded up.
  const totalMin = Math.round(h * 60) % (24 * 60)
  const hr  = Math.floor(totalMin / 60)
  const min = totalMin % 60
  const ampm = hr < 12 ? 'AM' : 'PM'
  const h12  = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`
}
