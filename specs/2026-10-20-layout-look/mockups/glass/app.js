// Direction G, "glass": every view of the information architecture, as floating glass chrome around opaque sheets.
(function () {
  const D = window.URA,
    B = window.BLOCKS,
    app = document.getElementById("app");
  const state = { detent: null, sel: 0, tile: 1, theme: null };
  const featureOf = (s) => D.features.find((f) => f.slug === s);
  const running = D.sessions.filter((s) => s.state === "running");
  const need = D.features.filter((f) => f.state === "awaiting-you");
  const nNotes = D.inbox.reduce((n, c) => n + c.notes.length, 0);
  const route = () => (location.hash.replace(/^#\//, "") || "home").split("/");
  const go = (p) => {
    location.hash = "#/" + p;
  };
  const target = (f) =>
    (f.state === "awaiting-you" && f.step === 2
      ? "clar/"
      : f.state === "awaiting-you"
        ? "spec/"
        : "feature/") + f.slug;
  const ringColors = ["#34c759", "#0a84ff", "#ff9f0a", "#bf5af2", "#ff6482"];

  function ring(f, i) {
    const R = [42, 33, 24],
      C = (r) => 2 * Math.PI * r,
      p = f.step / (D.steps.length - 1);
    const c =
      f.state === "awaiting-you"
        ? "#ff9f0a"
        : f.state === "done"
          ? "#8e8e93"
          : f.kind === "change"
            ? "#bf5af2"
            : "#34c759";
    return `<div class="ringc" data-go="${target(f)}"><svg viewBox="0 0 104 104"><g transform="rotate(-90 52 52)"><circle cx="52" cy="52" r="42" fill="none" stroke="${c}" stroke-opacity=".18" stroke-width="12"/><circle cx="52" cy="52" r="42" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C(42) * p} ${C(42)}"/>
      <circle cx="52" cy="52" r="29" fill="none" stroke="${c}" stroke-opacity=".18" stroke-width="10"/><circle cx="52" cy="52" r="29" fill="none" stroke="${c}" stroke-opacity=".6" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C(29) * Math.min(1, f.sessions / 3)} ${C(29)}"/></g>
      <g transform="translate(40 40)" stroke="${c}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${f.kind === "change" ? "M14.5 6.5a4 4 0 0 0 5 5L12 19a2.8 2.8 0 0 1-4-4l7.5-7.5z" : "M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9c0 5-6 4-12 6"}" transform="scale(.5) translate(0 0)"/></g></svg>
      <b>${f.slug}</b><small>${f.state === "awaiting-you" ? "waiting for you" : D.steps[f.step]}</small></div>`;
  }

  const NI = (c, ic) => `<span class="ni" style="background:${c}">${icon(ic, 16)}</span>`;
  function shell(content, title, crumb, { extra = "", actions = "" } = {}) {
    const r = route()[0],
      L = D.limits;
    const n = (id, c, ic, label, cnt, hot) =>
      `<button class="nav ${r === id ? "on" : ""}" data-go="${id}">${NI(c, ic)}<span class="tx">${label}</span>${cnt ? `<span class="cnt ${hot ? "hot" : ""}">${cnt}</span>` : ""}</button>`;
    if (state.theme) document.documentElement.dataset.theme = state.theme;
    app.innerHTML = `<div class="app">
      <aside class="side glass"><div class="brand" data-go="home"><span class="logo">${icon("tree", 18)}</span><span>Uraeda</span></div>
        <div class="scroll">
          ${n("home", "linear-gradient(135deg,#0a84ff,#5e5ce6)", "home", "Home")}
          ${n("inbox", "linear-gradient(135deg,#ff9f0a,#ff7a00)", "inbox", "Inbox", nNotes)}
          ${n("priorities", "linear-gradient(135deg,#34c759,#1f9d55)", "list", "Priorities")}
          <div class="sec">Needs you</div>
          ${need.map((f) => `<button class="nav sm" data-go="${target(f)}"><span class="ni">${icon(f.step === 2 ? "help" : "file", 16)}</span><span class="tx"><b>${f.slug}</b><span class="sub">${f.note}</span></span><span class="dot y"></span></button>`).join("")}
          <div class="sec">Sessions <button data-act="new">＋ New</button></div>
          ${running.map((s) => `<button class="nav sm" data-go="session/${s.feature}"><span class="ni">${harness(s.harness, 16)}</span><span class="tx"><b>${s.title}</b><span class="sub">${s.feature} · ${s.elapsed}</span></span><span class="dot"></span></button>`).join("")}
          <div class="sec">In progress</div>
          ${D.features
            .filter((f) => f.state === "building")
            .map(
              (f) =>
                `<button class="nav sm" data-go="feature/${f.slug}"><span class="ni">${icon(f.kind === "change" ? "wrench" : "branch", 16)}</span><span class="tx"><b>${f.slug}</b><span class="sub">${D.steps[f.step]} · ${f.note}</span></span></button>`,
            )
            .join("")}
          <div class="sec">Project</div>
          ${n("decisions", "linear-gradient(135deg,#bf5af2,#8944ab)", "scale", "Decisions")}
          ${n("settings", "linear-gradient(135deg,#8e8e93,#636366)", "settings", "Settings")}
        </div>
        <div class="foot"><div class="usage" title="${L.provider}"><b>${L.usedPct}% of ${L.windowHours} h window</b><div class="bar"><i style="width:${L.usedPct}%"></i></div>resets in ${L.resetsIn}</div><button class="cbtn" data-act="theme" title="Appearance">${icon("eye", 16)}</button></div></aside>
      <section class="main"><header class="bar-top glass"><span class="title">${title}</span><span class="crumb">${crumb || ""}</span><span class="sp"></span>${actions}
        <button class="pill-btn" data-act="note">${icon("plus", 15)}<span class="t">Note</span></button><button class="pill-btn pri" data-act="new">${icon("spark", 15)}<span class="t">New</span></button></header>
        <div class="content ${/home|priorities|inbox|decisions|settings|new/.test(r) ? "sheet" : "sheet"}" id="content">${content}${extra}</div></section></div>`;
  }

  const drawer = () => {
    const d = state.detent || "half";
    return `<div class="drawer glass d-${d}"><div class="grab" data-act="detent"></div><div class="dh">${harness("claude", 18)} Discovery · layout and look <span class="pill run">running</span><span class="dcontrols"><button class="cbtn" data-act="peek" title="Collapse">${icon("chevD", 15)}</button><button class="cbtn" data-act="full" title="Expand">${icon("panelB", 15)}</button><button class="cbtn" data-act="close" title="Close">${icon("x", 15)}</button></span></div>
      ${d === "peek" ? "" : `<div class="msgs">${B.messages()}</div><div class="composer"><input placeholder="Ask about the question you are on…"><button class="pill-btn pri">Send</button></div>`}</div>`;
  };
  const ask = () =>
    `<button class="pill-btn pri" data-act="open">${icon("chat", 15)}<span class="t">Ask the agent</span></button>`;

  const views = {
    home() {
      shell(
        `<div class="page"><p class="eyebrow">Tuesday 20 October</p><h1 class="large">Good evening, Alex.</h1>
        <div class="widgets">
          <div class="w tint big"><h3>${icon("alert", 16)} Needs you</h3><div class="num">${need.length}</div><div style="font-weight:600;margin:2px 0 8px">things wait on you</div>${need.map((f) => `<div class="row2" data-go="${target(f)}">${f.title}<small>${f.note}</small></div>`).join("")}</div>
          <div class="w glass mid"><h3>${icon("pulse", 16)} Agents at work</h3>${running.map((s) => `<div class="live-row" data-go="session/${s.feature}">${harness(s.harness, 22)}<div class="g"><b>${s.title}</b><small>${s.model} · ${s.elapsed}</small></div><span class="wave"><i></i><i></i><i></i><i></i></span></div>`).join("")}</div>
          <div class="w sheet full"><h3>${icon("branch", 16)} Features and changes</h3><div class="rings">${D.features.map(ring).join("")}</div></div>
          <div class="w sheet third" data-go="inbox" style="cursor:pointer"><h3>${icon("inbox", 16)} Inbox</h3><div style="font-size:44px;font-weight:800;letter-spacing:-.04em">${nNotes}</div><div class="hint">notes to sort</div></div>
          <div class="w sheet third" data-go="priorities" style="cursor:pointer"><h3>${icon("list", 16)} Now</h3>${D.priorities[1].items
            .slice(0, 2)
            .map((i) => `<div style="margin:4px 0;font-weight:600">${i.t.split(":")[0]}</div>`)
            .join("")}</div>
          <div class="w sheet third" data-go="decisions" style="cursor:pointer"><h3>${icon("scale", 16)} Decisions</h3><div style="font-size:44px;font-weight:800;letter-spacing:-.04em">${D.decisions.length}</div><div class="hint">active and proposed</div></div>
        </div></div>`,
        "Home",
        "",
      );
    },

    inbox() {
      let n = -1;
      const all = D.inbox.flatMap((c) => c.notes);
      const cur = all[state.sel] || all[0];
      shell(
        `<div class="page"><div class="split"><div><p class="eyebrow">${nNotes} notes</p><h1 class="large">Inbox</h1>
        ${D.inbox
          .map(
            (c) =>
              `<div class="ghead">${c.cat}<small>${c.notes.length}</small></div><div class="group">${
                c.notes.length
                  ? c.notes
                      .map((t) => {
                        n++;
                        return `<div class="grow ${n === state.sel ? "sel" : ""}" data-sel="${n}"><span class="grip">${icon("drag", 16)}</span><span class="tx">${esc(t)}</span></div>`;
                      })
                      .join("")
                  : `<div class="grow" style="color:var(--ink3);cursor:default">Empty</div>`
              }</div>`,
          )
          .join("")}<button class="pill-btn">${icon("plus", 14)} New category</button></div>
        <aside class="insp glass"><p class="eyebrow">Selected note</p><p style="font-size:18px;line-height:1.45;margin:0 0 14px">${esc(cur)}</p><p style="display:grid;gap:8px"><button class="pill-btn pri" data-act="new">${icon("spark", 15)} Open a session</button><button class="pill-btn">${icon("flag", 15)} Move to priorities</button><button class="pill-btn">${icon("x", 15)} Delete</button></p><p class="hint">The session starts with this text in its composer. Pick a change or a feature there.</p></aside></div></div>`,
        "Inbox",
        "",
      );
    },

    priorities() {
      let rank = 0;
      const tiles = [
        ["s0", "Ongoing", "play"],
        ["s1", "Now", "flag"],
        ["s2", "Next", "clock"],
        ["s3", "Later", "history"],
      ];
      shell(
        `<div class="page"><p class="eyebrow">What to tend first</p><h1 class="large">Priorities</h1>
        <div class="smart">${tiles.map(([c, l, ic], i) => `<button class="stile ${c} ${state.tile === i ? "on" : ""}" data-tile="${i}"><div class="top"><span class="si">${icon(ic, 16)}</span><b>${D.priorities[i].items.length}</b></div><span>${l}</span></button>`).join("")}</div>
        ${D.priorities
          .map(
            (g, gi) =>
              `<div class="ghead">${g.group}<small>${g.items.length}</small></div><div class="group">${g.items
                .map((it) => {
                  rank++;
                  return `<div class="prio g${gi}" ${it.slug ? `data-go="${target(featureOf(it.slug))}"` : ""}><span class="n">${rank}</span><div><div class="t">${esc(it.t)}</div>${it.sub ? `<ul>${it.sub.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div><span>${it.draft ? '<span class="pill chg">draft</span>' : ""} ${it.s ? `<span class="pill ${/you|approve|waiting/.test(it.s) ? "you" : "run"}">${it.s}</span>` : ""}</span></div>`;
                })
                .join("")}</div>`,
          )
          .join("")}</div>`,
        "Priorities",
        "",
      );
    },

    feature(slug) {
      const f = featureOf(slug || "merge-chats") || D.features[1],
        ss = D.sessions.filter((s) => s.feature === f.slug);
      shell(
        `<div class="page"><p class="eyebrow">${f.kind === "change" ? "Change" : "Feature"} · ${f.slug}</p><h1 class="large">${f.title}</h1>
        <div class="stage-row">${D.steps.map((s, i) => `<div class="st ${i < f.step ? "done" : i === f.step ? "cur" : ""}">${s}</div>`).join("")}</div>
        <div class="bento"><div class="bt"><b>${f.diff}</b><span>Lines changed</span></div><div class="bt"><b>${f.tokens}</b><span>Tokens used</span></div><div class="bt"><b>${f.sessions}</b><span>Sessions</span></div><div class="bt"><b>${f.age}</b><span>Last activity</span></div></div>
        <div class="cols2"><div class="lst"><h3>Sessions</h3>${ss.length ? ss.map((s) => `<div class="lrow" data-go="session/${f.slug}">${harness(s.harness, 22)}<div class="g"><b>${s.title}</b><small>${s.model} · ${s.elapsed}</small></div><span class="pill ${s.state === "running" ? "run" : ""}">${s.state}</span></div>`).join("") : '<div class="lrow"><small>No session yet</small></div>'}<div class="lrow" data-act="new" style="color:var(--acc);font-weight:700">${icon("plus", 16)} New session</div></div>
        <div class="lst"><h3>Files</h3>${["proposal.md", "discovery-01.md", "clarifications-01.md", "spec.md", "plan.md"].map((x, i) => `<div class="lrow">${icon("file", 18)}<div class="g"><b>${x}</b></div><small>${i < f.step ? "written" : "to come"}</small></div>`).join("")}</div></div></div>`,
        f.title,
        "Feature",
      );
    },

    clar() {
      const c = D.clarifications;
      shell(
        `<div class="page narrow read" style="padding-bottom:${state.detent === "full" ? 60 : state.detent ? 360 : 60}px">
        <div class="qnav"><span class="pg">${icon("list", 14)} 1 of 7</span><div class="qscroll"><button class="qp cur">Intro</button>${c.questions.map((q) => `<button class="qp ${q.answered ? "ok" : ""}" data-q="q${q.n}">Q${q.n}${q.answered ? " ✓" : ""}</button>`).join("")}<button class="qp">+5</button><button class="qp">Settled</button></div><span class="sp"></span>${ask()}</div>
        <p class="eyebrow" style="font-family:var(--sans)">Round 01 · Recurring tasks</p><h1 class="large" style="font-family:var(--sans)">Questions</h1><div style="height:18px"></div>${B.clarifications()}</div>`,
        "Questions",
        "recurring-tasks",
        { extra: state.detent ? drawer() : "" },
      );
    },

    spec() {
      shell(
        `<div class="page narrow" style="padding-bottom:${state.detent ? 360 : 60}px"><div class="qnav"><span class="pg">${icon("file", 14)} spec.md · approved</span><span class="sp"></span>${ask()}</div><div class="spec">${B.spec()}</div></div>`,
        "Spec",
        "recurring-tasks",
        { extra: state.detent ? drawer() : "" },
      );
    },

    session() {
      shell(
        `<div class="page narrow"><p class="eyebrow">${harness("claude", 14)} ${D.session.model} · running 47 min</p><h1 class="large">${D.session.title}</h1><div style="height:12px"></div>${B.messages()}
        <div class="sidecard"><h4>Sources</h4>${D.session.side.sources.map((x) => `<div class="r">${icon("search", 14)} ${x}</div>`).join("")}<h4>Files changed</h4>${D.session.side.files.map((x) => `<div class="r">${icon("file", 14)} ${x}</div>`).join("")}<h4>Sub-sessions</h4>${D.session.side.subs.map((x) => `<div class="r">${icon("robot", 14)} ${x}</div>`).join("")}</div>
        <div class="composer" style="position:sticky;bottom:0;margin-top:16px"><input placeholder="Message the agent…"><button class="pill-btn pri">Send</button></div></div>`,
        D.session.title,
        "Session",
      );
    },

    new() {
      shell(
        `<div class="page"><p class="eyebrow">Start something</p><h1 class="large">New</h1>
        <div class="choose"><button class="ch c1" data-go="session/new"><span class="big">${icon("chat", 32)}</span><h3>Session</h3><p>Just talk to an agent. Nothing is added to specs/.</p><span class="steps">No branch · no files</span></button>
        <button class="ch c2" data-go="session/new"><span class="big">${icon("wrench", 32)}</span><h3>Change</h3><p>A bug fix or a small change, with its own branch and pull request.</p><span class="steps">Proposal → fix → pull request</span></button>
        <button class="ch c3" data-go="session/new"><span class="big">${icon("branch", 32)}</span><h3>Feature</h3><p>A full proposal: questions, a spec you approve, a plan, then code.</p><span class="steps">Proposal → questions → spec → plan → code</span></button></div>
        <p class="hint" style="text-align:center">Change and feature then ask: pick a priority, an inbox note, or a proposal, or write the text right here.</p></div>`,
        "New",
        "",
      );
    },

    decisions() {
      shell(
        `<div class="page narrow"><p class="eyebrow">What every agent follows</p><h1 class="large">Constitution</h1><div style="height:18px"></div>
        ${D.constitution.map((p) => `<article class="pr"><span class="pn">${p.n}</span><div><h3>${p.t}</h3><ul>${p.rules.map((r) => `<li>${esc(r).replace(/\b(MUST NOT|MUST|SHOULD|MAY)\b/g, "<b>$1</b>")}</li>`).join("")}</ul><p class="rationale">${esc(p.why)}</p></div></article>`).join("")}
        <div class="ghead" style="margin-top:36px">Decisions<small>${D.decisions.length}</small></div><input class="txt" placeholder="Search decisions" style="margin:10px 0 14px"><div class="dlist">${D.decisions.map((d) => `<div class="dr">${icon("scale", 18)}<b>${d.name}</b><small>${d.rules} rules</small><span class="pill ${d.status === "active" ? "run" : "you"}">${d.status}</span></div>`).join("")}</div></div>`,
        "Decisions",
        "",
      );
    },

    settings() {
      shell(
        `<div class="page narrow"><h1 class="large">Settings</h1><div style="height:18px"></div><div class="dlist">${[
          ["Harness", "Claude Code"],
          ["Model", "Opus 5.5"],
          ["Access key", "••••••••••"],
          ["Repositories", "1"],
        ]
          .map(([a, b]) => `<div class="set"><b>${a}</b><span>${b}</span></div>`)
          .join(
            "",
          )}<div class="set"><b>Notifications</b><span class="tog"></span></div><div class="set"><b>Reduce transparency</b><span class="tog"></span></div></div></div>`,
        "Settings",
        "",
      );
    },
  };

  function render() {
    const [v, a] = route();
    const y = document.getElementById("content") && document.getElementById("content").scrollTop;
    (views[v] || views.home)(a);
    const c = document.getElementById("content");
    if (c && state.keep) c.scrollTop = y;
  }
  addEventListener("hashchange", () => {
    state.detent = null;
    state.sel = 0;
    state.keep = false;
    render();
  });
  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go],[data-act],[data-sel],[data-q],[data-tile]");
    if (!t) return;
    const a = t.dataset.act;
    state.keep = true;
    if (a === "new") {
      state.keep = false;
      go("new");
    } else if (a === "note") {
      state.keep = false;
      go("inbox");
    } else if (a === "theme") {
      const dark =
        document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme &&
          matchMedia("(prefers-color-scheme: dark)").matches);
      state.theme = dark ? "light" : "dark";
      render();
    } else if (a === "open") {
      state.detent = "half";
      render();
    } else if (a === "close") {
      state.detent = null;
      render();
    } else if (a === "peek") {
      state.detent = "peek";
      render();
    } else if (a === "full") {
      state.detent = state.detent === "full" ? "half" : "full";
      render();
    } else if (a === "detent") {
      state.detent = state.detent === "half" ? "peek" : "half";
      render();
    } else if (t.dataset.sel) {
      state.sel = +t.dataset.sel;
      render();
    } else if (t.dataset.tile) {
      state.tile = +t.dataset.tile;
      render();
    } else if (t.dataset.q) {
      document.getElementById(t.dataset.q).scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (t.dataset.go) {
      state.keep = false;
      go(t.dataset.go);
    }
  });
  render();
})();
