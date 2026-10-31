// Tem Gelo? – Service Worker (basic offline shell)
const CACHE_NAME = "temgelo-v3";
const ASSETS = [
  "./",
  "./admin",
  "./css/styles.css",
  "./js/sellers.js",
  "./js/app.js",
  "./js/admin.js",
  "./manifest.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept non-GET (e.g. POST to Worker /publish) — let the browser handle CORS
  if (event.request.method !== "GET") {
    return;
  }

  // Cross-origin: only handle known CDN assets we precache; everything else pass through
  if (url.origin !== self.location.origin) {
    if (url.hostname.includes("cloudinary") || url.pathname.includes("catalog.json")) {
      event.respondWith(
        fetch(event.request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return res;
          })
          .catch(() => caches.match(event.request))
      );
    }
    // unpkg / other CDNs: cache-first if we have it, else network (no respondWith required if we want pass-through)
    // Still allow offline Leaflet
    if (url.hostname.includes("unpkg.com")) {
      event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
      );
    }
    return;
  }

  // Same-origin navigations: network first (Cloudflare clean URLs / 308)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("./")))
    );
    return;
  }

  // Same-origin static assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});
