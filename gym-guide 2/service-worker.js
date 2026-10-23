/**
 * service-worker.js — Offline Support
 * ---------------------------------------------------------------
 * Precaches the entire app shell (HTML/CSS/JS/icons/manifest) so the
 * app opens and fully works with no network connection after the
 * first visit. Saved workout data itself lives in localStorage
 * (see js/modules/storage.js), which is always available offline
 * regardless of the service worker.
 *
 * Strategy:
 *  - Navigations (index.html): network-first, falling back to the
 *    cached shell offline, so online users always get the latest
 *    build while offline users still get a working app.
 *  - Static app-shell assets (css/js/icons/manifest/fonts): cache-first,
 *    since they're versioned by CACHE_NAME below. Fonts (Cairo +
 *    Space Grotesk, self-hosted under ./fonts/) are precached here too —
 *    the app no longer depends on Google Fonts at runtime, so text
 *    renders correctly even on a first-ever offline visit.
 *  - Everything cross-origin (YouTube thumbnails, external links) is
 *    left untouched — the browser handles those normally, and they
 *    simply won't load offline, which the in-app offline banner
 *    already explains to the user.
 *
 * IMPORTANT: bump CACHE_NAME's version suffix on every deploy that
 * changes any precached file, or returning visitors will keep seeing
 * the old cached build. See CHANGELOG.md for the current version.
 * ---------------------------------------------------------------
 */
const CACHE_NAME = "gym-guide-shell-v1.18.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./fonts/cairo-arabic-400.woff2",
  "./fonts/cairo-arabic-600.woff2",
  "./fonts/cairo-arabic-700.woff2",
  "./fonts/cairo-arabic-800.woff2",
  "./fonts/cairo-arabic-900.woff2",
  "./fonts/cairo-latin-400.woff2",
  "./fonts/cairo-latin-600.woff2",
  "./fonts/cairo-latin-700.woff2",
  "./fonts/cairo-latin-800.woff2",
  "./fonts/cairo-latin-900.woff2",
  "./fonts/space-grotesk-500.woff2",
  "./fonts/space-grotesk-600.woff2",
  "./fonts/space-grotesk-700.woff2",
  "./js/app.js",
  "./js/modules/adaptive-meta.js",
  "./js/modules/adaptive-workout.js",
  "./js/modules/adaptive-ui.js",
  "./js/modules/data.js",
  "./js/modules/exercises-data.js",
  "./js/modules/exercises.js",
  "./js/modules/goals.js",
  "./js/modules/injury.js",
  "./js/modules/navigation.js",
  "./js/modules/onboarding.js",
  "./js/modules/nutrition.js",
  "./js/modules/recovery.js",
  "./js/modules/storage.js",
  "./js/modules/store.js",
  "./js/modules/timer.js",
  "./js/modules/ui.js",
  "./js/modules/workout.js",
  "./js/modules/dashboard.js",
  "./js/modules/corrective.js",
  "./js/modules/metrics.js",
  "./js/modules/program.js",
  "./js/modules/schedule.js",
  "./js/modules/support.js",
  "./js/modules/profile.js",
  "./js/modules/progression.js",
  "./js/modules/exercise-alternatives.js",
  "./js/modules/replacements.js",
  "./js/modules/progress.js",
  "./js/modules/progress-ui.js",
  "./js/modules/alternatives-ui.js",
  "./js/modules/icons.js",
  "./js/modules/muscle-icons.js",
  "./icons/favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // cache:"reload" bypasses the browser's HTTP cache, so an upgrade can never precache
      // stale copies of the old build (hosts that send max-age would otherwise mix versions).
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never intercept non-GET requests
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin requests to the network

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    // No cache and no network — nothing we can do for this asset.
    return Response.error();
  }
}

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(req);
    return cached || caches.match("./index.html");
  }
}
