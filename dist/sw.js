const CACHE = "ascend-static-v25";
const FILES = [
  "./account.js", "./account-sync-model.js", "./password-lock-model.js",
  "./fluid.css", "./aid-model.js",
  "./mission.css", "./mission-home.js", "./mission-model.js", "./progress-ring.js",
  "./application-views.js",
  "./tools.css", "./workspace-tools.js", "./workspace-tools-model.js", "./privacy-lock.js", "./sync-core.js", "./device-sync.js", "./assets/ascend-mark.png",
  "./",
  "./index.html",
  "./styles.css",
  "./studio.css",
  "./extras.js",
  "./planning.js",
  "./calendar-model.js",
  "./planner.js",
  "./college-media.js",
  "./vendor/ical.js",
  "./app.js",
  "./core.js",
  "./icons.js",
  "./exports.js",
  "./favicon.svg",
  "./fonts/PlusJakartaSans.ttf",
  "./fonts/Newsreader.ttf",
];
const OPTIONAL_FILES = [
  "./data/college-media.json",
  "./data/colleges.json",
  "./data/high-schools.json",
];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll(FILES).then(() =>
          Promise.allSettled(OPTIONAL_FILES.map((f) => c.add?.(f) || Promise.resolve())),
        ),
      )
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("ascend-static-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    new URL(e.request.url).pathname.startsWith("/api/") ||
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== self.location.origin
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.status >= 500) {
          return caches.match(e.request).then((cached) => cached || r);
        }
        if (r.ok && r.type === "basic") {
          const copy = r.clone();
          e.waitUntil?.(caches.open(CACHE).then((c) => c.put(e.request, copy)));
        }
        return r;
      })
      .catch(() =>
        caches
          .match(e.request)
          .then(
            (r) =>
              r ||
              (e.request.mode === "navigate"
                ? caches.match("./index.html")
                : Response.error()),
          ),
      ),
  );
});
