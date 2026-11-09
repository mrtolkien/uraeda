---
status: auto-approved
spec-revision: 1
---

# Plan: Agents catch up open pull requests with main

**Goal:** an open pull request behind the default branch reads "Catch up", an agent's step, and,
once the human turns it on, Uraeda starts that step's run by itself, once per tip of the default
branch.

**Architecture:** the behind rule lives in the core, in a new module `crates/core/src/behind.rs`,
which owns the list of the default branch's own files and the memo of its answers by the pair of
tips. `PullRequests::state` in [`pulls.rs`](/crates/core/src/pulls.rs) applies it to a ready pull
request, which becomes `PullRequest::Behind`, and the step table in
[`steps.rs`](/crates/core/src/steps.rs) maps that to the step `catch-up`, waiting on the agent, with
the commit to catch up with on the step (`Step.catch_up`). Every reader of steps (`ura next`, the
views, the server) gets it from there. The server's runner records, on every workflow turn sent at
`catch-up`, the commit it catches up with (`caught_up_to`, in the session cache), and reads a done
turn sent at `catch-up` as a stop on a conflict. A new module, the catcher
(`packages/server/src/catch-ups.ts`), owns "once per tip" and the switch: it sends the step's
message to each feature at `catch-up`, idle, with no turn recorded for that commit. The skill's step
tables and the implementation reference say the same rule in prose. See the
[spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A branch that already holds the default branch's tip**, or holds it plus its own commits, is
   not behind, even when its merge base is older than a previous tip. Task 1.
2. **A commit on the default branch that only renamed a proposal into a started folder**, as
   `chore(<slug>): start` does (`specs/proposals/x.md` to `specs/<folder>/proposal.md`), is the
   default branch's own: both paths are. Task 1.
3. **A catch-up that ended back at the pull request** does not notify "Pull request #N is ready for
   review" again: the notification's key ignores turns sent at `catch-up`. Task 5.
4. **Two triggers at once**, a watcher burst and a turn's end, start one catch-up, not two: the
   catcher's runs for a repository go one at a time. Task 6.
5. **A catch-up the human started with Continue** that stopped on a conflict is not started again by
   the catcher for the same commit (R1). Task 6.

## Global constraints

From [run lifecycle](../decisions/run-lifecycle.md):

- An open pull request behind the default branch MUST be caught up by itself only when the human
  turned it on, at most once per tip of the default branch. Checked by the server's tests.
- Each automatic run MUST say in its session why it happened. Checked by the runner's tests.
- A run the human stopped or dismissed MUST NOT continue by itself. Checked by the runner's tests.
- Each kind of automatic run MUST have a setting that turns it off. Checked by the core's tests.

From [feature status](../decisions/feature-status.md):

- A feature's status MUST be decided in one place, which every view, notification, and count reads.
  Checked by the server's tests.
- A feature MUST read as working while any of its sessions runs, whatever its step. Checked by the
  server's tests.
- A failed or stopped run MUST ask for the human until they dismiss it, unless it waits to continue
  by itself. Checked by the runner's tests.
- A pull request MUST read as ready for the human's review only when it holds the branch's latest
  commit, and the branch holds every change of the default branch beyond its priorities, inbox,
  proposals, and notes. Checked by the core's tests.

From [git](../decisions/git.md):

- Tools MUST NOT lose the user's work: no force-removed worktree, no force-push, and no deleted
  branch holding commits nowhere else. (The server never pushes; the agent's lease push is the
  skill's, which the spec relies on.)
- Rust tools MUST read git with the gix library, and write through the system `git`, from one
  module.

From [settings](../decisions/settings.md):

- Finding, reading, validating, and writing the settings and the theme files MUST live in the Rust
  core.
- A write MUST keep a human's comments, unknown keys, and order. Checked by the core's tests.
- A setting MUST resolve from its flag, then its environment variable, then the file, then its
  default. Checked by the server's tests.
- A flag or an environment variable MUST NOT be written into the file. Checked by the server's
  tests.
- A setting changed in the web UI MUST apply at once when it can, the page saying otherwise when it
  applies.

From [notifications](../decisions/notifications.md):

- A notification MUST be shown only when an item, in any repository, comes to need the human, as the
  server's statuses say. Checked by the notifier's tests.

From [code quality](../decisions/code-quality.md):

- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting. Checked by clippy and Oxlint. (Oxlint: 500 lines a file, 100 a function, 7 parameters,
  depth 4.)
- A new marker MUST NOT be added unless a human approves it in the plan.
- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.

From the spec, word for word:

- The default branch's own files: `PRIORITIES.md`, `INBOX.md`, `INBOX-TRIAGE.md`,
  `DECISIONS-CHECK.md`, `decisions-check/`, `proposals/`, `notes/`, and a started folder's
  `proposal.md`, all under `specs/`.
- The step's labels: "Catch up" everywhere a step shows; the work line "Catch up with main", `main`
  being the default branch's name.
- The session line: "Catching up with main, which moved to “<subject of the commit>”."
- The banner of a stop: "The catch-up stopped on a conflict.", with "It left the branch as it was,
  and asked on pull request #116 how to settle a conflict. Answer there by requesting changes, or
  dismiss this."
- The switch: `catch_up_pull_requests` in `[runs]`, `false` unset; `--catch-up-pull-requests`,
  `URAEDA_CATCH_UP_PULL_REQUESTS` (`true` or `false`); its row "Catch up open pull requests", with
  the help text of the
  [`RunsSection` mockup](/packages/web/src/CatchUpMockups.stories.tsx#RunsSection).

Existing behaviour to preserve:

- Changes requested, a draft, and an unknown state keep their steps, behind or not:
  `pull_request_rows` and `finishing_rows` in [`steps.rs` tests](/crates/core/tests/steps.rs).
- `push` keeps its meaning when the branch is not behind:
  `an_open_pull_request_and_the_implementation_keep_their_steps` in
  [`pulls.rs` tests](/crates/core/tests/pulls.rs).
- A done turn at any other agent step still reads "halted": the halted rows of
  [`status.test.ts`](/packages/server/src/runner/__tests__/status.test.ts).
- Continue all still sends nothing to a gate: "US5: Continue all sends each stopped run its step's
  message, and none to a gate" in
  [`continue-all.test.ts`](/packages/server/src/__tests__/continue-all.test.ts).

## Code read

- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): `StepName`, `PullRequest`, `Step`;
  `finished_step` and `after_the_last_step` map a pull request's state to a step, a change's
  reference `change`, a feature's `implementation`; `order` puts `push` and `pull-request` at 12.
- [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs): `PullRequests::state` decides `Unpushed`
  from `holds_tip` and `pushed`; `apply` recomputes the step with `Feature::with_pull_request`
  ([`workspace.rs`](/crates/core/src/workspace.rs) line 222), called for every feature at the end of
  `Workspace::read` (line 383). The snapshot is process-global, by repository, as the memo will be.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): `default_branch`, `tip` (local first),
  `remote_tip`, `merge_base`; [`git/history.rs`](/crates/core/src/git/history.rs) `holds`;
  [`git/diff.rs`](/crates/core/src/git/diff.rs) `commit_files`, the one `diff_tree_to_tree` to copy
  for a diff between two commits.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs): a fetch writes `refs/remotes/origin/*`,
  under the watched `refs/`, so the generation moves and the next read recomputes steps. A feature's
  hash holds its serialized `Step`, so a new `catch_up` commit reports the feature as changed; the
  `git` field changes with `FETCH_HEAD`.
