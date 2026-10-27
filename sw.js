/* The production build fills these two placeholders. */
const PRECACHE_PATHS = [
  "./THIRD_PARTY_LICENSES.txt",
  "./assets/index-BTUCdXxd.js",
  "./assets/index-DK7lAt10.css",
  "./icon.svg",
  "./index.html",
  "./manifest.webmanifest"
];
const VERSION = "89b432ae51d25da9";
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `tiny-tides-${encodeURIComponent(SCOPE.pathname)}-`;
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const INDEX_URL = new URL("./index.html", SCOPE).href;
const PRECACHE_URLS = Array.isArray(PRECACHE_PATHS)
  ? PRECACHE_PATHS.map((path) => new URL(path, SCOPE).href)
  : [];
const ASSETS = new Map(PRECACHE_URLS.map((url) => [new URL(url).pathname, url]));

self.addEventListener("install", (event) => {
  // An update waits until existing game tabs are closed before activating.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;

  const isAppEntry = url.pathname === SCOPE.pathname || url.href.split("?")[0] === INDEX_URL;
  if (request.mode === "navigate" && isAppEntry) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          // Keep the cached shell paired with this worker's exact asset version.
          // A newer online document must not overwrite the old offline shell
          // while its replacement worker is still waiting to activate.
          return await fetch(request);
        } catch {
          return (await cache.match(INDEX_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Only build-listed files are cached: API calls and unrelated pages pass through.
  const assetURL = ASSETS.get(url.pathname);
  if (!assetURL || request.mode === "navigate") return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(assetURL);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(assetURL, response.clone());
      return response;
    })(),
  );
});
