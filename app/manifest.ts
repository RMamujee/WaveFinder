import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WaveFinder',
    short_name: 'WaveFinder',
    description: 'Free surf forecasts for every California spot',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdfaf5',
    theme_color: '#0e4d88',
    orientation: 'portrait-primary',
    categories: ['sports', 'weather'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
