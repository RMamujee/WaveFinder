'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

interface Props {
  height?: number   // wave height in metres
  wind?: number     // wind speed in m/s
  width?: number
  canvasHeight?: number
}

function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const check = () => setIsDark(root.dataset.theme === 'offshore')
    check()
    const obs = new MutationObserver(check)
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return isDark
}

export function MiniWave({ height = 1, wind = 5, width = 280, canvasHeight = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const isDark    = useIsDarkTheme()

  const amplitude = 0.8 + Math.min(height, 10) * 0.22
  const chop      = Math.min(0.5, wind / 36)

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const baseY = H * 0.58
    const px    = (amplitude / 10) * H * 1.6

    const grad = ctx.createLinearGradient(0, 0, 0, H)
    if (isDark) {
      grad.addColorStop(0, '#1a4a7a')
      grad.addColorStop(1, '#0a2a50')
    } else {
      grad.addColorStop(0, '#b8ddff')
      grad.addColorStop(1, '#7ec0f5')
    }

    const points: [number, number][] = []
    for (let x = 0; x <= W; x += 2) {
      const phase1 = (x / W) * Math.PI * 4 - t * 0.55
      const phase2 = (x / W) * Math.PI * 7 - t * 0.9
      const y =
        baseY -
        px * Math.sin(phase1) -
        px * chop * Math.sin(phase2)
      points.push([x, y])
    }

    // Fill wave body
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (const [x, y] of points) ctx.lineTo(x, y)
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Crest highlight
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (const [x, y] of points) ctx.lineTo(x, y)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [amplitude, chop, isDark])

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      draw(0)
      return
    }

    let start: number | null = null
    const loop = (ts: number) => {
      if (!start) start = ts
      draw((ts - start) / 1000)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={canvasHeight}
      style={{ width: '100%', height: canvasHeight, display: 'block', borderRadius: '12px 12px 0 0' }}
    />
  )
}
