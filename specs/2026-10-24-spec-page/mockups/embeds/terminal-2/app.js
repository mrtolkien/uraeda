// Terminal, round 2: the shell (3 versions), the home (3), settings (3) and decisions (3), over the same fake data.
// Everything is drawn from one state object, and the bar on top picks the version of each part.
(function () {
  const D = window.URA,
    X = window.URA2,
    stage = document.getElementById("stage"),
    frame = document.getElementById("frame"),
    ctl = document.getElementById("ctl");
  const baseIcon = window.icon;
  const LMAP = {
    home: "house",
    inbox: "inbox",
    list: "list",
    plus: "plus",
    pulse: "activity",
    clock: "clock",
    check: "check",
    alert: "triangle-alert",
    file: "file-text",
    scale: "scale",
    book: "book-open",
    settings: "settings",
    branch: "git-branch",
    search: "search",
    chevR: "chevron-right",
    chevD: "chevron-down",
    wrench: "wrench",
    robot: "bot",
    gauge: "gauge",
    flag: "flag",
    pencil: "pencil",
    help: "circle-help",
    bell: "bell",
    key: "key-round",
    folder: "folder",
    eye: "eye",
    layers: "layers",
    image: "image",
    history: "history",
    grid: "layout-grid",
    flask: "flask-conical",
    leaf: "leaf",
    bolt: "zap",
    play: "play",
    terminal: "square-terminal",
    panelB: "panel-bottom",
    sidebar: "panel-left",
    diff: "git-compare",
    msg: "mail",
    spark: "sparkles",
    x: "x",
    scroll: "type",
  };
  // Lucide's drawings (generated into real.js) replace the hand-drawn set wherever a match exists.
  function icon(name, size = 18, cls = "") {
    const node = window.LUCIDE[name] || window.LUCIDE[LMAP[name]];
    if (!node) return baseIcon(name, size, cls);
    return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${node
      .map(
        ([t, a]) =>
          `<${t} ${Object.entries(a)
            .map(([k, v]) => `${k}="${v}"`)
            .join(" ")}/>`,
      )
      .join("")}</svg>`;
  }
  const Q = new URLSearchParams(location.search);
  const num = (k, d) => Math.min(3, Math.max(1, +Q.get(k) || d));
  const S = { shell: 3, home: 1, set: 1, dec: 3, status: 3, w: Q.get("w") || "auto" };
  const cfg = {
    scheme: Q.get("theme") || "mocha",
    scale: +Q.get("scale") || 120,
    motion: false,
    harness: "claude",
    warn: 80,
    push: true,
    quiet: false,
  };
  X.principleIc = ["hand", "git-branch", "clock", "gauge", "puzzle", "badge-check"];
  const ui = {
    peekClosed: false,
    area: "",
    menu: "",
    pal: false,
    pq: "",
    palSel: "",
    q: "",
    sv: Q.get("sv") || "form",
    pick: null,
    grp: "All",
  };

  const NAMES = {
    dec: ["Layered surfaces", "Floating sheet", "Panes"],
    status: ["Light", "Context", "Hints"],
  };
  const need = D.features.filter((f) => f.state === "awaiting-you");
  const wip = D.features.filter((f) => f.state === "building");
  const done = D.features.filter((f) => f.state === "done");
  const running = D.sessions.filter((s) => s.state === "running");
  const inboxN = D.inbox.reduce((n, c) => n + c.notes.length, 0);
  const route = () => (location.hash.replace(/^#\//, "") || "home").split("/");
  const featureOf = (slug) => D.features.find((f) => f.slug === slug);
  const theme = () =>
    cfg.scheme === "system"
      ? matchMedia("(prefers-color-scheme: light)").matches
        ? "latte"
        : "mocha"
      : cfg.scheme;

  // ---------- logo: the dot-matrix tree (concept E of logos.html) ----------
  const TREE = [
    "..xxxx..",
    ".xxxxxx.",
    "xxxxxxxx",
    ".xxxxxx.",
    "...xx...",
    "..xx....",
    "...xx...",
    "..xxxx..",
  ];
  const logo = (s) => {
    let r = "";
    TREE.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === "x")
          r += `<rect x="${x * 8}" y="${y * 8}" width="7" height="7" rx="1.2" fill="currentColor"/>`;
      }),
    );
    return `<span class="logo"><svg width="${s}" height="${s}" viewBox="0 0 64 64" aria-label="Uraeda">${r}</svg></span>`;
  };

  // ---------- small parts ----------
  const stepName = (f) => D.steps[f.step];
  const seg = (f) =>
    `<span class="seg">${D.steps
      .map(
        (_, i) =>
          `<i class="${f.state === "done" || i < f.step ? "d" : i === f.step ? "c " + (f.state === "building" ? "run" : "") : ""}"></i>`,
      )
      .join("")}</span>`;
  const kindPill = (f) => (f.kind === "change" ? `<span class="pill chg">change</span>` : "");
  const stPill = (s) =>
    `<span class="pill ${s === "running" ? "run" : s === "waiting" ? "wait" : ""}">${s}</span>`;
  const verb = (f) => (f.step <= 2 ? "Answer the questions" : "Approve the spec");
  const fIcon = (f, s = 18) => icon(f.kind === "change" ? "wrench" : "branch", s);
  const cur = () => route().join("/");
  const isOn = (go) => cur() === go || (!go.includes("/") && route()[0] === go);

  function item(o) {
    return `<a class="it ${(o.on !== undefined ? o.on : isOn(o.go)) ? "on" : ""} ${o.cls || ""}" data-go="${o.go}" href="#/${o.go}" title="${esc(o.l)}"><span class="ic">${o.ic}${o.bd ? '<i class="bd"></i>' : ""}${o.dot !== undefined ? `<i class="dot ${o.dot}"></i>` : ""}</span><span class="tx"><span class="l">${o.tg ? `<span class="tg">${o.tg}</span>` : ""}${esc(o.l)}</span>${o.s ? `<span class="s">${esc(o.s)}</span>` : ""}</span>${o.rev ? `<i class="rv" title="layout-look changes it"></i>` : ""}${o.cnt !== undefined ? `<span class="cnt ${o.you ? "you" : ""}">${o.cnt}</span>` : ""}${o.st ? `<span class="st ${o.st[1]}">${o.st[0]}</span>` : ""}</a>`;
  }
  const NAV = () => [
    { ic: icon("home", 18), l: "Home", go: "home" },
    { ic: icon("inbox", 18), l: "Inbox", go: "inbox", cnt: inboxN },
    { ic: icon("list", 18), l: "Priorities", go: "priorities" },
    { ic: icon("scale", 18), l: "Decisions", go: "decisions" },
  ];
  const featItem = (f, tg) => ({
    ic: fIcon(f),
    l: f.title,
    s: `${stepName(f)} · ${f.age}`,
    go: "feature/" + f.slug,
    bd: f.state === "awaiting-you",
    tg,
    st:
      f.state === "awaiting-you"
        ? [f.step <= 2 ? "Q" : "S", "q"]
        : f.state === "done"
          ? ["✓", "r"]
          : ["B", "r"],
  });
  const sessItem = (s, tg) => ({
    ic: harness(s.harness, 18),
    l: s.title,
    s: `${s.model} · ${s.elapsed}`,
    go: "session/" + s.feature,
    dot: s.state === "running" ? "" : "wait",
    tg,
  });
  const limit = () => {
    const L = D.limits,
      n = Math.round(L.usedPct / 10);
    return `<div class="limit" title="${L.provider}: ${L.usedPct}% of the ${L.windowHours} h window, resets in ${L.resetsIn}"><span class="ic">${harness("claude", 18)}</span><span class="bar">${"█".repeat(n)}<i>${"░".repeat(10 - n)}</i></span><span class="tx">${L.usedPct}% · ${L.resetsIn}</span></div>`;
  };
  const brand = () =>
    `<a class="brand" data-go="home" href="#/home" style="text-decoration:none;color:inherit"><span class="ic it-ic" style="width:52px;display:grid;place-items:center">${logo(28)}</span><span class="tx"><b>URAEDA</b><span class="br">${icon("branch", 12)} ${D.project.branch}</span></span></a>`;
  const acts = () =>
    `<div class="acts"><button class="btn pri" data-go="new">${icon("plus", 16)}<span class="lbl">New</span></button><button class="btn" data-go="inbox">${icon("pencil", 16)}<span class="lbl">Note</span></button></div>`;
  const settingsItem = () => item({ ic: icon("settings", 18), l: "Settings", go: "settings" });

  // ---------- shell versions ----------
  const ctxSide = () => false;
  const sides = {
    3: () => `<nav class="side s3"><div class="side-in">${brand()}${acts()}
      <div class="pane"><span class="pt">Navigate</span>${NAV().map(item).join("")}</div>
      ${
        ctxSide()
          ? `<div data-dl="ctx" class="ctx">${ctxIndex()}</div>`
          : `<div class="pane you"><span class="pt">Needs you · ${need.length}</span>${need.map((f) => item(featItem(f))).join("")}</div>
      <div class="pane"><span class="pt">Sessions · ${D.sessions.length}</span>${D.sessions.map((s) => item(sessItem(s))).join("")}</div>
      <div class="pane"><span class="pt">In progress · ${wip.length}</span>${wip.map((f) => item(featItem(f))).join("")}</div>`
      }
      <div class="side-foot pane"><span class="pt">5 h window</span>${limit()}${settingsItem()}</div></div><div class="grip" data-grip title="Drag to resize, double-click to reset"></div></nav>`,
  };
  const tab = (go, ic, bd, cls = "") =>
    `<a class="tt ${isOn(go) ? "on" : ""} ${cls}" data-go="${go}" href="#/${go}" title="${go}">${icon(ic, 20)}${bd ? `<i class="bd ${bd[1] || ""}">${bd[0]}</i>` : ""}</a>`;
  const toptabs = () =>
    `<nav class="toptabs">${[
      tab("home", "home"),
      tab("inbox", "inbox", [inboxN, "n"]),
      tab("priorities", "list"),
      tab("features", "branch", [need.length]),
      tab("sessions", "pulse", [running.length, "g"]),
      tab("decisions", "scale"),
      tab("settings", "settings"),
      tab("new", "plus", 0, "plus"),
    ].join("")}</nav>`;

  // ---------- rows used by the home pages ----------
  function frow(f, o = {}) {
    const second =
      f.state === "awaiting-you"
        ? `${stepName(f)} · ${esc(f.note)}`
        : `${seg(f)}<span class="seg-l">${stepName(f)} · ${esc(f.note)}</span>`;
    return `<a class="rw ${f.state === "awaiting-you" ? "you" : ""}" data-go="feature/${f.slug}" href="#/feature/${f.slug}"><span class="lead">${f.state === "awaiting-you" ? icon(f.step <= 2 ? "help" : "file", 18) : fIcon(f)}</span><span class="bd"><span class="t1">${esc(f.title)}${kindPill(f)}</span><span class="t2">${second}</span></span><span class="rt"><span>${f.age}</span>${o.key ? `<kbd>${o.key}</kbd>` : ""}</span></a>`;
  }
  function srow(s) {
    const f = featureOf(s.feature);
    return `<a class="rw" data-go="session/${s.feature}" href="#/session/${s.feature}"><span class="lead">${harness(s.harness, 18)}</span><span class="bd"><span class="t1">${esc(s.title)}</span><span class="t2">${esc(f ? f.title : "")} · ${s.model}</span></span><span class="rt"><span>${s.elapsed}</span>${stPill(s.state)}</span></a>`;
  }
  const sh = (t, n, cls = "") =>
    `<h2 class="sh ${cls}">${t}${n !== undefined ? `<span class="cn">${n}</span>` : ""}</h2>`;
  const strip = () => {
    const L = D.limits;
    return `<div class="strip"><span><b class="y">${need.length}</b> need you</span><span><b class="gr">${running.length}</b> agents running</span><span>5 h window <b>${L.usedPct}%</b>, resets in ${L.resetsIn}</span></div>`;
  };
  const card = (f) =>
    `<a class="chamf you" data-go="feature/${f.slug}" href="#/feature/${f.slug}"><span class="in"><span class="ct">${esc(f.title)}${kindPill(f)}</span><span class="cm">${stepName(f)} · ${esc(f.note)}</span><span class="ca">${icon(f.step <= 2 ? "help" : "file", 16)} ${verb(f)} ${icon("chevR", 14)}</span></span></a>`;
  const bcard = (f) =>
    `<a class="bcard" data-go="feature/${f.slug}" href="#/feature/${f.slug}"><span class="ct">${esc(f.title)}${kindPill(f)}</span><span class="cm">${stepName(f)} · ${esc(f.note)}</span><span class="cf">${seg(f)}<span>${f.age}</span></span></a>`;
  const sbcard = (s) =>
    `<a class="bcard" data-go="session/${s.feature}" href="#/session/${s.feature}"><span class="ct">${esc(s.title)}</span><span class="cm">${esc((featureOf(s.feature) || {}).title || "")}</span><span class="cf"><span>${harness(s.harness, 14)} ${s.model}</span><span>${s.elapsed} ${stPill(s.state)}</span></span></a>`;

  // ---------- status line (3 versions) ----------
  const L = D.limits;
  const usageBar = (pct, n = 10) => {
    const f = Math.round((pct / 100) * n);
    return `<span class="bar">${"█".repeat(f)}<i>${"░".repeat(n - f)}</i></span>`;
  };
  const HINTS = {
    home: [
      ["1-2", "open"],
      ["n", "new"],
      ["i", "inbox"],
      ["d", "decisions"],
      ["/", "find"],
    ],
    settings: [
      ["/", "search"],
      ["⏎", "change"],
      ["f", "file view"],
      ["esc", "back"],
    ],
    decisions: [
      ["/", "filter"],
      ["⏎", "open"],
      ["j k", "move"],
      ["esc", "back"],
    ],
    decision: [
      ["h", "previous"],
      ["l", "next"],
      ["esc", "back"],
    ],
  };
  function statusline(crumbs, mode) {
    const cr = crumbs.map((c) => `<span>${c}</span>`).join(" › ");
    const needs = need.length
      ? `<div class="sl-warn">${icon("alert", 14)} ${need.length}<span class="hide-s"> need you</span></div>`
      : "";
    const modeEl = `<div class="mode">${mode}</div>`;
    if (S.status === 2)
      return `<div class="statusline">${modeEl}
        <div class="hide-s">${icon("folder", 14)} ${D.project.name}</div>
        <div class="sl-dim">${icon("branch", 14)} ${D.project.branch}<span class="git"> ✚2 ~3 ↑1</span></div>
        <div class="sl-mid hide-s">${cr}</div><div class="sl-mid show-s">${crumbs[crumbs.length - 1]}</div>
        ${needs}
        <div class="sl-dim hide-s">${icon("pulse", 14)} ${running.length}</div>
        <div class="sl-dim hide-s" title="5 h window of Claude Code">${harness("claude", 14)} ${usageBar(L.usedPct, 8)} ${L.usedPct}% · ${L.resetsIn}</div>
        <div class="sl-ok hide-s">● server</div>
        <div class="sl-dim hide-s">${icon("clock", 14)} 23:41</div></div>`;
    if (S.status === 3) {
      const h = HINTS[route()[0]] || HINTS.home;
      return `<div class="statusline">${modeEl}
        <div class="sl-mid hide-s">${h.map(([k, l]) => `<span class="hint"><kbd>${k}</kbd> ${l}</span>`).join("")}</div>
        <div class="sl-mid show-s">${crumbs[crumbs.length - 1]}</div>
        ${needs}<div class="sl-dim hide-s">${icon("pulse", 14)} ${running.length}</div></div>`;
    }
    return `<div class="statusline">${modeEl}<div class="sl-dim hide-s">${icon("branch", 14)} ${D.project.branch}</div><div class="sl-mid">${cr}</div>${needs}<div class="sl-dim hide-s">${icon("pulse", 14)} ${running.length} running</div><div class="sl-dim hide-s">${icon("clock", 14)} 23:41</div></div>`;
  }

  // ---------- panes: the sidebar's bordered panes, reused on the pages ----------
  const pane = (title, body, o = {}) =>
    `<section class="bp ${o.cls || ""}"><span class="pt">${o.ic ? icon(o.ic, 14) + " " : ""}${title}${o.n !== undefined ? ` · ${o.n}` : ""}</span>${body}${o.more ? `<a class="more" data-go="${o.more[1]}" href="#/${o.more[1]}">${o.more[0]} ${icon("chevR", 12)}</a>` : ""}</section>`;
  const frow2 = (f, key) => {
    const you = f.state === "awaiting-you";
    const second = you
      ? `${stepName(f)} · ${esc(f.note)}`
      : `${seg(f)}<span class="seg-l">${stepName(f)} · ${esc(f.note)}</span>`;
    return `<a class="rw ${you ? "you" : ""}" data-go="feature/${f.slug}" href="#/feature/${f.slug}"><span class="lead">${you ? icon(f.step <= 2 ? "help" : "file", 18) : fIcon(f)}</span><span class="bd"><span class="t1">${esc(f.title)}${kindPill(f)}</span><span class="t2">${second}</span></span><span class="rt">${you ? `<span class="act">${f.step <= 2 ? "Answer" : "Approve"} ${icon("chevR", 12)}</span>` : `<span>${f.age}</span>`}${key ? `<kbd>${key}</kbd>` : ""}</span></a>`;
  };
  const prioRows = () => {
    const rows = [];
    D.priorities.slice(0, 2).forEach((g) => g.items.forEach((it) => rows.push([g.group, it])));
    return rows
      .filter(([, it]) => it.t !== "Empty inbox")
      .map(
        ([g, it]) =>
          `<a class="rw" ${it.slug ? `data-go="feature/${it.slug}" href="#/feature/${it.slug}"` : `data-go="priorities" href="#/priorities"`}><span class="lead">${icon("flag", 18)}</span><span class="bd"><span class="t1">${esc(it.t)}</span><span class="t2"><span class="pill ${g === "Ongoing" ? "run" : ""}">${g.toLowerCase()}</span> ${esc(it.s || "not started")}${it.sub ? ` · ${it.sub.length} sub-items` : ""}</span></span></a>`,
      )
      .join("");
  };
  const usagePane = () => {
    const row = (l, pct, note) =>
      `<div class="us"><div class="u1"><span class="ul">${l}</span><span class="un d">${note}</span><span class="un">${pct}%</span></div>${usageBar(pct, 28)}</div>`;
    return pane(
      "Usage",
      `<div class="usage">${harness("claude", 18)}<div>${row("5 h window", L.usedPct, `resets in ${L.resetsIn}`)}${row("Week", L.week, "resets Monday")}<div class="t2" style="margin-top:0.4em">Warning at ${cfg.warn}% of the window.</div></div></div>`,
      { ic: "gauge" },
    );
  };
  const inboxPane = () => {
    const pick = [D.inbox[0].notes[0], D.inbox[3].notes[0], D.inbox[3].notes[1]];
    const cats = ["UI", "Deferred fixes", "Deferred fixes"];
    return pane(
      "Inbox",
      pick
        .map(
          (t, i) =>
            `<a class="rw" data-go="inbox" href="#/inbox"><span class="lead">${icon("pencil", 18)}</span><span class="bd"><span class="t1 clamp">${esc(t)}</span><span class="t2">${cats[i]}</span></span></a>`,
        )
        .join(""),
      { ic: "inbox", n: inboxN, more: [`Open the inbox`, "inbox"] },
    );
  };
  const problemPane = () =>
    pane(
      "Problems",
      `<a class="rw you" data-go="feature/merge-chats" href="#/feature/merge-chats"><span class="lead">${icon("alert", 18)}</span><span class="bd"><span class="t1">Merge chats and changes: task 12 of the plan has no test</span><span class="t2">plan.md · this blocks the build step</span></span></a>`,
      { ic: "alert", n: 1, cls: "bad" },
    );
  const activityPane = () =>
    pane(
      "Recent",
      [
        ["check", "Stable dev environment for UI review merged in #52", "3 h"],
        ["git", "Merge chats and changes: task 8 committed", "2 h"],
        ["msg", "You answered round 01 of Fix testing", "1 d"],
      ]
        .map(
          ([ic, t, w]) =>
            `<div class="rw"><span class="lead">${icon(ic === "git" ? "branch" : ic, 18)}</span><span class="bd"><span class="t1">${t}</span></span><span class="rt"><span>${w}</span></span></div>`,
        )
        .join(""),
      { ic: "history" },
    );

  const home = () => `<div class="page">
    ${problemPane()}
    ${pane("Needs you", need.map((f, i) => frow2(f, i + 1)).join(""), { cls: "you", ic: "alert", n: need.length })}
    <div class="cols2"><div class="stack">${pane("In progress", wip.map((f) => frow2(f)).join(""), { ic: "branch", n: wip.length })}</div>
      <div class="stack">${pane("Sessions", D.sessions.map(srow).join(""), { ic: "pulse", n: D.sessions.length, more: ["All sessions", "sessions"] })}</div></div>
    <div class="sep"><span>${icon("layout-grid", 14)} Overview</span></div>
    <div class="widgets">${pane("Priorities now", prioRows(), { ic: "flag", more: ["Open priorities", "priorities"] })}${usagePane()}${inboxPane()}${activityPane()}</div></div>`;

  // ---------- settings: the form, with a search, and the file view with pickers ----------
  const SET = [
    {
      sec: "Appearance",
      ic: "eye",
      rows: [
        {
          id: "scheme",
          ic: "eye",
          n: "Colour scheme",
          d: "Catppuccin Mocha is dark, Latte is light, and System follows the machine. More schemes come later.",
          opts: [
            ["mocha", "Mocha"],
            ["latte", "Latte"],
            ["system", "System"],
          ],
        },
        {
          id: "scale",
          ic: "scroll",
          n: "Text size",
          d: "The whole UI scales with it. 120% reads well on a 4K screen at 1.5x.",
          opts: [
            [100, "100%"],
            [110, "110%"],
            [120, "120%"],
            [130, "130%"],
            [140, "140%"],
          ],
        },
        {
          id: "motion",
          ic: "pulse",
          n: "Reduce motion",
          d: "Stops the pulsing dots on running sessions.",
          bool: 1,
        },
      ],
    },
    {
      sec: "Agents",
      ic: "robot",
      rows: [
        {
          id: "harness",
          ic: "robot",
          n: "Default harness",
          d: "Used by New, and by steps started from the home.",
          opts: [
            ["claude", "Claude Code"],
            ["codex", "Codex"],
            ["pi", "Pi"],
          ],
        },
        {
          id: "warn",
          ic: "gauge",
          n: "Warn at",
          d: "Shows a warning on the home when the 5 h window passes this share.",
          opts: [
            [60, "60%"],
            [80, "80%"],
            [95, "95%"],
          ],
        },
      ],
    },
    {
      sec: "Notifications",
      ic: "bell",
      rows: [
        {
          id: "push",
          ic: "bell",
          n: "Browser notifications",
          d: "Shown when a feature or session needs you, and never while you are looking at Uraeda.",
          bool: 1,
        },
        {
          id: "quiet",
          ic: "clock",
          n: "Quiet at night",
          d: "Holds notifications between 23:00 and 07:00 and lists them in the morning.",
          bool: 1,
        },
      ],
    },
    {
      sec: "Access",
      ic: "key",
      rows: [
        {
          custom: "key",
          ic: "key",
          n: "Access key",
          d: "Shown once when made, and stored only as a hash. Signing in lasts 30 days without use.",
          html: `<span class="mono-chip">••••••••••••</span><button class="btn">${icon("key", 16)} Make a new key</button>`,
        },
      ],
    },
    {
      sec: "Repositories",
      ic: "folder",
      rows: X.repos
        .map(([n, p, c]) => ({
          custom: n,
          ic: "folder",
          n,
          d: `${p} · ${c}`,
          html: `<button class="btn">Remove</button>`,
        }))
        .concat([
          {
            custom: "add",
            ic: "plus",
            n: "Add a repository",
            d: "Removing a repository does not touch its files.",
            html: `<button class="btn pri">${icon("plus", 16)} Add</button>`,
          },
        ]),
    },
  ];
  const ctlFor = (r) => {
    const v = cfg[r.id];
    if (r.bool)
      return `<button class="tgl ${v ? "on" : ""}" data-set="${r.id}" data-val="${v ? 0 : 1}"><span class="tk"></span>${v ? "on" : "off"}</button>`;
    return `<span class="sgm">${r.opts.map(([k, l]) => `<button class="${String(v) === String(k) ? "on" : ""}" data-set="${r.id}" data-val="${k}">${l}</button>`).join("")}</span>`;
  };
  const setRow = (r) =>
    `<div class="srow"><span class="lead">${icon(r.ic, 18)}</span><div class="bd"><span class="n">${hl(r.n, ui.q)}</span><span class="d">${hl(r.d, ui.q)}</span></div><div class="ctl">${r.custom ? r.html : ctlFor(r)}</div></div>`;
  function setForm() {
    const q = ui.q.toLowerCase();
    const secs = SET.map((s) => ({
      ...s,
      rows: s.rows.filter((r) => !q || (r.n + " " + r.d + " " + s.sec).toLowerCase().includes(q)),
    })).filter((s) => s.rows.length);
    if (!secs.length) return `<div class="stub">No setting matches “${esc(ui.q)}”.</div>`;
    return secs.map((s) => pane(s.sec, s.rows.map(setRow).join(""), { ic: s.ic })).join("");
  }
  const KEYS = {
    scheme: "scheme",
    scale: "text_scale",
    motion: "reduce_motion",
    harness: "default_harness",
    warn: "warn_at",
    push: "browser",
    quiet: "quiet_at_night",
  };
  function setFile() {
    const val = (r) => {
      const v = cfg[r.id],
        cls = r.bool ? "bool" : typeof v === "number" ? "num" : "";
      const shown = r.bool ? (v ? "true" : "false") : typeof v === "number" ? v : `"${v}"`;
      const opts = r.bool
        ? [
            [1, "true"],
            [0, "false"],
          ]
        : r.opts;
      const pop =
        ui.pick === r.id
          ? `<span class="pop">${opts.map(([k, l]) => `<button class="po ${String(v === true ? 1 : v) === String(k) || (r.bool && Number(v) === Number(k)) ? "on" : ""}" data-set="${r.id}" data-val="${k}"><span>${(r.bool ? Number(v) === Number(k) : String(v) === String(k)) ? "●" : "○"}</span> ${l}</button>`).join("")}</span>`
          : "";
      return `<span class="vw"><button class="v ${cls}" data-pick="${r.id}">${shown} ${icon("chevD", 12)}</button>${pop}</span>`;
    };
    return (
      SET.filter((s) => s.rows.some((r) => r.id))
        .map(
          (s) =>
            `<span class="sect">[${s.sec.toLowerCase()}]</span>${s.rows
              .filter((r) => r.id)
              .map(
                (r) =>
                  `<span class="cm"># ${r.d}</span>\n<span class="k">${KEYS[r.id]}</span> = ${val(r)}\n`,
              )
              .join("")}`,
        )
        .join("") +
      `<span class="sect">[access]</span><span class="cm"># Stored as a hash. Make a new key to sign everyone out.</span>\n<span class="k">key_hash</span> = <span class="cm">"argon2id$…"</span>\n<span class="sect">[[repository]]</span><span class="k">name</span> = "uraeda"\n<span class="k">path</span> = "~/Development/ai/uraeda"\n<span class="sect">[[repository]]</span><span class="k">name</span> = "notes"\n<span class="k">path</span> = "~/Development/notes"`
    );
  }
  const settings = () =>
    ui.sv === "file"
      ? `<div class="page"><div class="filebar">${icon("file", 16)} <b>~/.config/uraeda/settings.toml</b><span class="sl-dim">click a value to pick one · comments and order are kept on every write</span></div><pre class="toml">${setFile()}</pre></div>`
      : `<div class="page" id="sl">${setForm()}</div>`;

  // ---------- decisions: three layouts of a list and a reader ----------
  const RN = D.constitution;
  const meta = (d) => X.meta[d.n];
  const lvCls = (l) => (l === "MUST NOT" ? "not" : l === "SHOULD" ? "should" : "");
  const lvOf = (r) => (r.match(/MUST NOT|MUST|SHOULD NOT|SHOULD|MAY/) || ["NOTE"])[0];
  const hl = (t, q) =>
    q
      ? esc(t).replace(
          new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"),
          '<span class="hl">$1</span>',
        )
      : esc(t);
  const revPill = (d) =>
    d.rev ? `<span class="pill rev">${icon("diff", 12)} layout-look changes it</span>` : "";
  const statePill = (d) =>
    `<span class="pill ${d.status === "proposed" ? "wait" : "run"}">${d.status || "active"}</span>`;
  const defaultSel = "ui-layout";
  const selId = () => route()[1] || "";
  const curId = () => selId() || defaultSel;
  const AREAS = ["Constitution", ...X.groups];
  const areaIc = (a) => (a === "Constitution" ? "book-open" : X.groupIc[a]);
  // One shape for a principle and a decision, so the lists draw both the same way.
  const entries = (area) => {
    const q = ui.q.toLowerCase();
    const all =
      area === "Constitution"
        ? RN.map((p, i) => ({
            id: "p-" + p.n,
            name: p.t,
            rn: p.n,
            ic: X.principleIc[i],
            sub: p.rules[0],
            count: p.rules.length,
            ch: "",
          }))
        : X.decisions
            .filter((d) => d.g === area)
            .map((d) => ({
              id: d.slug,
              name: d.n,
              ic: meta(d)[0],
              sub: meta(d)[1],
              count: d.rules,
              rev: d.rev,
              ch: d.ch,
            }));
    return all.filter((e) => !q || (e.name + " " + e.sub).toLowerCase().includes(q));
  };
  const areaOf = (id) =>
    id.startsWith("p-") || id === "constitution"
      ? "Constitution"
      : (X.decisions.find((d) => d.slug === id) || {}).g || "UI";
  const on = (e) => (curId() === e.id ? "sel" : "");
  const go = (e) => `data-go="decisions/${e.id}" href="#/decisions/${e.id}"`;
  const mark = (e) =>
    e.rn ? `<span class="rn">${e.rn}</span>` : `<span class="ic">${icon(e.ic, 17)}</span>`;

  // reader: no boxes around its parts, wide margins, one comfortable measure
  function reader() {
    const id = curId();
    const back = `<a class="btn back" data-go="decisions" href="#/decisions">${icon("chevR", 14, "flip")} All decisions</a>`;
    const rules = (rs) =>
      `<ol class="rl">${rs.map(([l, t, c]) => `<li><span class="lv ${lvCls(l)}">${l}</span><span class="tx">${esc(t)}${c ? `<span class="chk">${icon("shield-check", 13)} checked by ${esc(c)}</span>` : ""}</span></li>`).join("")}</ol>`;
    const nav = (pv, nx) =>
      `<nav class="pager">${pv ? `<a data-go="decisions/${pv[1]}" href="#/decisions/${pv[1]}">${icon("chevR", 14, "flip")} ${esc(pv[0])}</a>` : "<span></span>"}${nx ? `<a data-go="decisions/${nx[1]}" href="#/decisions/${nx[1]}">${esc(nx[0])} ${icon("chevR", 14)}</a>` : "<span></span>"}</nav>`;
    if (id === "constitution" || id.startsWith("p-")) {
      return `<article class="rd">${back}<header><span class="di-ic big">${icon("book-open", 28)}</span><div><div class="eyebrow">specs/CONSTITUTION.md</div><h1>Constitution</h1></div></header>
        <p class="lede">Principles are listed by priority: when two principles conflict, the higher one wins. Every decision gives way to them, and only a human amends them.</p>
        <nav class="toc">${RN.map((p) => `<a data-go="decisions/p-${p.n}" href="#/decisions/p-${p.n}"><b>${p.n}</b> ${esc(p.t)}</a>`).join("")}</nav>
        ${RN.map((p, i) => `<section class="prin" id="prin-${p.n}"><h2 class="ph"><span class="rn">${p.n}</span>${esc(p.t)}<span class="pr">${i === 0 ? "highest" : `priority ${i + 1}`}</span></h2>${rules(p.rules.map((r) => [lvOf(r), r]))}${p.why ? `<p class="why"><b>Rationale.</b> ${esc(p.why)}</p>` : ""}</section>`).join("")}
        <p class="src">${icon("file-text", 14)} specs/CONSTITUTION.md · only a human amends it</p></article>`;
    }
    if (false) {
      const i = 0,
        p = RN[i];
      return `<article class="rd">${back}<header><span class="di-ic big">${icon(X.principleIc[i], 28)}</span><div><div class="eyebrow">Constitution · principle ${i + 1} of ${RN.length}</div><h1><span class="rn">${p.n}</span> ${esc(p.t)}</h1></div></header>
        <p class="lede">${
          i === 0
            ? "The highest principle: when two principles conflict, this one wins."
            : `When it conflicts with ${RN.slice(0, i)
                .map((x) => x.n)
                .join(", ")}, ${RN.slice(0, i).length > 1 ? "those win" : "that one wins"}.`
        } Only a human amends it.</p>
        <h2 class="rh">Rules <span>${p.rules.length}</span></h2>${rules(p.rules.map((r) => [lvOf(r), r]))}
        ${p.why ? `<h2 class="rh">Why</h2><p class="why">${esc(p.why)}</p>` : ""}
        ${nav(RN[i - 1] && [RN[i - 1].t, "p-" + RN[i - 1].n], RN[i + 1] && [RN[i + 1].t, "p-" + RN[i + 1].n])}</article>`;
    }
    const i = Math.max(
        0,
        X.decisions.findIndex((x) => x.slug === id),
      ),
      d = X.decisions[i],
      pv = X.decisions[i - 1],
      nx = X.decisions[i + 1];
    const diff = X.diffs[d.n]
      ? `<div class="dif"><div class="dif-h">${icon("diff", 14)} Proposed by layout-look</div>${X.diffs[d.n].map(([k, t]) => `<div class="dl ${k === "-" ? "del" : "add"}"><span class="mk">${k}</span><span>${esc(t)}</span></div>`).join("")}</div>`
      : "";
    return `<article class="rd">${back}<header><span class="di-ic big">${icon(meta(d)[0], 28)}</span><div><div class="eyebrow">${d.g} · decision</div><h1>${d.n}</h1></div></header>
      <div class="meta">${statePill(d)}<span>${d.rules} rules</span><span class="sl-dim">changed ${d.ch} ago</span>${revPill(d)}</div>
      <p class="lede">${esc(d.intro)}</p>${diff}
      <h2 class="rh">Rules <span>${d.rules}</span></h2>${rules(d.r)}
      ${d.why ? `<h2 class="rh">Why</h2><p class="why">${esc(d.why)}</p>` : ""}
      <p class="src">${icon("file-text", 14)} specs/decisions/${d.slug}.md</p>${nav(pv && [pv.n, pv.slug], nx && [nx.n, nx.slug])}</article>`;
  }

  // layout 1: a compact index and a wide reader
  function listIndex() {
    const out = AREAS.map((a) => [a, entries(a)]).filter(([, l]) => l.length);
    if (!out.length) return `<div class="stub">No decision matches.</div>`;
    return out
      .map(
        ([a, l]) =>
          `<div class="ixh${a === "Constitution" ? " top" : ""}">${icon(areaIc(a), 14)} ${a}<span class="n">${l.length}</span></div>${l.map((e) => `<a class="ixi ${on(e)}" ${go(e)}>${mark(e)}<span class="nm">${hl(e.name, ui.q)}</span>${e.rev ? `<i class="rv" title="layout-look changes it"></i>` : ""}</a>`).join("")}`,
      )
      .join("");
  }
  // layout 2: a strip on top (areas, then entries), and the reader under it at full width
  const area2 = () => ui.area || areaOf(curId());
  function listChips() {
    const l = ui.q ? AREAS.flatMap((a) => entries(a)) : entries(area2());
    if (!l.length)
      return `<span class="sl-dim" style="padding:0.4em 0">No decision matches.</span>`;
    return l
      .map(
        (e) =>
          `<a class="ch ${on(e)}" ${go(e)}>${mark(e)}<span class="nm">${hl(e.name, ui.q)}</span>${e.rev ? `<i class="rv" title="layout-look changes it"></i>` : ""}</a>`,
      )
      .join("");
  }
  const strip2 = () =>
    `<div class="strip2"><div class="atabs">${AREAS.map((a) => `<button class="at ${a === area2() ? "on" : ""}" data-area="${a}">${icon(areaIc(a), 16)}<span class="nm">${a}</span><span class="n">${a === "Constitution" ? RN.length : X.decisions.filter((d) => d.g === a).length}</span></button>`).join("")}</div><div class="chs" data-dl="page">${listChips()}</div></div>`;
  // layout 3: the index lives in the sidebar, so the page is only the reader
  function ctxIndex() {
    const out = AREAS.map((a) => [a, entries(a)]).filter(([, l]) => l.length);
    if (!out.length) return `<div class="stub">No decision matches.</div>`;
    return out
      .map(
        ([a, l]) =>
          `<div class="pane${a === "Constitution" ? " you cons" : ""}"><span class="pt">${a} · ${l.length}</span>${l.map((e) => item({ ic: e.rn ? `<b class="rn">${e.rn}</b>` : icon(e.ic, 17), l: e.name, go: "decisions/" + e.id, on: curId() === e.id, cls: "sm", rev: e.rev })).join("")}</div>`,
      )
      .join("");
  }
  // ---------- layouts 4 to 7: one overview page, then four ways to read an entry ----------
  const normId = (id) => (id === "constitution" ? "p-I" : id);
  const isSel = (e) => !ui.peekClosed && normId(curId()) === e.id;
  function ovList() {
    const out = AREAS.map((a) => [a, entries(a)]).filter(([, l]) => l.length);
    if (!out.length) return `<div class="stub">No decision matches.</div>`;
    return out
      .map(
        ([a, l]) =>
          `<section class="ova ${a === "Constitution" ? "cons" : ""}"><h2>${icon(areaIc(a), 16)} ${a}<span class="n">${l.length}</span>${a === "Constitution" ? `<span class="hint">one file, highest first</span>` : ""}</h2>${l
            .map((e) => {
              const open = S.dec === 7 && isSel(e);
              const target = open ? "decisions" : "decisions/" + e.id;
              return `<a class="ovr ${isSel(e) ? "sel" : ""} ${open ? "open" : ""}" data-go="${target}" href="#/${target}">${mark(e)}<span class="nm">${hl(e.name, ui.q)}${e.rev ? ` <i class="rv" title="layout-look changes it"></i>` : ""}</span><span class="sm">${hl(e.sub, ui.q)}</span><span class="ct">${e.count} rules${e.ch ? ` · ${e.ch}` : ""}</span><span class="cv">${icon(open ? "chevD" : "chevR", 14)}</span></a>${open ? `<div class="acc-rd">${reader()}</div>` : ""}`;
            })
            .join("")}</section>`,
      )
      .join("");
  }
  const overview = () =>
    `<div class="ov"><header class="ov-h"><h1>${icon("scale", 22)} Decisions and constitution</h1><p>The constitution's ${RN.length} principles win over every decision. ${X.decisions.length} decisions in ${X.groups.length} areas, ${X.decisions.filter((d) => d.rev).length} of them changed by layout-look.</p></header><div data-dl="page">${ovList()}</div></div>`;
  // layout 5: the breadcrumb's area and entry open menus of their siblings
  const crumbMenus = () => {
    const id = curId(),
      a = areaOf(id),
      e = entries(a).find((x) => x.id === id) || entries(a)[0];
    const areaMenu = AREAS.map((x) => {
      const first = entries(x)[0];
      return `<a class="mo ${x === a ? "on" : ""}" data-go="decisions/${first.id}" href="#/decisions/${first.id}">${icon(areaIc(x), 16)} ${x}<span class="n">${x === "Constitution" ? RN.length : X.decisions.filter((d) => d.g === x).length}</span></a>`;
    }).join("");
    const itemMenu = entries(a)
      .map(
        (x) =>
          `<a class="mo ${x.id === id ? "on" : ""}" ${go(x)}>${mark(x)} ${esc(x.name)}${x.rev ? ` <i class="rv"></i>` : ""}</a>`,
      )
      .join("");
    return `<a class="cr" data-go="decisions" href="#/decisions">decisions</a><span class="bc"><button class="bcb" data-menu="area">${icon(areaIc(a), 14)} ${a} ${icon("chevD", 12)}</button>${ui.menu === "area" ? `<span class="menu">${areaMenu}</span>` : ""}</span><span class="bc"><button class="bcb cur" data-menu="item">${e.rn ? `<b class="rn">${e.rn}</b>` : icon(e.ic, 14)} ${esc(e.name)} ${icon("chevD", 12)}</button>${ui.menu === "item" ? `<span class="menu">${itemMenu}</span>` : ""}</span>`;
  };
  // layout 6: a palette that searches every entry and previews the one under the cursor
  const palEntries = () => {
    const q = ui.pq.toLowerCase();
    return AREAS.flatMap((a) => entries(a).map((e) => ({ ...e, a }))).filter(
      (e) => !q || (e.name + " " + e.sub + " " + e.a).toLowerCase().includes(q),
    );
  };
  function palList() {
    const l = palEntries();
    if (!l.length) return `<div class="stub">Nothing matches.</div>`;
    let last = "";
    return l
      .map((e) => {
        const h = e.a !== last ? `<div class="pg">${icon(areaIc(e.a), 13)} ${e.a}</div>` : "";
        last = e.a;
        return `${h}<a class="pi ${ui.palSel === e.id ? "on" : ""}" data-pv="${e.id}" data-go="decisions/${e.id}" href="#/decisions/${e.id}">${mark(e)}<span class="nm">${hl(e.name, ui.pq)}</span>${e.rev ? `<i class="rv"></i>` : ""}</a>`;
      })
      .join("");
  }
  function palPreview() {
    const id = ui.palSel || (palEntries()[0] || {}).id;
    if (!id) return "";
    if (id === "constitution")
      return `<div class="pv-h">${icon("book-open", 18)} Constitution</div><div class="pv-s">${RN.length} principles, highest first</div>${RN.map((p) => `<div class="pv-r"><span class="lv">${p.n}</span>${esc(p.t)}</div>`).join("")}`;
    if (id.startsWith("p-")) {
      const p = RN.find((x) => "p-" + x.n === id);
      return `<div class="pv-h"><span class="rn">${p.n}</span> ${esc(p.t)}</div><div class="pv-s">Constitution · ${p.rules.length} rules</div>${p.rules.map((r) => `<div class="pv-r"><span class="lv ${lvCls(lvOf(r))}">${lvOf(r)}</span>${esc(r)}</div>`).join("")}`;
    }
    const d = X.decisions.find((x) => x.slug === id);
    return `<div class="pv-h">${icon(meta(d)[0], 18)} ${d.n}</div><div class="pv-s">${d.g} · ${d.rules} rules · changed ${d.ch} ago</div><p class="pv-p">${esc(d.intro)}</p>${d.r
      .slice(0, 3)
      .map(([l, t]) => `<div class="pv-r"><span class="lv ${lvCls(l)}">${l}</span>${esc(t)}</div>`)
      .join(
        "",
      )}${d.r.length > 3 ? `<div class="pv-s">and ${d.r.length - 3} more · ⏎ to open</div>` : ""}`;
  }
  const palette = () =>
    ui.pal
      ? `<div class="pal-wrap" data-palclose><div class="pal"><div class="pal-in">${icon("search", 16)}<input data-pq placeholder="Jump to a decision or principle…" value="${esc(ui.pq)}" /><kbd>esc</kbd></div><div class="pal-b"><div class="pal-l" id="pal-l">${palList()}</div><div class="pal-pv" id="pal-pv">${palPreview()}</div></div><div class="pal-f"><span><kbd>↑↓</kbd> move</span><span><kbd>⏎</kbd> open</span><span><kbd>esc</kbd> close</span></div></div></div>`
      : "";
  const jumpBtn = () =>
    `<button class="btn jump" data-pal>${icon("search", 14)} Jump to… <kbd>/</kbd></button>`;

  function decList() {
    return ovList();
  }
  // Three columns: the navigation, the list, and the entry, open by default; the palette works in all three.
  const TRI = { 1: "Layered surfaces", 2: "Floating sheet", 3: "Panes" };
  const decisions = () => {
    const id = normId(curId()),
      e = AREAS.flatMap((a) => entries(a)).find((x) => x.id === id) || { name: "", rules: 0 },
      total = RN.length + X.decisions.length;
    const open = !ui.peekClosed;
    const flat = AREAS.flatMap((a) =>
      a === "Constitution"
        ? RN.map((p) => "p-" + p.n)
        : X.decisions.filter((d) => d.g === a).map((d) => d.slug),
    );
    const i = flat.indexOf(id),
      pv = flat[i - 1],
      nx = flat[i + 1];
    const step = (to, ic, t) =>
      to
        ? `<a class="btn sq" data-go="decisions/${to}" href="#/decisions/${to}" title="${t}">${icon(ic, 14, ic === "chevR" && t === "Previous" ? "flip" : "")}</a>`
        : `<span class="btn sq off">${icon(ic, 14, t === "Previous" ? "flip" : "")}</span>`;
    const bar = `<div class="pk-bar">${S.dec === 3 ? "" : `<span class="pk-t">${mark(e)} ${esc(e.name)}</span>`}<span class="sp"></span>${step(pv, "chevR", "Previous")}${step(nx, "chevR", "Next")}<button class="btn sq" data-peekclose title="Close (esc)">${icon("x", 14)}</button></div>`;
    const listHead = `<div class="tl-h"><span class="tl-t">${icon("scale", 16)} Decisions</span><span class="sl-dim">${total} entries</span><span class="sp"></span>${open ? "" : `<span class="sl-dim">select an entry to read it</span>`}</div>`;
    const list = `<div class="tl">${S.dec === 3 ? `<span class="pt">${icon("scale", 14)} Decisions · ${total}</span>` : listHead}<div data-dl="page">${ovList()}</div></div>`;
    const peek = open
      ? `<aside class="pk">${S.dec === 3 ? `<span class="pt">${mark(e)} ${esc(e.name)}</span>` : ""}${bar}${reader()}</aside>`
      : "";
    return `<div class="tri t${S.dec} ${open ? "open" : ""} ${selId() ? "has-sel" : ""}">${list}${peek}</div>${palette()}`;
  };

  // ---------- pages ----------
  const stubNote = (what) =>
    `<div class="stub"><h2>${what}</h2><p>This page is not part of round 2: it keeps the look of the first terminal mockup until the shell and these pages are settled.</p><p><a href="terminal.html#/${route().join("/")}">Open it in the first round's terminal mockup →</a></p></div>`;
  const searchBar = (ph) =>
    `<span class="search">${icon("search", 14)}<input data-q placeholder="${ph}" value="${esc(ui.q)}" /></span>`;
  const pages = {
    home: () => ({ html: home(), crumbs: ["home"], title: "Home" }),
    settings: () => ({
      html: settings(),
      crumbs: ["settings"],
      bar: `${searchBar("Search settings")}<span class="sgm vw-t"><button class="${ui.sv === "form" ? "on" : ""}" data-sv="form">${icon("settings", 14)}<span class="hide-s"> Form</span></button><button class="${ui.sv === "file" ? "on" : ""}" data-sv="file">${icon("file", 14)}<span class="hide-s"> File</span></button></span>`,
    }),
    decisions: () => ({
      html: decisions(),
      title: "",
      crumbs: ["decisions", ...(selId() ? [selId().replace(/^p-/, "principle ")] : [])],
      bar: `${searchBar("Filter")} ${jumpBtn()}`,
    }),
    features: () => ({
      html: `<div class="page">${pane("Needs you", need.map((f) => frow2(f)).join(""), { cls: "you", ic: "alert", n: need.length })}${pane("In progress", wip.map((f) => frow2(f)).join(""), { ic: "branch", n: wip.length })}${pane("Done", done.map((f) => frow2(f)).join(""), { ic: "check", n: done.length })}</div>`,
      crumbs: ["features"],
      title: "Features and changes",
    }),
    sessions: () => ({
      html: `<div class="page">${pane("Sessions", D.sessions.map(srow).join(""), { ic: "pulse", n: D.sessions.length })}</div>`,
      crumbs: ["sessions"],
      title: "Sessions",
    }),
  };
  const page = () =>
    (
      pages[route()[0]] ||
      (() => ({ html: stubNote(route()[0]), crumbs: route(), title: route().join(" / ") }))
    )();

  // ---------- render ----------
  function render() {
    const keepMain = (document.getElementById("main") || {}).scrollTop || 0;
    document.documentElement.dataset.theme = theme();
    stage.style.setProperty("--fs", (14 * cfg.scale) / 100 + "px");
    stage.classList.toggle("still", cfg.motion);
    const p = page();
    const mode = route()[0] === "home" ? "NORMAL" : ui.q ? "SEARCH" : "VIEW";
    stage.innerHTML = `<div class="shell s3 ">${sides[3]()}${toptabs()}
      <div class="mainwrap"><div class="winbar"><span class="wl">${logo(18)}</span>${p.crumbHtml || p.crumbs.map((c, i) => (i === p.crumbs.length - 1 ? `<b class="cr">${c}</b>` : `<span class="cr">${c}</span>`)).join("")}<span class="sp"></span>${p.bar || `<span class="sl-dim hide-s">${p.title}</span>`}</div><div class="main" id="main">${p.html}</div></div>
      ${statusline(p.crumbs, mode)}</div>`;
    document.getElementById("main").scrollTop = keepMain;
    if (route()[0] === "decisions" && selId().startsWith("p-")) {
      const el = document.getElementById("prin-" + selId().slice(2)),
        pane =
          el &&
          el.closest(".rd").parentElement.querySelector(".rd") &&
          document.querySelector(".pk .rd");
      if (el && pane) pane.scrollTop = el.offsetTop - pane.offsetTop - 8;
    }
    bar();
  }
  function bar() {
    const g = (label, key, names) =>
      `<span class="g"><span>${label}</span>${names.map((n, i) => `<button class="${S[key] === i + 1 ? "on" : ""}" data-v="${key}:${i + 1}" title="${n}">${i + 1}</button>`).join("")}<span class="nm">${names[S[key] - 1]}</span></span>`;
    ctl.innerHTML = `
      <span class="g"><span>Theme</span>${["mocha", "latte"].map((t) => `<button class="${cfg.scheme === t ? "on" : ""}" data-v="theme:${t}">${t}</button>`).join("")}</span>
      <span class="g"><span>Width</span>${["auto", 1440, 1205, 960, 390].map((w) => `<button class="${String(S.w) === String(w) ? "on" : ""}" data-v="w:${w}">${w}</button>`).join("")}</span>`;
    frame.classList.toggle("fixed", S.w !== "auto");
    stage.style.width = S.w === "auto" ? "100%" : S.w + "px";
    stage.style.maxWidth = "100%";
    const u = new URLSearchParams({ theme: cfg.scheme, scale: cfg.scale, sv: ui.sv, w: S.w });
    history.replaceState(null, "", "?" + u + location.hash);
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest(
      "[data-go],[data-v],[data-set],[data-pick],[data-sv],[data-chip],[data-area]",
    );
    if (ui.menu && !e.target.closest(".bc")) {
      ui.menu = "";
      if (!e.target.closest("[data-go]")) return render();
    }
    if (e.target.closest("[data-pal]")) {
      ui.pal = true;
      ui.pq = "";
      ui.palSel = normId(curId());
      render();
      document.querySelector("[data-pq]").focus();
      return;
    }
    if (e.target.closest("[data-peekclose]")) {
      ui.peekClosed = true;
      return render();
    }
    if (e.target.matches("[data-palclose]")) {
      ui.pal = false;
      return render();
    }
    const mb = e.target.closest("[data-menu]");
    if (mb) {
      ui.menu = ui.menu === mb.dataset.menu ? "" : mb.dataset.menu;
      return render();
    }
    if (ui.pick && !e.target.closest(".vw")) {
      ui.pick = null;
      if (!t) return render();
    }
    if (!t) return;
    const d = t.dataset;
    if (d.v) {
      const [k, v] = d.v.split(":");
      if (k === "theme") cfg.scheme = v;
      else S[k] = k === "w" ? v : +v;
      render();
    } else if (d.set) {
      cfg[d.set] = isNaN(+d.val) ? d.val : +d.val;
      ui.pick = null;
      render();
    } else if (d.pick) {
      ui.pick = ui.pick === d.pick ? null : d.pick;
      render();
    } else if (d.sv) {
      ui.sv = d.sv;
      render();
    } else if (d.area) {
      ui.area = d.area;
      render();
    } else if (d.chip) {
      const [k, v] = d.chip.split(":");
      ui[k] = v;
      render();
    } else if (d.go) {
      e.preventDefault();
      location.hash = "#/" + d.go;
    }
  });
  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest("[data-pv]");
    if (!t || ui.palSel === t.dataset.pv) return;
    ui.palSel = t.dataset.pv;
    document.querySelectorAll(".pi.on").forEach((x) => x.classList.remove("on"));
    t.classList.add("on");
    document.getElementById("pal-pv").innerHTML = palPreview();
  });
  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-pq]")) {
      ui.pq = e.target.value;
      ui.palSel = "";
      document.getElementById("pal-l").innerHTML = palList();
      document.getElementById("pal-pv").innerHTML = palPreview();
      return;
    }
    if (!e.target.matches("[data-q]")) return;
    ui.q = e.target.value;
    if (route()[0] === "settings") {
      const el = document.getElementById("sl");
      if (el) el.innerHTML = setForm();
      return;
    }
    document
      .querySelectorAll("[data-dl]")
      .forEach((el) => (el.innerHTML = el.dataset.dl === "ctx" ? ctxIndex() : decList()));
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("[data-grip]")) return;
    e.preventDefault();
    const left = stage.getBoundingClientRect().left;
    const mv = (ev) =>
      stage.style.setProperty(
        "--side-user",
        Math.min(560, Math.max(240, ev.clientX - left)) + "px",
      );
    const up = () => {
      removeEventListener("pointermove", mv);
      removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    addEventListener("pointermove", mv);
    addEventListener("pointerup", up);
  });
  document.addEventListener(
    "dblclick",
    (e) => e.target.closest("[data-grip]") && stage.style.removeProperty("--side-user"),
  );
  addEventListener("hashchange", () => {
    ui.peekClosed = false;
    ui.q = "";
    ui.pal = false;
    ui.menu = "";
    ui.area = "";
    ui.pick = null;
    render();
  });
  addEventListener("keydown", (e) => {
    if (ui.pal) {
      const l = palEntries(),
        i = Math.max(
          0,
          l.findIndex((x) => x.id === (ui.palSel || (l[0] || {}).id)),
        );
      if (e.key === "Escape") {
        ui.pal = false;
        return render();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = l[Math.min(l.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
        if (n) {
          ui.palSel = n.id;
          document.getElementById("pal-l").innerHTML = palList();
          document.getElementById("pal-pv").innerHTML = palPreview();
          document.querySelector(".pi.on")?.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (e.key === "Enter" && l[i]) location.hash = "#/decisions/" + l[i].id;
      return;
    }
    if (e.key === "Escape" && route()[0] === "decisions" && !ui.peekClosed)
      return void ((ui.peekClosed = true), render());
    if (e.key === "/" && route()[0] === "decisions" && !/INPUT/.test(e.target.tagName)) {
      e.preventDefault();
      ui.pal = true;
      ui.pq = "";
      ui.palSel = normId(curId());
      render();
      document.querySelector("[data-pq]").focus();
      return;
    }
    if (/INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (route()[0] === "home" && /^[1-9]$/.test(k) && need[+k - 1])
      location.hash = "#/feature/" + need[+k - 1].slug;
    else if (k === "d") location.hash = "#/decisions";
    else if (k === "s") location.hash = "#/settings";
    else if (k === "h") location.hash = "#/home";
    else if (k === "/") {
      const i = document.querySelector("[data-q]");
      if (i) {
        e.preventDefault();
        i.focus();
      }
    }
  });
  matchMedia("(prefers-color-scheme: light)").addEventListener(
    "change",
    () => cfg.scheme === "system" && render(),
  );
  render();
})();
