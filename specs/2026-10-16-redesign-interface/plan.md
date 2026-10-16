---
status: auto-approved
spec-revision: 1
---

# Plan: Redesign sidebars and global interface

**Goal:** statuses that tell the truth, a sidebar of cards in Uraeda's hierarchy, both sidebars
folded and resized easily, Home on the phone, notifications, and clear feedback on git writes.

**Architecture:** the core owns what an item is, its step, the step's order, and its pull request's
state; it reads them from commits, with the pull requests' snapshot kept in its memory per
repository
([R1](rulings.md#r1-the-pull-requests-snapshot-is-a-cache-in-the-core-not-a-parameter-of-every-read)).
The server owns when a run is over (the runner), what needs the human (`status.ts`, read by both the
sidebar and the new global `NeedsYou` view), the snapshot's refresh, and the join of names and
colours to features ([R2](rulings.md#r2-names-and-colours-are-joined-to-features-by-the-server)).
The web UI owns the drawing: the sidebar's sections and cards in `sidebar/`, the right column in
`layout/SideColumn.tsx`, the writes in flight in `writes/`, and the notifier in `notify/`. It maps a
step to an icon and a label, and never computes a step or a status. See the
[spec's architecture](spec.md#architecture).

Statuses come first, so every later task draws true data: tasks 1 to 6 change the core and the
server, tasks 7 to 12 the web UI, each on what the earlier ones made.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A file page of a checked-out branch still shows its uncommitted text**, while the card's step
   comes from the commit. Task 1.
2. **`gh` answering with pull requests of branches that are not items**, or of another head
   repository with the same branch name: ignored, only `headRefName` matches a branch. Task 2.
3. **A background command that ends while no turn runs**, after its turn ended: the session goes
   back to its settled status, and the idle timer starts then. Task 5.
4. **A pending action whose write fails after the server's status already changed for another
   reason**: the card shows the server's status, never "Committing…" again. Task 10.
5. **Two tabs, one closed while it held the notifier's lock**: the other tab takes it and notifies.
   Task 11.
6. **The fold button keeps its place**: the same button, at the same spot, whether the sidebar is
   unfolded or folded, and the right column's show and hide buttons at the same spot. Tasks 8 and 9.
7. **A name saved with spaces around it** is trimmed, and a name of spaces only removes the name.
   Task 3.

## Global constraints

Every task's requirements include these.

From the approval comments ([spec-review.md](spec-review.md)), superseding the spec where they
change it:

- C1: "In priorities the count should be the 'Now' count".
- C2: the right column MUST resize from its edge.
- C3: "Pay special attention to the fold/unfold button not moving between the two states".
- C4 and C5: "the `...` should just always be visible", a muted icon; a card's size MUST NOT change
  under the pointer.

From the [git](../decisions/git.md) decision:

- A feature's or a change's workflow state, whether it exists and which step it is at, MUST be read
  from its branch's latest commit, whether or not the branch is checked out. A branch MUST count as
  a feature or a change only when its folder or its record is in that commit. Files that differ on
  disk MUST only mark the item as having uncommitted changes.
- In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines.

From the [agents](../decisions/agents.md) decision:

- A turn is one message until the agent settles, once its reply has ended and every background task
  of its run has ended, sub-agents, workflows, and background commands alike, except the tasks the
  agent marks as ambient; a turn reopens when the agent goes on by itself after it.
- A session's process MUST be closed after 15 minutes without a turn, and MUST NOT be closed while
  one of its background tasks still runs; it is resumed with its next message.
- The tests that `vp run ready` runs MUST use a fake adapter, and MUST NOT run a real agent.

From the [repositories](../decisions/repositories.md) decision:

- Each entry MAY hold, by the folder of a feature or a change, the name it shows in the sidebar, at
  most 40 characters, and its colour, one of `red`, `orange`, `yellow`, `green`, `teal`, `blue`,
  `purple`, and `pink`. They are the UI's: no workflow rule MAY read them.
- A write MUST replace the file whole, through a temporary file renamed over it, so a reader never
  sees half a file.
- Each repository MUST have its own fate endpoint and its own live updates: a change in one
  repository MUST NOT send an update to the views of another. The global endpoint, `/fate`, MAY
  carry views that span every repository, like what waits on the human.

From the [notifications](../decisions/notifications.md) decision: all of its rules, word for word
there, including "The browser's permission MUST be asked only from the human's click on 'Turn on'",
"Notifications MUST be shown only while no Uraeda tab is in front, one per item and reason,
replacing the previous one for that item, from a single tab among those open", and "A service worker
and Web Push MUST NOT be added".

From the [UI behaviour](../decisions/ui-behaviour.md) decision:

- A button that writes to git, by committing, starting a feature or a change, or changing a branch,
  MUST say what it does at once, like "Committing…", with a spinner beside its label, until its
  write ends. While any git write runs, every other button that writes to git, in the page and in
  the sidebar, MUST be blocked and stay focusable, and a thin bar MUST run at the top of the page.
  Reading and navigating MUST stay usable.
- A write or a run's start that concerns a feature or a change MUST show that action on its sidebar
  card at once, until the server's status for it changes or 10 seconds pass. The UI MUST NOT guess
  an item's next step or status: the core decides them.
- Nothing MUST work only on hover: every action has a tap or a keyboard path. A control shown on
  hover MUST also show while it or its row has the keyboard's focus, and always under a pointer that
  cannot hover.
- A keyboard shortcut MUST NOT act while a text field has the focus.

From the [UI layout](../decisions/ui-layout.md) decision:

- The sidebar SHOULD stay short and visual: each feature or change as one card, by the name the
  human gave it, or its slug when it has none; its step as an icon at the card's start; its status
  and a running background command as icons at its end; its progress and the lines its branch
  changed as counts. Each card's accessible name MUST carry the full words: its name, its title, its
  step, its status, and its task.
- On wide screens, the sidebar MUST fold to a rail of its rows' icons, each with its status, from a
  button at its top, and unfold from the same place.
- A column that takes room from the content MUST be foldable and resizable, with its width and the
  choice kept in the browser.
- Components MUST NOT write their own media queries with sizes.

From the [UI components](../decisions/ui-components.md) decision: views MUST use Astryx components
wherever one exists; raw `button`, `input`, `textarea`, `select`, and `dialog` elements MUST NOT be
written; styles are StyleX with Astryx's tokens.

From the [stack](../decisions/stack.md) decision: TypeScript code MUST reach the core only through
the binding, and MUST NOT reimplement its parsing, validation, or states; core types come from the
generated declarations.

From the [code quality](../decisions/code-quality.md) decision: functions at most 100 lines, files
at most 500, 7 parameters, 4 levels of nesting; a new marker needs a human's approval, so a unit
near its limit is split first. `core/src/git.rs` is at its listed cap (528), `workspace.rs` 15 lines
under its cap (967), `api.rs` 8 under (633).

Exact texts, from the spec's [components](spec.md#components): the sidebar's, the writes', the
notifier's, and the step labels, copied as written there.

Preserved behaviour:

- File pages show a checked-out branch's uncommitted text, with the commit's version beside it
  ([`api::file_view`](/crates/core/src/api.rs)); `ura check` and the LSP's `waiting` read the disk.
- The server runs one write at a time ([`api.rs`](/crates/core/src/api.rs), `WRITES`).
- A session's status rules keep their order ([`status.ts`](/packages/server/src/runner/status.ts)).
- Sidebar rows keep their status icon inside their link, which the tests read (`shell.test.tsx`,
  `agent-panel.test.tsx`).

## Code read

- [`workspace.rs`](/crates/core/src/workspace.rs): `Workspace::read` (639-715),
  `working_tree_features` (458-485) reads every dated folder on disk, `branch_feature` (509-562)
  checks the folder or record only for branches checked out nowhere, `read_feature` (730-780),
  `from_texts` (785-857) and `from_record` (862-912) compute steps with `PullRequest::Unknown`.
- [`steps.rs`](/crates/core/src/steps.rs): `StepName` (12-52), `PullRequest` (65-76), `step` (163),
  `finished_step` (178), `after_the_last_step` (278), `change_step` (307), `pull_request` (326) runs
  `gh` per branch, `pull_request_state` (351).
- [`view/feature.rs`](/crates/core/src/view/feature.rs): `StepView` (15-28), `FeatureView` (57-86)
  with `pull_request: Option<String>` from the record.
- [`git.rs`](/crates/core/src/git.rs): `Git::output` (496-527) is the only process helper.
- [`repositories.rs`](/crates/core/src/repositories.rs): `File`, `Entry` (59-71), `save` (187), no
  `deny_unknown_fields`; [`api/repository_list.rs`](/crates/core/src/api/repository_list.rs).
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): the `Job` pattern;
  `vp run binding:build` regenerates `packages/binding/index.d.ts`.
- CLI: [`status.rs`](/crates/cli/src/status.rs) (82 appends "pull request state unknown"),
  [`next.rs`](/crates/cli/src/next.rs) (23-33), tests `status.rs`, `next.rs` (fake `gh` at 146-171).
- Core tests: `crates/core/tests/{workspace.rs, steps.rs, repositories.rs}` on `TestRepo`
  (`tests/common/repo.rs`); run with
  `env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 cargo nextest run -p uraeda-core -p uraeda-cli`.
- Runner: [`claude-events.ts`](/packages/server/src/runner/claude-events.ts) (302-313 keeps only
  `local_agent`, `local_workflow`), [`events.ts`](/packages/server/src/runner/events.ts) (47),
  [`transcript.ts`](/packages/server/src/runner/transcript.ts) (`record` 44, `background` 73-91,
  `#result` 229-276), [`turns.ts`](/packages/server/src/runner/turns.ts) (`next` 182-195 arms the
  idle timer, `watch` 91-97), [`session-state.ts`](/packages/server/src/runner/session-state.ts),
  [`activity.ts`](/packages/server/src/runner/activity.ts); tests
  `runner/__tests__/{claude,sessions,status}.test.ts` and `__tests__/sessions.test.ts`, with
  `testSessions()` and fake timers.
- Server: [`status.ts`](/packages/server/src/runner/status.ts),
  [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) (`statusOf` 110-120, `rows` 228-254),
  [`fate/sources.ts`](/packages/server/src/fate/sources.ts),
  [`fate/views.ts`](/packages/server/src/fate/views.ts) (485 lines),
  [`live.ts`](/packages/server/src/live.ts) (`sessionPublisher` at the function limit),
  [`repositories.ts`](/packages/server/src/repositories.ts) (`Host`, `Hosts.#start` 425-441 starts
  the watcher), [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts); tests on
  `testServer`, `fateAt`, `mutate` (`__tests__/helpers.ts`).
- Web: [`Shell.tsx`](/packages/web/src/Shell.tsx),
  [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx),
  [`SessionNavRows.tsx`](/packages/web/src/SessionNavRows.tsx),
  [`AgentsAtWork.tsx`](/packages/web/src/AgentsAtWork.tsx), [`data.ts`](/packages/web/src/data.ts)
  (`useNavigation` 272-283; `useInbox` 123),
  [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx),
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) (`Header` 66-106),
  [`CommitActions.tsx`](/packages/web/src/CommitActions.tsx) and its users,
  [`CommitBar.tsx`](/packages/web/src/CommitBar.tsx),
  [`TaskView.tsx`](/packages/web/src/TaskView.tsx),
  [`RoundSubmit.tsx`](/packages/web/src/RoundSubmit.tsx),
  [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx) (98-line function),
  [`Composer.tsx`](/packages/web/src/Composer.tsx),
  [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx), [`theme.tsx`](/packages/web/src/theme.tsx),
  [`AddRepository.tsx`](/packages/web/src/AddRepository.tsx),
  [`RepositoryMenu.tsx`](/packages/web/src/RepositoryMenu.tsx) (`Menu` ~98 lines),
  [`Home.tsx`](/packages/web/src/Home.tsx); the mockups in `sidebar/`, `notify/`, `writes/`, and
  `layout/SideColumn.tsx`. Tests: `__tests__/helpers.tsx` (`renderPage`, `fakeAgent`,
  `refreshUntil`), `__browser__/helpers.tsx` (`show`, `atSize`, `checkLayout`,
  `checkAccessibility`); `useHotkeys` from `@astryxdesign/core/hooks` skips text fields
  (`RoundNav.tsx:244`).
- Validation: `vp check`, `vp test`, `vp run browser:desktop`, `vp run browser:phone`,
  `vp run ready`.

## Constitution check

| Principle                                  | Complies | Notes                                                                            |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | Only the approved decisions are followed; R3 follows the git decision's wording  |
| II. Git and plain text first               | yes      | State from commits; names and colours in the plain-text `repositories.json`      |
| III. Asynchronous by default               | yes      | The pull requests' snapshot is a cache in memory; losing it costs one `gh` call  |
| IV. Review effort matches impact           | yes      | Notifications only for what needs the human                                      |
| V. Tools are optional                      | yes      | No workflow file format changes                                                  |
| VI. Code is checked and stays maintainable | yes      | Every scenario has a test; files near their limit are split first; no new marker |

## Decisions

- [Git](../decisions/git.md): items and steps from commits (task 1); process calls through the git
  module (task 2).
- [Agents](../decisions/agents.md): background tasks hold the turn and the process (task 5).
- [Repositories](../decisions/repositories.md): `items` in `repositories.json`, the global view
  (tasks 3, 6).
- [Notifications](../decisions/notifications.md): task 11.
- [UI layout](../decisions/ui-layout.md): cards, the rail, the column (tasks 7 to 9).
- [UI behaviour](../decisions/ui-behaviour.md): writes, pending actions, shortcuts (tasks 8 to 10).
- [UI components](../decisions/ui-components.md), [UI checks](../decisions/ui-checks.md),
  [preview](../decisions/preview.md), [stack](../decisions/stack.md),
  [code quality](../decisions/code-quality.md): every task.

## Complexity tracking

| Abstraction or exception                           | Why it is needed                                                                | Simpler alternative rejected because                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `crates/core/src/pulls.rs`, the snapshot cache     | One `gh` call per repository serves every read, the CLI's and the server's (R1) | A parameter on every read changes 15 call sites and the binding    |
| `crates/core/src/git/process.rs`                   | `gh` and `git` share one process runner; `git.rs` is at its cap                 | Running `gh` from `steps.rs` builds a second process helper        |
| `packages/server/src/pulls.ts`, the refresher      | The 60-second timer and the branch-move trigger per repository                  | Refreshing on each read costs 0.4 s per request                    |
| `packages/server/src/fate/needs-you.ts`            | The global view the notifier reads; `views.ts` is at 485 lines                  | A view per repository: one subscription per repository in each tab |
| `packages/web/src/sidebar/` (Sidebar, cards, Done) | Replaces `SessionNav.tsx`, `SessionNavRows.tsx`, `AgentsAtWork.tsx`             | Growing `SessionNav.tsx` (355 lines) past its limit                |
| `packages/web/src/writes/` (store, `WriteButton`)  | One record of writes in flight, which every writing button and every card reads | A flag per page: the sidebar's buttons and cards could not see it  |
| `packages/web/src/notify/`                         | The banner and the notifier, with its lock and title count                      | None simpler meets the notifications decision                      |
| `packages/web/src/layout/SideColumn.tsx`           | The resizable column, out of `SessionAside.tsx` (405 lines)                     | Growing `SessionAside.tsx`                                         |
| A browser command for the colour scheme (R5)       | About 40 browser tests set dark mode through the removed key                    | Keeping an unread key's reader for tests                           |

## Review comments

- **C1** ("the count should be the 'Now' count"): task 7, the Priorities count is the entries under
  Now, as the spec says.
- **C2** (the right column must be resizable): task 9, with a browser test dragging its edge.
- **C3** (the fold and unfold buttons must not move): tasks 8 and 9. It supersedes the mockups'
  placement: the left sidebar's one fold button sits at the heading's start, before the repository
  menu, in both states; the right column's one button sits at the page's top right corner in both
  states, outside the column's content.
- **C4, C5** (the "…" always visible, muted): task 7. It supersedes the spec's "shown under the
  pointer" for the "…" (US8, Mockups): the "…" is always drawn, as a muted icon, so a card keeps its
  size. The fold button of C3 keeps its hover reveal by opacity, which changes no size.

---

## Task 1: Items and steps from commits

**Files:**

- Create: `crates/core/src/workspace/branches.rs` (the branch reading moved out of `workspace.rs`)
- Modify: `crates/core/src/workspace.rs` (`Feature.at_tip`, `with_pull_request`),
  `crates/core/src/workspace/read.rs` (`read_feature`, moved there from `workspace.rs`,
  [R6](rulings.md#r6-read_feature-moves-into-the-read-module-before-it-changes))
- Test: `crates/core/tests/workspace.rs`, `crates/cli/tests/status.rs`,
  `crates/core/tests/branch_changes.rs`
  ([R7](rulings.md#r7-the-branch-changes-case-of-a-folder-without-its-branch-expects-no-feature)),
  and the TypeScript tests of folders never committed, removed
  ([R8](rulings.md#r8-tests-of-folders-never-committed-are-removed))

**Interfaces:**

- Produces: `Workspace::read(&Git)` unchanged in signature; a branch is an item only with its folder
  or record in its tip commit; for a checked-out branch, `Feature.step` comes from the tip's texts,
  while `texts`, `files`, `uncommitted`, `source`, and `worktree` stay from disk. The tip's read is
  kept in the private `Feature.at_tip`, and `Feature::with_pull_request` computes the step from it,
  so a later pull request's state never brings the disk's texts back into the step.

- [x] **Step 1: Split `workspace.rs` before it changes**

Move `add_branch_features`, `branch_feature`, and `working_tree_features` into
`workspace/branches.rs`, unchanged; then, in a second commit, `read_feature` and `decisions_pending`
into `workspace/read.rs`, unchanged
([R6](rulings.md#r6-read_feature-moves-into-the-read-module-before-it-changes)), so the changes of
step 4 fit under the file's cap.

- Run:
  `env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 cargo nextest run -p uraeda-core -p uraeda-cli`
  and `cargo clippy --workspace --all-targets -- -D warnings`, before and after
- Expected: PASS both times; lower `workspace.rs`'s cap in `crates/cli/tests/structure.rs` to its
  new length

```bash
git add crates/core/src/workspace.rs crates/core/src/workspace/branches.rs crates/cli/tests/structure.rs
git commit -m "refactor(redesign-interface): read branches' features in their own module"
```

```bash
git add crates/core/src/workspace.rs crates/core/src/workspace/read.rs crates/cli/tests/structure.rs specs/2026-10-16-redesign-interface
git commit -m "refactor(redesign-interface): read a feature's folder in the read module"
```

- [x] **Step 2: Write the failing tests**

In `crates/core/tests/workspace.rs`:

- `a_checked_out_branch_without_its_folder_is_no_item`: a branch `2026-10-16-not-a-flow` in
  `.worktrees/2026-10-16-not-a-flow`, without `specs/2026-10-16-not-a-flow/` committed (US1.6):
  `workspace.features` has no feature with that folder.
- `a_dated_folder_without_its_branch_is_no_item`: `specs/2026-10-20-orphan/proposal.md` written on
  the main checkout's disk, no branch (US1.7): no feature `2026-10-20-orphan`.
- `an_uncommitted_gate_does_not_move_the_step`: a worktree feature at its discovery, with
  `clarifications-02.md` saved `awaiting-human` and not committed (US1.8): its step waits on the
  agent and `uncommitted` is true; after committing it, its step waits on the human.
- `a_file_page_keeps_its_uncommitted_text` (review focus 1): in the same state, `api::file_view` of
  `clarifications-02.md` shows the disk's text as its current version.

In `crates/cli/tests/status.rs`, rewrite `uncommitted_proposal_waits_on_you` as
`an_uncommitted_proposal_is_no_item` (R3): `ura status` does not list the branch.

The break each test catches:

- Checked-out branch: the folder check kept for branches checked out nowhere only.
- Orphan folder: the disk's dated folders still read in `working_tree_features`.
- Uncommitted gate: the step computed from the disk's texts.
- File page: the whole feature read from the commit.

- [x] **Step 3: Run them to check they fail**

- Run:
  `env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 cargo nextest run -p uraeda-core -p uraeda-cli`
- Expected: FAIL, `a_checked_out_branch_without_its_folder_is_no_item` finding the feature

- [x] **Step 4: Implement**

In `workspace/branches.rs`: apply the folder-or-record check to every branch, against its tip, the
current branch included; read only the current branch's folder in `working_tree_features`, never
other dated folders on disk. In `read_feature`, when reading from disk, compute `step` from the
tip's texts (R4): read the tip's texts with `ReadFrom::Commit(tip)`, build the step from them, and
keep the disk's texts for everything else. A feature with no tip (none left after the rule) is not
read.

- [x] **Step 5: Run all tests**

- Run: `env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 cargo nextest run --workspace`,
  `cargo clippy --workspace --all-targets -- -D warnings`, `vp check`, and `vp run ts:test`
- Expected: PASS; existing tests that relied on disk steps, like the LSP's
  `waiting_lists_files_of_every_checkout`, still pass, since `waiting` reads the disk; the tests of
  folders never committed are changed or removed (R7, R8)

- [x] **Step 6: Commit**

```bash
git add crates/core crates/cli packages specs/2026-10-16-redesign-interface
git commit -m "feat(redesign-interface): items and their steps come from their commits"
```

## Task 2: Pull requests from `gh`, the new step, and the step's order

**Files:**

- Create: `crates/core/src/pulls.rs`, `crates/core/src/git/process.rs`
- Modify: `crates/core/src/git.rs` (`Git::output` delegates to `process.rs`), `steps.rs`,
  `view/feature.rs`, `workspace.rs` (`Workspace::read` applies the snapshot), `api.rs` or a new
  `api/pulls.rs`, `crates/binding/src/lib.rs`, `packages/binding/index.{js,d.ts}`,
  `crates/cli/src/{status.rs,next.rs}`
- Test: `crates/core/tests/steps.rs`, `crates/core/tests/pulls.rs` (new),
  `crates/cli/tests/next.rs`, `crates/cli/tests/status.rs`, `crates/core/tests/workspace.rs`

**Interfaces:**

- Produces:
  - `pub enum PullRequestState { Draft, Open, ChangesRequested }` and
    `pub struct PullRequestView { number: u32, url: String, state: PullRequestState }`, napi object,
    kebab-case strings `draft`, `open`, `changes-requested`.
  - `pub enum PullRequests { Unavailable, Known(BTreeMap<String, PullRequestView>) }`, by
    `headRefName`; `pulls::parse(json: &[u8]) -> Option<BTreeMap<String, PullRequestView>>`;
    `pulls::fetch(root: &Path) -> PullRequests` runs
    `gh pr list --state open --json headRefName,number,url,isDraft,reviewDecision --limit 200` in
    the repository, through `git/process.rs`; `pulls::remember(root, PullRequests)` and
    `pulls::latest(root) -> PullRequests` hold the snapshot per main checkout (R1), `Unavailable`
    until a first fetch.
  - `api::refresh_pull_requests(repo: &Path) -> Result<bool>`: fetches and remembers, returns
    whether the snapshot changed; binding `refreshPullRequests(repo: string): Promise<boolean>`.
  - `StepName::PullRequestUnknown`, `"pull-request-unknown"`, waiting on the agent, for a feature
    past its last task, or a finished one, when the snapshot is `Unavailable`; a known snapshot
    without the branch reads as no pull request.
  - `StepView.order: u32`: the step's position in the workflow, in this order, a gate placed by the
    file it waits on: the proposal's gate 0, `discovery` 1, the questions' gate 2, `spec` and
    `spec-revision` 3, the spec's gate 4, `approval` 5, `plan` and `plan-revision` 6, the plan's
    gate 7, `implementation` and a change's `change` 8, `final-review` 9, `finish` 10,
    `pull-request-changes` 11, `pull-request` and `pull-request-unknown` 12, `done` 13, `none` 14.
  - `FeatureView.pull_request: Option<PullRequestView>`: the snapshot's open pull request, or the
    record's (`state: open`, the number read from its address).
  - `ura status` and `ura next` refresh once before reading; `ura status` prints
    "pull-request-unknown" as its step name.

- [x] **Step 1: Move the process runner out of `git.rs`**

Move `Git::output`'s process handling into `git/process.rs` as `run(program, args, dir)`, used by
`output`, so `git.rs` shrinks. Then, in a second commit, move `priority_entries` from `workspace.rs`
into `workspace/links.rs`, unchanged, and lower `workspace.rs`'s cap to its new length and the 9
lines step 4 adds there
([R9](rulings.md#r9-priority_entries-moves-into-the-links-module-before-workspacers-grows)).

```bash
git add crates/core/src/workspace.rs crates/core/src/workspace/links.rs crates/cli/tests/structure.rs specs/2026-10-16-redesign-interface
git commit -m "refactor(redesign-interface): match priorities' entries in the links module"
```

- Run: `cargo nextest run --workspace` and clippy, before and after
- Expected: PASS both times; lower `git.rs`'s cap in `structure.rs`

```bash
git add crates/core/src/git.rs crates/core/src/git/process.rs crates/cli/tests/structure.rs
git commit -m "refactor(redesign-interface): run processes from the git module's runner"
```

- [x] **Step 2: Write the failing tests**

- `crates/core/tests/pulls.rs`, table-driven `parse`: a draft, an open one, changes requested (which
  wins over draft), an empty list, invalid JSON (`None`), and a row of another branch name, kept by
  its own `headRefName` only (review focus 2).
- `crates/core/tests/steps.rs`: rewrite `pull_request_rows` and `finishing_rows` for the snapshot:
  with `Known` and no entry, "final-review" (US1.1); draft #31, "finish" (US1.2); open #31,
  "pull-request" waiting on the human (US1.3); changes requested, "pull-request-changes" (US1.4);
  `Unavailable`, "pull-request-unknown" waiting on the agent (US1.5). A change with `Unavailable`
  stays at "change". `order` increases along the table's rows.
- `crates/core/tests/workspace.rs`: `a_finished_items_view_carries_its_pull_request` expects
  `PullRequestView { number: 31, url: "https://github.com/o/r/pull/31", state: Open }`.
- `crates/cli/tests/next.rs`: the fake `gh` answers
  `[{"headRefName":"2026-10-10-cli-core","number":31,"url":"https://github.com/o/r/pull/31","isDraft":true,"reviewDecision":""}]`;
  `pull_request_state_unknown_without_gh` expects `pull-request-unknown`.

The break each test catches:

- Parse: `isDraft` read before changes requested; a row matched by number instead of branch.
- Rows: `Unavailable` treated as no pull request, which would say "Final review" without `gh`.
- Order: two steps given the same position.

- [x] **Step 3: Run them to check they fail**

- Run:
  `env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 cargo nextest run -p uraeda-core -p uraeda-cli`
- Expected: FAIL to compile: `pulls` not found

- [x] **Step 4: Implement**

As in **Interfaces**. `Workspace::read` applies `pulls::latest(main_root)` to every in-flight
feature and to records, in place of `PullRequest::Unknown`. `next_step` keeps asking `gh` only
through the refresh. Regenerate the binding with `vp run binding:build`, and update its callers'
types in `packages/web/src/ChangeAside.tsx` (the pull request is now an object).

- [x] **Step 5: Run all tests**

- Run: the Rust command above, `cargo clippy --workspace --all-targets -- -D warnings`, `vp check`,
  `vp run ts:test`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add crates packages/binding packages/web/src/ChangeAside.tsx specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): pull requests from gh, their address, and each step's order"
```

## Task 3: Names and colours in `repositories.json`

**Files:**

- Modify: `crates/core/src/repositories.rs`, `crates/core/src/api/repository_list.rs`,
  `crates/core/src/view.rs` (`RepositoryView`), `crates/binding/src/lib.rs`,
  `packages/binding/index.{js,d.ts}`
- Test: `crates/core/tests/repositories.rs`, `packages/binding/repositories.test.ts`

**Interfaces:**

- Produces: `Entry.items: BTreeMap<String, ItemSettings>`, serde
  `#[serde(default, skip_serializing_if = "BTreeMap::is_empty")]`;
  `ItemSettings { label: Option<String>, color: Option<Color> }`, napi string enum `Color` (`red`,
  `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`);
  `api::set_item_settings(data_dir, name, folder, label: Option<String>, color: Option<Color>) -> Result<RepositoryView>`
  trims the label, removes it when empty, refuses one over 40 characters, removes the folder's entry
  when both are empty; `RepositoryView.items: Vec<ItemSettingsView { folder, label, color }>`;
  binding `setItemSettings(dataDir, name, folder, label, color)`.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/repositories.rs`: `a_name_and_a_colour_are_kept_by_folder` (US8.1),
`an_empty_name_removes_it` (US8.2), `a_name_is_trimmed_and_spaces_only_remove_it` (review focus 7),
`a_name_over_40_characters_is_refused`, and `the_file_is_the_documented_json` unchanged (no `items`
when empty). In `packages/binding/repositories.test.ts`: `setItemSettings` then `readRepositories`
returns the folder's name and colour.

The break each test catches: an untrimmed label; `items` written when empty, changing the documented
JSON; a 41st character accepted.

- [x] **Step 2: Run them to check they fail**

- Run: the Rust command of task 1, then `vp run binding:build && vp test packages/binding`
- Expected: FAIL to compile: `set_item_settings` not found

- [x] **Step 3: Implement**, as in **Interfaces**, under the core's write lock, through `save`.

- [x] **Step 4: Run all tests**

- Run: Rust tests and clippy, `vp check`, `vp run ts:test`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates packages/binding specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): names and colours of items in the repositories' list"
```

## Task 4: The server's pull requests, names and colours, and the unknown step

**Files:**

- Create: `packages/server/src/pulls.ts`
- Modify: `packages/server/src/repositories.ts` (`Hosts.#start`, `#stop`), `fate/sources.ts`,
  `fate/sessions.ts` (`statusOf`), `runner/status.ts`, `fate/mutations.ts` (`item.settings`),
  `fate/views.ts` (feature records' `label`, `color`)
- Test: `packages/server/src/__tests__/pulls.test.ts` (new), `runner/__tests__/status.test.ts`,
  `__tests__/repositories.test.ts`

**Interfaces:**

- Consumes: `binding.refreshPullRequests(repo)`, `binding.setItemSettings(...)`,
  `binding.readRepositories(dataDir)` (tasks 2, 3).
- Produces:
  - `startPullRequests(path: string, binding: Binding, changed: (folders: Array<string>) => void): { onChanges(changes: Changes): void; stop(): void }`,
    started by each host next to its watch, `changed` publishing the folders on the host's bus:
    refreshes at start, after a watcher burst with `features.length > 0 || workspace`, and every 60
    s while any feature's step is `final-review`, `finish`, `pull-request`, `pull-request-changes`,
    or `pull-request-unknown`; publishes the workspace and features when the refresh says it
    changed; logs only the first failure of a run of failures.
  - Feature records carry `label: string | null` and `color: Color | null`, joined from the host's
    entry (R2).
  - Mutation `item.settings({ folder, label, color })` on a repository's endpoint, returning the
    masked `Feature`, publishing `Workspace` and `Feature`.
  - `sessionStatus` input gains `stepName?: string`; `pull-request-unknown` never yields `halted`.

- [x] **Step 1: Write the failing tests**

- `pulls.test.ts`, with a spied `binding.refreshPullRequests` passed through `testHosts`' `binding`
  option and fake intervals: one call at start; one more after a watcher change; one per 60 s while
  a feature is past its last task, none while none is (SC-001); a `true` answer publishes the
  workspace.
- `status.test.ts`: a done workflow turn with `stepName: "pull-request-unknown"` and `waitsOnAgent`
  reads "Idle", not "Needs attention" (US1.5).
- `repositories.test.ts`: `item.settings` with `label: "Sidebar"`, `color: "purple"` returns the
  feature with them, and a second repository's endpoint receives no update.

The break each test catches: a refresh on every read; a timer left running with nothing past its
last task; the halted rule firing without `gh`; an update sent to another repository.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server`
- Expected: FAIL, `startPullRequests` not found

- [x] **Step 3: Implement**, as in **Interfaces**.

- [x] **Step 4: Run all tests**

- Run: `vp check`, `vp run ts:test`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): the server keeps pull requests, names, and colours"
```

## Task 5: Background commands hold the run

**Files:**

- Modify:
  `packages/server/src/runner/{claude-events.ts,events.ts,transcript.ts,turns.ts,activity.ts,sessions.ts}`,
  `fate/views.ts` (`backgroundCommands` on `SessionRecord`, `SessionRowRecord`), `fate/sessions.ts`;
  a change of the count publishes through the session manager's `changed(live)`, which sends the
  session and the list, so `live.ts` is unchanged
  ([R13](rulings.md#r13-background-tasks-are-tested-inline-and-their-count-publishes-through-the-session))
- Test: `runner/__tests__/claude.test.ts`, `runner/__tests__/sessions.test.ts`,
  `__tests__/sessions.test.ts`

**Interfaces:**

- Produces: the `background` event becomes
  `{ type: "background"; tasks: Array<{ tool: string; kind: "subagent" | "command" }> }`, every
  non-ambient task kept, `local_agent` and `local_workflow` as `subagent`, every other type as
  `command`; `Proc.background` holds both; session records gain `backgroundCommands: number`;
  `waitingLabel` says "Waiting for 1 background command" or "Waiting for 2 sub-agents and 1
  background command"; the idle timer and the watchdog do not run while `proc.background` is not
  empty, and the idle timer arms when it empties with no turn running.

- [x] **Step 1: Write the failing tests**

- `claude.test.ts`: the fixture `background.jsonl` (a `task_started` for a `local_bash`, a
  `local_agent`, an ambient one, then `background_tasks_changed`) parses to the two non-ambient
  tasks with their kinds; rewrite "shells and watchers are not" accordingly.
- `runner/__tests__/sessions.test.ts`, rewrite the background Bash test: a result at 10:00 with a
  background command live keeps the turn running and its record at `backgroundCommands: 1` (US1.9);
  at 10:16 the process is open, `adapter.closes === 0` (US1.10); 31 minutes later with the command
  live, the turn has not failed (watchdog paused); when the command ends while no turn runs, the
  session settles and closes 15 minutes later (review focus 3); an ambient task holds nothing.
- `__tests__/sessions.test.ts`: `SESSION_FIELDS` gains `backgroundCommands`; a session with a live
  command reads "Working" (SC-003).

The break each test catches: `local_bash` still dropped; the idle timer armed at the result; the
watchdog failing a long command; the count never published.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner`
- Expected: FAIL, the fixture's table row reporting one task instead of two

- [x] **Step 3: Implement**, as in **Interfaces**.

- [x] **Step 4: Run all tests**

- Run: `vp check`, `vp run ts:test`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add fixtures/claude packages/server specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): background commands hold their run"
```

## Task 6: The `NeedsYou` view

**Files:**

- Create: `packages/server/src/fate/needs-you.ts`
- Modify: `fate/views.ts` (`Root.needsYouList`), `fate/sources.ts`, `fate.ts` (exports), `live.ts`
  (publish on the global bus when a host's workspace or a session's status changes)
- Test: `packages/server/src/__tests__/needs-you.test.ts` (new)

**Interfaces:**

- Produces:
  `NeedsYouRecord = { id: string; key: string; repository: string; folder: string; label: string; title: string; reason: "blocked" | "attention" | "step" | "pull-request"; message: string; href: string }`,
  on the global endpoint, live on the global bus; `needsYouReason({ status, statusReason, step })`
  picks the reason. `id` is `<repository>/<folder>`; `key` joins it with the reason and the step
  name or the latest turn's id. Its rows come from each host's session rows and workspace through
  the same `statusOf`, the reason picked in the spec's order: refused action, failed or stopped run,
  step waiting, pull request ready. `message` is one of the spec's: "Questions to answer", "The spec
  to review", "The plan to review", "The proposal to write", "The agent was refused an action", "The
  run failed", "The run stopped before a gate", "Pull request #31 is ready for review". `href` is
  the repository's path: the waiting file for a step (`waiting()`'s target, from the core's
  `step.file`), the session for a refused action or a run, the feature for a pull request. `label`
  is the item's name or slug.

- [x] **Step 1: Write the failing tests**

`needs-you.test.ts`, on `testServer` with two repositories: a feature at its questions in each lists
two rows, with "Questions to answer" and `/r/<name>/f/<folder>/clarifications-01.md` (US6.5); a
blocked action lists "The agent was refused an action" first even when the step waits too; a feature
waiting on the agent lists nothing; committing the answers removes its row, live, on the global bus.

The break each test catches: rows read from one repository only; the reason's order inverted; the
row kept after the step moves.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/needs-you.test.ts`
- Expected: FAIL, `needsYouList` unknown

- [x] **Step 3: Implement**, as in **Interfaces**.

- [x] **Step 4: Run all tests** (`vp check`, `vp run ts:test`), Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): what needs the human, across repositories"
```

## Task 7: The sidebar of cards

**Files:**

- Start from: `packages/web/src/sidebar/Sidebar.stories.tsx#Unfolded`
- Create: `packages/web/src/sidebar/Sidebar.tsx`, `sidebar/cards.ts` (from features and session rows
  to `CardItem`), `sidebar/FeatureSettingsDialog.tsx` (its host, drawn beside the shell),
  `sidebar/Row.tsx` (plain rows and chats), `sidebar/Search.tsx`, `sidebar/Allowance.tsx`
  ([R15](rulings.md#r15-the-sidebars-tests-follow-its-cards))
- Modify: `sidebar/ItemCard.tsx` (the "…" always drawn, muted; navigation through `navigate`),
  `sidebar/StepIcon.tsx`, `labels.ts`, `views.ts` (feature `label`, `color`, `step.order`, session
  rows' `backgroundCommands`), `Shell.tsx` (uses `Sidebar`), `sidebar/Sidebar.stories.tsx`
- Delete: `SessionNav.tsx`, `SessionNavRows.tsx`, `AgentsAtWork.tsx` (the search and the allowance
  bar move into `sidebar/`)
- Test: `__tests__/sidebar.test.tsx` (new, replacing the old sidebar's tests in `shell.test.tsx` and
  `usage.test.tsx`), `__tests__/feature-settings.test.tsx` (new)

**Interfaces:**

- Consumes: feature `label`, `color`, `step.order`, `pullRequest`; session rows'
  `backgroundCommands`; `item.settings` (tasks 2 to 5).
- Produces: `toCard(feature, row?, pending?): CardItem`; `stepKind(feature): StepKind` (gate file
  kind from `waiting()`: clarifications → questions, spec → spec, plan → plan, proposal → proposal;
  otherwise by step name: discovery, spec and spec-revision and approval → spec, plan and
  plan-revision → plan, implementation, final-review → review, finish and the pull request steps →
  pull-request, change, done, none → problem); the sidebar's sections in order: Home, Needs you
  (status first, as `STATUS_ORDER`), Inbox with its notes' count, Priorities with the count of
  entries under Now (C1), Changes (New change first, then by `step.order`, then newest folder),
  Features (the same), the allowance bar, Chats; `ItemCard` takes `onOpen`, used by the sections.
  Search matches a card by name, slug, or title, and hides Home, Inbox, Priorities, and New change.

- [x] **Step 1: Write the failing tests**

`sidebar.test.tsx`, on `renderPage` over the fixture repository: US2.1 (order, "4", "12", no
Drafts); US2.2 (the name "settings-page, Settings page, Questions to answer, Needs you", in Needs
you only); US2.3 (discovery, plan, implementation in that order); US2.4 ("7/11 · Session column",
"+1050 −250", the sub-agent line); US2.5 (the "Change" tag under Needs you); US2.6 (search by
"Sidebar"); US1.9's terminal icon in a card's name ("background command running"); the "…" present
on every card without a pointer (C4), and a card's size unchanged when the pointer enters (C4).
`feature-settings.test.tsx`: US8.1 to US8.6 (Save disabled, "Unsaved changes", 40 characters, the
slug kept on the feature's page, the "…" on the phone's drawer).

The break each test catches: sections ordered by status; the count of all priorities instead of
Now's; the "…" drawn only under the pointer; the search ignoring names.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/sidebar.test.tsx`
- Expected: FAIL, no link named "settings-page, Settings page, Questions to answer, Needs you"

- [x] **Step 3: Implement**, as in **Interfaces**, from the mockups' components; remove the old
      sidebar's tests that the new ones replace.

- [x] **Step 4: Run all tests** (`vp check`, `vp run ts:test`, `vp run storybook:build`), Expected:
      PASS

- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): the sidebar of cards, in the flow's order"
```

## Task 8: Folding, resizing, the theme, Home on the phone, and the Done area

**Files:**

- Start from: `packages/web/src/sidebar/Sidebar.stories.tsx#Folded`, `#FewItems`
- Modify: `sidebar/SidebarHeading.tsx` (one fold button at the heading's start in both states,
  placed absolutely, C3 and R16; the page's slot kept; Home first on the phone), `Shell.tsx`
  (`collapsible={{ hasButton: false }}`, `resizable` 200 to 480 px from 280 (R16), the `[` hotkey,
  no footer switch, the Done area), `sidebar/DoneArea.tsx`, `Home.tsx` (the Done group's id `done`,
  scrolled to on `#done`), `theme.tsx` (system only), `App.tsx`, the browser tests' colour scheme
  (R5): a command module beside `vite.browser.config.ts`, `vite.browser.color-scheme.ts` (R16), and
  `scripts/screenshots.ts`, `scripts/inbox-shots.ts`
- Test: `__browser__/sidebar.test.tsx` (new), `__browser__/layout.test.tsx`,
  `__tests__/theme.test.tsx`, every browser test that set `uraeda.theme`, and the tests R17 names

**Interfaces:**

- Produces: `setColorScheme(mode: "light" | "dark")` browser command; `ThemeModeProvider` gives the
  system's mode.

- [x] **Step 1: Write the failing tests**

`__browser__/sidebar.test.tsx` at 1440 × 900: US3.1 (the fold button revealed under the pointer,
reachable by Tab); US3.2 (the rail, each card's step icon with its status, the button at the same
coordinates before and after, review focus 6); US3.3 and US3.4 (`[`, and "[" typed in the search);
US3.5 (400 px kept after a reload, 200 to 480, under 160 folds); US3.8 (reduced motion: no
transition); US7.1 to US7.4 at three window heights. At 402 × 874: US4.1, US4.2. `theme.test.tsx`:
US9.1 (a stored "dark" ignored, no theme switch).

The break each test catches: the button drawn at the heading's end in one state; the hotkey firing
in a field; the Done area making the list scroll; the stored theme still read.

- [x] **Step 2: Run them to check they fail**

- Run: `vp run browser:desktop`
- Expected: FAIL, US3.2's button at different coordinates

- [x] **Step 3: Implement**, as in **Files**; replace every
      `localStorage.setItem("uraeda.theme", …)` in tests and scripts with the command.

- [x] **Step 4: Run all tests** (`vp check`, `vp run ts:test`, `vp run browser:desktop`,
      `vp run browser:phone`), Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): fold, resize, Home on the phone, and the latest done items"
```

## Task 9: The right column

**Files:**

- Start from: `packages/web/src/layout/SideColumn.stories.tsx#Shown`
- Modify: `layout/SideColumn.tsx` (one show and hide button at the page's top right in both states,
  C3; the page's content kept mounted; sticky panel; `]` hotkey), `SessionAside.tsx` (its sections
  inside `SideColumn`, which `WithAside` now draws; `AsideToggle` removed), `SessionPage.tsx`
  (`aside` out of `Header` and `SessionLog`)
- Test: `__browser__/side-column.test.tsx` (new), `__tests__/session-aside.test.tsx`,
  `__browser__/layout.test.tsx`

**Interfaces:**

- Produces: `SideColumn({ children, content, isShown, label, onShownChange, storageKey })`, its
  width kept as `astryx-resizable:uraeda.column`, 280 to 560 px, 320 by default.

- [x] **Step 1: Write the failing tests**: US3.6 (drag to 400 px, kept after a reload, C2), US3.7
      ("Hide progress", "Show progress" at the same coordinates, `]`), the transcript and the focus
      kept when the column hides.
- [x] **Step 2: Run them to check they fail** (`vp run browser:desktop`), Expected: FAIL, no
      separator "Resize progress"
- [x] **Step 3: Implement**, as in **Files**.
- [x] **Step 4: Run all tests** (`vp check`, `vp run ts:test`, `vp run browser:desktop`), Expected:
      PASS
- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): the session's column resizes and folds in place"
```

## Task 10: Writes in flight, and actions on cards

**Files:**

- Start from: `packages/web/src/writes/WriteFeedback.stories.tsx#Committing`,
  `sidebar/Sidebar.stories.tsx#Committing`
- Create: `packages/web/src/writes/store.ts`, `writes/WriteButton.tsx`
- Modify: `writes/WriteFeedback.tsx`, `CommitActions.tsx`, `CommitBar.tsx` (Commit),
  `EditorPage.tsx`, `useEditorActions.ts`, `ReviewVerdict.tsx`, `RoundSubmit.tsx`, `roundTarget.ts`,
  `TaskView.tsx` (Start the feature), `NewChangePage.tsx`, `Composer.tsx` (Start the agent, Stop),
  `AgentPanel.tsx` (Stop), `Shell.tsx` (`WriteProgress`), `sidebar/cards.ts` (pending actions)
- Test: `__tests__/writes.test.tsx` (new), `__tests__/writes-store.test.tsx` (new, R18)

**Interfaces:**

- Produces:
  `useWrites(): { running: Write | undefined; run<T>(write: { label: string; folder?: string }, action: () => Promise<T>): Promise<T> }`;
  `WriteButton({ label, runningLabel = "Committing…", folder?, onClick, variant? })`: running, a
  spinner and `runningLabel`; blocked, `aria-disabled` with the tooltip "Another change is being
  saved to git"; `usePendingAction(folder): string | undefined`, set by `run` with the folder, and
  by "Start the agent" ("Starting the agent…") and Stop ("Stopping…"), cleared when the server's
  status for the folder differs from the one when it started, after 10 seconds, or when the write
  fails.

- [x] **Step 1: Write the failing tests**: US5.1 to US5.7 with a server held mid-write (the pattern
      of `new-change.test.tsx:45-58`) and fake timers for the 10 seconds; SC-002 (the card's
      "Committing…" in the render after the click); review focus 4; "Discard them" and field saves
      not blocked.
- [x] **Step 2: Run them to check they fail**
      (`vp test packages/web/src/__tests__/writes.test.tsx`), Expected: FAIL, no button named
      "Committing…"
- [x] **Step 3: Implement**, as in **Interfaces**; split `ReviewVerdict` (98 lines) before it grows.
- [x] **Step 4: Run all tests** (`vp check`, `vp run ts:test`), Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): git writes show at once, on their button and their card"
```

## Task 11: Notifications

**Files:**

- Start from: `packages/web/src/notify/NotificationBanner.stories.tsx#Ask`
- Create: `packages/web/src/notify/useNotifier.ts`, `notify/permission.ts`
- Modify: `notify/NotificationBanner.tsx`, `Shell.tsx` (the banner above the page), `App.tsx` (the
  notifier on the global client), `views.ts` (`NeedsYouView`)
- Test: `__tests__/notify.test.tsx` (new)

**Interfaces:**

- Consumes: `needsYouList` (task 6).
- Produces: `useNotifier()`: the keys seen since load, a Web Lock `uraeda.notify` held by one tab
  (no lock: each tab notifies), a `Notification` with `tag: key`, title "<label> needs you", body
  the row's message, only while `document.visibilityState` is `hidden`; a click focuses the window
  and navigates to `href`; `document.title` prefixed with "(N) " for N rows. The banner's state from
  `Notification.permission` and `localStorage["uraeda.notifications"]`.

- [ ] **Step 1: Write the failing tests**: US6.1 to US6.9 with a fake `Notification`,
      `navigator.locks`, and `visibilityState`; SC-004 with fake timers; review focus 5 (the lock
      released by a closed tab); `Notification` missing hides the banner.
- [ ] **Step 2: Run them to check they fail**
      (`vp test packages/web/src/__tests__/notify.test.tsx`), Expected: FAIL, no banner "Get
      notified when an agent needs you"
- [ ] **Step 3: Implement**, as in **Interfaces**.
- [ ] **Step 4: Run all tests** (`vp check`, `vp run ts:test`), Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): notifications when the human is needed"
```

## Task 12: The repository dialogs' keyboard, and the UI checks

**Files:**

- Modify: `AddRepository.tsx` (the suggestions as a listbox the arrows drive), `RepositoryMenu.tsx`
  (`Menu` split first, then Enter on a single row), the UI checks' pages
  (`__browser__/layout.test.tsx` `CASES`) with the new states, and
  `specs/2026-10-16-redesign-interface/screenshots/`
- Test: `__tests__/add-repository.test.tsx`, `__tests__/repository-menu.test.tsx`

- [ ] **Step 1: Split `RepositoryMenu`'s `Menu` before it changes**; Run: `vp check`,
      `vp run ts:test`; Expected: PASS before and after; commit
      `refactor(redesign-interface): the repository menu's list in its own component`.
- [ ] **Step 2: Write the failing tests**: US9.2 to US9.4.
- [ ] **Step 3: Run them to check they fail**
      (`vp test packages/web/src/__tests__/add-repository.test.tsx`), Expected: FAIL, the field
      holding "~/Dev/ura" after Enter
- [ ] **Step 4: Implement**, and add the new states to the UI checks (SC-005); take the screenshots
      of every changed view at both sizes and in both themes, as the
      [UI checks](../decisions/ui-checks.md) decision asks.
- [ ] **Step 5: Run all tests** (`vp run ready`), Expected: PASS
- [ ] **Step 6: Commit**

```bash
git add packages/web specs/2026-10-16-redesign-interface specs/2026-10-16-redesign-interface/plan.md
git commit -m "feat(redesign-interface): Enter picks the single repository, and the shell's checks"
```