- [`crates/core/src/view.rs`](/crates/core/src/view.rs): `NextStepView` and `StepView`, built from a
  `Step`; the binding's typings in [`index.d.ts`](/packages/binding/index.d.ts) are generated from
  them.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs) and
  [`settings/file.rs`](/crates/core/src/settings/file.rs): `RunSettings`, `ContinueKey` and its
  `key()`, `set_continue`; the server's [`settings.ts`](/packages/server/src/settings.ts),
  [`env.ts`](/packages/server/src/env.ts), [`options.ts`](/packages/server/src/options.ts), and
  [`fate/settings-mutations.ts`](/packages/server/src/fate/settings-mutations.ts) carry
  `continueAfterLimit` the same way; the web's
  [`RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx) draws a switch per entry of
  `CONTINUES`, through `CONTINUE_SETTINGS` in `settings/optimistic.ts`.
- [`packages/server/src/runner/message.ts`](/packages/server/src/runner/message.ts): `goal` per
  step, `runMessage`, `recommendedMessage`; tests in `runner/__tests__/recommended.test.ts`.
- [`runner/events.ts`](/packages/server/src/runner/events.ts): `Trigger`.
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts) `addTurn` and `TurnRow`,
  [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts) (append-only list),
  [`runner/cache-turns.ts`](/packages/server/src/runner/cache-turns.ts) `dismiss` (failed or stopped
  only).
- [`runner/send.ts`](/packages/server/src/runner/send.ts): `deliver` adds the turn with the step
  `sendPlace` read; `deliverContinue` writes a system line before its message, the model for the
  catch-up's line. [`send-input.ts`](/packages/server/src/runner/send-input.ts):
  `SendInput.workflow`.
- [`runner/status.ts`](/packages/server/src/runner/status.ts): `sessionStatus` reads a done turn at
  an agent step as `halted`; `continuedByAll`. Tests: `runner/__tests__/status.test.ts`, a table.
- [`fate/feature-status.ts`](/packages/server/src/fate/feature-status.ts): the one home of a
  feature's status, and `featureStatuses(ctx)`.
- [`fate/continue-all.ts`](/packages/server/src/fate/continue-all.ts): `continueOne` sends a step's
  message to a session; the catcher reuses it.
- [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts): the notification's key holds the
  followed turn, so a new turn at the same ask notifies again.
- [`packages/server/src/pulls.ts`](/packages/server/src/pulls.ts): `PAST_LAST_TASK`, the steps that
  keep the pull requests refreshed every minute.
- [`repositories.ts`](/packages/server/src/repositories.ts) `changed` option, wired in
  [`server.ts`](/packages/server/src/server.ts) `openParts`; `onTurnDone` in
  [`live.ts`](/packages/server/src/live.ts); `settings.onChange` in `startSessions`.
- [`packages/web/src/labels.ts`](/packages/web/src/labels.ts) and
  [`sidebar/cards.ts`](/packages/web/src/sidebar/cards.ts): step labels, short labels, icons;
  [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx): the banners by reason;
  [`useDismiss.ts`](/packages/web/src/useDismiss.ts): `DISMISSABLE`.
- Tests: Rust in `crates/core/tests/*.rs` on `common::repo::TestRepo`, a real repository, `origin`'s
  branches set with `update-ref`; the server's in `packages/server/src/__tests__/` on `testServer`
  (fixture repository, fake agent adapter, in-memory cache), and pure tables in `runner/__tests__/`.
  Validation: `nix develop -c vp run fast` after each task, `nix develop -c vp run ready` before a
  push; the binding rebuilt with `nix develop -c vp run --filter uraeda-binding build`.
- The skill: [`SKILL.md`](/skills/uraeda/SKILL.md) at 19,973 characters of 20,000
  ([`skill.rs`](/crates/cli/tests/skill.rs)); the
  [final review's catch-up](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch),
  [Push](/skills/uraeda/references/implementation.md#push), and
  [comments pass](/skills/uraeda/references/implementation.md#comments-on-the-pull-request);
  [`change.md`](/skills/uraeda/references/change.md)'s table;
  [`cli.md`](/skills/uraeda/references/cli.md). Docs: [`docs/web-ui.md`](/docs/web-ui.md) lines
  108-125 and 488-492, [`docs/cli.md`](/docs/cli.md) line 31.

## Constitution check

| I. Humans stay in control | II. Git and plain text first | III. Asynchronous by default | IV. Review effort matches impact | V. Tools are optional |
| ------------------------- | ---------------------------- | ---------------------------- | -------------------------------- | --------------------- |
| ✅                        | ✅                           | ✅                           | ✅                               | ✅                    |

## Complexity tracking

| Abstraction or exception                            | Why it is needed                                                                                          | Simpler alternative rejected because                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `behind.rs`, the behind rule and its memo           | One home for the list of the default branch's files, read by every step reader; SC-005's memo             | Inside `pulls.rs`: it grows past 400 lines with a second responsibility                    |
| `CatchUp` on `Step`, and `CatchUpView` in the views | The catcher, the message, the session line, and the once-per-tip record all need the commit               | A second binding call per feature: two reads that can disagree with the step               |
| `catch-ups.ts`, the catcher                         | The spec's new automatic run, with its own trigger points and "once per tip"; `continuer.ts` is 450 lines | Inside the continuer: a different trigger (a step, not a stopped turn), and over 500 lines |
| `workflow.line` on a sent message                   | The catch-up's session line, the run lifecycle's "says why"                                               | `opening`: it is sent to the agent with the message, and shown as the human's text         |

## Test map

The core's tests run on a real repository (`TestRepo`), the default branch's remote tip set with
`git update-ref refs/remotes/origin/main`, the pull requests a `PullRequests` snapshot built in the
test. The server's tests run `testServer` on the fixture repository with the fake agent, the binding
wrapped so one feature reads at `catch-up` (helper in task 5); the status and message tests are pure
tables. No clock: the catcher is driven by calling its triggers. New tests: 10, against 9 key
scenarios and 2 high edge cases with a check.

| Spec                                                                                       | Task | Test                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| US1 1; more 1, 2; Review focus: a branch holding the tip; review focus: a started proposal | 1    | `crates/core/tests/pulls.rs`, `a_pull_request_behind_the_default_branch_catches_up`, rows                                 |
| US1 3 (only the default branch's files)                                                    | 1    | the same test, its row "only priorities and a started proposal"                                                           |
| Changes requested, draft, unknown keep their steps; "Catch up" wins over "Push"            | 1    | `crates/core/tests/steps.rs`, new rows of `pull_request_rows` and `finishing_rows`                                        |
| US1 more 1 (`ura next` prints `catch-up` and its reference)                                | 1    | the `steps.rs` rows assert `reference`; `ura next` prints the step as it does every other: no test of its own             |
| Edge: no remote, the local default branch                                                  | 1    | `a_pull_request_behind_the_default_branch_catches_up`, row "no remote"                                                    |
| Edge: local main holds a merge not pushed                                                  | 1    | the same test, row "only the local default branch moved"                                                                  |
| SC-005 (no needless diff)                                                                  | 1    | `behind_reads_once_per_pair_of_tips`: a second read with the same tips computes no diff, by the module's counter          |
| Settings: the switch's key, default, write                                                 | 2    | `crates/core/tests/settings.rs` and `settings_writes.rs`, rows for `catch_up_pull_requests`                               |
| Settings: flag, then variable, then file                                                   | 2    | `packages/server/src/__tests__/settings.test.ts`, a row for the new switch                                                |
| US2 more 4, SC-003 (off means off)                                                         | 6    | `catch-ups.test.ts`, "the switch off starts nothing when main moves"                                                      |
| US1 2 (Continue all sends the catch-up)                                                    | 5    | `continue-all.test.ts`, "Continue all sends an idle catch-up its message"                                                 |
| US2 1 (the line, the agent starts)                                                         | 6    | `catch-ups.test.ts`, "a feature at Catch up gets its run, with the line saying why"                                       |
| US2 2 (ready again, no notification)                                                       | 5    | `needs-you.test.ts`, "a catch-up ending at the pull request does not notify again"                                        |
| US2 3, SC-002 (once per tip, restarts included)                                            | 6    | `catch-ups.test.ts`, "one catch-up per tip, across a restart"                                                             |
| US2 more 1 (turning it on starts both)                                                     | 6    | "a feature at Catch up gets its run…", a second feature, the switch turned on as the trigger                              |
| US2 more 2 (a session at work: waits for its end)                                          | 6    | `catch-ups.test.ts`, "a feature at work catches up once its turn ends"                                                    |
| US2 more 3 (a new tip during a catch-up)                                                   | 6    | "one catch-up per tip…", its last assertion: a new commit starts one more                                                 |
| US3 2 (Needs attention, the banner's title)                                                | 5    | `status.test.ts`, rows "a catch-up turn ended at Catch up" and "an earlier turn at Catch up"; web banner: none, text      |
| US3 1, more 1, edge: conflict needs a choice (abort, comment)                              | 3    | none: the agent follows the skill's prose; no code runs it                                                                |
| US3 3 (the comments pass catches up first)                                                 | 3    | none: skill prose                                                                                                         |
| Edge: a push refused by the lease                                                          | 3    | none: skill prose                                                                                                         |
| Edge: a force-push during a review on GitHub                                               | none | none: GitHub's behaviour, nothing of Uraeda's                                                                             |
| Edge: switch off during a catch-up                                                         | 6    | none: the running turn is an ordinary turn; "the switch off starts nothing" owns that none starts                         |
| Edge: stop or dismiss a catch-up                                                           | 5, 6 | `status.test.ts` row "a catch-up turn dismissed" reads idle; the catcher's once-per-tip owns that none starts             |
| Edge: changes requested and behind                                                         | 1, 3 | `pull_request_rows` keeps `pull-request-changes`; the skill's comments pass catches up                                    |
| Edge: `gh` cannot tell                                                                     | 1    | `pull_request_rows`, "without gh", unchanged                                                                              |
| Edge: the agent unavailable or at its limit                                                | 6    | none: the catcher sends through `continueOne`, whose refusals Continue all's tests own                                    |
| Edge: the server restarts during a catch-up                                                | none | none: the restart's continue, owned by `continuer.test.ts`                                                                |
| SC-001 (within one fetch)                                                                  | 1, 6 | none of its own: a fetch moves `origin/main` under `refs/`, which the watcher's tests own; the catcher runs on each burst |
| SC-004 (all or nothing)                                                                    | 3    | none: the skill's abort before any push                                                                                   |
| Review focus: no new notification after a catch-up                                         | 5    | the US2 2 test                                                                                                            |
| Review focus: two triggers at once                                                         | 6    | "a feature at Catch up gets its run…", two triggers in the same tick, one turn                                            |
| Review focus: a manual catch-up stopped                                                    | 6    | "one catch-up per tip…", its first catch-up sent as Continue's                                                            |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1, 2, and 3: the core's steps, the core's and the server's settings, and the skill's prose.
   Tasks 1 and 2 both regenerate `packages/binding/index.d.ts`: after the merge, rebuild the binding
   rather than merge it by hand.
2. Tasks 4 and 5: the runner's turn and message (`message.ts`, `events.ts`, `cache.ts`,
   `migrations.ts`, `send.ts`, `send-input.ts`), and the status, notifications, and web labels
   (`status.ts`, `cache-turns.ts`, `needs-you.ts`, `continue-all.ts`, `pulls.ts`, `packages/web/`).
   Both add their helpers to `packages/server/src/__tests__/helpers.ts`, side by side.
3. Task 6: the catcher, which uses all of the above.

---

## Task 1: The behind rule and the step `catch-up`

**Risky:** a rule every step reader shares (the core, `ura next`, the server, the skill), and a read
of git on every workspace read.

**Files:**

- Create: `crates/core/src/behind.rs`
- Modify: `crates/core/src/lib.rs` (`pub mod behind;`), `crates/core/src/steps.rs` (`StepName`,
  `PullRequest`, `Step`, `finished_step`, `after_the_last_step`, `order`),
  `crates/core/src/pulls.rs` (`state`, `apply`), `crates/core/src/git/diff.rs` (a diff of two
  commits' paths), `crates/core/src/view.rs` (`NextStepView`, `StepView`),
  `packages/binding/index.d.ts` (generated)
- Test: `crates/core/tests/pulls.rs`, `crates/core/tests/steps.rs`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `StepName::CatchUp`, `as_str() == "catch-up"`, `order() == 12`, waiting on the agent, its
    reference `skills/uraeda/references/implementation.md`, or `change.md` for a change.
  - `PullRequest::Behind`, serialized `behind`: open, not a draft, no changes requested, and its
    branch behind; it wins over `Unpushed`.
  - `pub struct CatchUp { pub branch: String, pub commit: String, pub subject: String }` in
    `steps.rs`, the default branch's name, the full hash of the tip to catch up with, and its
    subject line; `Step.catch_up: Option<CatchUp>`, set only at `catch-up`.
  - `behind::catch_up(git: &Git, branch: &str) -> Option<CatchUp>`, and
    `behind::default_branch_own(path: &str) -> bool`.
  - `Git::changed_paths(&self, from: ObjectId, to: ObjectId) -> Result<Vec<String>, GitError>`, in
    `git/diff.rs`.
  - In the binding: `NextStepView.catchUp?: CatchUpView` and `StepView.catchUp?: CatchUpView`, with
    `CatchUpView { branch: string; commit: string; subject: string }`; `pullRequest` may read
    `behind`.

- [ ] **Step 1: Write the failing tests**

```rust
// crates/core/tests/pulls.rs
/// US1 1 and 3, more 1 and 2; review focus 1 and 2; the edge cases without a remote and with a
/// local merge not pushed.
#[test]
fn a_pull_request_behind_the_default_branch_catches_up() {
    // Rows: (name, what main gains, origin/main set?, expected step, expected reference)
    // - "main gained code": a commit on main touching `src/a.rs`, pushed to origin/main
    //   -> CatchUp, implementation.md, and step.catch_up = { branch: "main", commit: <tip>,
    //      subject: "feat: code" }
    // - "only priorities and a started proposal": `specs/PRIORITIES.md`, and
    //   `specs/proposals/y.md` renamed to `specs/2026-10-11-y/proposal.md` -> PullRequest
    // - "a decision": `specs/decisions/x.md` -> CatchUp
    // - "the branch holds main's tip": the branch rebased on main -> PullRequest
    // - "only the local default branch moved": main has a code commit, origin/main does not
    //   -> PullRequest
    // - "no remote": no refs/remotes/origin/main, local main gained code -> CatchUp
    // - "a change's branch": `change/2026-10-10-x`, main gained code -> CatchUp, change.md
    // - "behind and ahead of its pull request": the head lacks the branch's tip -> CatchUp
}

/// SC-005: a second read with the same branch tip and default tip computes no diff.
#[test]
fn behind_reads_once_per_pair_of_tips() { /* behind::diffs() before and after two reads: +1 */ }
```

```rust
// crates/core/tests/steps.rs: rows added to `pull_request_rows` and `finishing_rows`
// "open, behind main"                -> CatchUp, WaitsOn::Agent
// "changes requested, behind main"   -> PullRequestChanges (unchanged)
// "draft, behind main"               -> Finish (unchanged)
// "record, ready, behind main"       -> CatchUp
```

These step-table rows build the step from `steps::step(feature, PullRequest::Behind)` where the
tests feed a state, as the other rows do.

The break each test catches:

- "main gained code": a rule that never looks at `origin/main`, or reads `tip` (local first).
- "only priorities and a started proposal": a rule that counts every commit, or forgets the renamed
  proposal's old path in `proposals/`.
- "the branch holds main's tip": comparing merge bases instead of asking whether the branch holds
  the tip.
- "only the local default branch moved": using `git.tip(default)`, which prefers the local branch.
- "no remote": a rule that gives up without `origin`.
- "behind and ahead": `Unpushed` winning over `Behind`.
- SC-005: a memo keyed by the branch alone, or none.
- The step rows: `Behind` mapped for an open pull request but leaking into changes requested or a
  draft.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test pulls --test steps`
