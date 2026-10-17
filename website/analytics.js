const $ = (id) => document.getElementById(id);
const format = (value) => new Intl.NumberFormat("en").format(value);
let busy = false;
function showLogin() {
  $("login").hidden = false;
  $("dashboard").hidden = true;
}
function chart(days) {
  const values = days.map((row) => row.counts["website:page_view"] || 0);
  const max = Math.max(4, ...values);
  const width = 1000,
    height = 225,
    left = 42,
    right = 18,
    top = 12,
    bottom = 32;
  const x = (i) =>
    left + (i * (width - left - right)) / Math.max(1, days.length - 1);
  const y = (n) => height - bottom - (n / max) * (height - top - bottom);
  const points = values.map((value, i) => `${x(i)},${y(value)}`).join(" ");
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  function node(tag, attributes, text) {
    const element = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value);
    if (text != null) element.textContent = text;
    svg.append(element);
    return element;
  }
  for (let i = 0; i <= 4; i++) {
    const value = (max * i) / 4;
    node("line", {
      x1: left,
      x2: width - right,
      y1: y(value),
      y2: y(value),
      stroke: "#e5e7dd",
      "stroke-dasharray": "3 5",
    });
    node(
      "text",
      {
        x: left - 10,
        y: y(value) + 4,
        fill: "#75776c",
        "font-size": 11,
        "text-anchor": "end",
      },
      format(Math.round(value)),
    );
  }
  node("polygon", {
    points: `${left},${y(0)} ${points} ${x(days.length - 1)},${y(0)}`,
    fill: "#e4ebdc",
  });
  node("polyline", {
    points,
    fill: "none",
    stroke: "#38634d",
    "stroke-width": 2.5,
    "stroke-linejoin": "round",
  });
  values.forEach((value, i) => {
    const dot = node("circle", {
      cx: x(i),
      cy: y(value),
      r: days.length > 30 ? 2 : 4,
      fill: "#38634d",
    });
    const title = document.createElementNS(ns, "title");
    title.textContent = `${days[i].day}: ${format(value)} views`;
    dot.append(title);
  });
  const indices = [
    ...new Set([
      0,
      Math.floor(days.length / 3),
      Math.floor((days.length * 2) / 3),
      days.length - 1,
    ]),
  ];
  for (const i of indices)
    node(
      "text",
      {
        x: x(i),
        y: height - 6,
        fill: "#75776c",
        "font-size": 11,
        "text-anchor":
          i === 0 ? "start" : i === days.length - 1 ? "end" : "middle",
      },
      new Date(`${days[i].day}T00:00:00Z`).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    );
  $("chart").replaceChildren(svg);
  $("chart").setAttribute(
    "aria-label",
    `Daily homepage views: ${values.map((n, i) => `${days[i].day}: ${n}`).join(", ")}`,
  );
  $("empty").hidden = values.some((value) => value > 0);
}
function eventList(id, rows, totals) {
  $(id).replaceChildren(
    ...rows.map(([key, label, description]) => {
      const div = document.createElement("div");
      div.className = "event";
      const span = document.createElement("span");
      span.textContent = label;
      const small = document.createElement("small");
      small.textContent = description;
      span.append(small);
      const number = document.createElement("strong");
      number.textContent = format(totals[key] || 0);
      div.append(span, number);
      return div;
    }),
  );
}
function render(data) {
  const totals = {};
  for (const row of data.days)
    for (const [key, count] of Object.entries(row.counts))
      totals[key] = (totals[key] || 0) + count;
  for (const [id, key] of [
    ["views", "website:page_view"],
    ["engaged", "website:engaged_visit"],
    ["downloads", "website:download_click"],
    ["labels", "extension:labels_used"],
  ])
    $(id).textContent = format(totals[key] || 0);
  $("period").textContent =
    `${data.days[0].day} — ${data.days.at(-1).day} · UTC`;
  chart(data.days);
  $("daily").replaceChildren(
    ...data.days.toReversed().map((row) => {
      const tr = document.createElement("tr");
      for (const value of [
        row.day,
        ...[
          "website:page_view",
          "website:engaged_visit",
          "website:download_click",
          "extension:labels_used",
        ].map((key) => format(row.counts[key] || 0)),
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }),
  );
  $("sources").replaceChildren(
    ...[
      ["x", "X"],
      ["reddit", "Reddit"],
      ["hn", "Hacker News"],
      ["producthunt", "Product Hunt"],
      ["other", "Other sites"],
      ["direct", "Direct or unknown"],
    ].map(([ref, label]) => {
      const tr = document.createElement("tr");
      for (const value of [
        label,
        ...["page_view", "download_click"].map((event) =>
          format(totals[`website:${event}.${ref}`] || 0),
        ),
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }),
  );
  eventList(
    "website-events",
    [
      [
        "website:demo_click",
        "Demo clicks",
        "Clicks on the Watch demo link; not video plays",
      ],
      [
        "website:example_click",
        "Example interactions",
        "Manual clicks through the sample inbox",
      ],
      [
        "website:provider_click",
        "TypeSafe link clicks",
        "Interest in the classification provider",
      ],
    ],
    totals,
  );
  eventList(
    "extension-events",
    [
      [
        "extension:analytics_enabled",
        "Browsers opting in",
        "First analytics opt-in per local browser profile",
      ],
      [
        "extension:extension_enabled",
        "Classification activations",
        "Transitions from off or paused to enabled",
      ],
      [
        "extension:category_created",
        "Category setup actions",
        "Settings saves that add a category; no label text collected",
      ],
      [
        "extension:labels_used",
        "Label-use days",
        "One signal per participating browser per UTC day",
      ],
    ],
    totals,
  );
  $("updated").textContent =
    `Updated ${new Date(data.updatedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`;
  $("login").hidden = true;
  $("dashboard").hidden = false;
}
async function load() {
  if (busy) return;
  busy = true;
  $("refresh").disabled = true;
  try {
    const response = await fetch(`/api/analytics?days=${$("range").value}`, {
      cache: "no-store",
    });
    if (response.status === 401) {
      showLogin();
      $("message").textContent = "";
      return;
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    render(data);
    $("message").textContent = "";
  } catch (error) {
    $("message").textContent =
      error.message || "Could not load analytics. Try refreshing.";
  } finally {
    busy = false;
    $("refresh").disabled = false;
  }
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch("/api/analytics?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("password").value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    $("password").value = "";
    await load();
  } catch (error) {
    $("message").textContent = error.message || "Could not sign in.";
  } finally {
    button.disabled = false;
  }
});
$("range").addEventListener("change", load);
$("refresh").addEventListener("click", load);
$("logout").addEventListener("click", async () => {
  try {
    const response = await fetch("/api/analytics?action=logout", {
      method: "POST",
    });
    if (!response.ok) throw new Error("Could not sign out.");
    showLogin();
    $("message").textContent = "";
  } catch (error) {
    $("message").textContent = error.message;
  }
});
void load();
setInterval(() => {
  if (!$("dashboard").hidden && document.visibilityState === "visible")
    void load();
}, 60000);
