'use client'

import type { CSSProperties } from 'react'
import type { SurfSpot } from '@/types/spot'
import type { ForecastHour } from '@/types/forecast'
import {
  deriveBreakArchetype,
  deriveBreakHand,
  periodToSetInterval,
  relativeSwellAngle,
  type BreakArchetype,
  type BreakHand,
} from '@/lib/forecast/break-animation'
import { BOTTOM_TYPE_STYLE, type BottomType } from '@/lib/bottom-type'
import { degreesToCompass } from '@/lib/forecast/rating'

interface Props {
  spot: SurfSpot
  /** The same hour the rest of the page shows (current condition), so the
   *  diagram never disagrees with the numbers displayed beside it. */
  hour: ForecastHour | null
}

// viewBox coordinate space — ocean at the top, shore at the bottom, same
// orientation a surfer paddling out and facing the beach would see.
const W = 320
const H = 200
const OCEAN_ZONE_H = 172 // where the sand band begins

const ARCHETYPE_META: Record<BreakArchetype, { label: string; hint: string; swatch: BottomType }> = {
  point: { label: 'Point break', hint: 'peels off a headland', swatch: 'rock' },
  reef: { label: 'Reef break', hint: 'stands up over a fixed outside bank', swatch: 'reef' },
  beach: { label: 'Beach break', hint: 'peaks shift along the sandbar', swatch: 'sand' },
}

const HAND_LABEL: Record<BreakHand, string> = {
  left: 'Left-hand',
  right: 'Right-hand',
  'a-frame': 'A-frame',
}

function angleDescription(angle: number): string {
  const abs = Math.abs(angle)
  if (abs < 12) return 'arriving square to the beach'
  if (abs < 35) return `arriving ~${Math.round(abs)}° off square`
  return `wrapping in at a sharp ~${Math.round(abs)}° angle`
}

// A gently undulating crest line spanning (and slightly overflowing) the
// ocean zone, tilted by `tiltPx` between its ends to depict the swell's
// angle relative to the beach. This is a stylized, monotonic — not
// literal-compass — mapping of relativeSwellAngle's sign: positive angle
// pushes the right end further toward shore.
function crestPath(y: number, tiltPx: number): string {
  const yl = y - tiltPx / 2
  const yr = y + tiltPx / 2
  const mid = (yl + yr) / 2
  return `M-24,${yl.toFixed(1)} Q70,${(mid - 7).toFixed(1)} 160,${mid.toFixed(1)} Q250,${(mid + 7).toFixed(1)} 344,${yr.toFixed(1)}`
}

// The foam/whitewater peel for a single peak: one arc drawn left-to-right for
// a right-hand wave, right-to-left for a left-hand wave (dash-offset draw
// direction follows the path's own start point), or two half-arcs opening
// from a center peak for an A-frame that breaks both ways at once.
function peelPaths(centerX: number, y: number, halfWidth: number, dip: number, hand: BreakHand): string[] {
  const leftX = centerX - halfWidth
  const rightX = centerX + halfWidth
  if (hand === 'left') return [`M${rightX},${y} Q${centerX},${y - dip} ${leftX},${y}`]
  if (hand === 'right') return [`M${leftX},${y} Q${centerX},${y - dip} ${rightX},${y}`]
  return [
    `M${centerX},${(y - dip).toFixed(1)} Q${((centerX + leftX) / 2).toFixed(1)},${(y - dip * 0.5).toFixed(1)} ${leftX},${y}`,
    `M${centerX},${(y - dip).toFixed(1)} Q${((centerX + rightX) / 2).toFixed(1)},${(y - dip * 0.5).toFixed(1)} ${rightX},${y}`,
  ]
}

