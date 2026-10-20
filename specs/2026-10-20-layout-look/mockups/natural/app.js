// Direction N, "natural": every view of the information architecture, drawn as a calm garden.
(function () {
  const D = window.URA,
    B = window.BLOCKS,
    app = document.getElementById("app");
  const state = { pop: null, sheet: false, sel: 0, theme: "light" };
  const featureOf = (s) => D.features.find((f) => f.slug === s);
  const running = D.sessions.filter((s) => s.state === "running");
  const need = D.features.filter((f) => f.state === "awaiting-you");
  const nNotes = D.inbox.reduce((n, c) => n + c.notes.length, 0);
  const route = () => (location.hash.replace(/^#\//, "") || "home").split("/");
  const go = (p) => {
    state.pop = null;
    location.hash = "#/" + p;
  };
  const target = (f) =>
    (f.state === "awaiting-you" && f.step === 2
      ? "clar/"
      : f.state === "awaiting-you"
        ? "spec/"
        : "feature/") + f.slug;

  const MARK = `<svg viewBox="0 0 32 32" fill="none"><path d="M16 29V19c0-3 3-4 4-7M16 21c-3-1-5-3-5-6" stroke="#6a4a30" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="11" cy="9.5" rx="7" ry="4.2" fill="#5b7f3f"/><ellipse cx="22" cy="8" rx="6.5" ry="4" fill="#7ea055"/><ellipse cx="22" cy="14" rx="4.5" ry="2.8" fill="#4a6b34"/><path d="M8 29h16l-2 -4H10z" fill="#b9663a"/></svg>`;

  // ---------- the bonsai ----------
  function pad(cx, cy, sc, cols, blossoms) {
    const E = [
      [-44, 6, 50, 26],
      [0, -12, 58, 30],
      [46, 8, 48, 25],
      [-6, 20, 52, 22],
      [-52, -14, 34, 18],
      [52, -14, 36, 18],
    ];
    let s = `<g class="pad">${E.map(([dx, dy, rx, ry], i) => `<ellipse cx="${cx + dx * sc}" cy="${cy + dy * sc}" rx="${rx * sc}" ry="${ry * sc}" fill="${cols[i % cols.length]}"/>`).join("")}`;
    if (blossoms)
      s += [
        [-50, 0],
        [-14, -20],
        [24, -8],
        [52, 6],
        [-24, 18],
        [8, 14],
        [40, -26],
      ]
        .map(
          ([dx, dy]) =>
            `<circle cx="${cx + dx * sc}" cy="${cy + dy * sc}" r="${5.5 * sc}" fill="#d4838a"/><circle cx="${cx + dx * sc}" cy="${cy + dy * sc}" r="${2 * sc}" fill="#f6dcdd"/>`,
        )
        .join("");
    return s + "</g>";
  }
  function tree() {
    const G = ["#5b7f3f", "#6f9650", "#4a6b34", "#7fa45a"],
      C = ["#2f6f5e", "#3f8a73", "#2a5a4d"],
      A = ["#c59a38", "#d8b04e", "#b3862a"];
    const spec = {
      "layout-look": {
        x: 215,
        y: 175,
        cols: G,
        bl: true,
        sc: 1.05,
        br: "M432 305 C 360 300, 280 255, 235 195",
      },
      "merge-chats": {
        x: 690,
        y: 160,
        cols: G,
        sc: 1.05,
        br: "M470 335 C 560 325, 640 255, 690 185",
      },
      "fix-testing": {
        x: 165,
        y: 335,
        cols: G,
        bl: true,
        sc: 0.95,
        br: "M455 410 C 380 410, 275 400, 195 352",
      },
      "tasks-reappear": {
        x: 740,
        y: 310,
        cols: C,
        sc: 0.85,
        br: "M485 395 C 580 392, 660 352, 725 322",
      },
      "ui-sandbox": { x: 452, y: 70, cols: A, sc: 0.7, br: "M450 135 C 450 118, 452 105, 452 92" },
    };
    const label = (f, p) => {
      const left = p.x < 450,
        x = left ? p.x - 98 : p.x - 100,
        t = f.title.length > 27 ? f.title.slice(0, 26) + "…" : f.title;
      return `<text class="tt" x="${x}" y="${p.y - 52 * p.sc}">${t}</text><text class="ts" x="${x}" y="${p.y - 52 * p.sc + 17}">${D.steps[f.step]} · ${f.state === "awaiting-you" ? "waiting for you" : f.state === "done" ? "merged" : f.note}</text>`;
    };
    return `<svg class="tree" viewBox="0 0 900 560" role="img" aria-label="A bonsai whose branches are your features">
      <g class="sway">
        ${Object.entries(spec)
          .map(
            ([slug, p]) =>
              `<path d="${p.br}" stroke="#6a4a30" stroke-width="${slug === "ui-sandbox" ? 7 : 10}" fill="none" stroke-linecap="round"/>`,
          )
          .join("")}
        <path d="M450 495 C 438 440, 505 412, 472 350 C 447 300, 405 285, 420 215" stroke="#6a4a30" stroke-width="30" fill="none" stroke-linecap="round"/>
        <path d="M420 215 C 430 175, 440 145, 450 112" stroke="#6a4a30" stroke-width="16" fill="none" stroke-linecap="round"/>
        <path d="M444 470 C 436 440, 480 420, 466 380" stroke="#84603f" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
        ${Object.entries(spec)
          .map(([slug, p]) => {
            const f = featureOf(slug);
            return `<g class="br" data-go="${target(f)}">${pad(p.x, p.y, p.sc, p.cols, p.bl)}${label(f, p)}</g>`;
          })
          .join("")}
      </g>
      <ellipse cx="450" cy="500" rx="170" ry="10" fill="#4a6b34" opacity=".25"/>
      <path d="M345 488 h210 l-20 44 h-170 z" fill="#b9663a"/><path d="M345 488 h210 l-3 8 h-204 z" fill="#d07d4d"/><ellipse cx="450" cy="488" rx="105" ry="8" fill="#5b7f3f"/>
      <text x="450" y="521" text-anchor="middle" font-size="15" fill="#f6dcdd" style="font-family:serif;paint-order:normal;stroke:none;letter-spacing:.3em">裏枝</text>
      <g fill="#c59a38" opacity=".8"><path class="leaf-fall" d="M0 0 q6 -8 12 0 q-6 8 -12 0z" style="transform-origin:0 0" transform="translate(300 60)"/><path class="leaf-fall" style="animation-delay:-6s" d="M0 0 q6 -8 12 0 q-6 8 -12 0z" transform="translate(560 40)"/><path class="leaf-fall" style="animation-delay:-10s;fill:#d4838a" d="M0 0 q6 -8 12 0 q-6 8 -12 0z" transform="translate(130 90)"/></g>
    </svg>
    <div class="branch-list">${D.features.map((f) => `<div class="card need" data-go="${target(f)}"><span class="ni" style="${f.state === "awaiting-you" ? "" : "background:var(--moss-l);color:var(--moss-d)"}">${icon(f.kind === "change" ? "wrench" : "leaf", 22)}</span><h3>${f.title}</h3><p>${D.steps[f.step]} · ${f.note}</p></div>`).join("")}</div>`;
  }

  // ---------- shell ----------
  function shell(content, crumbs, extra = "", pad = "") {
    const r = route()[0],
      L = D.limits;
    const dk = (id, ic, label, badge) =>
      `<button class="dkb ${r === id ? "on" : ""}" data-go="${id}" title="${label}">${icon(ic, 20)}<span class="lbl2">${label}</span>${badge ? `<span class="bd">${badge}</span>` : ""}</button>`;
    document.documentElement.dataset.theme = state.theme;
    app.innerHTML = `<div class="app ${pad}">
      <header class="top"><div class="brand" data-go="home">${MARK}<span>uraeda</span><small>裏枝</small></div>
        <div class="crumbs">${crumbs.map((c, i) => (i === crumbs.length - 1 ? `<b>${c}</b>` : `${c}<i>/</i>`)).join(" ")}</div><div class="sp"></div>
        <div class="water" title="${L.provider}: ${L.usedPct}% of the ${L.windowHours} h window"><span class="drop" style="--lvl:${100 - L.usedPct}%"></span><span class="t">${100 - L.usedPct}% left · ${L.resetsIn}</span></div>
        <button class="round-btn only-s" data-go="decisions" title="Decisions">${icon("scale", 18)}</button><button class="round-btn only-s" data-go="settings" title="Settings">${icon("settings", 18)}</button><button class="round-btn" data-act="note" title="Inbox draft">${icon("plus", 18)}</button>
        <button class="round-btn" data-act="theme" title="Day or night garden">${icon(state.theme === "light" ? "eye" : "star", 18)}</button></header>
      ${content}${extra}
      ${state.pop ? popover() : ""}
      <nav class="dock">${dk("home", "tree", "Home")}${dk("inbox", "inbox", "Inbox", nNotes)}${dk("priorities", "list", "Priorities")}
        <button class="dkb new" data-act="new">${icon("plus", 20)}<span class="lbl2">New</span></button>
        <button class="dkb ${state.pop === "run" ? "on" : ""}" data-act="run" title="Running sessions">${icon("pulse", 20)}<span class="lbl2">Sessions</span><span class="bd">${running.length}</span></button>
        <button class="dkb ${state.pop === "wip" ? "on" : ""}" data-act="wip" title="In progress">${icon("branch", 20)}<span class="lbl2">Features</span><span class="bd">${D.features.filter((f) => f.state !== "done").length}</span></button>
        <span class="sepv"></span>${dk("decisions", "scale", "Decisions").replace("dkb ", "dkb hide-s ")}${dk("settings", "settings", "Settings").replace("dkb ", "dkb hide-s ")}</nav></div>`;
  }
  function popover() {
    if (state.pop === "run")
      return `<div class="pop"><h4>Running sessions</h4>${running.map((s) => `<div class="prow" data-go="session/${s.feature}"><span class="live"></span><span class="g"><b>${s.title}</b><small>${s.model} · ${s.elapsed} · ${s.feature}</small></span>${harness(s.harness, 20)}</div>`).join("")}<div class="prow" data-act="new"><span class="g"><b>${icon("plus", 16)} Start another</b></span></div></div>`;
    return `<div class="pop"><h4>Features and changes in progress</h4>${D.features
      .filter((f) => f.state !== "done")
      .map(
        (f) =>
          `<div class="prow" data-go="${target(f)}"><span class="live ${f.state === "awaiting-you" ? "y" : ""}"></span><span class="g"><b>${f.title}</b><small>${f.kind === "change" ? "Change" : "Feature"} · ${D.steps[f.step]} · ${f.note}</small></span></div>`,
      )
      .join("")}</div>`;
  }

  const sessionSheet = () =>
    `<div class="sheet"><div class="grab"></div><div class="sh">${harness("claude", 18)} Discovery · layout and look <span class="pill run">running</span><span style="flex:1"></span><button class="round-btn" data-act="sheet">${icon("chevD", 18)}</button></div><div class="msgs">${B.messages()}</div><div class="composer"><input placeholder="Ask about the question you are on…"><button class="btn pri">Send</button></div></div>`;
  const fab = () =>
    `<button class="btn pri fab" data-act="sheet">${icon("chat", 16)} Ask the agent</button>`;

  const views = {
    home() {
      shell(
        `<div class="wrap"><div class="hello"><p class="eyebrow">Good evening, Alex</p><h1>Your garden is <em>growing well.</em></h1><p class="hint" style="margin:4px 0 0">${need.length} branches are waiting for you · ${running.length} agents at work</p></div>
        <div class="stage">${tree()}</div>
        <div class="needs">${need.map((f) => `<div class="card need" data-go="${target(f)}"><span class="ni">${icon(f.step === 2 ? "help" : "file", 22)}</span><h3>${f.title}</h3><p>${f.note}</p></div>`).join("")}</div>
        <div class="tiles"><div class="card tile" data-go="inbox">${icon("inbox", 26)}<div><b>${nNotes}</b><span>notes to sort</span></div></div><div class="card tile" data-go="priorities">${icon("list", 26)}<div><b>${D.priorities[1].items.length}</b><span>priorities now</span></div></div><div class="card tile" data-act="run">${icon("pulse", 26)}<div><b>${running.length}</b><span>agents running</span></div></div><div class="card tile" data-go="decisions">${icon("scale", 26)}<div><b>${D.decisions.length}</b><span>decisions</span></div></div></div></div>`,
        ["Home"],
      );
    },

    inbox() {
      let n = -1;
      shell(
        `<div class="wrap"><div class="rhead"><h1>Inbox</h1><span class="eyebrow">${nNotes} notes, freshly fallen</span></div><div class="vine"></div>
        ${D.inbox
          .map(
            (c) =>
              `<section class="tray"><h2>${icon("leaf", 22)} ${c.cat} <small>${c.notes.length ? c.notes.length + " notes" : "empty"}</small></h2>${
                c.notes.length
                  ? `<div class="slips">${c.notes
                      .map((t) => {
                        n++;
                        return `<article class="card slip ${n === state.sel ? "sel" : ""}" data-sel="${n}"><span class="grip">${icon("drag", 18)}</span>${esc(t)}${n === state.sel ? `<div class="acts"><button class="btn pri" data-act="new">${icon("spark", 14)} Open a session</button><button class="btn">To priorities</button><button class="btn">Move…</button><button class="btn">Delete</button></div>` : ""}</article>`;
                      })
                      .join("")}</div>`
                  : `<div class="empty">Nothing here. Drag a note in, or add a category.</div>`
              }</section>`,
          )
          .join("")}
        <button class="btn">${icon("plus", 14)} New category</button></div>`,
        ["Inbox"],
      );
    },

    priorities() {
      let rank = 0;
      shell(
        `<div class="wrap wide"><div class="rhead"><h1>Priorities</h1><span class="eyebrow">what to tend first</span></div><div class="vine"></div>
        <div class="panes">${D.priorities
          .map(
            (g, gi) =>
              `<section class="pane p${gi}"><h2>${g.group} <small>${g.items.length}</small></h2><div class="vine2"></div>${g.items
                .map((it) => {
                  rank++;
                  return `<article class="card pi" ${it.slug ? `data-go="${target(featureOf(it.slug))}"` : ""}><span class="ring-n">${rank}</span><div><div class="t">${esc(it.t)}</div>${it.sub ? `<ul>${it.sub.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<div class="m">${it.draft ? '<span class="pill chg">draft: opens the editor</span>' : ""}${it.s ? `<span class="pill ${/you|approve|waiting/.test(it.s) ? "you" : "run"}">${it.s}</span>` : ""}</div></div></article>`;
                })
                .join("")}</section>`,
          )
          .join("")}</div></div>`,
        ["Priorities"],
      );
    },

    feature(slug) {
      const f = featureOf(slug || "merge-chats") || D.features[1],
        ss = D.sessions.filter((s) => s.feature === f.slug);
      shell(
        `<div class="wrap"><p class="eyebrow">${f.kind === "change" ? "A change" : "A feature"} · branch ${f.slug}</p><div class="rhead"><h1>${f.title}</h1></div>
        <div class="growth">${D.steps.map((s, i) => `<div class="gs ${i < f.step ? "done" : i === f.step ? "cur" : ""}"><div class="gn">${icon(i < f.step ? "leaf" : i === f.step ? "spark" : "clock", 24)}</div>${s}</div>`).join("")}</div>
        <p class="hint" style="text-align:center">Now: <b>${D.steps[f.step]}</b> · ${f.note}</p>
        <div class="stones"><div class="stone"><b>${f.diff}</b><span>lines changed</span></div><div class="stone"><b>${f.tokens}</b><span>tokens</span></div><div class="stone"><b>${f.sessions}</b><span>sessions</span></div><div class="stone"><b>${f.age}</b><span>last tended</span></div></div>
        <div class="two"><section class="card" style="padding:8px 0"><h3 style="padding:12px 18px 4px">Sessions</h3>${ss.length ? ss.map((s) => `<div class="scroll-row" data-go="session/${f.slug}">${harness(s.harness, 22)}<div class="g"><b>${s.title}</b><small>${s.model} · ${s.elapsed}</small></div><span class="pill run">${s.state}</span></div>`).join("") : '<p class="empty" style="margin:12px">No session yet.</p>'}<div style="padding:12px 18px"><button class="btn pri" data-act="new">${icon("plus", 14)} New session</button></div></section>
        <section class="card" style="padding:8px 0"><h3 style="padding:12px 18px 4px">Files</h3>${["proposal.md", "discovery-01.md", "clarifications-01.md", "spec.md", "plan.md"].map((x, i) => `<div class="scroll-row">${icon("scroll", 18)}<div class="g"><b>${x}</b></div><span class="hint">${i < f.step ? "written" : "to come"}</span></div>`).join("")}</section></div></div>`,
        ["Features", f.slug],
      );
    },

    clar() {
      const c = D.clarifications;
      shell(
        `<div class="wrap narrow read"><div class="rhead"><h1>Questions on recurring tasks</h1></div>
        <div class="progress-line"><div class="pdots">${[1, 0, 0, 0, 0, 0, 0].map((x) => `<i class="${x ? "on" : ""}"></i>`).join("")}</div>1 of 7 answered · about 30 minutes left</div>
        ${B.clarifications()}</div>${fab()}`,
        ["Features", "layout-look", "Questions"],
        state.sheet ? sessionSheet() : "",
        state.sheet ? "with-sheet" : "",
      );
      if (state.sheet) document.querySelector(".wrap").style.paddingBottom = "56vh";
    },

    spec() {
      shell(
        `<div class="wrap narrow"><div class="rhead"><h1>Recurring tasks</h1><span class="pill run">spec · approved</span></div><div class="vine"></div><div class="spec read">${B.spec()}</div></div>${fab()}`,
        ["Features", "recurring-tasks", "Spec"],
        state.sheet ? sessionSheet() : "",
      );
      if (state.sheet) document.querySelector(".wrap").style.paddingBottom = "56vh";
    },

    session() {
      shell(
        `<div class="wrap narrow"><p class="eyebrow">${harness("claude", 14)} ${D.session.model} · running 47 min</p><div class="rhead"><h1>${D.session.title}</h1></div><div class="vine"></div>${B.messages()}<div class="card side-note"><h4>Sources</h4>${D.session.side.sources.map((x) => `<div class="r">${icon("search", 14)} ${x}</div>`).join("")}<h4>Files changed</h4>${D.session.side.files.map((x) => `<div class="r">${icon("file", 14)} ${x}</div>`).join("")}<h4>Sub-sessions</h4>${D.session.side.subs.map((x) => `<div class="r">${icon("robot", 14)} ${x}</div>`).join("")}</div>
        <div class="composer"><input placeholder="Message the agent…"><button class="btn pri">Send</button></div></div>`,
        ["Sessions", D.session.title],
      );
    },

    new() {
      const art = {
        seed: `<svg class="art" viewBox="0 0 150 130"><ellipse cx="75" cy="112" rx="60" ry="9" fill="#6a4a30" opacity=".25"/><path d="M20 108 q55 -20 110 0" fill="#8b6444"/><ellipse cx="75" cy="92" rx="11" ry="15" fill="#c59a38" transform="rotate(-18 75 92)"/><path d="M75 80 q-3 -12 4 -20" stroke="#5b7f3f" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
        sprout: `<svg class="art" viewBox="0 0 150 130"><ellipse cx="75" cy="112" rx="60" ry="9" fill="#6a4a30" opacity=".25"/><path d="M20 108 q55 -20 110 0" fill="#8b6444"/><path d="M75 100 V60" stroke="#5b7f3f" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M75 68 q-30 -4 -38 -28 q30 -2 38 28z" fill="#6f9650"/><path d="M75 60 q28 -2 36 -26 q-28 -2 -36 26z" fill="#5b7f3f"/></svg>`,
        tree: `<svg class="art" viewBox="0 0 150 130"><ellipse cx="75" cy="118" rx="52" ry="7" fill="#6a4a30" opacity=".25"/><path d="M75 108 C72 92, 86 86, 80 70 C76 60, 66 58, 70 44" stroke="#6a4a30" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M80 78 C95 76, 106 66, 112 56" stroke="#6a4a30" stroke-width="4" fill="none"/><ellipse cx="55" cy="38" rx="30" ry="15" fill="#5b7f3f"/><ellipse cx="88" cy="30" rx="28" ry="14" fill="#6f9650"/><ellipse cx="112" cy="50" rx="20" ry="11" fill="#4a6b34"/><path d="M48 108 h54 l-6 14 h-42z" fill="#b9663a"/></svg>`,
      };
      shell(
        `<div class="wrap"><div class="rhead"><h1>Plant something new</h1></div><p class="eyebrow">Pick how big it should grow. A session can become a change, and a change a feature, later.</p>
        <div class="stages">
          <button class="card stg s1" data-go="session/new">${art.seed}<h3>Session</h3><p>Just talk to an agent. Nothing is added to specs/.</p><span class="steps">no branch · no files</span></button>
          <button class="card stg s2" data-go="session/new">${art.sprout}<h3>Change</h3><p>A fix or a small change, with its own branch and pull request.</p><span class="steps">proposal → fix → pull request</span></button>
          <button class="card stg s3" data-go="session/new">${art.tree}<h3>Feature</h3><p>A full proposal: questions, a spec you approve, a plan, then code.</p><span class="steps">proposal → questions → spec → plan → code</span></button></div>
        <p class="hint" style="text-align:center">Change and feature then ask: pick a priority, an inbox note, or a proposal, or write the text right here.</p></div>`,
        ["New"],
      );
    },

    decisions() {
      shell(
        `<div class="wrap narrow"><div class="rhead"><h1>Constitution</h1><span class="eyebrow">six principles, by priority</span></div><div class="vine"></div>
        ${D.constitution.map((p) => `<article class="card pr"><span class="pn">${p.n}</span><div><h3>${p.t}</h3><ul>${p.rules.map((r) => `<li>${esc(r).replace(/\b(MUST NOT|MUST|SHOULD|MAY)\b/g, "<b>$1</b>")}</li>`).join("")}</ul><p class="rationale">${esc(p.why)}</p></div></article>`).join("")}
        <div class="rhead" style="margin-top:44px"><h1>Decisions</h1></div><div class="vine"></div><input class="txt" placeholder="Search decisions…" style="margin-bottom:16px"><div class="pebbles">${D.decisions.map((d) => `<div class="pebble"><b>${d.name}</b><small>${d.status} · ${d.rules} rules</small></div>`).join("")}</div></div>`,
        ["Decisions"],
      );
    },

    settings() {
      shell(
        `<div class="wrap narrow"><div class="rhead"><h1>Settings</h1></div><div class="vine"></div><div class="card" style="padding:8px 24px">${[
          ["Harness", "Claude Code"],
          ["Model", "Opus 5.5"],
          ["Notifications", "off"],
          ["Access key", "••••••••••"],
          ["Repositories", "1"],
        ]
          .map(([a, b]) => `<div class="set"><b>${a}</b><span>${b}</span></div>`)
          .join("")}</div></div>`,
        ["Settings"],
      );
    },
  };

  function render() {
    const [v, a] = route();
    (views[v] || views.home)(a);
  }
  addEventListener("hashchange", () => {
    state.sel = 0;
    state.sheet = false;
    state.pop = null;
    window.scrollTo(0, 0);
    render();
  });
  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go],[data-act],[data-sel]");
    if (!t) {
      if (state.pop) {
        state.pop = null;
        render();
      }
      return;
    }
    const a = t.dataset.act,
      y = scrollY;
    if (a === "new") go("new");
    else if (a === "note") go("inbox");
    else if (a === "theme") {
      state.theme = state.theme === "light" ? "dark" : "light";
      render();
      scrollTo(0, y);
    } else if (a === "run" || a === "wip") {
      state.pop = state.pop === a ? null : a;
      render();
      scrollTo(0, y);
    } else if (a === "sheet") {
      state.sheet = !state.sheet;
      render();
      scrollTo(0, y);
    } else if (t.dataset.sel) {
      state.sel = +t.dataset.sel;
      render();
      scrollTo(0, y);
    } else if (t.dataset.go) go(t.dataset.go);
  });
  render();
})();
