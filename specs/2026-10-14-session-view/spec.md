---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Dedicated session view

> [!NOTE]
>
> Approved on 2026-10-14.
>
> - **One changed decision, [UI layout](../decisions/ui-layout.md).** A session, a feature's or a
>   chat, becomes a page of its own at both widths, never a pane. The sidebar's rows are kept short:
>   features by their slug, with progress and status as icons and counts.
> - **The changed files are in, with one limit.** You asked for them "if it's not too hard". The
>   core already runs git, so a list of the files changed on the branch, with their line counts, is
>   one more call. Opening a file from the list is left out: the server only serves code files from
>   the main checkout, not from a branch.
> - **How I read your sidebar answer.** Your words were "icons, as short as possible" and "use the
>   slug". I read them as a nested row with a progress ring and "7/11 · Session column", and a
>   feature's row labelled with its slug. Screen readers and search still get the full title.
> - **The watcher publishes a feature on every commit to its branch**, so the changed files and the
>   progress update as the agent commits. Before, only changes to `specs/` did.
> - **Risk tier `medium`**: one new core function and two additive fields, with no stored data
>   changed. The plan does not wait for your review.

Following an agent is one of the main things the web UI is for. Today a feature's session is a pane
40% wide beside the feature page on a desktop. This feature makes it a page of its own at every
width, with a column beside the transcript showing the plan's tasks, the running sub-agents, and the
files changed on the branch. The sidebar gains each feature's current task, "7/11", from the plan's
checkboxes, whoever runs the agent. See the [proposal](proposal.md), [discovery](discovery-01.md),
and [clarifications](clarifications-01.md).

## User stories

### US1: Follow a feature's session on its own page (P1)

From the feature page's "Open the session", or any button that hands the feature over, the human
lands on the session's page. On a desktop, the transcript takes the reading column, and a column
beside it shows the feature's step, the plan's tasks with the current one marked, the running
sub-agents, the files changed on the branch, and links to the feature page and its files. The column
stays in view while the transcript scrolls. "Hide progress" folds it away for every session, until
"Show progress" brings it back.

Why this priority: it is the proposal's first request, and the sidebar's progress row leads here.

Acceptance scenarios:

1. **Given** the feature `2026-10-14-session-view` with a session, at 1440 × 900, **When** the human
   opens `/r/uraeda/f/2026-10-14-session-view/session`, **Then** the page shows the crumbs
   "Dedicated session view › Session", a level-1 heading "Dedicated session view", the transcript,
   the composer, and a "Progress" column beside them. The feature page's "Files" list is not shown.
2. **Given** the same feature at its implementation, with a plan of 11 tasks whose first 6 are
   checked, **When** its session's page opens at 1440 × 900, **Then** the column shows
   "Implementation", "Task 7 of 11", a progress bar at 7 of 11, and the 11 task titles, the first 6
   checked and "Session column" marked as current.
3. **Given** that page, **When** the agent checks Task 7's boxes in the worktree's `plan.md`,
   **Then** within 2 seconds the column shows "Task 8 of 11", without a reload.
4. **Given** a branch whose commits change `crates/core/src/git.rs` (+38 −0) and
   `packages/web/src/App.tsx` (+4 −19), and files in `specs/2026-10-14-session-view/`, **When** the
   session's page opens, **Then** "Changed on the branch" shows "2 files · +42 −19", then the two
   paths, sorted, each with its counts. The feature's own folder is not listed.
5. **Given** that page, **When** the agent commits a change to a third file, **Then** within 2
   seconds the list shows "3 files" and the new path.
6. **Given** a running sub-agent "Explore the layout tests", **When** the session's page shows,
   **Then** the column lists it under "Sub-agents".
7. **Given** the column shown, **When** the human presses "Hide progress", **Then** the column goes,
   the transcript takes its width, and the button reads "Show progress". Opening another feature's
   session, or reloading, keeps it hidden.