// The headland for a point break: a landmass jutting from one side of the
// frame to a tip, with the wave peeling along its seaward edge and on down
// the adjacent beach (the "long peeling ride" a point is known for). Mirrored
// on the x-axis for a left-hand wave — see the module doc for the screen
// convention this relies on.
function pointGeometry(hand: BreakHand) {
  const mirrored = hand === 'left'
  const m = (x: number) => (mirrored ? W - x : x)
  const rockD = [
    `M${m(0)},200`,
    `L${m(0)},100`,
    `C${m(20)},80 ${m(45)},66 ${m(72)},58`,
    `C${m(92)},78 ${m(96)},108 ${m(86)},138`,
    `C${m(78)},164 ${m(55)},186 ${m(22)},200`,
    'Z',
  ].join(' ')
  const breakD = [
    `M${m(72)},58`,
    `C${m(92)},78 ${m(96)},108 ${m(86)},138`,
    `C${m(80)},160 ${m(100)},175 ${m(140)},182`,
    `C${m(190)},188 ${m(240)},190 ${m(290)},190`,
  ].join(' ')
  // Short reverse stub off the tip, used only for the rare A-frame point —
  // most points in the data specify a single hand explicitly.
  const stubD = `M${m(72)},58 C${m(60)},80 ${m(50)},105 ${m(55)},130`
  return { rockD, breakD, stubD }
}

