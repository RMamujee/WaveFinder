'use client'

import type { ForecastHour } from '@/types/forecast'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtTemp, fmtHeightDec, type UnitSystem } from '@/lib/units'

interface Props {
  activeDayHours: ForecastHour[]
  waterTempC: number | null
}

interface Recommendation {
  wetsuit: string
  wetsuitDetail: string
  wetsuitColor: string
  wetsuitBg: string
  boards: string[]
  boardReason: string
  extras: string[]
}

function getWetsuitRec(tempC: number | null, unit: UnitSystem): Pick<Recommendation, 'wetsuit' | 'wetsuitDetail' | 'wetsuitColor' | 'wetsuitBg'> {
  const t = fmtTemp(tempC, unit)
  if (tempC === null) return {
    wetsuit: 'Unknown',
    wetsuitDetail: 'Water temperature unavailable — check local conditions.',
    wetsuitColor: '#6b7280',
    wetsuitBg: '#f3f4f6',
  }
  if (tempC >= 24) return {
    wetsuit: 'Board Shorts / Bikini',
    wetsuitDetail: `${t} — No wetsuit needed. Rash guard optional for sun.`,
    wetsuitColor: '#15803d',
    wetsuitBg: '#f0fdf4',
  }
  if (tempC >= 21) return {
    wetsuit: '2mm Shorty / Spring Suit',
    wetsuitDetail: `${t} — Light suit for warmth. Keeps you comfortable without overheating.`,
    wetsuitColor: '#0e9488',
    wetsuitBg: '#f0fdfa',
  }
  if (tempC >= 18) return {
    wetsuit: '2mm / 3/2mm Full Suit',
    wetsuitDetail: `${t} — Light full suit. 3/2mm if surfing long sessions.`,
    wetsuitColor: '#0369a1',
    wetsuitBg: '#f0f9ff',
  }
  if (tempC >= 15) return {
    wetsuit: '3/2mm Full Suit',
    wetsuitDetail: `${t} — Standard California cold water suit. Sealed seams help.`,
    wetsuitColor: '#1d4ed8',
    wetsuitBg: '#eff6ff',
  }
  if (tempC >= 12) return {
    wetsuit: '4/3mm Full Suit + Boots',
    wetsuitDetail: `${t} — Booties essential. Gloves optional for long sessions.`,
    wetsuitColor: '#6d28d9',
    wetsuitBg: '#f5f3ff',
  }
  if (tempC >= 9) return {
    wetsuit: '5/4mm + Boots + Gloves',
    wetsuitDetail: `${t} — Cold. Hood recommended for sessions over an hour.`,
    wetsuitColor: '#7c3aed',
    wetsuitBg: '#ede9fe',
  }
  return {
    wetsuit: '6/5mm or Drysuit + Hood',
    wetsuitDetail: `${t} — Extreme cold. Full hood + boots + gloves required.`,
    wetsuitColor: '#be185d',
    wetsuitBg: '#fdf2f8',
  }
}

function getBoardRec(avgHeightM: number, avgPower: number, unit: UnitSystem): Pick<Recommendation, 'boards' | 'boardReason' | 'extras'> {
  const h = fmtHeightDec(avgHeightM, unit)
  if (avgHeightM < 0.3) return {
    boards: ['Longboard (9ft+)', 'Soft Top / Foamie', 'SUP'],
    boardReason: `Tiny surf (${h}). Maximum volume needed to catch anything.`,
    extras: ['Wax up extra', 'Great for beginners'],
  }
  if (avgHeightM < 0.6) return {
    boards: ['Longboard', 'Mid-Length (7–8ft)', 'Funboard'],
    boardReason: `Small surf (${h}). High-volume boards make it fun.`,
    extras: ['Soft fins for small waves', 'Try noseriding on the longboard'],
  }
  if (avgHeightM < 0.9) return {
    boards: ['Mid-Length', 'Fish', 'Funboard', 'Hybrid'],
    boardReason: `Waist-high surf (${h}). Fish or mid-length will generate speed and flow.`,
    extras: ['Bigger fins for drive', 'Loose setup for cutbacks'],
  }
  if (avgHeightM < 1.3) return {
    boards: ['Shortboard', 'Fish', 'Hybrid', 'Step-up for power'],
    boardReason: `Head-high surf (${h}). Performance boards shine here.`,
    extras: ['Standard thruster or quad setup', `${Math.round(avgPower)} kW/m wave power`],
  }
  if (avgHeightM < 1.8) return {
    boards: ['Shortboard', 'Step-Up', 'Semi-Gun'],
    boardReason: `Overhead to double-overhead (${h}). More foam and length for paddle power.`,
    extras: ['Stiffer leash (8–9ft)', 'Heavier glass for hold'],
  }
  if (avgHeightM < 2.5) return {
    boards: ['Step-Up (7–8ft)', 'Gun'],
    boardReason: `Big surf (${h}). A proper step-up or gun is essential.`,
    extras: ['Heavy-duty leash (9–10ft)', 'Only experienced surfers'],
  }
  return {
    boards: ['Gun (8ft+)', 'Big Wave Board'],
    boardReason: `XXL surf (${h}). Expert surfers only. Safety gear required.`,
    extras: ['Inflation vest recommended', 'Know the spot well', 'Surf with others'],
  }
}

export function GearPanel({ activeDayHours, waterTempC }: Props) {
  const { unit } = useUnits()
  const avgHeight = activeDayHours.reduce((s, h) => s + h.waveHeight, 0) / activeDayHours.length
  const avgPower = activeDayHours.reduce((s, h) => s + h.wavePower, 0) / activeDayHours.length
  const peakHeight = Math.max(...activeDayHours.map((h) => h.waveHeight))

  const wetsuit = getWetsuitRec(waterTempC, unit)
  const board = getBoardRec(avgHeight, avgPower, unit)

  return (
    <div
      className="rounded-2xl p-5 space-y-5"
      style={{ background: 'white', border: '1px solid var(--border)' }}
    >
      {/* Wetsuit */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: '16px' }}>🤿</span>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
            Wetsuit
          </span>
        </div>
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: wetsuit.wetsuitBg, border: `1px solid ${wetsuit.wetsuitColor}22` }}
        >
          <p
            className="font-bold text-sm mb-1"
            style={{ color: wetsuit.wetsuitColor }}
          >
            {wetsuit.wetsuit}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {wetsuit.wetsuitDetail}
          </p>
        </div>
      </div>

      {/* Board */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: '16px' }}>🏄</span>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
            Board
          </span>
          <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>
            avg {fmtHeightDec(avgHeight, unit)} · peak {fmtHeightDec(peakHeight, unit)} · {Math.round(avgPower)} kW/m
          </span>
        </div>

        <div
          className="rounded-xl px-4 py-3"
          style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}
        >
          <div className="flex flex-wrap gap-1.5 mb-2">
            {board.boards.map((b) => (
              <span
                key={b}
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: 'var(--ocean-50)', color: 'var(--ocean-700)', border: '1px solid var(--ocean-200)' }}
              >
                {b}
              </span>
            ))}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {board.boardReason}
          </p>
        </div>
      </div>

      {/* Extras */}
      {board.extras.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>
            Tips
          </p>
          <ul className="space-y-1">
            {board.extras.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                <span style={{ color: 'var(--ocean-400)', marginTop: '1px', flexShrink: 0 }}>–</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
