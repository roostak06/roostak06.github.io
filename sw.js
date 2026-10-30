const CACHE_NAME = "roostak-shell-v14";
const SHELL = ["./assets/brand-mark.png", "./manifest.webmanifest"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
// Network-first: HTML/JS/CSS are always fetched fresh when online (so new admin menu items,
// new categories and fixes appear without Ctrl+Shift+R). Cache is only an offline fallback.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request, { cache: "no-cache" }).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
  );
});


// Push notifications for Roostak admin.
self.addEventListener("push", event => {
  let data = { title: "اعلان جدید روستاک", body: "یک مورد جدید برای بررسی وجود دارد.", url: "./admin.html" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "./assets/icon-192.png", badge: "./assets/favicon-48.png", data: { url: data.url || "./admin.html" }, tag: data.tag || "roostak-admin-notification" }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./admin.html", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    for (const client of clients) { if (client.url.startsWith(self.location.origin) && "focus" in client) { client.navigate(target); return client.focus(); } }
    return self.clients.openWindow(target);
  }));
});
