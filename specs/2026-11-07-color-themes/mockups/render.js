// Draws the sample view once per theme of `themes.js`, and measures each text role's contrast
// against the page, as the UI look decision asks: 4.5:1 for text, 3:1 for borders.

const channels = (hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const mix = (top, share, under) => {
  const [a, b] = [channels(top), channels(under)];
  return `#${a
    .map((v, i) => Math.round((v * share + b[i] * (1 - share)) * 255))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
};

const SAMPLE = `
  <h1>Color themes</h1>
  <p>Pick a theme for light mode and one for dark mode. <span class="secondary">Kept on this browser.</span></p>
  <h2>Questions</h2>
  <h3>Q1: Which themes ship?</h3>
  <div class="pane"><span class="title">Features · 3</span>
    <div class="row selected"><span>Keyboard nav</span><span class="count">Now</span></div>
    <div class="row"><span>Global undo</span><span class="count">Now</span></div>
    <div class="row needs"><span>Color themes</span><span>needs you</span></div>
  </div>
  <div class="pane live"><span class="title">Session · running</span>
    <pre><span class="c">// the next step</span>
<span class="k">export function</span> <span class="f">next</span>(spec: <span class="t">Spec</span>) {
  <span class="k">return</span> spec.rounds[<span class="n">0</span>] ?? <span class="s">"discovery"</span>;
}
<span class="add">+ const theme = "mocha";</span><span class="del">- const theme = "dark";</span></pre>
    <div class="actions">
      <span class="button primary">Answer</span><span class="button">Later</span>
      <span class="badge ok">done</span><span class="badge warn">waiting</span><span class="badge bad">failed</span><span class="badge info">info</span>
    </div>
  </div>`;

const HUES = ["red", "orange", "yellow", "green", "teal", "cyan", "blue", "purple", "pink"];
const TEXT_ROLES = ["text", "subtext", "dim", "title", "live", "h1", "h2", "h3", ...HUES];

export function render(themes) {
  const grid = document.querySelector("#grid");
  for (const theme of themes) {
    const p = theme.palette;
    const vars = {
      ...p,
      "accent-muted": mix(p.accent, 0.14, p.base),
      "on-accent": p.onAccent ?? (theme.mode === "dark" ? p.crust : "#ffffff"),
    };
    const card = document.createElement("section");
    card.className = "theme coloured";
    card.dataset.mode = theme.mode;
    for (const [name, value] of Object.entries(vars)) {
      card.style.setProperty(`--${name}`, value);
    }
    const low = TEXT_ROLES.filter((role) => contrast(p[role], p.base) < 4.5).map(
      (role) => `${role} ${contrast(p[role], p.base).toFixed(1)}`,
    );
    const border = contrast(p.overlay, p.base);
    card.innerHTML = `
      <div class="name"><span>${theme.name}</span><small>${theme.mode} · ${theme.source}</small></div>
      ${SAMPLE}
      <div class="hues">${HUES.map((h) => `<span style="background:${p[h]}" title="${h}"></span>`).join("")}</div>
      <div class="contrast">Official colours. Under 4.5:1 on the page: ${
        low.length ? `<b>${low.join(", ")}</b>` : "none"
      }. Border ${border.toFixed(1)}:1${border < 3 ? " <b>under 3:1</b>" : ""}.</div>`;
    grid.append(card);
  }
  document.querySelector("#headings").addEventListener("change", (event) => {
    for (const card of grid.children) {
      card.classList.toggle("coloured", event.target.checked);
    }
  });
  document.querySelector("#filter").addEventListener("change", (event) => {
    for (const card of grid.children) {
      card.hidden = event.target.value !== "all" && card.dataset.mode !== event.target.value;
    }
  });
}
