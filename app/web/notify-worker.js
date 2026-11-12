// The app's service worker in a browser, `/notify-worker.js`, which `scripts/web-build.sh` puts
// beside the page: it shows the notifications (`app/web/notify.ts`), since Chrome on Android and an
// installed web app show none made with `new Notification`, and it opens what a click names. It
// takes no request: the page loads as it would without it.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A click brings the app's tab up and tells it the address the notification names; with no tab
// open, it opens the address the notification names.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { href } = event.notification.data ?? {};
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      const tab = tabs.find((client) => client.frameType === "top-level");
      if (tab !== undefined) {
        await tab.focus();
        // A client of this worker is of its origin, and its `postMessage` takes none.
        // oxlint-disable-next-line unicorn/require-post-message-target-origin
        tab.postMessage({ uraedaOpened: href });
      } else if (typeof href === "string") {
        await self.clients.openWindow(href);
      }
    })(),
  );
});