8. **Given** the feature page at 1440 × 900, **When** the human presses "Open the session", **Then**
   the session's page opens in place of the feature page, and Back returns to the feature page at
   its scroll position.
9. **Given** a review page with "Ask the agent" pressed on lines 12–14 of `spec.md`, **When** the
   session's page opens, **Then** the composer holds the quote, as today, and Back returns to the
   review page.
10. **Given** the old run address `/r/uraeda/f/2026-10-14-session-view/runs/7`, **When** it opens,
    **Then** the session's page opens scrolled to that turn.

### US2: See each feature's current task in the sidebar (P1)

In the sidebar, features show by their slug, shorter than their title. A feature in its
implementation gets a nested row under its own, with a ring filled to its progress and "7/11 ·
Session column", whoever runs its agent. The row opens the session's page.

Why this priority: it is the proposal's second request, and it works for agents started anywhere.

Acceptance scenarios:

1. **Given** the feature `2026-10-14-session-view`, titled "Dedicated session view", **When** the
   sidebar shows, **Then** its row reads "session-view", and a screen reader reads "session-view,
   Dedicated session view, Working".
2. **Given** that feature at its implementation, with Task 7 of 11, "Session column", the first with
   an unchecked step, **When** the sidebar shows, **Then** a nested row under the feature's row
   shows a ring filled to 7/11 and "7/11 · Session column", and a screen reader reads "Task 7 of 11:
   Session column".
3. **Given** that nested row, **When** the human clicks it, **Then** the session's page opens, and
   the nested row is the sidebar's selected row.
4. **Given** the feature `2026-10-14-code-quality-in-the-skill`, whose agent runs in a terminal with
   no session in the UI, at Task 1 of 11, **When** the agent checks Task 1's boxes in its worktree,
   **Then** within 2 seconds its nested row reads "2/11 · <Task 2's title>", and its status dot
   stays "Idle".
5. **Given** a feature whose step is the spec, **When** the sidebar shows, **Then** it has no nested
   progress row.
6. **Given** a running sub-agent of a feature at its implementation, **When** the sidebar shows,
   **Then** the progress row comes first under the feature, then the sub-agent's row.
7. **Given** the search field, **When** the human types "Dedicated", **Then** the feature
   `session-view` is listed, as its title matches.

### US3: Follow the session on the phone (P2)

On the phone, the session is a page, as today. Under its header, one line shows the step and the
progress. Tapping it opens the column's content in place, above the transcript.

Why this priority: the human follows agents from the phone too, but the page already exists there.

Acceptance scenarios:

1. **Given** the feature at Task 7 of 11, at 402 × 874, **When** its session's page opens, **Then**
   under the header a button reads "Implementation · 7/11 · Session column", collapsed, and the
   transcript follows it.
2. **Given** that button, **When** the human taps it, **Then** the column's content shows in place,
   above the transcript, the button marked as expanded. Tapping it again hides the content.
3. **Given** the content open, **When** the human opens a file link and comes back with Back,
   **Then** the content is still open, at the same scroll position.

### US4: Keep up with a working agent (P2)

While the agent works, the page follows the end as long as the human is there. Scrolled up, a "Jump
to the latest" button brings them back and follows again. Screen readers hear when a turn starts or
ends and when the task changes, not every word streamed.

Why this priority: a way back to the end is what users of other agent tools ask for most often.

Acceptance scenarios:

1. **Given** a working session scrolled to its end, **When** the agent writes, **Then** the page
   stays at the end.
2. **Given** a working session, **When** the human scrolls up 400 px, **Then** the page stops
   following, and "Jump to the latest" shows above the composer.
3. **Given** that button, **When** the human presses it, **Then** the page scrolls to the end, the
   button goes, and the page follows the end again.
4. **Given** a session scrolled to its end, **When** the human looks at the composer, **Then** no
   "Jump to the latest" shows.
