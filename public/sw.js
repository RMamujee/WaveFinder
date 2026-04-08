const CACHE = 'wavefinder-v3'

// Assets to pre-cache on install
const PRECACHE = ['/', '/spots', '/regions']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Never intercept Next.js internals, auth, or API routes
  if (
    url.pathname.startsWith('/_next/webpack') ||
    url.pathname.startsWith('/api/') ||
    e.request.method !== 'GET'
  ) return

  // Cache-first for static assets (fonts, JS, CSS, images)
  if (
    url.pathname.startsWith('/_next/static') ||
    e.request.destination === 'font' ||
    e.request.destination === 'image'
  ) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached ?? fetch(e.request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
          return res
        })
      )
    )
    return
  }

  // Network-first for pages — fall back to cache when offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
