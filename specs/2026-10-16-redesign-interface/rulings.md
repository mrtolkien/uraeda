# Rulings: Redesign sidebars and global interface

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The pull requests' snapshot is a cache in the core, not a parameter of every read

- **Decision**: the core keeps the latest `PullRequests` snapshot per repository in memory,
  refreshed by `refresh_pull_requests(repo)`, which runs `gh`; `Workspace::read` reads it. The
  spec's `Workspace::read(repo, &PullRequests)` becomes this cache.
- **Rationale**: the server reads the workspace from 13 call sites and the watcher, and the CLI from
  `output::workspace()`; one refresh call keeps them all on the same snapshot without changing each
  binding signature. The constitution allows caches in memory (principle III).
- **Alternatives considered**: a snapshot argument on `readWorkspace`, `readFeature`, `nextStep`,
  and the watcher: the same behaviour, with every caller and the binding changed.
- **If wrong**: a parameter replaces the cache's lookup in `Workspace::read`; the refresh stays.
- **Where**: task 2.

## R2: Names and colours are joined to features by the server

- **Decision**: the server reads the repository's entry, `readRepositories(dataDir)`, and sets
  `label` and `color` on each feature record it sends; the core's `FeatureView` does not carry them.
- **Rationale**: the core's reads take only the repository's path, and the data folder the server
  uses is its own (`ctx.dataDir`, a temporary one in tests); reading the default folder from the
  core would read the user's real list in tests.
- **Alternatives considered**: a `data_dir` argument on every core read: more churn for a join.
- **If wrong**: the join moves into the core with a `data_dir` argument; records keep their fields.
- **Where**: tasks 3 and 4.

## R3: A branch whose proposal was never committed is no item

- **Decision**: the approved [git](../decisions/git.md) rule counts a branch only with its folder or
  record in its latest commit, so a branch where `proposal.md` was written but never committed is
  not listed by `ura status` or the UI until it is. The CLI test `uncommitted_proposal_waits_on_you`
  becomes a test of its absence.
- **Rationale**: the decision's rule is explicit; `ura start` and the web UI always commit the
  proposal, so only a hand-made branch meets this case.
- **Alternatives considered**: an exception for an uncommitted `proposal.md` on disk: against the
  decision's wording.
- **If wrong**: the human amends the decision; the core's item rule gains the exception.
- **Where**: task 1.

## R4: A step is read from the commit's texts, while pages keep the disk's

- **Decision**: a branch checked out in a worktree is read twice: its texts from disk, for its
  pages, `uncommitted`, `ura check`, and `waiting`; its step from its latest commit's texts.
- **Rationale**: the [git](../decisions/git.md) rule reads the workflow's state from commits, while
  file pages must still show uncommitted edits (`api::file_view`).
- **Alternatives considered**: commit texts everywhere: file pages, `waiting`, and `ura check` would
  lose uncommitted edits.
- **If wrong**: the step's second read is removed.
- **Where**: task 1.

## R5: Dark mode in browser tests is emulated

- **Decision**: browser tests and screenshot scripts set the colour scheme with Playwright's
  `emulateMedia`, through a command of their own, instead of writing `uraeda.theme`.
- **Rationale**: the theme now follows the system only (Q7), so the stored key is no longer read.
- **Alternatives considered**: keeping a hidden reader of the old key for tests: a path users cannot
  reach.
- **If wrong**: the settings page brings a stored choice back; tests may use it again.
- **Where**: task 8.

## R6: `read_feature` moves into the read module before it changes

- **Decision**: a second structural commit of task 1 moves `read_feature` and `decisions_pending`,
  unchanged, from `workspace.rs` into `workspace/read.rs`, and lowers `workspace.rs`'s cap in
  `structure.rs` to 759: its 755 lines, and the 4 that step 4 adds for `Feature.at_tip`.
- **Rationale**: step 1 lowers `workspace.rs`'s cap to its new length, so any line step 4 adds there
  fails the structure test; step 4 changes `read_feature` and adds a field to `Feature`. The read
  module already holds the rest of a folder's reading (`read_texts`, `read_record`).
