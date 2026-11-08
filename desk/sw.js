/* Desk service worker: keeps the app shell offline. Data is always fetched fresh when online. */
var SHELL = "desk-shell-v6";
var FILES = ["./", "index.html", "app.js?v=6", "app.css?v=6", "manifest.webmanifest", "../apple-touch-icon.png", "../icon-192.png", "../icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== SHELL; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.slice(-14) === "data.enc.json") return; /* the app handles data and its own offline copy */
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(function (r) {
      if (r && r.ok) { var copy = r.clone(); caches.open(SHELL).then(function (c) { c.put(e.request, copy); }); }
      return r;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match("index.html"); }); })
  );
});
