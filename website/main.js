const examples = [
  {
    avatar: "N",
    tone: "#d4694e",
    from: "Northwind Studio",
    subject: "Invoice 1842 is ready",
    time: "09:14",
    excerpt:
      "Amount due €1,240, due Friday. The transfer reference is on the PDF cover.",
    labels: [{ name: "Invoices & payments", color: "#d4694e", ink: "#fffaf3" }],
  },
  {
    avatar: "K",
    tone: "#1f7a75",
    from: "KLM",
    subject: "Your flight to Lisbon moved",
    time: "08:02",
    excerpt:
      "Departure is now 18:40 from gate D12. The seat you picked is still yours.",
    labels: [{ name: "Travel", color: "#1f7a75", ink: "#fffaf3" }],
  },
  {
    avatar: "M",
    tone: "#7a5ea7",
    from: "Mom",
    subject: "Dinner on Sunday",
    time: "Yesterday",
    excerpt:
      "Can you bring the salad? Dad is making the fish and the kids are setting the table.",
    labels: [{ name: "Personal", color: "#7a5ea7", ink: "#fffaf3" }],
  },
  {
    avatar: "G",
    tone: "#c4922a",
    from: "GitHub",
    subject: "New sign-in from Amsterdam",
    time: "07:41",
    excerpt:
      "A new device just signed in to your account. If this was you, you can ignore this note.",
    labels: [{ name: "Accounts & security", color: "#c4922a", ink: "#1b1714" }],
  },
  {
    avatar: "F",
    tone: "#4f8f4a",
    from: "Field Notes",
    subject: "This week in the workshop",
    time: "Monday",
    excerpt: "A short essay on paper, plus 20% off notebooks through Sunday.",
    labels: [
      { name: "Newsletters", color: "#4f8f4a", ink: "#fffaf3" },
      { name: "Promotions", color: "#c45b78", ink: "#fffaf3" },
    ],
  },
];

const letter = document.querySelector("[data-letter]");
const fromEl = document.querySelector("[data-from]");
const subjectEl = document.querySelector("[data-subject]");
const timeEl = document.querySelector("[data-time]");
const excerptEl = document.querySelector("[data-excerpt]");
const avatarEl = document.querySelector("[data-avatar]");
const stampsEl = document.querySelector("[data-stamps]");
const statusEl = document.querySelector("[data-status]");
const tabs = [...document.querySelectorAll("[data-tab]")];

let index = 0;
let labelTimer = 0;
let cycleTimer = 0;
let hovering = false;

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const paint = (next) => {
  const example = examples[next];
  index = next;
  letter.classList.remove("is-labeled");
  letter.dataset.count = String(example.labels.length);
  letter.style.setProperty("--tone", example.tone);
  avatarEl.textContent = example.avatar;
  avatarEl.style.background = example.tone;
  fromEl.textContent = example.from;
  subjectEl.textContent = example.subject;
  timeEl.textContent = example.time;
  timeEl.dateTime = example.time;
  excerptEl.textContent = example.excerpt;
  stampsEl.replaceChildren(
    ...example.labels.map((label) => {
      const chip = document.createElement("span");
      chip.className = "stamp";
      chip.textContent = label.name;
      chip.style.background = label.color;
      chip.style.color = label.ink;
      return chip;
    }),
  );
  for (const tab of tabs) {
    tab.setAttribute(
      "aria-pressed",
      Number(tab.dataset.tab) === next ? "true" : "false",
    );
  }
  statusEl.textContent = `${example.from}. ${example.subject}`;
};

const showLabel = () => {
  letter.classList.add("is-labeled");
  const names = examples[index].labels.map((label) => label.name).join(" and ");
  statusEl.textContent = `${examples[index].from}. ${names}.`;
};

const clearTimers = () => {
  window.clearTimeout(labelTimer);
  window.clearTimeout(cycleTimer);
};

const arm = () => {
  clearTimers();
  if (reduced) {
    showLabel();
    return;
  }
  labelTimer = window.setTimeout(showLabel, 850);
  if (hovering) return;
  cycleTimer = window.setTimeout(() => {
    paint((index + 1) % examples.length);
    arm();
  }, 4300);
};

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    paint(Number(tab.dataset.tab));
    arm();
  });
}

letter.addEventListener("mouseenter", () => {
  hovering = true;
  window.clearTimeout(cycleTimer);
});

letter.addEventListener("mouseleave", () => {
  hovering = false;
  window.clearTimeout(cycleTimer);
  if (reduced) return;
  cycleTimer = window.setTimeout(() => {
    paint((index + 1) % examples.length);
    arm();
  }, 1600);
});

paint(0);
arm();
