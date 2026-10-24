// Two real rounds of questions from this repository's history, as the prototype draws them. Inline
// markdown only: `code`, **bold**, and [links](…). Links are inert in the prototype.
//
// - merge-chats: specs/2026-10-20-merge-chats/clarifications-01.md at ce2147d3, whole.
// - layout-look: specs/2026-10-20-layout-look/clarifications-01.md at 6ed4502b, its block, its
//   context, Q4 and Q5 (the round's only questions with an "Example:" line), and its settled points.
window.ROUNDS = {
  "merge-chats": {
    feature: "Merge chats and changes",
    folder: "2026-10-20-merge-chats",
    title: "Clarifications, round 01: Merge chats and changes",
    block: {
      first: "7 questions and 1 follow-up, about 20 minutes.",
      verdict: [
        "with changes",
        "worth building, with changes: a chat cannot become a change today. A change becomes a feature only through a merge and a fresh start, so both moves must be built in place.",
      ],
      items: [
        "Who may upgrade lasts beyond this feature. An agent starting a change alone could create a branch, and commit on your default branch, without your yes.",
        "Where a chat works, and what it may change there, work together: they decide what happens to a chat's edits on your main checkout.",
        "Keeping the chat's conversation through the upgrade changes the agents decision's session rule.",
        "Two gaps in the proposal: what the features' `+` opens, and whether a feature can go back down.",
        "Check the settled point on the change's proposal, written from the chat in your words.",
      ],
    },
    context: {
      goal: [
        "The [proposal](proposal.md) asks for chats and changes to become one thing that grows: a chat, then a change on its own branch, then a feature. Moving up should be smooth, and the agent should offer it, or do it. Features get a `+` like the one next to Changes and Chats.",
      ],
      today: [
        {
          list: [
            "A **chat** is a row in the server's session cache, run in the main checkout, with nothing in git ([sessions](/packages/server/src/runner/sessions.ts)). It can be renamed and archived.",
            'A **change** starts from the "New change" page or a draft, with its own branch `change/<folder>`, worktree, and session ([New change](/packages/web/src/NewChangePage.tsx)). It runs the light flow: tests, review, a pull request ([change.md](/skills/uraeda/references/change.md)).',
            'When a chat asks for code, the skill\'s rule 8 has the agent offer a change in plain text. On yes, it starts the change as a new session, and "the chat stays a chat" ([SKILL.md](/skills/uraeda/SKILL.md)). Nothing in the UI supports the offer.',
            "A change becomes a feature through a round of questions. Then its code is reverted, its folder moved to `drafts/`, the branch merged, and the draft started again with a new session ([upgrading](/skills/uraeda/references/change.md#upgrading)).",
            'The sidebar has Changes with "＋ New change", Features with no `+`, then Chats with "＋ New chat" ([sidebar](/packages/web/src/sidebar/Sidebar.tsx)).',
          ],
        },
        {
          table: [
            ["Product", "Unit", "How work moves to a branch", "Conversation kept"],
            [
              "Codex",
              "a chat, local or worktree",
              "a Hand off button, uncommitted changes moved",
              "whole",
            ],
            [
              "Copilot",
              "a chat",
              'a Delegate button, "Include changes" or "Ignore changes"',
              "whole",
            ],
            [
              "Claude Code",
              "a session",
              'asked to "work in a worktree", uncommitted changes not carried',
              "whole",
            ],
            [
              "Cursor",
              "an agent",
              "moved into a worktree; suggests Plan Mode itself",
              "not documented",
            ],
            ["Kiro", "a session", "switch to Spec mode, no branch", "whole"],
          ],
        },
      ],
      scope: [
        "Starting and listing chats and changes, the move from a chat to a change, the move from a change to a feature, and the features' `+`. The change flow's steps stay as they are. A chat's right column stays in its [own draft](/specs/drafts/chat-right-column.md).",
      ],
      sources: [
        {
          list: [
            "The server's runner and fate mutations, the sidebar, and the New change page, linked above.",
            "The core's branch rules, and the skill's rule 8 and change reference, linked above.",
            "Codex, Copilot, Claude Code, Cursor, Kiro, Conductor, Spec Kit, and superpowers documentation.",
            "Two checks: a Claude Code session resumes from another folder, and a worktree's branch can be renamed in place.",
            "The full investigation is in [discovery](discovery-01.md). Each question links to its topic.",
          ],
        },
      ],
    },
    questions: [
      {
        id: "Q1",
        title: "Who may move a chat up to a change, or a change up to a feature?",
        context: [
          'Starting a change or a feature is a human action today. Rule 8 lets the agent offer a change, and start it only on your yes. Your proposal says the agent "should be able to upgrade it itself too if necessary, or at least offer it". Every product read leaves the move to a human\'s button. Cursor suggests Plan Mode by itself, and superpowers tells the agent to "stop, say so, and step up a size". More in [discovery](discovery-01.md#who-upgrades).',
          "During an unattended run, nobody is there to click: the change-to-feature offer stays a round of questions, as today, under every option.",
        ],
        why: "this becomes a rule of the [agents decision](/specs/decisions/agents.md), which every later agent follows. An agent upgrading alone creates a branch and a worktree. It also commits the **Now** entry on your default branch, without asking.",
        options: [
          {
            l: "A",
            rec: true,
            s: "The agent offers the upgrade in the session, as a card with a button. The card shows the title, the text, and the slug, which you can edit. An upgrade button sits in the session's header too.",
            pro: ["one click, and nothing starts without you."],
            con: ["the agent waits for your click before it goes on."],
            why: 'it keeps principle I, "humans stay in control", at the cost of one click.',
          },
          {
            l: "B",
            s: "The agent upgrades by itself when the work calls for it, and says so in the session. You can undo the upgrade from there.",
            pro: ["no wait at all: the work goes on."],
            con: ["branches, worktrees, and default-branch commits appear without your yes."],
          },
          {
            l: "C",
            s: "A button in the session's header only, with no offer from the agent.",
            pro: ["the agent never interrupts."],
            con: ["you must notice yourself that a chat has outgrown itself."],
          },
        ],
      },
      {
        id: "Q2",
        title: "Where does a new chat work?",
        context: [
          "A chat runs in your main checkout today, so its edits mix with yours. Codex and Claude Code start there by default too, with a worktree as a toggle. Conductor gives every workspace its own worktree and branch from the start. Inbox triage and the decisions check run as chats that must write on the default branch ([git decision](/specs/decisions/git.md)). More in [discovery](discovery-01.md#where-a-chat-works).",
          "What a chat may change on the main checkout is the follow-up, only with A.",
        ],
        why: "it decides whether an upgrade has to move edits off your checkout, and how much disk and setup each chat costs.",
        options: [
          {
            l: "A",
            rec: true,
            s: "In the main checkout, as today. The chat moves to the change's worktree when it is upgraded.",
            pro: ["instant start, and chit chat sees your checkout as it is."],
            con: ["the upgrade must move the chat's edits off your checkout."],
            why: "most chats never grow, and they should cost nothing.",
          },
          {
            l: "B",
            s: "In a worktree of its own, from a detached `HEAD`, from the first message. The upgrade names its branch.",
            pro: ["nothing to move: a chat's edits never touch your checkout."],
            con: [
              "a worktree per chat, to set up and clean up. Inbox triage would still need the main checkout.",
            ],
          },
        ],
      },
      {
        id: "Q2.A",
        parent: "Q2",
        letter: "A",
        title: "What may a chat change on your main checkout?",
        context: [
          'Only if you picked the main checkout, A in Q2. Rule 8 lets a chat on the main checkout fix typos, formatting, and comments, and offer a change for any other code. Your proposal describes a chat as "chit chat or targeted change", like plain Claude Code, which edits freely. Chats never commit code to the default branch under any option below. More in [discovery](discovery-01.md#what-a-chat-may-change).',
        ],
        why: "it sets where a chat stops and a change starts, and what an upgrade must carry.",
        options: [
          {
            l: "A",
            rec: true,
            s: "Targeted edits you ask for, left uncommitted for you to review. Larger work gets the upgrade offer first. On an upgrade, the files the chat edited move to the change's worktree and leave your checkout. Any other uncommitted file stays where it is.",
            pro: [
              "works like plain Claude Code for small things, and your own edits are never moved.",
            ],
            con: [
              "a file the chat changed through a shell command, not its edit tools, is not moved.",
            ],
            why: 'it matches your "targeted change", and leaves your own work untouched.',
          },
          {
            l: "B",
            s: "Today's rule: typos, formatting, and comments only. Any other code is offered as a change before a line is written.",
            pro: ["your checkout stays clean, and an upgrade moves nothing."],
            con: ["the short iteration loop of plain Claude Code is gone from chats."],
          },
          {
            l: "C",
            s: "Targeted edits you ask for, and on an upgrade every uncommitted change moves, after a list you confirm.",
            pro: ["nothing the chat did is left behind."],
            con: ["your own unrelated edits move too, unless you untick them."],
          },
        ],
      },
      {
        id: "Q3",
        title: "Does the chat's conversation become the change's session?",
        context: [
          "Today a change from a chat starts a new session: the agent starts over from the proposal. Codex, Copilot, and Claude Code keep the whole conversation when work moves. Claude Code's desktop keeps a summary when moving to the cloud. A Claude Code session resumes from another folder: checked in this round. More in [discovery](discovery-01.md#keeping-the-session).",
        ],
        why: 'the [agents decision](/specs/decisions/agents.md) says "a feature must have one session, in its worktree". Option A rewords it so a chat\'s session may become that session.',
        options: [
          {
            l: "A",
            rec: true,
            s: "The chat's session becomes the change's session, in its worktree. The agent is told it now works on the change's branch, and the chat leaves the Chats list for the change.",
            pro: ["nothing to repeat: the agent keeps all it learned."],
            con: ["a long chat carries its whole history into the change's runs."],
            why: "smooth switching is the point of the proposal.",
          },
          {
            l: "B",
            s: "A new session for the change, whose first message links the chat. The chat stays in the Chats list.",
            pro: ["the change's runs start clean, and the decision stays as it is."],
            con: ["the agent rereads what the chat already settled, and you follow two sessions."],
          },
        ],
      },
      {
        id: "Q4",
        title: "How does a change become a feature?",
        context: [
          "Today, after you answer yes in a round, the change's code is reverted and its folder moved to `drafts/`. The branch is merged into the default branch, removed, and you start the draft again, as a new feature with a new session. A change and a feature share the same dated folder name and worktree. Only the branch's `change/` prefix and the folder's place differ, so the move can happen on the same branch: checked in this round. More in [discovery](discovery-01.md#change-to-feature).",
          "A feature's plan builds its code test by test, from an approved spec. Code written before the spec would skip that.",
        ],
        why: "it decides whether the upgrade is one step or a restart, and what happens to code the change already wrote.",
        options: [
          {
            l: "A",
            rec: true,
            s: "On the same branch: the branch loses its `change/` prefix, and the folder moves to `specs/`. The code is reverted, kept in the history for the discovery to read, and the session goes on with the feature's discovery.",
            pro: ["one move, no merge and no restart, and the conversation stays."],
            con: ["the code is written again, test by test, by the plan."],
            why: "it is smooth, and keeps the feature's tests-first plan intact.",
          },
          {
            l: "B",
            s: "On the same branch, keeping the code. The spec and plan describe it as already built.",
            pro: ["nothing is written twice."],
            con: ["code reaches the feature before any approved spec or test-first plan."],
          },
          {
            l: "C",
            s: "As today: postpone, merge, and start again from the draft.",
            pro: ["nothing new to build."],
            con: ["a merge, a fresh start, and a new session: not smooth."],
          },
        ],
      },
      {
        id: "Q5",
        title: "How do chats and changes show and start in the sidebar?",
        context: [
          'Today Changes and Chats are two sections, each with its "＋ New" row. Every product read starts work from one composer, with a mode or an environment picked before the first message. None has a separate "new change" screen. With an upgrade from a chat, a change can also start from a chat. More in [discovery](discovery-01.md#the-sidebar).',
        ],
        why: 'it sets how you start any work with the agent, and whether "change" stays a word you see.',
        options: [
          {
            l: "A",
            rec: true,
            s: "One section, Chats, holding chats and changes, newest first. A change's row shows its step, like a feature's. One \"＋ New chat\" row; the New change page goes, and a change starts from a chat or a draft.",
            pro: ["one place to start, and a chat's row simply gains a step when it grows."],
            con: ["starting a change directly takes a chat message and a click."],
            why: "it is the merge the proposal asks for, with the least to learn.",
          },
          {
            l: "B",
            s: 'One section, as in A, and the New chat page has a "Start as a change" toggle with a slug field.',
            pro: ["a change still starts in one step when you know it is one."],
            con: ["one more control on every new chat."],
          },
          {
            l: "C",
            s: "Two sections as today, with only the upgrade moves added.",
            pro: ["nothing changes in the sidebar."],
            con: ["the two concepts stay apart, against the proposal."],
          },
        ],
      },
      {
        id: "Q6",
        title: "What does the `+` next to Features open?",
        context: [
          "Features start only from a draft today, in the editor or the priorities pane. The New change page starts a change from a typed request and a slug. Kiro's `+` under Specs starts a spec at once. More in [discovery](discovery-01.md#the-features-).",
        ],
        why: "it decides whether a feature can start without writing a draft first.",
        options: [
          {
            l: "A",
            rec: true,
            s: 'A New feature page: you type the proposal, pick a slug and the discovery effort, and "Start the feature" starts it and its discovery.',
            pro: ["a feature in one step, like a change today."],
            con: ["a proposal typed in a composer has no images unless pasted."],
            why: "it mirrors the page changes have today, and reuses it.",
          },
          {
            l: "B",
            s: "A new draft, opened in the editor, not started.",
            pro: ["room to write a long proposal first."],
            con: ["starting is a second step."],
          },
          {
            l: "C",
            s: "A chat whose agent helps you write the proposal, then offers to start it as a feature.",
            pro: ["the proposal comes out sharper."],
            con: ["the proposal is no longer purely in your words."],
          },
        ],
      },
      {
        id: "Q7",
        title: "Can a feature go back down to a change, or a change to a chat?",
        context: [
          'Your proposal speaks of switching "between flows smoothly", without naming a direction. No product read documents a move down. Today a feature that turns out small can be postponed or dropped. More in [discovery](discovery-01.md#going-down).',
        ],
        why: "a move down needs its own path in the skill and the code.",
        options: [
          {
            l: "A",
            rec: true,
            s: "Upward moves only. A feature that turns out small is postponed or dropped, as today.",
            pro: ["less to build and explain."],
            con: ["a small feature keeps its full flow, or is restarted."],
            why: "no one has asked for it yet, and it can come later.",
          },
          {
            l: "B",
            s: "A feature before its spec is approved can become a change, on the same branch.",
            pro: ["a feature that turns out small loses no time."],
            con: ["a reverse move to build, test, and document."],
          },
        ],
      },
    ],
    settled: {
      check: [
        [
          "The change's proposal",
          "is the chat's request in your words, as rule 8 does today. The agent proposes a title and a slug, which you edit before starting. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).",
        ],
        [
          "The light flow stays.",
          "A change keeps its steps, tests, review, and pull request; only how it starts and shows changes. See [discovery](discovery-01.md#what-merge-means).",
        ],
      ],
      behaviour: [
        [
          "Inbox triage and the decisions check",
          "stay chats on the main checkout, since they write on the default branch. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).",
        ],
        [
          "A chat that becomes a change",
          "loses rename and archive, like every change: its name is its proposal's title, and it ends with its record. See [discovery](discovery-01.md#important-reads).",
        ],
        [
          "The upgraded change's entry",
          "goes to the top of **Now**, committed on the default branch, as starting a change does today. See [discovery](discovery-01.md#rules-and-their-owners).",
        ],
      ],
      hood: [
        [
          "The session's link to its change",
          "lives in the server's cache only, set once on the upgrade. Losing it loses the chat's history, never workflow state, which stays in git. See [discovery](discovery-01.md#rules-and-their-owners).",
        ],
        [
          "The branch",
          "is named from the slug, as `ura start` names it. See [discovery](discovery-01.md#needs-no-choice).",
        ],
        [
          "The CLI",
          "gets the change-to-feature move, with the skill describing the same steps by hand, as the [CLI decision](/specs/decisions/cli.md) asks. See [discovery](discovery-01.md#likely-changes).",
        ],
      ],
    },
  },

  "layout-look": {
    feature: "Layout and look and feel",
    folder: "2026-10-20-layout-look",
    title: "Clarifications, round 01: Layout and look and feel",
    excerpt:
      "An excerpt: the block, the context, Q4 and Q5, and the settled points. The round's twelve questions were numbered Q1 to Q12.",
    block: {
      first: "12 questions, about 35 minutes, plus about 15 minutes to try the mockups first.",
      verdict: [
        "with changes",
        "worth building, with changes: the markdown editor is a separate subsystem, and three active decisions bind this redesign.",
      ],
      items: [
        "Open the [five mockups](mockups/compare.html) before the questions. They are clickable HTML over the same data, checked at a desktop, a half screen, and a phone width.",
        "Three answers last beyond this feature. They are the visual direction, the width classes (which amend the layout decision), and prototypes in the workflow (which amend the preview decision).",
        "Four questions work together: the direction, the mixed parts, the session beside a page, and the width classes. The shell and the half-screen behaviour come from all four.",
        "The mockups break the active preview decision, as your request asked. Prototypes are plain HTML, not Storybook stories.",
        "Three settled points need your check: keys are drawn but not built, the questions page stays one scroll, and secondary text was corrected for contrast.",
        "Not verified: the mockups were tested in Chromium only, not in Safari and not inside Uraeda's own mockup frame.",
      ],
    },
    context: {
      goal: [
        "The [proposal](proposal.md) asks for one design pass over the whole web UI, for the one human who uses it daily. The layout and the visual identity are decided together. You set what each view shows. The agent builds several directions over that, and you pick one to write into the spec.",
      ],
      today: [
        "The UI is grey, with a black-and-white accent, and has no logo or favicon. It grew view by view. It has one width breakpoint, at 768 px. A half screen of 960 px gets the desktop layout, where a sidebar, a page, and a 320 px aside compete for the room.",
        {
          table: [
            ["Part", "Today"],
            [
              "Shell",
              "A resizable side navigation in [Shell.tsx](/packages/web/src/Shell.tsx), 280 px wide by default",
            ],
            [
              "Theme",
              "Astryx's neutral theme, built from [theme.ts](/packages/web/src/theme/theme.ts)",
            ],
            [
              "Width classes",
              "Two, from [useWidthClass.ts](/packages/web/src/layout/useWidthClass.ts), switching at 768 px",
            ],
            [
              "Home",
              "Tiles and lists in [Home.tsx](/packages/web/src/Home.tsx), with the sidebar's icons not reused",
            ],
            [
              "Icons",
              "Lucide, 29 in the theme and 53 copied into [icons.ts](/packages/web/src/theme/icons.ts)",
            ],
            [
              "The 5 h limit",
              "A widget in [Allowance.tsx](/packages/web/src/sidebar/Allowance.tsx), hidden when the sidebar folds",
            ],
          ],
        },
        'The merge-chats feature, merged before this one, already makes "session" the one concept that grows into a change and then a feature. It also adds the New page and removes the feature colour. This feature builds on that.',
      ],
      scope: [
        "All the views of your information architecture, the shell, the visual identity (colours, shapes, type, a logo, a favicon), the icons, and the harness marks. It leaves out new features and any change to what the views do. The markdown proposal editor is Q1.",
      ],
      sources: [
        {
          list: [
            "The [current UI code](/packages/web/src/) and its sandbox of sample projects.",
            "The active decisions on [layout](/specs/decisions/ui-layout.md), [components](/specs/decisions/ui-components.md), [preview](/specs/decisions/preview.md), and [stack](/specs/decisions/stack.md).",
            "DeepSeek Harness, Kiro Crew, Zed, and the agent tools' own apps. Apple's Liquid Glass material. Japanese bonsai and colour sources. Your own two sites and your Neovim screenshots.",
            "The full investigation is in [discovery](discovery-01.md). Each question links its topic.",
          ],
        },
      ],
    },
    questions: [
      {
        id: "Q4",
        title: "Where should the session open on the questions page?",
        context: [
          "You want to ask the agent about the question in front of you, from that page, and read the answer without a cramped panel. Today the session is a side panel. The mockups show three ways. Natural and glass use a bottom sheet with three heights. Cyber and blueprint use a panel from the right. Terminal uses a split below the page. Astryx already ships a bottom sheet with snap points and a resizable panel. More in [discovery](discovery-01.md#the-session-beside-a-document).",
        ],
        example:
          'you are on a question about the next occurrence of a repeating task. You ask, "Why does option C cost more?", and want the answer beside the question you are weighing.',
        why: "it decides how much of the question stays visible while you read the answer. At half screen a right panel leaves little width for the question.",
        options: [
          {
            l: "A",
            rec: true,
            s: "A resizable panel on the right at wide widths, and a bottom sheet with three heights at medium and narrow widths.",
            pro: [
              "at full width you see the question and the answer side by side. At half screen the sheet keeps the question above it, and it goes opaque when expanded.",
            ],
            con: ["two layouts to build and test, though both exist as Astryx components."],
            why: "it keeps the question visible at every width, which you asked for.",
          },
          {
            l: "B",
            s: "Always a bottom sheet, with a peek, a half, and a full height.",
            pro: [
              "one layout at every width, and the answer can take the whole screen when you need it.",
            ],
            con: ["on a wide screen the question sits half hidden above the sheet."],
          },
          {
            l: "C",
            s: "Always a floating panel from the right, over the page.",
            pro: ["the questions keep their width, and the panel can be dismissed at once."],
            con: ["it covers the right edge of the page, and on a phone it fills the screen."],
          },
          {
            l: "D",
            s: "A separate page for the session.",
            pro: ["the simplest, and the session gets the whole width."],
            con: ["you leave the question to read the answer, which is what you want to avoid."],
          },
        ],
      },
      {
        id: "Q5",
        title: "Should the UI get a third width class for half screens?",
        context: [
          'The [layout decision](/specs/decisions/ui-layout.md) fixes two width classes, switching at 768 px, and says views adapt "through the theme and never per-view media queries". Half of a 1920 px screen is 960 px. The desktop layout there puts the sidebar, the page, and a 320 px aside side by side. The tests only run at 402 and 1440 px. Material 3 calls 840 to 1199 px its "expanded" class, where a rail replaces the drawer. More in [discovery](discovery-01.md#width-classes).',
        ],
        why: "this is the fix for the layout that breaks at half a screen's width. It amends an active decision, and every view's tests follow the classes you pick.",
        options: [
          {
            l: "A",
            rec: true,
            s: "Add a middle class from about 840 to 1199 px, where the sidebar folds to icons and an aside opens as an overlay.",
            pro: [
              "it fixes half screen directly, and the mockups were built and checked at that width.",
            ],
            con: ["a third layout per view, and the tests must run at about 960 px as well."],
            why: "half screen is how you use the app, so it should be a class, not a patch.",
          },
          {
            l: "B",
            s: "Keep two classes and move the switch up to about 1024 px.",
            pro: ["no new layout to build."],
            con: ["at 960 px you get the phone layout on a wide window, which wastes the screen."],
          },
          {
            l: "C",
            s: "Keep two classes, and let each pane adapt by its own width with container queries.",
            pro: ["panes adapt wherever they sit, with no class to test."],
            con: [
              'it needs a ruling on the decision\'s "never per-view" rule, and each pane is tested alone.',
            ],
          },
        ],
      },
    ],
    settled: {
      check: [
        [
          "Keyboard keys in the terminal look",
          "are drawn and not built. If you pick that direction, its keys (`j` and `k`, a leader key, key hints) stay out, since keyboard navigation is its own item in the [priorities](/specs/PRIORITIES.md). The layout still takes the look.",
        ],
        [
          "The questions page stays one scroll,",
          "with a sticky question heading and an outline, not one question per screen. The evidence for one question at a time is mixed, and later questions refer back to earlier ones. You also asked to always see the question while answering. See [discovery](discovery-01.md#needs-no-choice).",
        ],
        [
          "Text contrast",
          "is held at 4.5:1 for text, and 3:1 for large text and controls. Several of the agent's own first colours missed it, so the secondary text in every mockup was corrected after measuring. Decorative marks, like the dim grid lines, are not text.",
        ],
      ],
      behaviour: [
        [
          "The shell shows the same things at every width.",
          "The inbox draft, New, running sessions, features in progress, the 5 h limit, and the settings stay one tap away. At half screen the shell folds to icons and counts, and it never hides them.",
        ],
        [
          "The New page",
          "shows its three choices as three differently shaped cards, in the picked direction's art. The flow behind them belongs to the merge-chats feature.",
        ],
        ["Priorities and the inbox", "get menu actions to move a line, beside dragging."],
      ],
      hood: [
        [
          "Tokens",
          "go through Astryx's theme levers where they exist. What they cannot hold, like a texture or a tree drawing, is listed in the plan's complexity tracking.",
        ],
        [
          "The mockups' fake data",
          "comes from this repository's own files, so they can be checked against the real UI.",
        ],
      ],
    },
  },
};

