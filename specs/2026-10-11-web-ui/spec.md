---
status: awaiting-human
revision: 2
clarifications: 1
risk-tier: high
plan-review: true
---

# Spec: Web UI for the workflow files

> [!IMPORTANT]
>
> Spec to review, about 40 minutes.
>
> - Revision 2, from your review in chat: every question and option in full, the reading layout
>   without nested boxes at iPhone 17 size, a light and dark switch, jotting and reordering
>   priorities (US7), and the file watcher in the core.
> - Two changed decisions. [Stack](../decisions/stack.md#proposed-change-2026-10-11-web-ui): the
>   server accepts the host names listed in `URAEDA_ALLOWED_HOSTS`, fate's fallback rule goes, and
>   the UI never parses markdown. [Git](../decisions/git.md#proposed-change-2026-10-11-web-ui):
>   tools never switch your checkout, they write in a worktree at `.worktrees/<branch>/`, and
>   `ura start` creates one by default, as you asked.
> - `ura answer` and `ura review` change too: they write in a worktree instead of switching your
>   checkout, which reverses Q7 of the CLI core. `ura start --switch` keeps the old behaviour on
>   request.
> - Worktrees are never removed automatically: removing them is left to the "finish feature" step
>   you mentioned. Until then, `git worktree remove` does it.
> - The configuration lives in a git-ignored `.env` at the repository root: `URAEDA_ALLOWED_HOSTS`,
>   `URAEDA_PORT`, and `URAEDA_REPO`, read by `vp dev` and the server alike.
> - The core grows the most: a document tree with source lines for every file, richer parsers, the
>   commits moved out of the CLI, worktrees, and merged features in `ura status`.
> - Home lists your priorities' Now and Next lines, with Draft and Start buttons, as your answer to
>   the navigation question asked. ＋ on every page jots a line down in `PRIORITIES.md`, and a
>   Priorities page reorders them, committed when you tap Commit (US7).
> - Two new dependencies, both for your review comments: the `notify` crate, since the file watcher
>   moves into the core for the TUI to reuse, and Playwright with WebKit, a dev dependency, to check
>   at iPhone 17 size that no text is cut and nothing is boxed twice (SC-007).
> - Risk tier `high`: the server's access rules change, and tools write in new places in git. The
>   plan waits for your review.

A web UI, served by `vp dev` at the repository's root and reached from a phone over Tailscale, shows
every feature, bug, and priority with its workflow step, renders each workflow file with its
structure, and performs every human step: answering questions, reviewing specs, plans, and
assessments, drafting, editing and committing drafts and proposals, starting features, and jotting
down and reordering priorities. It is how the human works on Uraeda away from the computer, and the
first tool on the core's binding. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## User stories

### US1: See what waits on me (P1)

The home screen lists, in groups left out when empty: what waits on the human, grouped by action;
what agents are working on, with their step; the `PRIORITIES.md` lines of Now and Next not started
yet; and the features merged into the default branch, as Done. Each feature opens its page: its
waiting block, its branch and worktree, its files in workflow order with their status, and the
problems `ura check` finds in it.

Why this priority: it is the first screen, and the one the human opens to know what needs them
([Q7](clarifications-01.md#q7-how-are-the-screens-organised)).

Acceptance scenarios:

1. **Given** a feature `2026-10-11-web-ui` whose `clarifications-01.md` is `awaiting-human` with the
   block line "11 questions on the web UI, about 35 minutes.", **When** the human opens the home
   screen, **Then** "Waiting on you" shows "Web UI for the workflow files" under the action
   "Answer", with that line.
2. **Given** a feature whose spec is `approved` and has no plan, **When** the human opens the home
   screen, **Then** "Agents at work" shows it with the step "Plan".
3. **Given** the feature folders `2026-10-10-cli-core` and `2026-10-10-stack-decision` on the
   default branch, their branches merged, **When** the human opens the home screen, **Then** "Done"
   shows both, and `ura status` lists them with the source `default-branch`.
4. **Given** a Next line "Git listener process" with no link, and a Next line linking
   `drafts/note.md`, **When** the human opens the home screen, **Then** "Priorities" shows the first
   with a "Draft" button and the second with a "Start" button, and lines of Later and Blocked are
   not shown.
5. **Given** a feature with `proposal.md`, `discovery-01.md`, `clarifications-01.md`, and no spec,
   **When** the human opens it, **Then** the files show in that order, followed by `spec.md` and
   `plan.md` as "not yet", each file with its status.
6. **Given** a feature whose `clarifications-01.md` has a question without an `**Answer:**` line,
   **When** the human opens it, **Then** a problem shows: "clarifications-01.md:40" and the message
   `ura check` gives.

### US2: Answer a round of questions (P1)

The round opens as one page: its context, then every question, each with its whole context, every
option in full with its text, pros, cons, and "Why recommended", and a comment field. Nothing is
folded or cut: no "more", no ellipsis, no option shown as its first line. Questions are split by a
band and options by hairlines, with no card around either, following the
[reading layout](#reading-layout). Follow-ups show inside their parent once they apply. The answer
is saved as the human types, and a progress bar counts the applicable questions answered. The end of
the page holds the settled points, the notes, and Submit.

Why this priority: it is the screen the human uses most
([Q8](clarifications-01.md#q8-how-is-a-round-of-questions-answered)).

Acceptance scenarios:

1. **Given** Q2 with options A, B, C and a blank answer, **When** the human taps A, **Then** the
   file's Q2 line reads `**Answer:** A`, and Q2 shows "saved".
2. **Given** Q1 answered `B`, **When** the human also taps C, **Then** the line reads
   `**Answer:** B and C`; with A tapped too, `**Answer:** A, B and C`.
3. **Given** Q2 with A selected, **When** the human types "but only for the dev server" in its
   comment, **Then** after the save the line reads `**Answer:** A: but only for the dev server`.
4. **Given** Q4 with nothing selected, **When** the human types "Neither, keep it simple", **Then**
   the line reads `**Answer:** Neither, keep it simple`.
5. **Given** a file whose Q2 line reads `**Answer:** B and C: weekdays matter`, **When** the page
   opens, **Then** B and C are selected and the comment reads "weekdays matter".
6. **Given** Q2 with a follow-up Q2.B, **When** Q2's answer is `A`, **Then** Q2.B is hidden and not
   counted; **When** it becomes `B`, **Then** Q2.B shows inside Q2 and counts.
7. **Given** Q1 answered "keep it simple", naming no letter, and its follow-up Q1.B blank, **When**
   the human taps "Does not apply" on Q1.B, **Then** its line reads `**Answer:** -`.
8. **Given** 11 applicable questions, 9 answered, **When** the human views the end of the page,
   **Then** it reads "2 questions left: Q7, Q1.B", each a link to its question, and Submit is
   disabled.
9. **Given** every applicable question answered, **When** the human taps Submit, **Then** the round
   is `answered`, its block becomes "Answered on <today>", one commit is made on the feature's
   branch, and the page shows the round read-only with that record.
10. **Given** a round, **When** the human types "LGTM" in Notes, **Then** the file's last line reads
    `**Notes:** LGTM`.
11. **Given** Q2 of this feature's round, whose context runs over 9 lines and whose options B and C
    are not selected, **When** the page opens, **Then** Q2's whole context and the text, pros, and
    cons of A, B, and C show, and no element of the page is cut by an ellipsis or a "more" link.

### US3: Review a spec, plan, or assessment (P1)

A file waiting for review renders the version committed at its branch's tip, with its structure:
user stories as sections, their id and priority above a large title, their scenarios numbered
inside; plan tasks as rows with their steps; assessments as documents. No story or task is boxed in
a card ([reading layout](#reading-layout)). Tapping a block selects it, tapping another extends the
selection, and a sheet takes the comment. Pending comments show under their blocks, editable and
removable. The end of the page lists them, takes a general comment and a summary, and, for a spec,
the risk tier and whether the plan waits for a review, then Approve and Request changes.

Why this priority: it is the human's main review of the workflow.

Acceptance scenarios:

1. **Given** a spec waiting for review, whose scenario 1 of US2 spans lines 92 and 93, **When** the
   human taps that scenario and adds "Say what the row shows", **Then** `spec-review.md` has
   `## C1: Lines 92–93, under "US2: Complete a repeating task (P1)"`, the two lines quoted, the
   comment, `verdict: pending`, and the tip's short hash as `commit`, uncommitted.
2. **Given** the scenario selected, **When** the human taps the next scenario's block, spanning
   lines 94 and 95, **Then** the selection covers lines 92 to 95.
3. **Given** the pending comment C1, **When** the human edits it to "Say what the row shows, and for
   how long", **Then** C1 in `spec-review.md` has the new text; **When** the human removes it,
   **Then** the review file is deleted, since it has no comment left.
4. **Given** a spec of risk tier `medium`, **When** the human approves it with the tier set to
   `high` and no change to the plan switch, **Then** the spec is `approved`, `risk-tier: high`,
   `plan-review: true`, and one commit is made.
5. **Given** a spec with no pending comment, **When** the human views Request changes, **Then** it
   is disabled, with "Add a comment first".
6. **Given** a plan waiting for review, **When** the human opens it, **Then** each task shows its
   title and its checked steps out of its total, like "2/5", and the verdict offers no risk tier.
7. **Given** a spec with pending comments on commit `a1b2c3d`, **When** the branch's tip changes the
   spec, **Then** the page warns "The spec changed since your comments: your 1 pending comment is on
   the previous version. Adding a comment replaces it."

### US4: Write drafts and proposals (P2)

From a Now or Next line, "Draft" creates the draft and opens it in a text area; a draft or a
proposal can be edited, saved as typed, previewed rendered, and committed. "Start" turns a draft
into a feature, in its own worktree.

Why this priority: it starts every feature, but happens less often than answering and reviewing
([Q1](clarifications-01.md#q1-which-human-steps-does-the-ui-perform)).

Acceptance scenarios:

1. **Given** the Next line "Git listener process" with no link, **When** the human taps "Draft",
   **Then** `specs/drafts/git-listener-process.md` exists on the default branch, from the proposal
   template with that title, the line links to it, and the editor opens on it. Nothing is committed.
2. **Given** a draft open in the editor, **When** the human types and pauses, **Then** the file on
   disk holds the text typed, byte for byte.
3. **Given** a draft not committed, **When** the human taps "Commit", **Then** it is committed on
   the default branch as `chore: draft Git listener process`, with `specs/PRIORITIES.md` when it
   changed.
4. **Given** the draft `specs/drafts/git-listener.md` with its line in Next, **When** the human taps
   "Start" with the slug `git-listener` on 2026-10-12, **Then** `ura start` runs: the line moves to
   Now, the branch `2026-10-12-git-listener` exists in `.worktrees/2026-10-12-git-listener/` with
   `specs/2026-10-12-git-listener/proposal.md`, the human's checkout is still on its branch, and the
   page opens the new feature.
5. **Given** a feature waiting on its uncommitted `proposal.md`, **When** the human edits it and
   taps "Commit", **Then** it is committed on the feature's branch as `chore(<slug>): proposal`.
6. **Given** a draft with the template's placeholders, **When** the human taps "Start", **Then** the
   page shows `ura start`'s refusal, and nothing changes.

### US5: Write on any feature from one checkout (P1)

Every write lands on the right branch without switching the human's checkout: in the checkout or
worktree that has the branch, or in a worktree created at `.worktrees/<branch>/`. `ura answer`,
`ura review`, `ura draft`, and `ura start` do the same.

Why this priority: answering from the phone depends on it, and switching would move the running
server's own code
([Q3](clarifications-01.md#q3-where-does-the-ui-write-when-a-features-branch-is-not-checked-out)).

Acceptance scenarios:

1. **Given** the checkout on `main` and a feature branch `2026-10-11-web-ui` checked out nowhere,
   **When** the human saves an answer, **Then** `.worktrees/2026-10-11-web-ui/` is created on that
   branch, holds the answer, and the checkout is still on `main`.
2. **Given** that worktree exists, **When** the human saves another answer, **Then** it is written
   there, and no worktree is added.
3. **Given** the checkout itself on the feature's branch, **When** the human saves an answer,
   **Then** it is written in the checkout.
4. **Given** a feature branch only on `origin`, **When** the human saves an answer, **Then** a local
   branch tracking it is created in `.worktrees/<branch>/`, and the answer is written there.
5. **Given** `core.hooksPath` set to `.vite-hooks/_` in the main checkout, **When** a round is
   submitted in a worktree, **Then** the pre-commit hook of the main checkout runs.
6. **Given** a first worktree created, **When** the human runs `git status` in the main checkout,
   **Then** `.worktrees/` is not listed, and no tracked file changed.
7. **Given** `ura start <draft> --switch`, **When** it runs, **Then** it creates the branch and
   switches the checkout to it, as before this feature.

### US6: Reach the UI from a phone (P1)

`vp dev` at the root starts the UI and the server in one process on 127.0.0.1. With
`tailscale serve` pointing at it, and the machine's name listed in `URAEDA_ALLOWED_HOSTS` in `.env`,
the phone opens the UI at its `*.ts.net` address. The layout is built for an iPhone 17's 402 px wide
screen, with 44 px touch targets and the [reading layout](#reading-layout), and keeps itself up to
date. The menu has a theme switch: System, Light, or Dark.

Why this priority: the phone is the reason for the feature
([Q2](clarifications-01.md#q2-how-does-your-iphone-reach-the-server),
[Q10](clarifications-01.md#q10-which-repositories-does-the-ui-open-now)).

Acceptance scenarios:

1. **Given** `.env` with `URAEDA_ALLOWED_HOSTS=mac.tail1234.ts.net`, **When** a request comes with
   `Host: mac.tail1234.ts.net` and `Origin: https://mac.tail1234.ts.net`, **Then** it is served.
2. **Given** the same `.env`, **When** a request comes with `Host: evil.example`, **Then** it gets
   403 "Forbidden host"; with `Origin: https://evil.example`, 403 "Forbidden origin".
3. **Given** no `URAEDA_PORT`, **When** `vp dev` starts at the root, **Then** the UI and `/fate` are
   served on `http://127.0.0.1:4310`, and on no other interface.
4. **Given** `URAEDA_REPO=/home/tolki/todo-app` in `.env`, **When** `vp dev` starts, **Then** the UI
   shows that repository's `specs/`.
5. **Given** the UI open on a feature, **When** an agent commits `spec.md` on its branch, **Then**
   the feature's page shows the spec within 2 seconds, without a reload.
6. **Given** the page in the background on iOS, **When** it comes back to the foreground, **Then**
   it reconnects and reloads its data.
7. **Given** the system in light mode and the theme on System, **When** the human picks Dark in the
   menu, **Then** the UI turns dark at once, and stays dark after a reload; **When** they pick
   System again, **Then** it follows the system's mode again.

### US7: Jot down and reorder priorities (P2)

＋, in the top bar of every page, opens a sheet with a text field, focused, and the section, Next by
default: "Add" writes the line at the end of that section at once. The Priorities page lists every
section, Now, Next, Later, and Blocked; a line moves by dragging it, or through its menu: Move up,
Move down, Move to a section, Edit, and Delete. Each change is written to `specs/PRIORITIES.md` on
the default branch as it is made, uncommitted; a bar at the bottom counts them, with Discard and
Commit.

Why this priority: an idea has to be written down before it is forgotten, in seconds, from the
phone; reordering can wait until the human sits down to it.

Acceptance scenarios:

1. **Given** the home screen, **When** the human taps ＋, types "Show the agent's last commit on the
   feature page", and taps "Add", **Then** `specs/PRIORITIES.md` ends its Next section with
   `- Show the agent's last commit on the feature page`, nothing is committed, and the sheet closes
   with "Added to Next, not committed".
2. **Given** that sheet, **When** the human picks Later before "Add", **Then** the line ends the
   Later section.
3. **Given** Next holding "Git listener process" then "Ping user when input is needed", **When** the
   human drags the second above the first, **Then** the file lists them in that order, and the bar
   reads "1 change to commit".
4. **Given** a Later line with a nested item under it, **When** the human moves it to Next, **Then**
   it ends Next with its nested item, and Later no longer has either.
5. **Given** a line linking `drafts/git-listener.md`, **When** the human edits its text, **Then**
   the sheet shows the line's markdown as written, link included, and saving writes it back as
   typed.
6. **Given** 2 uncommitted changes, **When** the human taps "Commit", **Then** one commit on the
   default branch holds `specs/PRIORITIES.md` only, as `chore: update the priorities`, and the bar
   goes.
7. **Given** 2 uncommitted changes, **When** the human taps "Discard" and confirms, **Then**
   `specs/PRIORITIES.md` is back to its committed text.
8. **Given** the human's checkout on a feature branch and the default branch checked out nowhere,
   **When** the human adds a line, **Then** it is written in `.worktrees/main/`, as US5 writes.

## Edge cases

- **A save meets a change made elsewhere**: an answer is saved with the answer it replaces, and a
  draft or proposal with the hash of the text it was loaded from. When the file no longer matches,
  nothing is written, and the page shows the new version: "proposal.md changed on disk since you
  opened it. Your text was not saved.", with "Copy my text" and "Load the new version".
- **A round submitted elsewhere while open**: the page turns read-only, with the round's record.
- **An answer or comment line starting with `#`, or an answer line starting with `**Answer:**` or
  `**Notes:**`**: refused by the core, as in `ura`; the field shows the core's message and keeps the
  text.
- **A hook refuses a commit**: the files stay written and uncommitted; the page shows "The
  pre-commit hook refused the commit. Your answers are saved, not committed.", the hook's whole
  output in a collapsed section, and "Try again", which commits them.
- **Other files staged in the worktree written to**: the core refuses before writing, as today, and
  the page lists the staged files.
- **The spec changes under pending comments**: the warning of US3, scenario 7. "Start over" deletes
  the pending review and shows the new version; adding a comment replaces the older review, as the
  core does today.
- **A follow-up whose parent changed letter**: it hides again; its answer stays in the file, unused,
  as the skill allows.
- **`.worktrees/<branch>/` exists but is not a worktree of this repository**: the write is refused:
  "cannot create the worktree: .worktrees/<branch> exists".
- **A merged feature whose branch still exists**: shown under Done, read from the default branch.
- **The repository has no `specs/` folder**: home shows "No specs/ folder in <path>. Set Uraeda up
  with ura init."
- **`URAEDA_REPO` is not a git repository**: the server stops at start with "uraeda-server: <path>
  is not a git repository".
- **The binding is not built**: `vp dev` stops with "the native binding is not built; run vp run
  ready", as the server does today.
- **`gh` is missing or logged out**: pull request states show as unknown, without an error.
- **A mockup HTML file**: opens in a new tab, served with `Content-Security-Policy: sandbox`, so its
  scripts run outside the UI's origin.
- **Raw HTML inside a markdown file**: shown as text, never rendered.
- **A link to another workflow file**: opens it in the UI; a link to code opens the file's raw text;
  a web link opens in a new tab.
- **A draft in the default branch's checkout, not committed, started**: its files move from that
  checkout into the new worktree, as `ura start` moves them today.
- **Two tabs answering the same question**: the second save is refused as changed elsewhere.
- **`PRIORITIES.md` changed elsewhere under the Priorities page**, by `ura start` or a commit: the
  change is not applied; the page reloads the list and says "PRIORITIES.md changed on disk. Your
  change was not applied.", with the text of a line being added or edited kept in its field.
- **Drafting or starting with priority changes not committed**: those commits already include
  `PRIORITIES.md`, so they take the pending changes with them, and the button says so first: "Your 2
  priority changes are committed with it."
- **A priority line added empty, or spanning several lines**: "Add" stays disabled while the text is
  empty; line breaks are turned into spaces, since a priority is one line.
- **The file watcher cannot start**, such as when inotify's watch limit is reached: the server logs
  the core's message and keeps serving; pages reload their data when they come back to the
  foreground.

## Success criteria

- **SC-001**: The server answers the home screen's request in under 500 ms on a repository with 20
  feature branches.
- **SC-002**: No action of the UI or of `ura` changes the branch of the checkout it runs from,
  except `ura start --switch`.
- **SC-003**: Every commit the UI makes, in the checkout or in a worktree, runs the repository's
  pre-commit hook.
- **SC-004**: No package of `packages/` depends on a markdown parser, and no TypeScript file imports
  one.
- **SC-005**: Under a coarse pointer, Astryx's element heights are at least 44 px in the UI's theme.
- **SC-006**: Every file of the skill's example and of this repository's `specs/` renders without an
  error, and each of its source lines belongs to at least one block or the frontmatter.
- **SC-007**: On a 402 × 874 viewport in WebKit, the home, round, review, plan, and priorities pages
  of this repository's files cut no text (no element overflows, ellipsis, or line clamp), never
  scroll sideways, keep body text at 16 px or more, and start every question, option, story, and
  scenario text within 50 px of the screen's left edge.

## Design

### Approach

The core does the work, the server serves it, and the UI draws it, as the
[stack](../decisions/stack.md) decision says. The core gains a document tree for every workflow
file, each block with its source lines, and structured items on top of it: questions, options, user
stories, tasks, comments
([Q4](clarifications-01.md#q4-where-does-the-structure-the-ui-draws-come-from)). Its actions commit
themselves and write through worktrees, never switching the checkout
([Q3](clarifications-01.md#q3-where-does-the-ui-write-when-a-features-branch-is-not-checked-out),
[git](../decisions/git.md)). The core also watches the repository, and says which features and files
changed, so the TUI can reuse it. The binding exposes the workspace, the documents, the actions, and
the watcher as async functions. The server turns them into fate sources, mutations, and live views,
through a small adapter for data that is not in a database
([Q5](clarifications-01.md#q5-does-fate-stay-the-data-layer)). The UI is Astryx's `AppShell`, with
one page per screen. `vp dev` at the root runs both in Vite's process
([Vite+](discovery-01.md#vite-and-the-dev-server)).

### Data

Nothing new is stored outside the repository's files, except worktrees, `.env`, and the theme the
human picks, kept by the browser in `localStorage` under `uraeda.theme`.

**Configuration**, from `.env` at the root of Uraeda's checkout, git-ignored, documented in a
committed `.env.example`. `vp dev` reads it with Vite's `loadEnv`, the server's own start with
Node's `process.loadEnvFile`:

- `URAEDA_ALLOWED_HOSTS`: host names accepted besides `127.0.0.1` and `localhost`, separated by
  commas, like `mac.tail1234.ts.net`. Empty by default.
- `URAEDA_PORT`: the port, `4310` by default.
- `URAEDA_REPO`: the repository to open, the checkout `vp dev` runs in by default.

**Workspace**, the core's model read by `ura status`, changes in three ways:

- Feature folders on the default branch, not on an unmerged branch, become features with
  `source: default-branch`, `branch: null`, and the step `done`, a new value of `StepName`. The JSON
  version stays 1, since only a value is added.
- A feature whose branch is checked out in any worktree, the main checkout included, is read from
  that worktree's disk, uncommitted changes included, and gets `worktree: <path>`, or `null`.
- Each priority entry gets `draft`: the linked draft's path when it links a file under
  `specs/drafts/`, or `null`.

**Priorities**, `specs/PRIORITIES.md` read for editing: its `hash`, and its four sections, each a
list of entries with `id` (`<section>-<position>`), `text` (the line's markdown after `- `), its
`spans`, `lines`, and the nested lines under it, which move with it. `changes`: the number of lines
that differ from the committed file, for the commit bar. The text before the first section and any
other section are kept as they are.

**Document**, the tree of one workflow file, sent flat so napi-rs can generate its types:

- `Document`: `blocks: Vec<Block>`, in source order; `frontmatter_lines: Option<(u32, u32)>`;
  `hash`, the SHA-256 of the text, for saves.
- `Block`: `id` (its index), `parent` (`None` at the top), `kind`, `start_line` and `end_line`
  (1-based, inclusive), `heading` (the text of the nearest heading above it, for review anchors),
  and the fields of its kind:
  - `heading`: `level`, `anchor` (GitHub's slug), `spans`
  - `paragraph`: `spans`
  - `list`: `ordered`, `start`
  - `item`: `marker`, one of `plain`, `task` with `checked`, `pro`, `con`, `question`, `important`
    (the typed bullets), `warning`, `ask`, `note` (the list callouts `- !`, `- ?`, `- &`); `spans`
    of its first line
  - `callout`: `callout_kind`, one of `note`, `tip`, `important`, `warning`, `caution`, `question`;
    `spans` of its title
  - `quote`, `table`, `row` (`header` or not), `cell` (`align`, `spans`), `code` (`language`,
    `text`), `rule`, `html` (`text`, shown as text)
- `Span`: `text`, `marks` (`strong`, `emphasis`, `code`, `strike`), and `link`: `target` as written,
  `wiki`, and `path`, the repository path it resolves to, or `None` for a web link.

**Items**, the structured view of a file by its kind, pointing into its blocks by id:

- Clarifications: `status`; `block` (the `[!IMPORTANT]` or record callout's id); `context` (block
  ids); `questions: Vec<Question>`, each with `id` (`Q2`, `Q2.B`), `parent`, `title`, `lines`,
  `context` (block ids), `options: Vec<Choice>` (`letter`, `recommended`, `summary` spans, `pros`,
  `cons`, `why`, `other` as block ids), `answer` (the text), `letters` and `comment` (the answer
  split as the UI composes it), `applies` (`yes` or `no`), and `answer_line`; `settled` (block ids);
  `notes`.
- Spec: `stories: Vec<Story>` (`id` `US1`, `title`, `priority` `P1`, `blocks`, `why`, `scenarios`:
  `number`, `block`); `criteria: Vec<Criterion>` (`id` `SC-001`, `block`); the other sections as
  blocks.
- Plan: `tasks: Vec<Task>` (`number`, `title`, `heading` block, `steps`: `block`, `checked`, `done`,
  `total`).
- Review file: `verdict`, `commit`, `summary`, `comments: Vec<Comment>` (`number`, `anchor` as
  `start_line`, `end_line`, `heading`, or `general`, `quote`, `text`).
- Rulings: `rulings` (`id` `R1`, `title`, `blocks`).
- Priorities: the sections above.
- Every other file: blocks only.

**Answers**: the UI sends the selected letters in alphabetical order and the comment; the core
writes `A`, `B and C`, or `A, B and C`, then `: <comment>` when there is one, or the comment alone.
It reads an answer back into letters and comment when the answer starts with option letters joined
by `, ` and `and`, followed by `:` or the end of the line.

**Changes**, what the watcher reports after each burst of events: `features` (the ids whose files or
step changed), `files` (`<folder>/<name>` whose hash changed), `priorities` (whether `PRIORITIES.md`
changed), and `workspace` (whether a feature, branch, or worktree appeared or went).

**fate entities**, the server's types, each with a stable `id`:

- `Feature` (`id`: folder), with its `WorkflowFile` list, step, problems, worktree
- `WorkflowFile` (`id`: `<folder>/<name>`), with `document` and `items` as opaque values
- `Question` (`id`: `<folder>/<round file>#<Q id>`), for optimistic answers
- `ReviewComment` (`id`: `<folder>/<review file>#C<n>`)
- `Priorities` (`id`: `priorities`), with its `PriorityEntry` list (`id`: `<section>-<position>`),
  and `Draft` (`id`: its path)
- Roots: `workspace` (features grouped for home), `feature(id)`, `file(id)`, `draft(path)`,
  `priorities`

**Mutations**: `answer.save` (`file`, `question`, `letters`, `comment`, `previous`), `notes.save`,
`answers.submit`, `review.comment` (`file`, `lines` or `general`, `text`), `review.edit`,
`review.remove`, `review.approve` (`summary`, `tier`, `planReview`), `review.requestChanges`
(`summary`), `review.startOver`, `draft.create` (`line`), `text.save` (`path`, `text`, `hash`),
`text.commit` (`path`), `feature.start` (`draft`, `slug`), `priorities.add` (`section`, `text`),
`priorities.move` (`entry`, `section`, `index`), `priorities.edit` (`entry`, `text`),
`priorities.remove` (`entry`), `priorities.commit`, `priorities.discard`; each priorities mutation
but the last two carries the `hash` it was read at. Each returns the changed entities, or an error
with the core's message.

### Components

- **Document tree** (`crates/core/src/files/document.rs`, new): turns a file's text into a
  `Document`, on pulldown-cmark's offset iterator, recognising the skill's callouts, `[!QUESTION]`
  included, the typed bullets, and the list callouts. Pure, used by every parser below.
- **Workflow file parsers** ([`crates/core/src/files/`](/crates/core/src/files/)): clarifications
  gain option texts, recommendations, pros, cons, context, and answer splitting; new `spec.rs` and
  `rulings.rs`; `plan.rs` gains steps with their lines; `review.rs` gains editing and removing a
  comment. Each returns its items over the document's blocks.
- **Worktrees** ([`crates/core/src/actions/place.rs`](/crates/core/src/actions/place.rs) and
  [`git.rs`](/crates/core/src/git.rs)): `reach` returns the checkout or worktree on the branch, or
  creates `.worktrees/<branch>/` with `git worktree add`, adding `.worktrees/` to
  `.git/info/exclude` once; it never switches. `Git::commit` resolves a relative `core.hooksPath`
  against the main checkout in a linked worktree.
- **Actions** ([`crates/core/src/actions/`](/crates/core/src/actions/)): answer, notes, submit,
  comment, edit, remove, approve, request changes, draft, save text, commit text, start. Each checks
  everything before writing, writes, and commits when it is a commit step, returning the paths and
  the commit, so `ura` and the binding share them. `start` creates the worktree, or switches with
  `--switch`.
- **Priorities** (`crates/core/src/files/priorities.rs`, new, and an action): reads the sections,
  and adds, moves, edits, and removes an entry by rewriting its lines only, so the rest of the file
  stays byte for byte; commits `PRIORITIES.md` alone as `chore: update the priorities`; discards by
  restoring the committed file.
- **Watcher** (`crates/core/src/watch.rs`, new): watches `specs/` in every worktree and git's
  `HEAD`, `packed-refs`, `refs/`, and `worktrees/`, with the `notify` crate, the watcher of
  rust-analyzer and watchexec, through `notify-debouncer-full`, which pairs editors' rename-on-save
  events. After 200 ms without events, it reads the workspace again, compares each feature's and
  file's hash with the last read, and calls back with the `Changes`. It adds the worktrees that
  appear, and stops when its handle is dropped.
- **Workspace** ([`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs)): merged features,
  features read from their worktrees, drafts linked from priorities.
- **CLI** ([`crates/cli/src/`](/crates/cli/src/)): `answer` and `review` call the committing actions
  and print where they wrote; `start` gains `--switch`; `status` shows the Done group.
- **Binding** ([`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs)): `readWorkspace`,
  `readFile`, `readDraft`, `readPriorities`, one function per action, all async, and
  `watch(repo, onChange)`, which calls `onChange` with the `Changes` through a thread-safe function
  and returns a handle with `close()`, taking the repository's path. Its types are the core's,
  behind the `napi` feature, with generated declarations. The temporary functions go.
- **fate adapter** (`packages/server/src/fate/source.ts`, new): `fileSource(view, { byIds, list })`
  builds the source definitions and registry for any type read through the binding, and maps each
  view's type name to its definition. Typed from fate's exported names.
- **Server** ([`packages/server/src/`](/packages/server/src/)): the sources, roots, and mutations
  above; `GET` and `POST /fate/live`, fed by the core's watcher: each `Changes` becomes a
  `live.update` for the entities it names; the guard reading `URAEDA_ALLOWED_HOSTS`; mockup and raw
  file routes with the sandbox header. The temporary source goes.
- **Web UI** ([`packages/web/src/`](/packages/web/src/)): the shell (Astryx `AppShell`, `SideNav`,
  and `MobileNav` below 768 px, ＋ in the top bar, the theme switch at the end of the navigation),
  and one page each for home, feature, document, round, review, editor, and priorities. The document
  page draws blocks with Astryx components: `Heading`, `Text`, `List`, `Banner` for callouts,
  `Table`, `CodeBlock`, `Collapsible` for tasks, `Outline` for headings, `BottomSheet` for comments
  and the quick add, `TextArea` grown to its text, `SegmentedControl` for the verdict, the theme,
  and a priority's section, `Switch`, and `Toast` for saves. Questions, options, and stories are
  laid out with `Stack` and `Text`, never `Card`, as the reading layout requires. Priorities move by
  dragging, with pointer events and no library, or through each line's menu. The theme is
  `@astryxdesign/theme-neutral`, light or dark as the switch says, with a rule raising element
  heights to 44 px under a coarse pointer.
- **Dev entry** ([`vite.config.ts`](/vite.config.ts)): Vite's root set to `packages/web`, with its
  plugins, the server's Hono app mounted in Vite's middleware, `server.host` `127.0.0.1`,
  `server.allowedHosts` from `URAEDA_ALLOWED_HOSTS`, and the port from `URAEDA_PORT`.
- **Skill** ([`skills/uraeda/`](/skills/uraeda/)): worktrees in `SKILL.md`'s branches, start, and
  next-step sections, `.worktrees/` in the setup, and the commands' new behaviour, as the
  [CLI](../decisions/cli.md) decision requires.

### Reading layout

What the phone shows is text to read, so the hierarchy comes from type, not from boxes:

- One inset: text sits 16 px from the screen's edges. Nothing is boxed inside a box; `Card` is not
  used for questions, options, stories, or tasks.
- Nothing is cut: every text shows in full, with no "more", no ellipsis, no line clamp, and no
  option folded to its first line. A long page scrolls; the progress bar and the outline find the
  way in it.
- Body text is 17 px on a phone, as iOS's own body text, secondary text 15 px, and nothing under 13
  px.
- Levels come from type: a small uppercase label for an id (`Q2`, `US2 · P1`), a 20 px bold title,
  then body text. Sibling items, like questions or stories, are split by an 8 px band running to the
  screen's edges; items inside them, like options or tasks, by hairlines.
- State is a tint running to the screen's edges with a 4 px accent bar on the left: a selected
  option, a selected block. Comments and follow-ups hang off a 3 px line, indented by its width
  only.
- An option's letter sits beside its first line, and its text wraps under it, so no column is lost
  to a hanging indent; "Recommended" is a label above it.

### Mockups

- [Web UI](mockups/web-ui.html), at an iPhone 17's 402 px: home with every group, home with nothing
  waiting, no `specs/` folder, the menu with the theme switch, home in dark, a feature page with a
  problem, a round being answered in full (selected option, comment, saved answer), a follow-up
  inside its parent, the end of a round with blanks left, a submitted round, a spec being reviewed
  (a story, a selected block, a pending comment, the comment sheet), the verdict, the warning of a
  new version, a plan, the proposal editor, a change made elsewhere, jotting an idea down, the
  priorities with changes to commit, a draft ready to start, a hook's refusal, and the desktop
  layout.

### Error handling

- **An action refused by the core**: nothing is written; the page shows the core's message next to
  the control, like "Q2: an answer line cannot start with #".
- **A commit refused by a hook**: see the edge case. The core keeps the hook's whole output, not its
  first line, so the page can show it.
- **The server unreachable**: "Could not reach the Uraeda server.", with "Try again".
- **A file that does not parse**: it renders as blocks only, with the problem shown above it.
- **A failed save**: the field keeps its text and shows "Not saved: <message>", retried on the next
  change.

### Testing

Rust integration tests run the core and `ura` in temporary git repositories, with the shared
`TestRepo` helper: worktrees, remotes, and a pre-commit hook that records its runs, with
`core.hooksPath` relative. TypeScript integration tests start the Hono app in process on a temporary
repository built from `fixtures/` by a helper that runs `git`, and drive it through fate's client:
the web tests render the app on happy-dom, wired to that in-process server, and act like a user with
Testing Library. The document tree gets table-driven tests. SC-007 runs in Vitest's browser mode on
Playwright's WebKit, against the same in-process server, since happy-dom does no layout.

| What                                             | Test                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| US1 to US4 and US7, every scenario               | Web integration test per scenario, on the in-process server                |
| US1.3 in `ura status`                            | CLI integration test                                                       |
| US5, every scenario                              | Core integration tests on `place::reach` and the actions, and one CLI test |
| US6.1 to US6.4                                   | Server tests of the guard and options; a test of the dev entry's config    |
| US6.5                                            | Server test: commit in the repository, receive the live event              |
| US6.6                                            | Web test firing `visibilitychange`                                         |
| US6.7                                            | Web test on the theme switch and `localStorage`                            |
| Watcher                                          | Core tests: commit, edit, add a worktree, and assert each `Changes`        |
| Priorities, edits keep the rest byte for byte    | Table-driven tests in the core, on this repository's `PRIORITIES.md`       |
| Edge cases                                       | One server or web test each                                                |
| Answer composing and splitting, blocks, callouts | Table-driven tests in the core                                             |
| SC-001                                           | Server test on 20 branches, timing the home request                        |
| SC-002                                           | Every action test asserts the checkout's branch after                      |
| SC-003                                           | The recording hook, asserted after every committing test                   |
| SC-004                                           | Test reading every `packages/*/package.json` and grepping imports          |
| SC-005                                           | Test of the theme's coarse-pointer rule values                             |
| SC-006                                           | Core test parsing every file of the example and of `specs/`                |
| SC-007                                           | Browser test at 402 × 874 measuring overflow, font sizes, and text insets  |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The actions' commits move into the core, shared by `ura` and the server, with the same messages;
  the binding runs them as async tasks.
- An answer is written as the letters picked, in order, then ": " and the comment; a comment alone
  is the human's own words.
- Answers are saved as typed, uncommitted, and Submit commits the round, refused while an applicable
  question is blank.
- The notes on the settled points get their own text area.
- Review comments anchor to blocks, extended by tapping another, written to the review file as
  added, editable and removable before the verdict.
- A review shows the version committed at the branch's tip, and says so when the disk differs.
- Approving a spec offers its risk tier and plan review.
- Plan tasks show read-only.
- A plan's review screen shows only when the plan waits on the human.
- A save never overwrites a change made elsewhere.
- Changes on disk show live, and the page reloads its data when it comes back to the foreground.
- The UI is built for the phone first: 44 px targets on touch screens, `svh`, safe areas, actions at
  the end of the page.
- `vp dev` at the root runs the UI and the server in one process.
- The core recognises the skill's markdown; no raw HTML is rendered.
- Committing triggers nothing.
- The temporary status page, source, and binding functions are replaced.

Settled while writing this spec:

- Worktrees live at `.worktrees/<branch>/` in the main checkout, like superpowers' worktree
  convention, kept out of `git status` through `.git/info/exclude`, and never removed automatically:
  you mentioned a coming "finish feature" workflow, which will own that
  ([Q6](clarifications-01.md#q6-do-finished-features-show)).
- `ura start` keeps the old behaviour behind `--switch`, since you asked for worktrees "by default".
- The configuration names are `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT`, and `URAEDA_REPO`, in a
  git-ignored `.env`, the form Vite and Node both read natively
  ([Q2](clarifications-01.md#q2-how-does-your-iphone-reach-the-server)).
- `vp dev` uses port 4310, the server's existing default, so the URL is the same in both modes.
- Home shows Now and Next only, as your answer named; Later and Blocked stay in `PRIORITIES.md`.
- A draft is committed as `chore: draft <title>`; a proposal as `chore(<slug>): proposal`, the
  skill's message, or `chore(<slug>): edit the proposal` once committed.
- Every option shows in full, selected or not; the recommended one is marked, not expanded, as your
  review asked.
- Merged features are read from the default branch as they are, so a later "finish feature" step
  that keeps fewer files changes what Done shows, not this design.
- Links to code open the file's raw text in the UI, and mockups open sandboxed in a new tab.
- The theme follows the system's mode until the human picks Light or Dark; the choice is per
  browser, since it is a setting of the device, not of the repository.
- A jotted line goes to the end of Next by default, the section home shows, so it is seen again.
- Priority changes are committed alone as `chore: update the priorities`, on the default branch.
- The watcher lives in the core, as you asked, with the `notify` crate: Rust's standard library has
  no file watcher. Node's `fs.watch` is no longer used.
- The layout targets the iPhone 17's 402 px; the browser test checks it in WebKit, Safari's engine.

## Decisions

Changed, applied when this spec is approved:

- [Stack](../decisions/stack.md): the server accepts the hosts listed in `URAEDA_ALLOWED_HOSTS`,
  fate's fallback rule goes, and the UI draws the core's document tree without parsing markdown. See
  [its proposed change](../decisions/stack.md#proposed-change-2026-10-11-web-ui).
- [Git](../decisions/git.md): tools never switch the checkout; they write in a worktree at
  `.worktrees/<branch>/`, `ura start` creates one by default, and hooks resolve against the main
  checkout. See [its proposed change](../decisions/git.md#proposed-change-2026-10-11-web-ui).

Relied on:

- [CLI](../decisions/cli.md): `answer`, `review`, and `start` change with the skill, `--switch` is a
  flag, and `ura status --json` stays at version 1.
- [Toolchain](../decisions/toolchain.md): the new tests join `vp run ready`, and the binding's
  generated declarations are committed.

## Constitution check

| Principle                   | Complies | Notes                                                                       |
| --------------------------- | -------- | --------------------------------------------------------------------------- |
| I. Humans stay in control   | yes      | Every write is a human's action in the UI; both decision changes await you  |
| II. Git and plain text      | yes      | All state stays in the files and git; `.env` holds machine settings only    |
| III. Asynchronous           | yes      | Saved answers stay in the files, committed on Submit, resumable anywhere    |
| IV. Review effort           | yes      | Full questions and block comments put the human's time into the content     |
| V. Tools are optional       | yes      | Every action stays doable by hand; the skill states the worktree convention |
| VI. Code checked against it | yes      | Every scenario has its test; the adapter and document tree are justified    |

## Risk tier

**High**: it changes the server's access rules, makes tools create worktrees and commit in them, and
changes how `ura answer`, `ura review`, and `ura start` write in every user's repository.
