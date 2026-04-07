'use client'

interface Props {
  fullScreen?: boolean
  compact?: boolean
  label?: string
}

export function WaveLoader({ fullScreen = false, compact = false, label }: Props) {
  const w = compact ? 160 : 220
  const h = compact ? 80  : 120

  const wrapStyle: React.CSSProperties = fullScreen
    ? { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-50)' }
    : compact
    ? { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 0', width: '100%', background: 'var(--sand-50)' }
    : { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', width: '100%', background: 'var(--sand-50)' }

  return (
    <div style={wrapStyle}>
      {/* Wordmark */}
      {!compact && (
        <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, color: 'var(--ocean-700)', letterSpacing: '-0.4px', marginBottom: 28, lineHeight: 1 }}>
          Wave<span style={{ color: 'var(--seafoam)', fontStyle: 'italic' }}>Finder</span>
        </p>
      )}

      {/* SVG ocean scene — all animation via SMIL, no CSS needed */}
      <svg
        width={w}
        height={h}
        viewBox="0 0 220 120"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="wl-g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1b7fcb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1b7fcb" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="wl-g2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4dbfca" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#4dbfca" stopOpacity="0.03" />
          </linearGradient>
          <clipPath id="wl-clip">
            <rect x="0" y="0" width="220" height="120" />
          </clipPath>
        </defs>

        <g clipPath="url(#wl-clip)">
          {/* Back wave — shifts left/right */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -22,0; 0,0"
              dur="3.2s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.45 0.05 0.55 0.95; 0.45 0.05 0.55 0.95"
            />
            <path
              d="M-50 80 C-25 65 0 60 25 67 C50 74 70 63 95 60 C120 57 140 65 165 71 C185 76 205 66 230 62 C250 58 270 65 290 72 L290 120 L-50 120 Z"
              fill="url(#wl-g1)"
            />
            <path
              d="M-50 80 C-25 65 0 60 25 67 C50 74 70 63 95 60 C120 57 140 65 165 71 C185 76 205 66 230 62 C250 58 270 65 290 72"
              stroke="#1b7fcb" strokeWidth="2" strokeLinecap="round" fill="none"
            />
          </g>

          {/* Front wave — shifts right/left */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 20,0; 0,0"
              dur="2.6s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.45 0.05 0.55 0.95; 0.45 0.05 0.55 0.95"
            />
            <path
              d="M-50 95 C-20 84 10 81 40 87 C70 93 90 82 120 80 C150 78 170 87 195 91 C215 94 240 84 265 82 L265 120 L-50 120 Z"
              fill="url(#wl-g2)"
            />
            <path
              d="M-50 95 C-20 84 10 81 40 87 C70 93 90 82 120 80 C150 78 170 87 195 91 C215 94 240 84 265 82"
              stroke="#4dbfca" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.75" fill="none"
            />
          </g>

          {/* Foam sparkle 1 */}
          <circle cx="65" cy="80" r="2.5" fill="white">
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.1;0.35;0.55;1" dur="2.4s" begin="0.3s" repeatCount="indefinite" />
            <animate attributeName="r"       values="1;1;2.5;2;0.5" keyTimes="0;0.1;0.4;0.6;1" dur="2.4s" begin="0.3s" repeatCount="indefinite" />
          </circle>
          {/* Foam sparkle 2 */}
          <circle cx="145" cy="77" r="2" fill="white">
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.1;0.35;0.55;1" dur="2.4s" begin="0.9s" repeatCount="indefinite" />
            <animate attributeName="r"       values="1;1;2;1.5;0.5" keyTimes="0;0.1;0.4;0.6;1" dur="2.4s" begin="0.9s" repeatCount="indefinite" />
          </circle>
          {/* Foam sparkle 3 */}
          <circle cx="192" cy="84" r="1.8" fill="white">
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.1;0.35;0.55;1" dur="2.4s" begin="1.6s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Buoy — bobs up and down */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-6; 0,-9; 0,-5; 0,0"
            keyTimes="0; 0.25; 0.5; 0.75; 1"
            dur="2.6s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.45 0.05 0.55 0.95; 0.45 0.05 0.55 0.95; 0.45 0.05 0.55 0.95; 0.45 0.05 0.55 0.95"
          />
          {/* Anchor line */}
          <line x1="110" y1="96" x2="110" y2="108" stroke="#1362a8" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="2 2" />
          {/* Body */}
          <ellipse cx="110" cy="85" rx="11" ry="14" fill="#e07a5f" />
          {/* White band */}
          <rect x="100" y="82" width="20" height="4.5" rx="2" fill="white" fillOpacity="0.5" />
          {/* Top knob */}
          <circle cx="110" cy="71" r="3.5" fill="#1362a8" />
          {/* Bottom cap */}
          <ellipse cx="110" cy="98" rx="8" ry="2.8" fill="#c9623a" />
          {/* Shine */}
          <ellipse cx="105.5" cy="79" rx="2" ry="3.5" fill="white" fillOpacity="0.2" transform="rotate(-15, 105.5, 79)" />
        </g>
      </svg>

      {/* Pulsing label */}
      <p style={{
        marginTop: compact ? 10 : 18,
        fontSize: compact ? 11 : 13,
        color: 'var(--text-3)',
        letterSpacing: '0.07em',
        fontWeight: 500,
        animation: 'wl-pulse 1.8s ease-in-out infinite',
      }}>
        {label ?? 'Loading…'}
      </p>
    </div>
  )
}
