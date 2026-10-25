// The feature page's layout mockup. `?state=` picks the feature's state, `?page=proposal` the
// proposal's page, `?menu=1` opens the name's "…", `?fold=1` folds the column. Made-up data.
const query = new URLSearchParams(location.search);
const state = query.get("state") ?? "building";
const page = query.get("page") ?? "home";
const menuOpen = query.get("menu") === "1";
const folded = query.get("fold") === "1";

const FEATURE = {
  title: "Recurring tasks",
  kind: "Feature",
  slug: "2026-10-06-recurring-tasks",
  started: "Oct 6",
};
const CHANGE = {
  title: "Completed tasks reappear after reload",
  kind: "Change",
  slug: "2026-10-14-tasks-reappear",
  started: "Oct 14",
};

// Each state: the item, its stages, Next, its sessions, its figures, its links.
const STAGES = {
  proposal: { name: "Proposal", files: [["Proposal", "committed"]] },
  questions: {
    name: "Questions",
    files: [
      ["Discovery 01", "committed"],
      ["Questions 01", "answered"],
    ],
  },
  spec: {
    name: "Spec",
    files: [
      ["Spec", "approved"],
      ["Data model", "committed"],
      ["mockups/settings.html", ""],
    ],
  },
  plan: {
    name: "Plan",
    files: [
      ["Plan", "auto-approved"],
      ["Rulings", "4"],
    ],
  },
};

function stage(mark, base, when, extra = "", files = base.files) {
  return { mark, name: base.name, when, extra, files };
}