- **Alternatives considered**: putting the commit's step read in `branches.rs` only, leaving
  `with_pull_request` to recompute the step from the disk's texts: `ura status` with `gh` would undo
  the rule for a checked-out branch past its last task.
- **If wrong**: the two functions move back; `workspace.rs` gets its cap from the plan's step 1.
- **Where**: task 1.

## R7: The branch changes' case of a folder without its branch expects no feature

- **Decision**: the case "a feature with no branch" of
  `branch_changes_lists_the_files_changed_outside_the_feature`
  (`crates/core/tests/branch_changes.rs`) becomes "a dated folder with no branch, no item (R7)", and
  expects "no feature 2026-10-14-draft" instead of no changes.
- **Rationale**: the case wrote `specs/2026-10-14-draft/proposal.md` on the main checkout's disk,
  with no branch, which the workspace read as a feature without a branch. Under the approved
  [git](../decisions/git.md) rule and US1.7, that folder is no item. A feature without a branch is
  now only a merged one, which the case "the feature merged into main" still checks.
- **Alternatives considered**: deleting the case: it would no longer show what such a folder gives.
- **If wrong**: the case goes back to expecting no changes, once the rule counts such folders.
- **Where**: task 1.

## R8: Tests of folders never committed move to setups still reachable

- **Decision**: five TypeScript tests whose setup was a folder or a proposal never committed were
  removed by task 1, then restored by the review of task 1 on setups that are still reachable: the
  "no branch" tests (`runner/__tests__/sessions.test.ts`, `session.test.tsx`,
  `session-aside.test.tsx`) on the fixture's merged feature `2026-10-10-cli-core`, which has no
  branch left; the editor's commit (`editor.test.tsx`, `commit-actions.test.tsx`) on a feature whose
  committed proposal is edited in its worktree, committed as "chore(runner): edit the proposal".
- **Rationale**: under the approved [git](../decisions/git.md) rule, US1.7, and R3, an uncommitted
  folder is no item; but a merged feature still has no branch, and a committed proposal can still be
  edited before discovery, so those paths stay reachable and keep their tests.
- **Alternatives considered**: removing the tests: it dropped coverage of reachable behaviour.
- **If wrong**: the tests go back to their first setups once the rule counts uncommitted folders.
- **Where**: task 1, and its review's fixes.

## R11: The "no branch" message speaks of a merged feature

- **Decision**: the refusal and the composer's note for a feature without a branch read "This
  feature has no branch left: it is merged." instead of "This feature has no branch yet: commit its
  proposal first.", in `runner/session-state.ts` and `SessionPage.tsx`.
- **Rationale**: a merged feature is the only item without a branch under the approved rule (R3), so
  the old advice no longer applies.
- **Alternatives considered**: removing the refusal: a merged feature's session must still refuse a
  run, since its branch is gone.
- **If wrong**: the wording changes back with an exception to the rule.
- **Where**: task 1's review.

## R9: `priority_entries` moves into the links module before `workspace.rs` grows

- **Decision**: a second structural commit of task 2 moves `priority_entries`, unchanged, from
  `workspace.rs` into `workspace/links.rs`, and lowers `workspace.rs`'s cap in `structure.rs` to
  742: its 733 lines, and the 9 that step 4 adds for the feature's pull request and the snapshot's
  application in `Workspace::read` (the structural commit set 741, from an estimate of 8).
- **Rationale**: task 1 left `workspace.rs` at its exact cap, 759, so the `Feature` field that
  carries the snapshot's pull request, and its two initialisations, could not fit. The links module
  already holds `match_feature` and `linked_draft`, the two rules `priority_entries` applies.
- **Alternatives considered**: carrying the pull request inside `Step`: it is the step's input, not
  the step, and `ura next --json` would print it; computing it in `FeatureView::new`: the view has
  no repository path to find the snapshot.
- **If wrong**: the function moves back, and the cap rises by the human's approval only.
- **Where**: task 2.

## R10: Two web tests read the new step without `gh`

- **Decision**: `change.test.tsx`'s "a record without a pull request shows the step's title, with no
  link" and `session-aside.test.tsx`'s "every box checked: the step after the plan, and 11 of 11
  tasks done" expect the heading "Pull request state unknown" instead of "Pull request", and
  `labels.ts` gains that label for `pull-request-unknown`, ahead of task 7's other labels.
