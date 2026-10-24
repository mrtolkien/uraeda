// The questions page, drawn from one state object kept in the address. The bar on top picks the
// round, the scheme, the frame's width, and one variant per question of round 01.
(function () {
  const ctl = document.getElementById("ctl");
  const frame = document.getElementById("frame");
  const P = new URLSearchParams(location.search);
  const S = {
    round: P.get("round") || "merge-chats",
    scheme: P.get("scheme") || "mocha",
    w: P.get("w") || "auto",
    session: P.get("session") || "tabs", // tabs | stack | split
    semi: P.get("semi") || "push", // push | cover
    look: P.get("look") || "panes", // panes | gutter | plain
    sticky: P.get("sticky") || "bar", // bar | split | none
    check: P.get("check") || "pane", // pane | first | plain
    lists: P.get("lists") || "tight", // tight | today
    open: P.get("open") === "1",
    tab: P.get("tab") || "outline",
    about: P.get("about") || "",
    ask: P.get("ask") || "question", // question | selection
  };
  const answers = {};
  const comments = {};
  let sent = [];
  let draft = "";
  let sheet = false;
  let colWidth = null;
  let outlineOpen = false;

  const KEYS = [
    "round",
    "scheme",
    "w",
    "session",
    "semi",
    "look",
    "sticky",
    "check",
    "lists",
    "ask",
  ];
  function save() {
    const q = new URLSearchParams();
    for (const k of KEYS) q.set(k, S[k]);
    if (S.open) {
      q.set("open", "1");
      q.set("tab", S.tab);
      if (S.about) q.set("about", S.about);
    }
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
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
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
  function pane(title, body, cls = "", icn = "") {
    return `<fieldset class="pane ${cls}"><legend>${icn ? icon(icn, 16) : ""}${title}</legend>${body}</fieldset>`;
  }

  // ---------- the width classes ----------
  function frameWidth() {
    return S.w === "auto" ? frame.parentElement.clientWidth : Number(S.w);
  }
  function widthClass(w) {
    return w < 768 ? "narrow" : w < 1280 ? "semi" : "wide";
  }

  // ---------- the round ----------
  const R = () => window.ROUNDS[S.round];
  const nav = () => R().questions;
  const isAnswered = (q) => (answers[q.id] && answers[q.id].size) || (comments[q.id] || "").trim();

  // ---------- the shell ----------
  function leftShell(cls) {
    if (cls === "narrow") {
      return `<nav class="left">
        ${icon("house", 20)}
        <span class="badge-n">${icon("inbox", 20)}<i>10</i></span>
        ${icon("list", 20)}
        <span class="badge-n">${icon("activity", 20)}<i>1</i></span>
        ${icon("scale", 20)}
        ${icon("settings", 20)}
        <span class="btn primary" style="padding:4px 8px">${icon("plus", 18)}</span>
      </nav>`;
    }
    if (cls === "semi") {
      return `<nav class="left">
        <span class="c-green">${icon("git-branch", 22)}</span>
        <span class="c-mauve">${icon("plus", 20)}</span>
        ${icon("pencil", 18)}
        ${icon("house", 20)}
        ${icon("inbox", 20)}
        ${icon("list", 20)}
        ${icon("scale", 20)}
        <span class="c-peach">${icon("message-square", 20)}</span>
        ${icon("activity", 20)}
      </nav>`;
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
      ${pane(
        "In progress · 1",
        `<div class="card"><div class="t">${icon("activity", 16)} Lists and starts</div><div class="s">Implementation · 4/11</div></div>`,
      )}
    </nav>`;
  }

  // ---------- the opening ----------
  function verdictBadge() {
    const v = R().block.verdict[0];
    const cls = v === "as proposed" ? "yes" : v === "not" ? "no" : "";
    return `<span class="vbadge ${cls}">${v === "with changes" ? "With changes" : v}</span>`;
  }
  function opening(cls) {
    const r = R();
    const head = `<div class="crumbs">Home › ${esc(r.feature)} › <b>clarifications-01.md</b></div><h1>${esc(r.title)}</h1>`;
    const excerpt = r.excerpt
      ? `<p class="c-dim" style="font-size:14.4px;margin:-8px 0 14px">${esc(r.excerpt)}</p>`
      : "";
    const c = r.context;
    const verdictText = md(
      r.block.verdict[1].replace(
        /^worth building, with changes: |^worth building as proposed: |^not as proposed: /,
        "",
      ),
    );
    if (S.look === "plain") {
      return `${head}${excerpt}
        <div class="callout prose"><div class="ct">Important</div><p>${md(r.block.first)}</p>
          <ul class="md"><li>Verdict: ${md(r.block.verdict[1])}</li>${r.block.items.map((i) => `<li>${md(i)}</li>`).join("")}</ul></div>
        <section id="ctx"><h3 class="part">Goal</h3><div class="prose">${blocks(c.goal)}</div>
        <h3 class="part">Today</h3><div class="prose">${blocks(c.today)}</div>
        <h3 class="part">Scope</h3><div class="prose">${blocks(c.scope)}</div>
        <h3 class="part">Sources</h3><div class="prose">${blocks(c.sources)}</div></section>`;
    }
    if (S.look === "gutter") {
      const row = (sign, color, label, body) =>
        `<div class="g"><div class="sign ${color}">${sign}</div><div>${label ? `<div class="glabel ${color}">${label}</div>` : ""}<div class="prose">${body}</div></div></div>`;
      return `${head}${excerpt}
        <div class="g"><div class="sign c-mauve">!</div><div><div class="first">${md(r.block.first)}</div></div></div>
        <div class="g" style="margin:6px 0 4px"><div class="sign c-yellow">◆</div><div class="verdict" style="border:0;padding:0;margin:0">${verdictBadge()}<span class="prose" style="font-size:18px">${verdictText}</span></div></div>
        ${r.block.items.map((i) => row("›", "c-mauve", "", `<p>${md(i)}</p>`)).join("")}
        <section id="ctx" style="margin-top:10px">
        ${row(icon("target", 16), "c-lav", "Goal", blocks(c.goal))}
        ${row(icon("history", 16), "c-lav", "Today", blocks(c.today))}
        ${row(icon("crop", 16), "c-lav", "Scope", blocks(c.scope))}
        ${row(icon("book-open", 16), "c-dim", "Sources", blocks(c.sources))}</section>`;
    }
    // panes
    const two = cls === "wide" && !S.open;
    return `${head}${excerpt}
      <fieldset class="pane brief"><legend>${icon("triangle-alert", 16)} ${md(r.block.first)}</legend>
        <div class="verdict">${verdictBadge()}<div class="prose" style="font-size:18.5px">${verdictText}</div></div>
        <div class="prose"><ul class="md">${r.block.items.map((i) => `<li>${md(i)}</li>`).join("")}</ul></div>
      </fieldset>
      <section id="ctx" class="parts ${two ? "two" : ""}" style="margin-top:6px">
        ${pane("Goal", `<div class="prose">${blocks(c.goal)}</div>`, "goal span", "target")}
        ${pane("Today", `<div class="prose">${blocks(c.today)}</div>`, "span", "history")}
        ${pane("Scope", `<div class="prose">${blocks(c.scope)}</div>`, "", "crop")}
        ${pane("Sources", `<div class="prose">${blocks(c.sources)}</div>`, "src", "book-open")}
      </section>`;
  }

  // ---------- a question ----------
  function exampleBlock(q) {
    if (!q.example) return "";
    if (S.look === "panes")
      return `<fieldset class="pane ex"><legend>${icon("flask-conical", 15)} Example</legend><div class="prose"><p>${md(cap(q.example))}</p></div></fieldset>`;
    if (S.look === "gutter")
      return `<div class="g"><div class="sign c-teal">${icon("flask-conical", 15)}</div><div class="prose"><p><b class="c-teal">Example:</b> ${md(q.example)}</p></div></div>`;
    return `<div class="prose"><p>Example: ${md(q.example)}</p></div>`;
  }
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function whyBlock(q) {
    if (S.look === "panes")
      return `<fieldset class="pane why"><legend>${icon("lightbulb", 15)} Why it matters</legend><div class="prose"><p>${md(cap(q.why))}</p></div></fieldset>`;
    if (S.look === "gutter")
      return `<div class="g"><div class="sign c-peach">${icon("lightbulb", 15)}</div><div class="prose"><p><b class="c-peach">Why it matters:</b> ${md(q.why)}</p></div></div>`;
    return `<div class="why-plain prose"><p><span class="lbl">Why it matters:</span> ${md(q.why)}</p></div>`;
  }
  function contextBlocks(q) {
    if (S.look === "gutter")
      return q.context
        .map(
          (p) =>
            `<div class="g"><div class="sign c-dim">·</div><div class="prose"><p>${md(p)}</p></div></div>`,
        )
        .join("");
    return `<div class="prose">${q.context.map((p) => `<p>${md(p)}</p>`).join("")}</div>`;
  }
  function option(q, o) {
    const on = answers[q.id] && answers[q.id].has(o.l);
    return `<button class="opt ${on ? "on" : ""}" data-q="${q.id}" data-l="${o.l}">
      ${o.rec ? `<div class="rec">★ Recommended</div>` : ""}
      <div class="ohead"><span class="letter">${o.l}</span><span class="osum">${md(o.s)}</span></div>
      <ul class="pts">
        ${(o.pro || []).map((p) => `<li><b class="c-green">+</b>${md(p)}</li>`).join("")}
        ${(o.con || []).map((p) => `<li><b style="color:var(--red)">−</b>${md(p)}</li>`).join("")}
        ${o.why ? `<li><b class="c-yellow">★</b>Why recommended: ${md(o.why)}</li>` : ""}
      </ul></button>`;
  }
  function card(q, cls, cardWidth) {
    const meta = q.parent ? `${q.id} · follows ${q.parent}, because you picked ${q.letter}` : q.id;
    const askBtn =
      S.ask === "question" || S.ask === "both"
        ? `<button class="btn ghost small" data-ask="${q.id}">${icon("message-square", 14)} Ask the agent</button>`
        : `<button class="btn ghost small" data-ask="${q.id}">${icon("message-square", 14)} Ask</button>`;
    const stickyHead =
      S.sticky === "bar" ||
      (S.sticky === "split" && (cls !== "wide" || cardWidth < 760)) ||
      cls === "narrow";
    const head = `<div class="qhead ${stickyHead ? "sticky" : ""}" data-head="${q.id}">
        <div class="qmeta"><span class="id">${meta}</span>${askBtn}</div>
        <h2 class="qtitle" id="${q.id}-title">${md(q.title)}</h2></div>`;
    const ctx = `${exampleBlock(q)}${contextBlocks(q)}${whyBlock(q)}`;
    const answering = `<div class="opts">${q.options.map((o) => option(q, o)).join("")}</div>
      <div class="comment"><label>Comment, or your own answer instead of a letter</label>
      <textarea data-c="${q.id}">${esc(comments[q.id] || "")}</textarea>
      <div class="row"><span class="btn small">${icon("paperclip", 13)} Add image</span><span class="btn small">Save comment</span><span>Ctrl+Enter saves</span></div></div>`;
    const split = cls === "wide" && cardWidth >= 760 && S.sticky !== "bar";
    const body = split
      ? `<div class="qgrid"><div class="lcol ${S.sticky === "split" ? "sticky" : ""}" style="${S.sticky === "split" ? "position:sticky;top:0" : ""}">${head}<div class="qbody">${ctx}</div></div><div class="qbody" style="padding-top:18px">${answering}</div></div>`
      : `${head}<div class="qbody">${ctx}${answering}</div>`;
    return `<div class="qcard" data-card="${q.id}">${body}</div>`;
  }
  function questions(cls, pageWidth) {
    const cardWidth = Math.min(pageWidth - 64, 75 * 10.1 + 64);
    let out = "";
    for (const q of nav()) {
      if (q.parent) continue;
      out += `<section class="qsec" id="${q.id}">${card(q, cls, cardWidth)}`;
      for (const f of nav().filter((x) => x.parent === q.id)) {
        out += `<div class="joint"></div><section class="fu-wrap" id="${f.id}">${card(f, cls, cardWidth - 28)}</section>`;
      }
      out += `</section>`;
    }
    return out;
  }

  // ---------- settled points ----------
  function points(list, cls = "") {
    return list
      .map(
        ([subj, text]) =>
          `<div class="pt-row ${cls}"><div class="prose"><p><strong>${md(subj)}</strong> ${md(text)}</p></div><button class="btn ghost small" title="Comment on this point">${icon("message-square", 14)}</button></div>`,
      )
      .join("");
  }
  function checkPane(first) {
    const s = R().settled;
    return `<fieldset class="pane attn checkpane" ${first ? 'id="check"' : ""}><legend>${icon("flag", 17)} ${first ? "Check these before the questions" : "Check these"} · ${s.check.length}</legend>${points(s.check)}</fieldset>`;
  }
  function settled() {
    const s = R().settled;
    if (S.check === "plain") {
      const grp = (t, l, ic) =>
        `<h3 class="part">${icon(ic, 17)} ${t}</h3><div class="prose"><ul class="md">${l.map(([a, b]) => `<li><strong>${md(a)}</strong> ${md(b)}</li>`).join("")}</ul></div>`;
      return `<section id="settled"><h2 class="sec">Settled without you</h2>${grp("Check these", s.check, "flag")}${grp("Behaviour", s.behaviour, "eye")}${grp("Under the hood", s.hood, "wrench")}</section>`;
    }
    return `<section id="settled"><h2 class="sec">Settled without you</h2>
      ${S.check === "pane" ? checkPane(false) : ""}
      ${pane(`Behaviour · ${s.behaviour.length}`, points(s.behaviour), "", "eye")}
      <fieldset class="pane hoodpane"><legend>${icon("wrench", 16)} Under the hood · ${s.hood.length}</legend>
        <details><summary>${s.hood.length} choices in the code only</summary>${points(s.hood)}</details></fieldset>
    </section>`;
  }
  function ending() {
    const left = nav().filter((q) => !isAnswered(q));
    return `<section id="end" class="notes"><h2 class="sec">Notes</h2>
      <label class="c-dim" style="font-size:14.4px">Anything else</label><textarea></textarea>
      ${left.length ? `<div class="left-q">✗ ${left.length} questions left: ${left.map((q) => q.id).join(", ")}</div>` : ""}
      <div class="submit"><span class="btn primary">Commit and start the agent</span><span class="btn">Commit only</span></div></section>`;
  }

  // ---------- the outline and the session ----------
  function outline() {
    const qs = nav();
    const done = qs.filter(isAnswered).length;
    const next = qs.find((q) => !isAnswered(q));
    return `<div class="progress"><span>${done} of ${qs.length} answered</span>${
      next
        ? `<span class="btn primary small" data-jump="${next.id}">Next</span>`
        : `<span class="btn primary small" data-jump="end">Submit</span>`
    }</div>
      <div class="bar"><i style="width:${(100 * done) / qs.length}%"></i></div>
      <div class="ol">
        <a href="#" class="sec" data-jump="ctx"><span class="st">§</span>Context</a>
        ${S.check === "first" ? `<a href="#" class="sec c-peach" data-jump="check"><span class="st">⚑</span>Check these · ${R().settled.check.length}</a>` : ""}
        <hr/>
        ${qs
          .map(
            (q) =>
              `<a href="#" data-jump="${q.id}" class="${q.parent ? "fu" : ""}"><span class="st ${isAnswered(q) ? "ok" : ""}">${isAnswered(q) ? "✓" : "○"}</span><span><b>${q.id}</b> ${md(q.title)}</span></a>`,
          )
          .join("")}
        <hr/>
        <a href="#" class="sec" data-jump="settled"><span class="st">⚑</span>Settled · ${S.check === "first" ? "" : R().settled.check.length + " to check"}</a>
        <a href="#" class="sec" data-jump="end"><span class="st">✎</span>Notes and submit</a>
      </div>
      <div class="hint"><kbd class="c-peach">n</kbd> <kbd class="c-peach">p</kbd> next / previous unanswered · <kbd class="c-peach">s</kbd> ask about the question at the top</div>`;
  }
  function aboutQ() {
    return nav().find((q) => q.id === S.about) || nav().find((q) => q.id === "Q2") || nav()[0];
  }
  function session(withHead = true) {
    const q = aboutQ();
    const first = nav().find((x) => x.id === "Q2") || nav()[0];
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
      ${withHead ? `<div class="sess-head"><span class="dot"></span><b>${esc(R().folder.slice(11))}</b><span>${icon("bot", 14)} ${window.SESSION.harness} · waits on you</span><span class="sp"></span><span class="btn ghost small" title="Open the session's page">${icon("panel-left", 14)} Page</span></div>` : ""}
      <div class="about" data-jump="${q.id}" title="Back to the question">${icon("message-square", 15)}<span>Asking about <b>${q.id}</b> · ${md(q.title)}</span></div>
      <div class="msgs" id="msgs">${msgs}</div>
      <div class="composer"><textarea id="draft" placeholder="Ask the agent…">${esc(draft)}</textarea>
        <div class="row"><span>Ctrl+Enter sends · the agent answers here, the round stays as it is</span><span class="btn primary small" id="send">${icon("send", 13)} Send</span></div></div>
    </div>`;
  }

  // ---------- the right column ----------
  function sessionWidth(fw) {
    if (colWidth) return colWidth;
    return Math.round(Math.max(400, Math.min(640, fw * 0.38)));
  }
  function rightColumn(cls, fw) {
    if (cls === "narrow") return { html: "", width: 0 };
    const outlineW = cls === "wide" ? 290 : 250;
    const sw = sessionWidth(fw);
    const drag = `<div class="drag" title="Drag to resize"></div>`;
    if (S.session === "split" || !S.open) {
      const tabs = S.open
        ? ""
        : `<div class="tabs"><button class="tab on">${icon("list-tree", 15)} Outline</button><button class="tab" data-tab="session">${icon("message-square", 15)} Session</button><span class="sp"></span></div>`;
      if (S.session === "stack" && !S.open) {
        return {
          width: outlineW,
          html: `<aside class="right" style="width:${outlineW}px"><div class="stackhead on">${icon("list-tree", 15)} Outline<span class="sp"></span></div><div class="col-body">${outline()}</div><div class="stackhead" data-tab="session">${icon("chevron-right", 15)} ${icon("message-square", 15)} Session <small>waits on you</small></div></aside>`,
        };
      }
      return {
        width: outlineW,
        html: `<aside class="right" style="width:${outlineW}px">${S.session === "tabs" ? tabs : `<div class="stackhead on">${icon("list-tree", 15)} Outline</div>`}<div class="col-body">${outline()}</div></aside>`,
      };
    }
    const cover = cls === "semi" && S.semi === "cover";
    if (S.session === "tabs") {
      const w = S.tab === "session" ? sw : outlineW;
      return {
        width: cover && S.tab === "session" ? outlineW : w,
        cover: cover && S.tab === "session",
        html: `<aside class="right ${cover && S.tab === "session" ? "cover" : ""}" style="width:${w}px">${drag}
          <div class="tabs"><button class="tab ${S.tab === "outline" ? "on" : ""}" data-tab="outline">${icon("list-tree", 15)} Outline <small class="c-dim">${nav().filter(isAnswered).length}/${nav().length}</small></button><button class="tab ${S.tab === "session" ? "on" : ""}" data-tab="session">${icon("message-square", 15)} Session <span class="dot"></span></button><span class="sp"></span><button class="tab" data-close="1" title="Close the session">${icon("x", 15)}</button></div>
          ${S.tab === "session" ? session() : `<div class="col-body">${outline()}</div>`}</aside>`,
      };
    }
    // stack
    return {
      width: cover ? outlineW : sw,
      cover,
      html: `<aside class="right ${cover ? "cover" : ""}" style="width:${sw}px">${drag}
        <div class="stackhead ${outlineOpen ? "on" : ""}" data-toggle-outline="1">${icon(outlineOpen ? "chevron-down" : "chevron-right", 15)} ${icon("list-tree", 15)} Outline <small>${nav().filter(isAnswered).length}/${nav().length} answered</small><span class="sp"></span><span class="btn primary small" data-jump="${(nav().find((q) => !isAnswered(q)) || { id: "end" }).id}">Next</span></div>
        ${outlineOpen ? `<div class="col-body" style="flex:none;max-height:42%;border-bottom:1px solid var(--s2)">${outline()}</div>` : ""}
        <div class="stackhead on">${icon("chevron-down", 15)} ${icon("message-square", 15)} Session <span class="dot"></span><span class="sp"></span><button class="btn ghost small" data-close="1">${icon("x", 14)}</button></div>
        ${session(false)}</aside>`,
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
    const leftW = cls === "wide" ? 256 : cls === "semi" ? 52 : 0;
    const right = rightColumn(cls, fw);
    const pageW = fw - leftW - (right.cover ? 250 : right.width);
    const lookCls =
      (S.look === "plain" ? "plainlook " : "") +
      (cls === "narrow" ? (S.lists === "tight" ? "tight" : "today-lists") : "");
    const bottom =
      S.open && S.session === "split" && cls !== "narrow"
        ? `<div class="bottom"><fieldset class="pane active" style="flex:1;margin:6px;display:flex;flex-direction:column;min-height:0;padding:0"><legend>${icon("message-square", 15)} Session <span class="dot"></span> <button class="btn ghost small" data-close="1">${icon("x", 14)}</button></legend>${session()}</fieldset></div>`
        : "";
    const qnow = nav().filter(isAnswered).length;
    const status =
      cls === "narrow"
        ? `<div class="status"><span class="btn ghost small" id="sheetbtn">${qnow}/${nav().length}</span><span class="btn primary small" data-jump="${(nav().find((q) => !isAnswered(q)) || { id: "end" }).id}">Next</span></div>`
        : `<div class="status"><span><kbd>n p</kbd> unanswered · <kbd>s</kbd> ask the agent · ${cls === "wide" ? "<kbd>[</kbd> fold · " : ""}<kbd>]</kbd> column</span><span><span class="need">2 need you</span> · ${icon("activity", 14)} 1 running</span></div>`;
    const phone =
      cls === "narrow" && S.open
        ? `<div class="phone-layer"><div class="back" data-close="1">‹ Back to ${aboutQ().id}</div>${session()}</div>`
        : "";
    const sheetHtml = cls === "narrow" && sheet ? `<div class="sheet">${outline()}</div>` : "";
    frame.innerHTML = `<div class="app ${cls}">
      ${leftShell(cls)}
      <div class="work-wrap"><div class="work"><main class="page"><div class="page-in ${lookCls}">
        ${opening(cls)}
        ${S.check === "first" && S.look !== "plain" ? `<div style="margin-top:22px">${checkPane(true)}</div>` : ""}
        ${questions(cls, pageW)}
        ${settled()}
        ${ending()}
      </div></main>${right.html}</div>${bottom}</div>
      ${status}${phone}${sheetHtml}</div>`;
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

  // The question at the top: its card and its outline row marked, its sticky header marked stuck.
  function spy() {
    const page = frame.querySelector(".page");
    if (!page) return;
    const top = page.getBoundingClientRect().top;
    let cur = null;
    for (const q of nav()) {
      const el = frame.querySelector(`[data-card="${q.id}"]`);
      if (el && el.getBoundingClientRect().top <= top + 40) cur = q.id;
    }
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
    window.__cur = cur;
  }
  function jump(id) {
    const el = frame.querySelector("#" + CSS.escape(id));
    const page = frame.querySelector(".page");
    if (!el || !page) return;
    page.scrollTop += el.getBoundingClientRect().top - page.getBoundingClientRect().top - 4;
  }
  function openSession(qid) {
    S.open = true;
    S.tab = "session";
    S.about = qid;
    const q = nav().find((x) => x.id === qid);
    draft = `About ${q.id} of clarifications-01.md:\n> ${q.title}\n\n`;
    render();
    const d = frame.querySelector("#draft");
    if (d) {
      d.focus();
      d.selectionStart = d.selectionEnd = d.value.length;
    }
  }
  function send() {
    const d = frame.querySelector("#draft");
    const text = (d ? d.value : draft)
      .split("\n")
      .filter((l) => !l.startsWith("About ") && !l.startsWith("> "))
      .join(" ")
      .trim();
    const q = aboutQ();
    sent.push({
      who: "user",
      quote: `About ${q.id} of clarifications-01.md:`,
      line: q.title,
      text: text || "What would you pick if you were me?",
    });
    sent.push({
      who: "agent",
      text: `I would keep the recommended option for ${q.id}: ${md(q.options[0].why || "it is the simplest that meets the proposal.")}`,
    });
    draft = "";
    render();
  }
  function wire() {
    frame.querySelectorAll(".opt").forEach((b) =>
      b.addEventListener("click", () => {
        const set = (answers[b.dataset.q] ||= new Set());
        set.has(b.dataset.l) ? set.delete(b.dataset.l) : set.add(b.dataset.l);
        render();
      }),
    );
    frame.querySelectorAll("textarea[data-c]").forEach((t) =>
      t.addEventListener("input", () => {
        comments[t.dataset.c] = t.value;
      }),
    );
    frame
      .querySelectorAll("[data-ask]")
      .forEach((b) => b.addEventListener("click", () => openSession(b.dataset.ask)));
    frame.querySelectorAll("[data-jump]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (frame.querySelector(".phone-layer")) {
          S.open = false;
          render();
        }
        sheet = false;
        if (frame.querySelector(".sheet")) render();
        jump(a.dataset.jump);
      }),
    );
    frame.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        S.open = true;
        S.tab = b.dataset.tab;
        render();
      }),
    );
    frame.querySelectorAll("[data-close]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        S.open = false;
        S.tab = "outline";
        render();
      }),
    );
    frame.querySelectorAll("[data-toggle-outline]").forEach((b) =>
      b.addEventListener("click", () => {
        outlineOpen = !outlineOpen;
        render();
      }),
    );
    const sb = frame.querySelector("#sheetbtn");
    if (sb)
      sb.addEventListener("click", () => {
        sheet = !sheet;
        render();
      });
    const d = frame.querySelector("#draft");
    if (d) {
      d.addEventListener("input", () => (draft = d.value));
      d.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.ctrlKey) send();
      });
    }
    const sendBtn = frame.querySelector("#send");
    if (sendBtn) sendBtn.addEventListener("click", send);
    const drag = frame.querySelector(".drag");
    if (drag)
      drag.addEventListener("pointerdown", (e) => {
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

  // Keys, drawn in the status line: n and p, s, Escape.
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("textarea, select, input")) return;
    const qs = nav();
    const at = qs.findIndex((q) => q.id === window.__cur);
    if (e.key === "n") {
      const t = qs.find((q, i) => i > at && !isAnswered(q)) || qs.find((q) => !isAnswered(q));
      if (t) jump(t.id);
    } else if (e.key === "p") {
      const t = qs
        .slice(0, Math.max(at, 0))
        .reverse()
        .find((q) => !isAnswered(q));
      if (t) jump(t.id);
    } else if (e.key === "s") {
      e.preventDefault();
      openSession(window.__cur || qs[0].id);
    } else if (e.key === "Escape" && S.open) {
      S.open = false;
      render();
    }
  });

  // ---------- the prototype's bar ----------
  function select(key, label, opts) {
    return `<label>${label}<select data-k="${key}">${opts
      .map(([v, t]) => `<option value="${v}" ${S[key] === v ? "selected" : ""}>${t}</option>`)
      .join("")}</select></label>`;
  }
  ctl.innerHTML = `<span class="tag">Prototype</span>
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
    ])}
    ${select("session", "Session", [
      ["tabs", "A tabs"],
      ["stack", "B stacked"],
      ["split", "C bottom split"],
    ])}
    ${select("semi", "Half screen", [
      ["push", "push the page"],
      ["cover", "cover the page"],
    ])}
    ${select("look", "Look", [
      ["panes", "A panes"],
      ["gutter", "B sign column"],
      ["plain", "C today"],
    ])}
    ${select("sticky", "Question", [
      ["bar", "A sticky header"],
      ["split", "B sticky left column"],
      ["none", "C today"],
    ])}
    ${select("check", "Check these", [
      ["pane", "A strong pane"],
      ["first", "B before the questions"],
      ["plain", "C today"],
    ])}
    ${select("lists", "Phone lists", [
      ["tight", "tight"],
      ["today", "today"],
    ])}
    <button id="toggle">Open / close the session</button>`;
  ctl.querySelectorAll("select").forEach((s) =>
    s.addEventListener("change", () => {
      S[s.dataset.k] = s.value;
      colWidth = null;
      render();
    }),
  );
  document.getElementById("toggle").addEventListener("click", () => {
    if (S.open) {
      S.open = false;
      render();
    } else openSession((window.__cur || "Q2").toString());
  });
  window.addEventListener("resize", render);
  render();
  if (S.open) {
    S.tab = P.get("tab") || "session";
    render();
  }
})();
