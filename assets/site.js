/* Grand Blvd Studio. Change the studio email in ONE place: the line below. */
var STUDIO_EMAIL = "hello@grandblvdstudio.com";

(function () {
  // Email: every link marked data-email uses STUDIO_EMAIL
  document.querySelectorAll("[data-email]").forEach(function (a) {
    a.setAttribute("href", "mailto:" + STUDIO_EMAIL);
    if (a.hasAttribute("data-email-text")) a.textContent = STUDIO_EMAIL;
  });

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // Header gets a hairline once the page scrolls
  var header = document.querySelector(".site-header");
  var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Pause slow animations while they are off screen (saves battery)
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle("paused", !e.isIntersecting); });
    }, { rootMargin: "120px" });
    document.querySelectorAll(".marquee, .scroll-shot, .showcase").forEach(function (el) { io.observe(el); });
  }
})();

/* Cinema: decorative film loops. Posters only for reduced motion or data saver.
   One film plays at a time, only while on screen, never in a hidden tab.
   The hero button pauses ALL motion on the page (WCAG 2.2.2). */
(function () {
  var root = document.documentElement;
  var films = [].slice.call(document.querySelectorAll("[data-film]"));
  var toggle = document.querySelector("[data-motion-toggle]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var userOff = false;
  try { userOff = localStorage.getItem("gbs-motion") === "off"; } catch (e) {}
  root.classList.toggle("motion-off", userOff);

  // Scroll reveals
  if (!reduce && "IntersectionObserver" in window) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { rio.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  // Sticky contact bar waits until the hero buttons have scrolled away
  var bar = document.querySelector(".action-bar"), heroCta = document.querySelector(".hero .cta-row");
  if (bar && heroCta && "IntersectionObserver" in window) {
    bar.classList.add("is-hidden");
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { bar.classList.toggle("is-hidden", e.isIntersecting || e.boundingClientRect.top > 0); });
    }).observe(heroCta);
  }

  var filmsOn = films.length && !reduce && !saveData && "IntersectionObserver" in window;
  var pick = function () {};

  if (filmsOn) {
    var tall = window.matchMedia("(max-width: 699px)");
    var ratios = new Map();
    var srcFor = function (f) { return f.dataset.tall && tall.matches ? f.dataset.tall : f.dataset.src; };
    var start = function (f) {
      var v = f.querySelector("video");
      if (!v) return;
      if (!v.getAttribute("src")) {
        v.addEventListener("playing", function () { f.classList.add("is-live"); }, { once: true });
        v.src = srcFor(f);
      }
      f.classList.remove("paused");
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    };
    var stop = function (f) {
      var v = f.querySelector("video");
      if (v && !v.paused) v.pause();
      f.classList.add("paused");
    };
    pick = function () {
      var best = null, bestR = 0.35;
      if (!userOff && !document.hidden) {
        ratios.forEach(function (r, f) { if (r >= bestR) { best = f; bestR = r; } });
      }
      films.forEach(function (f) { if (f !== best) stop(f); });
      if (best) start(best);
    };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { ratios.set(e.target, e.intersectionRatio); });
      pick();
    }, { threshold: [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1] });
    // Start films well after the page is usable: load, then idle, then a beat.
    var boot = function () { films.forEach(function (f) { io.observe(f); }); };
    var later = function () {
      (window.requestIdleCallback || function (cb) { setTimeout(cb, 300); })(function () { setTimeout(boot, 1200); }, { timeout: 2500 });
    };
    if (document.readyState === "complete") later(); else window.addEventListener("load", later);
    document.addEventListener("visibilitychange", function () { pick(); });
  }

  // One button pauses everything that moves (films, marquee, floating mockups, scrolling screenshot).
  if (toggle && !reduce) {
    var sync = function () {
      toggle.setAttribute("aria-pressed", String(userOff));
      toggle.classList.toggle("is-off", userOff);
    };
    toggle.hidden = false;
    sync();
    toggle.addEventListener("click", function () {
      userOff = !userOff;
      root.classList.toggle("motion-off", userOff);
      try { localStorage.setItem("gbs-motion", userOff ? "off" : "on"); } catch (e) {}
      sync();
      pick();
    });
  }
})();

/* Motion layer: word-by-word headlines, scroll-linked depth, drawing step line, count-ups, card tilt.
   Skipped entirely for prefers-reduced-motion; the hero pause button (html.motion-off) freezes it. */
