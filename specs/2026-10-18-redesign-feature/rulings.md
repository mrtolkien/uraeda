# Rulings: Redesign feature and change pages

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A done feature's lines are the net diff of its run of commits

- **Decision**: a feature merged by rebase or fast-forward counts the diff from the parent of its
  last run of consecutive scoped commits on the default branch to the newest one; a feature merged
  with a merge commit counts the merge's three-dot diff. Both leave out its folder and its record.
- **Rationale**: this repository merges by rebase, and its start commits sit on the default branch
  hours before the branch's commits, with other features between. Summing each commit's own diff
  gave +7,949 −2,938 for the clarifications redesign, against +6,633 −1,455 on its pull request: a
  rewritten line counted twice.
- **Alternatives considered**: the sum of every scoped commit's diff, robust but inflated; the pull
  request's `additions` from `gh`, which counts the folder and needs the network.
- **If wrong**: a figure off by what a branch rewrote; the rule lives in `history/figures.rs`.
- **Where**: task 6

## R2: A turn's tokens are the agent session's running total minus a baseline

- **Decision**: the Claude adapter sends the running total of `modelUsage`, summed over models. The
  runner stores each turn's own counts against a baseline kept by its process: zero for a new agent
  session, the sum of the session's recorded turns since its last fresh start when it resumes.
- **Rationale**: checked while planning, a resumed `claude` restores its earlier totals, and `usage`
  alone leaves sub-agents out. Idle processes close after 15 minutes, so most runs resume.
- **Alternatives considered**: a column holding the agent's last total, not in the reviewed data
  model; a baseline in memory only, lost on every server restart.
- **If wrong**: the first resumed turn after the upgrade also counts its agent session's earlier,
  unrecorded work; the feature's total stays the agent's own.
- **Where**: task 4

## R3: A draft pull request recommends its comments only when the step does not wait on the agent

- **Decision**: the step's message wins while the step waits on the agent; otherwise an open, draft,
  or changes-requested pull request recommends the comments message.
- **Rationale**: the spec's architecture orders the two, and its scenario of a draft pull request
  happens when the folder came back for a round of questions after finishing: the step then waits on
  the human. At the finish step, the draft is the one the agent is finishing.
- **Alternatives considered**: the comments message whenever a pull request exists, which would
  replace "Finish it" before the finish ran.
- **If wrong**: one condition in `recommendedMessage`.
- **Where**: task 5

## R4: The plan stage starts at the approval's decisions or the plan

- **Decision**: the Plan stage starts at the first `decision(<slug>)` or `plan(<slug>)` commit, so
  the Spec stage ends when the spec is approved and its decisions applied.
- **Rationale**: the approval step comes between the spec and the plan, and the mockup's Plan stage
  starts at the decisions' commit, 15:01, as the spec's scenario ends the Spec stage at 15:01.
- **Alternatives considered**: the plan's commit alone, leaving the approval inside the Spec stage.
- **If wrong**: one row of the stage table in `history/stages.rs`.
- **Where**: task 3

## R5: "Next" for a build reads as the mockup draws it

- **Decision**: the heading "The agent is building", and the line "Task 7 of 11: Session column".
- **Rationale**: the spec's scenario quotes both on one line, "The agent is building: task 7 of 11,
  Session column", and the approved mockup splits them into the heading and its line.
- **Alternatives considered**: one heading holding both, too long for the card on the phone.
- **If wrong**: one row of `feature/next.ts`.
- **Where**: task 8

## R6: The old anchor's search ignores the plan's own text

- **Decision**: task 1's search for `changes-requested-on-the-pull-request` expects no match outside
  the plan's text of task 1, which quotes the anchor in its own commands.
- **Rationale**: the plan names `specs` among the folders searched, so its own text always matched.
- **Alternatives considered**: rewording the plan's commands to hide the anchor, which would lose
  what they search for.
- **If wrong**: a stale link to the old anchor in `specs/`; the search shows it.
- **Where**: task 1

## R7: Until the new page, the feature page lists its notes after its problems

- **Decision**: `FeaturePage.tsx`'s "Problems" list shows the feature's problems, then its notes;
  the file badge "problem" marks blocking problems only. SC-001's walk uses the pathspec
  `'specs/20*'`, and its count is the 37 snapshots `main` holds, not discovery's 72.
- **Rationale**: the plan expected `feature.test.tsx`'s removed `**Answer:**` line to be
  `answers.blank`; it is `answers.marker`, a note, on a round awaiting the human. Without the notes,
  the page between tasks 2 and 8 would lose every note, against the
  [Problems](../decisions/problems.md) decision, which shows them on the item's page. The plan's
  pathspec `'specs/20*/'` matches no commit, and discovery counted commits of branches not on
  `main`.
- **Alternatives considered**: rewriting the existing test into an answered round with a blank
  answer, which would hide notes from the page until task 8.
- **If wrong**: one line of `ProblemList`, gone with task 8.
- **Where**: task 2

## R8: The warnings test reads the problems and the notes

- **Decision**: `crates/core/tests/api.rs`'s `a_features_problems_leave_its_warnings_out` asserts
  over `problems` and `notes` together.
- **Rationale**: it checked that a feature's results hold the check's errors, the stub spec's, and
  never its warnings. Those errors are notes now, so `problems` alone is empty; the rule it guards,
  warnings left out, is unchanged.
- **Alternatives considered**: a blocking error in its fixture, which would test something else.
- **If wrong**: one line of the test.
- **Where**: task 2

## R9: The binding's history read lives in a module of its own

- **Decision**: `readHistory` is exported from `crates/binding/src/history.rs`, as the settings'
  functions are from `settings.rs`, and a feature's change also sends its `History` live update.
