'use client'

import type { CSSProperties } from 'react'
import type { SurfSpot } from '@/types/spot'
import type { ForecastHour } from '@/types/forecast'
import {
  deriveBreakArchetype,
  deriveBreakHand,
  periodToSetInterval,
  relativeSwellAngle,
  crestCountForPeriod,
  type BreakArchetype,
  type BreakHand,
} from '@/lib/forecast/break-animation'

interface Props {
  spot: SurfSpot
  /** The same hour the rest of the page shows, so the diagram never disagrees
   *  with the numbers displayed beside it. */
  hour: ForecastHour | null
}

// ── Why this looks like a chart ──────────────────────────────────────────────
//
// Depth is the reason a wave breaks where it does, so the diagram is drawn as
// bathymetry: contour lines, a shoal, a shoreline. That is the vernacular every
// printed surf guide already uses, and it makes "where it breaks" information
// rather than decoration — the contours differ per archetype because the
// seabed is the thing that differs.
//
// Plan view, ocean at the top, shore at the bottom: the orientation of a
// lineup diagram, and of a surfer sitting outside looking in.
const W = 360
const H = 232
const SHORE_Y = 196

// ── Geometry per archetype ──────────────────────────────────────────────────
//
// `peels` are authored FROM THE PEAK OUTWARD in the peel direction, which is
// what lets one keyframe drive left, right and both: the whitewater is a dash
// sweeping along the path from its start, so the path's direction IS the
// wave's direction. pathLength={100} normalises the dash maths so it does not
// depend on each path's real length.
interface BreakGeometry {
  /** Depth contours, deepest first. */
  contours: string[]
  /** The shoal itself — the shallow ground the wave trips over. */
  shoal: string
  /** Land mass, drawn over the sea. */
  land: string
  /** One path per peel direction, each starting at the peak. */
  peels: string[]
  /** Takeoff point. */
  peak: { x: number; y: number }
  /** Unbroken crest line, offset shoreward by `o`. */
  crest: (o: number) => string
}

function pointGeometry(hand: BreakHand): BreakGeometry {
  // A right-hander peels toward screen-right, so the headland sits to the
  // left. Mirroring the whole scene keeps one set of coordinates honest.
  const flip = hand === 'left'
  const x = (v: number) => (flip ? W - v : v)
  return {
    contours: [
      `M${x(28)},34 C${x(120)},52 ${x(230)},72 ${x(348)},86`,
      `M${x(40)},58 C${x(126)},76 ${x(232)},96 ${x(350)},110`,
    ],
    shoal: `M${x(52)},72 C${x(130)},92 ${x(236)},112 ${x(352)},126 L${x(352)},${SHORE_Y} L${x(52)},${SHORE_Y} Z`,
    // Headland wedge pushing out from the shore into the sea.
    land: `M${x(-20)},${SHORE_Y} L${x(-20)},62 C${x(40)},70 ${x(78)},104 ${x(104)},${SHORE_Y} Z`,
    peels: [`M${x(96)},92 C${x(150)},104 ${x(226)},120 ${x(334)},136`],
    peak: { x: x(96), y: 92 },
    crest: (o) => `M${x(44)},${18 + o} C${x(120)},${34 + o} ${x(224)},${52 + o} ${x(352)},${66 + o}`,
  }
}

function reefGeometry(hand: BreakHand): BreakGeometry {
  const right = 'M180,96 C214,102 250,116 296,140'
  const left = 'M180,96 C146,102 110,116 64,140'
  return {
    contours: ['M22,58 C86,40 274,40 338,58', 'M40,76 C98,60 262,60 320,76'],
    // A closed offshore bank — the defining feature of a reef.
    shoal: 'M62,104 C88,74 272,74 298,104 C272,132 88,132 62,104 Z',
    land: `M0,${SHORE_Y} C90,${SHORE_Y - 10} 270,${SHORE_Y - 10} ${W},${SHORE_Y} L${W},${H} L0,${H} Z`,
    peels: hand === 'right' ? [right] : hand === 'left' ? [left] : [right, left],
    peak: { x: 180, y: 96 },
    crest: (o) => `M-16,${26 + o} C80,${8 + o} 280,${8 + o} 376,${26 + o}`,
  }
}

function beachGeometry(hand: BreakHand): BreakGeometry {
  const right = 'M168,118 C198,124 228,132 268,146'
  const left = 'M168,118 C138,124 108,132 68,146'
  return {
    contours: ['M-10,64 C90,54 270,54 370,64', 'M-10,88 C90,80 270,80 370,88'],
    // Two bars with a rip gap between them — why a beach break's peaks shift.
    shoal:
      'M18,116 C60,100 132,100 158,120 C132,140 60,140 18,124 Z ' +
      'M202,120 C228,100 300,100 342,116 C300,140 228,140 202,140 Z',
    land: `M0,${SHORE_Y} C90,${SHORE_Y - 6} 270,${SHORE_Y - 6} ${W},${SHORE_Y} L${W},${H} L0,${H} Z`,
    peels: hand === 'right' ? [right] : hand === 'left' ? [left] : [right, left],
    peak: { x: 168, y: 118 },
    crest: (o) => `M-16,${30 + o} C80,${16 + o} 280,${16 + o} 376,${30 + o}`,
  }
}

