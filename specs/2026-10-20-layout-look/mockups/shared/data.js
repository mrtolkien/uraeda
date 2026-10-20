// Shared fake data for every direction's mockup: the same information architecture, drawn four ways.
// Content comes from this repository's real files (PRIORITIES.md, INBOX.md, the recurring-tasks example).
window.URA = {
  project: { name: "uraeda", branch: "main", repo: "mrtolkien/uraeda" },
  limits: {
    provider: "Claude Code",
    windowHours: 5,
    usedPct: 62,
    resetsIn: "1 h 48 min",
    week: 31,
  },
  steps: ["Proposal", "Discovery", "Questions", "Spec", "Plan", "Build", "Review", "Done"],
  features: [
    {
      slug: "layout-look",
      title: "Layout and look and feel",
      kind: "feature",
      step: 2,
      state: "awaiting-you",
      note: "12 questions, about 45 minutes",
      sessions: 1,
      diff: "+0 −0",
      tokens: "1.2M",
      age: "now",
    },
    {
      slug: "merge-chats",
      title: "Merge chats and changes",
      kind: "feature",
      step: 5,
      state: "building",
      note: "task 9 of 13",
      sessions: 3,
      diff: "+2 140 −612",
      tokens: "8.4M",
      age: "2 h",
    },
    {
      slug: "fix-testing",
      title: "Fix testing: flaky and unhelpful",
      kind: "feature",
      step: 3,
      state: "awaiting-you",
      note: "spec to approve, about 15 minutes",
      sessions: 1,
      diff: "+310 −90",
      tokens: "2.9M",
      age: "1 d",
    },
    {
      slug: "tasks-reappear",
      title: "Completed tasks reappear after reload",
      kind: "change",
      step: 5,
      state: "building",
      note: "fix in progress",
      sessions: 1,
      diff: "+18 −4",
      tokens: "0.4M",
      age: "20 min",
    },
    {
      slug: "ui-sandbox",
      title: "Stable dev environment for UI review",
      kind: "feature",
      step: 7,
      state: "done",
      note: "merged in #52",
      sessions: 0,
      diff: "+940 −12",
      tokens: "5.1M",
      age: "3 h",
    },
  ],
  sessions: [
    {
      id: "s1",
      title: "Discovery: layout and look",
      feature: "layout-look",
      harness: "claude",
      model: "Opus 5.5",
      state: "running",
      elapsed: "47 min",
    },
    {
      id: "s2",
      title: "Plan task 9: session overlay",
      feature: "merge-chats",
      harness: "claude",
      model: "Sonnet 5.5",
      state: "running",
      elapsed: "12 min",
    },
    {
      id: "s3",
      title: "Review the merge-chats diff",
      feature: "merge-chats",
      harness: "codex",
      model: "gpt-5.5",
      state: "waiting",
      elapsed: "2 min",
    },
    {
      id: "s4",
      title: "Fix reappearing tasks",
      feature: "tasks-reappear",
      harness: "pi",
      model: "local",
      state: "running",
      elapsed: "20 min",
    },
  ],
  inbox: [
    {
      cat: "UI",
      notes: [
        "Home does not use the same icons as the sidebar: this is clearly AGAINST the ui coherence decision",
        "In clarifications the card with two columns felt cramped: the card should be wider, the right column right-aligned",
        '"Why it matters" should be a question callout',
        '"Drafting a priority" is ass btw. It should be "Turn a priority into a draft".',
        "In clarifications of inbox triage, most notes were cut: very hard to read",
      ],
    },
    { cat: "Quickfixes", notes: [] },
    { cat: "Prompts", notes: [] },
    {
      cat: "Deferred fixes",
      notes: [
        '[fix-testing] Server error page: "Try again" does not recover once the server is back; only a reload does',
        "[fix-testing] Phone navigation: the drawer is not a history entry, so Back leaves the page where a sheet's Back closes the sheet",
        "[ui-sandbox] Sandbox seed: the stale-lock recovery itself needs a lock",
      ],
    },
  ],
  priorities: [
    {
      group: "Ongoing",
      items: [
        {
          t: "Fix testing: it is flaky and does not actually help",
          s: "spec to approve",
          slug: "fix-testing",
        },
        { t: "Merge chats and changes", s: "building, task 9 of 13", slug: "merge-chats" },
      ],
    },
    {
      group: "Now",
      items: [
        {
          t: "Layout and look and feel: information architecture first, then prototyped directions",
          s: "questions waiting",
          slug: "layout-look",
        },
        { t: "Empty inbox", s: "" },
        {
          t: "Onboarding + README pass: claude setup, what to read in which order",
          s: "",
          sub: [
            "Easy to read human guide",
            "Setup with agent (checks project, creates relevant files)",
          ],
        },
      ],
    },
    {
      group: "Next",
      items: [
        { t: "Neovim plugin: open priorities/inbox shortcut, shortcuts review", s: "" },
        { t: "References (docs) querying and storing workflow", s: "" },
        {
          t: "Worker lifecycle: runs survive restarts, usage limits, background work",
          s: "draft",
          draft: true,
        },
        {
          t: "Keyboard navigation in web UI",
          s: "",
          sub: ["Leader-key inspired nav and/or vimium", "Vim mode in text editing?"],
        },
        { t: "Run options: master session vs one session per step", s: "" },
        { t: "Passkeys to sign in", s: "" },
      ],
    },
    {
      group: "Later",
      items: [
        { t: "Monorepo support: multiple specs folders", s: "" },
        { t: "Multi-repo projects", s: "" },
        { t: "Adversarial review flow with a secondary model", s: "" },
      ],
    },
  ],
  // The clarifications page: the human's most important page. Real card from the recurring-tasks example.
  clarifications: {
    feature: "recurring-tasks",
    title: "Clarifications, round 01: Recurring tasks",
    count: "7 questions and 1 follow-up, about 35 minutes",
    block: [
      "Verdict: worth building, with changes: the proposal's two clicks take three today, and a task without a due date has nothing to repeat from.",
      "Two choices last beyond this feature: how users pick a repeat, and how due dates are stored.",
      "When the next occurrence appears decides what editing, deleting, and undoing a repeating task mean.",
      'Three points are settled without you, at the end: check the one under "Check these".',
    ],
    context: {
      goal: 'The proposal asks for tasks that come back once completed, like "water the plants" every week. Users set them in two clicks, and the app stays simple for the people who use it.',
      today:
        "A task has a title, an optional due date, and a done flag, stored in IndexedDB by the task store. It is edited in a panel with two fields. The app only runs while it is open.",
      table: [
        ["Microsoft To Do", "presets, and a custom option", "the task's details"],
        ["Todoist", "a rule typed in the due date field", "the due date field"],
        ["Google Calendar", "a menu, and a custom screen", 'next to "Does not repeat"'],
      ],
      scope:
        "Repeating a task, its next due date, and how the list shows it. Reminders are left out.",
      sources: [
        "The task store and the edit panel",
        "Help pages of Microsoft To Do, Todoist, Google Calendar",
        "date-fns addMonths, MDN Temporal",
        "The full investigation: discovery-01.md",
      ],
    },
    questions: [
      {
        n: 1,
        title: "How should users pick when a task repeats?",
        answered: "B and C",
        example: "",
        body: 'Microsoft To Do offers presets plus a custom option. Todoist reads a rule typed in the due date field, like "every 3 months". Google Calendar has a custom screen.',
        why: 'This sets how complex the edit panel gets, and what "every 2 weeks" would cost later.',
        options: [
          {
            k: "A",
            rec: true,
            t: "Presets only: daily, weekdays, weekly, monthly, yearly.",
            pro: "one choice, nothing to learn.",
            con: 'no "every 2 weeks".',
            why: "The constitution puts simplicity first, and A can grow into B later.",
          },
          {
            k: "B",
            t: "The presets, plus a custom screen for intervals and days of the week.",
            pro: "covers almost every request, like Microsoft To Do.",
            con: "a second, more technical screen.",
          },
          {
            k: "C",
            t: 'A rule typed in the task\'s due date field ("every Monday"), read by the app, like Todoist.',
            pro: "the fastest path for users who know the syntax.",
            con: "the syntax has to be learned.",
          },
        ],
      },
      {
        n: 2,
        title: "When does the next occurrence appear?",
        answered: null,
        example: '"Water the plants" repeats every Monday. You complete it on Monday 5 October.',
        body: "The app cannot create tasks while it is closed. Todoist keeps a single task and moves its due date on completion. This choice also decides what editing, deleting, and undoing mean for a repeating task.",
        why: "It decides whether future tasks show, whether completed ones stay as a history, and whether the app needs a notion of series.",
        options: [
          {
            k: "A",
            rec: true,
            t: "Create the next occurrence as a new task when the current one is completed. Editing a task changes that task only.",
            ex: 'A new "Water the plants" due Monday 12 October appears, and the completed one stays.',
            pro: "completed tasks stay as a history; no notion of series.",
            con: "the list grows by one task per completion.",
            why: "It keeps the history with the simplest model.",
          },
          {
            k: "B",
            t: "Create the next 4 occurrences in advance, so they are always visible.",
            ex: "The tasks due 12, 19, and 26 October and 2 November are in the list from the start.",
            pro: "users can plan ahead.",
            con: "four times more repeating tasks in the list.",
          },
          {
            k: "C",
            t: "Keep a single task, and move its due date to the next occurrence when it is completed, like Todoist.",
            ex: 'The same "Water the plants" now shows Monday 12 October, and 5 October leaves no trace.',
            pro: "the list never grows.",
            con: "completed occurrences disappear.",
          },
        ],
      },
    ],
    more: [
      "Where does the repeat choice appear?",
      "How are due dates stored?",
      "What does undo restore?",
      "Can users end a repetition after N times?",
      "What does the list show for a repeating task?",
    ],
    settled: {
      check: [["Reminders", "Left out of this feature: they are next in the priorities."]],
      behaviour: [
        [
          "Undoing a completion",
          "puts back the previous due date, for 5 seconds, in the task row.",
        ],
      ],
      hood: [["Date arithmetic", "lives in one module, src/lib/dates.ts."]],
    },
  },
  spec: {
    title: "Spec: Recurring tasks",
    status: "approved",
    revision: 2,
    stories: [
      "US1: Make a task repeat (P1)",
      "US2: Complete a repeating task (P1)",
      "US3: Type the rule in the title (P2)",
    ],
    decisions: [
      {
        kind: "New",
        name: "Repeating tasks",
        rule: "A repeating task is one task, whose due date moves when it is completed, with no history of completions.",
        status: "proposed",
      },
      {
        kind: "Changed",
        name: "Due dates",
        rule: "Due dates are calendar days, and all date arithmetic lives in src/lib/dates.ts.",
        status: "proposed",
        diff: [
          ["-", "Due dates MUST be stored as ISO timestamps with the user's time zone."],
          ["+", "Due dates MUST be stored as calendar days (YYYY-MM-DD), without a time zone."],
          [" ", "All date arithmetic MUST live in src/lib/dates.ts."],
        ],
      },
    ],
    scenario: {
      given: "an open task due Monday the 5th",
      when: 'the user opens the repeat menu and picks "weekly"',
      then: "the task repeats every Monday, and shows the repeat icon in the list",
    },
  },
  session: {
    title: "Discovery: layout and look",
    harness: "claude",
    model: "Opus 5.5",
    messages: [
      {
        r: "user",
        t: "Start on the layout and look and feel feature. Do extremely in-depth research.",
      },
      {
        r: "agent",
        t: "I read the proposal and the current UI code. The shell, the home and the clarifications page grew view by view. I will research how agent tools lay out parallel sessions, then compare four visual directions.",
      },
      { r: "tool", t: "Read packages/web/src/Home.tsx", meta: "2 files, 640 lines" },
      { r: "tool", t: "WebFetch kiro.dev/crew", meta: "source fetched" },
      {
        r: "agent",
        t: "Kiro Crew keeps chat in a side panel and puts artifacts in floating panels. Zed docks panels left, right and bottom. Both let the content take the full width when the panels fold. That fits your half-screen use.",
      },
      { r: "user", t: "Can the session come from the bottom on the questions page?" },
      {
        r: "agent",
        t: "Yes. A bottom sheet keeps the questions visible above it, which the proposal asks for. I will draw it in each direction.",
      },
    ],
    side: {
      sources: ["kiro.dev/crew", "zed.dev", "deepseek.com/harness"],
      files: ["discovery-01.md", "clarifications-01.md"],
      subs: ["Research: layout references", "Research: visual directions"],
    },
  },
  constitution: [
    {
      n: "I",
      t: "Humans stay in control",
      rules: [
        "Agents MUST stay within the scope and decisions a human approved.",
        "Agents MUST NOT activate a decision unless a human explicitly asks them to.",
      ],
      why: "Uraeda exists so agents cannot make consequential choices without the human knowing.",
    },
    {
      n: "II",
      t: "Git and plain text first",
      rules: ["Workflow state, decisions, and design changes MUST be stored as plain text in git."],
      why: "git gives history, review, and traceability for free.",
    },
    {
      n: "III",
      t: "Asynchronous by default",
      rules: [
        "Every workflow step MUST be completable with a git commit, without a live chat session.",
      ],
      why: "Humans answer when they have time and agents run when triggered.",
    },
    {
      n: "IV",
      t: "Review effort matches impact",
      rules: ["Every question asked to a human MUST come with a recommended answer."],
      why: "Human attention is the scarcest resource in the workflow.",
    },
    {
      n: "V",
      t: "Tools are optional",
      rules: [
        "The workflow MUST work with any agent, with or without the uraeda CLI, web UI, or remote workers.",
      ],
      why: "The workflow is the product. Tools make it faster and safer.",
    },
    {
      n: "VI",
      t: "Code is checked and stays maintainable",
      rules: [
        "A test MUST fail when behaviour that matters breaks, and MUST NOT fail when a change keeps it.",
      ],
      why: "Agents grow and copy code feature after feature unless something measured stops them.",
    },
  ],
  decisions: [
    { name: "UI layout", icon: "layout", status: "active", rules: 7 },
    { name: "UI components", icon: "box", status: "active", rules: 8 },
    { name: "Preview", icon: "eye", status: "active", rules: 6 },
    { name: "Stack", icon: "layers", status: "active", rules: 9 },
    { name: "Sign-in", icon: "key", status: "active", rules: 5 },
    { name: "Git", icon: "git", status: "active", rules: 7 },
    { name: "Notifications", icon: "bell", status: "proposed", rules: 4 },
  ],
};
