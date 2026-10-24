// The spec's mockup of the questions page: the design round 01 picked, over two real rounds. The bar
// on top picks the round, the scheme, and the frame's width; everything else is the page itself.
(function () {
  const ctl = document.getElementById("ctl");
  const frame = document.getElementById("frame");
  const P = new URLSearchParams(location.search);
  const S = {
    round: P.get("round") || "merge-chats",
    scheme: P.get("scheme") || "mocha",
    w: P.get("w") || "auto",
    tab: P.get("tab") || "outline", // outline | notes | session
    about: null, // { id, title }: what the session was last asked about
    page: P.get("page") === "session", // the phone's session page
    sheet: null, // the phone's sheet: "outline" | "notes"
  };
  const answers = {};
  const comments = {};
  let notes = "";
  let draft = "";
  let sent = [];
  let colWidth = null;
  let todayOpen = false;

  function save() {
    const q = new URLSearchParams({ round: S.round, scheme: S.scheme, w: S.w, tab: S.tab });
    if (S.page) q.set("page", "session");
    history.replaceState(null, "", "?" + q.toString());
  }

  // ---------- helpers ----------
  function icon(name, size = 17, cls = "") {
    const node = window.LUCIDE[name];
    if (!node) return "";
    const inner = node
      .map(
        ([t, a]) =>
          `<${t} ${Object.entries(a)
            .map(([k, v]) => `${k}="${v}"`)
            .join(" ")}/>`,
      )
      .join("");
    return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  }
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function md(s) {
    let h = esc(s);
    h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
    h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    h = h.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="#" title="$2" onclick="return false">$1</a>',
    );
    return h;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function blocks(list) {
    return list
      .map((b) => {
        if (typeof b === "string") return `<p>${md(b)}</p>`;
        if (b.list) return `<ul class="md">${b.list.map((i) => `<li>${md(i)}</li>`).join("")}</ul>`;
        if (b.table) {
          const [head, ...rows] = b.table;
          return `<div class="tablewrap"><table class="md"><tr>${head.map((c) => `<th>${md(c)}</th>`).join("")}</tr>${rows
            .map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join("")}</tr>`)
            .join("")}</table></div>`;
        }
        return "";
      })
      .join("");
  }
  function pane(title, body, cls = "", icn = "", id = "") {
    return `<fieldset class="pane ${cls}" ${id ? `id="${id}"` : ""}><legend>${icn ? icon(icn, 16) : ""}${title}</legend>${body}</fieldset>`;
  }
  const frameWidth = () => (S.w === "auto" ? frame.parentElement.clientWidth : Number(S.w));
  const widthClass = (w) => (w < 768 ? "narrow" : w < 1280 ? "semi" : "wide");
  const R = () => window.ROUNDS[S.round];
  const nav = () => R().questions;
  const isAnswered = (q) => (answers[q.id] && answers[q.id].size) || (comments[q.id] || "").trim();
  const nextBlank = () => nav().find((q) => !isAnswered(q));
  // The column's one width, whatever its tab: a third of the window, 400 to 600 px, or as dragged.
  const columnWidth = (fw) => colWidth || Math.round(Math.max(400, Math.min(600, fw / 3)));

  // ---------- the shell ----------
  function leftShell(cls) {
    if (cls === "narrow") {
      return `<nav class="left">
        ${icon("house", 20)}<span class="badge-n">${icon("inbox", 20)}<i>10</i></span>${icon("list", 20)}
        <span class="badge-n">${icon("activity", 20)}<i>1</i></span>${icon("scale", 20)}${icon("settings", 20)}
        <span class="btn primary" style="padding:4px 8px">${icon("plus", 18)}</span></nav>`;
    }
    if (cls === "semi") {
      return `<nav class="left"><span class="c-green">${icon("git-branch", 22)}</span><span class="c-mauve">${icon("plus", 20)}</span>
        ${icon("pencil", 18)}${icon("house", 20)}${icon("inbox", 20)}${icon("list", 20)}${icon("scale", 20)}
        <span class="c-peach">${icon("message-square", 20)}</span>${icon("activity", 20)}</nav>`;
    }
    return `<nav class="left">
      <div class="brand"><span class="c-green">${icon("git-branch", 24)}</span><div>Uraeda<small>uraeda</small></div></div>
      <div class="btnrow"><span class="btn primary">${icon("plus", 15)} New</span><span class="btn">${icon("pencil", 15)} Note</span></div>
      ${pane(
        "Navigate",
        `<div class="navrow"><span>${icon("house")} Home</span></div>
         <div class="navrow"><span>${icon("inbox")} Inbox</span><span class="count">10</span></div>
         <div class="navrow"><span>${icon("list")} Priorities</span><span class="count">4</span></div>
         <div class="navrow"><span>${icon("scale")} Decisions</span></div>`,
      )}
      ${pane(
        "Needs you · 2",
        `<div class="card on"><div class="t">${icon("message-square", 16)} ${esc(R().feature)}</div><div class="s">Questions to answer</div></div>
         <div class="card"><div class="t">${icon("file-text", 16)} Spec and plan pages</div><div class="s">Spec to review</div></div>`,
        "attn",
      )}
      ${pane("In progress · 1", `<div class="card"><div class="t">${icon("activity", 16)} Lists and starts</div><div class="s">Implementation · 4/11</div></div>`)}
    </nav>`;
  }

  // ---------- the opening ----------
  function opening(cls, pageW) {
    const r = R();
    const c = r.context;
    const verdictText = md(
      r.block.verdict[1].replace(
        /^worth building, with changes: |^worth building as proposed: |^not as proposed: /,
        "",
      ),
    );
    const badge = {
      "with changes": ["", "With changes"],
      "as proposed": ["yes", "As proposed"],
      not: ["no", "Not as proposed"],
    }[r.block.verdict[0]];
    const two = pageW >= 820;
    const today = `<fieldset class="pane" id="ctx-today"><legend><button class="fold" data-fold="today">${icon(todayOpen ? "chevron-down" : "chevron-right", 15)} ${icon("history", 16)} Today</button>${
      todayOpen ? "" : `<span class="c-dim folded-hint">folded</span>`
    }</legend>${todayOpen ? `<div class="prose">${blocks(c.today)}</div>` : ""}</fieldset>`;
    return `<div class="crumbs">Home › ${esc(r.feature)} › <b>clarifications-01.md</b></div><h1>${esc(r.title)}</h1>
      ${r.excerpt ? `<p class="c-dim" style="font-size:14.4px;margin:-8px 0 14px">${esc(r.excerpt)}</p>` : ""}
      <fieldset class="pane brief" id="intro"><legend>${icon("triangle-alert", 16)} ${md(r.block.first)}</legend>
        <div class="verdict"><span class="vbadge ${badge[0]}">${badge[1]}</span><div class="prose" style="font-size:18.5px">${verdictText}</div></div>
        <div class="prose"><ul class="md">${r.block.items.map((i) => `<li>${md(i)}</li>`).join("")}</ul></div>
      </fieldset>
      ${pane("Goal", `<div class="prose">${blocks(c.goal)}</div>`, "goal", "target", "ctx-goal")}
      ${today}
      <div class="parts ${two ? "two" : ""}">
        ${pane("Scope", `<div class="prose">${blocks(c.scope)}</div>`, "", "crop", "ctx-scope")}
        ${pane("Sources", `<div class="prose">${blocks(c.sources)}</div>`, "src", "book-open", "ctx-sources")}
      </div>
      ${checkPane()}`;
  }
  function points(list, prefix) {
    return list
      .map(
        ([subj, text], i) =>
          `<div class="pt-row"><div class="prose"><p><strong>${md(subj)}</strong> ${md(text)}</p></div>
          <span class="pt-actions"><button class="btn ghost small" data-ask-point="${prefix}${i}" title="Ask the agent about this point">${icon("message-square", 14)} Ask</button><button class="btn ghost small" title="Comment on this point">${icon("pencil", 14)}</button></span></div>`,
      )
      .join("");
  }
  function checkPane() {
    const s = R().settled;
    if (!s.check.length) return "";
    return `<fieldset class="pane attn checkpane" id="check"><legend>${icon("flag", 17)} Check these · ${s.check.length}</legend>
      <p class="c-dim pane-lead">Settled without you. Object here before answering, if one is wrong.</p>${points(s.check, "c")}</fieldset>`;
  }

  // ---------- a question ----------
  function option(q, o, cls) {
    const on = answers[q.id] && answers[q.id].has(o.l);
    const pts = [
      ...(o.pro || []).map((p) => ["+", "pro", p]),
      ...(o.con || []).map((p) => ["−", "con", p]),
      ...(o.why ? [["★", "why", "Why recommended: " + o.why]] : []),
    ];
    const ptsHtml =
      cls === "narrow"
        ? pts
            .map(
              ([g, k, t]) =>
                `<fieldset class="ptbox ${k}"><legend>${g}</legend><span>${md(t)}</span></fieldset>`,
            )
            .join("")
        : `<ul class="pts">${pts.map(([g, k, t]) => `<li><b class="g-${k}">${g}</b>${md(t)}</li>`).join("")}</ul>`;
    return `<fieldset class="opt ${on ? "on" : ""} ${o.rec ? "recommended" : ""}" data-q="${q.id}" data-l="${o.l}" role="button" tabindex="0">
      <legend><span class="letter">${o.l}</span>${o.rec ? `<span class="rec">★ Recommended</span>` : ""}${on ? `<span class="picked">picked</span>` : ""}</legend>
      <div class="osum">${md(o.s)}</div>${ptsHtml}</fieldset>`;
  }
  function card(q, cls) {
    const meta = q.parent ? `${q.id} · follows ${q.parent}, because you picked ${q.letter}` : q.id;
    return `<div class="qcard ${q.parent ? "fu" : ""}" data-card="${q.id}">
      <div class="qhead sticky" data-head="${q.id}">
        <div class="qmeta"><span class="id">${meta}</span><button class="btn ghost small" data-ask="${q.id}">${icon("message-square", 14)} Ask the agent</button></div>
        <h2 class="qtitle">${md(q.title)}</h2></div>
      <div class="qbody">
        ${q.example ? `<fieldset class="pane ex"><legend>${icon("flask-conical", 15)} Example</legend><div class="prose"><p>${md(cap(q.example))}</p></div></fieldset>` : ""}
        <div class="prose">${q.context.map((p) => `<p>${md(p)}</p>`).join("")}</div>
        <fieldset class="pane why"><legend>${icon("lightbulb", 15)} Why it matters</legend><div class="prose"><p>${md(cap(q.why))}</p></div></fieldset>
        <div class="opts">${q.options.map((o) => option(q, o, cls)).join("")}</div>
        <div class="comment"><label>Comment, or your own answer instead of a letter</label>
          <textarea data-c="${q.id}">${esc(comments[q.id] || "")}</textarea>
          <div class="row"><span class="btn small">${icon("paperclip", 13)} Add image</span><span class="btn small">Save comment</span><span>Ctrl+Enter saves</span></div></div>
      </div></div>`;
  }
  function questions(cls) {
    let out = "";
    for (const q of nav()) {
      if (q.parent) continue;
      out += `<section class="qsec" id="${q.id}">${card(q, cls)}`;
      for (const f of nav().filter((x) => x.parent === q.id)) {
        out += `${cls === "narrow" ? "" : `<div class="joint"></div>`}<section class="fu-wrap" id="${f.id}">${card(f, cls)}</section>`;
      }
      out += `</section>`;
    }
    return out;
  }
  function settled() {
    const s = R().settled;
    return `<section id="settled"><h2 class="sec">Settled without you</h2>
      ${pane(`Behaviour · ${s.behaviour.length}`, points(s.behaviour, "b"), "", "eye", "settled-behaviour")}
      <fieldset class="pane hoodpane" id="settled-hood"><legend>${icon("wrench", 16)} Under the hood · ${s.hood.length}</legend>
        <details><summary>${s.hood.length} choices in the code only</summary>${points(s.hood, "h")}</details></fieldset></section>`;
  }
  function ending(cls) {
    const left = nav().filter((q) => !isAnswered(q));
    return `<section id="end"><h2 class="sec">Notes</h2>
      <div class="notes-read">${notes.trim() ? `<div class="prose"><p>${md(notes)}</p></div>` : `<p class="c-dim">No notes yet. Write one from anywhere: the Notes ${cls === "narrow" ? "button below" : "tab of the column"}.</p>`}
        <button class="btn small" data-notes="1">${icon("pencil", 13)} ${notes.trim() ? "Edit notes" : "Write a note"}</button></div>
      ${left.length ? `<div class="left-q">✗ ${left.length} questions left: ${left.map((q) => q.id).join(", ")}</div>` : ""}
      <div class="submit"><span class="btn primary">Commit and start the agent</span><span class="btn">Commit only</span></div></section>`;
  }

  // ---------- the column's three tabs ----------
  function outline() {
    const qs = nav();
    const done = qs.filter(isAnswered).length;
    const nb = nextBlank();
    const s = R().settled;
    const row = (id, label, cls = "", st = "") =>
      `<a href="#" data-jump="${id}" class="${cls}"><span class="st">${st}</span><span>${label}</span></a>`;
    return `<div class="progress"><span>${done} of ${qs.length} answered</span>${
      nb
        ? `<span class="btn primary small" data-jump="${nb.id}">Next</span>`
        : `<span class="btn primary small" data-jump="end">Submit</span>`
    }</div><div class="bar"><i style="width:${(100 * done) / qs.length}%"></i></div>
      <div class="ol">
        ${row("intro", "Verdict and summary", "sec", "!")}
        ${row("ctx-goal", "Goal", "sec sub", "·")}${row("ctx-today", "Today", "sec sub", "·")}${row("ctx-scope", "Scope", "sec sub", "·")}${row("ctx-sources", "Sources", "sec sub", "·")}
        ${s.check.length ? row("check", `Check these · ${s.check.length}`, "sec warn", "⚑") : ""}
        <hr/>
        ${qs.map((q) => row(q.id, `<b>${q.id}</b> ${md(q.title)}`, q.parent ? "fu" : "", isAnswered(q) ? "✓" : "○").replace('class="st">✓', 'class="st ok">✓')).join("")}
        <hr/>
        ${row("settled-behaviour", `Behaviour · ${s.behaviour.length}`, "sec", "·")}
        ${row("settled-hood", `Under the hood · ${s.hood.length}`, "sec", "·")}
        ${row("end", "Notes and submit", "sec", "✎")}
      </div>
      <div class="hint"><kbd class="c-peach">n</kbd> <kbd class="c-peach">p</kbd> next / previous unanswered</div>`;
  }
  function notesPane() {
    return `<div class="notes-pane"><label class="c-dim">Anything else: notes for the agent, on any part of the round</label>
      <textarea id="notes">${esc(notes)}</textarea>
      <div class="row"><span class="btn small">${icon("paperclip", 13)} Add image</span><span class="btn small" id="save-notes">Save notes</span><span>Ctrl+Enter saves</span></div>
      <p class="c-dim" style="font-size:14px">The same notes as at the round's end. They stay while you scroll, and save with their button or Submit.</p></div>`;
  }
  function session() {
    const first = nav().find((x) => x.id === "Q2") || nav()[0];
    const about = S.about || { id: first.id, title: first.title };
    const history = [
      {
        who: "user",
        quote: `About ${first.id} of clarifications-01.md:`,
        line: first.title,
        text: window.SESSION.first[S.round],
      },
      ...window.SESSION.answer(first, S.round),
      ...sent,
    ];
    const msgs = history
      .map((m) => {
        if (m.who === "user")
          return `<div class="msg user"><div class="who">You</div><div class="prose" style="font-size:16px">${md(m.quote)}<blockquote>${md(m.line)}</blockquote><p>${md(m.text)}</p></div></div>`;
        if (m.who === "tool")
          return `<div class="msg tool">${icon("file-text", 14)}<span>${md(m.text)}</span></div>`;
        return `<div class="msg agent prose"><p style="font-size:17px">${md(m.text)}</p></div>`;
      })
      .join("");
    return `<div class="sess">
      <div class="sess-head"><span class="dot"></span><b>${esc(R().folder.slice(11))}</b><span>${icon("bot", 14)} ${window.SESSION.harness} · waits on you</span><span class="sp"></span><span class="btn ghost small" title="Open the session's page">${icon("panel-left", 14)} Page</span></div>
      <div class="about" data-jump="${about.id}" title="Back to it in the round">${icon("message-square", 15)}<span>Asking about <b>${md(about.id)}</b> · ${md(about.title)}</span></div>
      <div class="msgs" id="msgs">${msgs}</div>
      <div class="composer"><textarea id="draft" placeholder="Ask the agent…">${esc(draft)}</textarea>
        <div class="row"><span>Ctrl+Enter sends · the agent answers here; the round stays as it is</span><span class="btn primary small" id="send">${icon("send", 13)} Send</span></div></div></div>`;
  }
  function rightColumn(cls, fw) {
    if (cls === "narrow") return { html: "", width: 0 };
    const w = columnWidth(fw);
    const tab = (k, ic, label, extra = "") =>
      `<button class="tab ${S.tab === k ? "on" : ""}" data-tab="${k}" role="tab" aria-selected="${S.tab === k}">${icon(ic, 15)} ${label}${extra}</button>`;
    const body =
      S.tab === "session"
        ? session()
        : S.tab === "notes"
          ? `<div class="col-body">${notesPane()}</div>`
          : `<div class="col-body">${outline()}</div>`;
    return {
      width: w,
      html: `<aside class="right" style="width:${w}px"><div class="drag" title="Drag to resize"></div>
        <div class="tabs" role="tablist" aria-label="The round's column">
          ${tab("outline", "list-tree", "Outline", ` <small class="c-dim">${nav().filter(isAnswered).length}/${nav().length}</small>`)}
          ${tab("notes", "pencil", "Notes", notes.trim() ? ` <span class="dot" style="background:var(--peach)"></span>` : "")}
          ${tab("session", "message-square", "Session", ` <span class="dot"></span>`)}
        </div>${body}</aside>`,
    };
  }

  // ---------- the whole page ----------
  function render() {
    save();
    document.documentElement.dataset.scheme = S.scheme;
    const fw = frameWidth();
    frame.style.width = S.w === "auto" ? "100%" : S.w + "px";
    const cls = widthClass(fw);
    const oldPage = frame.querySelector(".page");
    const scroll = oldPage ? oldPage.scrollTop : 0;
    const right = rightColumn(cls, fw);
    const pageW = fw - (cls === "wide" ? 256 : cls === "semi" ? 52 : 0) - right.width;
    const nb = nextBlank();
    const status =
      cls === "narrow"
        ? `<div class="status"><span class="btn ghost small" data-sheet="outline">${icon("list-tree", 14)} ${nav().filter(isAnswered).length}/${nav().length}</span><span class="btn ghost small" data-sheet="notes">${icon("pencil", 14)} Notes</span><span class="btn primary small" data-jump="${nb ? nb.id : "end"}">${nb ? "Next" : "Submit"}</span></div>`
        : `<div class="status"><span><kbd>n p</kbd> unanswered · ${cls === "wide" ? "<kbd>[</kbd> fold · " : ""}<kbd>]</kbd> column</span><span><span class="need">2 need you</span> · ${icon("activity", 14)} 1 running</span></div>`;
    const phoneSession =
      cls === "narrow" && S.page
        ? `<div class="phone-layer"><div class="back" data-back="1">‹ Back to the round</div>${session()}</div>`
        : "";
    const sheet =
      cls === "narrow" && S.sheet
        ? `<div class="scrim" data-sheet-close="1"></div><div class="sheet"><div class="sheet-head"><b>${S.sheet === "notes" ? "Notes" : "Outline"}</b><button class="btn ghost small" data-sheet-close="1">${icon("x", 14)}</button></div>${S.sheet === "notes" ? notesPane() : outline()}</div>`
        : "";
    frame.innerHTML = `<div class="app ${cls}">
      ${leftShell(cls)}
      <div class="work-wrap"><div class="work"><main class="page"><div class="page-in ${cls === "narrow" ? "tight" : ""}">
        ${opening(cls, pageW)}${questions(cls)}${settled()}${ending(cls)}
      </div></main>${right.html}</div></div>
      ${status}${phoneSession}${sheet}</div>`;
    const page = frame.querySelector(".page");
    page.style.scrollBehavior = "auto";
    page.scrollTop = scroll;
    page.style.scrollBehavior = "";
    page.addEventListener("scroll", spy, { passive: true });
    spy();
    const msgs = frame.querySelector("#msgs");
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    wire();
  }

  // The part at the top: its card and its outline row marked, its sticky header marked stuck.
  function spy() {
    const page = frame.querySelector(".page");
    if (!page) return;
    const top = page.getBoundingClientRect().top;
    let cur = null;
    page.querySelectorAll("[id]").forEach((el) => {
      if (
        frame.querySelector(`.ol a[data-jump="${el.id}"]`) &&
        el.getBoundingClientRect().top <= top + 40
      )
        cur = el.id;
    });
    frame
      .querySelectorAll(".qcard")
      .forEach((c) => c.classList.toggle("cur", c.dataset.card === cur));
    frame
      .querySelectorAll(".ol a[data-jump]")
      .forEach((a) => a.classList.toggle("cur", a.dataset.jump === cur));
    frame.querySelectorAll(".qhead.sticky").forEach((h) => {
      const card = h.closest(".qcard").getBoundingClientRect();
      h.classList.toggle("stuck", card.top < top - 2 && card.bottom > top + 60);
    });
    window.__cur = nav().some((q) => q.id === cur) ? cur : window.__cur;
  }
  function jump(id) {
    const el = frame.querySelector("#" + CSS.escape(id));
    const page = frame.querySelector(".page");
    if (!el || !page) return;
    if (id === "ctx-today" && !todayOpen) {
      todayOpen = true;
      render();
      return jump(id);
    }
    page.scrollTop += el.getBoundingClientRect().top - page.getBoundingClientRect().top - 4;
  }
  function ask(about) {
    S.about = about;
    draft =
      `About ${about.id} of clarifications-01.md:\n> ${about.title}\n\n` +
      (draft.includes("\n\n") ? draft.split("\n\n").slice(1).join("\n\n") : draft);
    if (widthClass(frameWidth()) === "narrow") S.page = true;
    else S.tab = "session";
    render();
    const d = frame.querySelector("#draft");
    if (d) {
      d.focus();
      d.selectionStart = d.selectionEnd = d.value.length;
    }
  }
  function send() {
    const d = frame.querySelector("#draft");
    const lines = (d ? d.value : draft).split("\n");
    const text = lines
      .filter((l) => !l.startsWith("About ") && !l.startsWith("> "))
      .join(" ")
      .trim();
    const about = S.about || { id: "Q2", title: "" };
    sent.push({
      who: "user",
      quote: `About ${about.id} of clarifications-01.md:`,
      line: about.title,
      text: text || "What would you pick if you were me?",
    });
    sent.push({
      who: "agent",
      text: `I would keep it as written: nothing in the discovery argues against it, and changing it now would move ${esc(about.id)} out of the proposal's scope.`,
    });
    draft = "";
    render();
  }
  function wire() {
    const on = (sel, ev, fn) =>
      frame.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)));
    on(".opt", "click", (b) => {
      const set = (answers[b.dataset.q] ||= new Set());
      set.has(b.dataset.l) ? set.delete(b.dataset.l) : set.add(b.dataset.l);
      render();
    });
    on("textarea[data-c]", "input", (t) => (comments[t.dataset.c] = t.value));
    on("[data-ask]", "click", (b) => {
      const q = nav().find((x) => x.id === b.dataset.ask);
      ask({ id: q.id, title: q.title });
    });
    on("[data-ask-point]", "click", (b) => {
      const k = b.dataset.askPoint;
      const s = R().settled;
      const list = { c: s.check, b: s.behaviour, h: s.hood }[k[0]];
      const [subj] = list[Number(k.slice(1))];
      ask({ id: "a settled point", title: subj.replace(/[.,]$/, "") });
    });
    on("[data-jump]", "click", (a, e) => {
      e.preventDefault();
      e.stopPropagation();
      const go = a.dataset.jump;
      if (S.page || S.sheet) {
        S.page = false;
        S.sheet = null;
        render();
      }
      jump(go);
    });
    on("[data-tab]", "click", (b) => {
      S.tab = b.dataset.tab;
      render();
    });
    on("[data-fold]", "click", () => {
      todayOpen = !todayOpen;
      render();
    });
    on("[data-notes]", "click", () => {
      if (widthClass(frameWidth()) === "narrow") S.sheet = "notes";
      else S.tab = "notes";
      render();
      const n = frame.querySelector("#notes");
      if (n) n.focus();
    });
    on("[data-sheet]", "click", (b) => {
      S.sheet = b.dataset.sheet;
      render();
    });
    on("[data-sheet-close]", "click", () => {
      S.sheet = null;
      render();
    });
    on("[data-back]", "click", () => {
      S.page = false;
      render();
    });
    on("#notes", "input", (t) => (notes = t.value));
    on("#save-notes", "click", () => render());
    on("#draft", "input", (d) => (draft = d.value));
    on("#draft", "keydown", (d, e) => e.key === "Enter" && e.ctrlKey && send());
    on("#send", "click", send);
    on(".drag", "pointerdown", (drag, e) => {
      const aside = drag.parentElement;
      const startX = e.clientX;
      const startW = aside.getBoundingClientRect().width;
      const move = (ev) => {
        colWidth = Math.max(360, Math.min(720, startW + (startX - ev.clientX)));
        aside.style.width = colWidth + "px";
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        render();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  // n and p, as today.
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("textarea, select, input")) return;
    const qs = nav();
    const at = qs.findIndex((q) => q.id === window.__cur);
    if (e.key === "n") {
      const t = qs.find((q, i) => i > at && !isAnswered(q)) || nextBlank();
      if (t) jump(t.id);
    } else if (e.key === "p") {
      const t = qs
        .slice(0, Math.max(at, 0))
        .reverse()
        .find((q) => !isAnswered(q));
      if (t) jump(t.id);
    }
  });

  // ---------- the mockup's bar ----------
  const select = (key, label, opts) =>
    `<label>${label}<select data-k="${key}">${opts.map(([v, t]) => `<option value="${v}" ${S[key] === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  ctl.innerHTML = `<span class="tag">Mockup</span>
    ${select("round", "Round", [
      ["merge-chats", "merge-chats 01"],
      ["layout-look", "layout-look 01 (Q4, Q5)"],
    ])}
    ${select("scheme", "Scheme", [
      ["mocha", "Mocha"],
      ["latte", "Latte"],
    ])}
    ${select("w", "Width", [
      ["auto", "auto"],
      ["1440", "1440 wide"],
      ["1205", "1205 half"],
      ["960", "960 semi"],
      ["390", "390 phone"],
    ])}`;
  ctl.querySelectorAll("select").forEach((s) =>
    s.addEventListener("change", () => {
      S[s.dataset.k] = s.value;
      colWidth = null;
      render();
    }),
  );
  window.addEventListener("resize", render);
  render();
})();
