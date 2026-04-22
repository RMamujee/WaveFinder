'use client'

import { useEffect, useRef } from 'react'

interface Props {
  height: number   // wave height in metres (from forecast)
  period: number   // swell period in seconds
  wind: number     // wind speed in knots
  width?: number
  h?: number       // canvas height in px
}

// Ocean-only palette — never changes based on quality rating
const OCEAN_COLORS = {
  primary:   '#1b7fcb',   // --ocean-500
  secondary: '#3a9de8',   // --ocean-400
  highlight: '#7ec0f5',   // --ocean-300
  trough:    '#0e4d88',   // --ocean-700
}

// Compute wave from swell physics:
//   Amplitude = clamp(height * 0.38, 3, 18) px
//   Wavelength = map period (6–20 s) onto [60, 160] px
//   Wind adds a 2nd shorter ripple layer
function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  height: number,
  period: number,
  wind: number,
  t: number,
) {
  ctx.clearRect(0, 0, w, h)

  const amp  = Math.max(3, Math.min(18, height * 3.28 * 0.38 * (h / 48)))
  const waveLen = 60 + ((Math.max(6, Math.min(20, period)) - 6) / 14) * 100
  const speed = 0.6 + (period / 20) * 0.8 // slower for long period

  const mid = h * 0.55

  // ── Layer 1: main swell (filled) ───────────────────────────────────────
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = mid + Math.sin((x / waveLen) * 2 * Math.PI - t * speed) * amp
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()

  const grad = ctx.createLinearGradient(0, mid - amp, 0, h)
  grad.addColorStop(0,   OCEAN_COLORS.secondary + 'cc')
  grad.addColorStop(0.5, OCEAN_COLORS.primary   + 'aa')
  grad.addColorStop(1,   OCEAN_COLORS.trough    + '66')
  ctx.fillStyle = grad
  ctx.fill()

  // ── Layer 2: surface stroke ─────────────────────────────────────────────
  ctx.beginPath()
  for (let x = 0; x <= w; x += 2) {
    const y = mid + Math.sin((x / waveLen) * 2 * Math.PI - t * speed) * amp
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.strokeStyle = OCEAN_COLORS.secondary + 'ee'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // ── Layer 3: wind chop ripple (only if wind > 5 kt) ────────────────────
  if (wind > 5) {
    const ripAmp = Math.min(3, (wind - 5) * 0.18) * (h / 48)
    const ripLen = 28 + Math.random() * 4
    ctx.beginPath()
    for (let x = 0; x <= w; x += 2) {
      const base = mid + Math.sin((x / waveLen) * 2 * Math.PI - t * speed) * amp
      const rip  = Math.sin((x / ripLen) * 2 * Math.PI - t * 2.1) * ripAmp
      x === 0 ? ctx.moveTo(x, base + rip) : ctx.lineTo(x, base + rip)
    }
    ctx.strokeStyle = OCEAN_COLORS.highlight + '88'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
}

export function MiniWave({ height, period, wind, width = 232, h = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const tRef      = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Respect prefers-reduced-motion — draw one static frame and stop
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      drawFrame(ctx, width, h, height, period, wind, 1.5)
      return
    }

    let last = performance.now()
    function loop(now: number) {
      const dt = (now - last) / 1000
      last = now
      tRef.current += dt
      if (ctx) drawFrame(ctx, width, h, height, period, wind, tRef.current)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [height, period, wind, width, h])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={h}
      style={{ display: 'block', width: '100%', height: h }}
      aria-hidden="true"
    />
  )
}
