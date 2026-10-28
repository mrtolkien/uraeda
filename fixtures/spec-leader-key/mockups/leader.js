// Throwaway: Space opens the menu after 500 ms; a group key goes down, Backspace up, Escape closes.
const KEYMAP = {
  title: "Space",
  items: [
    ["Space", "Jump to anything…"],
    ["h", "Home"],
    ["i", "Inbox"],
    ["p", "Priorities"],
    ["d", "Decisions"],
    [
      "n",
      "+new",
      {
        title: "New",
        items: [
          ["s", "Session"],
          ["c", "Change"],
          ["f", "Feature"],
          ["n", "Note (inbox entry)"],
          ["p", "Priority"],
        ],
      },
    ],
    [
      "f",
      "+find",
      {
        title: "Find",
        items: [
          ["f", "Features"],
          ["d", "Decisions"],
          ["s", "Sessions"],
          ["n", "Notes"],
          ["p", "Priorities"],
        ],
      },
    ],
    [
      "v",
      "+view",
      {
        title: "View",
        items: [
          ["[", "Fold navigation"],
          ["]", "Fold right column"],
          ["t", "Theme"],
        ],
      },
    ],
    ["r", "Switch repository…"],
    ["?", "Search keys…"],
  ],
};
const menu = document.getElementById("menu"),
  status = document.getElementById("status");
let path = [],
  timer = null;
function node() {
  let n = KEYMAP;
  for (const key of path) n = n.items.find((i) => i[0] === key)[2];
  return n;
}
function draw() {
  const n = node(),
    crumbs = ["Space", ...path].join(" ");
  menu.innerHTML =
    `<span class="title">${crumbs}</span><ul>${n.items
      .map(
        ([k, l, sub]) =>
          `<li><kbd>${k}</kbd> <span class="${sub ? "grp" : ""}">${sub ? "→ " + l : l}</span></li>`,
      )
      .join("")}</ul>` +
    (document.body.dataset.look === "strip" ? "" : `<p class="dim">⌫ back &nbsp; esc close</p>`);
  menu.classList.add("on");
}
function close() {
  clearTimeout(timer);
  path = [];
  menu.classList.remove("on");
}
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!menu.classList.contains("on") && timer === null && e.key === " ") {
    e.preventDefault();
    timer = setTimeout(() => {
      timer = "shown";
      draw();
    }, 500);
    path = [];
    return;
  }
  if (timer === null) return;
  e.preventDefault();
  if (e.key === "Escape") {
    timer = null;
    close();
    return;
  }
  if (e.key === "Backspace") {
    path.pop();
    if (timer === "shown") draw();
    return;
  }
  const hit = node().items.find((i) => i[0] === e.key);
  if (!hit) return;
  if (hit[2]) {
    path.push(hit[0]);
    if (timer === "shown") draw();
  } else {
    timer = null;
    close();
    status.querySelector(".last").textContent =
      `ran: ${["Space", ...path, hit[0]].join(" ")} ${hit[1]}`;
  }
});
if (location.hash === "#open") {
  timer = "shown";
  draw();
}
if (location.hash === "#nested") {
  timer = "shown";
  path = ["n"];
  draw();
}
