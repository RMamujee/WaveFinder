'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  /** Placeholder height before the section mounts, to avoid layout shift. */
  minHeight?: number
  /** How far below the viewport to start mounting (IntersectionObserver rootMargin). */
  rootMargin?: string
  style?: React.CSSProperties
}

// Defers mounting (and therefore any data fetching) of below-the-fold sections
// until the user scrolls near them, so their requests don't compete with the
// critical forecast fetch on initial page load.
export function LazyMount({ children, minHeight = 120, rootMargin = '500px', style }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    if (typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, rootMargin])

  return (
    <div ref={ref} style={visible ? style : { minHeight, ...style }}>
      {visible ? children : null}
    </div>
  )
}
