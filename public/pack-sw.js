// Burn pack offline copy. Only the pack page and the static files it uses are kept; every other
// request goes to the network untouched. With no signal, any page opens the saved pack.
const CACHE = "oe-burn-pack-v1";
const PACK = "/shifts/pack";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (e) => {
  const urls = e.data?.save || [];
  const port = e.ports[0];
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.all(urls.map((u) => c.add(new Request(u, { credentials: "same-origin" })))),
      )
      .then(() => port?.postMessage("saved"))
      .catch(() => port?.postMessage("failed")),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/backdrop/") ||
  /\.(woff2?|png|jpg|webp|svg|ico)$/.test(url.pathname);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    const isPack = url.pathname === PACK;
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (isPack && res.ok && !res.redirected)
            caches.open(CACHE).then((c) => c.put(PACK, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(PACK).then((hit) => hit || new Response("No signal", { status: 503 })),
        ),
    );
    return;
  }
  if (isStatic(url))
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && url.pathname.startsWith("/_next/static/"))
              caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
});