5. **Given** a screen reader on the session's page, **When** a workflow turn starts and ends, then a
   second one starts and fails with "No output for 30 minutes.", **Then** the status region
   announces "The agent started: Implementation", "The agent finished", "The agent started:
   Implementation", and "The agent failed: No output for 30 minutes.". The streamed text itself is
   not announced.
6. **Given** a screen reader on the session's page, **When** the plan moves from Task 7 to Task 8,
   "Jump to the latest", **Then** the status region announces "Task 8 of 11: Jump to the latest".

### US5: Chat on the same page (P3)

A chat without a feature uses the same page, without the column, which has nothing to show.

Why this priority: chats are already pages, and they only change with the shared layout.

Acceptance scenarios:

1. **Given** a chat, at 1440 × 900, **When** it opens, **Then** it shows its title, its status, the
   transcript, and the composer, with no "Progress" column and no "Hide progress" button.

## Edge cases

- **No plan yet**: the column shows the step, such as "Spec", then "No plan yet." in place of the
  tasks. The sidebar has no progress row.
- **A plan waiting for its review, or for a revision**: the column lists its tasks without a current
  one and without a bar. The sidebar has no progress row.
- **Every box checked**: the step is the final review. The column shows "11 of 11 tasks done" with a
  full bar, and the sidebar has no progress row.
- **A plan revised mid-implementation**: the counts follow the plan as it is. "7/11" can become
  "5/12" when tasks are added and earlier steps unchecked.
- **`## Task N` numbers that skip or repeat**: the count uses each task's position in the plan, not
  its number. The title is shown as written.
- **A plan with no task heading**: treated as no plan. The step's rules are unchanged.
- **A task title longer than the sidebar**: cut with an ellipsis. Screen readers get it whole.
- **A slug longer than the sidebar**: cut with an ellipsis, like titles today.
- **No commit on the branch outside the feature's folder**: "Changed on the branch" shows "Nothing
  outside the feature's folder yet."
- **More than 50 changed files**: the first 50 by path, then "and N more files". The total line
  counts them all.
- **A binary file**: listed without counts, shown as "binary".
- **A renamed file**: listed under its new path, with its counts.
- **A feature without a branch** (its proposal not committed) or **merged**: no "Changed on the
  branch" section.
- **A feature read from its branch's tip, without a worktree**: its progress follows the branch's
  commits only.
- **Uncommitted code in the worktree**: not in the changed files until committed. Uncommitted
  checkboxes in `plan.md` do count, as the core reads the worktree's `specs/` from disk.
- **The default branch unknown**: no "Changed on the branch" section.
- **git missing, or the diff failing**: "Changed on the branch" shows "The changes could not be
  read.", and the rest of the page works.
- **A session with no turn yet, or no session**: the column shows as for any session. The transcript
  is empty, as today, and the feature's status is unchanged.