const STATES = {
  building: {
    item: FEATURE,
    stages: [
      stage("done", STAGES.proposal, "Oct 6, 09:12 · 20 min"),
      stage("done", STAGES.questions, "09:32 · 3 h 10 min · 1 round"),
      stage("done", STAGES.spec, "12:42 · 1 h 40 min"),
      stage("done", STAGES.plan, "14:22 · 18 min"),
      {
        mark: "cur",
        name: "Build",
        when: "since 14:40",
        tasks: true,
        files: [],
      },
      { mark: "todo", name: "Pull request", files: [] },
      { mark: "todo", name: "Merged", files: [] },
    ],
    next: {
      who: "The agent is building",
      big: "Task 5 of 9: Undo restores the previous due date",
      bar: 52,
      line: "Working for 6 min · 2 sub-agents",
      button: ["Open the session", false],
    },
    sessions: [
      ["●", "green", "Build the plan", "working", "Stop"],
      ["○", "dim", "Discovery and spec", "Oct 6, 09:14"],
    ],
    produced: [
      [
        "lines",
        '<span class="green">+1,204</span> <span class="red">−310</span><small>23 files</small>',
      ],
      ["tokens", "5.2 M in<small>113 k out</small>"],
      ["agent time", "2 h 51 min"],
      ["elapsed", "6 h 02 min"],
    ],
    links: [
      ["branch", "2026-10-06-recurring-tasks"],
      ["worktree", ".worktrees/2026-10-06-recurring-tasks"],
    ],
    hints: "] fold column",
  },
  idle: {
    item: FEATURE,
    stages: [
      stage("done", STAGES.proposal, "Oct 6, 09:12 · 20 min"),
      stage("done", STAGES.questions, "09:32 · 3 h 10 min · 1 round"),
      stage("done", STAGES.spec, "12:42 · 1 h 40 min", "", [
        ["Spec", "approved"],
        ["Data model", "committed"],
        ["mockups/settings.html", ""],
      ]),
      { mark: "cur", name: "Plan", when: "since 14:22", files: [] },
      { mark: "todo", name: "Build", files: [] },
      { mark: "todo", name: "Pull request", files: [] },
      { mark: "todo", name: "Merged", files: [] },
    ],
    next: {
      who: "The agent writes the plan",
      big: "Spec approved: the agent is idle",
      line: "Nothing runs. Continuing opens the session with its message, unsent.",
      button: ["Continue, write the plan", true],
    },
    sessions: [["☾", "dim", "Discovery and spec", "Idle"]],
    produced: [
      [
        "lines",
        '<span class="green">+412</span> <span class="red">−0</span><small>6 files</small>',
      ],
      ["tokens", "1.9 M in<small>41 k out</small>"],
      ["agent time", "52 min"],
      ["elapsed", "5 h 10 min"],
    ],
    links: [
      ["branch", "2026-10-06-recurring-tasks"],
      ["worktree", ".worktrees/2026-10-06-recurring-tasks"],
    ],
    hints: "] fold column",
  },
  gate: {
    item: FEATURE,
    stages: [
      stage("done", STAGES.proposal, "Oct 6, 09:12 · 20 min"),
      stage("done", STAGES.questions, "09:32 · 3 h 10 min · 1 round"),
      {
        mark: "cur",
        name: "Spec",
        when: "since 12:42 · revision 2",
        files: [
          ["Spec", "to review", "wait"],
          ["Data model", "committed"],
          ["mockups/settings.html", ""],
        ],
      },
      { mark: "todo", name: "Plan", files: [] },
      { mark: "todo", name: "Build", files: [] },
      { mark: "todo", name: "Pull request", files: [] },
      { mark: "todo", name: "Merged", files: [] },
    ],
    next: {
      who: "You review the spec",
      big: "Spec to review, revision 2, about 10 minutes.",
      button: ["Review the spec", true],
      attn: true,
    },
    sessions: [["☾", "dim", "Discovery and spec", "Idle"]],
    produced: [
      [
        "lines",
        '<span class="green">+388</span> <span class="red">−12</span><small>5 files</small>',
      ],
      ["tokens", "1.6 M in<small>36 k out</small>"],
      ["agent time", "47 min"],
      ["elapsed", "4 h 02 min"],
    ],
    links: [
      ["branch", "2026-10-06-recurring-tasks"],
      ["worktree", ".worktrees/2026-10-06-recurring-tasks"],
    ],
    hints: "] fold column",
  },
  blocked: {
    item: FEATURE,
    blocked: true,
    stages: [
      stage("done", STAGES.proposal, "Oct 6, 09:12 · 20 min"),
      {
        mark: "cur",
        name: "Questions",
        when: "since 09:32 · 1 round",
        files: [
          ["Discovery 01", "committed"],
          ["Questions 01", "1 blank answer", "wait"],
        ],
      },
      { mark: "todo", name: "Spec", files: [] },
      { mark: "todo", name: "Plan", files: [] },
      { mark: "todo", name: "Build", files: [] },
      { mark: "todo", name: "Pull request", files: [] },
      { mark: "todo", name: "Merged", files: [] },
    ],
    next: {
      who: "Nothing can go on",
      big: "Fix the file above: the workflow cannot tell what comes next.",
    },
    sessions: [["☾", "dim", "Discovery and spec", "Idle"]],
    produced: [
      [
        "lines",
        '<span class="green">+190</span> <span class="red">−0</span><small>3 files</small>',
      ],
      ["tokens", "0.9 M in<small>22 k out</small>"],
      ["agent time", "42 min"],
      ["elapsed", "1 h 20 min"],
    ],
    links: [["branch", "2026-10-06-recurring-tasks"]],
    hints: "] fold column",
  },
  change: {
    item: CHANGE,
    stages: [
      stage("done", STAGES.proposal, "Oct 14, 10:02 · 5 min"),
      {
        mark: "done",
        name: "Questions",
        when: "10:07 · 40 min · 1 round",
        files: [["Questions 01", "answered"]],
      },
      {
        mark: "cur",
        name: "Fix",
        when: "since 10:47",
        files: [["Rulings", "2"]],
      },
      { mark: "todo", name: "Pull request", files: [] },
      { mark: "todo", name: "Merged", files: [] },
    ],
    next: {
      who: "The agent is fixing it",
      big: "Writing the failing test first",
      line: "Working for 3 min",
      button: ["Open the session", false],
    },
    sessions: [["●", "green", "Fix tasks reappearing", "working", "Stop"]],
    produced: [
      ["lines", '<span class="green">+38</span> <span class="red">−6</span><small>2 files</small>'],
      ["tokens", "0.4 M in<small>9 k out</small>"],
      ["agent time", "14 min"],
      ["elapsed", "52 min"],
    ],
    links: [
      ["branch", "change/2026-10-14-tasks-reappear"],
      ["worktree", ".worktrees/2026-10-14-tasks-reappear"],
    ],
    hints: "] fold column",
  },
  done: {
    item: FEATURE,
    done: true,
    stages: [
      stage("done", { name: "Proposal" }, "Oct 6, 09:12 · 20 min", "", []),
      stage("done", { name: "Questions" }, "09:32 · 3 h 10 min · 1 round", "", []),
      stage("done", { name: "Spec" }, "12:42 · 1 h 40 min", "", []),
      stage("done", { name: "Plan" }, "14:22 · 18 min", "", []),
      stage("done", { name: "Build" }, "14:40 · 2 h 55 min", "", []),
      stage("done", { name: "Pull request" }, "17:35 · 1 h 12 min", "", []),
      stage("done", { name: "Merged" }, "Oct 6, 18:47", "", [["Record", ""]]),
    ],
    next: {
      who: "Merged",
      big: "On Oct 6, in pull request #31.",
      button: ["Open pull request #31", false, true],
    },
    sessions: [
      ["○", "dim", "Build the plan", "Oct 6, 14:40"],
      ["○", "dim", "Discovery and spec", "Oct 6, 09:14"],
    ],
    produced: [
      ["total time", "9 h 35 min<small>09:12 to 18:47</small>"],
      [
        "lines",
        '<span class="green">+1,530</span> <span class="red">−344</span><small>27 files</small>',
      ],
      ["tokens", "6.8 M in<small>151 k out</small>"],
      ["agent time", "3 h 44 min"],
      ["questions", '<a href="#record-questions">7</a><small>1 round</small>'],
      ["decisions", '<a href="#record-decisions">1</a><small>new or changed</small>'],
    ],
    links: [["pull request", '<a href="#">#31 ↗</a>']],
    hints: "] fold column",
  },
};