function geometryFor(archetype: BreakArchetype, hand: BreakHand): BreakGeometry {
  if (archetype === 'point') return pointGeometry(hand)
  if (archetype === 'reef') return reefGeometry(hand)
  return beachGeometry(hand)
}

const ARCHETYPE_COPY: Record<BreakArchetype, { label: string; where: string }> = {
  point: { label: 'Point', where: 'Wraps around the headland and peels down the point' },
  reef: { label: 'Reef', where: 'Stands up over a fixed bank with deep water either side' },
  beach: { label: 'Beach', where: 'Peaks shift along the sandbars as they move' },
}

const HAND_COPY: Record<BreakHand, string> = {
  left: 'Left',
  right: 'Right',
  'a-frame': 'A-frame',
}

function angleCopy(angle: number): string {
  const abs = Math.round(Math.abs(angle))
  if (abs < 12) return 'Straight in'
  if (abs < 35) return `${abs}° off square`
  return `Wrapping ${abs}°`
}

export function BreakAnimation({ spot, hour }: Props) {
  const archetype = deriveBreakArchetype(spot.bottomType, spot.description)
  const hand = deriveBreakHand(spot.description)
  const geo = geometryFor(archetype, hand)

  // No usable swell (period 0/absent) degrades to the same static frame
  // prefers-reduced-motion gets: the base SVG attributes are authored as a
  // real mid-scene moment, so neither case is ever a blank box.
  const hasSwell = !!hour && hour.swellPeriod > 0
  const period = hasSwell ? hour.swellPeriod : 0
  const interval = hasSwell ? periodToSetInterval(period) : 0
  const angle = hasSwell ? relativeSwellAngle(hour.swellDirection, spot.facingDirection) : 0

  // Period reads twice over: as cadence, and as spacing. Wavelength grows with
  // period, so a 16 s groundswell shows two widely-spaced lines where a 7 s
  // windswell shows four tight ones — visible before you read a number.
  const crestCount = crestCountForPeriod(period)
  const crestGap = 148 / crestCount
  const tilt = Math.max(-16, Math.min(16, (angle / 60) * 16))

  const marchStyle = (i: number): CSSProperties | undefined =>
    hasSwell
      ? {
          animationName: 'break-march',
          animationDuration: `${interval}s`,
          animationDelay: `${-(i * interval) / crestCount}s`,
          animationTimingFunction: 'cubic-bezier(0.35, 0, 0.7, 1)',
          animationIterationCount: 'infinite',
        }
      : undefined

  // The peel fires once per set, as a crest reaches the shoal.
  const peelStyle = (i: number): CSSProperties | undefined =>
    hasSwell
      ? {
          animationName: 'break-peel',
          animationDuration: `${interval}s`,
          animationDelay: `${i * 0.12}s`,
          animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.5, 1)',
          animationIterationCount: 'infinite',
        }
      : undefined

  const peakStyle: CSSProperties | undefined = hasSwell
    ? {
        animationName: 'break-peak',
        animationDuration: `${interval}s`,
        animationTimingFunction: 'ease-out',
        animationIterationCount: 'infinite',
      }
    : undefined

  const label = `Break diagram for ${spot.name}: ${ARCHETYPE_COPY[archetype].label.toLowerCase()} break, ${
    HAND_COPY[hand].toLowerCase()
  }${hasSwell ? `, ${Math.round(period)} second swell period` : ', no swell running'}`

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--border)' }}>
      {/* The diagram is composed for a 360x232 frame. Left at width:100% it
          scaled to the card — ~1225x790 on a desktop layout — and the whole
          thing fell apart: a near-empty field taller than the viewport, the
          readout row pushed off-screen, and the motion spread so thin across
          it that a running animation read as a still image. Capping the width
          keeps the composition at the density it was drawn for. */}
      <div className="px-4 pt-4" style={{ background: 'var(--sand-50)' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={label}
          style={{ display: 'block', width: '100%', maxWidth: 460, height: 'auto', margin: '0 auto', borderRadius: 12 }}
        >
        <defs>
          {/* Deep offshore water to shallow inshore — the depth gradient the
              contours annotate. */}
          <linearGradient id="ba-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ocean-800)" />
            <stop offset="55%" stopColor="var(--ocean-600)" />
            <stop offset="100%" stopColor="var(--ocean-400)" />
          </linearGradient>
          <linearGradient id="ba-sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sand-300)" />
            <stop offset="100%" stopColor="var(--sand-400)" />
          </linearGradient>
          {/* Crests are faint offshore and firm up as they stand — they have
              broken by the shoal, where the whitewater takes over. */}
          <linearGradient id="ba-crest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.6" />
            <stop offset="100%" stopColor="white" stopOpacity="0.95" />
          </linearGradient>
          <clipPath id="ba-sea-clip">
            <rect x="0" y="0" width={W} height={SHORE_Y} />
          </clipPath>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#ba-sea)" />

        <g clipPath="url(#ba-sea-clip)">
          {/* Bathymetry. Dashed and low contrast — chart annotation, not the
              subject. */}
          {geo.contours.map((d, i) => (
            <path
              key={`c${i}`}
              d={d}
              fill="none"
              stroke="var(--ocean-300)"
              strokeOpacity={0.3}
              strokeWidth={1}
              strokeDasharray="5 7"
            />
          ))}

          {/* The shoal — lighter water over shallow ground. */}
          <path d={geo.shoal} fill="var(--ocean-300)" fillOpacity={0.2} fillRule="evenodd" />
          <path
            d={geo.shoal}
            fill="none"
            stroke="var(--ocean-200)"
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray="3 5"
            fillRule="evenodd"
          />

          {/* Unbroken crests marching in.
              NOTE: no `transform` attribute here. An SVG presentation attribute
              and a CSS animation targeting the same property is a silent
              no-op waiting to happen — the starting offset is baked into `d`
              instead, so the keyframe is the only thing touching `transform`.
              Same rule for stroke-dashoffset on the peel below. */}
          <g transform={`rotate(${tilt * 0.09} ${W / 2} ${H / 2})`}>
            {Array.from({ length: crestCount }, (_, i) => (
              // Two strokes per swell, not one. A 2.5-unit hairline drifting
              // across a large field of flat blue is genuinely hard to see as
              // movement — it reads as a static line. A wide soft body under a
              // crisp core gives the swell enough presence that the marching
              // is unmistakable, which is the whole point of the panel.
              <g key={`m${i}`}>
                <path
                  className="ba-move ba-crest"
                  d={geo.crest(i * crestGap + crestGap * 0.8)}
                  fill="none"
                  stroke="white"
                  strokeOpacity={0.16}
                  strokeWidth={11}
                  strokeLinecap="round"
                  style={marchStyle(i)}
                />
                <path
                  className="ba-move ba-crest"
                  d={geo.crest(i * crestGap + crestGap * 0.8)}
                  fill="none"
                  stroke="url(#ba-crest)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  style={marchStyle(i)}
                />
              </g>
            ))}
          </g>

          {/* THE PEEL — whitewater running along the break from the takeoff
              point outward. The one loud thing in the panel. */}
          {geo.peels.map((d, i) => (
            <g key={`p${i}`}>
              <path
                className="ba-move ba-peel"
                d={d}
                pathLength={100}
                fill="none"
                stroke="white"
                strokeOpacity={0.22}
                strokeWidth={8}
                strokeLinecap="round"
                style={peelStyle(i)}
              />
              <path
                className="ba-move ba-peel"
                d={d}
                pathLength={100}
                fill="none"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                style={peelStyle(i)}
              />
            </g>
          ))}

          {/* Takeoff point. The ring pulses via stroke width/opacity rather
              than `r`: `r` is a CSS geometry property only some engines
              animate, and it would clash with the attribute the same way. */}
          <circle
            className="ba-move ba-peak"
            cx={geo.peak.x}
            cy={geo.peak.y}
            r={10}
            fill="none"
            stroke="white"
            style={peakStyle}
          />
          <circle cx={geo.peak.x} cy={geo.peak.y} r={3.5} fill="white" />
        </g>

        <path d={geo.land} fill="url(#ba-sand)" />
        <path d={geo.land} fill="none" stroke="var(--sand-500)" strokeOpacity={0.45} strokeWidth={1} />
        </svg>
      </div>

      {/* Read-out. Each cell states one thing the diagram is showing, in the
          same words the derivation used. */}
      <dl className="grid grid-cols-3 gap-px" style={{ background: 'var(--border)' }}>
        {[
          { k: 'Breaks', v: ARCHETYPE_COPY[archetype].label },
          { k: 'Direction', v: HAND_COPY[hand] },
          { k: 'Period', v: hasSwell ? `${Math.round(period)}s` : '—' },
        ].map(({ k, v }) => (
          <div key={k} style={{ background: 'white' }} className="px-4 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              {k}
            </dt>
            <dd className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text)' }}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <p className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
        {ARCHETYPE_COPY[archetype].where}
        {hasSwell ? ` · ${angleCopy(angle)}` : ''}
      </p>
    </div>
  )
}
