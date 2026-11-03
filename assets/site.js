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
