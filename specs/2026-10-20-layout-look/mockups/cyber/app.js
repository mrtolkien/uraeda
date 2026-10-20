// Direction C, "cyber": every view of the information architecture, drawn as a HUD.
(function () {
  const D = window.URA,
    B = window.BLOCKS,
    app = document.getElementById("app");
  const state = { comm: false, cat: 0, sel: 0 };
  const featureOf = (s) => D.features.find((f) => f.slug === s);
  const running = D.sessions.filter((s) => s.state === "running");
  const need = D.features.filter((f) => f.state === "awaiting-you");
  const route = () => (location.hash.replace(/^#\//, "") || "home").split("/");
  const go = (p) => {
    location.hash = "#/" + p;
  };
  const nNotes = D.inbox.reduce((n, c) => n + c.notes.length, 0);

  const panel = (title, body, { cls = "", tag = "", corners = false, style = "" } = {}) =>
    `<section class="panel ${cls}" style="${style}">${corners ? '<i class="corner tl"></i><i class="corner br"></i>' : ""}<div class="ph">${title}${tag ? `<span class="tagr">${tag}</span>` : ""}</div><div class="pb">${body}</div></section>`;

  function shell(content, crumbs, extra = "") {
    const r = route()[0],
      L = D.limits,
      C = 2 * Math.PI * 16;
    const rb = (id, ic, label, badge) =>
      `<button class="rbtn ${r === id ? "on" : ""}" data-go="${id}" title="${label}">${icon(ic, 22)}${badge ? `<span class="bdg">${badge}</span>` : ""}</button>`;
    app.innerHTML = `<div class="stage" id="stage">
      <div class="layer l-hex"></div><div class="layer l-grid"></div><div class="layer l-glow"></div>
      <header class="top">
        <div class="brand" data-go="home"><span class="glitch" data-t="URAEDA">URAEDA</span><small>v1.0 / MAGI</small></div>
        <div class="crumbs">${crumbs.map((c, i) => (i === crumbs.length - 1 ? `<b>${c}</b>` : c)).join(" / ")}</div>
        <button class="cta" data-act="note">${icon("plus", 15)}<span class="t">Note</span></button>
        <button class="cta pri" data-act="new">${icon("spark", 15)}<span class="t">New</span></button>
        <div class="ring" title="${L.provider}: ${L.usedPct}% of the ${L.windowHours} h window"><svg viewBox="0 0 38 38"><circle cx="19" cy="19" r="16" fill="none" stroke="var(--line2)" stroke-width="3"/><circle cx="19" cy="19" r="16" fill="none" stroke="var(--warn)" stroke-width="3" stroke-dasharray="${(C * L.usedPct) / 100} ${C}"/></svg><b>${L.usedPct}</b></div>
        <div class="ringtxt"><b>${L.windowHours} H WINDOW</b>reset ${L.resetsIn}</div>
      </header>
      <nav class="rail">${rb("home", "home", "Home")}${rb("inbox", "inbox", "Inbox", nNotes)}${rb("priorities", "list", "Priorities")}${rb("decisions", "scale", "Decisions and constitution")}<div class="sp"></div><div class="rule"></div>${rb("settings", "settings", "Settings")}</nav>
      <div class="main" id="main">${content}</div>
      <footer class="dock"><span class="dl">RUNNING</span>${running.map((s) => `<button class="chip" data-go="session/${s.feature}"><i></i>${harness(s.harness, 13)} ${s.title}<em>${s.elapsed}</em></button>`).join("")}<span class="chip sep">│</span><span class="dl">IN PROGRESS</span>${D.features
        .filter((f) => f.state !== "done")
        .map(
          (f) =>
            `<button class="chip" data-go="${f.state === "awaiting-you" && f.step === 2 ? "clar" : "feature"}/${f.slug}"><i class="${f.state === "awaiting-you" ? "y" : f.state === "building" ? "" : "w"}"></i>${icon(f.kind === "change" ? "wrench" : "branch", 13)} ${f.slug}<em>${f.state === "awaiting-you" ? "YOU" : D.steps[f.step]}</em></button>`,
        )
        .join("")}</footer>
      <div class="vignette"></div><div class="scan"></div>
      ${extra}</div>`;
    const m = document.getElementById("main");
    if (m && state.keepScroll != null) m.scrollTop = state.keepScroll;
  }

  // ---------- home: the branch map ----------
  function branchMap() {
    const W = 800,
      rowH = 86,
      top = 40,
      x0 = 56,
      x1 = 190,
      len = 520;
    const fs = D.features;
    const col = (f) =>
      f.state === "done"
        ? "#594775"
        : f.kind === "change"
          ? "#a874ff"
          : f.state === "awaiting-you"
            ? "#ffb02e"
            : "#8dff5a";
    const H = top + fs.length * rowH + 40;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin meet"><defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <line x1="${x0}" y1="10" x2="${x0}" y2="${H - 20}" stroke="#3b2860" stroke-width="3"/>
      <text x="${x0 + 12}" y="22" font-size="11" fill="#9a8fc0" style="font-family:var(--mono)">main · ${D.project.repo}</text>`;
    fs.forEach((f, i) => {
      const y = top + 36 + i * rowH,
        c = col(f),
        steps = D.steps.length,
        pr = f.step / (steps - 1),
        cx = x1 + len * pr;
      s += `<g class="node" data-go="${f.state === "awaiting-you" && f.step === 2 ? "clar" : "feature"}/${f.slug}">
        <path d="M${x0} ${y - 40} C ${x0} ${y}, ${x0 + 30} ${y}, ${x1} ${y}" fill="none" stroke="${c}" stroke-width="2.5" opacity=".9"/>
        <line x1="${x1}" y1="${y}" x2="${x1 + len}" y2="${y}" stroke="#2a1d45" stroke-width="3"/>
        <line x1="${x1}" y1="${y}" x2="${cx}" y2="${y}" stroke="${c}" stroke-width="3" filter="url(#glow)"/>
        ${D.steps.map((_, k) => `<line x1="${x1 + (len * k) / (steps - 1)}" y1="${y - 5}" x2="${x1 + (len * k) / (steps - 1)}" y2="${y + 5}" stroke="${k <= f.step ? c : "#3b2860"}" stroke-width="2"/>`).join("")}
        <circle class="core" cx="${cx}" cy="${y}" r="9" fill="#0a0710" stroke="${c}" stroke-width="3" ${f.state === "awaiting-you" ? 'filter="url(#glow)"' : ""}/>
        ${f.state === "awaiting-you" ? `<circle cx="${cx}" cy="${y}" r="16" fill="none" stroke="${c}" stroke-width="1" opacity=".6"><animate attributeName="r" values="12;24;12" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0;.7" dur="2.4s" repeatCount="indefinite"/></circle>` : ""}
        <text class="lbl-t" x="${x1}" y="${y - 24}">${f.title.length > 38 ? f.title.slice(0, 36) + "…" : f.title}</text>
        <text class="lbl-s" x="${x1}" y="${y - 9}">${f.kind === "change" ? "CHANGE" : "FEATURE"} · ${D.steps[f.step].toUpperCase()} · ${f.note}</text>
        <text class="lbl-s" x="${x1 + len + 14}" y="${y + 4}" style="fill:${c}">${f.state === "awaiting-you" ? "YOU" : f.state === "done" ? "MERGED" : f.age}</text></g>`;
    });
    return s + "</svg>";
  }

  const views = {
    home() {
      shell(
        `<div class="cols home-grid">
        <div class="col-l">
          ${need.length ? `<div class="alertbar" data-go="clar/layout-look"><div class="ai">${icon("alert", 28)}</div><h3>${need.length} items wait for you</h3><p>Questions: layout and look · about 45 min</p></div>` : ""}
          ${panel("Needs you", need.map((f) => `<div class="need" data-go="${f.step === 2 ? "clar" : "spec"}/${f.slug}"><b>${f.title}</b><span class="pill you">you</span><span>${f.note}</span></div>`).join(""), { cls: "hot", tag: `${need.length}` })}
          <div style="height:18px"></div>
          ${panel(
            "Priorities · now",
            D.priorities[1].items
              .slice(0, 3)
              .map(
                (i) =>
                  `<div class="need" data-go="priorities"><b>${i.t.split(":")[0]}</b><span>${i.s || "—"}</span></div>`,
              )
              .join(""),
            { tag: "→" },
          )}
        </div>
        ${panel("Branch map", `<div class="map">${branchMap()}</div>`, { cls: "hot", corners: true, tag: "git · specs/" })}
        <div class="col-r">
          ${panel("5 h window", `<dl class="kv"><dt>provider</dt><dd>${D.limits.provider}</dd><dt>used</dt><dd>${D.limits.usedPct}%</dd><dt>resets</dt><dd>${D.limits.resetsIn}</dd><dt>this week</dt><dd>${D.limits.week}%</dd></dl><div class="mbar"><i style="width:${D.limits.usedPct}%"></i></div>`, { tag: "usage" })}
          <div style="height:18px"></div>
          ${panel("Agents", running.map((s) => `<div class="srow" data-go="session/${s.feature}">${harness(s.harness, 18)}<div class="grow"><b>${s.title}</b><small>${s.model} · ${s.elapsed}</small></div><span class="pill run">live</span></div>`).join(""), { tag: `${running.length} live` })}
        </div></div>`,
        ["home"],
      );
    },

    inbox() {
      const cat = D.inbox[state.cat],
        all = D.inbox;
      const sel = cat.notes[state.sel] || cat.notes[0] || "";
      shell(
        `<div class="cols inbox-grid"><div>
        <div class="catbar">${all.map((c, i) => `<button class="catbtn ${i === state.cat ? "on" : ""}" data-cat="${i}">${c.cat}<small>${c.notes.length}</small></button>`).join("")}<button class="catbtn">+ category</button></div>
        ${cat.notes.length ? cat.notes.map((t, i) => `<div class="card" data-sel="${i}" style="${i === state.sel ? "border-color:var(--acc);border-left-color:var(--acc);background:var(--surface2)" : ""}"><span class="grip">${icon("drag", 16)}</span><div><div class="t">${esc(t)}</div><div class="m"><span>#${i + 1}</span><span>${cat.cat}</span></div></div></div>`).join("") : `<p class="hint">Nothing in ${cat.cat}. Drag a note here to file it.</p>`}</div>
        ${panel("Selected note", `<p style="font-size:17px;margin-top:0">${esc(sel)}</p><p class="hint">Opens a session with this text in the composer. Choose to turn it into a change or a feature there.</p><p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-act="new">Open session</button><button class="btn">To priorities</button><button class="btn">Delete</button></p>`, { cls: "hot", corners: true, tag: "full text" })}</div>`,
        ["inbox", cat.cat],
      );
    },

    priorities() {
      let rank = 0;
      shell(
        `<div class="cols lanes">${D.priorities
          .map(
            (g, gi) =>
              `<div class="lane l${gi}"><h3>${g.group}<small>${g.items.length}</small></h3>${g.items
                .map((it) => {
                  rank++;
                  return `<div class="card" ${it.slug ? `data-go="feature/${it.slug}"` : ""}><span class="grip">${icon("drag", 16)}</span><div><div class="t">${esc(it.t)}</div>${it.sub ? `<ul class="subs">${it.sub.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<div class="m">${it.draft ? '<span class="pill chg">draft</span>' : ""}${it.s ? `<span class="pill ${it.s.includes("you") || it.s.includes("approve") || it.s.includes("waiting") ? "you" : "run"}">${it.s}</span>` : ""}</div></div><span class="rank">${String(rank).padStart(2, "0")}</span></div>`;
                })
                .join("")}</div>`,
          )
          .join("")}</div>`,
        ["priorities"],
      );
    },

    feature(slug) {
      const f = featureOf(slug || "merge-chats") || D.features[1],
        ss = D.sessions.filter((s) => s.feature === f.slug);
      shell(
        `<div class="cols" style="grid-template-columns:minmax(0,1fr) minmax(260px,340px)"><div>
        <h1 style="font-size:34px;letter-spacing:.04em;margin-bottom:4px"><span class="glitch" data-t="${f.title}">${f.title}</span></h1>
        <p class="hint">${f.kind === "change" ? "CHANGE" : "FEATURE"} · branch ${f.slug} · ${f.note}</p>
        <div class="stepper">${D.steps.map((s, i) => `<div class="seg ${i < f.step ? "done" : i === f.step ? "cur" : ""}">${s}</div>`).join("")}</div>
        <div class="statrow"><div class="statbox"><b>${f.diff}</b><span>lines</span></div><div class="statbox"><b>${f.tokens}</b><span>tokens</span></div><div class="statbox"><b>${f.sessions}</b><span>sessions</span></div><div class="statbox"><b>${f.age}</b><span>last activity</span></div></div>
        ${panel("Files", `<div class="files">${["proposal.md", "discovery-01.md", "clarifications-01.md", "spec.md", "plan.md"].map((x) => `<a href="#/feature/${f.slug}">${icon("file", 15)} ${x}</a>`).join("")}</div>`, { tag: "specs/" })}</div>
        <div>${panel("Sessions", ss.length ? ss.map((s) => `<div class="srow" data-go="session/${f.slug}">${harness(s.harness, 18)}<div class="grow"><b>${s.title}</b><small>${s.model} · ${s.elapsed}</small></div><span class="pill ${s.state === "running" ? "run" : ""}">${s.state}</span></div>`).join("") + `<p><button class="btn pri" data-act="new">New session</button></p>` : "<p class='hint'>No session yet.</p>", { cls: "hot" })}</div></div>`,
        ["features", f.slug],
      );
    },

    clar() {
      const c = D.clarifications;
      shell(
        `<div class="cols clar-grid">
        <aside class="outline"><a class="cur">Brief</a><a>Context</a>${c.questions.map((q) => `<a class="${q.answered ? "ok" : ""}" data-q="q${q.n}">Q${q.n} ${q.answered ? "✓" : "·"} ${q.title.slice(0, 18)}…</a>`).join("")}<a>+${c.more.length} more</a><a>Settled</a>
          <div class="progress"><span class="hint">1 / 7 answered</span><div class="mbar"><i style="width:14%"></i></div><span class="hint">≈ 30 min left</span></div></aside>
        <div class="read">${B.clarifications()}</div></div>
        <button class="cta pri comm-fab" data-act="comm">${icon("chat", 16)} Ask the agent</button>`,
        ["features", "layout-look", "clarifications-01"],
        state.comm ? commPanel() : "",
      );
    },

    spec() {
      shell(
        `<div class="spec">${B.spec()}</div><button class="cta pri comm-fab" data-act="comm">${icon("chat", 16)} Ask the agent</button>`,
        ["features", "recurring-tasks", "spec.md"],
        state.comm ? commPanel() : "",
      );
    },

    session() {
      shell(
        `<div class="chat-wrap"><h2 style="font-size:26px;margin-bottom:6px">${D.session.title}</h2><p class="hint">${harness("claude", 14)} ${D.session.model} · running · 47 min</p>${B.messages()}<div class="composer" style="position:sticky;bottom:0"><input placeholder="Message the agent…"><button class="btn pri">Send</button></div></div>`,
        ["sessions", D.session.title],
      );
    },

    new() {
      const o = [
        [
          "file",
          "Session",
          "Just talk to an agent. Nothing is added to specs/.",
          "no branch · no files · throwaway",
          "var(--cyan)",
          "01",
        ],
        [
          "wrench",
          "Change",
          "A bug fix or a small change. Light flow: its own branch and a pull request.",
          "proposal → fix → PR",
          "var(--violet-hi)",
          "02",
        ],
        [
          "branch",
          "Feature",
          "A full proposal: questions, a spec you approve, a plan, then code.",
          "proposal → questions → spec → plan → code",
          "var(--acc)",
          "03",
        ],
      ];
      shell(
        `<div style="max-width:1100px;margin:10px auto"><h1 style="font-size:36px;letter-spacing:.12em;text-transform:uppercase">New</h1><p class="hint">Pick what you are starting. You can attach a session to a change or feature later.</p></div>
        <div class="newgrid">${o.map(([ic, t, d, tr, c1, n]) => `<button class="opt-card" style="--c1:${c1}" data-go="session/new"><span class="num">${n}</span><span class="big">${icon(ic, 30)}</span><h3>${t}</h3><p>${d}</p><span class="traits">${tr}</span></button>`).join("")}</div>
        <p class="hint" style="text-align:center">Change or feature next asks: pick a priorities line, an inbox note, an existing proposal, or write the text here.</p>`,
        ["new"],
      );
    },

    decisions() {
      shell(
        `<div class="cols" style="grid-template-columns:minmax(0,1fr) minmax(250px,340px)"><div><h1 style="font-size:30px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:14px">Constitution</h1>${B.constitution()}</div>
        <div>${panel("Decisions", `<div class="filter"><input class="txt" placeholder="Filter decisions…"></div><div class="dgrid">${D.decisions.map((d) => `<div class="dcard">${icon("scale", 16)}<b>${d.name}</b><small>${d.status} · ${d.rules}</small></div>`).join("")}</div>`, { cls: "hot", tag: "7" })}</div></div>`,
        ["decisions"],
      );
    },

    settings() {
      shell(
        `<div style="max-width:620px">${panel(
          "Settings",
          [
            ["Harness", "Claude Code"],
            ["Model", "Opus 5.5"],
            ["Notifications", "off"],
            ["Access key", "••••••••••"],
            ["Repositories", "1"],
          ]
            .map(([a, b]) => `<div class="set"><b>${a}</b><span>${b}</span></div>`)
            .join(""),
          { cls: "hot" },
        )}</div>`,
        ["settings"],
      );
    },
  };

  function commPanel() {
    return `<div class="comm panel hot"><div class="ph">${harness("claude", 15)} Comm link · discovery <button class="btn" data-act="comm" style="margin-left:auto;padding:2px 10px">${icon("x", 13)}</button></div><div class="pb"><div class="msgs">${B.messages()}</div><div class="composer"><input placeholder="Ask about the question you are on…"><button class="btn pri">Send</button></div></div></div>`;
  }

  // ---------- events ----------
  function render() {
    const [v, a] = route();
    (views[v] || views.home)(a);
  }
  addEventListener("hashchange", () => {
    state.sel = 0;
    state.comm = false;
    render();
  });
  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go],[data-act],[data-cat],[data-sel],[data-q]");
    if (!t) return;
    if (t.dataset.act === "new") go("new");
    else if (t.dataset.act === "note") go("inbox");
    else if (t.dataset.act === "comm") {
      state.comm = !state.comm;
      state.keepScroll = document.getElementById("main").scrollTop;
      render();
      state.keepScroll = null;
    } else if (t.dataset.cat) {
      state.cat = +t.dataset.cat;
      state.sel = 0;
      render();
    } else if (t.dataset.sel) {
      state.sel = +t.dataset.sel;
      render();
    } else if (t.dataset.q)
      document.getElementById(t.dataset.q).scrollIntoView({ behavior: "smooth", block: "start" });
    else if (t.dataset.go) go(t.dataset.go);
  });
  // parallax: background layers drift against the pointer
  addEventListener("pointermove", (e) => {
    document.documentElement.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
    document.documentElement.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
  });
  render();
})();