(function () {
  var root = document.documentElement;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.classList.add("mx");
  var off = function () { return root.classList.contains("motion-off"); };

  // 1. Word-by-word headlines
  var split = function (el) {
    var i = 0;
    var walk = function (node) {
      [].slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            var w = document.createElement("span"); w.className = "w";
            var s = document.createElement("span"); s.textContent = t; s.style.setProperty("--i", i++);
            w.appendChild(s); frag.appendChild(w);
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1 && c.tagName !== "BR") walk(c);
      });
    };
    walk(el); el.classList.add("split");
  };
  var hero = document.querySelector(".hero h1");
  if (hero) { split(hero); requestAnimationFrame(function () { setTimeout(function () { hero.classList.add("on"); }, 120); }); }
  var heads = [].slice.call(document.querySelectorAll(".h2, .case-title, .contact h2, .pledge blockquote p"));
  heads.forEach(split);
  if ("IntersectionObserver" in window) {
    var hio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("on"); hio.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    heads.forEach(function (h) { hio.observe(h); });
  } else heads.forEach(function (h) { h.classList.add("on"); });

  // 2. Scroll-linked depth
  var items = [];
  var reg = function (sel, cls) { document.querySelectorAll(sel).forEach(function (el) { el.classList.add(cls); items.push(el); }); };
  reg(".hero-stage", "px-hero"); reg(".film-band", "px-band"); reg(".phones figure", "px-phone");
  reg(".ba-pair figure", "px-phone"); reg(".steps", "px-steps"); reg(".contact", "px-contact");
  var header = document.querySelector(".site-header");
  if (header) { var line = document.createElement("div"); line.className = "scroll-line"; line.setAttribute("aria-hidden", "true"); header.appendChild(line); }
  var steps = [].slice.call(document.querySelectorAll(".step"));
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ticking = false;
  var tick = function () {
    ticking = false;
    var vh = window.innerHeight;
    items.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var p = clamp((vh - r.top) / (vh + r.height));
      el.style.setProperty("--p", p.toFixed(4));
      if (el.classList.contains("px-hero")) el.style.setProperty("--x", clamp(-r.top / r.height).toFixed(4));
      if (el.classList.contains("px-steps")) {
        var d = clamp((vh * 0.78 - r.top) / (r.height * 0.9 + vh * 0.15));
        el.style.setProperty("--d", d.toFixed(4));
        steps.forEach(function (s, k) { s.classList.toggle("lit", d >= k / steps.length + 0.02); });
      }
    });
    var max = document.documentElement.scrollHeight - vh;
    root.style.setProperty("--sp", (max > 0 ? window.scrollY / max : 0).toFixed(4));
  };
  var req = function () { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
  window.addEventListener("scroll", req, { passive: true });
  window.addEventListener("resize", req);
  tick();

  // 3. Count-ups on prices and scores
  var nums = [].slice.call(document.querySelectorAll(".amount span, .proof strong"));
  var count = function (el) {
    var txt = el.textContent, m = txt.match(/^([\d,]+)(.*)$/);
    if (!m || off()) return;
    var end = parseInt(m[1].replace(/,/g, ""), 10), rest = m[2], t0 = null, dur = 1300;
    var fmt = function (n) { return m[1].indexOf(",") > -1 ? n.toLocaleString("en-US") : String(n); };
    var step = function (ts) {
      if (!t0) t0 = ts;
      var k = clamp((ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(end * e)) + rest;
      if (k < 1) requestAnimationFrame(step); else el.textContent = txt;
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { count(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { cio.observe(n); });
  }

  // 4. Cards lean toward the pointer; primary buttons pull gently (mouse only)
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".card, .price").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--mx", ((e.clientX - r.left) / r.width).toFixed(3));
        c.style.setProperty("--my", ((e.clientY - r.top) / r.height).toFixed(3));
        c.classList.add("tilt");
      });
      c.addEventListener("pointerleave", function () { c.classList.remove("tilt"); });
    });
    document.querySelectorAll(".btn-primary, .btn-light").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        if (off()) return;
        var r = b.getBoundingClientRect();
        b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + "px," + ((e.clientY - r.top - r.height / 2) * 0.2).toFixed(1) + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }
})();

/* Sample call player: plays the demo, highlights each line of the transcript as it is spoken. */
(function () {
  document.querySelectorAll("[data-player]").forEach(function (p) {
    var audio = p.querySelector("audio"), btn = p.querySelector("[data-play]");
    var bar = p.querySelector("[data-progress]"), time = p.querySelector("[data-time]");
    var lines = [].slice.call((p.parentNode || document).querySelectorAll("[data-transcript] li"));
    if (!audio || !btn) return;
    var fmt = function (t) { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); };
    btn.addEventListener("click", function () {
      if (audio.paused) { var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); } else audio.pause();
    });
    audio.addEventListener("play", function () { p.classList.add("is-playing"); btn.setAttribute("aria-label", "Pause the sample call"); });
    audio.addEventListener("pause", function () { p.classList.remove("is-playing"); btn.setAttribute("aria-label", "Play the sample call"); });
    audio.addEventListener("ended", function () { lines.forEach(function (l) { l.classList.remove("now"); }); });
    audio.addEventListener("timeupdate", function () {
      var d = audio.duration || 30, c = audio.currentTime;
      if (bar) bar.style.width = (c / d * 100) + "%";
      if (time) time.textContent = fmt(d - c);
      var cur = null;
      lines.forEach(function (l) { if (c >= parseFloat(l.dataset.t)) cur = l; });
      lines.forEach(function (l) { l.classList.toggle("now", l === cur); });
    });
  });
})();