// What the session's transcript holds once a question was asked: a made-up exchange, in the
// shape of a real one, about the question the human asked from.
window.SESSION = {
  first: {
    "merge-chats": "Why would a worktree per chat cost that much? It sounds cleaner.",
    "layout-look": "At half screen, how wide would the question still be with the panel open?",
  },
  replies: {
    "merge-chats": [
      { who: "tool", text: "Read `packages/server/src/runner/sessions.ts` · 238 lines" },
      {
        who: "agent",
        text: "Short answer: the cost is in what the options leave for later, not in the work now.",
      },
      {
        who: "agent",
        text: "Option B needs a worktree per chat: about 40 s to set up on this repository, and a cleanup when the chat is archived. Most chats are a few messages long, so that cost is paid for nothing nine times out of ten.",
      },
      {
        who: "agent",
        text: "Option A keeps the start instant. Its one real cost is the move at the upgrade, which the follow-up settles: only the files the chat edited move, never yours.",
      },
    ],
    "layout-look": [
      { who: "tool", text: "Read `packages/web/src/layout/SideColumn.tsx` · 253 lines" },
      {
        who: "agent",
        text: "At 1205 px with the icon rail, a 480 px panel leaves the question about 670 px: one column, options under the text, about 60 characters a line.",
      },
      {
        who: "agent",
        text: "That is narrower than the reading measure but still comfortable. Below about 560 px the options would get cramped, which is where the sheet in option A takes over.",
      },
    ],
  },
  name: "merge-chats",
  harness: "Claude Code",
  answer: (q, round) => [
    {
      who: "tool",
      text: `Read \`specs/${window.ROUNDS[round].folder}/discovery-01.md\` · 412 lines`,
    },
    ...(window.SESSION.replies[round] || []),
  ],
};
