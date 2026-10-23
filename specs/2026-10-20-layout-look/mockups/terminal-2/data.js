// Extra fake data for the second round: the repository's real decisions, with two or three of their rules each.
// Rule texts are shortened from the files in specs/decisions/. "rev" marks a decision this feature would change.
window.URA2 = {
  groups: ["Product", "UI", "Platform", "CLI"],
  decisions: [
    {
      n: "Agents",
      g: "Product",
      rules: 8,
      ch: "4 d ago",
      r: [
        [
          "MUST",
          "The server runs the user's installed agent, and does not bundle one or depend on its SDK.",
        ],
        ["MUST", "Every agent is reached through one adapter that keeps its formats inside."],
        ["MUST", "Sessions, turns, and items are stored and shown in one agent-neutral shape."],
      ],
    },
    {
      n: "Attachments",
      g: "Product",
      rules: 7,
      ch: "4 d ago",
      r: [
        [
          "MUST",
          "An image attached to a workflow file is committed beside that file, with a relative link.",
        ],
        ["MUST", "Images attached to a chat stay out of git, in Uraeda's data folder."],
      ],
    },
    {
      n: "Notifications",
      g: "Product",
      rules: 6,
      ch: "4 d ago",
      status: "proposed",
      r: [
        ["MUST", "A notification is shown only when an item comes to need the human."],
        [
          "MUST",
          "The browser's permission is asked only after the human is told what will notify.",
        ],
        ["MUST NOT", "Notifications interrupt a human who is already looking at Uraeda."],
      ],
    },
    {
      n: "Problems",
      g: "Product",
      rules: 6,
      ch: "4 d ago",
      r: [
        [
          "MUST",
          "A check result counts as a feature's problem only when its rule stops the workflow.",
        ],
        ["MUST", "Home and the sidebar's cards show problems only, never notes."],
      ],
    },
    {
      n: "Repositories",
      g: "Product",
      rules: 8,
      ch: "4 d ago",
      r: [
        ["MUST", "The list is data in the data folder, never in a repository."],
        ["MUST", "One server serves every listed repository."],
      ],
    },
    {
      n: "Settings",
      g: "Product",
      rules: 7,
      ch: "4 d ago",
      r: [
        ["MUST", "Settings live in one TOML file in the config folder, on macOS too."],
        ["MUST", "A write keeps a human's comments, unknown keys, and order."],
        [
          "MUST",
          "A setting resolves from its flag, then its environment variable, the file, and its default.",
        ],
      ],
    },
    {
      n: "Sign-in",
      g: "Product",
      rules: 10,
      ch: "3 d ago",
      r: [
        [
          "MUST",
          "Every request carries a valid session, except the built UI's files and the sign-in routes.",
        ],
        ["MUST", "The access key is generated, shown once, and stored only as a hash."],
        ["MUST", "A session ends after 30 days without use."],
      ],
    },
    {
      n: "UI layout",
      g: "UI",
      rules: 8,
      ch: "4 d ago",
      rev: true,
      r: [
        [
          "MUST",
          "A view's spec says why its layout reads best, with mockups at both width classes.",
        ],
        [
          "MUST",
          "The UI adapts to two width classes, not to the device, through the theme and never per-view media queries.",
        ],
        ["MUST", "On narrow screens, views are pages and menus and forms are sheets."],
      ],
    },
    {
      n: "UI components",
      g: "UI",
      rules: 4,
      ch: "3 d ago",
      r: [
        ["MUST", "Views use Astryx components wherever one fits, styled only through its theme."],
        ["MUST", "Drag and drop uses @dnd-kit/react."],
      ],
    },
    {
      n: "UI coherence",
      g: "UI",
      rules: 7,
      ch: "3 d ago",
      r: [
        [
          "MUST",
          "A kind of information is drawn by one shared component on every page that shows it.",
        ],
        [
          "MUST NOT",
          "A page presents information its own way, without an extremely good reason in the plan.",
        ],
      ],
    },
    {
      n: "UI behaviour",
      g: "UI",
      rules: 9,
      ch: "3 d ago",
      r: [
        [
          "MUST",
          "Small edits happen in place, and a dialog only confirms an irreversible action or holds a form.",
        ],
        [
          "MUST",
          "Text saves only on an explicit action, and unsaved text is marked and never dropped.",
        ],
      ],
    },
    {
      n: "UI checks",
      g: "UI",
      rules: 4,
      ch: "4 d ago",
      r: [
        ["MUST", "Every UI test guards something a spec or decision asks for."],
        ["MUST NOT", "UI tests assert markup, class names, or pixels."],
      ],
    },
    {
      n: "Preview",
      g: "UI",
      rules: 6,
      ch: "4 d ago",
      rev: true,
      r: [
        ["MUST", "Uraeda's preview is the Storybook of packages/web."],
        ["MUST", "Mockups and named states of views are stories written with the real components."],
      ],
    },
    {
      n: "Diagrams",
      g: "UI",
      rules: 7,
      ch: "4 d ago",
      r: [
        ["MUST", "A diagram in a workflow file is a fenced mermaid code block."],
        ["MUST", "A diagram that fails to draw shows its source instead."],
      ],
    },
    {
      n: "Stack",
      g: "Platform",
      rules: 10,
      ch: "4 d ago",
      r: [
        ["MUST", "Workflow logic, parsing, validation, and states live in the Rust core."],
        ["MUST NOT", "The web UI parses markdown: it draws the core's document tree."],
      ],
    },
    {
      n: "Toolchain",
      g: "Platform",
      rules: 10,
      ch: "3 d ago",
      r: [
        [
          "MUST",
          "vp run ready runs every check of the repository, rerunning only what a change can affect.",
        ],
        ["MUST", "An agent runs vp run ready before pushing a branch."],
      ],
    },
    {
      n: "Distribution",
      g: "Platform",
      rules: 6,
      ch: "4 d ago",
      r: [
        ["MUST", "The web UI ships as an npm package that runs on the user's own Node."],
        ["MUST", "Releases are published from CI without a long-lived npm token."],
      ],
    },
    {
      n: "Git",
      g: "Platform",
      rules: 7,
      ch: "3 d ago",
      r: [
        ["MUST NOT", "Tools lose the user's work: no force-removed worktree, no force-push."],
        ["MUST NOT", "Tools bypass the user's hooks, signing, or credentials."],
      ],
    },
    {
      n: "Compatibility",
      g: "Platform",
      rules: 3,
      ch: "4 d ago",
      r: [["MUST NOT", "Before 1.0, a format change keeps the old format working."]],
    },
    {
      n: "Code quality",
      g: "Platform",
      rules: 6,
      ch: "4 d ago",
      r: [
        [
          "MUST",
          "Rust and TypeScript functions and files stay within limits on length and parameters.",
        ],
        ["MUST", "A custom lint rule says in its message how to fix the problem."],
      ],
    },
    {
      n: "Sandbox",
      g: "Platform",
      rules: 7,
      ch: "3 d ago",
      r: [
        [
          "MUST",
          "The sandbox serves the whole web UI from the checkout it runs in, over sample projects.",
        ],
        ["MUST NOT", "The sandbox reads or writes the human's real repositories or data folder."],
      ],
    },
    {
      n: "Benchmarks",
      g: "Platform",
      rules: 11,
      ch: "4 d ago",
      r: [
        ["MUST NOT", "Agents start a benchmark run without a human's explicit approval."],
        ["MUST", "A run loads the skill from a named commit, never from the working tree."],
      ],
    },
    {
      n: "CLI",
      g: "CLI",
      rules: 7,
      ch: "4 d ago",
      r: [
        ["MUST", "Every rule the CLI enforces is written in the skill."],
        ["MUST", "The CLI embeds the skill and its templates, with no second copy."],
      ],
    },
    {
      n: "TUI",
      g: "CLI",
      rules: 5,
      ch: "4 d ago",
      r: [
        ["MUST", "Every TUI of ura uses ratatui."],
        [
          "MUST",
          "A TUI restores the terminal on every exit, cancels, errors, and panics included.",
        ],
      ],
    },
  ],
  repos: [
    ["uraeda", "~/Development/ai/uraeda", "5 features"],
    ["notes", "~/Development/notes", "1 feature"],
  ],
};

