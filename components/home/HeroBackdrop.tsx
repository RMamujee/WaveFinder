'use client'

import { useEffect, useRef } from 'react'

interface Props {
  className?: string
  style?: React.CSSProperties
}

// Reads CSS variable values at runtime — falls back to hex literals for SSR/tests
const OCEAN_700 = '#0e4d88'

interface SwellLine {
  y: number        // base y position (fraction of height)
  phase: number    // horizontal phase offset
  amp: number      // vertical amplitude
  speed: number    // animation speed
  opacity: number  // 0.06–0.14
}

function buildLines(count: number): SwellLine[] {
  const lines: SwellLine[] = []
  for (let i = 0; i < count; i++) {
    lines.push({
      y:       0.1 + (i / (count - 1)) * 0.8,
      phase:   Math.random() * Math.PI * 2,
      amp:     4 + Math.random() * 8,
      speed:   0.08 + Math.random() * 0.12,
      opacity: 0.06 + Math.random() * 0.08,
    })
  }
  return lines
}

const LINES = buildLines(12)

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  reduced: boolean,
) {
  // Background gradient: ocean-50 → ocean-100
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#f0f8ff')  // --ocean-50
  bg.addColorStop(1, '#dbeeff')  // --ocean-100
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Swell lines
  for (const line of LINES) {
    const baseY  = line.y * h
    const offset = reduced ? line.phase : t * line.speed + line.phase
    const waveLen = w * 0.6

    ctx.beginPath()
    for (let x = 0; x <= w; x += 3) {
      const y = baseY + Math.sin((x / waveLen) * 2 * Math.PI + offset) * line.amp
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = OCEAN_700
    ctx.globalAlpha = line.opacity
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

export function HeroBackdrop({ className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const tRef      = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      if (!canvas) return
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      drawBackdrop(ctx!, canvas.width, canvas.height, tRef.current, reduced)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    if (reduced) return () => ro.disconnect()

    let last = performance.now()
    function loop(now: number) {
      const dt = (now - last) / 1000
      last = now
      tRef.current += dt
      if (canvas && ctx) drawBackdrop(ctx, canvas.width, canvas.height, tRef.current, false)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  )
}
