// ─── FotoWorld Attendance — Service Worker ────────────────────────────────────
// Strategy:
//   • Static assets  → Cache First  (HTML, CSS, JS, images, fonts)
//   • API / Firebase → Network First (always fresh data)

const CACHE_NAME = 'fotoworld-v1';
const STATIC_CACHE = 'fotoworld-static-v1';
const DYNAMIC_CACHE = 'fotoworld-dynamic-v1';

// Resources to pre-cache on install
const PRE_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.png',
    '/logo.png',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing…');
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[SW] Pre-caching static assets');
            return cache.addAll(PRE_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating…');
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
                    .map((k) => {
                        console.log('[SW] Deleting old cache:', k);
                        return caches.delete(k);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // ── Skip non-GET and chrome-extension requests ────────────────────────────
    if (request.method !== 'GET') return;
    if (url.protocol === 'chrome-extension:') return;

    // ── Network First: Firebase, API calls, external requests ─────────────────
    const isFirebase = url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('firebasestorage.googleapis.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('securetoken.googleapis.com') ||
        url.pathname.startsWith('/api/') ||
        url.hostname.includes('anthropic.com');

    if (isFirebase) {
        event.respondWith(networkFirst(request));
        return;
    }

    // ── Cache First: Static assets (JS, CSS, images, fonts) ───────────────────
    const isStatic = url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|ico|webp)$/i);
    if (isStatic) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // ── App Shell: HTML navigation → Cache First with network fallback ────────
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(appShell(request));
        return;
    }

    // ── Default: Stale While Revalidate ──────────────────────────────────────
    event.respondWith(staleWhileRevalidate(request));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

/** Cache First — serve from cache, fall back to network and update cache */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline — resource not cached', { status: 503 });
    }
}

/** Network First — always try network, fall back to cache */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached ?? new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/** App Shell — serve index.html for all navigation requests */
async function appShell(request) {
    const cached = await caches.match('/index.html');
    if (cached) {
        // Revalidate in background
        fetch(request).then((res) => {
            if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res));
        }).catch(() => { });
        return cached;
    }
    try {
        return await fetch(request);
    } catch {
        return new Response('<h1>FotoWorld Offline</h1><p>Please reconnect to use this app.</p>', {
            headers: { 'Content-Type': 'text/html' },
        });
    }
}

/** Stale While Revalidate */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
    }).catch(() => null);
    return cached ?? await fetchPromise ?? new Response('Offline', { status: 503 });
}

// ── Push Notifications (future ready) ─────────────────────────────────────────
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? { title: 'FotoWorld', body: 'New notification' };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/favicon.png',
            badge: '/favicon.png',
        })
    );
});
