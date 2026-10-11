---
status: awaiting-human
---

# Clarifications, round 01: Web UI for the workflow files

> [!IMPORTANT]
>
> 11 questions on the web UI, about 35 minutes.
>
> - Two choices change active decisions: how your iPhone reaches the server, against the stack
>   decision's 127.0.0.1 rule, and whether fate stays, with the decision's fallback rule removed.
> - Where the UI writes when a feature's branch is not checked out: `ura answer` switches branches,
>   which would switch the running server's own code under it in this repository.
> - How files are rendered decides whether the core grows a document tree, which the TUIs would
>   reuse later.
> - Three gaps in the proposal: what "update to proposal" covers, finished features missing from the
>   core's model, and which repositories the UI opens.
> - Two questions set the screens, each with a sketch: the navigation, and the answer page.
> - 16 points are settled without you, at the end: check them.

## Context

The [proposal](proposal.md) asks for a web UI that shows every step of the workflow with a clear
hierarchy, and performs the human steps: drafts, proposals, answers, spec and plan reviews. Files
render with the skill's markdown and their structure: question cards with option buttons and free
text, options with their pros and cons, user stories over their scenarios. It runs with `vp dev` at
the root, for your iPhone over Tailscale, built with React, Astryx, fate, and the Rust core.

Today, the human actions exist in the [core](/crates/core/src/actions/), used by `ura`, but the
[server](/packages/server/src/) reaches only a temporary status reader through the
[binding](/crates/binding/src/lib.rs), and the [web UI](/packages/web/src/) is a temporary list of
folders. The core's parsers keep line numbers, but not option texts, pros and cons, user stories, or
plan checkboxes.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Which human steps does the UI perform?

