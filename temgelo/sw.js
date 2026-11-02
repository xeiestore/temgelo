// Tem Gelo? – Service Worker (basic offline shell)
const CACHE_NAME = "temgelo-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./seller.html",
  "./admin.html",
  "./css/styles.css",
  "./js/sellers.js",
  "./js/app.js",
  "./js/admin.js",
  "./js/seller.js",
  "./manifest.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") {
    return;
  }

  if (url.origin !== self.location.origin) {
    // Catalog / Worker API: never cache – always network (admin publish must show ASAP)
    if (
      url.hostname.includes("workers.dev") ||
      url.pathname.includes("/catalog") ||
      url.hostname.includes("cloudinary") ||
      url.pathname.includes("catalog.json")
    ) {
      event.respondWith(
        fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request))
      );
      return;
    }
    if (url.hostname.includes("unpkg.com")) {
      event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
      );
    }
    return;
  }

  // HTML / navigations: always prefer network so hamburger & UI updates show up
  const isHTML =
    event.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/" ||
    url.pathname.endsWith("/");

  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
              // Also store under index.html key for logo / start_url
              if (url.pathname === "/" || url.pathname.endsWith("/")) {
                cache.put("./index.html", res.clone());
              }
            });
          }
          return res;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((c) => c || caches.match("./index.html") || caches.match("./"))
        )
    );
    return;
  }

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
