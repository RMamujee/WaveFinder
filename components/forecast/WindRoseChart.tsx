'use client'

import type { ForecastDay } from '@/types/forecast'

interface Props {
  days: ForecastDay[]
  size?: number
  showLegend?: boolean
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
const SECTOR_DEG = 45
const SPEED_BANDS = [
  { max: 10,       color: '#16a34a', label: '<10' },
  { max: 20,       color: '#f59e0b', label: '10–20' },
  { max: 30,       color: '#f97316', label: '20–30' },
  { max: Infinity, color: '#ef4444', label: '30+' },
]

function dirIndex(deg: number): number {
  return Math.round(deg / SECTOR_DEG) % 8
}

interface Sector { total: number; bands: { count: number }[] }

export function WindRoseChart({ days, size = 200, showLegend = true }: Props) {
  const hours = days.flatMap(d => d.hours)
  if (!hours.length) return null

  const sectors: Sector[] = Array.from({ length: 8 }, () => ({
    total: 0,
    bands: SPEED_BANDS.map(() => ({ count: 0 })),
  }))

  let calmCount = 0
  let knownCount = 0
  for (const h of hours) {
    const speed = h.wind.speed
    if (speed == null) continue // hour with no wind reading — nothing to bin
    knownCount++
    if (speed < 2) { calmCount++; continue }
    const si = dirIndex(h.wind.direction)
    const bi = SPEED_BANDS.findIndex(b => speed < b.max)
    sectors[si].total++
    sectors[si].bands[bi].count++
  }
  if (knownCount === 0) return null

  const maxTotal = Math.max(...sectors.map(s => s.total), 1)
  const totalHours = knownCount
  const CX = size / 2
  const CY = size / 2
  const MAX_R = size * 0.33
  const labelR = MAX_R + size * 0.09
  const fontSize = Math.max(8, size * 0.048)

  const petalEls = sectors.map((sector, si) => {
    if (sector.total === 0) return null
    const angleDeg = si * SECTOR_DEG - 90
    const angleRad = (angleDeg * Math.PI) / 180
    const halfWidth = (SECTOR_DEG * Math.PI) / 180 / 2 - 0.04

    const paths: React.ReactNode[] = []
    let innerR = 0

    for (let bi = 0; bi < SPEED_BANDS.length; bi++) {
      const bandCount = sector.bands[bi].count
      if (bandCount === 0) continue
      const endR = innerR + (bandCount / sector.total) * (sector.total / maxTotal) * MAX_R
      const a1 = angleRad - halfWidth
      const a2 = angleRad + halfWidth

      const path = [
        `M ${CX + innerR * Math.cos(a1)} ${CY + innerR * Math.sin(a1)}`,
        `L ${CX + endR   * Math.cos(a1)} ${CY + endR   * Math.sin(a1)}`,
        `A ${endR} ${endR} 0 0 1 ${CX + endR   * Math.cos(a2)} ${CY + endR   * Math.sin(a2)}`,
        `L ${CX + innerR * Math.cos(a2)} ${CY + innerR * Math.sin(a2)}`,
        innerR > 0 ? `A ${innerR} ${innerR} 0 0 0 ${CX + innerR * Math.cos(a1)} ${CY + innerR * Math.sin(a1)}` : '',
        'Z',
      ].join(' ')

      paths.push(<path key={bi} d={path} fill={SPEED_BANDS[bi].color} opacity={0.88} />)
      innerR = endR
    }

    const lx = CX + labelR * Math.cos(angleRad)
    const ly = CY + labelR * Math.sin(angleRad)

    return (
      <g key={si}>
        {paths}
        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fontWeight={700} fill="var(--text-2)">
          {DIRS[si]}
        </text>
      </g>
    )
  })

  const rings = [0.33, 0.66, 1].map(f => (
    <circle key={f} cx={CX} cy={CY} r={f * MAX_R} fill="none" stroke="var(--border)" strokeWidth={0.7} />
  ))

  const crosshairs = [0, 1, 2, 3].map(i => {
    const a = (i * 45 * Math.PI) / 180
    return (
      <line key={i}
        x1={CX - MAX_R * Math.cos(a)} y1={CY - MAX_R * Math.sin(a)}
        x2={CX + MAX_R * Math.cos(a)} y2={CY + MAX_R * Math.sin(a)}
        stroke="var(--border)" strokeWidth={0.7} />
    )
  })

  const calmPct = Math.round((calmCount / totalHours) * 100)
  const centerFs = Math.max(7, size * 0.052)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        {rings}
        {crosshairs}
        {petalEls}
        <text x={CX} y={CY - centerFs * 0.6} textAnchor="middle" dominantBaseline="middle"
          fontSize={centerFs} fontWeight={700} fill="var(--text-2)">
          {calmPct}%
        </text>
        <text x={CX} y={CY + centerFs * 0.8} textAnchor="middle" dominantBaseline="middle"
          fontSize={centerFs * 0.8} fill="var(--text-3)">
          calm
        </text>
      </svg>

      {showLegend && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
          {SPEED_BANDS.map(b => (
            <div key={b.label} className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: b.color }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{b.label} km/h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
