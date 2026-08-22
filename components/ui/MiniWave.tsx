'use client'

import { useEffect, useRef } from 'react'

interface Props {
  height: number   // wave height in metres (from forecast)
  period: number   // swell period in seconds
  wind: number     // wind speed in km/h (what the conditions API serves)
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
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = OCEAN_COLORS.secondary + 'ee'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // ── Layer 3: wind chop ripple (only past ~5 kt ≈ 9 km/h) ───────────────
  if (wind > 9) {
    const ripAmp = Math.min(3, (wind - 9) * 0.1) * (h / 48)
    // Derived from wind, not Math.random() — a fresh wavelength every frame made
    // the chop layer strobe instead of travel.
    const ripLen = 28 + (wind % 4)
    ctx.beginPath()
    for (let x = 0; x <= w; x += 2) {
      const base = mid + Math.sin((x / waveLen) * 2 * Math.PI - t * speed) * amp
      const rip  = Math.sin((x / ripLen) * 2 * Math.PI - t * 2.1) * ripAmp
      if (x === 0) ctx.moveTo(x, base + rip)
      else ctx.lineTo(x, base + rip)
    }
    ctx.strokeStyle = OCEAN_COLORS.highlight + '88'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
}

export function MiniWave({ height, period, wind, width: _width = 232, h = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const tRef      = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Size canvas to physical pixels for crisp rendering on high-DPI screens
    const dpr  = window.devicePixelRatio ?? 1
    const logW = canvas.offsetWidth || _width
    canvas.width  = logW * dpr
    canvas.height = h   * dpr
    ctx.scale(dpr, dpr)

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      drawFrame(ctx, logW, h, height, period, wind, 1.5)
      return
    }

    // Every card in a list mounts one of these. Unthrottled, a long list runs
    // hundreds of concurrent rAF loops redrawing off-screen canvases — so the
    // loop only runs while the canvas is actually in the viewport AND the tab
    // is visible. Paused cards keep a static frame instead of going blank.
    let last = performance.now()
    let running = false
    let inView = false

    function loop(now: number) {
      const dt = (now - last) / 1000
      last = now
      tRef.current += dt
      if (ctx) drawFrame(ctx, logW, h, height, period, wind, tRef.current)
      rafRef.current = requestAnimationFrame(loop)
    }
    function sync() {
      const shouldRun = inView && document.visibilityState === 'visible'
      if (shouldRun && !running) {
        running = true
        last = performance.now()
        rafRef.current = requestAnimationFrame(loop)
      } else if (!shouldRun && running) {
        running = false
        cancelAnimationFrame(rafRef.current)
      }
    }

    drawFrame(ctx, logW, h, height, period, wind, tRef.current || 1.5)

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      sync()
    }, { rootMargin: '100px' })
    io.observe(canvas)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      cancelAnimationFrame(rafRef.current)
    }
  }, [height, period, wind, _width, h])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: h }}
    />
  )
}
