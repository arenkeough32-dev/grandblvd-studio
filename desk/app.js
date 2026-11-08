/* Desk: Aren's private HQ app. Everything shown comes from data.enc.json, which is
   encrypted with a key that only lives on Aren's devices. Nothing readable is public. */
(function () {
  "use strict";

  var KEY_STORE = "desk.key.v1";
  var BLOB_STORE = "desk.blob.v1";
  var LOCAL_STORE = "desk.local.v1";
  var TAB_STORE = "desk.tab.v1";
  var STALE_HOURS = 36;

  var STATUSES = [
    { k: "not_contacted", label: "Not contacted" },
    { k: "booked", label: "Booked" },
    { k: "callback", label: "Call back" },
    { k: "vm_text", label: "Voicemail + text" },
    { k: "wants_email", label: "Wants email" },
    { k: "no_answer", label: "No answer" },
    { k: "messaged", label: "Messaged (waiting)" },
    { k: "not_interested", label: "Not interested" },
    { k: "handsoff", label: "Paused / hands off" }
  ];
  var CALL_OUTCOMES = ["booked", "callback", "vm_text", "wants_email", "no_answer", "not_interested"];
  var SLABEL = {};
  STATUSES.forEach(function (s) { SLABEL[s.k] = s.label; });

  var app = document.getElementById("app");
  var tabsEl = document.getElementById("tabs");
  var cryptoKey = null;
  var data = null;
  var local = loadLocal();
  var tab = safeGet(TAB_STORE) || "today";
  var geo = null;
  var alertsCache = null;

  /* ---------- small helpers ---------- */
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function loadLocal() {
    var d = null;
    try { d = JSON.parse(safeGet(LOCAL_STORE) || "null"); } catch (e) { d = null; }
    d = d && typeof d === "object" ? d : {};
    d.leads = d.leads || {}; d.decisions = d.decisions || {}; d.outbox = Array.isArray(d.outbox) ? d.outbox : []; d.sent = Array.isArray(d.sent) ? d.sent : [];
    return d;
  }
  function saveLocal() { safeSet(LOCAL_STORE, JSON.stringify(local)); }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : String(v));
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
  var BOOK_URL = "https://grandblvdstudio.com/book";
  function bookBtn(label) {
    return h("button", { type: "button", class: "bookbtn", onclick: function (e) {
      var b = e.currentTarget, txt = "Or pick a time that suits you: grandblvdstudio.com/book";
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject())
        .then(function () { toast("Booking link copied. Paste it in your text."); }, function () { window.prompt("Copy this:", txt); });
    }, text: label || "Copy booking link" });
  }
  function setKids(el, c) { el.replaceChildren(); add(el, c); }
  function toast(msg) {
    var t = h("div", { class: "toast", role: "status", text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function safeUrl(u) {
    try { var x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : null; } catch (e) { return null; }
  }
  function telHref(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.length === 10) d = "1" + d;
    return d.length >= 11 ? "tel:+" + d : null;
  }
  function fmtTime(d, tz) {
    try { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", weekday: "short", timeZone: tz }).format(d).replace(/^(\w+) /, "$1 "); }
    catch (e) { return d.toLocaleTimeString(); }
  }
  function ago(iso) {
    var t = Date.parse(iso); if (!t) return "";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    var hr = Math.round(m / 60); if (hr < 48) return hr + " h ago";
    return Math.round(hr / 24) + " days ago";
  }

  /* ---------- crypto (AES-256-GCM, key stays on this device) ---------- */
  function b64uToBytes(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(b) { var s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function importKey(str) {
    var raw = b64uToBytes(str.trim());
    if (raw.length !== 32) return Promise.reject(new Error("bad_key"));
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }
  function decryptBlob(key, blob) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64uToBytes(blob.iv) }, key, b64uToBytes(blob.ct))
      .then(function (buf) {
        if (!blob.z) return JSON.parse(new TextDecoder().decode(buf));
        if (typeof DecompressionStream === "undefined") throw new Error("old_browser");
        return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text().then(JSON.parse);
      });
  }
  function encryptObj(key, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj)))
      .then(function (buf) { return { v: 1, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(buf)) }; });
  }

  /* ---------- boot ---------- */
  function boot() {
    if (!window.crypto || !crypto.subtle) { app.replaceChildren(h("div", { class: "lock" }, h("h1", { text: "This browser can't open Desk" }), h("p", { class: "muted", text: "Open the link in Safari or Chrome over https." }))); return; }
    var m = /[#&]k=([A-Za-z0-9_\-]{40,50})/.exec(location.hash || "");
    if (m) { safeSet(KEY_STORE, m[1]); try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    var k = safeGet(KEY_STORE);
    if (!k) { renderLock(); return; }
    importKey(k).then(function (key) { cryptoKey = key; return loadData(); })
      .then(function () { renderShell(); flushOutbox(); })
      .catch(function (e) {
        if (e && e.message === "old_browser") { renderError("This phone's browser is too old for Desk. Update iOS or Chrome, then reopen."); return; }
        if (e && e.message === "no_data") { renderError("Desk can't reach its data and has no saved copy yet. Check your internet and reopen."); return; }
        safeDel(KEY_STORE); renderLock("That key didn't open the data. Paste or scan it again.");
      });
  }

  function loadData() {
    return fetch("data.enc.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
      .then(function (blob) {
        return decryptBlob(cryptoKey, blob).then(function (d) { data = d; data._offline = false; safeSet(BLOB_STORE, JSON.stringify(blob)); });
      }, function () {
        var saved = null; try { saved = JSON.parse(safeGet(BLOB_STORE) || "null"); } catch (e) { saved = null; }
        if (!saved) throw new Error("no_data");
        return decryptBlob(cryptoKey, saved).then(function (d) { data = d; data._offline = true; });
      });
  }

  function renderError(msg) {
    tabsEl.hidden = true;
    app.replaceChildren(h("div", { class: "lock" }, h("h1", { text: "Desk" }), h("p", { class: "muted", text: msg }), h("button", { class: "primary", type: "button", onclick: function () { location.reload(); }, text: "Try again" })));
  }

  function renderLock(err) {
    tabsEl.hidden = true;
    var input = h("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Key", placeholder: "Paste your key or unlock link" });
    var msg = h("p", { class: "small", role: "alert", text: err || "" });
    function tryKey(val) {
      var m = /k=([A-Za-z0-9_\-]{40,50})/.exec(val) || /^([A-Za-z0-9_\-]{40,50})$/.exec(val.trim());
      if (!m) { msg.textContent = "That doesn't look like a Desk key."; return; }
      safeSet(KEY_STORE, m[1]); boot();
    }
    var scanBtn = null;
    if ("BarcodeDetector" in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      scanBtn = h("button", { type: "button", onclick: function () { scanQR(tryKey, msg); }, text: "Scan the key QR code" });
    }
    app.replaceChildren(h("section", { class: "lock" },
      h("img", { class: "logo", src: "../icon-192.png", alt: "" }),
      h("h1", { text: "Desk is locked" }),
      h("p", { class: "muted", text: "Open your unlock link once on this phone, or paste the key here. The key stays on this phone and is never sent anywhere." }),
      input,
      h("div", { class: "row" }, h("button", { class: "primary", type: "button", onclick: function () { tryKey(input.value); }, text: "Unlock" }), scanBtn),
      msg));
  }

  function scanQR(done, msg) {
    var det; try { det = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { msg.textContent = "Scanning isn't available here. Paste the key instead."; return; }
    var video = h("video", { playsinline: true, muted: true, style: "width:100%;border-radius:14px" });
    var stop = h("button", { type: "button", text: "Cancel" });
    var box = h("div", { class: "stack" }, video, stop);
    app.querySelector(".lock").appendChild(box);
    var stream = null, live = true;
    function end() { live = false; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); box.remove(); }
    stop.addEventListener("click", end);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (s) {
      stream = s; video.srcObject = s; return video.play();
    }).then(function loop() {
      if (!live) return;
      det.detect(video).then(function (codes) {
        if (codes && codes[0] && codes[0].rawValue) { end(); done(codes[0].rawValue); } else requestAnimationFrame(loop);
      }, function () { requestAnimationFrame(loop); });
    }).catch(function () { end(); msg.textContent = "Camera not allowed. Paste the key instead."; });
  }

  /* ---------- outbox: phone -> HQ, encrypted, via the private events channel ---------- */
  function queueEvent(ev) {
    ev.at = new Date().toISOString(); ev.id = Math.random().toString(36).slice(2, 10);
    local.outbox.push(ev); saveLocal(); flushOutbox();
  }
  var flushing = false;
  function flushOutbox() {
    if (flushing || !cryptoKey || !data || !data.cfg || !data.cfg.events || !local.outbox.length) return;
    if (navigator.onLine === false) return;
    flushing = true;
    var ev = local.outbox[0];
    encryptObj(cryptoKey, ev).then(function (blob) {
      return fetch("https://ntfy.sh/" + encodeURIComponent(data.cfg.events), { method: "POST", body: JSON.stringify(blob) });
    }).then(function (r) {
      if (!r.ok) throw new Error("http");
      local.outbox.shift(); local.sent.unshift({ id: ev.id, t: ev.t, at: ev.at }); local.sent = local.sent.slice(0, 40); saveLocal();
      flushing = false; if (local.outbox.length) flushOutbox(); else render();
    }).catch(function () { flushing = false; render(); });
  }
  window.addEventListener("online", flushOutbox);
  window.addEventListener("hashchange", function () { if (/[#&]k=/.test(location.hash)) boot(); });

  /* ---------- shell ---------- */
  var ICONS = {
    today: "M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z",
    calls: "M6.6 3h3l1.5 4.5-2 1.5a12 12 0 0 0 5.9 5.9l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A17 17 0 0 1 4.6 5a2 2 0 0 1 2-2z",
    leads: "M4 5h16M4 12h16M4 19h10",
    near: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
    alerts: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"
  };
  var TABS = [["today", "Today"], ["calls", "Calls"], ["leads", "Leads"], ["near", "Near me"], ["alerts", "Alerts"]];

  function svgIcon(d) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(ns, "path"); p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.8"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
    s.appendChild(p); return s;
  }

  function renderShell() {
    tabsEl.hidden = false;
    tabsEl.replaceChildren.apply(tabsEl, TABS.map(function (t) {
      var b = h("button", { type: "button", "data-tab": t[0], onclick: function () { tab = t[0]; safeSet(TAB_STORE, tab); render(); window.scrollTo(0, 0); } }, svgIcon(ICONS[t[0]]), h("span", { text: t[1] }));
      return b;
    }));
    tabsEl.setAttribute("aria-label", "Sections");
    render();
    setInterval(updateClocks, 30000);
  }

  function topBar() {
    var built = data.builtAt ? Date.parse(data.builtAt) : 0;
    var hours = built ? (Date.now() - built) / 3600000 : 999;
    var stale = hours > STALE_HOURS || data._offline;
    var freshText = data._offline ? "Offline copy · updated " + ago(data.builtAt) : "Updated " + ago(data.builtAt);
    if (hours > STALE_HOURS) freshText = "Old data: updated " + ago(data.builtAt);
    return h("header", { class: "top" },
      h("div", { class: "clocks" },
        h("div", { class: "clock" }, h("span", { text: "Pattaya" }), h("b", { id: "c-bkk", text: fmtTime(new Date(), "Asia/Bangkok") })),
        h("div", { class: "clock" }, h("span", { text: "Florida" }), h("b", { id: "c-fl", text: fmtTime(new Date(), "America/New_York") }))),
      h("div", { class: "fresh" + (stale ? " stale" : ""), text: freshText }));
  }
  function updateClocks() {
    var a = document.getElementById("c-bkk"), b = document.getElementById("c-fl");
    if (a) a.textContent = fmtTime(new Date(), "Asia/Bangkok");
    if (b) b.textContent = fmtTime(new Date(), "America/New_York");
  }

  function render() {
    if (!data) return;
    Array.prototype.forEach.call(tabsEl.querySelectorAll("button"), function (b) {
      if (b.getAttribute("data-tab") === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    var body;
    if (tab === "calls") body = viewCalls();
    else if (tab === "leads") body = viewLeads();
    else if (tab === "near") body = viewNear();
    else if (tab === "alerts") body = viewAlerts();
    else body = viewToday();
    app.replaceChildren(topBar(), body);
  }

  /* ---------- lead helpers ---------- */
  function leadStatus(l) { var o = local.leads[l.id]; return o ? o.status : (l.status || "not_contacted"); }
  function isPending(id, kind) {
    return local.outbox.some(function (e) { return (kind === "lead" && e.t === "lead_status" && e.lead === id) || (kind === "dec" && e.t === "decision" && e.code === id); });
  }
  function statusChip(l) {
    var s = leadStatus(l);
    return h("span", { class: "chip st st-" + s, text: SLABEL[s] || s });
  }
  var CH_OPTS = [["call", "Call"], ["text", "Text"], ["walkin", "In person"]];
  var chosenCh = {};
  function chPicker(l) {
    var cur = chosenCh[l.id] || "call";
    return h("div", { class: "seg chpick", role: "group", "aria-label": "How you reached " + l.name },
      h("span", { class: "small muted", text: "How:" }),
      CH_OPTS.map(function (o) {
        return h("button", { type: "button", "aria-pressed": cur === o[0] ? "true" : "false", onclick: function (e) {
          chosenCh[l.id] = o[0];
          Array.prototype.forEach.call(e.currentTarget.parentNode.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b === e.currentTarget)); });
        }, text: o[1] });
      }));
  }
  function setLeadStatus(l, s, note) {
    local.leads[l.id] = { status: s, at: new Date().toISOString() }; saveLocal();
    queueEvent({ t: "lead_status", lead: l.id, name: l.name, status: s, note: note || "", ch: chosenCh[l.id] || "call", who: "you" });
    toast(l.name + ": " + (SLABEL[s] || s));
    render();
  }
  function syncLine() {
    if (local.outbox.length) return h("p", { class: "pending", text: local.outbox.length + " update" + (local.outbox.length > 1 ? "s" : "") + " waiting to reach HQ (needs internet)." });
    if (local.sent.length) return h("p", { class: "small muted", text: "Last update reached the HQ inbox " + ago(local.sent[0].at) + "." });
    return null;
  }

  /* ---------- Today ---------- */
  function viewToday() {
    var out = h("div", {});
    out.appendChild(h("h1", { text: "Today" }));
    var waiting = (data.decisions || []).filter(function (d) { return d.status === "waiting"; });
    if (waiting.length) {
      out.appendChild(h("section", { class: "band", "aria-label": "Waiting on you" },
        h("h2", { text: "Waiting on you (" + waiting.length + ")" }),
        waiting.map(function (d) {
          var mine = local.decisions[d.code];
          return h("div", { class: "card" },
            h("div", { class: "spread" }, h("h3", { text: d.code + " · " + d.title }), mine ? h("span", { class: "chip st-booked st", text: "You chose" }) : null),
            d.suggest ? h("p", { class: "small", text: "Suggested: " + d.suggest }) : null,
            (d.why || d.cost) ? h("details", {}, h("summary", { text: "Why it matters" }),
              d.why ? h("p", { class: "small muted", text: d.why }) : null,
              d.cost ? h("p", { class: "small muted", text: "Cost: " + d.cost }) : null) : null,
            (d.options && d.options.length) ? h("div", { class: "opts", role: "group", "aria-label": "Answer " + d.code },
              d.options.map(function (o) {
                return h("button", { type: "button", "aria-pressed": mine && mine.choice === o ? "true" : "false", onclick: function () {
                  if (!window.confirm("Send your answer to HQ?\n\n" + d.code + ": " + o)) return;
                  local.decisions[d.code] = { choice: o, at: new Date().toISOString() }; saveLocal();
                  queueEvent({ t: "decision", code: d.code, choice: o }); toast("Sent: " + d.code + " · " + o); render();
                }, text: o });
              })) : null,
            mine ? h("p", { class: isPending(d.code, "dec") ? "pending" : "small muted", text: "Your answer: " + mine.choice + (isPending(d.code, "dec") ? " (waiting for internet)" : " · sent " + ago(mine.at)) }) : null);
        })));
    }
    var top = data.top3 && data.top3.items ? data.top3.items : [];
    if (top.length) {
      out.appendChild(h("h2", { text: "Your top 3" }));
      out.appendChild(h("ol", { class: "stack", style: "padding-left:20px;margin:0" }, top.map(function (t) {
        return h("li", {}, h("p", { text: t.text }), t.why ? h("p", { class: "small muted", text: t.why }) : null);
      })));
    }
    var calls = callLeads();
    if (calls.length) {
      var done = calls.filter(function (l) { return CALL_OUTCOMES.indexOf(leadStatus(l)) >= 0; }).length;
      out.appendChild(h("h2", { text: "Calls" }));
      out.appendChild(h("div", { class: "card" },
        h("p", { text: (data.calls && data.calls.label ? data.calls.label + ": " : "") + done + " of " + calls.length + " logged" }),
        h("button", { class: "primary", type: "button", onclick: function () { tab = "calls"; safeSet(TAB_STORE, tab); render(); }, text: "Open the call list" })));
    }
    var up = data.upwork || [];
    if (up.length) {
      out.appendChild(h("h2", { text: "Upwork" }));
      out.appendChild(h("div", { class: "stack" }, up.map(function (u) {
        return h("div", { class: "card" },
          h("div", { class: "spread" }, h("h3", { text: u.client || u.job }), u.value ? h("span", { class: "mono small", text: u.value }) : null),
          u.job ? h("p", { class: "small muted wrap", text: u.job }) : null,
          h("p", { class: "small" }, u.stageLabel ? h("span", { class: "chip", text: u.stageLabel }) : null, " ", u.next || ""));
      })));
    }
    var m = data.money;
    if (m) {
      out.appendChild(h("h2", { text: "Money" }));
      out.appendChild(h("div", { class: "card" },
        h("div", { class: "spread" }, h("span", { text: "Cash in this month" }), h("b", { class: "mono", text: "$" + (m.cashIn || 0) })),
        m.cashNote ? h("p", { class: "small muted", text: m.cashNote }) : null,
        (m.subscriptions || []).map(function (s) { return h("div", { class: "spread small" }, h("span", { text: s.name + " · " + s.status }), h("span", { class: "mono", text: s.amount })); }),
        m.credits ? h("p", { class: "small muted", text: "Video credits left: " + m.credits.credits }) : null));
    }
    out.appendChild(h("h2", { text: "Book a call" }));
    out.appendChild(h("div", { class: "card" },
      h("p", { class: "small", text: "Shops can book a free 15-minute call any time. Add the link to every text and email." }),
      h("div", { class: "row" }, h("a", { class: "btn", href: BOOK_URL, target: "_blank", rel: "noopener noreferrer", text: "Open booking page" }), bookBtn())));
    out.appendChild(h("h2", { text: "Note to HQ" }));
    var ta = h("textarea", { "aria-label": "Note to HQ", placeholder: "Anything: a reply you got, a decision, a reminder. It lands in the HQ inbox." });
    out.appendChild(h("div", { class: "card" }, ta,
      h("button", { class: "primary", type: "button", onclick: function () {
        var v = ta.value.trim(); if (!v) return; queueEvent({ t: "note", text: v.slice(0, 1500) }); ta.value = ""; toast("Sent to the HQ inbox");
      }, text: "Send" }), syncLine()));
    out.appendChild(h("p", { class: "small muted", style: "margin-top:18px", text: "Source: " + (data.by || "HQ") + ", built " + (data.builtLabel || "") + ". Reopen the app to refresh." }));
    return out;
  }

  /* ---------- Calls ---------- */
  function callLeads() {
    var ids = data.calls && data.calls.order ? data.calls.order : [];
    var by = {}; (data.leads || []).forEach(function (l) { by[l.id] = l; });
    return ids.map(function (id) { return by[id]; }).filter(Boolean);
  }
  function viewCalls() {
    var c = data.calls || {};
    var list = callLeads();
    var out = h("div", {}, h("h1", { text: c.label || "Calls" }), c.window ? h("p", { class: "muted", text: c.window }) : null);
    if (c.opener) out.appendChild(h("div", { class: "card", style: "margin-top:12px;background:var(--accent-soft)" }, h("p", { class: "small", style: "font-weight:600", text: "Opener" }), h("p", { text: c.opener })));
    if (!list.length) { out.appendChild(h("p", { class: "empty", text: "No calls planned right now. HQ adds the next call list here." })); return out; }
    out.appendChild(h("div", { class: "stack", style: "margin-top:12px" }, list.map(function (l, i) {
      var tel = telHref(l.phone);
      var s = leadStatus(l);
      return h("article", { class: "card" },
        h("div", { class: "spread" }, h("h3", { text: (l.callSheet || ("#" + (i + 1))) + "  " + l.name }), statusChip(l)),
        h("div", { class: "row" }, tel ? h("a", { class: "btn primary call", href: tel, text: l.phone }) : h("span", { class: "call", text: l.phone || "No phone" }),
          l.phoneAlt ? h("a", { class: "btn", href: telHref(l.phoneAlt), text: "2nd: " + l.phoneAlt }) : null,
          bookBtn()),
        l.bestTime ? h("p", { class: "small muted", text: l.bestTime }) : null,
        l.contact ? h("p", { class: "small", text: "Ask for " + l.contact }) : null,
        h("div", { class: "row" }, tierBadge(l.tier, true)),
        heatBar(l),
        h("p", { text: "Hook: " + (l.hook || "") }),
        (l.flags || []).map(function (f) { return h("p", { class: "small", style: "color:var(--warn)", text: "⚑ " + f }); }),
        pitchBox(l),
        scriptBox(l),
        linkRow(l),
        chPicker(l),
        h("div", { class: "opts", role: "group", "aria-label": "Result for " + l.name }, CALL_OUTCOMES.map(function (k) {
          return h("button", { type: "button", "aria-pressed": s === k ? "true" : "false", onclick: function () { setLeadStatus(l, k); }, text: SLABEL[k] });
        })),
        isPending(l.id, "lead") ? h("p", { class: "pending", text: "Result waiting for internet" }) : null);
    })));
    out.appendChild(h("div", { class: "card", style: "margin-top:14px" },
      h("p", { class: "small muted", text: "Each tap goes to the HQ inbox on its own. Copy is a backup if you're offline." }),
      h("button", { type: "button", onclick: function () {
        var txt = (c.label || "Calls") + ":\n" + list.map(function (l) { return l.id + " " + l.name + ": " + (SLABEL[leadStatus(l)] || "not called"); }).join("\n");
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast("Copied. Paste it into the HQ chat."); }, function () { window.prompt("Copy this:", txt); });
      }, text: "Copy results" }), syncLine()));
    return out;
  }

  /* ---------- Leads ---------- */
  var leadQuery = "", leadFilter = "yourmove";
  function viewLeads() {
    var leads = (data.leads || []).slice();
    var counts = {}; leads.forEach(function (l) { var s = leadStatus(l); counts[s] = (counts[s] || 0) + 1; });
    var filters = [["yourmove", "Your move"], ["all", "All"]].concat(STATUSES.map(function (s) { return [s.k, s.label]; }));
    var yourMove = { booked: 1, callback: 1, wants_email: 1, vm_text: 1 };
    var search = h("input", { type: "search", value: leadQuery, placeholder: "Search shops, towns, hooks", "aria-label": "Search leads",
      oninput: function (e) { leadQuery = e.target.value; drawList(); } });
    var listEl = h("div", { class: "stack", style: "margin-top:10px" });
    function drawList() {
      var q = leadQuery.trim().toLowerCase();
      var rows = leads.filter(function (l) {
        var s = leadStatus(l);
        if (leadFilter === "yourmove" && !yourMove[s] && !(l.due && s === "not_contacted")) return false;
        if (leadFilter !== "all" && leadFilter !== "yourmove" && s !== leadFilter) return false;
        if (!q) return true;
        return [l.name, l.town, l.type, l.hook, l.contact].join(" ").toLowerCase().indexOf(q) >= 0;
      });
      rows.sort(leadSort);
      setKids(listEl, rows.length ? rows.map(leadCard) : h("p", { class: "empty", text: leadFilter === "yourmove" ? "Nothing waiting on you here. Try All." : "No leads match." }));
    }
    var seg = h("div", { class: "seg", role: "group", "aria-label": "Filter" }, filters.map(function (f) {
      var n = f[0] === "all" ? leads.length : f[0] === "yourmove" ? null : (counts[f[0]] || 0);
      if (n === 0) return null;
      return h("button", { type: "button", "aria-pressed": leadFilter === f[0] ? "true" : "false", onclick: function () { leadFilter = f[0]; render(); }, text: f[1] + (n !== null ? " " + n : "") });
    }));
    var out = h("div", {}, h("h1", { text: "Leads" }), tierKey(), statusBar(leads), search, h("div", { style: "margin-top:10px" }, seg), listEl);
    drawList();
    return out;
  }
  /* ---------- lead visuals: tier badge, heat bar, research dots, quick links ---------- */
  var TIER_TEXT = { A: "owner + checked gap", B: "checked shop", C: "thin" };
  function tierBadge(t, withText) {
    t = TIER_TEXT[t] ? t : "C";
    return h("span", { class: "tier tier-" + t, title: "Tier " + t + ": " + TIER_TEXT[t] },
      h("span", { class: "dot", "aria-hidden": "true" }), h("b", { text: t }), withText ? h("span", { class: "tier-txt", text: TIER_TEXT[t] }) : null);
  }
  function tierKey() {
    return h("div", { class: "tierkey", role: "note", "aria-label": "Tier key" }, ["A", "B", "C"].map(function (t) { return tierBadge(t, true); }));
  }
  function bkkToday() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(new Date()); }
  function addDays(ymd, n) { var d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function statusAtOf(l) { var o = local.leads[l.id]; return o ? o.at : l.statusAt; }
  function ownerNamed(l) { var c = String(l.contact || "").trim(); return !!c && c !== "-" && !/^(owner|the owner|family-owned|unknown|not found)$/i.test(c); }
  function phoneOk(l) { return !!l.phone && !/unverified|unconfirmed/i.test(String(l.phoneNote || "")); }
  /* Same five dots as the HQ dashboard */
  function checks(l) {
    var r = l.research || {};
    return [
      { k: "Owner", ok: ownerNamed(l) },
      { k: "Gap + link", ok: !!(l.hook && l.hookUrl) },
      { k: "Trading", ok: /^yes/i.test(String(r.stillTrading || "")) },
      { k: "Phone", ok: phoneOk(l) },
      { k: "Deep dive", ok: !!l.pitch }
    ];
  }
  /* Temperature comes from status, exactly as on HQ */
  var TEMP_RANK = { hot: 0, warm: 1, cold: 2, paused: 3, dead: 4 };
  function temperature(l) {
    var s = leadStatus(l);
    if (s === "booked" || s === "callback" || s === "wants_email") return "hot";
    if (s === "handsoff") return "paused";
    if (s === "not_interested") return "dead";
    if (s === "messaged" || s === "vm_text" || s === "no_answer") {
      var at = Date.parse(statusAtOf(l) || ""), fresh = at && (Date.now() - at) <= 10 * 86400000;
      var dueOk = !l.due || l.due >= addDays(bkkToday(), -1);
      if (fresh && dueOk) return "warm";
    }
    return "cold";
  }
  function dialWindowSoon() {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    var get = function (t) { var x = parts.filter(function (p) { return p.type === t; })[0]; return x ? x.value : ""; };
    var wd = get("weekday"), mins = (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10);
    if (["Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) < 0) return false;
    return mins >= 9 * 60 && mins < 12 * 60; /* open 10-12, or opens within 60 min */
  }
  /* Same heat score as the HQ dashboard (0-100) */
  function heat(l) {
    var s = leadStatus(l);
    var n = { booked: 50, callback: 48, wants_email: 45, vm_text: 30, messaged: 28, no_answer: 22, not_contacted: 15, handsoff: 0, not_interested: 0 }[s];
    if (n === undefined) n = 15;
    if (l.hook && l.hookUrl) n += 15; else if (l.hook && !/^no gap/i.test(l.hook)) n += 5;
    if (ownerNamed(l)) n += 10;
    if (l.due && l.due <= bkkToday()) n += 10;
    if (l.callSheet && dialWindowSoon()) n += 10;
    var at = Date.parse(statusAtOf(l) || "");
    if (temperature(l) === "hot" && at && Date.now() - at <= 48 * 3600000) n += 5;
    if (/unverified/i.test(String(l.phoneNote || "")) || l.tier === "C") n -= 10;
    return Math.max(0, Math.min(100, n));
  }
  function leadSort(a, b) {
    return (TEMP_RANK[temperature(a)] - TEMP_RANK[temperature(b)]) || (heat(b) - heat(a)) ||
      ((a.callOrder || 999) - (b.callOrder || 999)) || String(a.name).localeCompare(b.name);
  }
  function dueChip(l) {
    var d = l.nextTouch || l.due; if (!d) return null;
    var s = leadStatus(l); if (s === "not_interested" || s === "handsoff" || s === "booked") return null;
    var today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(new Date());
    if (d < today) return h("span", { class: "chip st-not_interested st", text: "Overdue" });
    if (d === today) return h("span", { class: "chip st-callback st", text: "Due today" });
    var dt = new Date(d + "T12:00:00");
    return h("span", { class: "chip", text: "Next touch " + dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) });
  }
  function heatBar(l) {
    var v = heat(l), t = temperature(l);
    return h("div", { class: "heat", role: "img", "aria-label": "Heat " + v + " out of 100, " + t },
      h("span", { class: "heat-track" }, h("span", { class: "heat-fill heat-" + t, style: "width:" + Math.max(4, v) + "%" })),
      h("span", { class: "heat-num", text: v + " " + t }));
  }
  function checkDots(l) {
    var c = checks(l), r = l.research || {};
    return h("div", { class: "checks" },
      c.map(function (x) { return h("span", { class: "ck" + (x.ok ? " ok" : ""), title: x.k + (x.ok ? ": yes" : ": not yet") }, h("i", { "aria-hidden": "true" }), x.k); }),
      r.confidence ? h("span", { class: "chip conf", text: "Research " + r.confidence }) : null);
  }
  function hostLabel(u) {
    try { var hst = new URL(u).hostname.replace(/^www\.|^m\./, ""); return hst.split(".").slice(-2, -1)[0] || hst; } catch (e) { return "link"; }
  }
  var DIRECTORY = /yelp|facebook|bringfido|google|tripadvisor|mapquest|nextdoor|giftly|downtownnewportrichey|nprmainstreet|comicshoplocator|grubhub|doordash|ubereats|slicelife|instagram|fresha|vagaro|booksy|groupon|wheree|closo|localcomic/i;
  function linkRow(l) {
    var q = function (s) { return encodeURIComponent(s); };
    var town = (l.town || "New Port Richey") + " FL";
    var addr = String(l.address || "").split(/[(;]/)[0].trim();
    var srcs = ((l.research && l.research.sources) || []).concat(l.hookUrl ? [l.hookUrl] : []).map(safeUrl).filter(Boolean);
    srcs = srcs.filter(function (u, i) { return srcs.indexOf(u) === i; });
    var site = srcs.filter(function (u) { return !DIRECTORY.test(u); })[0];
    var links = [
      ["Google", "https://www.google.com/search?q=" + q(l.name + " " + town)],
      ["Maps", "https://www.google.com/maps/search/?api=1&query=" + q(l.name + " " + (addr ? addr + " " : "") + town)],
      ["Yelp", "https://www.yelp.com/search?find_desc=" + q(l.name) + "&find_loc=" + q((l.town || "New Port Richey") + ", FL")],
      ["Facebook", "https://www.facebook.com/search/top?q=" + q(l.name + " " + (l.town || ""))]
    ];
    if (site) links.push(["Website", site]);
    var pl = (l.pitch && l.pitch.links) || {};
    var map = { google: "Google", maps: "Maps", yelp: "Yelp", facebook: "Facebook", website: "Website", instagram: "Instagram" };
    Object.keys(map).forEach(function (k) {
      var u = pl[k] && safeUrl(pl[k]); if (!u) return;
      var hit = links.filter(function (x) { return x[0] === map[k]; })[0];
      if (hit) hit[1] = u; else links.push([map[k], u]);
    });
    return h("div", { class: "links" },
      h("div", { class: "linkrow" }, links.map(function (x) { return h("a", { class: "lk", href: x[1], target: "_blank", rel: "noopener noreferrer", text: x[0] }); })),
      srcs.length ? h("p", { class: "small muted wrap" }, "Sources: ", srcs.filter(function (u) { return u !== site; }).map(function (u, i) {
        return [i ? " · " : "", h("a", { href: u, target: "_blank", rel: "noopener noreferrer", text: hostLabel(u) })];
      })) : null);
  }
  function pitchBox(l) {
    var p = l.pitch;
    var queued = l.researchAsk && l.researchAsk.at && (!p || !p.checkedAt || Date.parse(l.researchAsk.at) > Date.parse(p.checkedAt));
    if (!p) return queued ? h("p", { class: "chip", text: "Deep research queued" }) : null;
    var rating = [p.rating ? "★ " + p.rating : "", p.reviews || p.reviewCount ? (p.reviews || p.reviewCount) + " reviews" : "", p.reviewSource || ""].filter(Boolean).join(" · ");
    var list = function (a) { return Array.isArray(a) ? a : []; };
    return h("div", { class: "pitch" },
      queued ? h("span", { class: "chip", text: "Deep research queued" }) : null,
      p.angle ? h("p", { class: "pitch-angle", text: p.angle }) : null,
      rating ? h("p", { class: "pitch-rating", text: rating }) : null,
      list(p.presence).length ? h("div", { class: "tiles" }, list(p.presence).map(function (x) {
        var u = x.url && safeUrl(x.url), st = /^(good|weak|none)$/.test(x.state) ? x.state : "weak";
        var inner = [h("b", { text: x.ch || "" }), x.note ? h("span", { text: x.note }) : null];
        return u ? h("a", { class: "tile tile-" + st, href: u, target: "_blank", rel: "noopener noreferrer" }, inner) : h("span", { class: "tile tile-" + st }, inner);
      })) : null,
      (list(p.love).length || list(p.complain).length) ? h("div", { class: "opts" },
        list(p.love).map(function (x) { return h("span", { class: "pchip love", text: "♥ " + x }); }),
        list(p.complain).map(function (x) { return h("span", { class: "pchip gripe", text: "✕ " + x }); })) : null,
      list(p.talkingPoints).length ? h("div", {}, h("b", { class: "lbl", text: "Say this" }), h("ol", { class: "plain small" }, list(p.talkingPoints).map(function (x) { return h("li", { text: x }); }))) : null,
      p.offer ? h("div", {}, h("b", { class: "lbl", text: "Offer · for you, not to say first" }), h("p", { class: "small", text: p.offer })) : null,
      (p.ownerStory || list(p.competitors).length) ? h("details", {}, h("summary", { text: "Owner story and competitors" }),
        p.ownerStory ? h("p", { class: "small", text: p.ownerStory }) : null,
        list(p.competitors).map(function (c) { return h("p", { class: "small muted", text: (c.name || "") + (c.edge ? ": " + c.edge : "") }); })) : null);
  }
  function scriptBox(l) {
    if (!l.opener && !l.objection && !l.motive) return null;
    return h("div", { class: "scriptbox" },
      l.opener ? h("div", {}, h("b", { text: "Say" }), h("p", { text: l.opener })) : null,
      l.motive ? h("div", {}, h("b", { text: "Their world" }), h("p", { text: l.motive })) : null,
      l.objection ? h("div", {}, h("b", { text: "If they say" }), h("p", { text: l.objection })) : null,
      l.reply ? h("div", {}, h("b", { text: "You say" }), h("p", { text: l.reply })) : null);
  }
  function statusBar(leads) {
    var order = ["booked", "callback", "wants_email", "vm_text", "messaged", "no_answer", "not_contacted", "not_interested", "handsoff"];
    var counts = {}; leads.forEach(function (l) { var s = leadStatus(l); counts[s] = (counts[s] || 0) + 1; });
    var total = leads.length || 1;
    var parts = order.filter(function (s) { return counts[s]; });
    return h("div", { class: "viz" },
      h("p", { class: "viz-title", text: "Pipeline" }),
      h("div", { class: "stackbar", role: "img", "aria-label": parts.map(function (s) { return counts[s] + " " + SLABEL[s]; }).join(", ") },
        parts.map(function (s) { return h("span", { class: "seg-" + s, style: "flex:" + counts[s], title: SLABEL[s] + ": " + counts[s] }); })),
      h("div", { class: "legend" }, parts.map(function (s) { return h("span", {}, h("i", { class: "seg-" + s, "aria-hidden": "true" }), SLABEL[s] + " " + counts[s]); })),
      h("p", { class: "viz-title", style: "margin-top:10px", text: "Tiers" }),
      h("div", { class: "tierbars" }, ["A", "B", "C"].map(function (t) {
        var n = leads.filter(function (l) { return (l.tier || "C") === t; }).length;
        return h("div", { class: "tb" }, tierBadge(t, false), h("span", { class: "tb-track" }, h("span", { class: "tb-fill tbf-" + t, style: "width:" + Math.round(n / total * 100) + "%" })), h("span", { class: "mono small", text: String(n) }));
      })));
  }

  function leadCard(l) {
    var link = l.hookUrl ? safeUrl(l.hookUrl) : null;
    var tel = telHref(l.phone);
    return h("article", { class: "card lead-" + (l.tier || "C") },
      h("div", { class: "spread" }, h("h3", { text: l.name }), tierBadge(l.tier, false)),
      h("p", { class: "small muted", text: [l.type, l.town].filter(Boolean).join(" · ") }),
      h("div", { class: "row" }, statusChip(l), isPending(l.id, "lead") ? h("span", { class: "pending", text: "not synced yet" }) : null,
        dueChip(l)),
      heatBar(l),
      checkDots(l),
      l.hook ? h("p", { text: l.hook }) : null,
      pitchBox(l),
      linkRow(l),
      l.nextStep ? h("p", { class: "small", text: "Next: " + l.nextStep }) : null,
      h("details", {},
        h("summary", { text: "Script, details and update" }),
        h("div", { class: "stack", style: "margin-top:8px" },
          scriptBox(l),
          l.tierWhy ? h("p", { class: "small muted", text: "Why tier " + l.tier + ": " + l.tierWhy }) : null,
          (l.research && l.research.notes) ? h("p", { class: "small muted", text: "Research note: " + l.research.notes }) : null,
          (l.needs && l.needs.length) ? h("div", {}, h("p", { class: "small", style: "font-weight:600", text: "Needs" }), h("ul", { class: "plain small" }, l.needs.map(function (x) { return h("li", { text: x }); }))) : null,
          (l.notNeeds && l.notNeeds.length) ? h("div", {}, h("p", { class: "small", style: "font-weight:600", text: "Don't pitch" }), h("ul", { class: "plain small" }, l.notNeeds.map(function (x) { return h("li", { text: x }); }))) : null,
          (l.flags || []).map(function (f) { return h("p", { class: "small", style: "color:var(--warn)", text: "⚑ " + f }); }),
          l.hookSource ? h("p", { class: "small muted wrap" }, "Source: " + l.hookSource + " ", link ? h("a", { href: link, target: "_blank", rel: "noopener noreferrer", text: "open" }) : null) : null,
          l.bestTime ? h("p", { class: "small", text: "Best time: " + l.bestTime }) : null,
          l.address ? h("p", { class: "small wrap", text: l.address }) : null,
          h("div", { class: "row" }, tel ? h("a", { class: "btn", href: tel, text: "Call " + l.phone }) : null, bookBtn(), l.email ? h("span", { class: "small wrap", text: l.email }) : null),
          h("p", { class: "small", style: "font-weight:600", text: "Update status" }),
          chPicker(l),
          h("div", { class: "opts", role: "group", "aria-label": "Status for " + l.name }, STATUSES.map(function (s) {
            return h("button", { type: "button", "aria-pressed": leadStatus(l) === s.k ? "true" : "false", onclick: function () { setLeadStatus(l, s.k); }, text: s.label });
          })))));
  }

  /* ---------- Near me (location never leaves the phone) ---------- */
  function km(a, b) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function fmtDist(k) { var mi = k * 0.621371; return mi < 10 ? mi.toFixed(1) + " mi" : Math.round(mi).toLocaleString() + " mi"; }
  function viewNear() {
    var out = h("div", {}, h("h1", { text: "Near me" }), h("p", { class: "muted small", text: "Shops sorted by distance from you, with directions. Your location stays on this phone; Desk never sends it anywhere." }));
    var placed = (data.leads || []).filter(function (l) { return typeof l.lat === "number" && typeof l.lng === "number"; });
    if (!navigator.geolocation) { out.appendChild(h("p", { class: "empty", text: "This phone can't share location with Desk." })); return out; }
    var btn = h("button", { class: "primary", type: "button", style: "margin-top:12px", onclick: function () {
      btn.disabled = true; btn.textContent = "Finding you…";
      navigator.geolocation.getCurrentPosition(function (p) { geo = { lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() }; render(); },
        function (err) { geo = { error: err && err.code === 1 ? "denied" : "failed" }; render(); },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    }, text: geo && geo.lat ? "Update my location" : "Use my location" });
    out.appendChild(btn);
    if (geo && geo.error) out.appendChild(h("p", { class: "small", style: "color:var(--bad);margin-top:8px", text: geo.error === "denied" ? "Location is off for Desk. Turn it on in your phone settings to use this." : "Couldn't get your location. Try again outside or with Wi-Fi on." }));
    if (!placed.length) { out.appendChild(h("p", { class: "empty", style: "margin-top:12px", text: "No shop addresses mapped yet." })); return out; }
    var origin = geo && geo.lat ? geo : null;
    var rows = placed.map(function (l) { return { l: l, d: origin ? km(origin, l) : null }; });
    if (origin) rows.sort(function (a, b) { return a.d - b.d; });
    if (origin && rows[0].d > 160) {
      out.appendChild(h("div", { class: "band", style: "margin-top:12px" }, h("p", { text: "You're about " + fmtDist(rows[0].d) + " from the nearest shop. These are Florida leads, so this list is most useful when you're in the area." })));
    }
    out.appendChild(h("p", { class: "small muted", style: "margin-top:12px", text: placed.length + " of " + (data.leads || []).length + " shops have a mapped address." }));
    out.appendChild(h("div", { class: "stack", style: "margin-top:8px" }, rows.slice(0, 40).map(function (r) {
      var l = r.l;
      var dir = "https://www.google.com/maps/dir/?api=1&destination=" + l.lat.toFixed(5) + "," + l.lng.toFixed(5);
      return h("article", { class: "card" },
        h("div", { class: "spread" }, h("h3", { text: l.name }), r.d !== null ? h("span", { class: "dist", text: fmtDist(r.d) }) : null),
        h("p", { class: "small muted wrap", text: (l.mapAddress || l.address || "") }),
        h("div", { class: "row" }, statusChip(l), h("span", { class: "chip t-" + (l.tier || "C"), text: "Tier " + (l.tier || "?") })),
        l.hook ? h("p", { class: "small", text: l.hook }) : null,
        h("div", { class: "row" }, h("a", { class: "btn", href: dir, target: "_blank", rel: "noopener noreferrer", text: "Directions" }), telHref(l.phone) ? h("a", { class: "btn", href: telHref(l.phone), text: "Call" }) : null));
    })));
    return out;
  }

  /* ---------- Alerts ---------- */
  function viewAlerts() {
    var topic = data.cfg && data.cfg.alerts;
    var out = h("div", {}, h("h1", { text: "Alerts" }), h("p", { class: "muted small", text: "The last 12 hours of alerts HQ sent you." }));
    var listEl = h("div", { class: "stack", style: "margin-top:12px" }, h("p", { class: "muted", text: "Loading…" }));
    out.appendChild(h("div", { class: "row", style: "margin-top:10px" }, h("button", { type: "button", onclick: function () { alertsCache = null; render(); }, text: "Refresh" })));
    out.appendChild(listEl);
    out.appendChild(h("details", { style: "margin-top:18px" }, h("summary", { text: "Get alerts as phone notifications" }),
      h("div", { class: "stack small", style: "margin-top:8px" },
        h("p", { text: "1. Install the free app ntfy (App Store or Google Play)." }),
        h("p", { text: "2. Tap +, and subscribe to the channel below. Keep the server as ntfy.sh." }),
        h("div", { class: "row" }, h("code", { class: "mono wrap", text: topic || "" }), h("button", { type: "button", onclick: function () {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(topic).then(function () { toast("Copied"); });
        }, text: "Copy" })),
        h("p", { class: "muted", text: "Keep the channel name private. Alerts only carry short nudges, never names or money." }))));
    if (!topic) { setKids(listEl, h("p", { class: "empty", text: "No alert channel set up." })); return out; }
    function draw(items) {
      if (!items.length) { setKids(listEl, h("p", { class: "empty", text: "No alerts in the last 12 hours." })); return; }
      setKids(listEl, items.map(function (m) {
        return h("article", { class: "card alert" + (m.priority >= 4 ? " hi" : "") },
          h("div", { class: "spread" }, h("h3", { text: m.title || "Alert" }), h("span", { class: "small muted", text: fmtTime(new Date(m.time * 1000), "Asia/Bangkok") })),
          h("p", { class: "small", text: m.message || "" }));
      }));
    }
    if (alertsCache && Date.now() - alertsCache.at < 60000) { draw(alertsCache.items); return out; }
    fetch("https://ntfy.sh/" + encodeURIComponent(topic) + "/json?poll=1&since=12h", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.text(); })
      .then(function (t) {
        var items = t.split("\n").map(function (line) { try { return JSON.parse(line); } catch (e) { return null; } })
          .filter(function (m) { return m && m.event === "message" && (!m.time || m.time * 1000 <= Date.now() + 60000); })
          .sort(function (a, b) { return b.time - a.time; });
        alertsCache = { at: Date.now(), items: items }; draw(items);
      })
      .catch(function () { setKids(listEl, h("p", { class: "empty", text: "Can't reach the alert service right now. Check your internet." })); });
    return out;
  }

  /* ---------- service worker (offline + install) ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && cryptoKey) { loadData().then(function () { render(); flushOutbox(); }, function () {}); }
  });

  boot();
})();
