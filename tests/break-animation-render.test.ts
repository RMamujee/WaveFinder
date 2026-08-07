import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BreakAnimation } from '@/components/forecast/BreakAnimation'
import type { SurfSpot } from '@/types/spot'
import type { ForecastHour } from '@/types/forecast'

// The diagram rendered perfectly and never moved. Nothing was broken in a way
// any existing check could see: the CSS shipped, the keyframes were valid, the
// data was good, and reduced-motion was off. The cause was that each animated
// element ALSO carried the SVG presentation attribute for the property being
// animated (`transform`, `stroke-dashoffset`, `r`), which competes with the
// animation and loses silently.
//
// These tests assert the shape of the markup rather than the pixels, because
// the pixels are exactly what nothing in CI can see.

const SPOT: SurfSpot = {
  id: 'malibu', slug: 'malibu', name: 'Malibu',
  region: 'Malibu, Los Angeles', country: 'USA',
  lat: 34.0353, lng: -118.6806,
  description: 'The most famous point break in California. Long, perfect rights peel from First Point.',
  difficulty: 'intermediate', facingDirection: 210, bottomType: 'rock',
}

function hourWith(swellPeriod: number): ForecastHour {
  return {
    time: '2026-08-07T15:00', waveHeight: 1.2, faceHeight: 1.4, wavePeriod: 12,
    waveDirection: 200, swellHeight: 1.1, swellPeriod, swellDirection: 197,
    windWaveHeight: 0.2,
    wind: { speed: 8, gust: 11, direction: 250, directionLabel: 'WSW' },
    rating: 'good', ratingScore: 62, wavePower: 7, uvIndex: 6,
    waterTemp: 18, airTempC: 21, weatherCode: 0, precipProb: 0,
  }
}

function render(hour: ForecastHour | null): string {
  return renderToStaticMarkup(createElement(BreakAnimation, { spot: SPOT, hour }))
}

/** Every `<path>`/`<circle>`/`<g>` tag in the markup, as raw strings. */
function tags(html: string): string[] {
  return html.match(/<(?:path|circle|g|rect)\b[^>]*>/g) ?? []
}

describe('BreakAnimation markup', () => {
  it('animates something at all when there is swell', () => {
    const html = render(hourWith(12))
    expect(html).toContain('animation-name:break-march')
    expect(html).toContain('animation-name:break-peel')
    expect(html).toContain('animation-name:break-peak')
  })

  it('never puts a competing presentation attribute on an animated element', () => {
    const html = render(hourWith(12))
    // Which attribute would clash with which keyframe.
    const clashes: Array<[string, RegExp]> = [
      ['break-march', /\btransform="/],
      ['break-peel', /\bstroke-dashoffset="/],
      ['break-peak', /\bstroke-width="|\bstroke-opacity="/],
    ]
    for (const tag of tags(html)) {
      for (const [keyframe, attr] of clashes) {
        if (tag.includes(keyframe) && attr.test(tag)) {
          throw new Error(`element animated by ${keyframe} also sets the attribute it animates:\n${tag}`)
        }
      }
    }
  })

  it('emits a duration and a finite delay for every animated element', () => {
    const html = render(hourWith(12))
    for (const tag of tags(html)) {
      if (!tag.includes('animation-name')) continue
      expect(tag, tag).toMatch(/animation-duration:[\d.]+s/)
      expect(tag, tag).not.toMatch(/animation-duration:(0s|NaNs)/)
      expect(tag, tag).not.toMatch(/NaN/)
    }
  })

  it('renders a real diagram with no animation when there is no swell', () => {
    const html = render(hourWith(0))
    expect(html).not.toContain('animation-name')
    // Still a scene, not an empty box: sea, shoal, land, peel and takeoff.
    expect(tags(html).length).toBeGreaterThan(6)
    expect(html).toContain('Period')
  })

  it('survives a null hour', () => {
    const html = render(null)
    expect(html).not.toContain('animation-name')
    expect(html).not.toContain('NaN')
    expect(tags(html).length).toBeGreaterThan(6)
  })

  it('puts fewer crest lines on screen for a longer period', () => {
    const short = render(hourWith(7)).match(/break-march/g)?.length ?? 0
    const long = render(hourWith(16)).match(/break-march/g)?.length ?? 0
    expect(long).toBeLessThan(short)
    expect(long).toBeGreaterThan(0)
  })

  it('describes itself for screen readers', () => {
    expect(render(hourWith(14))).toMatch(/aria-label="[^"]*Malibu[^"]*14 second swell period/)
  })
})
