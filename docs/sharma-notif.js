/*! Sharma push notifications — drop-in enable module (v1, 2026-11-20).
   One self-contained file: copy it into any Sharma app, include it with
   <script src="sharma-notif.js" defer></script>, and put
   <div data-sharma-notif></div> wherever the settings panel should live
   (a More / Settings screen). It also exposes window.SharmaNotif.mount(el).

   Talks to the push worker (default https://sharma-push.sharma-crew.workers.dev,
   override with window.SHARMA_PUSH_BASE before this script loads):
     GET  /vapid-public-key            -> { publicKey } (plain text also accepted)
     POST /subscribe                   -> { subscription, name, role, app }
     POST /unsubscribe                 -> { endpoint }
     GET  /prefs?endpoint=<urlenc>     -> { prefs: { <type>: true/false } }
     POST /prefs                       -> { endpoint, name, role, prefs }
     POST /test                        -> { endpoint }  (test sends go ONLY to
                                        the caller's own subscription; the
                                        alert route /send is server-side only
                                        and is never called from a page)
   If the worker is unreachable the panel still renders and says so — it never
   breaks the host app. Holds no keys: the VAPID private key lives only on the
   worker. The public key is fetched at enable time, never baked in.

   Alert types (the worker's /send fans out on these exact keys):
     bid_due_24h, inspection_booked, inspection_passed, inspection_failed,
     permit_issued, new_lead, invoice_paid, invoice_past_due,
     builder_replied, schedule_change, punch_items
   Role defaults (Bob Myers spec, 2026-11-19): owner = all; office = bids,
   permits, inspections, billing; crew = schedule + punch only. */
