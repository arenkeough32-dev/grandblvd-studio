/* Grand Blvd Studio. Optional live chat (Tawk.to, free plan, no card).
   Off by default: nothing third-party loads until GBS_TAWK_ID is set in index.html.
   To turn it on: create a free account at tawk.to (about 2 minutes), then
   Admin > Channels > Chat Widget > copy the Property ID into GBS_TAWK_ID. */
(function () {
  var id = window.GBS_TAWK_ID;
  if (!id) return;
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_API.onLoad = function () {
    // Keep the bubble clear of the sticky text/call bar on phones.
    try {
      if (window.innerWidth < 720 && Tawk_API.setWidgetPosition) {
        Tawk_API.setWidgetPosition("bottom-left");
      }
    } catch (e) {}
  };
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://embed.tawk.to/" + id + "/default";
  s.setAttribute("crossorigin", "*");
  document.body.appendChild(s);
})();