const s = STATES[state] ?? STATES.building;

function shell() {
  const on = s.item === CHANGE ? "Completed tasks reappear" : "Recurring tasks";
  return `
  <nav class="shell" aria-label="Uraeda">
    <div class="logo">⣿ Uraeda <span class="dim">todo-app</span></div>
    <div class="btns"><span class="btn fill">＋ New</span><span class="btn quiet">✎ Note</span></div>
    <div class="pane"><span class="t">Navigate</span>
      <div class="item">⌂ Home</div><div class="item">✉ Inbox</div><div class="item">☰ Priorities</div><div class="item">⚖ Decisions</div>
    </div>
    <div class="pane attn"><span class="t">Needs you <span class="n">· 1</span></span>
      <div class="item">◆ Keyboard shortcuts<small>Questions · 6, 20 min</small></div>
    </div>
    <div class="pane"><span class="t">In progress <span class="n">· 2</span></span>
      <div class="item ${on === "Recurring tasks" ? "on" : ""}">● Recurring tasks<small>${s === STATES.done ? "Merged" : stepOf()}</small></div>
      <div class="item ${on !== "Recurring tasks" ? "on" : ""}">○ Completed tasks reappear<small>Fix</small></div>
    </div>
    <div class="rail"><span>⣿</span><span>＋</span><span>⌂</span><span>✉</span><span>☰</span><span class="on">●</span></div>
  </nav>`;
}

function stepOf() {
  const cur = s.stages.find((st) => st.mark === "cur");
  return cur ? cur.name : "Merged";
}

function head() {
  const meta = [
    s.item.kind,
    `started ${s.item.started}`,
    s.done ? "merged Oct 6" : `branch ${s.item.slug}`,
  ].join(" · ");
  const menu = s.done
    ? ""
    : `<button class="icon" aria-label="${s.item.kind} actions" aria-expanded="${menuOpen}">…</button>`;
  const list = menuOpen
    ? `<div class="menu" role="menu"><div class="on">✎ Rename</div><div class="danger">✕ Drop the ${s.item.kind.toLowerCase()}…</div></div>`
    : "";
  return `<div class="head"><h1>${s.item.title}</h1>${menu}${list}</div><div class="meta">${meta}</div>`;
}