The proposal lists "draft, update to proposal, clarification, spec review, plan review". "Update to
proposal" can mean editing a proposal, or turning a draft into a proposal, which is `ura start`. The
workflow has two more human steps: reviewing a bug's assessment, and committing a proposal written
by hand. Every action below already exists in the core. More in
[discovery](discovery-01.md#scope-of-the-human-actions).

Why it matters: it sets how many screens this feature builds, and what still needs a terminal.

- **A (recommended). Every human step: answer a round of questions, review a spec, a plan, or a bug
  assessment (comments, approve, request changes), draft a line of `PRIORITIES.md`, edit and commit
  drafts and proposals, and start a feature from a draft.**
  - [pro] nothing in the workflow needs your computer.
  - [con] two screens more than the proposal lists: assessments and starting.
  - Why recommended: the proposal says the UI is how you will work on the project, and each extra
    step reuses a screen and a core action that exist.
- **B. The proposal's list only: answers, spec and plan reviews, drafts and proposals edited and
  committed. Starting a feature and bug assessments stay in `ura`.**
  - [pro] the smallest scope.
  - [con] starting a feature, the step after a draft, needs the terminal.
- **C. A, and any workflow file can also be edited as raw text, specs and plans included, raising a
  spec's `revision` when it changes.**
  - [pro] fixes a typo in a spec without a review round.
  - [con] a raw editor next to every structured screen, and edits that bypass the review files.

**Answer:**

## Q2: How does your iPhone reach the server?

The proposal says no security is needed, since you access it through Tailscale only. The active
[stack decision](../decisions/stack.md) requires the server to listen on 127.0.0.1, and to reject
any `Host` but `127.0.0.1` or `localhost`, and foreign origins, because the server will commit and
start agents, and a web page you open could otherwise reach it. `tailscale serve` keeps the server
on 127.0.0.1, but passes your machine's `*.ts.net` name, which both Vite and the server's guard
reject today. Tailscale keeps other machines out, not a malicious page opened on your Mac or phone.
More in [discovery](discovery-01.md#network-access).

Why it matters: it amends an active decision, which every later server feature follows.

- **A (recommended). Run `tailscale serve` to the server on 127.0.0.1; the server and Vite also
  accept the `*.ts.net` host and its `https://` origin given in an option. The stack decision's Host
  rule gains that case.**
  - [pro] one command on your machine, HTTPS, and a page you browse still cannot reach the server.
  - [con] the decision changes, and the host name is set once in an option.
  - Why recommended: it gives the proposal its access, and keeps what the rule protects.
- **B. A, and requests that come through Tailscale must also carry its `Tailscale-User-Login`
  header, which `tailscale serve` adds and strips from incoming requests.**
  - [pro] only people logged into your tailnet get in, at no cost.
  - [con] a second check, which the proposal does not ask for.
- **C. Listen on every interface, without the guard, as the proposal says.**
  - [pro] nothing to set up.
  - [con] the stack decision's rule is removed, your local network reaches the server too, and any
    page you browse can.

**Answer:**

## Q3: Where does the UI write when a feature's branch is not checked out?

Each feature lives on its own branch, while the server runs from one checkout. The core reads every
branch without a checkout, but `ura answer` and `ura review` write by switching your checkout to the
feature's branch, and refuse when it has uncommitted changes. Running from Uraeda's own checkout,
switching branches also switches the server's own code. Hooks run from the checkout: this
repository's are generated by `vp install`, so a new worktree has none until they are pointed to.
More in [discovery](discovery-01.md#writing-to-feature-branches).

Why it matters: it decides whether every feature can be answered from your phone, and whether the UI
ever touches the checkout you work in.

- **A (recommended). Write in the checkout when it is on the feature's branch, else in an existing
  worktree on it, else in a worktree the server creates for that branch, which runs the same hooks
  as your checkout.**
  - [pro] every feature is writable from your phone, and your checkout is never switched.
  - [con] one hidden worktree per feature written to, removed once its branch is merged, and the
    core learns to create them.
  - Why recommended: it is the only option where answering from the phone never needs your computer.
- **B. Write only where a checkout or worktree is already on the feature's branch; other features
  are shown read-only, saying which branch to check out.**
  - [pro] the UI never creates anything in git.
  - [con] each feature needs a worktree set up from your computer first.
- **C. Switch your checkout to the feature's branch, like `ura answer`, refused when it has
  uncommitted changes.**
  - [pro] the same behaviour as the CLI.
  - [con] the server's code switches under it here, and a saved, unsubmitted answer blocks every
    later switch.

**Answer:**

## Q4: Where does the structure the UI draws come from?

The stack decision says TypeScript must not reimplement the core's parsing. The core reads files
with pulldown-cmark, which gives each block its source lines, but keeps only headings, links, and a
callout. Astryx has a `Markdown` component with its own parser, which knows no callouts or typed
bullets and gives positions to top-level blocks only. Review comments anchor to blocks, as you chose
for `ura review`
([Q12 of the CLI core](../2026-10-10-cli-core/clarifications-01.md#q12-what-does-ura-review-show-and-what-is-the-active-line)).
More in [discovery](discovery-01.md#where-the-rendering-structure-comes-from).

Why it matters: it decides what the core owns, and whether the TUIs can reuse it.

- **A (recommended). The core turns each file into a tree of blocks (headings, paragraphs, list
  items, callouts, typed bullets, tables, code), each with its source lines, plus the structured
  items (questions, options, user stories, tasks, comments). React draws the tree with Astryx
  components.**
  - [pro] one parser, every block commentable, list items included; the TUIs can draw the same tree.
  - [con] the largest change to the core, and a recursive type through napi-rs, not checked yet.
  - Why recommended: it follows the stack decision as written, and serves the next feature too.
- **B. The core sends the structured items; the free text inside them is drawn by Astryx's
  `Markdown`, with plugins for callouts and typed bullets.**
  - [pro] the least Rust; Astryx's styles for free.
  - [con] a second parser in TypeScript, which the stack decision forbids unless amended, and
    comments only on top-level blocks.
- **C. The core renders each file to HTML, with source lines on each element.**
  - [pro] one parser, little React.
  - [con] HTML injected into the page, outside Astryx's components, with no source lines on list
    items.

**Answer:**

## Q5: Does fate stay the data layer?

fate works without a database, but its custom sources rely on types it exports without documenting
them, each entity type needs its own source, and it shipped six releases in five days. Its live
views and optimistic updates work with such sources. The stack decision kept a fallback, Hono's
typed client and TanStack Query, to be used if fate could not read data outside a database, and said
to drop the rule that did not ship. More in [discovery](discovery-01.md#data-layer).

Why it matters: every later screen, the runner's included, uses this layer.

- **A (recommended). Keep fate: one source per type over the binding, mutations for the actions, and
  live views fed by a file watcher. The stack decision drops its fallback rule.**
  - [pro] live updates and optimistic answers built in, as the decision chose fate for.
  - [con] undocumented parts of fate, which a minor release can break.
  - Why recommended: the proposal asks for fate, and the decision's condition for dropping it is not
    met.
- **B. Switch to Hono's typed client and TanStack Query, with a server-sent events route that
  refetches what changed.**
  - [pro] documented, widely used, simple for file-shaped data.
  - [con] optimistic updates written by hand for each action, and a new dependency.

**Answer:**

## Q6: Do finished features show?

The core leaves out features merged into the default branch, a known gap deferred to this feature
([R10 of the CLI core](../2026-10-10-cli-core/rulings.md#r10-minor-findings-of-the-final-review-left-for-later)).
In Uraeda today, the stack-decision and CLI core features would not appear. More in
[discovery](discovery-01.md#finished-features).

Why it matters: "view all steps of the workflow" reads as the history too.

- **A (recommended). Show merged features, read from the default branch, in a "Done" group below the
  features in progress; `ura status` shows them too.**
  - [pro] the history is readable, as the proposal's "all steps" suggests.
  - [con] a change in the core's model, which `ura status` shares.
  - Why recommended: it fixes a known gap, at the moment it matters.
- **B. Show work in progress only, like `ura status` today.**
  - [pro] no change to the core's model.
  - [con] finished specs are read on GitHub instead.

**Answer:**

## Q7: How are the screens organised?

Linear opens on what waits on you, grouped by what to do; Obsidian on a file tree; GitHub Projects
on a board. Astryx's `AppShell` turns a side navigation into a drawer below 768 px. The CLI's
`ura status` already groups features by who they wait on. More in
[discovery](discovery-01.md#navigation).

Why it matters: it is the first screen you see, every time.

- **A (recommended). Home lists what waits on you, grouped by action (answer, review, write), then
  the features by priority, with their step. A feature shows its files in workflow order, each with
  its status. A file opens full width, with an outline of its headings.**
  - [pro] the next thing to do is the first thing shown.
  - [con] one more screen than a file tree.
  - Why recommended: you will open it to see what needs you.
- **B. A file tree of `specs/`, like Obsidian, with the status as badges.**
  - [pro] the simplest, and familiar.
  - [con] what waits on you is spread through the tree.
- **C. A board with a column per step.**
  - [pro] the whole pipeline at a glance on a computer.
  - [con] columns scroll sideways on a phone.

A, on a phone:

```text
 ☰  Uraeda                         │  ‹ Web UI for the workflow files
 ──────────────────────────────────│  ─────────────────────────────────
 Waiting on you                    │  Answer questions · 11 · ~35 min
  ▸ Answer · Web UI       11 Q     │  ✓ proposal.md
  ▸ Review · Spec of X     v2      │  ✓ discovery-01.md
                                   │  ● clarifications-01.md  waiting
 In progress                       │    spec.md  not yet
  · CLI TUIs   discovery (agent)   │    plan.md  not yet
                                   │
 Done                              │
  · CLI core features              │
```

**Answer:**

## Q8: How is a round of questions answered?

Each question is a card with its context, its options as buttons with pros and cons, and a text box.
Spec Kit asks one question at a time; Claude Code shows a few per call, and its clones end with a
summary of every answer. The TUI you designed goes question by question. Options may combine ("B and
C: ..."), and follow-ups only apply to one answer of their parent. More in
[discovery](discovery-01.md#answering-questions).

Why it matters: it is the screen you will use most.

- **A (recommended). Every question as a card on one page, in order, each follow-up inside its
  parent and shown once its letter is picked, with a progress bar on top and the settled points,
  your notes, and Submit at the end.**
  - [pro] related questions stay a scroll away, as the file reads.
  - [con] a long page.
  - Why recommended: questions refer to each other, and scrolling is the phone's natural motion.
- **B. One card per screen, with previous and next, then a summary of every answer, the settled
  points, your notes, and Submit.**
  - [pro] focused, like the TUI.
  - [con] going back to an earlier question takes taps, and the context of each card is alone.

A, on a phone:

```text
 Clarifications, round 01            4 of 11 ▓▓▓▓░░░░░░░
 ┌─────────────────────────────────────────────────────┐
 │ Q2  How does your iPhone reach the server?          │
 │ The proposal says no security is needed... ▾ more   │
 │ ┌─────────────────────────────────────────────────┐ │
 │ │ A  recommended                               ✓  │ │
 │ │ Run tailscale serve to the server on 127.0.0.1… │ │
 │ │ + one command, HTTPS, ...                       │ │
 │ │ − the decision changes, ...                     │ │
 │ └─────────────────────────────────────────────────┘ │
 │ ┌ B  A, and requests must carry ... ──────────────┐ │
 │ ┌ C  Listen on every interface ... ───────────────┐ │
 │ Comment                                             │
 │ ┌─────────────────────────────────────────────────┐ │
 │ │ but only for the dev server                     │ │
 │ └─────────────────────────────────────────────────┘ │
 │ Answer: A: but only for the dev server     saved ✓  │
 └─────────────────────────────────────────────────────┘
```

**Answer:**

## Q9: What do you type drafts, proposals, answers, and comments in?

Workflow files must stay exactly in their template's format. Rich editors rewrite markdown they
parse, and escape syntax they do not know, like `[pro]`. CodeMirror edits the raw text with
highlighting, about 175 KB, with selection issues reported on iOS. Astryx's text area keeps a 16 px
font on iOS, so focusing it does not zoom the page. More in
[discovery](discovery-01.md#editing-text).

Why it matters: it is a dependency, and how every text you write is typed.

- **A (recommended). Astryx's text area, growing with its text, for everything.**
  - [pro] the file stays byte for byte as typed, nothing to add, native typing on iOS.
  - [con] no highlighting when editing a whole proposal.
  - Why recommended: proposals and answers are prose, and the phone's own text editing is the best
    there is on it.
- **B. CodeMirror 6 with markdown highlighting for drafts and proposals, the text area for answers
  and comments.**
  - [pro] highlighting and a monospace editor for whole files.
  - [con] a 175 KB dependency, and the iOS issues reported.

**Answer:**

## Q10: Which repositories does the UI open now?

The proposal asks for `vp dev` at the root of the repository to show. `vp dev` at Uraeda's root
serves nothing today, and the UI's code lives in Uraeda's workspace: nothing packages it for other
repositories. More in [discovery](discovery-01.md#opening-another-repository).

Why it matters: packaging the server for any repository is a feature of its own.

- **A (recommended). `vp dev` at Uraeda's root opens Uraeda; an environment variable makes it open
  another repository instead, still started from Uraeda's checkout.**
  - [pro] covers dogfooding, and other repositories at almost no cost.
  - [con] other repositories need Uraeda's checkout.
  - Why recommended: the proposal says "as of right now", and A leaves packaging for later.
- **B. Uraeda only.**
  - [pro] nothing more.
  - [con] no way to try it on another project.
- **C. A command run from any repository, like `ura web`, serving a packaged UI.**
  - [pro] the end goal.
  - [con] shipping the server and its native addon, a feature of its own.

**Answer:**

## Q11: Which dependencies does the UI add?

Astryx's quickstart adds a theme package, `@astryxdesign/theme-neutral`, which today's UI does not
have. With the recommended answers above, nothing else is needed: file watching uses Node's own,
editing the text area, and rendering the core. More in
[discovery](discovery-01.md#new-dependencies).

Why it matters: dependencies are decisions the project keeps.

- **A (recommended). Add `@astryxdesign/theme-neutral` only, pinned like Astryx.**
  - [pro] the quickstart's setup, with a readable default theme.
  - [con] one more package from a 0.x design system.
  - Why recommended: the proposal asks to follow the Astryx quickstart.
- **B. No new dependency: Astryx's base tokens only.**
  - [pro] nothing added.
  - [con] the UI departs from the documented setup.

**Answer:**

## Settled without the human

- **The actions' commits move into the core**: answering and reviewing commit in the CLI today; they
  move into the core's actions, so `ura` and the server share them, with the same commit messages.
  The binding runs them as async tasks, since git and `gh` block. See
  [discovery](discovery-01.md#important-reads).
- **An answer is written** as the letters you pick, in order, then your comment: "A", "B and C", "A,
  B and C", then ": " and the comment when there is one. A comment alone is your own words. See
  [discovery](discovery-01.md#answers-with-options-and-comments).
- **Answers are saved as you type**, after a short pause and when leaving a field, into the round's
  file, uncommitted, as `ura answer` does without `--submit`; Submit commits the round, refused
  while an applicable question is blank, which the page highlights.
- **Your notes on the settled points** get their own text area at the end of the round.
- **Review comments anchor to blocks**: tap a block to comment, tap another to extend the range, as
  you chose for `ura review`. Comments are written to the review file as you add them, uncommitted,
  and can be edited or removed before the verdict. See [discovery](discovery-01.md#needs-no-choice).
- **A review shows the version committed at the branch's tip**, which comments anchor to, and says
  so when the file on disk differs from it.
- **Approving a spec** offers its risk tier and plan review, as `ura review --approve` does.
- **Plan tasks show read-only**, with their checkboxes: agents check them off.
- **A plan's review screen shows only when the plan waits on you**: with `plan-review: false`, it is
  `auto-approved`. See [discovery](discovery-01.md#plan-review-comments).
- **A save never overwrites a change made elsewhere**: it carries the hash of the text it started
  from, and the server refuses it if the file changed, showing the new version. See
  [file watching](discovery-01.md#file-watching).
- **Changes on disk show live**: the server watches `specs/` and git's references, and the page
  reconnects and reloads its data when it comes back to the foreground, as iOS Safari drops streams
  silently. See [iOS Safari](discovery-01.md#ios-safari-and-touch-targets).
- **Built for the phone first**: 44 px touch targets on touch screens through an Astryx theme rule,
  `svh` instead of `vh`, safe-area paddings, and Submit and Approve placed at the end of the page
  rather than in a bar the keyboard covers.
- **`vp dev` at the root runs the UI and the server in one process**, the Hono app inside Vite's dev
  server, so one port is served. `vp run dev` and the server's own options keep working. See
  [Vite+](discovery-01.md#vite-and-the-dev-server).
- **The skill's markdown is recognised by the core**: `> [!QUESTION]`, which pulldown-cmark does not
  know, typed bullets, and list callouts. Code blocks render with Astryx's `CodeBlock`; no file uses
  mermaid. No raw HTML from a file is rendered. See
  [markdown parsers](discovery-01.md#markdown-parsers).
- **Committing triggers nothing**, as the proposal says, and notifications stay in their own
  priority line.
- **The temporary status page, source, and binding functions are replaced**, and their comments
  corrected: they still say "replaced by the CLI feature".

**Notes:**
