/* PìgBiz service worker: Web Push for the smart piggy bank. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const opts = {
    body: data.body || "Загляни в копилку 🐷",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: data.tag || "pigsen",
    renotify: true,
    data: { url: data.url || "/savings" },
  };
  if (data.image) opts.image = data.image;
  event.waitUntil(self.registration.showNotification(data.title || "PìgBiz", opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/savings", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === url.origin && "focus" in c) {
          c.navigate(url.href);
          return c.focus();
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
