(() => {
  if (
    navigator.doNotTrack === "1" ||
    navigator.globalPrivacyControl ||
    navigator.webdriver
  )
    return;
  const send = (event) => {
    void fetch("/api/analytics?action=collect", {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "website", event }),
    }).catch(() => {});
  };
  // Only the homepage is measured; no URLs, titles, referrers, or identifiers.
  if (location.pathname !== "/" && location.pathname !== "/index.html") return;
  let viewed = false;
  const view = () => {
    if (!viewed && document.visibilityState === "visible") {
      viewed = true;
      send("page_view");
    }
  };
  view();
  document.addEventListener("visibilitychange", view);
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-event]");
    if (target) send(target.dataset.event);
  });
  // A visit is engaged after 15 cumulative seconds with the page visible.
  let seconds = 0;
  const timer = setInterval(() => {
    if (document.visibilityState === "visible") seconds += 1;
    if (seconds >= 15) {
      clearInterval(timer);
      send("engaged_visit");
    }
  }, 1000);
})();
