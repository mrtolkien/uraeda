# Changelog

## 1.0.0 - 2026-11-01

### Features

- **[Fix testing](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-19-fix-testing.md)**
  ([#54](https://github.com/mrtolkien/uraeda/pull/54)): Tests, locally and in CI, were slow, flaky,
  and mostly pointless: CI took 12 to 16 minutes and failed 15 of its last 20 runs, mostly on tests
  pinned to text, counts, or pixel sizes. The human wanted fewer, meaningful tests that check core
  behaviour across systems, and skill wording that stops agents writing noise or bending the human's
  intent to pass a test. Above all, a fast loop after each task, without trading away quality:
  running 15 minutes of tests per small change costs more than writing code.
- **[Layout and look and feel](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-20-layout-look.md)**
  ([#55](https://github.com/mrtolkien/uraeda/pull/55)): The UI worked, but looked vanilla and
  unfinished before v1.0.0, and its layout, grown view by view, broke at half a screen's width,
  where the human often works. The human asked for one design pass: they set what each view shows,
  the agent built several throwaway directions to pick from, and the spec wrote the picked one down.
  The human picked a terminal look, LazyVim-like, with a touch of their own cyber style. The pass
  was split in three: this feature sets the identity, the shell, and three width classes, and
  redraws the home, settings, and decisions pages. The questions and spec pages, then the lists and
  starts, follow as their own features.
- **[Questions page in the terminal look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-24-questions-page.md)**
  ([#56](https://github.com/mrtolkien/uraeda/pull/56)): The round of questions is the page the human
  spends most time on, and it was the old look inside the new shell: a callout and plain headings
  for its opening, the question's title scrolling away while its options were read, three equal
  headings for the settled points, and "Ask the agent" leaving the round for the session's page. The
  human asked for the terminal look of
  [layout and look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-20-layout-look.md)
  there: a distinct look for the round's opening, the question always in view, "Example", "Why it
  matters", and "Check these" drawn with weight, the navigation second, and the session beside the
  round in the right column, as tabs. They also asked for lists that waste less width on the phone.
  Approving the spec, they asked for the layout decision's **Why** to read as current reasons only.
- **[Spec and plan pages in the terminal look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-24-spec-page.md)**
  ([#57](https://github.com/mrtolkien/uraeda/pull/57)): The spec is the workflow's main review, and
  it was still drawn in Astryx cards of the old look, inside the new shell of
  [layout and look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-20-layout-look.md).
  The human asked for the spec, the plan, and the data model in the terminal look: the full spec in
  its format, each part drawn its own way, decision changes first and most visible since they shape
  every later feature, live mockups clearly framed as embeds, and navigation second, with comments
  and the session beside the page, as on the
  [questions page](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-24-questions-page.md).
  For the plan, they asked for the least work: "The plan is either read before tasks start or
  never".
- **[Feature page in the terminal look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-25-feature-page.md)**
  ([#59](https://github.com/mrtolkien/uraeda/pull/59)): A feature's or a change's page was the last
  page of a feature still in the old look: Astryx cards and a stepper in the new shell, half its
  height empty, its files in a plain list beside a Storybook link. It is redrawn in the terminal
  look of
  [layout and look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-20-layout-look.md):
  what comes next first, a timeline of the stages that made the feature with their files, and a
  column of sessions, figures, and links. The old-look document pages join it, and the Storybook
  page goes.
- **[Inbox and priorities in the terminal look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-25-inbox-priorities.md)**
  ([#60](https://github.com/mrtolkien/uraeda/pull/60)): The inbox and the priorities, redrawn in the
  look and shell of
  [layout and look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-20-layout-look.md),
  as two views that differ on purpose: the priorities are opinionated, so they are columns of cards;
  the inbox is freeform, so it is a stack of panes, one per category. The human still opened Neovim
  to organize the two files, so each line gets a `…` menu, the priorities get a written context per
  section, and categories can be created, renamed, and deleted. The vim-like editing keys and the
  key map were split off as the next feature.
- **[Session and New in the terminal look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-25-session-new.md)**
  ([#58](https://github.com/mrtolkien/uraeda/pull/58)): The session page and the New page were the
  last pages in the old look, inside the terminal shell of
  [layout and look](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-20-layout-look.md),
  the third feature of its split. The human asked for the standard chat look: messages first, and
  what the agent did, its sources, and its changes second. They took Pi's split of chat, tool calls,
  and thinking as the model, and asked for a vertically split right column. For New, they asked for
  three clearly different choices, so a new user picks Session, Change, or Feature right the first
  time.
- **[Leader key/shortcut map](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-26-leader-key.md)**
  ([#63](https://github.com/mrtolkien/uraeda/pull/63)): Keyboard navigation for the whole web UI,
  because the human likes driving an app from the keyboard. Two levels of keys: page keys, `h j k l`
  and mnemonics like `a i o`, that act on the page, its columns, and an open pane; and Space,
  outside text fields, as a leader key opening a menu of nested groups and pickers in the manner of
  LazyVim, Helix, and Emacs, shown only after half a second so fast typing never flashes it. The
  human asked for a robust, extensible system rather than hardcoded keys, so that a key map, a key
  search, and a dynamic status line can be built on it later.
- **[Testing strategy review](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-26-testing-communication.md)**
  ([#62](https://github.com/mrtolkien/uraeda/pull/62)): Agents bent code to keep old tests green,
  because nothing said what to do with a test whose behaviour the approved spec replaced, and the
  suite grew heavy, above all in the web UI, with tests pinning pixel sizes. The human asked for
  short, generic testing guidance that scales with the project's stage, decisions that state intent
  rather than values, every existing test rewritten to match in one pass, and records that are their
  pull request's text and point to the records that replace them. The wording was to be tried on
  runs of Claude Code with Sonnet before it shipped.
- **[Decisions understandable with no context](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-29-decisions-needs.md)**
  ([#69](https://github.com/mrtolkien/uraeda/pull/69)): Agents often read a decision alone, before a
  task, without the record of the feature that made it. The human found decisions too specific to
  validate, and their **Why** verbose. The ledger had grown by 45% in the ten days since the last
  decisions pass, from 9,441 words to 13,658. This feature makes each decision readable on its own
  and checkable rule by rule, measures where it regrows, and rewrites the ledger to the new rules.
- **[Performance pass](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-29-performance-pass.md)**
  ([#74](https://github.com/mrtolkien/uraeda/pull/74)): The web UI felt sluggish: pages took 0.2 to
  2.6 s, every commit stopped the human for its hooks, and moving a proposal to a feature took over
  10 s across page changes, with no clear feedback. The human asked for optimistic UI "everywhere",
  values cached ahead of time, and no page over 100 ms locally. Most of the slowness was a debug
  build of the core, shipped apart first as
  [release binding](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-release-binding.md),
  and reads that rebuilt the whole workspace each time. The human wanted the UI to "feel instant,
  but we don't have to 'lie' to the user", and to start a feature, its session included, and go on
  working without waiting at any point.
- **[Feature state pass](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-feature-state.md)**
  ([#80](https://github.com/mrtolkien/uraeda/pull/80)): A feature's state was often wrong in the web
  UI: a stopped session marked a feature as needing attention while another session ran, an approval
  stayed "Needs you" until a reload, a pull request read as done after a new session started, an
  agent on task 16 showed task 13, a crash's warning could never be cleared, and a change started
  from a line of **Now** left the line there. The human asked for one state, right everywhere, at
  once, through manual edits, crashes, and restarted sessions.
- **[Onboarding + README pass](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-onboarding-readme.md)**
  ([#72](https://github.com/mrtolkien/uraeda/pull/72)): Uraeda's workflow, files, and vocabulary had
  settled, and it was time to make it easy for a human to start with. The README had grown into a
  3,500-word reference; it becomes a short, appealing page that says what Uraeda is, a workflow
  first, then a CLI, then a web UI. A project set up by `ura init` alone looked ready on Home while
  its constitution was still the template: Home and `ura status` now say what the project lacks, and
  a button hands the setup to the agent.
- **[Panes size](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-panes-size.md)**
  ([#73](https://github.com/mrtolkien/uraeda/pull/73)): The human asked to review every pane's size:
  the feature page's panes were too large, some question cards too big, and widths should be
  coherent, "based on clear rules". Only prose had a rule, about 80 characters a line; every other
  page filled a 1,200 px column from a 1,024 px window, and a document beside the side column read
  at 25 characters a line on a half screen. Every page and pane now takes one width of a short
  scale, picked by what it holds, and the UI layout decision binds it.
- **[Proposal start flow](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-proposal-start.md)**
  ([#79](https://github.com/mrtolkien/uraeda/pull/79)): Starting planned work from a line of the
  priorities took four steps: the line's Start, the New page's Feature card, a proposal file in the
  editor, then the editor's Start pane. The New page's composer also mixed texts: a line's Start
  appended the line under whatever draft was there, and each of the three cards kept a text of its
  own. The human asked that a Start not add to the draft, that the Session, Change, and Feature
  cards share one text, and that a feature started from the New page land straight on its session,
  the composer's text being the proposal.

### Changes

- **[Proposal naming](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-28-proposal-naming.md)**
  ([#64](https://github.com/mrtolkien/uraeda/pull/64)): One name for each unit of work, from its
  first line to its done record, in the skill, `ura`, the editor, the server, and the web UI. The
  same row of `PRIORITIES.md` was a priority, an entry, a line, and an item, and "create a priority"
  made no sense: a priority is a rank, not a thing. "Draft" named a stage of the same thing, a note
  with images secretly became one, and `backlog/` duplicated **Later**. Now a row is a proposal, a
  line or a file, and a note is a line or a file. `PRIORITIES.md` keeps its name: it holds
  information about priorities.
- **[Amend the latest commit](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-29-amend-latest.md)**
  ([#66](https://github.com/mrtolkien/uraeda/pull/66)): Small edits to the workflow's own files, the
  inbox, the priorities, proposal files, and note files, each made one commit on the default branch:
  a day of notes and reorderings filled `git log` with noise. The tools now amend the latest commit
  when it is one such commit nobody else has yet.
- **[The key map](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-29-help-keybindings.md)**
  ([#67](https://github.com/mrtolkien/uraeda/pull/67)): The human asked for `?` in the status line,
  right after the leader's hint, opening every shortcut of the page, searchable: an overlay on the
  glass look that also darkens the page, modal-like, for readability. They asked to be told if it
  looked too different from other views, or read badly. It did, in the light theme, and they chose a
  lighter light glass for every glass surface.
- **[Commits shouldn't all fail on "changes to INBOX.md"](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-commits-shouldn.md)**
  ([#77](https://github.com/mrtolkien/uraeda/pull/77)): Starting a feature or a change failed with
  "cannot start: uncommitted changes in specs/INBOX.md" whenever the inbox on the main checkout had
  an edit not yet committed, which the web UI often leaves. The start had no reason to care: it
  commits its own files. The human asked that starting work "commit just what's relevant and leave
  what's uncommitted as-is".
- **[Run a new inbox cleanup: anything that’s simple and requires no decision from me](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-inbox-again.md)**
  ([#75](https://github.com/mrtolkien/uraeda/pull/75)): The human asked for another pass over the
  inbox: fix every note that is simple and needs no decision from them, and move the rest to **Now**
  in the priorities, grouped by feature where they are related. Seven of the 16 notes were fixed,
  each in its own commit, and left the inbox. The other nine went to **Now**: three new proposal
  files and one line. The inbox kept only its categories, the two notes the human added while the
  change ran, and one agent's note.
- **[Mockup previews](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-mockup-previews.md)**
  ([#78](https://github.com/mrtolkien/uraeda/pull/78)): The human found that the performance pass's
  spec showed none of its story mockups locally, and that an SVG could not be previewed: a round
  comparing three README banners linked its SVG prototypes, which only opened in a new tab, and an
  SVG could not show in a proposal. They asked for the mockups to work, and for SVG and PNG files to
  show in sessions and in pages: specs, questions, and the rest.
- **[Phone bottom bars on more pages](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-phone-bottom.md)**
  ([#70](https://github.com/mrtolkien/uraeda/pull/70)): On the phone, only the pages with a side
  column ended with a bottom bar: icon tiles on frosted glass for the page's companions, then the
  one action that moves the human forward. The human asked for it on more pages, the feature page
  and the pages with one main action, since the bar is where the thumb is, and puts a page's
  companions and its next action in the same place everywhere. A bar of one entry is a single glass
  button at the bottom right, of two a button in each corner, and of three or more the bar across
  the screen.
- **[Reading and layout pass](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-reading-pass.md)**
  ([#76](https://github.com/mrtolkien/uraeda/pull/76)): The human reads most of the time in Uraeda,
  on a phone too, and five things read badly. On the phone, open panes let a question's example run
  into its context, and prose was large for a narrow screen. A spec's replaced behaviour was the
  only part drawn bare, a wide table was cut off at its pane's border, and the home's columns sat
  left of the room beside the sidebar.
- **[Run the server on a release build of the core](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-release-binding.md)**
  ([#68](https://github.com/mrtolkien/uraeda/pull/68)): The performance pass found the server,
  started with `vp run start` from a checkout, loading a debug build of the Rust core's binding,
  about 4 times slower on every read. The human asked for the release build to ship at once, as its
  own pull request, ahead of the performance pass's spec.
- **[Review the inbox and fix all small issues that can be fixed without extra feedback](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-10-30-review-inbox.md)**
  ([#71](https://github.com/mrtolkien/uraeda/pull/71)): The human asked for a pass over the inbox,
  fixing every small note that needed no more feedback from them. Nine notes were fixed, each in its
  own commit, and left the inbox; five stay there, each needing the human's call or a look at the
  running app on their machine.
- **[When a session touched files, there's nothing in the "changed files" sidebar...](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-11-01-files-changed.md)**
  ([#84](https://github.com/mrtolkien/uraeda/pull/84)): A session on the main checkout changed and
  committed five files, yet its Changes panel read "No file changed yet.". The human asked whether
  the panel could look at the file-write tool calls, or whether that was too complex.
- **[If there's nothing in progress, the "nothing in progress" in the sidebar looks…](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-11-01-nothing-bar.md)**
  ([#81](https://github.com/mrtolkien/uraeda/pull/81)): With nothing in progress, the sidebar's In
  progress pane said "Nothing in progress.", which the folded rail, 52 px wide, clipped to a stray
  "Not" between two separator lines. The human asked to fix it, and to make sure unfolding the
  sidebar still works.
- **[Review all the inbox entries](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-11-01-review-all.md)**
  ([#85](https://github.com/mrtolkien/uraeda/pull/85)): The human asked for every inbox entry to be
  reviewed, the fixable ones fixed, and low-importance bugs with no impact on usability dropped,
  asking only for decisions they must make. The inbox held eleven agents' notes under **Deferred
  fixes**, left by the feature-state, reading-pass, inbox-again, mockup-previews, and proposal-start
  work. Seven were fixed, four dropped, and none needed the human's decision. The inbox is now
  empty.
- **[I dislike moving buttons: for example on feature start, the composer jumps…](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-11-01-stable-buttons.md)**
  ([#82](https://github.com/mrtolkien/uraeda/pull/82)): The human disliked buttons that move: on a
  feature's start, the composer jumped around. They asked for stable layouts, above all in the
  standard flow: opening a session, starting a feature or a change.
- **[When creating a new session/change/feature the focus should be on the text field](https://github.com/mrtolkien/uraeda/blob/v1.0.0/specs/done/2026-11-01-text-focus.md)**
  ([#83](https://github.com/mrtolkien/uraeda/pull/83)): Opening the New page, or a feature's New
  session, left the focus on the page: the human had to click the text field, or press `i`, before
  typing what they came to start. The human asked for the focus to be in the text field, and to be
  told if that was not a good idea or would behave weirdly.

## 0.9.0 - 2026-10-21

### Features

- **[Benchmarks](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-19-benchmarks.md)**
  ([#46](https://github.com/mrtolkien/uraeda/pull/46)): The project's owner wanted to check the
  whole workflow holds up on real software tasks, not only on the project's own work. Five SWE-bench
  Pro V2 cases run through the flow, with Claude Code as the agent and as the human at each gate,
  each beside a plain Claude Code run, and every result is saved in the repository with the versions
  that produced it.
- **[Decisions pass](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-19-decisions-pass.md)**
  ([#47](https://github.com/mrtolkien/uraeda/pull/47)): Decisions had drifted from the human's
  intent into specifications: flags, timeouts, and file names that the code and its checks already
  hold, so reviewing them took long and little of it was a choice. The feature gives decisions a
  written bar, rewrites the ledger to it, draws a decision's rules as the spec page does, and adds a
  "Check decisions" run that finds decisions competing with each other.
- **[Redesign session](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-19-redesign-session.md)**
  ([#45](https://github.com/mrtolkien/uraeda/pull/45)): A functional pass on the session page, where
  the human follows and talks to an agent: it opens fast on a long session, reads well on a phone,
  tells the human's messages from the agent's, allows blocked actions together, keeps its actions by
  the composer, and tells the human when a chat is blocked. The chat's right column was split off as
  its own draft, in the priorities' Next list.
- **[Merge chats and changes](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-20-merge-chats.md)**
  ([#53](https://github.com/mrtolkien/uraeda/pull/53)): Chats and changes become one thing, the
  session: a conversation with the agent, with a workflow that can grow around it, none, a change,
  then a feature. A chat was a change that had not grown yet, and a change a feature that had not:
  the human wanted to move between them smoothly, the agent offering each move, and one place to
  start any of them. "Chat" leaves the UI: every conversation is a session.
- **[Stable dev environment for UI review](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-20-ui-sandbox.md)**
  ([#52](https://github.com/mrtolkien/uraeda/pull/52)): The human wanted to iterate fast on UI
  changes, in a "frozen" environment with a stable seed that then "behaves normally". It runs the
  real code with hot reloading, like `vp run dev`. It holds mock features at each step of the flow,
  changes, and sessions. An element picker sends what the human points at to the agent, to ask for a
  change. `vp run sandbox` serves the whole app this way, beside Storybook, which stays the place
  for mockups and variants.

### Changes

- **[Clarifications during implementation can resume implementation](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-19-late-clarifications.md)**
  ([#44](https://github.com/mrtolkien/uraeda/pull/44)): A round of questions asked during
  implementation could only go back to the spec's approval. Every such round so far was small enough
  to carry on building after the human's review. The human now chooses when they answer: back to the
  spec, or continue implementing, which is the usual case.
- **[Right bar resizable](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-19-right-bar.md)**:
  The session's right column, "Progress", and the spec page's "Contents" were meant to resize from
  their edge, hide easily, and slide in and out, as the shell's redesign asked
  ([`2026-10-16-redesign-interface`](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-16-redesign-interface.md)).
  In the app there was no drag bar, and hiding removed the column at once.
- **[Ctrl+Enter sends every composer](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-20-ctrl-enter.md)**:
  Enter no longer starts a change or sends a chat message: Ctrl+Enter or Cmd+Enter does, as every
  other multi-line field already saves. Enter adds a line. The rule follows
  [UI coherence](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/decisions/ui-coherence.md):
  every text input behaves as its class does.
- **[Inbox quick fixes](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-20-inbox-fixes.md)**
  ([#50](https://github.com/mrtolkien/uraeda/pull/50)): The inbox's **Deferred fixes** held 43 agent
  notes, most of them not worth the human's time. The human dropped the low-value ones, and asked
  for the easy ones that need no input from them to be fixed together, to clear the inbox: seven
  small defects in the skill, the web UI, and the benchmarks.
- **[Inbox screenshots](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-20-inbox-images.md)**:
  The inbox needed to take screenshots like the other pages: attach, paste, or drop them, see them,
  and have them committed. A note could carry one image, only when added, and nothing in the inbox
  showed it.
- **[Fix agent -> inbox flow, it creates way too much noise at the moment](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-20-inbox-noise.md)**
  ([#49](https://github.com/mrtolkien/uraeda/pull/49)): Agents noted every problem met outside a
  task, and every minor review finding under **Deferred fixes**: 43 agent notes waited in the inbox,
  most of them small issues in the feature's own code. The human wants a note to be exceptional:
  either a finding matters and is part of the pull request, or it does not and goes nowhere. A note
  is only for an important issue that needs the human and clearly falls outside the current feature.
- **[Session transcript speed and coherence](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-20-session-transcript.md)**:
  A session's page lagged when typing and never folded old messages, with a 12-hour turn open: the
  turn held 1,800 items, 97% of them tool calls, and about 500 drew. The agent's text was also
  tight, and its lists wrapped about 150 px before its paragraphs, since agent markdown was drawn
  its own way. The change makes the session fast, its column about 115 characters wide, and reading
  text drawn by one shared component.
- **[Tab completion for `ura` in fish and zsh](https://github.com/mrtolkien/uraeda/blob/v0.9.0/specs/done/2026-10-20-shell-completions.md)**
  ([#51](https://github.com/mrtolkien/uraeda/pull/51)): The proposal asked for Tab to complete
  `ura`'s commands in fish and zsh, a line of **Next** in the priorities. In the chat that started
  it, the human chose dynamic completion, where the shell asks the `ura` binary at each Tab, so
  completion never goes stale after an upgrade.

## 0.8.0 - 2026-10-19

### Features

- **[Storybook's full interface in Uraeda](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-access-storybook.md)**
  ([#29](https://github.com/mrtolkien/uraeda/pull/29)): Uraeda's Storybook page framed Storybook's
  full interface for a checkout, its sidebar, canvas, controls, and panels, but rendered no story:
  since 10.6.2, Storybook pins its messages to an origin that Uraeda's sandboxed frame lacks. The
  human wanted "all of storybooks features when we need to", and asked whether basic security made
  it simpler. It did: basic security's frame secret removes the threat Storybook's origin check
  guards against, so one Storybook setting fixes the page.
- **[Redesign clarifications](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-redesign-clarifications.md)**
  ([#30](https://github.com/mrtolkien/uraeda/pull/30)): Rounds of questions had grown to 1.5 times
  the skill's example, opened by retelling the proposal, and read as a flat list on the page. The
  human asked for a round that is quick to read once, top to bottom: a verdict on the proposal and
  typed facts first, each question as a card with room for context, follow-ups set apart, settled
  points grouped by what to check, answers with a comment and no letter, and wording every model
  follows the same way.
- **[Redesign and reword specs](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-redesign-specs.md)**
  ([#33](https://github.com/mrtolkien/uraeda/pull/33)): Approving a spec is the human's most
  important job, and specs had become a sea of bullet points: 3,900 to 7,700 words, decisions buried
  after the stories, review comments answered by number, and decision links that opened the wrong
  branch. The human asked for a page approved in one sitting, without any other context: what is
  approved first, then the decisions with their changes marked in place, then the stories as cards,
  each part drawn for what it holds. Decisions had grown to 18,728 words, and the human wanted them
  short, intent first, with every line approved by a human.
- **[Redesign feature and change pages](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-redesign-feature.md)**
  ([#42](https://github.com/mrtolkien/uraeda/pull/42)): The feature page had grown by additions and
  showed neither where a feature was nor what it produced; a done feature showed one link to its
  record, and a change had no page at all. Two buttons opened the session and behaved differently,
  the only path to pull request feedback never fired, and "problems" flagged features that were
  fine. The human asked for one page that shows where a feature is, what's next, and what it
  produced, from proposal to merge.

### Changes

- **[Questions first](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-questions-first.md)**
  ([#32](https://github.com/mrtolkien/uraeda/pull/32)): The human wanted a round of questions to
  start with a list of all its questions, so they do not answer a later question early, in an
  earlier one's comment. Wide screens had the list in the column beside the questions, but on a
  phone it sat behind the top bar's "1/4" count, with no quick way to see the questions.
- **[Restart a Storybook when its checkout's commit changes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-storybook-restart.md)**:
  A checkout's Storybook was started once and kept until it idled out, failed, or "Try again" was
  pressed. After a commit that changed what Storybook reads only as it starts, its configuration and
  fixture in `.storybook/`, its dependencies, or the server code it runs, the embeds showed stale or
  blank stories: the round mockups of the clarifications redesign rendered blank, since their
  Storybook had started before the commit that added their fixture.
- **[Share the main checkout's builds with new worktrees](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-symlinks.md)**
  ([#28](https://github.com/mrtolkien/uraeda/pull/28)): Every new worktree built its Rust code and
  reran its checks from scratch: each compiled every dependency again, for 11 to 15 GB of `target/`
  each, and its first `vp run ready` replayed nothing. The human asked to link the `node_modules`
  and Rust build folders, "and everything that makes sense", into the worktrees, to save that CPU
  and storage.
- **[Decision review fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-decision-review-fixes.md)**
  ([#40](https://github.com/mrtolkien/uraeda/pull/40)): The review of
  [the specs redesign](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-redesign-specs.md)
  found flaws in how decisions are compared, commented on, checked, and sent live. This change fixes
  them, with a test for each.
- **[Diagram frames](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-diagram-frames.md)**
  ([#39](https://github.com/mrtolkien/uraeda/pull/39)): The diagrams of the web UI were drawn by
  Mermaid at its `sandbox` level, which was meant to keep a crafted diagram out of the app. It did
  not: a sanitizer bug would have run in a temporary frame with the app's origin. The proposal also
  listed small defects of the diagram's frames. The change removes the cause, and the defects with
  it.
- **[Priorities and decisions pages fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-priorities-decisions-fixes.md)**
  ([#36](https://github.com/mrtolkien/uraeda/pull/36)): Three flaws of the priorities and decisions
  pages: a valid decision link could read as broken, Discard kept a priority's draft when its
  children had changed, and the decisions page ran one `git log` per decision while the watch read
  every decision on each pass.
- **[Round fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-round-fixes.md)**
  ([#43](https://github.com/mrtolkien/uraeda/pull/43)): Fifteen small defects found while reviewing
  the round page, its checks, and their tests: wording, warnings that misfired or were missing, a
  heading dropped without a word, duplicated readings, and tests that started from an old round
  format.
- **[Skill wording fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-skill-wording.md)**
  ([#35](https://github.com/mrtolkien/uraeda/pull/35)): The skill's references, templates, and
  example had drifted from the rules they state: sentences over 25 words, a few rules that disagreed
  with their template or example, a dead link, and a round with follow-ups the core cannot show. The
  human listed the fixes in one proposal.
- **[Spec page fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-spec-page-fixes.md)**
  ([#41](https://github.com/mrtolkien/uraeda/pull/41)): The review of the redesigned spec page left
  about twenty-five loose ends: spec items the core and the page dropped without a word, spec-page
  behaviour tested loosely or not at all, an answered review that disappeared after landing, and a
  reading place and an editor that undid or garbled what the reader did. The change closes each.
- **[Start a draft folder from its proposal](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-start-draft-folder.md)**
  ([#34](https://github.com/mrtolkien/uraeda/pull/34)): Starting a draft folder from its
  `proposal.md` (`specs/drafts/<slug>/proposal.md`), as the web UI does, started it as a file draft:
  only `proposal.md` moved, and the folder's `images/` stayed behind, breaking the proposal's image
  links.
- **[Storybook preview fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-storybook-fixes.md)**
  ([#37](https://github.com/mrtolkien/uraeda/pull/37)): Five loose ends of the Storybook preview,
  left as follow-ups by the change that restarts a checkout's Storybook when its commit moves: two
  restart rules that went wrong in rare sequences, and three gaps in what the tests and the
  validation script prove.
- **[Worktree toolchain fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-worktree-toolchain.md)**
  ([#38](https://github.com/mrtolkien/uraeda/pull/38)): Validating in several worktrees at once went
  wrong in three ways: the main checkout's `ts:check` and `specs:check` missed their cache after any
  worktree edit, the sweep of temporary folders failed with `ENOTEMPTY`, and runs were killed with
  code 137.

## 0.7.0 - 2026-10-17

### Features

- **[Auth and login for basic security](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-basic-security.md)**
  ([#22](https://github.com/mrtolkien/uraeda/pull/22)): The human wanted to use Uraeda remotely,
  from a phone and a laptop, with "basic security": a single user, easy to sign in from several
  places, with a key that stays stable across restarts, "simple _but_ secure enough to start running
  uraeda on a public, internet-accessible server". Until then the server's only protection was its
  `Host` and `Origin` checks and the tailnet. It also had to close the hole the UI iteration flow
  left open on purpose: any website could read a running Storybook preview by sending `Origin: null`
  from a sandboxed frame.
- **[Redesign sidebars and global interface](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-redesign-interface.md)**
  ([#25](https://github.com/mrtolkien/uraeda/pull/25)): A functional pass over what every page
  shares: the sidebars, the navigation, and the agents' statuses, before the look and feel pass. The
  sidebar had to make the flow's hierarchy obvious, Inbox, Priorities, Changes, Features, and to
  tell the human when they are needed; the statuses were iffy, "waiting on you" before a run had
  fully ended, "pull request ready" before one was opened, and items that never followed the
  workflow showed. Git writes took seconds with no feedback.
- **[Redesign home, inbox, and priorities](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-redesign-priorities.md)**
  ([#26](https://github.com/mrtolkien/uraeda/pull/26)): A functional pass on the pages every piece
  of work starts from: home, the inbox, and the priorities. The most standard paths had to be the
  fastest, and looking at them had to help the human organize the remaining work: editing a priority
  took four clicks with its commit, a priority added from the phone's home took six taps to commit,
  running and drafted entries looked like the rest, the inbox and the priorities looked and behaved
  differently, and home was "a list of grey bullet points". The human also asked for a readable view
  of the constitution and decisions, and for the whole to be one coherent UI, obvious to newcomers.
- **[Settings page](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-settings-page.md)**
  ([#24](https://github.com/mrtolkien/uraeda/pull/24)): The human did not want important values,
  like allowed host names, set only by flags and `.env`, and needed a settings page anyway for the
  many settings to come: a model per step, run options, review settings. The page had to be "clean
  from the start", with categories and placeholders that show its structure. The settings live in "a
  simple format that can be backed up/added to dotfiles simply", flags still change them for a
  start, "useful for starting a server headless", and Uraeda's data, "it grew organically so far",
  was to be organized coherently.

### Changes

- **[Faster story embeds](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-storybook-warmup.md)**
  ([#23](https://github.com/mrtolkien/uraeda/pull/23)): Opening the settings page's spec froze the
  whole site: its 12 story frames loaded at once, about 1,800 requests through the server, while the
  worktree's Storybook was still starting. Story embeds now load their frames only once on screen,
  and a feature's Storybook starts before its stories are embedded. One Storybook per worktree
  stays, as the preview decision says: putting everything on the default branch until code was
  weighed and dropped, since redesign mockups edit existing components.

## 0.6.0 - 2026-10-16

### Features

- **[Testing review](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-14-testing-review.md)**
  ([#18](https://github.com/mrtolkien/uraeda/pull/18)): `vp run ready` runs after every task of a
  plan, and took about 2 minutes locally, rerunning every step one after the other: over a feature,
  an hour or more lost. CI took up to 15 minutes in one job, and failed about half the time, when "a
  CI failure MUST mean that there is an IMPORTANT bug to fix". The human asked for tests that are
  "useful AND fast AND accurate": only the checks a change can affect rerun, what can run in
  parallel does, tests are isolated and reproducible, coverage is measured, and every test, flaky
  ones above all, pulls its weight.
- **[Add a bugfixing/low impact change flow](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-add-bugfixing.md)**
  ([#19](https://github.com/mrtolkien/uraeda/pull/19)): A light flow for bug fixes and small
  changes, shorter than the feature flow but with the same code quality: no questions or spec by
  default, and an offer to upgrade a change that turns out too big. With the full flow, any small
  change took an hour or more with an agent, so about 24 small changes went straight to `main` in
  five days with no record, tests, or review, and the agent-written bug flow was never used. The
  human wanted it to "look and feel like a chat with a light structure on top: a file as input for
  context, optional clarifications rounds, and then implementation and a PR". The visual UI
  iteration flow the proposal also floated became its own draft,
  [UI iteration flow](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-ui-iteration.md).
- **[Inbox](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-add-scratchpad.md)**
  ([#20](https://github.com/mrtolkien/uraeda/pull/20)): A small, structured place to write down
  ideas and feedback while using the software: a feature is mostly good but has small things to fix,
  not enough to block its pull request, or unrelated to it, and they should be kept in the
  repository to treat later. Until now they were lines at the end of `PRIORITIES.md`, under
  `## Scratchpad`, which the tools ignored, and which "could become their priorities, or could go
  inside drafts, or could be fixed quickly without a full dev flow". The human wanted capture first,
  organization as a second step in the same feature, and the name "Inbox". Notes now live in
  `specs/INBOX.md`, apart from the priorities, "because they are _not_ priorities, by definition",
  grouped under categories the human names; this feature's finishing commit moved the scratchpad's
  notes there.
- **[Claude five-hour allowance](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-claude-usage.md)**:
  Implemented directly on main at the human's request. The sidebar's **Agents at work** section
  shows the account's remaining Claude five-hour allowance below its feature and sub-agent rows.
- **[UI iteration flow](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-ui-iteration.md)**
  ([#21](https://github.com/mrtolkien/uraeda/pull/21)): Agent-written code is often mostly right,
  but its UI needs many small, targeted fixes and visual feedback, and HTML mockups end up "far from
  the actual results". The human wanted a visual way to iterate: real, interactive mockups that
  "PROPERLY show how the feature will BEHAVE", shown inside the spec, A/B/C picks between visual
  variants, and precise comments, for every repository using Uraeda whatever its stack, and for
  Uraeda itself. Mockups became Storybook stories in the project's own code, which Uraeda runs and
  embeds live, so the picked variant is the code that ships.

## 0.5.0 - 2026-10-15

### Features

- **[Image attachments](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-13-image-attachments.md)**
  ([#14](https://github.com/mrtolkien/uraeda/pull/14)): Chats, proposals, and reviews accept images,
  dropped anywhere on the page or picked with a dedicated button, because "screenshots are often
  useful!". The answers widened it to every text a human writes, added paste, and a Neovim command
  to paste from the clipboard. Since committed images live in git history forever, the human asked
  for "an efficient, highly compressed format, that still works well for screenshots": every image
  is re-encoded as WebP by the Rust core.
- **[Multi-repo server](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-13-multi-repo-server.md)**
  ([#12](https://github.com/mrtolkien/uraeda/pull/12)): The server served one repository, the folder
  it started in. The human wanted Uraeda to manage several repositories from one web UI, with a
  repository selector at the top left and any folder of the machine addable, since a packaged Uraeda
  needs a flow to pick its first repository anyway. Running the UI easily, with `npx`, was split
  into its own feature,
  [Run the web UI with npx](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-run-ui.md).
- **[Code quality and maintainability through the skill](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-code-quality-in-the-skill.md)**
  ([#13](https://github.com/mrtolkien/uraeda/pull/13)): The human wants high-quality, maintainable
  apps with the least work, without reading a line of code. Research and a review of this repository
  showed agents grow and copy code feature after feature, held back by instructions alone, and that
  specs of 431 to 719 lines bury what the human must approve. This feature puts the human's part of
  a spec first and folds the build details in the web UI, writes a few code-quality concepts into
  the skill, each backed by a check, pushes every project to set those checks up, makes `SKILL.md` a
  lean entry point, and turns plan review off by default. This repository adopts the checks itself.
  The maintenance flow, an audit the human answers like a round of questions, was left for its own
  feature.
- **[Run the UI easily](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-run-ui.md)**
  ([#17](https://github.com/mrtolkien/uraeda/pull/17)): The web UI only ran from a checkout of
  Uraeda, with Rust, Node, pnpm, and a build. The human asked for the best and simplest way to
  package Uraeda today, so anyone can run it with one command, and for every promising solution to
  be tested: a single binary, a desktop app, or `npx uraeda`. Three were built and run during
  discovery: an npm package (3.5 MB, needs Node 24), a Node single executable (159 MB), and a Bun
  one (90 MB). The human chose the npm package.
- **[Dedicated session view](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-session-view.md)**
  ([#15](https://github.com/mrtolkien/uraeda/pull/15)): Following what an agent does is one of the
  main things the web UI is for, and a feature's session was a pane 40 % wide beside the feature
  page on a desktop, about 480 px of a 1440 px window: "it's hard to really follow what is happening
  at the moment". The session became a page of its own at every width, with a column beside the
  transcript for the feature's progress and the files changed on its branch. The sidebar shows each
  feature by its slug and, during its implementation, its current task, "7/11", taken from the
  plan's checkboxes, so it shows whoever runs the agent, the UI or a terminal.
- **[Text inputs and comments](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-text-inputs.md)**
  ([#16](https://github.com/mrtolkien/uraeda/pull/16)): Writing is most of what the human does in
  the web UI, and it did not feel solid: the round's notes lost letters and showed twice on the
  page, review comments lagged on long specs, and some fields saved as they were typed while others
  waited for a button. The human asked for every text field to save only with a button, and for
  comments on the points a round settled without them, written into its notes.