- **An agent started elsewhere**: progress and changes show, and the status dot keeps today's rules
  ([Q3](clarifications-01.md#q3-should-the-ui-show-that-an-agent-it-did-not-start-is-working)).
- **The sidebar folded**: progress rows hide, like sub-agent rows. Status dots stay.
- **From 768 to 1024 px with the sidebar open**: about 528 px to share. The human can fold the
  column or the sidebar, and each choice is kept.
- **Width changing across 768 px with the column open**: the page keeps its scroll position. The
  column becomes the phone's collapsed line, and comes back on wide screens.
- **A turn failing while the human is scrolled up**: the error shows in the transcript at its end,
  as today, and the status region announces it.

## Success criteria

- **SC-001**: At 1440 × 900 with the sidebar at 240 px, the transcript's column is at least 760 px
  wide with the progress column shown, against about 480 px in today's pane.
- **SC-002**: A box checked in a worktree's `plan.md` shows in the sidebar and in the column within
  2 seconds.
- **SC-003**: From any page of the UI, following a working feature's agent takes one click in the
  sidebar.
- **SC-004**: The UI decisions' checks pass on the session's page, at both sizes and in both themes:
  a feature's at its implementation, with the column shown and hidden, and a chat.
- **SC-005**: Reading the changed files of a branch of 60 changed files takes under 100 ms on the
  development machine.

## Design

### Approach

The session's route draws the session's page alone, at every width, as chats already are. The
[UI layout](../decisions/ui-layout.md) decision changes to say so
([Q1](clarifications-01.md#q1-where-does-a-features-session-open-on-a-desktop)). The page is
Astryx's `Layout`, with the transcript as its content and a `LayoutPanel` in its `end` slot for the
column ([Astryx](discovery-01.md#astryx-068)).

Everything the column and the sidebar show comes from the repository, read by the core:

- **Progress.** The plan's tasks come from the same parse the plan's review uses. The core adds the
  current task's position and the number of tasks to the feature's step, so the sidebar needs no
  file view ([task N of M](discovery-01.md#task-n-of-m)).
- **Changed files.** A new core function runs `git diff --numstat` from the default branch's merge
  base to the branch's tip, as the core already runs `git log` for `unmerged_commits`. This answers
  [Q1.A](clarifications-01.md#q1a-what-sits-beside-the-transcript).
- **Updates.** The core's watcher already re-reads `specs/` in every worktree from disk. It now also
  publishes a feature when its branch's tip moves, so a code commit refreshes the changed files.

Nothing reads an agent's own files, so an agent started from a terminal gets the same progress as
one started from the UI
([Q3](clarifications-01.md#q3-should-the-ui-show-that-an-agent-it-did-not-start-is-working)).

### Data

**Core, through the binding.** Rust types, with the TypeScript generated by napi-rs:

```rust
/// The plan's progress during the implementation: the first task with an unchecked step.
pub struct TaskProgress {
    /// Its position among the plan's tasks, from 1, whatever its `## Task N` number.
    pub position: u32,
    /// The number of tasks in the plan.
    pub total: u32,
    /// Its title, as written after `## Task N:`.
    pub title: String,
}

pub struct StepView {
    pub name: String,
    pub waits_on: String,
    pub file: Option<String>,
    /// Unchanged: "Task N: title", as Home and `ura status` show it.
    pub task: Option<String>,
    /// New: set only when `name` is `implementation`.
    pub progress: Option<TaskProgress>,
}

/// A file changed on a feature's branch, from the default branch's merge base to its tip.
pub struct ChangedFile {
    /// From the repository's top level; the new path of a renamed file.
    pub path: String,
    /// Lines added and removed; `None` for a binary file.
    pub added: Option<u32>,
    pub removed: Option<u32>,
}

pub struct BranchChanges {
    /// The first 50 files, sorted by path, outside `specs/<folder>/`.
    pub files: Vec<ChangedFile>,
    /// Every changed file outside the feature's folder, listed or not.
    pub count: u32,
    pub added: u32,
    pub removed: u32,
}

/// `None` when the feature has no branch, is merged, or the default branch is unknown.
pub fn branch_changes(repo: &Path, folder: &str) -> Result<Option<BranchChanges>>;
```

The rules:

- **One parser.** `steps.rs` computes the step from the plan's `TaskItem`s, the parse the review
  page uses. `plan::tasks` and its line-based count go away, so a later non-task level-2 heading no
  longer adds boxes to the last task.
- **Where `progress` comes from.** It is the position and title of the first task whose `done` is
  below its `total`, and the number of tasks. `task` keeps its text, and is built from the same
  task.
- **What `branch_changes` reads.** It reads `git diff --numstat -z -M <merge-base>..<tip>` in the
  main checkout, the tip being the feature's branch. Paths under `specs/<folder>/` are left out of
  the files and the totals, and binary files count as one file with no lines.
- **Watcher.** Each feature's hash includes its branch's tip, so a commit on the branch publishes
  the feature, even when no file of its folder changed.

**Server, through fate.** A new `BranchChanges` view, keyed by the feature's folder, served by a
source that calls `binding.branchChanges`. The server republishes it with the feature, when the
watcher reports the feature changed. `FeatureView.step` gains `progress`, sent in the workspace's
features, so the sidebar reads it from the live workspace it reads already.

**Browser.** The column's folded state is kept in `localStorage` under `uraeda.sessionAside`,
`"shown"` or `"hidden"`, for every session, like the sidebar's `uraeda.nav`. On the phone, whether
the progress line is open is kept in the history entry, like the transcript's open tool groups, so
Back keeps it.

### Components

- **Core: plan progress** ([`steps.rs`](/crates/core/src/steps.rs),
  [`files/items.rs`](/crates/core/src/files/items.rs),
  [`files/plan.rs`](/crates/core/src/files/plan.rs), [`view.rs`](/crates/core/src/view.rs)):
  computes `progress` from the plan's tasks. It depends on the parsed plan only.
- **Core: branch changes** ([`git.rs`](/crates/core/src/git.rs),
  [`api.rs`](/crates/core/src/api.rs), binding): `branch_changes`, on top of a
  `Git::numstat(base, tip)` helper that runs git like `unmerged_commits` does. It depends on the
  workspace for the feature's branch and the default branch.
- **Core: watcher** ([`watch.rs`](/crates/core/src/watch.rs)): adds the branch's tip to a feature's
  hash.
- **Server: changes source** (`packages/server/src/fate/`): the `BranchChanges` view and its live
  updates, published with the feature's.
- **Session page** ([`SessionPage.tsx`](/packages/web/src/SessionPage.tsx)): the page at every
  width. It shows crumbs and a level-1 heading, a "Hide progress" or "Show progress" button for a
  feature on wide screens, and the phone's progress line. `SessionRoute` in
  [`App.tsx`](/packages/web/src/App.tsx) draws it alone. `Panes` stays for the task view.
- **Session column** (`packages/web/src/SessionAside.tsx`, new): the step, the progress bar and the
  tasks, the sub-agents, the changed files, and the feature's links. It is used beside the
  transcript on wide screens, and inside the phone's progress line. It reads the feature, its
  `plan.md` items, the session's sub-agents, and `BranchChanges`.
- **Progress ring** (`packages/web/src/ProgressRing.tsx`, new): an SVG ring filled to
  `position / total`, in the theme's accent colour, `aria-hidden`. The sidebar and the phone's line
  use it.
- **Sidebar** ([`SessionNav.tsx`](/packages/web/src/SessionNav.tsx)): features by their slug, with
  the title in their accessible name. The progress row comes before sub-agent rows. On the session's
  page, the progress row is selected instead of the feature's row. Search also matches slugs.
- **Following** (`packages/web/src/useJumpToLatest.ts`, new, and
  [`Transcript.tsx`](/packages/web/src/Transcript.tsx)): the "Jump to the latest" button, shown
  while the page does not follow the end, reusing `useFollowEnd`'s measure. `Transcript.tsx` is over
  the coming 500-line limit, so the new parts go in new files.
- **Announcements** (`packages/web/src/SessionAnnouncer.tsx`, new): a visually hidden
  `role="status"` that announces a turn's start, end, and failure, and a change of task. The
  transcript's log stops announcing what streams.

### Mockups

- [Session view](mockups/session-view.html):
  1. a feature's session at 1440 px, working at Task 7 of 11, with the column, and the sidebar with
     slugs, progress rows, and a sub-agent;
  2. the column folded at 1024 px, scrolled up, with "Jump to the latest";
  3. the phone, with the progress line closed and open;
  4. the sidebar open and folded, with what screen readers read;
  5. the column before a plan, with every box checked, with more than 50 files, and with no session;
  6. a chat at 1440 px, without the column.

### Error handling

- **The changed files cannot be read**, because git is missing or the diff fails: the section shows
  "The changes could not be read.", and the rest of the column works. The error is logged by the
  server with git's first line.
- **The plan cannot be parsed**: the core's parser never fails, so a plan without task headings
  reads as no tasks, and the step's rules decide as today.
- **The live connection drops**: as today, the page keeps what it shows, and re-reads on
  reconnection and on `visibilitychange`.
- **`localStorage` refused**, as in some private modes: the column shows, and the button still folds
  it for the page's lifetime.

### Testing

Integration tests render the app with the fake agent adapter and the fixture repositories in
[`fixtures/`](/fixtures/), as the session tests do today. Happy-dom tests drive it through roles,
labels, and text. WebKit browser tests check layout, following, and axe-core at 402 × 874 and 1440 ×
900, in light and dark. Core tests run on temporary git repositories built by the existing helpers.

| What                                                                                                                                             | Test                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| US1.1, US1.8, US1.9, US1.10, US5.1                                                                                                               | `__tests__/session.test.tsx`: the page at both widths, Back, Ask the agent, old runs, chats                                    |
| US1.2, US1.6, edge cases: no plan, plan in review, every box checked, no session                                                                 | `__tests__/session-aside.test.tsx`: the column's sections in each state                                                        |
| US1.3, US2.4, SC-002                                                                                                                             | `__tests__/session-aside.test.tsx` and `__tests__/shell.test.tsx`: a fixture's `plan.md` changed on disk, then the live update |
| US1.4, US1.5, edge cases: 50 files, binary, rename, feature folder, no branch, merged, default branch unknown, uncommitted code, nothing changed | core `tests/branch_changes.rs`, table-driven on a temporary repository; server source test for the live update                 |
| Edge case: git failing                                                                                                                           | `__tests__/session-aside.test.tsx` with the source refusing                                                                    |
| US1.7, edge case: `localStorage` refused                                                                                                         | `__tests__/session.test.tsx`                                                                                                   |
| US2.1–US2.3, US2.5–US2.7, edge cases: long titles, folded sidebar                                                                                | `__tests__/shell.test.tsx`                                                                                                     |
| Edge cases: revised plan, skipped numbers, no task heading, later headings                                                                       | core `tests/files.rs`, table-driven on plan texts: `progress` and `task`                                                       |
| Watcher: a commit on the branch                                                                                                                  | core `tests/watch.rs`                                                                                                          |
| US3.1–US3.3, edge case: width changing                                                                                                           | `__browser__/session.test.tsx` at 402 × 874                                                                                    |
| US4.1–US4.4                                                                                                                                      | `__browser__/session.test.tsx`: following and the button                                                                       |
| US4.5, US4.6, edge case: a failure while scrolled up                                                                                             | `__tests__/session.test.tsx`: the status region's text                                                                         |
| SC-001, SC-004, edge case: 768–1024 px                                                                                                           | `__browser__/layout.test.tsx`: the session's page, column shown and hidden, and a chat                                         |
| SC-003                                                                                                                                           | `__tests__/shell.test.tsx`: the progress row opens the session                                                                 |
| SC-005                                                                                                                                           | core benchmark test on a generated branch of 60 files, run in `cargo test --release` by hand                                   |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- "Sidebar" in the proposal is the session's pane, and, for the task, the left navigation.
- "7/11" is the position of the first task with an unchecked step among the plan's tasks, and the
  number of tasks, computed in the core and sent with the feature's step.
- The progress shows only during the implementation, and is recomputed from the plan as it is now.
- The core uses one parser for the plan's tasks: the one the plan's review uses.
- On the phone, the session stays a page, and the column's content becomes a line under the header
  that opens in place.
- The column folds away, its state kept in the browser. Chats use the same page without the column.
- The addresses stay the same: `/f/<folder>/session`, `?continue=`, `?ask=`, and old run links. The
  session shows crumbs and a level-1 heading at every width, and the feature page keeps its Agent
  section.
- Notifications, a diff view, model-written activity summaries, and two sessions side by side are
  left for later.
- This feature builds on image attachments once it is merged, or rebases on it. New parts go in new
  files under the coming 500-line limit.

Settled while writing this spec:

- **The changed files are listed, not linked.** The server serves code files from the main checkout
  only ([`read_raw`](/crates/core/src/api.rs)), and serving a branch's files is the diff view's job.
- **The changed files are the committed ones.** The watcher sees code commits through the branch's
  tip, not edits in the worktree outside `specs/`. Agents commit each task.
- **The feature's own folder is left out of the changed files**, since the column links to its
  workflow files already.
- **At most 50 files are listed**, so a large branch keeps the column short.
- **The sidebar's progress row reads "7/11 · <title>"**, with a ring. That is my reading of "as
  short as possible" in [Q2](clarifications-01.md#q2-how-does-the-current-task-show-in-the-sidebar):
  the count and the title, without the word "Task".
- **Every feature row shows its slug**, done ones and bugs included, with the title in its
  accessible name. Search matches both.
- **On the session's page, the progress row is the selected row**, not the feature's, so one row is
  selected.
- **"Jump to the latest" shows whenever the page is not following the end**, working or not, and
  uses the same 24 px measure as `useFollowEnd`.
- **The transcript stops announcing what streams.** The status region announces turns and tasks
  instead, as the [streaming chat pattern](discovery-01.md#live-regions-and-progress-in-wai-aria)
  advises.
- **The phone's open progress line is kept in the history entry**, as open tool groups are, not in
  the URL: it is a disclosure within the page, not a detail.
- **The column is 320 px wide**, a new theme size, `--size-session-aside`.

## Decisions

Changed, applied when this spec is approved:

- [UI layout](../decisions/ui-layout.md): a session opens as a page of its own at both widths, with
  a column beside its transcript that the human can fold away. The sidebar's rows stay short:
  features by their slug, progress and status as icons and counts, with full words for screen
  readers. See its
  [proposed change](../decisions/ui-layout.md#proposed-change-2026-10-14-session-view).

Relied on:

- [Stack](../decisions/stack.md): progress and changed files are computed in the Rust core and reach
  the UI through the binding and fate. The UI never parses `plan.md`.
- [Agents](../decisions/agents.md): no agent setting changes. The agent's own checklist tools stay
  off, and to-do calls stay plain tool rows
  ([Q5](clarifications-01.md#q5-what-else-ships-with-the-sessions-page)).
- [UI components](../decisions/ui-components.md): `Layout`, `LayoutPanel`, `ProgressBar`,
  `SideNavItem`, `Button`, and `List` from Astryx. The ring is an SVG in StyleX with theme tokens,
  since Astryx has no ring.
- [UI behaviour](../decisions/ui-behaviour.md): rows are tappable as a whole, nothing works only on
  hover, the error stays on screen, and Back keeps the scroll position and open items.
- [UI checks](../decisions/ui-checks.md): layout and axe checks on the new page at both sizes and
  themes, and screenshots before the handover.

## Constitution check

| Principle                                  | Complies | Notes                                                                                                   |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | The UI layout change waits for the spec's approval. Nothing new acts on the human's behalf.             |
| II. Git and plain text first               | yes      | Progress and changes are read from `plan.md` and git. Only the column's folded state is in the browser. |
| III. Asynchronous by default               | yes      | Everything shown is recomputed from the repository. An agent started anywhere shows the same progress.  |
| IV. Review effort matches impact           | yes      | One click from the sidebar to a working agent. The plan does not wait for a review, at `medium`.        |
| V. Tools are optional                      | yes      | The plan's checkboxes stay the source. The workflow and the skill do not change.                        |
| VI. Code is checked and stays maintainable | yes      | One parser for plan tasks instead of two. New parts go in new files, and every scenario has a test.     |

## Risk tier

**Medium**: one new core function and git call, two additive fields in the binding, and a watcher
change that publishes features more often. No stored data or workflow format changes.
