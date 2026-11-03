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