export function BreakAnimation({ spot, hour }: Props) {
  const archetype = deriveBreakArchetype(spot.bottomType, spot.description)
  const hand = deriveBreakHand(spot.description)
  const meta = ARCHETYPE_META[archetype]
  const swatch = BOTTOM_TYPE_STYLE[meta.swatch]

  // Degrade to the static frame when the forecast has no usable swell (period
  // 0/absent) — same code path prefers-reduced-motion uses below, since both
  // cases need a meaningful non-animated snapshot rather than a blank box.
  const hasSwell = !!hour && hour.swellPeriod > 0
  const interval = hasSwell ? periodToSetInterval(hour.swellPeriod) : null
  const angle = hasSwell ? relativeSwellAngle(hour.swellDirection, spot.facingDirection) : 0

  const tiltFull = Math.max(-46, Math.min(46, (angle / 60) * 46))
  const tiltNear = tiltFull * 0.35

  const animClass = hasSwell ? 'break-anim-move' : undefined
  const half = hasSwell && interval ? interval / 2 : 0

  const crestStyle = (delay: number): CSSProperties | undefined =>
    hasSwell
      ? {
          animationName: 'break-anim-crest',
          animationDuration: `${interval}s`,
          animationDelay: `${delay}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }
      : undefined

  const foamStyle = (delay: number): CSSProperties | undefined =>
    hasSwell
      ? {
          animationName: 'break-anim-foam',
          animationDuration: `${interval}s`,
          animationDelay: `${delay}s`,
          animationTimingFunction: 'ease-in',
          animationIterationCount: 'infinite',
        }
      : undefined

  const ariaLabel = `Diagram of how ${spot.name} breaks: a ${meta.label.toLowerCase()}, ${HAND_LABEL[hand].toLowerCase()}${
    hasSwell ? `, ${Math.round(hour.swellPeriod)} second swell period` : ''
  }`

  const point = archetype === 'point' ? pointGeometry(hand) : null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--border)' }}>
      <div className="px-5 pt-4 pb-1 flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: swatch.bg, color: swatch.color }}>
          {meta.label}
        </span>
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--ocean-100)', color: 'var(--ocean-700)' }}>
          {HAND_LABEL[hand]}
        </span>
        {hasSwell && (
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--sand-100)', color: 'var(--text-2)' }}>
            {Math.round(hour.swellPeriod)}s period
          </span>
        )}
      </div>

      <div className="px-3 pb-4 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="break-anim-ocean" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ocean-100)" />
              <stop offset="100%" stopColor="var(--ocean-50)" />
            </linearGradient>
            <clipPath id="break-anim-clip">
              <rect x="-24" y="0" width={W + 48} height={OCEAN_ZONE_H} />
            </clipPath>
          </defs>

          <rect x="0" y="0" width={W} height={H} fill="url(#break-anim-ocean)" />

          {/* Approaching swell — two tiers; the nearshore tier's tilt is
              damped to suggest refraction as the swell shoals. */}
          <g clipPath="url(#break-anim-clip)">
            {[0, 1].map((i) => (
              <path
                key={`far-${i}`}
                d={crestPath(40, tiltFull)}
                fill="none"
                stroke="var(--ocean-400)"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={hasSwell ? undefined : 0.45}
                className={animClass}
                style={crestStyle(i * half)}
              />
            ))}
            {[0, 1].map((i) => (
              <path
                key={`near-${i}`}
                d={crestPath(104, tiltNear)}
                fill="none"
                stroke="var(--ocean-500)"
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={hasSwell ? undefined : 0.6}
                className={animClass}
                style={crestStyle(i * half)}
              />
            ))}
          </g>

          {/* Shore */}
          <path
            d="M0,180 C40,173 80,177 120,179 C160,181 200,175 240,178 C280,181 300,176 320,179 L320,200 L0,200 Z"
            fill="var(--sand-300)"
            stroke="var(--sand-400)"
            strokeWidth={1}
          />

          {/* Archetype-specific seabed feature */}
          {archetype === 'reef' && (
            <ellipse
              cx={172}
              cy={108}
              rx={46}
              ry={15}
              transform="rotate(-6 172 108)"
              fill="#9a3412"
              fillOpacity={0.24}
              stroke="#9a3412"
              strokeOpacity={0.55}
              strokeWidth={1.4}
              strokeDasharray="3 3"
            />
          )}
          {archetype === 'beach' && (
            <>
              <ellipse cx={92} cy={150} rx={36} ry={9} fill="var(--sand-500)" fillOpacity={0.32} />
              <ellipse cx={222} cy={144} rx={34} ry={9} fill="var(--sand-500)" fillOpacity={0.32} />
            </>
          )}
          {point && (
            <path d={point.rockD} fill="#4b5563" stroke="#374151" strokeWidth={1.5} strokeLinejoin="round" />
          )}

          {/* Foam / whitewater peel */}
          {archetype === 'reef' &&
            peelPaths(172, 100, 38, 14, hand).map((d, i) => (
              <path
                key={i}
                d={d}
                pathLength={100}
                fill="none"
                stroke="white"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={100}
                strokeDashoffset={35}
                opacity={0.92}
                className={animClass}
                style={foamStyle(i * half)}
              />
            ))}
          {archetype === 'beach' &&
            ([
              [92, 150, 32, 10],
              [222, 145, 30, 10],
            ] as const).flatMap(([cx, y, hw, dip], zoneIdx) =>
              peelPaths(cx, y, hw, dip, hand).map((d, i) => (
                <path
                  key={`${zoneIdx}-${i}`}
                  d={d}
                  pathLength={100}
                  fill="none"
                  stroke="white"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeDasharray={100}
                  strokeDashoffset={35}
                  opacity={0.92}
                  className={animClass}
                  style={foamStyle(zoneIdx * 0.4 + i * half)}
                />
              ))
            )}
          {point && (
            <>
              <path
                d={point.breakD}
                pathLength={100}
                fill="none"
                stroke="white"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={100}
                strokeDashoffset={30}
                opacity={0.92}
                className={animClass}
                style={foamStyle(0)}
              />
              {hand === 'a-frame' && (
                <path
                  d={point.stubD}
                  pathLength={100}
                  fill="none"
                  stroke="white"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeDasharray={100}
                  strokeDashoffset={30}
                  opacity={0.85}
                  className={animClass}
                  style={foamStyle(0)}
                />
              )}
            </>
          )}
        </svg>

        <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
          {hasSwell
            ? `${Math.round(hour.swellPeriod)}s swell from the ${degreesToCompass(hour.swellDirection)} — ${angleDescription(angle)}. This ${meta.label.toLowerCase()} ${meta.hint}.`
            : `No swell in the water right now — this shows how ${spot.name}'s ${meta.label.toLowerCase()} typically breaks: it ${meta.hint}.`}
        </p>
      </div>
    </div>
  )
}