- **Rationale**: the tests run without `gh`, so past the last task the core now gives
  `pull-request-unknown`, as US1.5 asks; the heading is the step's label.
- **Alternatives considered**: a fake `gh` in the web tests: they check the column, not the pull
  request's detection, which the core's tests cover.
- **If wrong**: the expectations go back with the step.
- **Where**: task 2.

## R12: The core keeps the last pull requests when `gh` fails

- **Decision**: `pulls::settle(root, fetched, now)` in the core keeps the last known snapshot for 10
  minutes after it was read when a fetch is `Unavailable`, then gives it up; `remember` and
  `refresh` go through it. The server's refresher takes the repository's path and a `changed`
  callback, `startPullRequests(path, binding, changed)`, instead of the plan's host and publisher.
- **Rationale**: the spec's error handling keeps "the last good one … for up to 10 minutes"; the
  snapshot lives in the core (R1), so the rule does too, and the CLI follows it as well. A path and
  a callback keep the refresher testable without hosts.
- **Alternatives considered**: keeping the last snapshot in the server: a second copy of the
  snapshot, and the CLI without the rule.
- **If wrong**: `settle` drops its window, and a failure reads as unknown at once.
- **Where**: task 4.

## R13: Background tasks are tested inline, and their count publishes through the session

- **Decision**: the parser's test of background tasks stays an inline test of `claude.test.ts`,
  rewritten for the kinds, instead of a new `fixtures/claude/background.jsonl`; a change of the
  background commands' count calls the session manager's `changed(live)`, which already sends the
  session, the list, the feature, and the workspace, instead of a new branch of `live.ts`'s
  `sessionPublisher`; one helper, `commandCount` in `session-state.ts`, counts them for the runner
  and the records.
- **Rationale**: the inline test already held every task type, ambient included; `changed(live)`
  publishes what the sidebar reads without growing `sessionPublisher`, which is at its function
  limit.
- **Alternatives considered**: the fixture file, a copy of the inline lines; a count tracked in
  `sessionPublisher`'s throttled path.
- **If wrong**: the fixture is added, or the count moves into the publisher's throttle.
- **Where**: task 5.

## R14: What needs the human is one record of rows

- **Decision**: the global view is one record, `NeedsYouList`, id `all`, holding every row, as the
  session list does, instead of one record per item; it is sent again on the global bus whenever a
  repository's watcher publishes, and whenever a session's turn changes state. Each feature's status
  comes from `featureStatuses` in `fate/sessions.ts`, the same rules as the session list's.
- **Rationale**: the notifier compares the whole set with what it saw; one record is one read and
  one live update, and the list's pattern is the project's.
- **Alternatives considered**: a list of records by item: one subscription per item, and removals
  harder to see.
- **If wrong**: the rows become records of their own, read through a list.
- **Where**: task 6.

## R15: The sidebar's tests follow its cards

- **Decision**: `shell.test.tsx`'s tests of the old sidebar are rewritten for cards: the progress
  row's tests check the card's task line and the task in its name, "Task 7 of 11, Session column";
  the sub-agent's test reads its line in the card; the Done group's sort becomes the Needs you
  section's; the names gain the step's label. `usage.test.tsx` finds the allowance at the end of the
  Features section; `inbox.test.tsx`'s ＋ order is the flow's, the inbox before the priorities;
  `triage.test.tsx` waits for the inbox's new state with `refreshUntil`, since the sidebar's count
  read the inbox before the page did. The card's accessible name gains its task, as the UI layout
  decision asks. The settings dialog has a host beside the shell, drawn from its first opening, as
  the ＋ forms are, so the phone's drawer closes first and a page's own focus is kept.
- **Rationale**: the spec replaces the progress row by the card, groups by the flow, and moves the
  allowance; live updates do not reach the happy-dom tests, whose pattern is `refreshUntil`.
- **Alternatives considered**: keeping a progress link of its own: two links per card, against the
  approval comment C4's card that keeps its size, and the spec's card.
- **If wrong**: the tests follow whatever replaces the cards.
- **Where**: task 7.
