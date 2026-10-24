// The spec's mockup of the spec and plan pages in the terminal look: the design round 01 picked,
// over two real specs and a real plan, as Uraeda's core reads them. The bar on top picks the page,
// the scheme, the width, and the revision; everything under it is the page.
(function () {
  const ctl = document.getElementById("ctl");
  const frame = document.getElementById("frame");
  const P = new URLSearchParams(location.search);
  const S = {
    doc: P.get("doc") || "layout-look", // layout-look | questions-page | plan
    scheme: P.get("scheme") || "mocha",
    w: P.get("w") || "auto",
    since: P.get("since") === "1",
    tab: P.get("tab") || "contents", // contents | review | session
    page: false, // the phone's session page
    sheet: null, // the phone's sheet: contents | review
  };
  const open = new Set(); // folds opened by hand
  const comments = [];
  let selected = null; // { id, quote, where }
  let composing = false;
  let draft = "";
  let sent = [];
  let colWidth = null;

  function save() {
    const q = new URLSearchParams({
      doc: S.doc,
      scheme: S.scheme,
      w: S.w,
      tab: S.tab,
    });
    if (S.since) q.set("since", "1");
    history.replaceState(null, "", "?" + q.toString() + location.hash);
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
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function md(s) {
    let h = esc(s).replace(/\*\*\*\*/g, "");
    h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
    h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    h = h.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="#" title="$2" onclick="return false">$1</a>',
    );
    return h;
  }
  const plain = (s) =>
    s
      .replace(/\*\*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`/g, "");
  function blocks(list) {
    return list
      .map((b) => {
        if (typeof b === "string") return `<p>${md(b)}</p>`;
        if (b.list) return `<ul class="md">${b.list.map((i) => `<li>${md(i)}</li>`).join("")}</ul>`;
        if (b.table) return table(b.table);
        return "";
      })
      .join("");
  }
  function table(rows, change) {
    const [head, ...body] = rows;
    const cell = (c, i) =>
      change && i === head.length - 1 && c
        ? `<td><span class="kpill ${c.split(/[ :]/)[0].toLowerCase()}">${md(c)}</span></td>`
        : `<td>${md(c)}</td>`;
    return `<div class="tablewrap"><table class="md"><tr>${head.map((c) => `<th>${md(c)}</th>`).join("")}</tr>${body
      .map((r) => `<tr>${r.map(cell).join("")}</tr>`)
      .join("")}</table></div>`;
  }
  function pane(title, body, cls = "", icn = "", id = "") {
    return `<fieldset class="pane ${cls}" ${id ? `id="${id}"` : ""}><legend>${icn ? icon(icn, 16) : ""}${title}</legend>${body}</fieldset>`;
  }
  function fold(key, summary, body, cls = "") {
    const on = open.has(key);
    return `<div class="foldrow ${cls}"><button class="fold-btn" data-fold="${key}" aria-expanded="${on}">${icon(on ? "chevron-down" : "chevron-right", 15)} ${summary}</button>${on ? `<div class="fold-body">${body}</div>` : ""}</div>`;
  }
  const frameWidth = () => (S.w === "auto" ? frame.parentElement.clientWidth : Number(S.w));
  const widthClass = (w) => (w < 768 ? "narrow" : w < 1280 ? "semi" : "wide");
  const isSpec = () => S.doc !== "plan";
  const SP = () => window.SPECS[S.doc];
  const columnWidth = (fw) => colWidth || Math.round(Math.max(400, Math.min(600, fw / 3)));
  const commentsOn = (id) => comments.filter((c) => c.part === id).length;
  // Parts "changed since your review": an illustration of revision 2, the same parts on both specs.
  const SINCE = ["dec-1", "us-2-k1", "edge-1", "sc-1"];
  const changed = (id) => S.since && isSpec() && SINCE.includes(id);
  // A selectable block: a tap selects it, for a comment or a question to the agent.
  function sel(id, part, quote, inner, tag = "div", cls = "") {
    const on = selected && selected.id === id;
    return `<${tag} class="selb ${cls} ${on ? "sel" : ""} ${changed(id) ? "since" : ""}" data-sel="${id}" data-part="${part}" data-quote="${esc(plain(quote)).replace(/"/g, "&quot;")}">${inner}${on ? actionBar() : ""}${comments
      .filter((c) => c.id === id)
      .map(
        (c) =>
          `<div class="cmt">${icon("message-square", 14)}<span>${md(c.text)}</span><small>unsaved until your verdict</small></div>`,
      )
      .join("")}</${tag}>`;
  }
  function actionBar() {
    if (composing)
      return `<div class="actbar compose"><textarea id="cmt" placeholder="Your comment on these lines…"></textarea><div class="row"><span class="btn small" data-act="cancel">Cancel</span><span class="btn primary small" data-act="save">${icon("message-square-plus", 14)} Comment</span></div></div>`;
    return `<div class="actbar"><span class="c-dim">${esc(selected.where)}</span><span class="sp"></span><span class="btn small" data-act="comment">${icon("message-square-plus", 14)} Comment</span>${
      isSpec() || S.doc === "plan"
        ? `<span class="btn small" data-act="ask">${icon("message-square", 14)} Ask the agent</span>`
        : ""
    }</div>`;
  }

  // ---------- the shell (as shipped) ----------
  function leftShell(cls) {
    const mark = isSpec() ? "file-text" : "list-checks";
    if (cls === "narrow") {
      return `<nav class="left">${icon("house", 20)}<span class="badge-n">${icon("inbox", 20)}<i>10</i></span>${icon("list", 20)}<span class="badge-n">${icon("activity", 20)}<i>1</i></span>${icon("scale", 20)}${icon("settings", 20)}<span class="btn primary" style="padding:4px 8px">${icon("plus", 18)}</span></nav>`;
    }
    if (cls === "semi") {
      return `<nav class="left"><span class="c-green">${icon("git-branch", 22)}</span><span class="c-mauve">${icon("plus", 20)}</span>${icon("pencil", 18)}${icon("house", 20)}${icon("inbox", 20)}${icon("list", 20)}${icon("scale", 20)}<span class="c-peach">${icon(mark, 20)}</span>${icon("activity", 20)}</nav>`;
    }
    const name =
      S.doc === "plan"
        ? "Questions page"
        : S.doc === "layout-look"
          ? "Layout and look"
          : "Questions page";
    return `<nav class="left">
      <div class="brand"><span class="c-green">${icon("git-branch", 24)}</span><div>Uraeda<small>uraeda</small></div></div>
      <div class="btnrow"><span class="btn primary">${icon("plus", 15)} New</span><span class="btn">${icon("pencil", 15)} Note</span></div>
      ${pane("Navigate", `<div class="navrow"><span>${icon("house")} Home</span></div><div class="navrow"><span>${icon("inbox")} Inbox</span><span class="count">10</span></div><div class="navrow"><span>${icon("list")} Priorities</span><span class="count">4</span></div><div class="navrow"><span>${icon("scale")} Decisions</span></div>`)}
      ${pane("Needs you · 1", `<div class="card ${isSpec() ? "on" : ""}"><div class="t">${icon("file-text", 16)} ${name}</div><div class="s">${isSpec() ? "Spec to review" : "Implementation · 3/9"}</div></div>`, "attn")}
      ${pane("In progress · 1", `<div class="card ${isSpec() ? "" : "on"}"><div class="t">${icon("activity", 16)} Spec and plan pages</div><div class="s">Questions to answer</div></div>`)}
    </nav>`;
  }

  // ---------- the spec: what you approve ----------
  function brief() {
    const s = SP();
    const minutes = s.minutes || 20;
    const [lead, ...rest] = s.block;
    const principles = s.principles
      .map(
        (p) =>
          `<span class="chip ${p.ok ? "ok" : "warn"}">${icon(p.ok ? "check" : "triangle-alert", 13)} ${esc(p.label)}</span>`,
      )
      .join("");
    return `<fieldset class="pane brief active" id="approve"><legend>${icon("badge-check", 16)} Spec to review, about ${minutes} minutes</legend>
      ${sel("approve-0", "approve", lead, `<p class="lead">${md(lead)}</p>`)}
      <ul class="md">${rest.map((i, k) => `<li>${sel(`approve-${k + 1}`, "approve", i, md(i), "span")}</li>`).join("")}</ul>
      <div class="brief-foot"><span class="chip risk-${s.risk}">${icon("gauge", 13)} Risk ${esc(s.risk)}</span><span class="chip">${icon("list-checks", 13)} Plan runs without your review</span><span class="sp"></span>${principles}</div>
    </fieldset>
    ${S.since ? sinceBanner() : ""}
    <div class="prose intro">${sel("intro", "approve", s.intro, `<p>${md(s.intro)}</p>`)}</div>`;
  }
  function sinceBanner() {
    const names = {
      "dec-1": "Decision: " + SP().changes[Math.min(1, SP().changes.length - 1)].title,
      "us-2-k1": "US2, key scenario 1",
      "edge-1": "Edge cases, row 2",
      "sc-1": "Success criteria, SC-002",
    };
    return pane(
      `Since your review · ${SINCE.length} parts changed`,
      `<p class="c-dim pane-lead">Revision 2. Marked <span class="since-mark">Δ</span> in the page and the contents. Your comments were answered in “Your review, answered”.</p>
       <ul class="md">${SINCE.map((id) => `<li><a href="#" data-jump="${id}">${esc(names[id])}</a></li>`).join("")}</ul>`,
      "since-pane",
      "file-diff",
      "since",
    );
  }

  // ---------- the spec: decisions ----------
  const STRENGTH = {
    must: "MUST",
    mustnot: "MUST NOT",
    "must-not": "MUST NOT",
    should: "SHOULD",
    shouldnot: "SHOULD NOT",
    "should-not": "SHOULD NOT",
    may: "MAY",
  };
  // A part that is wholly added or removed reads plain: its sign and its row say so.
  const whole = (rs) =>
    rs.every((r) => r.kind === "added") || rs.every((r) => r.kind === "removed");
  function runs(rs, side) {
    if (!side && whole(rs)) return rs.map((r) => esc(r.text)).join(" ");
    return rs
      .filter(
        (r) =>
          !side ||
          r.kind === "kept" ||
          (side === "before" ? r.kind === "removed" : r.kind === "added"),
      )
      .map((r) =>
        r.kind === "kept"
          ? esc(r.text)
          : r.kind === "added"
            ? `<ins>${esc(r.text)}</ins>`
            : `<del>${esc(r.text)}</del>`,
      )
      .join(" ");
  }
  const SIGN = { added: "+", removed: "−", changed: "~", kept: " " };
  function rulePart(d, p, i, mode) {
    const id = `${d.name}-r${i}`;
    const str = p.strength
      ? `<span class="str s-${p.strength}">${STRENGTH[p.strength] || p.strength.toUpperCase()}</span>`
      : "";
    const check = p.check && p.check.length ? `<div class="check">${runs(p.check)}</div>` : "";
    const quote = p.runs
      .filter((r) => r.kind !== "removed")
      .map((r) => r.text)
      .join(" ");
    return sel(
      id,
      `dec-${d.idx}`,
      quote,
      `<span class="gut g-${p.kind}" aria-hidden="true">${SIGN[p.kind]}</span><div class="rbody">${str}<span class="rtext">${runs(p.runs)}</span>${check}</div>`,
      "div",
      `rule k-${p.kind}`,
    );
  }
  function section(d, s, si, mode) {
    const kept = s.parts.filter((p) => p.kind === "kept");
    const moved = s.parts.filter((p) => p.kind !== "kept");
    const body = (parts) =>
      parts.map((p, i) => rulePart(d, p, `${si}-${s.parts.indexOf(p)}`, mode)).join("");
    // Kept parts fold under one row per section.
    return `<div class="dsec-row"><span class="dsec-t">${esc(s.title || "Intent")}</span>${moved.length ? `<span class="c-dim">${moved.length} changed</span>` : ""}</div>${body(moved)}${
      kept.length
        ? fold(
            `k-${d.name}-${si}`,
            `${kept.length} ${s.title === "Rules" ? "rule" : "part"}${kept.length === 1 ? "" : "s"} unchanged`,
            body(kept),
            "dim",
          )
        : ""
    }`;
  }
  function decision(d) {
    const mode = "ledger";
    const listed = SP().decisions.find((x) => x.includes(`${d.name}.md`)) || "";
    const sentence = listed
      .replace(/^\*\*[^*]*\*\*\s*/, "")
      .replace(/^\[[^\]]*\]\([^)]*\)\.?\s*/, "");
    const kind = {
      new: ["new", "New"],
      changed: ["changed", "Changed"],
      removed: ["removed", "Removed"],
    }[d.kind];
    const secs = d.sections;
    const intent = secs.find((s) => !s.title);
    const rules = secs.find((s) => s.title === "Rules");
    const others = secs.filter((s) => s.title && s.title !== "Rules");
    const counts = (list) =>
      list.reduce((a, s) => a + s.parts.filter((p) => p.kind !== "kept").length, 0);
    let body;
    if (d.kind === "new") {
      body = `${intent ? `<div class="intent">${intent.parts.map((p) => runs(p.runs)).join(" ")}</div>` : ""}
        <div class="dsec-row"><span class="dsec-t">Rules</span><span class="c-dim">${rules.parts.length} new</span></div>
        ${rules.parts.map((p, i) => rulePart(d, p, `r-${i}`, "ledger")).join("")}
        ${fold(`o-${d.name}`, `Why, alternatives, consequences, applies to`, others.map((s, si) => `<h4 class="dsec">${esc(s.title)}</h4>${s.parts.map((p) => `<p class="plainpart">${runs(p.runs)}</p>`).join("")}`).join(""), "dim")}`;
    } else {
      body = `${intent ? section(d, intent, 0, mode) : ""}${rules ? section(d, rules, secs.indexOf(rules), mode) : ""}${fold(
        `o-${d.name}`,
        `Why, alternatives, consequences · ${counts(others)} changed`,
        others.map((s) => section(d, s, secs.indexOf(s), mode)).join(""),
        "dim",
      )}`;
    }
    return `<fieldset class="pane decision dk-${d.kind} ${changed(`dec-${d.idx}`) ? "since" : ""}" id="dec-${d.idx}"><legend><span class="kbadge ${kind[0]}">${kind[1]}</span>${icon("scale", 16)} ${esc(d.title)} <span class="c-dim fieldchg">${d.kind === "new" ? "proposed" : "active → proposed"}</span></legend>
      ${sentence ? `<p class="dsentence">${md(sentence)}</p>` : ""}${body}
      <div class="dfoot"><a href="#" onclick="return false">${icon("external-link", 13)} The whole decision, on its page</a></div></fieldset>`;
  }
  function decisions() {
    const s = SP();
    const ch = s.changes.map((d, i) => ({ ...d, idx: i }));
    const kinds = ["new", "changed", "removed"]
      .map((k) => [k, ch.filter((d) => d.kind === k).length])
      .filter(([, n]) => n);
    const relied = s.relied.slice(1);
    return `<section id="decisions"><h2 class="sec">${icon("scale", 20)} Decisions <span class="c-dim">· ${kinds.map(([k, n]) => `${n} ${k}`).join(", ")}</span></h2>
      <p class="c-dim pane-lead">They bind every later feature. Approving the spec activates them.</p>
      ${ch.map((d) => decision(d)).join("")}
      ${pane(`Relied on · ${relied.length}`, `<div class="relied">${relied.map(([a, b], i) => sel(`rel-${i}`, "relied", `${a}: ${b}`, `<span class="rl">${md(a)}</span><span class="rm">${md(b)}</span>`)).join("")}</div>`, "relied-pane", "link", "relied")}</section>`;
  }

  // ---------- the spec: stories, and their live frames ----------
  function embedOf(m) {
    const [path, hash = ""] = m.href.split("#");
    const [file, query = ""] = path.split("?");
    const q = new URLSearchParams(query);
    const w = Number(q.get("w") || 1440);
    q.delete("w");
    q.set("embed", "1");
    q.set("w", "auto");
    const name = file.split("/").pop();
    return {
      src: `embeds/${name}?${q}${hash ? "#" + hash : ""}`,
      w,
      h: w < 768 ? 844 : 900,
      name,
      route: `${name}${hash ? "#" + hash : ""}`,
    };
  }
  function liveFrame(m, id) {
    const e = embedOf(m);
    const phone = e.w < 768;
    const size = `${e.w} × ${e.h}`;
    const iframe = `<div class="scaler" data-w="${e.w}" data-h="${e.h}"><iframe loading="lazy" title="Mockup: ${esc(m.label)}, at ${e.w} px" src="${e.src}" style="width:${e.w}px;height:${e.h}px"></iframe></div>`;
    const tools = `<span class="ftools"><span class="btn ghost small" title="Comment on this mockup">${icon("message-square-plus", 14)}</span><span class="btn ghost small" title="Full screen, at 100%">${icon("maximize-2", 14)}</span></span>`;
    return `<fieldset class="live ${phone ? "is-phone" : ""}" id="${id}"><legend>${icon(phone ? "smartphone" : "monitor", 15)} <b>live</b> · ${esc(m.label)} <span class="c-dim">· ${size} · <span class="scale-pct"></span></span></legend>${tools}<div class="stage">${iframe}</div></fieldset>`;
  }
  function scenario(steps, id, part) {
    const ic = { Given: "circle-dashed", When: "sparkles", Then: "chevron-right" };
    const quote = steps.map(([w, t]) => `${w} ${t}`).join(" ");
    return sel(
      id,
      part,
      quote,
      steps
        .map(
          ([w, t]) =>
            `<div class="gwt">${icon(ic[w] || "circle", 15)}<b>${w.toUpperCase()}</b><span>${md(t)}</span></div>`,
        )
        .join(""),
      "div",
      "scen",
    );
  }
  function stories() {
    const s = SP();
    return `<section id="stories"><h2 class="sec">${icon("map", 20)} User stories <span class="c-dim">· ${s.stories.length}</span></h2>${s.stories
      .map((st, n) => {
        const part = `us-${n + 1}`;
        return `<fieldset class="pane story" id="${part}"><legend>${icon("map", 16)} ${st.id} · ${esc(st.title)} <span class="pbadge">${st.priority}</span></legend>
        <div class="prose">${st.journey.map((j, k) => sel(`${part}-j${k}`, part, j, `<p>${md(j)}</p>`)).join("")}${st.why ? `<p class="c-dim">${md(st.why)}</p>` : ""}</div>
        ${st.mockups.map((m, k) => liveFrame(m, `${part}-m${k}`)).join("")}
        <div class="scens"><div class="scen-h">Key scenarios</div>${st.key.map((k, i) => scenario(k, `${part}-k${i}`, part)).join("")}</div>
        ${st.more.length ? fold(`more-${part}`, `${st.more.length} more scenarios`, st.more.map((k, i) => scenario(k, `${part}-o${i}`, part)).join(""), "dim") : ""}
        </fieldset>`;
      })
      .join("")}</section>`;
  }

  // ---------- the spec: data, and how it is built ----------
  function dataModel() {
    if (S.doc !== "questions-page") return "";
    const text = window.DATA_MODEL;
    const secs = text
      .split(/\n## /)
      .slice(1)
      .map((chunk) => {
        const [title, ...rest] = chunk.split("\n");
        const paras = [];
        let tbl = null;
        for (const l of rest.join("\n").split("\n")) {
          if (l.startsWith("|")) {
            if (/^\|\s*-/.test(l)) continue;
            (tbl ||= []).push(
              l
                .split("|")
                .slice(1, -1)
                .map((c) => c.trim()),
            );
          } else if (l.trim()) paras.push(l);
          else if (paras.length && paras[paras.length - 1] !== "") paras.push("");
        }
        return {
          title,
          paras: paras
            .join("\n")
            .split("\n\n")
            .map((p) => p.replace(/\n/g, " "))
            .filter(Boolean),
          tbl,
        };
      });
    return `<section id="data"><h2 class="sec">${icon("database", 20)} Data <span class="c-dim">· data-model.md · ${secs.length}</span></h2>${secs
      .map((x, i) =>
        pane(
          esc(x.title),
          `<div class="prose">${x.paras.map((p, k) => sel(`data-${i}-${k}`, "data", p, `<p>${md(p)}</p>`)).join("")}</div>${x.tbl ? table(x.tbl, true) : ""}`,
          "",
          "database",
          `data-${i}`,
        ),
      )
      .join("")}</section>`;
  }
  function built() {
    const s = SP();
    const unit = (u, i) => {
      const m = u.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
      return sel(
        `unit-${i}`,
        "architecture",
        u,
        `<span class="uname">${esc(m ? m[1] : "")}</span><span>${md(m ? m[2] : u)}</span>`,
        "div",
        "unit",
      );
    };
    const edgeRow = (e, i) =>
      sel(
        `edge-${i}`,
        "edges",
        `${e[1]}: ${e[2]}`,
        `<span class="imp imp-${e[0].toLowerCase()}">${esc(e[0])}</span><div><div class="sit">${md(e[1])}</div><div class="what">${icon("chevron-right", 13)} ${md(e[2])}</div></div>`,
        "div",
        "edge",
      );
    const shown = s.edges.filter((e) => e[0] !== "Niche");
    const niche = s.edges.filter((e) => e[0] === "Niche");
    return `<section id="built"><h2 class="sec">${icon("layers", 20)} How it is built</h2>
      ${pane(
        "Architecture",
        `<div class="prose">${s.archIntro.map((p, i) => sel(`arch-${i}`, "architecture", p, `<p>${md(p)}</p>`)).join("")}</div><div class="units">${s.units.map(unit).join("")}</div>${
          s.tradeoffs.length
            ? `<div class="tradeoffs"><div class="scen-h">Tradeoffs</div>${s.tradeoffs.map((t, i) => sel(`trade-${i}`, "architecture", t, `<span class="cost">cost</span><span>${md(t)}</span>`, "div", "trade")).join("")}</div>`
            : ""
        }`,
        "",
        "layers",
        "architecture",
      )}
      ${pane(`Edge cases · ${s.edges.length}`, shown.map((e) => edgeRow(e, s.edges.indexOf(e))).join("") + (niche.length ? fold("niche", `${niche.length} niche cases`, niche.map((e) => edgeRow(e, s.edges.indexOf(e))).join(""), "dim") : ""), "", "shield", "edges")}
      ${pane(`Success criteria · ${s.criteria.length}`, s.criteria.map((c, i) => sel(`sc-${i}`, "criteria", c.sentence, `<span class="scid">${c.id}</span>${c.measure ? `<span class="chip">${esc(c.measure)}</span>` : ""}<span>${md(c.sentence)}</span>`, "div", "crit")).join(""), "", "ruler", "criteria")}
      ${pane("Assumptions", `<div class="prose">${blocks(s.assumptions)}</div>`, "", "lightbulb", "assumptions")}
      ${pane("Constitution and risk", `<div class="principles">${s.principles.map((p) => `<span class="chip ${p.ok ? "ok" : "warn"}">${icon(p.ok ? "check" : "triangle-alert", 13)} ${esc(p.label)}</span>`).join("")}</div><div class="prose"><p>${md(s.riskText)}</p></div>`, "", "shield-check", "risk")}
    </section>`;
  }
  function verdict(cls) {
    return `<section id="review"><h2 class="sec">${icon("badge-check", 20)} Your review</h2>${pane(
      `Verdict · ${comments.length} comment${comments.length === 1 ? "" : "s"}`,
      `${comments.length ? `<div class="cmts">${comments.map((c) => `<a href="#" data-jump="${c.id}" class="cmtrow">${icon("message-square", 14)}<span><b>${esc(c.where)}</b> ${md(c.text)}</span></a>`).join("")}</div>` : `<p class="c-dim">No comment yet. Tap any block of the page to comment on it, or ask the agent about it.</p>`}
       <span class="btn small">${icon("message-square-plus", 14)} Add a general comment</span>
       <label class="c-dim lbl">Summary, for the agent</label><textarea class="summary" placeholder="Optional"></textarea>
       <div class="choices"><span class="c-dim">Risk tier</span><span class="seg"><i>low</i><i class="on">${esc(SP().risk)}</i><i>high</i></span><label class="switch"><input type="checkbox"/> The plan waits for your review</label></div>
       <div class="submit"><span class="btn danger ${comments.length ? "" : "disabled"}">Request changes, start the agent</span><span class="btn primary">Approve, start the agent</span></div>`,
      "active",
      "badge-check",
      "verdict",
    )}</section>`;
  }

  // ---------- the plan ----------
  function planPage() {
    const p = window.PLAN;
    const tasks = p.tasks.map((t, i) => ({
      ...t,
      n: i + 1,
      done: t.steps.filter((s) => s.done).length,
    }));
    const allDone = (t) => t.done === t.steps.length;
    const current = tasks.find((t) => !allDone(t));
    const head = `<div class="crumbs">Home › Questions page in the terminal look › <b>plan.md</b></div><h1>Plan: Questions page in the terminal look</h1>
      <div class="status-row"><span class="chip ok">${icon("check", 13)} Auto-approved</span><span class="c-dim">spec revision 1 · implementation running</span></div>`;
    const goal = pane(
      "Goal",
      `<div class="prose">${sel("goal", "goal", p.goal, `<p>${md(p.goal)}</p>`)}</div>`,
      "goal",
      "target",
      "goal",
    );
    const waves = pane(
      `Waves · ${p.waves.length}`,
      `<ol class="md">${p.waves.map((w, i) => `<li>${sel(`wave-${i}`, "waves", w, md(w), "span")}</li>`).join("")}</ol>`,
      "",
      "milestone",
      "waves",
    );
    const taskPane = (t, folded) => {
      const label = `Task ${t.n} · ${esc(t.title.replace(/^Task \d+: /, ""))}`;
      const st = allDone(t) ? "done" : t === current ? "now" : "todo";
      const badge = `<span class="tprog ${st}">${t.done}/${t.steps.length}</span>`;
      const body = `${t.risky ? `<p class="risky">${icon("triangle-alert", 14)} <b>Risky:</b> ${md(t.risky)}</p>` : ""}
        ${t.files.length ? `<div class="files">${t.files.map((f) => `<div>${icon("file-text", 13)} ${md(f)}</div>`).join("")}</div>` : ""}
        <div class="steps">${t.steps.map((s, i) => sel(`t${t.n}-s${i}`, `task-${t.n}`, s.text, `${icon(s.done ? "square-check" : "square", 16)}<span>${md(s.text)}</span>`, "div", `step ${s.done ? "done" : ""}`)).join("")}</div>`;
      if (folded && !open.has(`task-${t.n}`))
        return `<div class="tfold ${st}" id="task-${t.n}"><button class="fold-btn" data-fold="task-${t.n}">${icon("chevron-right", 15)} ${icon(st === "done" ? "circle-check" : "circle", 15)} ${label}</button>${badge}</div>`;
      return `<fieldset class="pane task t-${st} ${st === "now" ? "active" : ""}" id="task-${t.n}"><legend>${icon(st === "done" ? "circle-check" : st === "now" ? "circle-dashed" : "circle", 16)} ${label} ${badge}</legend>${body}${folded ? `<button class="fold-btn dim" data-fold="task-${t.n}">${icon("chevron-down", 15)} fold</button>` : ""}</fieldset>`;
    };
    const focus = `<ol class="md">${p.focus.map((f, i) => `<li>${sel(`focus-${i}`, "focus", f, md(f), "span")}</li>`).join("")}</ol>`;
    return `${head}${goal}${pane("Architecture", `<div class="prose"><p>${md(p.architecture)}</p></div>`, "", "layers", "arch")}${pane(`Review focus · ${p.focus.length}`, focus, "", "eye", "focus")}${p.others
      .map((o) =>
        pane(
          o.title,
          `<p class="c-dim">${o.lines} lines, as written in plan.md.</p>`,
          "",
          "book-open",
          `ref-${o.title}`,
        ),
      )
      .join("")}${waves}${tasks.map((t) => taskPane(t, false)).join("")}`;
  }

  // ---------- the right column ----------
  function contents() {
    if (!isSpec()) {
      const p = window.PLAN;
      const row = (id, label, st = "") =>
        `<a href="#" data-jump="${id}"><span class="st">${st}</span><span>${label}</span></a>`;
      return `<div class="ol">${row("goal", "Goal", "·")}${row("arch", "Architecture", "·")}${row("focus", "Review focus", "·")}${p.others.map((o) => row(`ref-${o.title}`, esc(o.title), "·")).join("")}${row("waves", "Waves", "·")}<hr/>${p.tasks
        .map((t, i) =>
          row(
            `task-${i + 1}`,
            `<b>${i + 1}</b> ${esc(t.title.replace(/^Task \d+: /, ""))}`,
            t.steps.every((s) => s.done) ? "✓" : "○",
          ).replace('class="st">✓', 'class="st ok">✓'),
        )
        .join("")}</div>`;
    }
    const s = SP();
    const n = (id) =>
      commentsOn(id)
        ? `<span class="ccount">${icon("message-square", 12)} ${commentsOn(id)}</span>`
        : "";
    const d = (id) => (changed(id) ? `<span class="since-mark">Δ</span>` : "");
    const row = (id, label, cls = "", st = "·") =>
      `<a href="#" data-jump="${id}" class="${cls}"><span class="st">${st}</span><span class="lb">${label}</span>${d(id)}${n(id)}</a>`;
    return `<div class="progress"><span>${comments.length} comment${comments.length === 1 ? "" : "s"}</span><span class="btn primary small" data-jump="verdict">Verdict</span></div>
      <div class="ol">${row("approve", "What you approve", "sec", "!")}${S.since ? row("since", "Since your review", "sec warn", "Δ") : ""}<hr/>
      ${row("decisions", `Decisions · ${s.changes.length}`, "sec", "⚖")}${s.changes.map((c, i) => row(`dec-${i}`, `<span class="kmini ${c.kind}">${c.kind[0].toUpperCase()}</span> ${esc(c.title)}`, "sub")).join("")}${row("relied", "Relied on", "sub")}<hr/>
      ${row("stories", `User stories · ${s.stories.length}`, "sec", "◇")}${s.stories.map((st, i) => row(`us-${i + 1}`, `<b>${st.id}</b> ${esc(st.title)}`, "sub")).join("")}
      ${S.doc === "questions-page" ? row("data", "Data", "sec") : ""}<hr/>
      ${row("architecture", "Architecture")}${row("edges", "Edge cases")}${row("criteria", "Success criteria")}${row("assumptions", "Assumptions")}${row("risk", "Constitution and risk")}<hr/>
      ${row("verdict", "Your review", "sec", "✎")}</div>`;
  }
  function reviewTab() {
    return `<div class="col-body"><div class="progress"><span>${comments.length} comment${comments.length === 1 ? "" : "s"}, unsent</span></div>
      ${comments.length ? comments.map((c) => `<a href="#" data-jump="${c.id}" class="cmtrow">${icon("message-square", 14)}<span><b>${esc(c.where)}</b><br/>${md(c.text)}</span></a>`).join("") : `<p class="c-dim">Tap any block of the page to comment on it. Comments gather here, and go with your verdict.</p>`}
      <hr/><span class="btn small">${icon("message-square-plus", 14)} General comment</span>
      <div class="submit col"><span class="btn danger ${comments.length ? "" : "disabled"}">Request changes</span><span class="btn primary">Approve</span></div>
      <p class="c-dim small">Risk tier, plan review, and your summary are with the verdict at the page's end.</p></div>`;
  }
  function session() {
    const doc = isSpec() ? "spec.md" : "plan.md";
    const about =
      S.about ||
      (isSpec()
        ? {
            where: "Decision UI layout, lines 16–17",
            quote:
              "A view's spec MUST say why its layout reads best, with mockups at each width class.",
          }
        : {
            where: "Task 4, step 3",
            quote:
              "Implement on SideColumn, its tabs Astryx's Tabs if they fit the column's width.",
          });
    const history = [
      {
        who: "user",
        quote: `About ${about.where} of ${doc}:`,
        line: about.quote,
        text: "Why does this change, and what does it cost the features in flight?",
      },
      {
        who: "tool",
        text: "Read `specs/decisions/ui-layout.md`, `specs/2026-10-24-questions-page/spec.md`",
      },
      {
        who: "agent",
        text: "It changes because the half screen got the desktop's layout and broke. A feature in flight keeps its own spec: only views changed after the merge are checked against three classes.",
      },
      ...sent,
    ];
    const msgs = history
      .map((m) =>
        m.who === "user"
          ? `<div class="msg user"><div class="who">You</div><div class="prose" style="font-size:16px">${md(m.quote)}<blockquote>${md(m.line)}</blockquote><p>${md(m.text)}</p></div></div>`
          : m.who === "tool"
            ? `<div class="msg tool">${icon("file-text", 14)}<span>${md(m.text)}</span></div>`
            : `<div class="msg agent prose"><p style="font-size:17px">${md(m.text)}</p></div>`,
      )
      .join("");
    return `<div class="sess"><div class="sess-head"><span class="dot"></span><b>${isSpec() ? esc(SP().folder.slice(11)) : "questions-page"}</b><span>${icon("bot", 14)} Claude Code · waits on you</span><span class="sp"></span><span class="btn ghost small">${icon("panel-left", 14)} Page</span></div>
      <div class="about">${icon("message-square", 15)}<span>Asking about <b>${esc(about.where)}</b></span></div>
      <div class="msgs" id="msgs">${msgs}</div>
      <div class="composer"><textarea id="draft" placeholder="Ask the agent…">${esc(draft)}</textarea><div class="row"><span>Ctrl+Enter sends</span><span class="btn primary small" id="send">${icon("send", 13)} Send</span></div></div></div>`;
  }
  function rightColumn(cls, fw) {
    if (cls === "narrow") return { html: "", width: 0 };
    const w = columnWidth(fw);
    const tabs = isSpec()
      ? [
          ["contents", "list-tree", "Contents"],
          [
            "review",
            "message-square",
            `Review${comments.length ? ` <small class="c-dim">${comments.length}</small>` : ""}`,
          ],
          ["session", "bot", "Session"],
        ]
      : [
          ["contents", "list-tree", "Contents"],
          ["session", "bot", "Session"],
        ];
    if (!tabs.some(([k]) => k === S.tab)) S.tab = "contents";
    const body =
      S.tab === "session"
        ? session()
        : S.tab === "review"
          ? reviewTab()
          : `<div class="col-body">${contents()}</div>`;
    return {
      width: w,
      html: `<aside class="right" style="width:${w}px"><div class="drag" title="Drag to resize"></div><div class="tabs" role="tablist">${tabs
        .map(
          ([k, ic, label]) =>
            `<button class="tab ${S.tab === k ? "on" : ""}" data-tab="${k}" role="tab" aria-selected="${S.tab === k}">${icon(ic, 15)} ${label}</button>`,
        )
        .join("")}</div>${body}</aside>`,
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
    let main;
    if (isSpec()) {
      const s = SP();
      main = `<div class="crumbs">Home › ${esc(s.title.replace(/^Spec: /, ""))} › <b>spec.md</b></div><h1>${esc(s.title)}</h1>
        <div class="status-row"><span class="chip warn">${icon("eye", 13)} Waiting for your review</span><span class="c-dim">revision ${S.since ? 2 : 1} · committed at <code>a15f39e</code> · tap a block to comment or ask</span></div>
        ${brief()}${decisions()}${stories()}${dataModel()}${built()}${verdict(cls)}`;
    } else main = planPage();
    const status =
      cls === "narrow"
        ? `<div class="status"><span class="btn ghost small" data-sheet="contents">${icon("list-tree", 14)} Contents</span>${isSpec() ? `<span class="btn ghost small" data-sheet="review">${icon("message-square", 14)} ${comments.length}</span><span class="btn primary small" data-jump="verdict">Verdict</span>` : `<span class="btn ghost small">${icon("bot", 14)} Session</span>`}</div>`
        : `<div class="status"><span>tap a block · ${cls === "wide" ? "<kbd>[</kbd> fold · " : ""}<kbd>]</kbd> column</span><span><span class="need">1 needs you</span> · ${icon("activity", 14)} 1 running</span></div>`;
    const phoneSession =
      cls === "narrow" && S.page
        ? `<div class="phone-layer"><div class="back" data-back="1">‹ Back to the ${isSpec() ? "spec" : "plan"}</div>${session()}</div>`
        : "";
    const sheet =
      cls === "narrow" && S.sheet
        ? `<div class="scrim" data-sheet-close="1"></div><div class="sheet"><div class="sheet-head"><b>${S.sheet === "review" ? "Review" : "Contents"}</b><button class="btn ghost small" data-sheet-close="1">${icon("x", 14)}</button></div>${S.sheet === "review" ? reviewTab() : contents()}</div>`
        : "";
    frame.innerHTML = `<div class="app ${cls} ">${leftShell(cls)}<div class="work-wrap"><div class="work"><main class="page"><div class="page-in ${cls === "narrow" ? "tight" : ""}">${main}</div></main>${right.html}</div></div>${status}${phoneSession}${sheet}</div>`;
    const page = frame.querySelector(".page");
    page.style.scrollBehavior = "auto";
    page.scrollTop = scroll;
    page.style.scrollBehavior = "";
    page.addEventListener("scroll", spy, { passive: true });
    fitFrames();
    spy();
    const msgs = frame.querySelector("#msgs");
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    wire();
  }
  // A live frame keeps the mockup at its real width, scaled to the room it has.
  function fitFrames() {
    frame.querySelectorAll(".scaler").forEach((sc) => {
      const w = Number(sc.dataset.w);
      const h = Number(sc.dataset.h);
      const box = sc.closest(".stage, figure");
      const inset = box.matches(".stage") ? 20 : box.matches(".dev") ? 24 : 2;
      const room = box.clientWidth - inset;
      const max = w < 768 ? Math.min(room, w) : room;
      const k = Math.min(1, max / w);
      const f = sc.querySelector("iframe");
      f.style.transform = `scale(${k})`;
      sc.style.width = Math.round(w * k) + "px";
      sc.style.height = Math.round(h * k) + "px";
      const pct = sc.closest(".live, .dev, .brw")?.querySelector(".scale-pct");
      if (pct) pct.textContent = Math.round(k * 100) + "%";
    });
  }
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
      .querySelectorAll(".ol a[data-jump]")
      .forEach((a) => a.classList.toggle("cur", a.dataset.jump === cur));
  }
  function jump(id) {
    const el =
      frame.querySelector("#" + CSS.escape(id)) || frame.querySelector(`[data-sel="${id}"]`);
    const page = frame.querySelector(".page");
    if (!el || !page) return;
    page.scrollTop += el.getBoundingClientRect().top - page.getBoundingClientRect().top - 8;
  }
  function whereOf(el) {
    const part = el.dataset.part;
    const title =
      el.closest("fieldset")?.querySelector("legend")?.textContent.trim().replace(/\s+/g, " ") ||
      part;
    if (part.startsWith("dec-"))
      return `Decision ${title.replace(/^(New|Changed|Removed)\s*/, "").replace(/ (proposed|active → proposed)$/, "")}, lines 18–19`;
    return `Lines ${40 + (el.dataset.sel.length % 30)}–${42 + (el.dataset.sel.length % 30)}, under “${title.replace(/ P\d$/, "")}”`;
  }
  function wire() {
    const on = (q, ev, fn) =>
      frame.querySelectorAll(q).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)));
    on("[data-sel]", "click", (el, e) => {
      if (e.target.closest(".actbar, a, button, .btn, iframe")) return;
      e.stopPropagation();
      selected =
        selected && selected.id === el.dataset.sel
          ? null
          : {
              id: el.dataset.sel,
              part: el.dataset.part,
              quote: el.dataset.quote,
              where: whereOf(el),
            };
      composing = false;
      render();
    });
    on("[data-act]", "click", (b, e) => {
      e.stopPropagation();
      const a = b.dataset.act;
      if (a === "comment") composing = true;
      else if (a === "cancel") composing = false;
      else if (a === "save") {
        const t = frame.querySelector("#cmt").value.trim();
        if (t) comments.push({ ...selected, text: t });
        selected = null;
        composing = false;
      } else if (a === "ask") {
        S.about = { where: selected.where, quote: selected.quote };
        draft = `About ${selected.where} of ${isSpec() ? "spec.md" : "plan.md"}:\n> ${selected.quote}\n\n`;
        if (widthClass(frameWidth()) === "narrow") S.page = true;
        else S.tab = "session";
        selected = null;
      }
      render();
      if (a === "comment") frame.querySelector("#cmt")?.focus();
      if (a === "ask") frame.querySelector("#draft")?.focus();
    });
    on("[data-fold]", "click", (b, e) => {
      e.stopPropagation();
      const k = b.dataset.fold;
      open.has(k) ? open.delete(k) : open.add(k);
      render();
    });
    on("[data-jump]", "click", (a, e) => {
      e.preventDefault();
      e.stopPropagation();
      const go = a.dataset.jump;
      if (go.startsWith("task-")) open.add(go);
      if (S.page || S.sheet) {
        S.page = false;
        S.sheet = null;
        render();
      } else if (go.startsWith("task-")) render();
      jump(go);
    });
    on("[data-tab]", "click", (b) => {
      S.tab = b.dataset.tab;
      render();
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
    on("#draft", "input", (d) => (draft = d.value));
    on("#send", "click", () => {
      const text = draft
        .split("\n")
        .filter((l) => !l.startsWith("About ") && !l.startsWith("> "))
        .join(" ")
        .trim();
      sent.push({
        who: "user",
        quote: `About ${S.about ? S.about.where : "the spec"}:`,
        line: S.about ? S.about.quote : "",
        text: text || "What would you change?",
      });
      sent.push({
        who: "agent",
        text: "I would keep it as written: the decision's Why already says what it protects. Comment on it if you want it changed, and I will revise the spec.",
      });
      draft = "";
      render();
    });
    on(".drag", "pointerdown", (drag, e) => {
      const aside = drag.parentElement;
      const startX = e.clientX;
      const startW = aside.getBoundingClientRect().width;
      const move = (ev) => {
        colWidth = Math.max(400, Math.min(720, startW + (startX - ev.clientX)));
        aside.style.width = colWidth + "px";
        fitFrames();
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

  // ---------- the prototype's bar ----------
  const select = (key, label, opts) =>
    `<label>${label}<select data-k="${key}">${opts.map(([v, t]) => `<option value="${v}" ${String(S[key]) === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  function bar() {
    ctl.innerHTML = `<span class="tag">Mockup</span>
    ${select("doc", "Page", [
      ["layout-look", "spec: layout-look (3 decisions)"],
      ["questions-page", "spec: questions-page (+ data)"],
      ["plan", "plan: questions-page"],
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
    ${select("since", "Revision", [
      ["false", "revision 1"],
      ["true", "revision 2: changes marked"],
    ])}`;
    ctl.querySelectorAll("select").forEach((s) =>
      s.addEventListener("change", () => {
        S[s.dataset.k] = s.dataset.k === "since" ? s.value === "true" : s.value;
        colWidth = null;
        selected = null;
        render();
      }),
    );
  }
  document.addEventListener("click", (e) => {
    if (selected && !e.target.closest("[data-sel], #ctl")) {
      selected = null;
      composing = false;
      render();
    }
  });
  bar();
  // A link's hash opens the page at that part, as the app's anchors do.
  if (location.hash) setTimeout(() => jump(decodeURIComponent(location.hash.slice(1))), 400);
  window.addEventListener("resize", render);
  render();
})();
