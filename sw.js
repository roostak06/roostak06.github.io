const CACHE_NAME = "roostak-shell-v21";
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


// Web Push for private Roostak chat messages and admin alerts.
self.addEventListener("push", event => {
  let data = { title: "پیام جدید روستاک", body: "یک پیام جدید دریافت کردی.", url: "./index.html" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  const options={body:data.body||"",icon:"./assets/icon-192.png",badge:"./assets/favicon-48.png",data:{url:data.url||"./index.html",conversationId:data.conversationId||null},tag:data.tag||"roostak-notification",renotify:true};
  event.waitUntil(self.registration.showNotification(data.title||"روستاک",options));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data=event.notification.data||{};
  const target=new URL(data.url||"./index.html",self.location.origin);
  if(data.conversationId)target.searchParams.set("chat",data.conversationId);
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async clients=>{
    for(const client of clients){if(client.url.startsWith(self.location.origin)&&"focus" in client){await client.navigate(target.href);return client.focus();}}
    return self.clients.openWindow(target.href);
  }));
});