// An icon, a one-line summary, and (for decisions this feature would change) a diff, per decision.
window.URA2.meta = {
  Agents: ["robot", "The user's own agent, reached through one adapter"],
  Attachments: ["image", "Images beside workflow files, or kept out of git in chats"],
  Notifications: ["bell", "Notify only when something comes to need you"],
  Problems: ["alert", "Only problems that stop the workflow reach the home"],
  Repositories: ["folder", "One server, and a list of repositories in the data folder"],
  Settings: ["settings", "One TOML file, with comments and order kept"],
  "Sign-in": ["key", "A hashed access key and 30-day sessions"],
  "UI layout": ["sidebar", "Two width classes, pages on phones, popovers on desktop"],
  "UI components": ["grid", "Astryx first, styled only through its theme"],
  "UI coherence": ["layers", "One shared component per kind of information"],
  "UI behaviour": ["pencil", "Edit in place, and save only on an explicit action"],
  "UI checks": ["flask", "Tests drive the UI like a user, at phone and desktop sizes"],
  Preview: ["eye", "Storybook with the real components and the real server"],
  Diagrams: ["diff", "Mermaid blocks, drawn with the pele package"],
  Stack: ["bolt", "A Rust core, a TypeScript server on Node, a React UI"],
  Toolchain: ["wrench", "vp run ready is the one check, locally and in CI"],
  Distribution: ["play", "An npm package that runs on the user's own Node"],
  Git: ["branch", "Never lose the user's work or bypass their hooks"],
  Compatibility: ["history", "Before 1.0, no old format is kept alive"],
  "Code quality": ["check", "Limits on size, a shared lint config, hints in messages"],
  Sandbox: ["leaf", "The whole UI over sample projects and a fake agent"],
  Benchmarks: ["gauge", "Runs need a human's approval and a named commit"],
  CLI: ["terminal", "The skill holds the rules, and the CLI embeds them"],
  TUI: ["panelB", "ratatui everywhere, and the terminal restored on every exit"],
};
window.URA2.groupIc = { Product: "bulb", UI: "sidebar", Platform: "layers", CLI: "terminal" };
window.URA2.principleIc = ["flag", "branch", "clock", "gauge", "wrench", "check"];
window.URA2.diffs = {
  "UI layout": [
    [
      "-",
      "The UI MUST adapt to two width classes, not to the device, through the theme and never per-view media queries.",
    ],
    [
      "+",
      "The UI MUST adapt to three width classes, narrow, semi-wide, and wide, not to the device, through the theme and never per-view media queries.",
    ],
    [" ", "On narrow screens, views MUST be pages and menus and forms sheets."],
  ],
  Preview: [
    ["-", "Mockups and named states of views MUST be stories written with the real components."],
    [
      "+",
      "An investigation MAY hold throwaway prototypes in any format under its mockups folder, and they MUST be deleted when the spec is approved.",
    ],
    [" ", "Named states of views MUST be stories written with the real components."],
  ],
};
