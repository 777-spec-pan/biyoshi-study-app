const CACHE_NAME = "biyoshi-master-v2-0";
const ASSETS = [
  "./data/50.json",
  "./data/51.json",
  "./data/52.json",
  "./data/53.json",
  "./data-loader.js",
  "./",
  "index.html",
  "style.css",
  "config.js",
  "questions.js",
  "app.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
