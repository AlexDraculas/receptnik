"use strict";

// Cookly service worker: caches the app shell (HTML/CSS/JS/icons) so the app
// installs as a real PWA and keeps working offline once it's been opened at
// least once. It intentionally does NOT cache API calls (auth, sync, the AI
// proxy) — those must always hit the network; offline just means "the app
// shell loads and you can browse whatever recipes are already synced to
// localStorage", not "auth/AI features work with no connection".

const CACHE_VERSION = "cookly-v1";
const APP_SHELL = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  "js/core/storage-shim.js",
  "js/core/state.js",
  "js/core/i18n.js",
  "js/core/storage.js",
  "js/core/api.js",
  "js/timer/timer.js",
  "js/recipes/library.js",
  "js/recipes/share.js",
  "js/recipes/cart.js",
  "js/recipes/search.js",
  "js/recipes/add-recipe.js",
  "js/core/google-auth.js",
  "js/core/account.js",
  "js/profile/profile.js",
  "js/cooking/cooking.js",
  "js/app.js",
  "assets/brand/favicon.ico",
  "assets/brand/cookly-icon-32.png",
  "assets/brand/cookly-icon-64.png",
  "assets/brand/cookly-icon-96.png",
  "assets/brand/cookly-icon-180.png",
  "assets/brand/cookly-icon-192.png",
  "assets/brand/cookly-icon-512.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_VERSION; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Never intercept anything that isn't a plain same-origin GET for an app-shell
// file: this keeps the Google sign-in script, the Cloudflare Worker (auth,
// sync, the AI proxy), and any future cross-origin call untouched by the
// cache, and avoids ever caching a POST/PUT.
self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        // Only cache successful, basic (same-origin, non-opaque) responses.
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        // Offline and not in cache: fall back to the cached shell page so the
        // app still boots (client-side routing shows the right view from state).
        return caches.match("index.html");
      });
    })
  );
});
