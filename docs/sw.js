/*! Sharma design kit v1.3 service worker. Copy to the app as /sw.js and call SK.registerSW("/sw.js").
   What it does:
   - App shell ("/") : network first (so a locked or expired phone goes to the lock screen), saved copy if
     there is no signal or the network takes over 2.5 s. Only a real unlocked page is saved.
   - Kit files (css, js, logo): served from the phone at once, refreshed in the background.
   - Never touches: /login, /logout (it wipes saved data first), /api/* (the app's SK.data handles
     last-data-first in the page), POSTs, or anything else.
   Holds no data, passcodes or keys. */
var VERSION = "sk-shell-v1.3";
var DATA = "sk-data-v1";
var KIT = new URL((new URL(self.location.href).searchParams.get("kit") || "https://sharma-kit.sharma-crew.workers.dev").replace(/\/$/, ""), self.location.href).href.replace(/\/$/, "");
var KIT_FILES = [KIT + "/sharma-kit.css", KIT + "/sharma-kit.js", KIT + "/assets/logo-white-header.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    /* the app shell, only if this phone is unlocked right now (a lock screen or redirect is never saved) */
    var page = fetch("/sharma-lead-finder/", { credentials: "same-origin", redirect: "manual", cache: "no-store" }).then(function (r) {
      if (r.ok && r.type === "basic" && (r.headers.get("content-type") || "").indexOf("text/html") === 0) return c.put("/sharma-lead-finder/", r);
    }).catch(function () {});
    return Promise.all([page].concat(KIT_FILES.map(function (u) {
      return fetch(u, { mode: "cors", cache: "no-cache" }).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
    })));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("sk-shell-") === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function wipe() { return Promise.all([caches.delete(DATA), caches.open(VERSION).then(function (c) { return c.delete("/sharma-lead-finder/"); })]); }

function shell(req) {
  var net = fetch(req).then(function (r) {
    if (r.type === "opaqueredirect" || r.redirected || r.status === 401 || r.status === 403) { wipe(); return r; }
    if (r.ok && (r.headers.get("content-type") || "").indexOf("text/html") === 0) {
      var copy = r.clone(); caches.open(VERSION).then(function (c) { return c.put("/sharma-lead-finder/", copy); });
    }
    return r;
  });
  var saved = caches.open(VERSION).then(function (c) { return c.match("/sharma-lead-finder/"); });
  return new Promise(function (resolve, reject) {
    var done = false;
    function give(r) { if (!done && r) { done = true; resolve(r); } }
    net.then(give, function () { saved.then(function (s) { if (s) give(s); else if (!done) { done = true; reject(new Error("offline")); } }); });
    setTimeout(function () { saved.then(give); }, 2500);
  });
}

function kitFile(e) {
  var req = e.request;
  return caches.open(VERSION).then(function (c) {
    return c.match(req.url).then(function (hit) {
      var fresh = fetch(req.url, { mode: "cors", cache: "no-cache" }).then(function (r) { if (r.ok) c.put(req.url, r.clone()); return r; });
      if (hit) { e.waitUntil(fresh.catch(function () {})); return hit; }
      return fresh.catch(function () { return fetch(req); });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (req.url.indexOf(KIT + "/") === 0 && /\.(css|js|png|svg)$/.test(url.pathname)) { e.respondWith(kitFile(e)); return; }
  if (url.origin === self.location.origin) {
    if (url.pathname === "/sharma-lead-finder/logout") { e.respondWith(wipe().then(function () { return fetch(req); })); return; }
    if (url.pathname === "/sharma-lead-finder/" && req.mode === "navigate") { e.respondWith(shell(req)); return; }
    return; /* /login, /api/*, everything else: straight to the network, never saved here */
  }
});
/*! Sharma push — service worker handlers (append to the app's existing sw.js).
   Purely additive: two new event listeners. They do not touch the install /
   activate / fetch handlers above them, so the kit shell caching behaves
   exactly as before. Payload shape comes from the push worker's /send:
   { type, title, body, url } (all optional except body text). */

self.addEventListener("push", function (e) {
  var data = {};
  if (e.data) {
    try { data = e.data.json() || {}; }
    catch (err) { data = { body: e.data.text() }; }
  }
  var title = data.title || "Sharma Electric & HVAC";
  var opts = {
    body: data.body || "",
    data: { url: data.url || self.registration.scope, type: data.type || "" },
    tag: data.tag || data.type || undefined
  };
  if (data.icon) opts.icon = data.icon;
  if (data.badge) opts.badge = data.badge;
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      var want;
      try { want = new URL(target, self.location.origin); } catch (err) { want = null; }
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        try {
          var u = new URL(c.url);
          if (want && u.origin === want.origin && u.pathname === want.pathname && "focus" in c) return c.focus();
        } catch (err) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
