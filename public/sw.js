/**
 * Service worker (feature review Tier 2 #5) — offline shell for the workspace.
 *
 * Why: at a competition the pit wifi is unreliable, and the calculators are pure
 * functions that don't need a server to run. With this, the site opens and the
 * tools compute from the last-known Master (cached by src/lib/offline.ts) while
 * offline; anything that needs the network says so instead of hanging.
 *
 * Strategy:
 *   - navigations: network first, fall back to the cached page, then to any
 *     cached page so you at least land somewhere useful;
 *   - built assets (/_astro/*, icons, data, templates): cache first, since Astro
 *     fingerprints their filenames — a new build fetches new URLs;
 *   - everything else (Supabase, fonts): straight to the network, never cached.
 *     Shared state must never be served stale from here; the Master cache is an
 *     explicit, timestamped, clearly-labelled thing in app code instead.
 *
 * The cache name carries a version; bump it to retire old entries.
 */
const VERSION = 'blitz-v2';  // bumped for the P2-8 cache-strategy change
const SCOPE = new URL(self.registration.scope);
const BASE = SCOPE.pathname.replace(/\/+$/, '');
const p = (path) => `${BASE}/${path.replace(/^\/+/, '')}`;

// The shell worth having before you lose signal. Kept short on purpose: every
// entry is a build-time URL that must exist, or install fails.
const PRECACHE = [p(''), p('vehicle-spec'), p('readiness'), p('offline.html'), p('icons/blitz-icon.svg')];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // addAll is all-or-nothing, so add individually: one missing page must not
    // stop the whole worker from installing.
    await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

// /_astro/* is content-hashed, so a new build gets a new URL — safe to serve
// cache-first forever. Everything else static (data seeds, templates, the
// cooling tool, icons) keeps a STABLE path, so caching it first-and-forever
// meant a device never saw an update (audit P2-8). Those are served
// stale-while-revalidate instead: instant from cache, refreshed in the
// background for next time.
const isHashed = (url) => url.pathname.startsWith(`${BASE}/_astro/`);
const isRevalidate = (url) =>
  url.pathname.startsWith(`${BASE}/icons/`) ||
  url.pathname.startsWith(`${BASE}/data/`) ||
  url.pathname.startsWith(`${BASE}/templates/`) ||
  url.pathname.startsWith(`${BASE}/tools/`);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Supabase, fonts: network only

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(VERSION);
        return (await cache.match(req, { ignoreSearch: true }))
          ?? (await cache.match(p('offline.html')))
          ?? (await cache.match(p('')))
          ?? new Response('Offline and this page was never cached.', { status: 503, headers: { 'content-type': 'text/plain' } });
      }
    })());
    return;
  }

  if (isHashed(url)) {
    // Cache-first: the filename changes when the content does.
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      const fresh = await fetch(req);
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })());
    return;
  }

  if (isRevalidate(url)) {
    // Stale-while-revalidate: serve the cache immediately, update it in the
    // background so the next load has the newer file.
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      const network = fetch(req).then((fresh) => { if (fresh.ok) cache.put(req, fresh.clone()); return fresh; }).catch(() => null);
      return hit ?? (await network) ?? new Response('Offline and not cached.', { status: 503, headers: { 'content-type': 'text/plain' } });
    })());
  }
});