- Expected: FAIL to compile, `no variant named CatchUp` / `no variant named Behind`.

- [ ] **Step 3: Implement**

`behind.rs` owns the rule. The target is `origin/<default>`'s tip, `git.remote_tip(default)`, or,
when the repository has no `refs/remotes/origin/<default>`, the local default branch's tip. The
branch is behind when it does not hold the target (`git.holds`), their histories share a merge base,
and `changed_paths(merge_base, target)` holds a path for which `default_branch_own` is false.
`default_branch_own` is true for `specs/PRIORITIES.md`, `specs/INBOX.md`, `specs/INBOX-TRIAGE.md`,
`specs/DECISIONS-CHECK.md`, anything under `specs/decisions-check/`, `specs/proposals/`, or
`specs/notes/`, and `specs/<folder>/proposal.md` or `specs/changes/<folder>/proposal.md`, one folder
deep. Use the core's existing path constants where they exist (`DefaultRound::Triage.path()`, ...).
The answer is kept in a process-wide map by `(branch tip, target)`, like `pulls`' snapshots, with a
counter of the diffs computed, `pub fn diffs() -> u64`, for SC-005's test. The subject is read only
when behind.

`PullRequests::state` turns `Open` and `Unpushed` into `Behind` when `catch_up` returns a target;
`apply` sets `feature.step.catch_up` to it once the step is `catch-up`. `steps.rs` maps `Behind` to
`Step::agent(StepName::CatchUp, <the changes reference>)` in `finished_step` and
`after_the_last_step` (a change's `change_step` passes through the latter). Rebuild the binding.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run --filter uraeda-binding build && nix develop -c vp run fast`
- Expected: PASS. The benchmark of workspace reads, if `fast` runs it, no slower than its baseline:
  only branches with an open, ready pull request compute anything.

- [ ] **Step 5: Commit**

```bash
git add crates/core packages/binding/index.d.ts
git commit -m "feat(agents-fix): an open pull request behind main reads Catch up"
```

## Task 2: The switch `catch_up_pull_requests`

**Files:**

- Modify: `crates/core/src/settings.rs` (`RunSettings`, `ContinueKey`),
  `crates/core/src/settings/file.rs` (the `[runs]` read), `packages/binding/index.d.ts` (generated),
  `packages/server/src/settings.ts`, `packages/server/src/env.ts`, `packages/server/src/options.ts`,
  `packages/server/src/fate/settings-mutations.ts` (the key's input type),
  `packages/web/src/settings/RunSettings.tsx`, `packages/web/src/settings/optimistic.ts`,
  `packages/web/src/settings/categories.ts` (the row's label, icon, help), `docs/web-ui.md`
- Test: `crates/core/tests/settings.rs`, `crates/core/tests/settings_writes.rs`,
  `packages/server/src/__tests__/settings.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `RunSettings.catch_up_pull_requests: Option<bool>`, `false` when unset.
  - `ContinueKey::CatchUp`, `key() == "catch_up_pull_requests"`; the binding's
    `setContinue(dir, "catch-up", on)`.
  - The server's `values().runs.catchUpPullRequests: Setting<boolean>`, its `inForce` resolved from
    `--catch-up-pull-requests` (sets `true`), then `URAEDA_CATCH_UP_PULL_REQUESTS`, then the file,
    then `false`.

- [ ] **Step 1: Write the failing tests**: a row in the core's `[runs]` read test (unset reads
      `None`, `true` reads `Some(true)`, a string is a problem as for its neighbours); a row in the
      write test (`set_continue(dir, ContinueKey::CatchUp, true)` keeps comments and order); a row
      in the server's precedence test (flag over variable over file).

The break each test catches: a key read under another name; a write that drops comments; a flag
written into the file, or a variable losing to the file.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test settings --test settings_writes`
- Expected: FAIL to compile, `no variant named CatchUp`.

- [ ] **Step 3: Implement**, following `continue_after_limit` at every layer. The web row reads
      "Catch up open pull requests", icon `uraeda:workflow`, with the help text of the `RunsSection`
      story, after the continues' switches. `docs/web-ui.md` gains the key in the `[runs]` block,
      `catch_up_pull_requests = false  # catch up open pull requests behind the default branch`, and
      its flag and variable in the paragraph after it.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run --filter uraeda-binding build && nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/core packages/binding/index.d.ts packages/server packages/web docs/web-ui.md
git commit -m "feat(agents-fix): a switch to catch up open pull requests"
```

## Task 3: The skill catches up an open pull request

**Files:**

- Modify: `skills/uraeda/SKILL.md` (the step table), `skills/uraeda/references/implementation.md` (a
  new section after Push, the comments pass), `skills/uraeda/references/change.md` (its table),
  `skills/uraeda/references/cli.md`, `skills/uraeda/references/writing.md` (R4), `docs/cli.md` line
  31, `docs/web-ui.md` lines 488-492
- Test: `crates/cli/tests/skill.rs` (unchanged: the 20,000-character limit)

**Interfaces:**

- Consumes: the step's name `catch-up` and the list of the default branch's files, from task 1's
  contract (not its code).
- Produces: the anchor `implementation.md#catch-up-an-open-pull-request`, which task 4's message
  does not need but the step table links.

- [ ] **Step 1: Move the follow-up paragraph** of `SKILL.md` ("The workflow only moves on when every
      question is answered…", through the sentence on blank answers) to `writing.md`, next to the
      round's shape, leaving one sentence linking it (R4).

- [ ] **Step 2: Add the rows.** In `SKILL.md` and `change.md`, a row before each "lacks the latest
      commits" row: "The record, and an open pull request is behind the default branch" and "The
      open pull request is behind the default branch", both to
      `[Implementation](references/implementation.md#catch-up-an-open-pull-request), catch up`.
      "Behind" is defined once, in the new section, and linked.

- [ ] **Step 3: Write the section "Catch up an open pull request"** in `implementation.md`, after
      Push. It says:
  - When it runs: the pull request is open, not a draft, with no changes requested, and the branch
    lacks the tip of `origin/<default>`, or of the local default branch without a remote, with a
    change beyond the default branch's own files (the list, word for word from the global
    constraints). With `ura`, `ura next` says it; by hand,
    `git merge-base --is-ancestor origin/<default> <branch>` and
    `git diff --name-only <merge-base> origin/<default>`.
  - What to do: the final review's catch-up, steps 1 to 5, by link, then the Push's lease push.
  - Two differences from the final review: a decision or an amendment on the default branch that
    conflicts with the branch, and a conflict whose resolution needs a choice, stop the run without
    a round of questions. `git rebase --abort`, so the branch's local and remote tips stay as they
    were; then `gh pr comment <number>` naming the conflicting files and the choice, with a
    recommendation; then end the run, which leaves the step at `catch-up`. The human answers by
    requesting changes, which the comments pass handles.
  - Nothing else is written on GitHub, as for the comments pass.
  - The pull request is left as it is: it waits for review again.

- [ ] **Step 4: The comments pass catches up first**: one paragraph in "Comments on the pull
      request": when the branch is behind, catch it up first, as the new section says, a comment
      settling a conflict's choice followed as the resolution.

- [ ] **Step 5: `cli.md` and the docs**: `cli.md`'s paragraph on `ura next` names `catch-up`, which
      wins over `push`; `docs/cli.md` line 31 and `docs/web-ui.md` lines 488-492 say a pull request
      behind the default branch reads "Catch up", for the agent, and that Settings › Runs can start
      it by itself.

- [ ] **Step 6: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-cli --test skill && nix develop -c vp run fast`
- Expected: PASS: `SKILL.md` under 20,000 characters, every link resolves.

- [ ] **Step 7: Commit**

```bash
git add skills/uraeda docs/cli.md docs/web-ui.md
git commit -m "feat(agents-fix): the skill catches up an open pull request"
```

## Task 4: The catch-up's turn and message

**Risky:** a migration of the session cache.

**Files:**

- Modify: `packages/server/src/runner/events.ts` (`Trigger`), `runner/message.ts` (`goal`,
  `runMessage`, `recommendedMessage`), `runner/migrations.ts`, `runner/cache.ts` (`TurnRow`,
  `addTurn`, a read of the record), `runner/send-input.ts` (`SendInput.workflow.line`),
  `runner/send.ts` (`deliver`, `sendPlace`'s use)
- Test: `packages/server/src/runner/__tests__/recommended.test.ts`,
  `packages/server/src/runner/__tests__/cache.test.ts`

**Interfaces:**

- Consumes: task 1's `NextStepView.catchUp`.
- Produces:
  - `Trigger` gains `"catch-up"`.
  - `goal("catch-up")`: work `Catch up with <branch>`, from `next.step.catchUp.branch`, else "the
    default branch"; stop `the pull request is ready for review again`. The recommended message's
    name: "Continue, catch up with main".
  - `catchUpLine(catchUp: { branch: string; subject: string }): string` in `message.ts`:
    `Catching up with ${branch}, which moved to “${subject}”.`
  - `TurnRow.caughtUpTo: string | null`; `addTurn` takes `caughtUpTo?: string | null`; a migration
    appends `ALTER TABLE turns ADD COLUMN caught_up_to TEXT;`.
  - `SessionCache.caughtUp(repo: string, folder: string, commit: string): boolean`: whether a turn
    of any session of the folder recorded that commit.
  - `SendInput.workflow.line?: string`: a system line the turn shows before its message, as an
    automatic continue's.
  - `deliver` records `caughtUpTo = next.step.catchUp.commit` on every workflow turn whose step is
    `catch-up`, whatever its trigger (R1).

- [ ] **Step 1: Write the failing tests**

```ts
// runner/__tests__/recommended.test.ts
/** US1 2: the catch-up's message. */
test("the catch-up step recommends catching up with main", () => {
  const message = recommendedMessage(
    input({ catchUp: CATCH_UP, pullRequest: "behind", step: "catch-up" }),
  );
  expect(message).toMatchObject({ name: "Continue, catch up with main" });
  expect("text" in message && message.text).toBe(
    `/uraeda Continue the feature specs/${branch}/ on branch ${branch}: ` +
      `Catch up with main, starting with ${IMPLEMENTATION}.\n` +
      "Stop when the pull request is ready for review again, and earlier only if you need a decision from me.\n",
  );
});
```

```ts
// runner/__tests__/cache.test.ts
/** SC-002's record: a turn keeps the commit it caught up with, across a reopened cache. */
test("a catch-up turn records its commit, and the folder reads caught up", () => {
  // addTurn({ ..., step: "catch-up", trigger: "catch-up", caughtUpTo: "abc" }) in a file cache,
  // closed and opened again: caughtUp(repo, folder, "abc") is true, "def" false, another folder false.
});
```

The break each test catches: a `goal` falling to "Finish it"; a column not migrated, or a record
read from the session rather than the folder.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/recommended.test.ts packages/server/src/runner/__tests__/cache.test.ts`
- Expected: FAIL, `expected 'Continue, finish it' to be 'Continue, catch up with main'`.

- [ ] **Step 3: Implement** as the Interfaces say. `line` is written as a `system` item before the
      message, in the same transaction as the turn, in both the queued and the started branch of
      `deliver`.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/runner
git commit -m "feat(agents-fix): a catch-up turn records the commit it catches up with"
```

## Task 5: The status, the notifications, and the labels at Catch up

**Files:**

- Modify: `packages/server/src/runner/status.ts` (`StatusReason`, `sessionStatus`,
  `continuedByAll`), `runner/cache-turns.ts` (`dismiss`), `fate/feature-status.ts` (passes the
  latest turn's `step`), `fate/needs-you.ts` (the conflict's message, the key),
  `packages/server/src/pulls.ts` (`PAST_LAST_TASK`), `packages/web/src/labels.ts`,
  `packages/web/src/sidebar/cards.ts`, `packages/web/src/SessionAttention.tsx`,
  `packages/web/src/useDismiss.ts`
- Test: `packages/server/src/runner/__tests__/status.test.ts`,
  `packages/server/src/__tests__/needs-you.test.ts`,
  `packages/server/src/__tests__/continue-all.test.ts`, `packages/server/src/__tests__/helpers.ts`

**Interfaces:**

- Consumes: task 1's step `catch-up` in the binding.
- Produces:
  - `StatusReason` gains `"conflict"`: a done turn sent at `catch-up`, not dismissed, while the step
    is still `catch-up`. Label "Needs attention", status `attention`. Not continuable: Continue all
    leaves it.
  - At `catch-up`, any other done turn reads as the rules after `halted` do (idle, or a new reply),
    never `halted`.
  - `dismiss` also takes a done turn whose step is `catch-up`.
  - `continuedByAll` is also true for a feature at `catch-up` whose status is `idle` or `unread`.
  - The test helper `atCatchUp(binding: Binding, folder: string, catchUp: CatchUpView): Binding`,
    which wraps the binding so the folder's feature, from `readWorkspace`, `readFeature`, and
    `nextStep`, reads at `catch-up` with an open pull request #116. Task 6 uses it.

- [ ] **Step 1: Write the failing tests**

```ts
// runner/__tests__/status.test.ts: rows of the existing table
[
  "a catch-up turn ended at Catch up",
  { latest: { ...ended("done"), step: "catch-up" }, stepName: "catch-up", waitsOnAgent: true },
  { label: "Needs attention", reason: "conflict", status: "attention" },
],
[
  "a catch-up turn dismissed",
  { latest: { ...ended("done", "workflow", dismissed), step: "catch-up" }, seenAt: "2026-10-13T11:00", stepName: "catch-up", waitsOnAgent: true },
  { label: "Idle", status: "idle" },
],
[
  "an earlier turn at Catch up",
  { latest: { ...ended("done"), step: "pull-request-changes" }, seenAt: "2026-10-13T11:00", stepName: "catch-up", waitsOnAgent: true },
  { label: "Idle", status: "idle" },
],
```

```ts
// __tests__/continue-all.test.ts
/** US1 2: an idle feature at Catch up gets the catch-up's message. */
test("Continue all sends an idle catch-up its message", async () => {
  // testServer with atCatchUp(binding, AGENT, CATCH_UP); a session of AGENT whose one turn ended done
  // at "pull-request". Continue all: its session gets a second turn, step "catch-up", and the agent
  // gets a message starting "/uraeda Continue the feature specs/2026-10-12-cli-tuis/".
});
```

```ts
// __tests__/needs-you.test.ts
/** US2 2, review focus 3: a catch-up ending at the pull request does not notify again. */
test("a catch-up ending at the pull request does not notify again", async () => {
  // A feature at pull-request whose session's turn T1 ended; its row's key K. A turn sent at
  // "catch-up" ends done, the step back at pull-request: the row's key is still K.
});
```

The break each test catches: a catch-up stop reading `halted` (wrong banner) or idle (no ask); a
dismissed one still asking; a turn sent before the catch-up asking at `catch-up`; Continue all
skipping idle features; the key moving with every turn.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/status.test.ts packages/server/src/__tests__/needs-you.test.ts packages/server/src/__tests__/continue-all.test.ts`
- Expected: FAIL, `expected 'halted' to be 'conflict'`.

- [ ] **Step 3: Implement.** `sessionStatus`'s `latest` gains `step`; the conflict rule goes right
      after the failed or stopped rule, and dismissal works as for those. `needs-you.ts`: the
      conflict's message is "The catch-up stopped on a conflict"; the key's turn is the followed
      session's latest turn not sent at `catch-up`. `PAST_LAST_TASK` gains `catch-up`. Web: step
      label "Catch up" in `STEPS` and `SHORT`, icon `pull-request`, "Next" heading "The agent
      catches the branch up with main"; the banner `conflict` with the spec's title and text, the
      pull request's number from the feature, "the pull request" without one; `DISMISSABLE` gains
      `conflict`.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server packages/web/src
git commit -m "feat(agents-fix): Catch up reads idle, and a stopped catch-up asks for you"
```

## Task 6: The catcher

**Risky:** concurrency: it starts agent runs by itself, from three triggers.

**Files:**

- Create: `packages/server/src/catch-ups.ts`
- Modify: `packages/server/src/fate/continue-all.ts` (export `continueOne`, with an optional trigger
  and line), `packages/server/src/server.ts` (start it, its triggers, its stop)
- Test: `packages/server/src/__tests__/catch-ups.test.ts`

**Interfaces:**

- Consumes: task 1's `StepView.catchUp`; task 2's `runs.catchUpPullRequests`; task 4's `"catch-up"`
  trigger, `catchUpLine`, `workflow.line`, `SessionCache.caughtUp`; task 5's statuses and
  `atCatchUp`.
- Produces:

```ts
export type CatchUps = {
  /** Catches up the repository's features: after a watcher burst, or a turn's end there. */
  run(repo: string): Promise<void>;
  /** Catches up every hosted repository: the switch changed. */
  runAll(): Promise<void>;
  stop(): void;
};
export function startCatchUps(options: {
  context: (repo: string) => RepoContext;
  enabled: () => boolean;
  repos: () => Array<string>;
}): CatchUps;
```

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/catch-ups.test.ts, on testServer with atCatchUp(binding, AGENT, CATCH_UP)
// CATCH_UP = { branch: "main", commit: "c".repeat(40), subject: "finish(codex-runtime): Codex runtime + model settings" }

/** US2 1, more 1; review focus 4. */
test("a feature at Catch up gets its run, with the line saying why", async () => {
  // Two features at catch-up, idle sessions; the switch off, then on: runAll() and run(repo) in the
  // same tick. Each session has one new turn, trigger "catch-up", step "catch-up", caughtUpTo the
  // commit, whose first item is the system line
  // "Catching up with main, which moved to “finish(codex-runtime): Codex runtime + model settings”."
});

/** US2 3, SC-002, US2 more 3; review focus 5. */
test("one catch-up per tip, across a restart", async () => {
  // A turn sent with Continue at catch-up (trigger manual) ended done. run(repo): no new turn. A new
  // catcher on the same cache file (a restart): no new turn. The commit becomes "d".repeat(40):
  // one new turn, caughtUpTo "ddd…".
});

/** US2 more 2. */
test("a feature at work catches up once its turn ends", async () => {
  // A running turn: run(repo) sends nothing. The turn ends done: the catcher's turn-end trigger
  // sends one.
});

/** US2 more 4, SC-003. */
test("the switch off starts nothing when main moves", async () => {
  // enabled false: run(repo) and runAll() add no turn.
});
```

The break each test catches: no line, or a line on the agent's message; a second send from two
triggers; the record read by trigger only; a restart forgetting the record; a send into a working
session; anything sent with the switch off.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/__tests__/catch-ups.test.ts`
- Expected: FAIL, `Failed to load url ../catch-ups.ts`.

- [ ] **Step 3: Implement.** A run reads `featureStatuses(context(repo))`, and, when `enabled()`,
      sends `continueOne` with trigger `catch-up` and `catchUpLine(step.catchUp)` to each feature
      whose step is `catch-up` with a `catchUp`, whose status is `idle` or `unread` with a session
      (R3), and for which `caughtUp(root, folder, commit)` is false. Runs of one repository go one
      at a time: a run asked meanwhile runs once after it. A refusal is printed once per feature and
      commit, and leaves it. In `server.ts`, start it once the hosts, sessions, and settings exist;
      call `run(host.path)` from the hosts' `changed` callback (beside the extensions'), and from
      `onTurnDone`; `runAll()` from `settings.onChange`, and once at start; `stop()` with the
      server. `enabled` reads `settings.values().runs.catchUpPullRequests.inForce`.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(agents-fix): Uraeda catches up open pull requests by itself, once turned on"
```
