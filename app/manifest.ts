import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WaveFinder',
    short_name: 'WaveFinder',
    description: 'Free surf forecasts for 1,490+ surf spots worldwide',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdfaf5',
    theme_color: '#0e4d88',
    orientation: 'portrait-primary',
    categories: ['sports', 'weather'],
    icons: [
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icon.png',       sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon.png',       sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/logo.png',       sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo.png',       sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
