(() => {
  if (
    navigator.doNotTrack === "1" ||
    navigator.globalPrivacyControl ||
    navigator.webdriver
  )
    return;
  const ref = (() => {
    const tag = new URLSearchParams(location.search).get("ref");
    if (["x", "reddit", "hn", "producthunt"].includes(tag)) return tag;
    if (!document.referrer) return "direct";
    const host = new URL(document.referrer).hostname;
    if (host === location.hostname) return "direct";
    const from = (...domains) =>
      domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (from("t.co", "x.com", "twitter.com")) return "x";
    if (from("reddit.com", "redd.it")) return "reddit";
    if (from("news.ycombinator.com")) return "hn";
    if (from("producthunt.com")) return "producthunt";
    return "other";
  })();
  const send = (event) => {
    void fetch("/api/analytics?action=collect", {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "website",
        event,
        ...(["page_view", "download_click"].includes(event) && { ref }),
      }),
    }).catch(() => {});
  };
  // Only the homepage is measured; no URLs, titles, or identifiers. Referrers are reduced to a fixed source bucket.
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
