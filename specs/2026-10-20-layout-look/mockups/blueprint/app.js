// Direction B, "blueprint": every view of the information architecture, drawn as a set of technical drawing sheets.
(function () {
  const D = window.URA,
    B = window.BLOCKS,
    app = document.getElementById("app");
  const state = { notes: false, sel: 0, theme: "cyan" };
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
  const SHEETS = [
    ["home", "S-01", "Overview"],
    ["inbox", "S-02", "Inbox"],
    ["priorities", "S-03", "Priorities"],
    ["new", "S-04", "New"],
    ["decisions", "S-05", "Decisions"],
    ["settings", "S-06", "Settings"],
  ];
  const MARK = `<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 24V13M13 15 7 10M13 12l6-5M7 10 4 5M7 10l4-4M19 7l3-4M19 7l-4-3"/><path d="M6 24h14"/></svg>`;

  function shell(
    content,
    title,
    { notes = "", sheetNo = "", feature = "—", step = "—", rev = "A", status = "" } = {},
  ) {
    const r = route()[0],
      L = D.limits;
    const idx = SHEETS.indexOf(SHEETS.find((s) => s[0] === r));
    document.documentElement.dataset.theme = state.theme;
    const ix = (go_, no, t, sub, st, on) =>
      `<button class="ix nav ${on ? "on" : ""}" data-go="${go_}"><span class="no">${no}</span><span class="t" data-s="${(/^S-/.test(no) ? t.slice(0, 3) : no.replace("-", "")).toUpperCase()}">${t}${sub ? `<small>${sub}</small>` : ""}</span>${st ? `<i class="st ${st}"></i>` : "<i></i>"}</button>`;
    app.innerHTML = `<div class="sheet ${notes ? "notes" : ""}">
      <header class="bar"><div class="logo" data-go="home">${MARK}<span>URAEDA</span></div>
        <nav class="tabs">${SHEETS.filter((s) => s[0] !== "settings" && s[0] !== "new")
          .map(
            ([id, no, t]) =>
              `<button class="tab ${r === id ? "on" : ""}" data-go="${id}"><span class="n">${no}</span>${t}${id === "inbox" ? `<span class="bd">${nNotes}</span>` : ""}</button>`,
          )
          .join("")}</nav>
        <div class="gauge" title="${L.provider}">5 H WINDOW · ${L.usedPct}% · RESET ${L.resetsIn}<div class="rule"><i style="width:${L.usedPct}%"></i></div></div>
        <div class="act"><button class="abtn" data-act="note">${icon("plus", 15)}<span class="t">Note</span></button><button class="abtn pri" data-act="new">${icon("spark", 15)}<span class="t">New</span></button><button class="abtn" data-act="theme" title="Cyanotype or vellum">${icon("eye", 15)}</button><button class="abtn" data-go="settings">${icon("settings", 15)}</button></div></header>
      <aside class="index">
        <h4>Drawing list</h4>${SHEETS.map(([id, no, t]) => ix(id, no, t, "", id === "inbox" && nNotes ? "you" : "", r === id)).join("")}
        <h4>Needs you<span>${need.length}</span></h4>${need.map((f, i) => ix(target(f), "Q-" + (i + 1), f.slug, f.note, "you", false)).join("")}
        <h4>Running<button data-act="new">+ NEW</button></h4>${running.map((s, i) => ix("session/" + s.feature, "R-" + (i + 1), s.title, s.feature + " · " + s.elapsed, "run", false)).join("")}
        <h4>In progress</h4>${D.features
          .filter((f) => f.state === "building")
          .map((f, i) =>
            ix(
              "feature/" + f.slug,
              (f.kind === "change" ? "C-" : "F-") + (i + 1),
              f.slug,
              D.steps[f.step] + " · " + f.note,
              "",
              false,
            ),
          )
          .join("")}
      </aside>
      <main class="draw" id="draw">${content}</main>
      ${notes ? `<aside class="notes-col">${notes}</aside>` : ""}
      <footer class="tblock"><div class="tb"><small>Project</small><b>uraeda / specs</b></div><div class="tb"><small>Sheet title</small><b>${title}</b></div><div class="tb"><small>Feature</small><b>${feature}</b></div><div class="tb"><small>Step</small><b>${step}</b></div><div class="tb"><small>Sheet</small><b>${sheetNo || (idx >= 0 ? idx + 1 : "—") + " / 6"}</b></div><div class="tb"><small>Rev</small><b>${rev}</b></div>
        <button class="tb click" data-act="run"><small>Agents running</small><b>${running.length} ${status ? "" : ""}${status || '<span class="stamp ok">live</span>'}</b></button></footer></div>`;
    if (state.notes && notes)
      document.querySelector(".notes-col").style.cssText =
        "display:flex;position:fixed;right:12px;top:58px;bottom:78px;width:min(360px,calc(100vw - 40px));z-index:30;border:2px solid var(--line);background:var(--bg)";
  }

  const notesCol = () =>
    `<div class="nh">${harness("claude", 16)} Notes · agent session <button class="btn" data-act="notes" style="margin-left:auto;padding:2px 8px">${icon("x", 13)}</button></div><div class="msgs">${B.messages()}</div><div class="composer" style="margin:10px"><input placeholder="Ask about question 2…"><button class="btn pri">Send</button></div>`;
  const askBtn = () =>
    `<button class="btn pri fabbtn" data-act="notes">${icon("chat", 14)} Notes</button>`;
  const stampFor = (f) =>
    f.state === "awaiting-you"
      ? '<span class="stamp y">awaiting you</span>'
      : f.state === "done"
        ? '<span class="stamp ok">merged</span>'
        : '<span class="stamp ok">building</span>';

  function plan() {
    const X = (i) => 70 + i * 108,
      y0 = 214;
    const stack = {};
    const marks = D.features.map((f) => {
      const k = (stack[f.step] = (stack[f.step] || 0) + 1) - 1;
      return { f, x: X(f.step), y: y0 - 38 - k * 52 };
    });
    return `<div class="plan"><svg viewBox="0 0 900 250"><line x1="30" y1="${y0}" x2="870" y2="${y0}" stroke="var(--line)" stroke-width="3"/>
      ${D.steps.map((s, i) => `<line x1="${X(i)}" y1="${y0 - 8}" x2="${X(i)}" y2="${y0 + 8}" stroke="var(--line)" stroke-width="2"/><text x="${X(i)}" y="${y0 + 26}" text-anchor="middle" class="ls" style="letter-spacing:.1em">${s.toUpperCase()}</text><text x="${X(i)}" y="${y0 + 40}" text-anchor="middle" class="ls" style="fill:var(--line)">${String(i + 1).padStart(2, "0")}</text>`).join("")}
      ${marks
        .map(({ f, x, y }) => {
          const c =
            f.state === "awaiting-you"
              ? "var(--hl)"
              : f.state === "done"
                ? "var(--ok)"
                : "var(--ink)";
          return `<g class="mk" data-go="${target(f)}"><line x1="${x}" y1="${y + 8}" x2="${x}" y2="${y0}" stroke="${c}" stroke-width="1.5" stroke-dasharray="3 3"/><rect class="mc" x="${x - 8}" y="${y - 8}" width="16" height="16" transform="rotate(45 ${x} ${y})" fill="${f.state === "awaiting-you" ? "var(--hl)" : "var(--bg)"}" stroke="${c}" stroke-width="2"/><text class="lt" x="${x + 16}" y="${y - 2}">${f.slug}</text><text class="ls" x="${x + 16}" y="${y + 12}">${f.state === "awaiting-you" ? "AWAITING YOU" : f.state === "done" ? "MERGED" : f.kind === "change" ? "CHANGE" : "FEATURE"}</text></g>`;
        })
        .join("")}
      <g stroke="var(--hl)" fill="none" stroke-width="1.5"><path d="M${X(2) - 40} 30 L${X(2) - 40} 20 L${X(2) + 40} 20 L${X(2) + 40} 30"/></g><text x="${X(2)}" y="14" text-anchor="middle" class="ls" style="fill:var(--hl)">HUMAN GATE</text></svg></div>`;
  }

  const views = {
    home() {
      shell(
        `<div class="page"><div class="sheet-title"><span class="no">S-01</span><h1>Project overview</h1><span class="sp"></span><small>${new Date(2026, 9, 20).toDateString().toUpperCase()}</small></div>
        ${plan()}
        <table class="reg"><thead><tr><th>No.</th><th>Title</th><th>Progress</th><th>Kind</th><th>Status</th><th>Rev</th></tr></thead><tbody>${D.features.map((f, i) => `<tr data-go="${target(f)}"><td class="no">${f.kind === "change" ? "C" : "F"}-${String(i + 1).padStart(3, "0")}</td><td class="tt">${f.title}<div class="hint">${f.note}</div></td><td><div class="ruler">${D.steps.map((_, k) => `<i class="${k < f.step ? "d" : k === f.step ? "c" : ""}"></i>`).join("")}</div></td><td><span class="pill ${f.kind === "change" ? "chg" : ""}">${f.kind}</span></td><td>${stampFor(f)}</td><td class="hint">${f.age}</td></tr>`).join("")}</tbody></table>
        <div class="sum"><div data-go="inbox"><b>${nNotes}</b><small>Notes in inbox</small></div><div data-go="priorities"><b>${D.priorities[0].items.length + D.priorities[1].items.length}</b><small>Ongoing and now</small></div><div data-act="run"><b>${running.length}</b><small>Agents running</small></div><div data-go="decisions"><b>${D.decisions.length}</b><small>Decisions</small></div></div></div>`,
        "Project overview",
        { feature: "—", step: "—" },
      );
    },

    inbox() {
      let n = -1;
      const all = D.inbox.flatMap((c) => c.notes),
        cur = all[state.sel] || all[0];
      shell(
        `<div class="page"><div class="sheet-title"><span class="no">S-02</span><h1>Inbox · punch list</h1><span class="sp"></span><small>${nNotes} OPEN ITEMS</small></div><div class="split"><table class="punch"><tbody>
        ${D.inbox
          .map(
            (c) =>
              `<tr class="cat"><td colspan="4">${c.cat} <span class="hint">· ${c.notes.length}</span></td></tr>${
                c.notes.length
                  ? c.notes
                      .map((t) => {
                        n++;
                        return `<tr class="n ${n === state.sel ? "sel" : ""}" data-sel="${n}"><td class="no">I-${String(n + 1).padStart(3, "0")}</td><td class="bx"><i></i></td><td class="tx">${esc(t)}</td><td class="ac">⠿ drag</td></tr>`;
                      })
                      .join("")
                  : `<tr><td></td><td></td><td class="hint">— none —</td><td></td></tr>`
              }`,
          )
          .join("")}</tbody></table>
        <aside class="detail"><h4>Item detail</h4><p style="font-size:17px;margin:0 0 12px">${esc(cur)}</p><p style="display:grid;gap:8px"><button class="btn pri" data-act="new">${icon("spark", 14)} Open session</button><button class="btn">${icon("flag", 14)} To priorities</button><button class="btn">${icon("x", 14)} Delete</button><button class="btn">${icon("plus", 14)} New category</button></p><p class="hint">The session starts with this text in its composer.</p></aside></div></div>`,
        "Inbox",
        { sheetNo: "2 / 6" },
      );
    },

    priorities() {
      let rank = 0;
      shell(
        `<div class="page"><div class="sheet-title"><span class="no">S-03</span><h1>Priorities · schedule</h1><span class="sp"></span><small>LINE WEIGHT = IMPORTANCE</small></div>
        ${D.priorities
          .map(
            (g, gi) =>
              `<section class="phase ph${gi}"><header><h2>${g.group}</h2><span class="rl"></span><small>${g.items.length} ITEMS</small></header>${g.items
                .map((it) => {
                  rank++;
                  return `<div class="it" ${it.slug ? `data-go="${target(featureOf(it.slug))}"` : ""}><span class="no">P-${String(rank).padStart(2, "0")}</span><div><div class="t">${esc(it.t)}</div>${it.sub ? `<ul>${it.sub.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div><span class="sp">${it.draft ? '<span class="pill chg">draft</span>' : ""}${it.s ? `<span class="pill ${/you|approve|waiting/.test(it.s) ? "you" : "run"}">${it.s}</span>` : ""}</span></div>`;
                })
                .join("")}</section>`,
          )
          .join("")}</div>`,
        "Priorities",
        { sheetNo: "3 / 6" },
      );
    },

    feature(slug) {
      const f = featureOf(slug || "merge-chats") || D.features[1],
        ss = D.sessions.filter((s) => s.feature === f.slug);
      shell(
        `<div class="page"><div class="sheet-title"><span class="no">${f.kind === "change" ? "C" : "F"}-${f.slug.toUpperCase()}</span><h1>${f.title}</h1><span class="sp"></span>${stampFor(f)}</div>
        <div class="stations">${D.steps.map((s, i) => `<div class="sn ${i < f.step ? "done" : i === f.step ? "cur" : ""}"><div class="c">${i < f.step ? "✓" : i + 1}</div>${s}</div>`).join("")}</div>
        <div class="dims"><div><b>${f.diff}</b><small>Lines changed</small></div><div><b>${f.tokens}</b><small>Tokens</small></div><div><b>${f.sessions}</b><small>Sessions</small></div><div><b>${f.age}</b><small>Last activity</small></div></div>
        <div class="two"><div class="box"><h3>Sessions</h3>${ss.length ? ss.map((s) => `<div class="brow" data-go="session/${f.slug}">${harness(s.harness, 20)}<div class="g"><b>${s.title}</b><small>${s.model} · ${s.elapsed}</small></div><span class="pill ${s.state === "running" ? "run" : ""}">${s.state}</span></div>`).join("") : '<div class="brow"><small>No session yet</small></div>'}<div class="brow" data-act="new" style="color:var(--hl)">${icon("plus", 15)} New session</div></div>
        <div class="box"><h3>Drawing files</h3>${["proposal.md", "discovery-01.md", "clarifications-01.md", "spec.md", "plan.md"].map((x, i) => `<div class="brow">${icon("file", 16)}<div class="g"><b>${x}</b></div><small>${i < f.step ? "ISSUED" : "PENDING"}</small></div>`).join("")}</div></div></div>`,
        f.title,
        { feature: f.slug, step: D.steps[f.step], sheetNo: "—", rev: "A" },
      );
    },

    clar() {
      shell(
        `<div class="page narrow read"><div class="sheet-title" style="font-family:var(--sans)"><span class="no">Q-01</span><h1>Clarifications · round 01</h1><span class="sp"></span><small>1 / 7 ANSWERED · ~30 MIN</small></div>${B.clarifications()}${state.notes ? "" : askBtn()}</div>`,
        "Clarifications",
        {
          notes: notesCol(),
          feature: "layout-look",
          step: "Questions",
          sheetNo: "Q-01",
          rev: "01",
          status: '<span class="stamp y">awaiting you</span>',
        },
      );
    },

    spec() {
      shell(
        `<div class="page narrow"><div class="sheet-title"><span class="no">SP-01</span><h1>Spec · recurring tasks</h1><span class="sp"></span><span class="stamp ok">approved</span></div><div class="spec">${B.spec()}</div>${state.notes ? "" : askBtn()}</div>`,
        "Spec",
        {
          notes: notesCol(),
          feature: "recurring-tasks",
          step: "Spec",
          sheetNo: "SP-01",
          rev: "02",
          status: '<span class="stamp ok">approved</span>',
        },
      );
    },

    session() {
      shell(
        `<div class="page narrow"><div class="sheet-title"><span class="no">R-1</span><h1>${D.session.title}</h1><span class="sp"></span><small>${D.session.model} · RUNNING 47 MIN</small></div>${B.messages()}
        <div class="sidecard"><h4>Sources</h4>${D.session.side.sources.map((x) => `<div class="r">${icon("search", 14)} ${x}</div>`).join("")}<h4>Files changed</h4>${D.session.side.files.map((x) => `<div class="r">${icon("file", 14)} ${x}</div>`).join("")}<h4>Sub-sessions</h4>${D.session.side.subs.map((x) => `<div class="r">${icon("robot", 14)} ${x}</div>`).join("")}</div>
        <div class="composer" style="position:sticky;bottom:0;margin-top:14px"><input placeholder="Message the agent…"><button class="btn pri">Send</button></div></div>`,
        "Session",
        { feature: "layout-look", step: "Discovery", sheetNo: "R-1" },
      );
    },

    new() {
      const pic = {
        sketch: `<svg viewBox="0 0 130 100" fill="none" stroke-width="2" stroke-dasharray="5 4"><rect x="30" y="14" width="70" height="72"/><path d="M42 34h46M42 48h46M42 62h30"/></svg>`,
        detail: `<svg viewBox="0 0 130 100" fill="none" stroke-width="2"><rect x="20" y="10" width="90" height="80"/><circle cx="75" cy="50" r="22"/><path d="M60 35 40 20M40 20h-14M91 66l16 14"/></svg>`,
        plans: `<svg viewBox="0 0 130 100" fill="none" stroke-width="2"><rect x="30" y="6" width="74" height="64"/><rect x="22" y="16" width="74" height="64"/><rect x="14" y="26" width="74" height="64"/><path d="M26 44h50M26 56h50M26 68h30"/></svg>`,
      };
      shell(
        `<div class="page"><div class="sheet-title"><span class="no">S-04</span><h1>New drawing</h1><span class="sp"></span><small>CHOOSE A SHEET SIZE</small></div>
        <div class="types"><button class="ty" data-go="session/new"><div class="pic">${pic.sketch}</div><h3>Session</h3><span class="sz">Sketch · no sheet</span><p>Just talk to an agent. Nothing is added to specs/.</p><span class="steps">NO BRANCH · NO FILES</span></button>
        <button class="ty" data-go="session/new"><div class="pic">${pic.detail}</div><h3>Change</h3><span class="sz">Detail · one sheet</span><p>A bug fix or a small change, with its own branch and pull request.</p><span class="steps">PROPOSAL → FIX → PULL REQUEST</span></button>
        <button class="ty" data-go="session/new"><div class="pic">${pic.plans}</div><h3>Feature</h3><span class="sz">Plan set · many sheets</span><p>A full proposal: questions, a spec you approve, a plan, then code.</p><span class="steps">PROPOSAL → QUESTIONS → SPEC → PLAN → CODE</span></button></div>
        <p class="hint" style="text-align:center">Change and feature then ask: pick a priority, an inbox note, or a proposal, or write the text right here.</p></div>`,
        "New drawing",
        { sheetNo: "4 / 6" },
      );
    },

    decisions() {
      shell(
        `<div class="page narrow"><div class="sheet-title"><span class="no">S-05</span><h1>General notes · constitution</h1></div><div class="notesgen">
        ${D.constitution.map((p) => `<article class="pr"><span class="pn">${p.n}</span><div><h3>${p.t}</h3><ul>${p.rules.map((r) => `<li>${esc(r).replace(/\b(MUST NOT|MUST|SHOULD|MAY)\b/g, "<b>$1</b>")}</li>`).join("")}</ul><p class="rationale">${esc(p.why)}</p></div></article>`).join("")}</div>
        <div class="sheet-title" style="margin-top:40px"><span class="no">S-05B</span><h1>Decisions register</h1></div><input class="txt" placeholder="Filter the register…" style="margin-bottom:14px"><div class="dlist">${D.decisions.map((d, i) => `<div class="dr"><span class="no">D-${String(i + 1).padStart(2, "0")}</span><b>${d.name}</b><small>${d.rules} rules</small><span class="pill ${d.status === "active" ? "run" : "you"}">${d.status}</span></div>`).join("")}</div></div>`,
        "Constitution and decisions",
        { sheetNo: "5 / 6" },
      );
    },

    settings() {
      shell(
        `<div class="page narrow"><div class="sheet-title"><span class="no">S-06</span><h1>Settings</h1></div><div class="box">${[
          ["Harness", "Claude Code"],
          ["Model", "Opus 5.5"],
          ["Notifications", "off"],
          ["Access key", "••••••••••"],
          ["Repositories", "1"],
        ]
          .map(([a, b]) => `<div class="set"><b>${a}</b><span>${b}</span></div>`)
          .join("")}</div></div>`,
        "Settings",
        { sheetNo: "6 / 6" },
      );
    },
  };

  function render() {
    const [v, a] = route();
    const d = document.getElementById("draw");
    const y = d ? d.scrollTop : 0;
    (views[v] || views.home)(a);
    const d2 = document.getElementById("draw");
    if (d2 && state.keep) d2.scrollTop = y;
  }
  addEventListener("hashchange", () => {
    state.sel = 0;
    state.notes = false;
    state.keep = false;
    render();
  });
  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go],[data-act],[data-sel]");
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
      state.theme = state.theme === "cyan" ? "vellum" : "cyan";
      render();
    } else if (a === "notes") {
      state.notes = !state.notes;
      render();
    } else if (a === "run") {
      state.keep = false;
      go("session/layout-look");
    } else if (t.dataset.sel) {
      state.sel = +t.dataset.sel;
      render();
    } else if (t.dataset.go) {
      state.keep = false;
      go(t.dataset.go);
    }
  });
  render();
})();
