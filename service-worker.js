const CACHE_NAME = "rx-dex-core-v11";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./reaction.json",
  "./assets/css/styles.css",
  "./assets/js/app.js",
  "./assets/js/config.js",
  "./assets/js/state.js",
  "./assets/js/filters.js",
  "./assets/js/actions.js",
  "./assets/js/render.js",
  "./assets/js/image-resolver.js",
  "./assets/js/reaction-service.js",
  "./assets/js/favorites.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  const isAppShellFile =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.endsWith("/reaction.json") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js");

  if (isAppShellFile) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});