function banner() {
  if (!s.blocked) return "";
  return `<div class="banner" role="alert"><b>This feature cannot go on.</b>
    <div class="sub">specs/2026-10-06-recurring-tasks/clarifications-01.md: Q4 has no answer.</div>
    <div style="margin-top:8px"><span class="btn">Open clarifications-01.md</span></div></div>`;
}

function next() {
  const n = s.next;
  const bar = n.bar ? `<div class="bar"><i style="width:${n.bar}%"></i></div>` : "";
  const line = n.line ? `<div class="line">${n.line}</div>` : "";
  const button = n.button
    ? `<span class="btn ${n.button[1] ? "fill" : ""}">${n.button[0]}${n.button[2] ? " ↗" : ""}</span>`
    : "";
  return `<section class="pane ${n.attn ? "attn" : "active"} next" aria-labelledby="next-title">
    <span class="t" id="next-title">Next</span>
    <div class="who">${n.who}</div>
    <div class="big">${n.big}</div>${bar}${line}${button}</section>`;
}

function timeline() {
  const marks = { done: "✓", cur: "◉", todo: "○" };
  const rows = s.stages
    .map((st) => {
      const files = st.files.length
        ? `<div class="files">${st.files
            .map(
              ([name, status, tone]) =>
                `<span><a href="#">${name}</a>${status ? ` <span class="st ${tone ?? ""}">· ${status}</span>` : ""}</span>`,
            )
            .join("")}</div>`
        : "";
      const tasks = st.tasks
        ? `<div class="tasks">
            <div class="row"><span class="green">✓ Tasks 1–4</span><span class="dim">wave 1 · 48 min</span></div>
            <div class="row"><span class="mauve">◉ 5 Undo restores the previous due date</span><span class="dim">6 min</span></div>
            <div class="row"><span class="dim">○ Tasks 6–9</span><span class="dim">waves 2–3</span></div>
          </div>`
        : "";
      const when = st.when ? `<span class="when">${st.when}</span>` : "";
      const current = st.mark === "cur" ? ' aria-current="step"' : "";
      return `<li class="stage ${st.mark}"${current}><span class="mark" aria-hidden="true">${marks[st.mark]}</span>
        <div><div class="sname"><b>${st.name}</b>${when}</div>${files}${tasks}</div></li>`;
    })
    .join("");
  return `<section class="pane" id="timeline" aria-labelledby="timeline-title">
    <span class="t" id="timeline-title">Timeline</span><ol class="spine">${rows}</ol></section>`;
}

function record() {
  if (!s.done) return "";
  return `
  <section class="pane"><span class="t">What and why</span><div class="prose"><p>A task can repeat every day, week, or month. Completing it creates the next occurrence, due on the next date of its pattern.</p></div></section>
  <section class="pane"><span class="t">Behaviour</span><div class="prose"><p><b>Repeat a task (US1).</b> The task's menu offers Daily, Weekly, Monthly, and Custom…</p></div></section>
  <section class="pane new" id="record-decisions"><span class="t">Decisions <span class="n">· 1 new</span></span><div class="prose"><p><b>Task storage</b>: a repetition is stored on the task.</p></div></section>
  <section class="pane" id="record-questions"><span class="t">▸ Questions <span class="n">· 7, 1 round</span></span></section>
  <section class="pane"><span class="t">Follow-ups</span><div class="prose"><p>Editing one occurrence alone is left for later.</p></div></section>
  <div><a href="#">Open the record's file</a></div>`;
}