- **Rationale**: `crates/binding/src/lib.rs` had 495 lines: one more export would take it past the
  code quality decision's 500. The page reads the history live, as it reads the branch's changes.
- **Alternatives considered**: the export in `lib.rs`, over the limit; a history read only when the
  page opens, stale after the agent's next commit.
- **If wrong**: the function moves back once `lib.rs` is split; the live update is one line of
  `live.ts`.
- **Where**: task 3

## R10: An unknown pull request recommends no message

- **Decision**: at the step `pull-request-unknown`, when `gh` could not read the pull request's
  state, the composer recommends nothing: "No recommended message: the feature waits on you". The
  step still waits on the agent, so a hand-over's message at it still runs.
- **Rationale**: the plan's own test expects nothing there, and the spec's edge case keeps the
  comments message out; the step's message, "Finish it", could open a second pull request beside one
  `gh` cannot see.
- **Alternatives considered**: recommending "Finish it", as the step's reference allows.
- **If wrong**: one entry of `NOT_RECOMMENDED` in `runner/message.ts`.
- **Where**: task 5

## R11: A merge commit's lines are checked against a two-dot diff of its parents

- **Decision**: task 6's merge-commit test catches a two-dot diff between the merge's parents, not
  the first parent's diff the plan named; its tests run with `--test history`; and
  `changes::outside` also leaves a finishing branch's record out of the session's changes.
- **Rationale**: for a clean merge, the first parent's diff and the three-dot diff of its parents
  are the same files and lines, so no test can tell them apart. Nextest's bare filter matches test
  names, and selected none of `crates/core/tests/history.rs`.
- **Alternatives considered**: a conflicted merge in the test, which depends on git's resolution
  text.
- **If wrong**: a figure off for a merge resolved with extra changes; the rule lives in
  `history/figures.rs`.
- **Where**: task 6

## R12: A live item starts no stage after its current one

- **Decision**: a live item's stages after the one its step is in have no start; the current stage
  may start.
- **Rationale**: found in review of task 3: a `fix(<slug>)` commit at 13:00, while the spec waited,
  started Build at 13:00 with Spec current, and Build jumped to the plan's first code commit later.
- **Alternatives considered**: leaving code commits made before the plan out of Build, which a
  change's Fix stage, with no plan, could not use.
- **If wrong**: a later stage shows no time until the step reaches it; one line of `history.rs`.
- **Where**: task 3, fixed with task 6

## R13: A done item's merge and lines are read from its finish commit

- **Decision**: a done item arrived with its `finish(<slug>)` commit: at its committer time when it
  is on the default branch's first-parent line, its lines the run of scoped first-parent commits
  ending at it; otherwise through the oldest first-parent merge commit that has it.
- **Rationale**: found in review of task 3: a `fix(<slug>)` commit made on `main` after the merge
  moved the merge to its time, and took the lines from its run alone. Rebased commits also often
  share one committer time, so the newest scoped commit by that time could be any of the run.
- **Alternatives considered**: the newest scoped commit, as task 3 built it.
- **If wrong**: a merge timed to the finish of a feature reopened after merging; the rule lives in
  `history/figures.rs`.
- **Where**: tasks 3 and 6

## R14: The history reads its one folder, and a done item's walk starts at its record

- **Decision**: `read_history` reads the workspace with only its folder, `Workspace::read_folder`,
  which skips every other branch's and record's read and gives the same feature. A done item's walk
  starts at the first-parent commit that added its record, found by
  `git log --first-parent --diff-filter=A -1 -- <record>`, and stops at the folder's date as before.
- **Rationale**: found in review of task 3: the whole workspace took about 200 ms of a read in a
  debug build here, and a done item's walk from the default branch's tip grew with every later
  feature. The benchmark went from 73 ms to 24 ms; on this repository, 2026-10-12-finish-feature
  reads in 92 ms, 2026-10-17-redesign-clarifications in 123 ms, and the slowest record,
  2026-10-16-redesign-interface, whose days hold 500 commits, in 251 ms, all debug builds. gix has
  no path-limited log; the [Git](../decisions/git.md) decision runs the system `git` for such reads,
  as `first_parent_changes` does, and git stops at the addition.
- **Alternatives considered**: `first_parent_changes`, which walks to the root, 97 ms against 7 ms
  here; a walk of the first-parent line checking each tree for the record, slower in gix.
- **If wrong**: a feature read alone that differs from the workspace's, which
  `a_folder_read_alone_is_the_workspaces` compares; a record deleted and added again starts the walk
  at its second addition.
- **Where**: tasks 3 and 6

## R40: A new agent session in a process says so, and its first total is its turn's own

- **Decision**: a reported total lower than the process's baseline in any field starts a new agent
  session: the turn gets the whole total. An `init` with a new session ID, `/clear`, adds the system
  line "Started a new session: the agent cleared the turns above." to its turn, and
  `agentSessionTokens` starts at it, as at `FRESH` and `REPLACED`. A fresh turn taken back while its
  process opened leaves its `FRESH` line to the next turn started on that process.
- **Rationale**: the plan clamped a lower total to zero, losing the new agent session's first turn,
  and a later resume summed the previous agent session's turns into its baseline, counting the new
  one's turns twice. An agent session's running total never decreases, and the baseline of a resume
  needs a mark in the turns where the agent session started.
- **Alternatives considered**: a column of the turns holding their agent session's ID, a migration
  for one case; the lower-total rule alone, which counts a resumed agent session's earlier turns
  again.
- **If wrong**: `processes.ts`'s `tokens`, and the `init` case of `transcript.ts`.
- **Where**: task 4, after its review
