// v4: v3 cached /_next/static cache-first with no revalidation, which pins the
// first bundle a browser ever sees. In production that is safe — those URLs are
// content-hashed, so a deploy changes the URL. In development it is poison:
// Turbopack reuses chunk names while their contents change, so the worker
// serves a stale bundle forever, immune to reloads and to deleting .next. The
// symptom is a hydration mismatch where the client renders older markup than
// the server, and nothing you change on disk has any effect.
const CACHE = 'wavefinder-v4'

// Assets to pre-cache on install
const PRECACHE = ['/', '/spots', '/regions']

// A service worker has no business running against a dev server: there is
// nothing to make offline, and cache-first fights HMR.
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'

self.addEventListener('install', (e) => {
  if (IS_DEV) { self.skipWaiting(); return }
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  // Self-heal: a browser already carrying the v3 worker gets here, wipes every
  // cache it left behind, and unregisters itself. Without this the poisoned
  // cache survives any amount of restarting on the server side.
  if (IS_DEV) {
    e.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    )
    return
  }
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (IS_DEV) return

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

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const tag = e.notification.tag ?? ''
  const slug = tag.startsWith('swell-') ? tag.slice(6) : null
  if (!slug) return
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const target = `/spots/${slug}`
      const existing = clients.find((c) => c.url.includes(target))
      if (existing) return existing.focus()
      return self.clients.openWindow(target)
    })
  )
})