(function () {
  "use strict";
  var BASE = (window.SHARMA_PUSH_BASE || "https://sharma-push.sharma-crew.workers.dev").replace(/\/$/, "");
  var APP = window.SHARMA_APP_NAME || (document.title || "Sharma app").split("—")[0].trim();
  var LS_NAME = "sharma-notif-name", LS_ROLE = "sharma-notif-role";

  var ROWS = [
    { keys: ["bid_due_24h"], label: "Bid due in 24 hours" },
    { keys: ["inspection_booked", "inspection_passed", "inspection_failed"], label: "Inspections — booked, passed or failed" },
    { keys: ["permit_issued"], label: "Permit issued" },
    { keys: ["new_lead"], label: "New service call or lead" },
    { keys: ["invoice_paid", "invoice_past_due"], label: "Invoice paid or past due" },
    { keys: ["builder_replied"], label: "Builder replied" },
    { keys: ["schedule_change"], label: "Crew schedule change for tomorrow" },
    { keys: ["punch_items"], label: "New punch items" }
  ];
  var ALL_KEYS = [];
  ROWS.forEach(function (r) { r.keys.forEach(function (k) { ALL_KEYS.push(k); }); });
  var ROLE_DEFAULTS = {
    owner: ALL_KEYS,
    office: ["bid_due_24h", "inspection_booked", "inspection_passed", "inspection_failed", "permit_issued", "invoice_paid", "invoice_past_due"],
    crew: ["schedule_change", "punch_items"]
  };
  function defaultsFor(role) {
    var on = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.owner, p = {};
    ALL_KEYS.forEach(function (k) { p[k] = on.indexOf(k) !== -1; });
    return p;
  }

  var CSS = [
    ".sn-panel{font-family:inherit;color:inherit}",
    ".sn-panel *{box-sizing:border-box}",
    ".sn-title{font-size:20px;font-weight:700;color:#264387;margin:4px 0 8px}",
    "[data-scheme=\"dark\"] .sn-title{color:#F0A846}",
    ".sn-note{font-size:18px;line-height:1.45;margin:0 0 12px}",
    ".sn-tip{font-size:18px;line-height:1.45;background:#264387;color:#fff;border-radius:12px;padding:14px 16px;margin:0 0 12px}",
    ".sn-tip b{color:#F0A846}",
    ".sn-field{margin:0 0 12px}",
    ".sn-field label{display:block;font-size:18px;font-weight:600;margin:0 0 6px}",
    ".sn-field input,.sn-field select{width:100%;min-height:48px;font-size:18px;padding:10px 12px;border:1.5px solid #264387;border-radius:10px;background:transparent;color:inherit}",
    ".sn-btn{display:block;width:100%;min-height:52px;font-size:18px;font-weight:700;border:0;border-radius:12px;background:#264387;color:#fff;padding:12px 16px;cursor:pointer;margin:0 0 10px}",
    ".sn-btn--gold{background:#F0A846;color:#264387}",
    ".sn-btn--ghost{background:transparent;color:#264387;border:1.5px solid #264387}",
    "[data-scheme=\"dark\"] .sn-btn--ghost{color:#F0A846;border-color:#F0A846}",
    ".sn-btn[disabled]{opacity:.5;cursor:default}",
    ".sn-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 0;border-bottom:1px solid rgba(38,67,135,.18)}",
    ".sn-row__label{flex:1;font-size:18px;line-height:1.35}",
    ".sn-switch{position:relative;flex:none;width:58px;height:34px}",
    ".sn-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}",
    ".sn-track{position:absolute;inset:0;border-radius:999px;background:#9aa7bd;transition:background .15s;pointer-events:none}",
    ".sn-track:after{content:\"\";position:absolute;top:3px;left:3px;width:28px;height:28px;border-radius:50%;background:#fff;transition:left .15s}",
    ".sn-switch input:checked + .sn-track{background:#264387}",
    ".sn-switch input:checked + .sn-track:after{left:27px;background:#F0A846}",
    ".sn-status{font-size:18px;line-height:1.45;margin:10px 0 0}",
    ".sn-status--err{color:#b3261e}"
  ].join("\n");
  var styleDone = false;
  function injectCSS() {
    if (styleDone) return; styleDone = true;
    var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s);
  }

  function urlB64ToUint8(base64) {
    var pad = "=".repeat((4 - (base64.length % 4)) % 4);
    var raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function jfetch(path, opts) {
    return fetch(BASE + path, opts).then(function (r) {
      if (!r.ok) throw new Error("push service " + r.status);
      var ct = r.headers.get("content-type") || "";
      return ct.indexOf("json") !== -1 ? r.json() : r.text();
    });
  }

  function mount(el) {
    if (!el || el.__snMounted) return;
    el.__snMounted = true;
    injectCSS();
    el.classList.add("sn-panel");
    var state = { sub: null, prefs: null, busy: false };

    function name() { return (localStorage.getItem(LS_NAME) || "").trim(); }
    function role() { return localStorage.getItem(LS_ROLE) || "owner"; }

    function render(html) { el.innerHTML = html; wire(); }
    function status(msg, err) {
      var s = el.querySelector(".sn-status");
      if (s) { s.textContent = msg || ""; s.className = "sn-status" + (err ? " sn-status--err" : ""); }
    }
    function head() { return '<div class="sn-title">Notifications</div>'; }
    function identityFields() {
      return '<div class="sn-field"><label for="sn-name">Your name</label>' +
        '<input id="sn-name" type="text" autocomplete="name" placeholder="e.g. Sanjay" value="' + name().replace(/"/g, "&quot;") + '"></div>' +
        '<div class="sn-field"><label for="sn-role">Role</label><select id="sn-role">' +
        ["owner", "office", "crew"].map(function (r) {
          return '<option value="' + r + '"' + (role() === r ? " selected" : "") + ">" + r.charAt(0).toUpperCase() + r.slice(1) + "</option>";
        }).join("") + "</select></div>";
    }

    function renderUnsupported() {
      render(head() + '<p class="sn-note">This browser does not support push notifications. On iPhone, open this app from its Home Screen icon (iOS 16.4 or later).</p>');
    }
    function renderNeedsInstall() {
      render(head() +
        '<div class="sn-tip"><b>iPhone:</b> push only works after this app is on your Home Screen. Tap the <b>Share</b> button, then <b>Add to Home Screen</b>. Open the app from its new icon, come back here, and tap Enable notifications.</div>' +
        identityFields() +
        '<button class="sn-btn" id="sn-enable" disabled>Enable notifications</button>' +
        '<p class="sn-status"></p>');
    }
    function renderEnable() {
      var denied = ("Notification" in window) && Notification.permission === "denied";
      render(head() +
        '<p class="sn-note">Get alerts on this phone for bids, inspections, permits and more — only the ones you switch on.</p>' +
        identityFields() +
        '<button class="sn-btn" id="sn-enable"' + (denied ? " disabled" : "") + '>Enable notifications</button>' +
        (denied ? '<p class="sn-note">Notifications are blocked for this app. On iPhone: Settings &gt; Notifications &gt; this app &gt; Allow Notifications, then come back.</p>' : "") +
        '<p class="sn-status"></p>');
    }
    function renderOn() {
      var p = state.prefs || defaultsFor(role());
      var rows = ROWS.map(function (r) {
        var on = r.keys.every(function (k) { return p[k]; });
        return '<div class="sn-row"><div class="sn-row__label">' + r.label + '</div>' +
          '<span class="sn-switch"><input type="checkbox" data-keys="' + r.keys.join(",") + '"' + (on ? " checked" : "") + '><span class="sn-track"></span></span></div>';
      }).join("");
      render(head() +
        '<p class="sn-note">Notifications are <b>on</b> for this phone' + (name() ? " (" + name().replace(/</g, "&lt;") + ", " + role() + ")" : "") + '.</p>' +
        rows +
        '<div style="height:12px"></div>' +
        '<button class="sn-btn sn-btn--gold" id="sn-test">Send test notification</button>' +
        '<button class="sn-btn sn-btn--ghost" id="sn-off">Turn off notifications</button>' +
        '<p class="sn-status"></p>');
    }

    function saveIdentity() {
      var n = el.querySelector("#sn-name"), r = el.querySelector("#sn-role");
      if (n) localStorage.setItem(LS_NAME, n.value.trim());
      if (r) localStorage.setItem(LS_ROLE, r.value);
    }

    function loadPrefs(endpoint) {
      return jfetch("/prefs?endpoint=" + encodeURIComponent(endpoint))
        .then(function (d) { state.prefs = (d && d.prefs) || defaultsFor(role()); })
        .catch(function () { state.prefs = defaultsFor(role()); });
    }
    function pushPrefs() {
      if (!state.sub) return Promise.resolve();
      return jfetch("/prefs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: state.sub.endpoint, name: name(), role: role(), prefs: state.prefs })
      });
    }

    function enable() {
      if (state.busy) return; state.busy = true;
      saveIdentity();
      status("Turning on…");
      var btn = el.querySelector("#sn-enable"); if (btn) btn.disabled = true;
      Notification.requestPermission().then(function (perm) {
        if (perm !== "granted") { state.busy = false; renderEnable(); status("Permission was not granted.", true); return null; }
        return navigator.serviceWorker.ready;
      }).then(function (reg) {
        if (!reg) return null;
        return jfetch("/vapid-public-key").then(function (d) {
          var key = typeof d === "string" ? d.trim() : (d.publicKey || d.key || "");
          if (!key) throw new Error("no public key");
          return reg.pushManager.getSubscription().then(function (existing) {
            if (existing) return existing;
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(key) });
          });
        });
      }).then(function (sub) {
        if (!sub) return;
        state.sub = sub;
        return jfetch("/subscribe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON(), name: name(), role: role(), app: APP })
        }).then(function () { return loadPrefs(sub.endpoint); }).then(function () {
          return pushPrefs();
        }).then(function () {
          state.busy = false; renderOn(); status("Notifications are on.");
        });
      }).catch(function () {
        state.busy = false;
        renderEnable();
        status("The notification service is not reachable yet. Nothing was changed — try again later.", true);
      });
    }

    function disable() {
      if (!state.sub) return;
      var endpoint = state.sub.endpoint;
      state.sub.unsubscribe().catch(function () {}).then(function () {
        state.sub = null;
        jfetch("/unsubscribe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: endpoint })
        }).catch(function () {});
        renderEnable(); status("Notifications are off on this phone.");
      });
    }

    function test() {
      if (!state.sub) { status("Turn notifications on first.", true); return; }
      status("Sending test…");
      jfetch("/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: state.sub.endpoint })
      }).then(function () { status("Test sent — it should appear on this phone in a few seconds."); })
        .catch(function () { status("The notification service is not reachable yet — the test was not sent.", true); });
    }

    function wire() {
      var en = el.querySelector("#sn-enable"); if (en) en.addEventListener("click", enable);
      var off = el.querySelector("#sn-off"); if (off) off.addEventListener("click", disable);
      var t = el.querySelector("#sn-test"); if (t) t.addEventListener("click", test);
      var n = el.querySelector("#sn-name"); if (n) n.addEventListener("change", saveIdentity);
      var r = el.querySelector("#sn-role");
      if (r) r.addEventListener("change", function () {
        saveIdentity();
        if (state.sub) { state.prefs = defaultsFor(role()); pushPrefs().then(function () { renderOn(); status("Role saved — alert switches reset to the " + role() + " defaults."); }); }
      });
      Array.prototype.forEach.call(el.querySelectorAll(".sn-switch input"), function (input) {
        input.addEventListener("change", function () {
          var keys = input.getAttribute("data-keys").split(",");
          if (!state.prefs) state.prefs = defaultsFor(role());
          keys.forEach(function (k) { state.prefs[k] = input.checked; });
          pushPrefs().then(function () { status("Saved."); }).catch(function () { status("Could not reach the notification service — the change was not saved.", true); });
        });
      });
    }

    /* boot */
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { renderUnsupported(); return; }
    if (isIOS() && !isStandalone()) { renderNeedsInstall(); return; }
    if (Notification.permission === "denied") { renderEnable(); return; }
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription();
    }).then(function (sub) {
      if (sub) { state.sub = sub; loadPrefs(sub.endpoint).then(renderOn); }
      else renderEnable();
    }).catch(function () { renderEnable(); });
  }

  function autoMount() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-sharma-notif]"), mount);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount);
  else autoMount();

  window.SharmaNotif = { mount: mount, base: BASE, types: ALL_KEYS.slice() };
})();
