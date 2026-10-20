// Direction T, "tty": every view of the information architecture, drawn as a terminal UI.
(function () {
  const D = window.URA,
    B = window.BLOCKS,
    app = document.getElementById("app");
  const state = { split: false, picker: false, which: false, sel: 0 };
  const featureOf = (slug) => D.features.find((f) => f.slug === slug);
  const youCount = D.features.filter((f) => f.state === "awaiting-you").length;
  const running = D.sessions.filter((s) => s.state === "running");

  const route = () => (location.hash.replace(/^#\//, "") || "home").split("/");
  const go = (p) => {
    location.hash = "#/" + p;
  };

  // ---------- pixel bonsai (the logo), drawn on a canvas so it stays crisp ----------
  const BONSAI = [
    "..............................",
    "........gggg......GGGG........",
    "......ggGGGGgg..ggGGGGgg......",
    "....ggGGGGGGGGggGGGGGGGGgg....",
    "...gGGGGGggGGGGGGGGggGGGGGg...",
    "....gGGGGGGGGgggGGGGGGGGGg....",
    ".....ggGGGGggtgggGGGGgggg.....",
    ".......gggg.ttt..gggg.........",
    "...........ttt.......ggg......",
    "....ggg....ttt....gGGGGGgg....",
    "...gGGGGg..ttt..ggGGGGGGGg....",
    "..gGGGGGGgg.tt.gGGGGGGggg.....",
    "...gggGGGGggttggGGGgggg.......",
    ".....gggggg.ttt.gggg..........",
    "...........tttt...............",
    "..........ttttt...............",
    ".....pppppppppppppppppp.......",
    ".....pPPPPPPPPPPPPPPPPp.......",
    "......ppppppppppppppp.........",
    ".......pp.........pp..........",
  ];
  const PAL = { g: "#40a02b", G: "#a6e3a1", t: "#b07a4f", p: "#e78a4e", P: "#fab387" };
  function drawBonsai(c) {
    const s = 8,
      x = c.getContext("2d");
    c.width = BONSAI[0].length * s;
    c.height = BONSAI.length * s;
    BONSAI.forEach((row, y) =>
      [...row].forEach((ch, i) => {
        if (PAL[ch]) {
          x.fillStyle = PAL[ch];
          x.fillRect(i * s, y * s, s, s);
        }
      }),
    );
  }

  // ---------- shell ----------
  const TABS = () => {
    const r = route()[0],
      slug = route()[1];
    const t = [
      ["home", "Home", "home", "h"],
      ["inbox", "Inbox", "inbox", "i"],
      ["priorities", "Priorities", "list", "p"],
    ];
    const base = t
      .map(
        ([id, label, ic, k]) =>
          `<button class="tab ${r === id ? "on" : ""}" data-go="${id}">${icon(ic, 14)} ${label}${id === "inbox" ? ` <span class="pill">${D.inbox.reduce((n, c) => n + c.notes.length, 0)}</span>` : ""}</button>`,
      )
      .join("");
    const feats = D.features
      .filter((f) => f.state !== "done")
      .map((f) => {
        const live = D.sessions.some((s) => s.feature === f.slug && s.state === "running");
        const dot = f.state === "awaiting-you" ? "you" : live ? "" : "wait";
        const on =
          (r === "feature" || r === "clar" || r === "spec" || r === "session") &&
          (slug || "layout-look") === f.slug;
        return `<button class="tab ${on ? "on" : ""}" data-go="feature/${f.slug}"><span class="dot ${dot}"></span>${f.kind === "change" ? icon("wrench", 13) : icon("branch", 13)} ${f.slug}</button>`;
      })
      .join("");
    return base + feats;
  };

  function shell(content, { mode = "NORMAL", crumbs = ["home"], modeCls = "" } = {}) {
    const L = D.limits,
      filled = Math.round(L.usedPct / 10);
    app.innerHTML = `
      <div class="tabline">
        <div class="tabs">${TABS()}</div>
        <button class="ico-btn" data-act="note" title="Inbox draft (i)">${icon("plus", 14)} note</button>
        <button class="ico-btn" data-act="new" title="New session or change/feature (n)">${icon("spark", 14)} new</button>
        <div class="limit" title="${L.provider}: ${L.usedPct}% of the ${L.windowHours} h window, resets in ${L.resetsIn}">${harness("claude", 14)}<span class="bar">${"█".repeat(filled)}<i>${"░".repeat(10 - filled)}</i></span><span class="txt">${L.usedPct}% · ${L.resetsIn}</span></div>
        <button class="ico-btn" data-go="settings" title="Settings">${icon("settings", 14)}</button>
      </div>
      <main>${content}${state.picker ? picker() : ""}${state.which ? which() : ""}</main>
      <div class="statusline">
        <div class="mode ${modeCls}">${mode}</div>
        <div class="sl" >${icon("branch", 13)} ${D.project.branch}</div>
        <div class="sl-mid">${crumbs.map((c) => `<span class="crumb">${c}</span>`).join("")}</div>
        ${youCount ? `<div class="sl-r sl-warn">${icon("alert", 13)} ${youCount} need you</div>` : ""}
        <div class="sl-r hide-s">${icon("pulse", 13)} ${running.length} running</div>
        <div class="sl-r sl-time hide-s">${icon("clock", 13)} 23:41</div>
      </div>`;
    const c = app.querySelector("canvas");
    if (c) drawBonsai(c);
    const sel = app.querySelector(".sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  const stPill = (f) =>
    f.state === "awaiting-you"
      ? `<span class="pill you">you</span>`
      : f.state === "done"
        ? `<span class="pill done">done</span>`
        : `<span class="pill run">${f.state}</span>`;
  const kindPill = (f) => (f.kind === "change" ? `<span class="pill chg">change</span>` : "");

  // ---------- views ----------
  const views = {
    home() {
      const need = D.features.filter((f) => f.state === "awaiting-you");
      const wip = D.features.filter((f) => f.state === "building");
      shell(
        `<div class="home"><div class="home-in">
        <div class="logo"><canvas></canvas><div class="wordmark">URAEDA</div><div class="tag">git-driven, asynchronous development</div></div>
        <div class="sec"><h2>${icon("alert", 15)} Needs you</h2>
          ${need.map((f, i) => `<div class="row" data-go="${f.slug === "layout-look" ? "clar/" + f.slug : "feature/" + f.slug}">${icon(f.step <= 2 ? "help" : "file", 15)}<span class="lbl">${f.title}</span><span class="sub">${f.note}</span><span class="key">${i + 1}</span></div>`).join("")}</div>
        <div class="sec"><h2>${icon("terminal", 15)} Keymaps</h2>
          ${[
            ["spark", "New session or change/feature", "n"],
            ["inbox", "Inbox draft", "i"],
            ["list", "Priorities", "p"],
            ["scale", "Decisions and constitution", "d"],
            ["search", "Find anything", "/"],
            ["settings", "Settings", "s"],
          ]
            .map(
              ([ic, l, k]) =>
                `<div class="row" data-key="${k}">${icon(ic, 15)}<span class="lbl">${l}</span><span class="key">${k}</span></div>`,
            )
            .join("")}</div>
        <div class="sec"><h2>${icon("pulse", 15)} Running sessions</h2>
          ${running.map((s, i) => `<div class="row" data-go="session/${s.feature}">${harness(s.harness, 15)}<span class="lbl">${s.title}</span><span class="sub">${s.elapsed}</span><span class="key">${i + 5}</span></div>`).join("")}</div>
        <div class="sec"><h2>${icon("branch", 15)} In progress</h2>
          ${wip.map((f) => `<div class="row" data-go="feature/${f.slug}">${icon(f.kind === "change" ? "wrench" : "branch", 15)}<span class="lbl">${f.title}</span><span class="sub">${f.note}</span></div>`).join("")}</div>
        <div class="footnote">⚠ Uraeda loaded <span>5 features</span> in <span>54.62ms</span> · the 5 h window resets in ${D.limits.resetsIn}</div>
      </div></div>`,
        { crumbs: ["home"] },
      );
    },

    inbox() {
      let n = 0;
      const sel = state.sel;
      shell(
        `<div class="pane focus grow"><div class="title">${icon("inbox", 14)} Inbox <span class="kb">${D.inbox.reduce((a, c) => a + c.notes.length, 0)} notes</span></div>
        <div class="body buf">${D.inbox
          .map(
            (c) =>
              `<h3>## ${c.cat}<span class="cnt">${c.notes.length}</span></h3>${
                c.notes.length
                  ? c.notes
                      .map((t) => {
                        n++;
                        return `<div class="ln ${n - 1 === sel ? "sel" : ""}" data-sel="${n - 1}"><span class="n">${n}</span><span class="bul">●</span><span class="txt">${esc(t)}</span><span class="st">⏎ session</span></div>`;
                      })
                      .join("")
                  : `<div class="ln"><span class="n"></span><span class="bul">○</span><span class="txt hint">empty</span><span></span></div>`
              }`,
          )
          .join("")}</div>
        <div class="foot"><span><kbd>j/k</kbd> move</span><span><kbd>J/K</kbd> reorder</span><span><kbd>m</kbd> move to category</span><span><kbd>c</kbd> new category</span><span><kbd>dd</kbd> delete</span><span><kbd>⏎</kbd> open session with this note</span><span><kbd>P</kbd> promote to priorities</span></div></div>
        <div class="pane side-r"><div class="title">Note</div><div class="body prose"><p style="margin-top:0">${esc(D.inbox[0].notes[sel] || D.inbox[0].notes[0])}</p>
          <p class="hint">Opening a session starts it with this text in the composer. Pick change, feature, or neither, like on the New page.</p>
          <p><button class="btn pri" data-act="new">${icon("spark", 14)} Open session</button> <button class="btn">${icon("flag", 14)} Priority</button></p></div></div>`,
        { crumbs: ["inbox"] },
      );
    },

    priorities() {
      let n = 0;
      const cls = ["ongoing", "now", "next", "later"];
      shell(
        `<div class="pane focus grow"><div class="title">${icon("list", 14)} PRIORITIES.md</div>
        <div class="body buf"><div class="twocol">${D.priorities
          .map(
            (g, gi) =>
              `<div class="grp-${cls[gi]}"><h3>## ${g.group}<span class="cnt">${g.items.length}</span></h3>${g.items
                .map((it) => {
                  n++;
                  return `<div class="ln ${it.draft ? "draft" : ""} ${n - 1 === state.sel ? "sel" : ""}" data-sel="${n - 1}" ${it.slug ? `data-go="feature/${it.slug}"` : ""}><span class="n">${n}</span><span class="bul">●</span><span class="txt">${esc(it.t)}</span><span class="st">${it.s}</span></div>${(it.sub || []).map((s) => `<div class="ln sub"><span class="n"></span><span class="bul">○</span><span class="txt">${esc(s)}</span><span></span></div>`).join("")}`;
                })
                .join("")}</div>`,
          )
          .join("")}</div></div>
        <div class="foot"><span><kbd>h/l</kbd> group</span><span><kbd>j/k</kbd> move</span><span><kbd>J/K</kbd> reorder inside a group</span><span><kbd>H/L</kbd> change group</span><span><kbd>⏎</kbd> open · drafts open the full editor</span></div></div>`,
        { crumbs: ["priorities"] },
      );
    },

    feature(slug) {
      slug = slug || "merge-chats";
      const f = featureOf(slug) || D.features[1];
      const ss = D.sessions.filter((s) => s.feature === f.slug);
      shell(
        `<div class="pane side"><div class="title">${icon("branch", 14)} Steps</div><div class="body"><ol class="timeline">${D.steps.map((s, i) => `<li class="${i < f.step ? "done" : i === f.step ? "cur" : ""}"><span class="node">${i < f.step ? "●" : i === f.step ? "◉" : "○"}</span><span>${s}</span><span class="hint">${i === f.step ? f.state : ""}</span></li>`).join("")}</ol>
          <p class="hint" style="margin-top:14px">${f.step === 2 ? `<a href="#/clar/${f.slug}">open the questions →</a>` : f.step === 3 ? `<a href="#/spec/${f.slug}">open the spec →</a>` : ""}</p></div></div>
        <div class="pane focus grow"><div class="title">${f.title} ${stPill(f)} ${kindPill(f)}</div><div class="body">
          <div class="stats"><div class="stat"><b>${f.diff}</b><span>diff</span></div><div class="stat"><b>${f.tokens}</b><span>tokens</span></div><div class="stat"><b>${f.sessions}</b><span>sessions</span></div><div class="stat"><b>${f.age}</b><span>last activity</span></div></div>
          <h3 style="color:var(--blue)">## Tokens by step</h3><div class="graph">${[
            ["Discovery", 22],
            ["Spec", 18],
            ["Plan", 12],
            ["Build", 78],
          ]
            .map(
              ([a, p]) =>
                `<div class="bar-row"><span>${a}</span><i><b style="width:${p}%"></b></i><span>${p}%</span></div>`,
            )
            .join("")}</div>
          <h3 style="color:var(--blue)">## Files</h3>
          ${["proposal.md", "discovery-01.md", "clarifications-01.md", "spec.md", "plan.md", "data-model.md"].map((x, i) => `<div class="row" style="padding-left:6px"><span class="ico">${icon("file", 14)}</span><span class="lbl">${x}</span><span class="sub">${i < f.step ? "committed" : "—"}</span></div>`).join("")}</div></div>
        <div class="pane side-r"><div class="title">${icon("pulse", 14)} Sessions</div><div class="body">${ss.length ? ss.map((s) => `<div class="row" style="padding-left:6px" data-go="session/${f.slug}">${harness(s.harness, 14)}<span class="lbl">${s.title}</span><span class="sub">${s.state}</span></div>`).join("") : '<p class="hint">No session yet.</p>'}<p><button class="btn pri" data-act="new">${icon("plus", 14)} new session</button></p></div></div>`,
        { crumbs: ["features", f.slug] },
      );
    },

    clar(slug) {
      const c = D.clarifications;
      shell(
        `<div class="col grow" style="min-width:0;flex:1"><div style="display:flex;flex:1;min-height:0">
        <div class="pane side"><div class="title">${icon("list", 14)} Outline</div><div class="body outline">
          <div class="o on"><span class="m">▸</span>Block</div><div class="o"><span class="m"> </span>Context</div>
          ${c.questions.map((q) => `<div class="o ${q.answered ? "ok" : ""}" data-q="q${q.n}"><span class="m">${q.answered ? "✓" : "○"}</span>Q${q.n} ${q.title.slice(0, 22)}…</div>`).join("")}
          <div class="o"><span class="m">○</span>+${c.more.length} more</div><div class="o"><span class="m"> </span>Settled</div>
          <p class="hint" style="margin-top:14px">1 of 7 answered<br>about 30 min left</p></div></div>
        <div class="pane focus grow"><div class="title">${icon("help", 14)} clarifications-01.md <span class="kb">s: session</span></div><div class="body" id="clar-body">${B.clarifications()}</div>
          <div class="foot"><span><kbd>a-c</kbd> pick option</span><span><kbd>j/k</kbd> question</span><span><kbd>s</kbd> ask the agent</span><span><kbd>⌃⏎</kbd> submit round</span></div></div></div>
        ${state.split ? `<div class="split"><div class="pane focus"><div class="title">${harness("claude", 14)} session · discovery <span class="kb">s: close</span></div><div class="chat"><div class="msgs">${B.messages()}</div><div class="composer"><input placeholder="Ask the agent about Q2…"><button class="btn pri">send</button></div></div></div></div>` : ""}</div>`,
        {
          mode: state.split ? "INSERT" : "NORMAL",
          modeCls: state.split ? "insert" : "you",
          crumbs: ["features", "layout-look", "clarifications-01.md"],
        },
      );
    },

    spec() {
      shell(
        `<div class="pane side"><div class="title">Outline</div><div class="body outline">${["Decisions", "User stories", "US1 Make a task repeat", "US2 Complete one", "Edge cases", "Data model", "History"].map((x, i) => `<div class="o ${i === 0 ? "on" : ""} ${i === 2 || i === 3 ? "ind" : ""}"><span class="m">${i === 0 ? "▸" : " "}</span>${x}</div>`).join("")}</div></div>
        <div class="pane focus grow"><div class="title">${icon("file", 14)} spec.md <span class="pill run">approved</span> <span class="kb">s: session · c: comment</span></div><div class="body spec">${B.spec()}</div>
          <div class="foot"><span><kbd>c</kbd> comment on paragraph</span><span><kbd>]d</kbd> next decision</span><span><kbd>⌃⏎</kbd> approve</span></div></div>
        <div class="pane side-r"><div class="title">Comments</div><div class="body"><p class="hint">Select a paragraph and press <kbd>c</kbd>.</p></div></div>`,
        { crumbs: ["features", "recurring-tasks", "spec.md"] },
      );
    },

    session(slug) {
      shell(
        `<div class="pane focus grow"><div class="title">${harness("claude", 14)} ${D.session.title} <span class="pill run">running</span></div><div class="chat"><div class="msgs">${B.messages()}</div><div class="composer"><input placeholder="Message the agent…"><button class="btn pri">send</button></div></div></div>
        <div class="pane side-r"><div class="title">Details</div><div class="body"><h3 style="color:var(--blue);margin-top:0">## Sources</h3>${D.session.side.sources.map((x) => `<div class="row" style="padding-left:0">${icon("search", 13)}<span class="lbl">${x}</span></div>`).join("")}<h3 style="color:var(--blue)">## Files changed</h3>${D.session.side.files.map((x) => `<div class="row" style="padding-left:0">${icon("file", 13)}<span class="lbl">${x}</span></div>`).join("")}<h3 style="color:var(--blue)">## Sub-sessions</h3>${D.session.side.subs.map((x) => `<div class="row" style="padding-left:0">${icon("robot", 13)}<span class="lbl">${x}</span></div>`).join("")}</div></div>`,
        { mode: "INSERT", modeCls: "insert", crumbs: ["sessions", D.session.title] },
      );
    },

    decisions() {
      shell(
        `<div class="pane focus grow"><div class="title">${icon("book", 14)} Constitution</div><div class="body">${B.constitution()}</div></div>
        <div class="pane" style="width:min(420px,40%);flex:none"><div class="title">${icon("scale", 14)} Decisions <span class="kb">/ filter</span></div><div class="body"><div class="filter"><input placeholder="filter decisions…"></div><div class="dgrid">${D.decisions.map((d) => `<div class="dcard">${icon("scale", 14)} <b>${d.name}</b><span class="hint">${d.status} · ${d.rules} rules</span></div>`).join("")}</div></div></div>`,
        { crumbs: ["decisions"] },
      );
    },

    settings() {
      shell(
        `<div class="pane focus grow"><div class="title">${icon("settings", 14)} Settings</div><div class="body"><div class="settings-form">${[
          ["Harness", "Claude Code"],
          ["Model", "Opus 5.5"],
          ["Notifications", "off"],
          ["Access key", "••••••••••"],
          ["Repositories", "1"],
          ["Theme", "terminal (this direction)"],
        ]
          .map(([a, b]) => `<div class="set"><b>${a}</b><span>${b}</span></div>`)
          .join("")}</div></div></div>`,
        { crumbs: ["settings"] },
      );
    },

    new() {
      state.picker = true;
      views.home();
    },
  };

  function picker() {
    const o = [
      ["file", "A session", "Talk to an agent. Nothing is tracked in specs/.", "s"],
      ["wrench", "A change", "A fix or a small change: its own branch and pull request.", "c"],
      ["branch", "A feature", "A proposal, questions, a spec, a plan, then code.", "f"],
    ];
    return `<div class="overlay" data-act="close"><div class="picker" onclick="event.stopPropagation()">
      <div class="pane focus col"><div class="title">New <span class="kb">⏎ select</span></div><input class="q" placeholder="> what do you want to do?" autofocus>
        ${o.map(([ic, t, d, k], i) => `<div class="pick ${i === 0 ? "sel" : ""}">${icon(ic, 16)}<span><b>${t}</b><span class="d">${d}</span></span><span class="k">${k}</span></div>`).join("")}<div class="foot" style="margin-top:auto"><span>then: pick from priorities, inbox, or proposals · or write directly</span></div></div>
      <div class="pane col"><div class="title">Preview</div><div class="body prose"><p style="margin-top:0"><b>A change</b> starts from a proposal line, a priority, or an inbox note, or from text you write now.</p><p class="hint">Preview of the next step: the picker of lines, then the session, tailing live.</p></div></div></div></div>`;
  }
  function which() {
    return `<div class="which">${[
      ["n", "new"],
      ["i", "inbox"],
      ["p", "priorities"],
      ["d", "decisions"],
      ["s", "session"],
      ["h", "home"],
      ["/", "find"],
      [",", "settings"],
      ["?", "keys"],
    ]
      .map(([k, l]) => `<div><kbd>${k}</kbd> <span>${l}</span></div>`)
      .join("")}</div>`;
  }

  // ---------- events ----------
  function render() {
    const [v, a] = route();
    (views[v] || views.home)(a);
  }
  addEventListener("hashchange", () => {
    state.sel = 0;
    state.picker = false;
    render();
  });
  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go],[data-act],[data-sel],[data-key],[data-q]");
    if (!t) return;
    if (t.dataset.act === "new") {
      state.picker = true;
      render();
    } else if (t.dataset.act === "close") {
      state.picker = false;
      render();
    } else if (t.dataset.act === "note") {
      go("inbox");
    } else if (t.dataset.key) {
      press(t.dataset.key);
    } else if (t.dataset.q) {
      document.getElementById(t.dataset.q).scrollIntoView({ behavior: "smooth" });
    } else if (t.dataset.go) {
      go(t.dataset.go);
    } else if (t.dataset.sel) {
      state.sel = +t.dataset.sel;
      render();
    }
  });
  function press(k) {
    const map = {
      h: "home",
      i: "inbox",
      p: "priorities",
      d: "decisions",
      s: "settings",
      ",": "settings",
    };
    if (k === "n") {
      state.picker = true;
      render();
    } else if (k === "s" && route()[0] === "clar") {
      state.split = !state.split;
      render();
    } else if (map[k]) go(map[k]);
    else if (k === "?") {
      state.which = !state.which;
      render();
    } else if (k === "Escape") {
      state.picker = state.which = false;
      render();
    } else if (k === "j") {
      state.sel++;
      render();
    } else if (k === "k") {
      state.sel = Math.max(0, state.sel - 1);
      render();
    } else if (/^[1-4]$/.test(k) && route()[0] === "home") {
      const need = D.features.filter((f) => f.state === "awaiting-you")[+k - 1];
      if (need) go(need.slug === "layout-look" ? "clar/" + need.slug : "feature/" + need.slug);
    }
  }
  addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.key !== "Escape") return;
    if (e.metaKey || e.ctrlKey) return;
    press(e.key);
  });
  render();
})();