function column() {
  if (folded) {
    return `<aside class="folded" aria-label="The feature's column, folded"><span title="Sessions">◷</span><span title="Figures">Σ</span><span title="Links">⎇</span></aside>`;
  }
  const sessions = s.sessions
    .map(
      ([mark, tone, name, status, stop]) =>
        `<div class="row"><span><span class="${tone}">${mark}</span> <a href="#">${name}</a></span><span class="v dim">${status}${stop ? ` <span class="btn quiet" style="padding:0 8px">Stop</span>` : ""}</span></div>`,
    )
    .join("");
  const produced = s.produced
    .map(
      ([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`,
    )
    .join("");
  const links = s.links
    .map(
      ([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`,
    )
    .join("");
  return `<aside class="col" aria-label="The feature's column"><span class="grip"></span><div class="stack">
    <section class="pane"><span class="t">Sessions <span class="n">· ${s.sessions.length}</span></span>${sessions}
      <div style="margin-top:10px"><span class="btn quiet">＋ New session</span></div></section>
    <section class="pane"><span class="t">${s.done ? "What it produced" : "Produced so far"}</span>${produced}</section>
    <section class="pane"><span class="t">Links</span>${links}</section>
  </div></aside>`;
}

function homePage() {
  return `<main class="main"><div class="tabs"><span>⌂</span><span>✉</span><span>☰</span><span>◷</span><span>⚙</span><span class="mauve">＋</span></div>
    <div class="page">${head()}${banner()}<div class="stack">${next()}${timeline()}${record()}</div></div>
    ${narrowColumn()}</main>`;
}

// On the phone, the column's panes come after the timeline, in the page's one column.
function narrowColumn() {
  return `<div class="narrow-col"></div>`;
}

function proposalPage() {
  return `<main class="main"><div class="tabs"><span>⌂</span><span>✉</span><span>☰</span><span>◷</span><span>⚙</span><span class="mauve">＋</span></div>
  <div class="page">
    <div class="meta"><a href="feature.html?state=${state}">Recurring tasks</a> › proposal.md</div>
    <div class="head"><h1>Recurring tasks</h1><span class="btn quiet" style="margin-left:auto">Edit</span></div>
    <div class="meta">Proposal · committed Oct 6</div>
    <div class="stack">
      <section class="pane" id="what"><span class="t">What</span><div class="prose"><p>Tasks that repeat: every day, every week on chosen days, or every month. Completing one creates the next.</p></div></section>
      <section class="pane" id="why"><span class="t">Why</span><div class="prose"><p>I water the plants every Monday and re-type the task each week.</p></div></section>
      <section class="pane" id="notes"><span class="t">Notes</span><div class="prose"><p>Todoist moves the due date; I would rather keep the completed ones as a history.</p></div></section>
    </div>
  </div></main>
  <aside class="col doc" aria-label="The proposal's column"><span class="grip"></span>
    <div class="ctabs" role="tablist"><span class="on" role="tab" aria-selected="true">☰ Contents</span><span role="tab">◷ Session</span></div>
    <div class="outline"><div class="on">What</div><div>Why</div><div>Notes</div></div>
  </aside>`;
}

const app = document.getElementById("app");
const isDoc = page === "proposal";
app.className = `app ${folded && !isDoc ? "nocol" : ""}`;
app.innerHTML = shell() + (isDoc ? proposalPage() : homePage() + column());

// On the phone, move the column's panes into the page's one column, after the timeline.
function placeColumn() {
  const col = document.querySelector("aside.col:not(.doc)");
  const slot = document.querySelector(".narrow-col");
  if (!col || !slot) return;
  if (matchMedia("(max-width: 767px)").matches) {
    slot.appendChild(col);
  } else if (col.parentElement === slot) {
    app.appendChild(col);
  }
}
placeColumn();
addEventListener("resize", placeColumn);

const status = document.getElementById("status");
const narrow = matchMedia("(max-width: 767px)").matches;
status.innerHTML = isDoc
  ? narrow
    ? `<span class="k">☰ Contents</span><span class="k">◷ Session</span><span class="r">1 need you · 1 running</span>`
    : `<span><span class="k">]</span> fold column</span><span class="r">1 need you · 1 running</span>`
  : narrow
    ? `<span class="r">1 need you · 1 running</span>`
    : `<span><span class="k">]</span> fold column</span><span class="r">1 need you · 1 running</span>`;

document.getElementById("legend").textContent = isDoc
  ? "The proposal's page: each ## section a pane, Contents and Session beside it."
  : `State: ${state}${menuOpen ? ", the name's menu open" : ""}${folded ? ", column folded" : ""}.`;
