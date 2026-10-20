// Semantic content blocks, shared by every direction. They carry no look: each direction's CSS gives them one,
// and each direction's app.js owns its own shell, home, and list views (the parts where layouts really differ).
(function () {
  const D = window.URA;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  window.esc = esc;

  const B = {};

  // One option of a question card.
  B.option = (o, picked) => `
    <li class="opt ${o.rec ? "rec" : ""} ${picked ? "picked" : ""}" tabindex="0">
      <span class="opt-key">${o.k}</span>
      <div class="opt-body">
        <p class="opt-text">${o.rec ? '<em class="rec-tag">recommended</em> ' : ""}${esc(o.t)}</p>
        ${o.ex ? `<p class="opt-ex"><span class="lbl">${icon("bulb", 14)} Example</span> ${esc(o.ex)}</p>` : ""}
        <p class="pro"><span class="tag">pro</span> ${esc(o.pro)}</p>
        <p class="con"><span class="tag">con</span> ${esc(o.con)}</p>
        ${o.why ? `<p class="why-rec">${icon("star", 14)} ${esc(o.why)}</p>` : ""}
      </div>
    </li>`;

  // A question card: example, context, "Why it matters", options, answer.
  B.question = (q, opts = {}) => `
    <article class="q-card ${q.answered ? "answered" : ""}" id="q${q.n}">
      <header class="q-head">
        <span class="q-num">Q${q.n}</span>
        <h3>${esc(q.title)}</h3>
        ${q.answered ? `<span class="q-state">${icon("check", 14)} ${esc(q.answered)}</span>` : `<span class="q-state open">${icon("pencil", 14)} to answer</span>`}
      </header>
      ${q.example ? `<p class="q-example"><span class="lbl">${icon("bulb", 14)} Example</span> ${esc(q.example)}</p>` : ""}
      <p class="q-body">${esc(q.body)}</p>
      <p class="q-why"><span class="lbl">${icon("help", 14)} Why it matters</span> ${esc(q.why)}</p>
      <ul class="opts">${q.options.map((o) => B.option(o, q.answered && q.answered.includes(o.k))).join("")}</ul>
      <label class="answer"><span class="lbl">${icon("pencil", 14)} Answer</span>
        <textarea rows="2" placeholder="A letter, or your own words">${q.answered ? "" : ""}</textarea></label>
    </article>`;

  // The agent's context before the questions: the first feedback from the agent to the human.
  B.context = (c) => `
    <section class="ctx">
      <div class="ctx-part goal"><h4>${icon("flag", 15)} Goal</h4><p>${esc(c.goal)}</p></div>
      <div class="ctx-part today"><h4>${icon("clock", 15)} Today</h4><p>${esc(c.today)}</p>
        <table><thead><tr><th>Product</th><th>How users pick a repeat</th><th>Where</th></tr></thead>
        <tbody>${c.table.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <div class="ctx-part scope"><h4>${icon("layers", 15)} Scope</h4><p>${esc(c.scope)}</p></div>
      <div class="ctx-part sources"><h4>${icon("book", 15)} Sources</h4><ul>${c.sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
    </section>`;

  // The "important" block opening a file waiting for the human.
  B.block = (cl) => `
    <aside class="block">
      <p class="block-first">${icon("alert", 16)} <strong>${esc(cl.count)}</strong></p>
      <ul>${cl.block.map((b, i) => `<li class="${i === 0 ? "verdict" : ""}">${esc(b)}</li>`).join("")}</ul>
    </aside>`;

  B.settled = (s) => `
    <section class="settled">
      <h3>Settled without you</h3>
      <div class="settled-group check"><h4>${icon("alert", 15)} Check these</h4>${s.check.map(([a, b]) => `<p><strong>${esc(a)}</strong> ${esc(b)}</p>`).join("")}</div>
      <div class="settled-group behaviour"><h4>${icon("eye", 15)} Behaviour</h4>${s.behaviour.map(([a, b]) => `<p><strong>${esc(a)}</strong> ${esc(b)}</p>`).join("")}</div>
      <div class="settled-group hood"><h4>${icon("wrench", 15)} Under the hood</h4>${s.hood.map(([a, b]) => `<p><strong>${esc(a)}</strong> ${esc(b)}</p>`).join("")}</div>
    </section>`;

  B.clarifications = () => {
    const c = D.clarifications;
    return `${B.block(c)}${B.context(c.context)}
      <div class="q-list">${c.questions.map((q) => B.question(q)).join("")}
      <p class="more-q">${icon("chevD", 14)} ${c.more.length} more questions: ${c.more.map(esc).join(" · ")}</p></div>
      ${B.settled(c.settled)}`;
  };

  // A decision with its rule diff: the highest-importance part of a spec.
  B.decision = (d) => `
    <article class="decision ${d.kind.toLowerCase()}">
      <header><span class="dk">${icon(d.kind === "New" ? "plus" : "diff", 14)} ${d.kind}</span><h4>${esc(d.name)}</h4><span class="ds">${d.status}</span></header>
      <p>${esc(d.rule)}</p>
      ${d.diff ? `<pre class="diff">${d.diff.map(([s, t]) => `<span class="dl ${s === "+" ? "add" : s === "-" ? "del" : "ctx"}"><i>${s === " " ? "&nbsp;" : s}</i>${esc(t)}</span>`).join("")}</pre>` : ""}
    </article>`;

  // A live mockup (Storybook) framed so it cannot be mistaken for the document.
  B.embed = (label = "Repeat menu, open") => `
    <figure class="embed">
      <div class="embed-bezel"><div class="embed-bar"><i></i><i></i><i></i><span>storybook · RepeatMenu.stories.tsx#Open</span></div>
        <div class="embed-screen"><div class="fake-menu"><div class="fm-title">Repeat</div>
          ${["Never", "Daily", "Weekdays", "Weekends", "Weekly", "Monthly", "Yearly", "Custom…"].map((x, i) => `<div class="fm-row ${i === 4 ? "on" : ""}">${x}</div>`).join("")}</div></div></div>
      <figcaption>${icon("eye", 14)} Live preview · ${esc(label)}</figcaption>
    </figure>`;

  B.spec = () => {
    const s = D.spec;
    return `
      <aside class="block"><p class="block-first">${icon("alert", 16)} <strong>You approve tasks that repeat from a menu, a custom screen, or the title. About 15 minutes.</strong></p>
        <ul><li class="verdict">Due dates become calendar days, for every feature with dates.</li><li>Risk tier high: the plan waits for your review.</li></ul></aside>
      <section class="spec-decisions"><h3>${icon("scale", 18)} Decisions</h3>${s.decisions.map(B.decision).join("")}</section>
      <section class="spec-stories"><h3>${icon("list", 18)} User stories</h3>
        <article class="story"><h4>${esc(s.stories[0])}</h4>
          <p>In a task's edit panel, a repeat menu offers never, daily, weekdays, weekends, weekly, monthly, yearly, and custom.</p>
          ${B.embed()}
          <div class="scenario"><p><span class="gk">Given</span> ${esc(s.scenario.given)},</p><p><span class="gk">When</span> ${esc(s.scenario.when)},</p><p><span class="gk">Then</span> ${esc(s.scenario.then)}.</p></div>
        </article>
        <article class="story"><h4>${esc(s.stories[1])}</h4><p>Completing a repeating task moves it to its next due date instead of marking it done. The row says so for 5 seconds, with an undo button.</p></article>
      </section>`;
  };

  B.messages = () =>
    D.session.messages
      .map((m) => {
        if (m.r === "tool")
          return `<div class="msg tool">${icon("terminal", 14)} <b>${esc(m.t)}</b> <span>${esc(m.meta)}</span></div>`;
        return `<div class="msg ${m.r}"><div class="who">${m.r === "user" ? icon("pencil", 14) + " You" : harness(D.session.harness, 14) + " " + D.session.model}</div><p>${esc(m.t)}</p></div>`;
      })
      .join("");

  B.constitution = () =>
    D.constitution
      .map(
        (p) => `
    <article class="principle"><span class="pn">${p.n}</span><div><h3>${esc(p.t)}</h3>
      <ul>${p.rules.map((r) => `<li>${esc(r).replace(/\b(MUST NOT|MUST|SHOULD|MAY)\b/g, "<b>$1</b>")}</li>`).join("")}</ul>
      <p class="rationale">${esc(p.why)}</p></div></article>`,
      )
      .join("");

  window.BLOCKS = B;
})();
