---
status: auto-approved
spec-revision: 1
---

# Plan: Feature state pass

**Goal:** Give every feature one status, decided in one place on the server, and make its parts
true: a running agent always shows, a failure stays until dismissed, the human's own writes move the
step at once, progress counts task branches, a pull request is ready only with the branch's work,
and a line of **Now** started as a change leaves **Now**.

**Architecture:** The core keeps owning the step. It now reads a folder's deferred commits, its task
branches, and its pull request's head and merge. The runner owns one session's status, and its cache
owns a turn's dismissal. A new server module, `fate/feature-status.ts`, owns the feature's status.
It decides it from the core's step and the runner's session statuses, and sends it with each
workspace feature and each `Feature` record. The sidebar, home, the feature page, the notifier, and
the tab's title read that one value. The browser's own rules and its copy of the status ranks go.
See the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A deferred write and a manual edit in the same folder.** The step is read from the tip with the
   deferred writes' own bytes on top, never from the disk. A status edited by hand beside a queued
   approval does not move the step. Task 1.
2. **A queued approval whose commit lands.** The step read from the commit is the one the deferred
   write gave, so the card does not flicker back to the gate between the two reads. Task 1.
3. **Dismiss sent for a turn that is still running, or for another repository's turn.** It is
   refused, and nothing changes. Task 5.
4. **A pull request's head the local repository has never fetched.** The step reads "PR ready", not
   Push: nothing proves the branch holds commits the pull request lacks (ruling R2). Task 6.
5. **A notification for the same gate after each run.** Its key carries the turn the status follows,
   so a run that ends at the gate notifies once, and a page reload notifies nothing seen before.
   Task 7.
6. **A running session of a feature that left the sidebar**, such as a merged one. It shows as a
   session card until its run ends. Task 9.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these:

- [Feature status](/specs/decisions/feature-status.md):
  - "A feature's status MUST be decided in one place, which every view, notification, and count
    reads."
  - "A feature MUST read as working while any of its sessions runs, whatever its step."
  - "A feature no session works on MUST follow its latest session, never an older session's
    outcome."
  - "A failed or stopped run MUST ask for the human until they dismiss it."
  - "A pull request MUST read as ready for the human's review only when it holds the branch's latest
    commit."
  - "A branch's step SHOULD be read from its latest commit, or from a write of the human's that
    Uraeda is still committing."
- [Git](/specs/decisions/git.md): "Tools MUST NOT lose the user's work: no force-removed worktree,
  no force-push, and no deleted branch with commits the default branch lacks." "Rust tools MUST read
  git with the gix library, and write through the system `git`, from one module."
- [Agents](/specs/decisions/agents.md): a dismissal is kept in the runner's cache, never in the
  repository.
- [UI behaviour](/specs/decisions/ui-behaviour.md): an error stays next to what it concerns until
  dismissed; "a write MUST show its result at once".
- [Notifications](/specs/decisions/notifications.md): a notification always means an ask, and fires
  when an item comes to need the human.
- [Performance](/specs/decisions/performance.md): the step after the human's write draws within 100
  ms. "A cache that misses a change shows stale data: invalidation is the core's to get right."
- [Code quality](/specs/decisions/code-quality.md): files at most 500 lines, functions at most 100,
  7 parameters, nesting 4. "A new marker MUST NOT be added unless a human approves it in the plan."
  `crates/core/src/workspace.rs` (604 lines) is listed in `crates/cli/tests/structure.rs` and may
  only shrink.
- [Testing](/specs/decisions/testing.md): the stage is `early`. Test stored formats, git, contracts
  between the parts, and the reproduction of each bug fixed. A test of replaced behaviour is
  rewritten or removed in the task that replaces it. "Unit tests MUST NOT depend on elapsed time,
  except benchmarks of a spec's success criteria." Each changed view is reviewed in the sandbox, in
  both themes, at a phone's and a desktop's width.
- Exact texts and values, from the spec and its stories:
  - Gate labels while an agent works: "Spec", "Plan", "PR"; at rest "Spec ready", "Plan ready", "PR
    ready". "Questions" stays "Questions".
  - The Push step's card label: "Push", its icon the pull request's, in In progress.
  - Progress: "14/20" on the card, named "14 of 20 tasks done".
  - Banners: "The server stopped the agent." with "It was running when the server stopped. Tell the
    agent how to go on, or dismiss this."; "You stopped the agent." with "Tell the agent how to go
    on when you are ready, or dismiss this."; "The agent's run failed." with "Read how it ended,
    then tell the agent how to go on, or dismiss this.", after the turn's reason when it has one.
  - A started title is cut at its last whole word under 80 characters, with "…". A first 80
    characters without a space are cut at 79, with "…".
  - The watcher reports a burst at most 1 second after its first event.
  - `gh` failing keeps the last answer 10 minutes, then the step reads "PR unknown" (existing).

## Code read

- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): the step table. `feature_step` takes
  progress from the first task with unchecked boxes at the tip. `after_the_last_step` and
  `finished_step` map `PullRequest::Open` to `pull-request`, waiting on the human. `Step::order`
  places each step name.
- [`crates/core/src/workspace/read.rs`](/crates/core/src/workspace/read.rs): `read_feature` reads
  files from disk and the step from the tip (`at_tip`). `Feature::from_texts` builds a feature from
  texts alone.
- [`crates/core/src/actions/deferred.rs`](/crates/core/src/actions/deferred.rs): deferred commits
  per repository, in memory, each with its `place`, `change.paths`, and `written` files, each file's
  bytes after the write. `fresh` and `taken` hold the ones not landed. A refusal puts the files
  back. Tests: [`crates/core/tests/deferred.rs`](/crates/core/tests/deferred.rs), helper
  `deferring()`.
- [`crates/core/src/api/expected.rs`](/crates/core/src/api/expected.rs) and
  [`crates/binding/src/expected.rs`](/crates/binding/src/expected.rs): the disk-side step, read only
  by [`fate/workflow-step.ts`](/packages/server/src/fate/workflow-step.ts) `messageStep`.
- [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs):
  `gh pr list --state open --json headRefName,number,url,isDraft,reviewDecision`, parsed by `parse`,
  kept by `settle` (10 minutes on failure), applied by `PullRequests::apply`. Tests:
  [`crates/core/tests/pulls.rs`](/crates/core/tests/pulls.rs),
  [`crates/core/tests/steps.rs`](/crates/core/tests/steps.rs) `pull_request_rows`.
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs) `read_only`: applies the pull
  requests to every feature; `merged_features` marks merged ones `Step::done()`. Listed as large.
- [`crates/core/src/workspace/branches.rs`](/crates/core/src/workspace/branches.rs): feature
  branches read from their worktree or tip. A task branch, `<branch>-task-N`, holds no folder of its
  own name, so it is no item.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs): `watch_folders` never forgets a folder;
  the burst loop waits `QUIET` (200 ms) with no upper bound. Tests:
  [`crates/core/tests/watch.rs`](/crates/core/tests/watch.rs), helpers `watching`, `next`.
- [`crates/core/src/actions/start/typed.rs`](/crates/core/src/actions/start/typed.rs) `Typed::read`
  cuts the title at 80 characters. [`plan.rs`](/crates/core/src/actions/start/plan.rs) `plan` adds a
  typed start's link with `priorities::add_started`. A proposal's start moves its line with
  `priorities::move_to_started` and takes its nested lines. Tests:
  [`crates/core/tests/actions.rs`](/crates/core/tests/actions.rs).
- [`crates/core/src/history/stages.rs`](/crates/core/src/history/stages.rs): maps each step name to
  a stage; a new step name needs its row.
- [`packages/server/src/runner/status.ts`](/packages/server/src/runner/status.ts): `sessionStatus`,
  one session's status; `STATUS_ORDER`. Tests:
  [`runner/__tests__/status.test.ts`](/packages/server/src/runner/__tests__/status.test.ts).
- [`packages/server/src/runner/cache.ts`](/packages/server/src/runner/cache.ts) (488 lines),
  [`cache-rows.ts`](/packages/server/src/runner/cache-rows.ts) `TurnRow`, and
  [`migrations.ts`](/packages/server/src/runner/migrations.ts): one migration per `user_version`.
  `interrupted` ends a dead process's turns as `stopped` with the reason "Stopped: the server
  stopped while it ran." (`SERVER_STOPPED` in
  [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts), 497 lines).
- [`packages/server/src/fate/sessions.ts`](/packages/server/src/fate/sessions.ts) (473 lines):
  `turnsOf`, `statusOf`, `featureStatuses` (the notifier's rule), `featureRecord`.
  [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts) builds the notifications and their
  keys from `featureStatuses`. [`fate/sources.ts`](/packages/server/src/fate/sources.ts) `workspace`
  sends the workspace's features. [`fate/views.ts`](/packages/server/src/fate/views.ts) types
  `WorkspaceRecord` and `FeatureRecord`.
  [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts) holds the `session.*` mutations,
  each calling a `Sessions` method that emits `onChange`.
- [`packages/server/src/live.ts`](/packages/server/src/live.ts): `publish` sends `Workspace`, each
  `Feature`, and `NeedsYouList`. A turn's state change sends `Workspace`, the `Feature`, and the
  `SessionList`. [`repositories.ts`](/packages/server/src/repositories.ts) publishes a feature when
  its queued commit lands or is refused, not when it is queued.
- [`packages/server/src/pulls.ts`](/packages/server/src/pulls.ts): polls `gh` every 60 seconds while
  a feature is at a step in `PAST_LAST_TASK`.
- [`packages/server/src/runner/message.ts`](/packages/server/src/runner/message.ts) `goal`: each
  agent step's work and stop.
- [`packages/server/src/fate/change-starts.ts`](/packages/server/src/fate/change-starts.ts)
  `change.start`; [`packages/web/src/NewChangePage.tsx`](/packages/web/src/NewChangePage.tsx) calls
  it, then `takeOut` from [`useStartFrom.ts`](/packages/web/src/useStartFrom.ts) removes the line in
  a second call.
- Web: [`sidebar/cards.ts`](/packages/web/src/sidebar/cards.ts) (`STATUS_ORDER` copy,
  `featureStatus`, `stepOf`), [`sidebar/entries.ts`](/packages/web/src/sidebar/entries.ts) (the
  folder's first row), [`home/features.ts`](/packages/web/src/home/features.ts) and
  [`home/Core.tsx`](/packages/web/src/home/Core.tsx) (columns by `waitsOn`),
  [`feature/next.ts`](/packages/web/src/feature/next.ts) and
  [`FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx) (the latest session's `working`),
  [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx) (the banner),
  [`sidebar/ItemCard.tsx`](/packages/web/src/sidebar/ItemCard.tsx), and the readers of
  `progress.position`: `SessionAnnouncer.tsx`, `feature/SessionsPane.tsx`, `feature/Timeline.tsx`,
  `session/PlanProgress.tsx`. The mockups are
  [`sidebar/FeatureState.stories.tsx`](/packages/web/src/sidebar/FeatureState.stories.tsx).
- Server tests: [`__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts) `testServer`,
  `byId`, `mutate`; [`sessions.test.ts`](/packages/server/src/__tests__/sessions.test.ts) helpers
  `folderSession`, `doneTurn`, `needsYouRow`, `rowOf`;
  [`held-hook.ts`](/packages/server/src/__tests__/held-hook.ts) holds or refuses a commit's hook;
  [`queued-commits.test.ts`](/packages/server/src/__tests__/queued-commits.test.ts);
  [`live.bench.ts`](/packages/server/src/__tests__/live.bench.ts).
- Validation: `vp run fast` after each task, `vp run ready` before a push, inside `nix develop -c`.
  `vp run --filter uraeda-binding build` regenerates `packages/binding/index.d.ts` and `index.js`
  after a binding change. The UI is checked with `vp run sandbox`.

## Constitution check

| I. Humans in control | II. Git and plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | ---------------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅                     | ✅         | ✅                | ✅                |

## Complexity tracking

| Abstraction or exception                            | Why it is needed                                                                          | Simpler alternative rejected because                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `fate/feature-status.ts`, the feature status owner  | the spec's architecture: five readers had four copies of the rule                         | keeping it in `fate/sessions.ts` takes that file past 500 lines           |
| `deferred::pending`, the deferred writes' bytes     | the step overlays them on the tip, in the core, so the composer and the views read one    | reading the disk moves the step on manual edits, against the git rule     |
| `PullRequest::Unpushed`                             | an open pull request lacking the branch's commits maps to the Push step in both tables    | a flag beside the state would be read in two places, and forgotten in one |
| `Feature::task_branch_done`, from the task branches | progress counts tasks done on a task branch; only the workspace read has git to read them | reading them in `steps.rs` needs git there, which reads files only        |

## Test map

New tests: 10, under the spec's 15 key scenarios plus 3 high edge cases. The core's tests run on
temporary git repositories (`TestRepo`), the watcher's with real file events and timeouts, for
SC-003 only. The server's run `testServer` over the example project, with the fake agent, the
runner's SQLite cache in a temporary folder, and `held-hook.ts` for commits. No test renders the web
UI. Its views are checked in the sandbox, as the testing decision asks.

| Spec                                                                 | Task | Test                                                                                                      |
| -------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| US3 1, 2; more 1; Review focus: deferred write and manual edit       | 1    | `crates/core/tests/deferred.rs`: a deferred approval moves the step, a refusal moves it back              |
| US3 1 (the card, at once); SC-002; Review focus: landing             | 1    | `queued-commits.test.ts`: an approval still landing moves the feature's step at once (rewritten)          |
| SC-002 (100 ms, on the benchmark)                                    | 1    | `live.bench.ts`: an approval's step read                                                                  |
| Edge: the server stops before a queued approval lands                | none | existing: `a_deferred_commit_never_landed_leaves_its_files_written_uncommitted`                           |
| US3 3; more 2; SC-003                                                | 2    | `crates/core/tests/watch.rs`: a re-created worktree is watched again, a burst under steady writes reports |
| US6 1; more 1                                                        | 3    | `crates/core/tests/actions.rs`: a start from a line of Now replaces it by its link                        |
| US6 2; edge: no space in 80 characters                               | 3    | `crates/core/tests/actions.rs`: `a_long_first_line_is_cut_for_the_title_and_kept_whole` (rewritten rows)  |
| US2 1, 3; more 1, 3; edge: Dismiss on a replaced run; RF 3           | 4    | `status.test.ts` rows, and `dismissed.test.ts`: a dismissed run stops asking, across a restart            |
| US2 2 (in every tab)                                                 | none | none: the live update of a turn's change exists; checked in the sandbox                                   |
| US2 more 2                                                           | none | existing: `session.send on a feature creates its session and returns it with its first turn`              |
| US5 1; more 2; Review focus: unfetched head                          | 5    | `crates/core/tests/steps.rs` `pull_request_rows` rows: open and ahead is Push, behind is ready            |
| US5 more 1                                                           | 5    | `crates/core/tests/pulls.rs`: a merged pull request holding the tip makes the feature done                |
| US5 2 (within 60 seconds); edge: `gh` fails                          | none | existing: the 60-second poll of `pulls.ts`, `settle`'s tests                                              |
| US1 1, 2, 3; more 1, 2, 3; edge: two sessions running; SC-001; RF 5  | 6    | `sessions.test.ts`: a running session makes its feature Working everywhere, then it follows its latest    |
| US4 1, 2; more 1, 2; edge: a task the plan no longer has             | 7    | `crates/core/tests/steps.rs` `implementation_progress` (rewritten), `crates/core/tests/workspace.rs` row  |
| US5 1 (`ura next` names the push)                                    | 8    | `crates/cli/tests/next.rs`: a row for the Push step                                                       |
| US1–US5 in the views; SC-004; edge: done feature still running; RF 6 | 9    | none: the views are checked in the sandbox (testing decision); `entries.test.ts` keeps its rows passing   |
| Unverified: the approval that stayed "Needs you"                     | 1    | Step 1 reproduces it in the sandbox                                                                       |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1, 2, 3, and 4: the core's read and deferred commits and the server's queue (1), the
   watcher (2), the start from a line, its server mutation and the change page (3), and the runner's
   cache and session status (4). Tasks 1 and 3 each change `packages/binding/index.d.ts` and
   `index.js`, which are generated: rebuild them after the merge, never merge them by hand.
2. Tasks 5 and 6: the pull requests and the step table in the core, `pulls.ts`, and `message.ts`
   (5), and the feature status in the server's `fate/` files (6). Task 5 changes the generated
   binding files.
3. Tasks 7 and 8: progress across task branches, in `steps.rs`, the workspace read, and the readers
   of `progress` (7), and the skill, the docs, and the CLI's tests (8). Task 7 follows task 5 in
   `steps.rs`, so it is in the next wave. It changes the generated binding files.
4. Task 9: every view reads the feature's status. It consumes tasks 4 to 7.

---

## Task 1: The step moves with the human's queued write

**Risky:** It changes how every reader gets a feature's step, a rule shared by the views, `ura`, and
the composer.

**Files:**

- Modify: `crates/core/src/actions/deferred.rs` (add `pending`)
- Modify: `crates/core/src/workspace/read.rs` (`read_feature`)
- Delete: `crates/core/src/api/expected.rs`, `crates/binding/src/expected.rs`, and their `mod` and
  `pub use` lines
- Modify: `packages/server/src/fate/workflow-step.ts` (`messageStep`)
- Modify: `packages/server/src/repositories.ts` (publish a feature as its commit is queued)
- Modify: `packages/server/src/writes/queue.ts` (tell `moved`, once `settled`, of a queued write
  too)
- Test: `crates/core/tests/deferred.rs`, `packages/server/src/__tests__/queued-commits.test.ts`,
  `packages/server/src/__tests__/live.bench.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `deferred::pending(key: &Path, root: &Path, folder_path: &str) -> BTreeMap<String, Option<String>>`:
    the files under `folder_path` of the working tree at `root` that the repository's deferred
    commits not landed yet wrote, by name, with their text after the write. `None` is a file the
    write deleted. A later write of the same file wins. A commit whose hooks run is still pending
    until git is done: `land` keeps it in a `landing` map, dropped under the write lock (R8).
  - `read_feature` with `ReadFrom::Disk`: the step is the tip's with those texts on top, so a write
    still landing moves the step and a manual edit does not. The behaviour of `api::next_step`
    changes with it.
  - `binding.expectedStep` and `api::expected_step` are gone. `messageStep` reads `nextStep` always.
  - The write queue's `settled(keys)` callback, renamed `moved`, also runs when a write is queued,
    so `repositories.ts` publishes the feature at once.

- [x] **Step 1: Reproduce the approval that stayed "Needs you"**

In `vp run sandbox`, approve a spec whose commit waits behind the pre-commit hook, and watch the
sidebar, home, and the feature page. Then stop the server before the commit lands, and restart it.
Then make the hook refuse it. Write in the task's commit body which cause showed, and whether a
reload was needed after the commit landed. When neither the queued commit nor the refusal explains
what is seen, stop here and go back to the human with a new round, as the spec asks.

- [x] **Step 2: Write the failing tests**

```rust
// crates/core/tests/deferred.rs
#[test]
fn a_deferred_approval_moves_the_step_and_a_refusal_moves_it_back() {
    let repo = deferring(); // the example, with deferral on, and a hook that refuses on demand
    // the spec waits for review: the gate
    approve_spec(&repo); // api::review_approve, deferred
    // a status edited by hand in plan.md beside it is not read
    assert_eq!(next_step(&repo).step.name, "approval" /* or "plan" with no decision */);
    refuse_and_land(&repo);
    assert_eq!(next_step(&repo).step.name, "human-gate");
}
```

```ts
// packages/server/src/__tests__/queued-commits.test.ts, replacing
// "an approval still landing has the composer read the step it gives"
test("an approval still landing moves the feature's step at once", async () => {
  const { hook, host, server } = await heldServer();
  await approve(server);
  expect(await workspaceStep(server, FOLDER)).toBe("plan");
  expect(await approvalMessage(server)).toMatchObject({ refusal: null, step: "plan" });
  hook.release();
  await host.queue.idle();
  expect(await workspaceStep(server, FOLDER)).toBe("plan");
});
```

Add a case to `live.bench.ts`: from `review.approve` to the `Workspace` record's step read, with the
hook held. The spec's limit is 100 ms.

The break each test catches:

- Core: the step read from the disk, so the hand-edited `plan.md` moves it; or from the tip alone,
  so the approval does not.
- Server: the workspace's features read the tip only, so the card stays at the gate until the commit
  lands.

- [x] **Step 3: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test deferred` and
  `nix develop -c vp test packages/server/src/__tests__/queued-commits.test.ts`
- Expected: FAIL, the step reads `human-gate` while the approval is queued.

- [x] **Step 4: Implement**

`read_feature` overlays `deferred::pending` on the texts of the `at_tip` feature before computing
its step, built with `Feature::from_texts`, keeping `proposal_committed` and `decisions_pending`.
`decisions_pending` reads the decisions with the same overlay, so a queued approval of a spec whose
decisions are proposed reads `approval`. A repository that does not defer has no pending writes, so
`ura` is unchanged. The deferred writes already drop the cache when they are written, land, or are
put back, so no new invalidation is needed. Check it in the test. Delete `expected.rs` in the core
and the binding, and make `messageStep` read `nextStep`. Run
`nix develop -c vp run --filter uraeda-binding build`.

- [ ] **Step 5: Run the task's validation, and the benchmark**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c vp test bench --run packages/server/src/__tests__/live.bench.ts` (R9)
- Expected: PASS, and the approval's step read under 100 ms.

- [ ] **Step 6: Commit**

```bash
git add crates/core crates/binding packages/binding packages/server specs/2026-10-30-feature-state/plan.md
git commit -m "feat(feature-state): the step moves with the human's queued write"
```

## Task 2: The watcher re-watches a worktree, and reports within 1 second

**Files:**

- Modify: `crates/core/src/watch.rs` (`watch_folders`, the burst loop, the module comment)
- Test: `crates/core/tests/watch.rs`

**Interfaces:**

- Consumes: nothing.
- Produces: `watch::QUIET` stays 200 ms; a new `watch::LONGEST: Duration` of 1 second bounds a burst
  from its first event.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/watch.rs
#[test]
fn a_worktree_re_created_at_its_path_is_watched_again() {
    // start a watch on a repo with a feature worktree; remove the worktree, re-create it at the
    // same path; write an answer in it, uncommitted: the file is reported within 1 second (a
    // commit alone shows through git's refs, watched apart); then commit it: reported within 1 s
}

#[test]
fn a_burst_under_steady_writes_reports_within_a_second() {
    // a thread writes a file in the worktree's git folder, beside its index, every 100 ms for 3
    // seconds; a commit lands 1 second in; the feature is reported before the writes stop
}
```

The break each test catches:

- Re-created: a watched folder never forgotten, so its new inode is never watched.
- Steady writes: a burst that ends only after 200 ms of quiet, so the report waits for the writes to
  stop.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test watch`
- Expected: FAIL, both time out: no report within 1 second, and none while the writes go on.

- [x] **Step 3: Implement**

`watch_folders` forgets a watched folder that no longer exists, or whose file identity changed, and
watches it again once it exists. Unwatching a folder whose watch is already gone is not an error.
The burst loop ends after `QUIET` without an event, or `LONGEST` after its first event, whichever
comes first.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core/src/watch.rs crates/core/tests/watch.rs specs/2026-10-30-feature-state/plan.md
git commit -m "fix(feature-state): watch a re-created worktree, and report a burst within a second"
```

## Task 3: A line of Now started as a change leaves Now

**Files:**

- Modify: `crates/core/src/actions/start/typed.rs` (`Typed::read`'s title)
- Modify: `crates/core/src/actions/start/plan.rs` (`plan`, the typed origin)
- Modify: `crates/core/src/actions/start/mod.rs` (`Source::Text` and `run_text_with` gain the line;
  `run_text`, `ura`'s, passes `None`)
- Modify: `crates/core/src/api/start.rs` (`start_change`), `crates/binding/src/start.rs`, and
  `crates/core/tests/api.rs`, whose call passes `None`
- Modify: `packages/server/src/fate/change-starts.ts` (`change.start` takes `line`; a note's start
  passes none), and `packages/server/src/fate/session-moves.ts`, which passes none
- Modify: `packages/web/src/NewChangePage.tsx`, `packages/web/src/useStartFrom.ts`, and
  `packages/web/src/NewEntries.tsx` with `NewPage.tsx` (a composer's source keeps its text)
- Modify: `skills/uraeda/references/projects.md` (a change's start from a line)
- Test: `crates/core/tests/actions.rs`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `api::start_change(repo, text, images, slug, line: Option<&str>, on_step)`: `line` is the text
    of a line of **Now**, as the composer read it. The start finds the one line of **Now** with that
    text and no link, replaces it by the change's link at the top of **Now**, and takes its nested
    lines into the proposal, in the start commit. No such line, or several: the link is added, as
    for typed text, and the lines stay.
  - `binding.startChange(repo, text, images, slug, line, onStep)`, and `change.start`'s input
    `{ images?, line?: string, slug?, text }`.
  - The title of a typed start: as `Typed::read` cut it, now at its last whole word, with "…", so
    that it holds at most 80 characters.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/actions.rs
#[test]
fn a_start_from_a_line_of_now_replaces_it_by_its_link() {
    // PRIORITIES.md's Now holds "Amend the latest commit if the commit touches only workflow files
    // (proposals/notes)" with a nested line "- only when nothing was pushed"
    // start_change(text = that line, line = Some(that line))
    // the start commit's PRIORITIES.md: the link first in Now, and the line gone from Now;
    // the proposal holds the nested line
}
```

Rewrite the rows of `a_long_first_line_is_cut_for_the_title_and_kept_whole`: "Add ? in status, after
leader. It should show all shortcuts of the page and be searchable" gives "Add ? in status, after
leader. It should show all shortcuts of the page and be…". A first line of 100 characters without a
space gives its first 79 and "…". In `a_typed_text_starts_a_change`, the link it expects keeps
passing as written: a typed text with no `line` still adds one.

The break each test catches:

- Line: a start that finds the line by a position, or leaves it and adds a link.
- Title: a cut mid-word, or a title of 81 characters with the "…".

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test actions`
- Expected: FAIL, the line stays in **Now**, and the title ends "be s".

- [x] **Step 3: Implement**

In `plan`, a typed origin with a line found once uses `priorities::move_to_started`, as
`moved_proposal` does, and its nested lines go into the proposal's body, unless the typed text
already holds them. In `NewChangePage.tsx`, pass the first line source's text as `line`, and leave
it out of `takeOut`: the start commits its removal. Notes and other sources keep `takeOut`. In
`projects.md`, say that a change started from a line of **Now** replaces the line with its link, as
a feature's start does. Rebuild the binding.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates packages/binding packages/server packages/web skills/uraeda/references/projects.md specs/2026-10-30-feature-state/plan.md
git commit -m "fix(feature-state): a line of Now started as a change leaves Now"
```

## Task 4: A failed or stopped run asks until it is dismissed

**Risky:** It adds a column to the runner's cache, and changes when a session needs attention.

**Files:**

- Modify: `packages/server/src/runner/migrations.ts` (a migration adding `turns.dismissed_at`)
- Modify: `packages/server/src/runner/cache-rows.ts` (`TurnRow.dismissedAt`)
- Modify: `packages/server/src/runner/cache.ts` (`dismiss`; at 488 of 500 lines, first move a group
  of turn queries to a module of `runner/` in a `refactor` commit if it goes over)
- Modify: `packages/server/src/runner/status.ts` (`sessionStatus`, `StatusReason`)
- Modify: `packages/server/src/runner/sessions.ts` (`dismiss`, which emits the change; export
  `SERVER_STOPPED`; at 497 lines, move a method group out first if it goes over)
- Modify: `packages/server/src/fate/mutations.ts` (`session.dismiss`)
- Modify: `packages/server/src/fate/needs-you.ts` (`messageOf` for each attention reason)
- Test: `packages/server/src/runner/__tests__/status.test.ts`,
  `packages/server/src/__tests__/dismissed.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `TurnRow.dismissedAt: string | null`, stored as `turns.dismissed_at`, ISO time, as
    [the data model](data-model.md) says.
  - `SessionCache.dismiss(turn: number): boolean`: sets `dismissed_at` on a `failed` or `stopped`
    turn not dismissed yet; false for any other.
  - `Sessions.dismiss(repo: string, turn: number): void`: refuses a turn of another repository, and
    a turn `running` or `queued` ("refused: the run is still going"); emits the session's change.
  - `StatusReason` gains `"interrupted"`, a stop with the reason `SERVER_STOPPED`. `"stopped"` is a
    stop by the human.
  - `sessionStatus`: a failed or stopped latest turn with `dismissedAt` set no longer needs
    attention; the session reads its step's status, else "Idle".
  - The mutation `session.dismiss`, input `{ turn: string }`, answers the turn's `Session`.
  - Notification messages: failed "The run failed", stopped "You stopped the run", interrupted "The
    server stopped the run", halted "The run stopped before a gate".

- [x] **Step 1: Write the failing tests**

In `status.test.ts`, rewrite the rows of a failed and a stopped latest turn: not dismissed, they
read `attention` with reasons `failed`, `stopped`, and `interrupted` for the server's stop.
Dismissed, they read `idle`, or `needs-you` when the step waits on the human.

```ts
// packages/server/src/__tests__/dismissed.test.ts
test("a dismissed run stops asking, across a restart, and a new failure asks again", async () => {
  // a feature's session whose latest turn the server stopped: its row reads attention, interrupted
  // session.dismiss on a running turn of another session: refused
  // session.dismiss on the stopped turn: the row reads idle
  // a new server over the same cache folder: still idle
  // dismissing an older turn of a session whose new turn failed: the row still reads attention
});
```

The break each test catches:

- Rows: a dismissal ignored, or a stop by the server read as the human's.
- Restart: the dismissal kept in memory only, or a migration that drops the column's values.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/status.test.ts packages/server/src/__tests__/dismissed.test.ts`
- Expected: FAIL, `interrupted` is not a reason, and `session.dismiss` is not a mutation.

- [x] **Step 3: Implement**

A cache an older server made gains the column, empty, when the new server opens it; an older server
ignores it. Once the tests pass, remove the `dismissedAt` check in `sessionStatus`, see the restart
test fail, and restore it. Write what failed in the commit body.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-30-feature-state/plan.md
git commit -m "feat(feature-state): dismiss a failed or stopped run"
```

## Task 5: A pull request is ready only with the branch's work

**Risky:** It adds a step to the workflow's table, which `ura next`, the views, and the notifier
read.

**Files:**

- Modify: `crates/core/src/pulls.rs` (`PullRequestView.head`, merged pull requests, `parse`,
  `fetch`, `apply`)
- Modify: `crates/core/src/steps.rs` (`StepName::Push`, `PullRequest::Unpushed`,
  `after_the_last_step`, `finished_step`, `order`)
- Modify: `crates/core/src/git.rs` or its read module (an ancestry check through gix, if none fits)
- Modify: `crates/core/src/history/stages.rs` (Push is the pull request's stage)
- Modify: `packages/server/src/pulls.ts` (`push` polls), `packages/server/src/runner/message.ts`
  (`goal` for `push`)
- Test: `crates/core/tests/steps.rs`, `crates/core/tests/pulls.rs`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `gh` is asked `headRefOid` too, and once more for merged pull requests (`--state merged`,
    `headRefName,headRefOid,number,url`). `PullRequestView` gains `head: String`. `PullRequests`
    keeps the merged ones by branch.
  - `PullRequests::apply(&self, feature, git: &Git)`: an open, non-draft pull request whose head
    lacks the branch's latest commit is `PullRequest::Unpushed`. A head that is the tip, a
    descendant of it, or a commit not in the local repository is `Open`. A merged pull request whose
    head holds the branch's tip, with no open one, makes the feature `Step::done()`, at a step the
    pull request decides.
  - `StepName::Push`, `"push"`, waits on the agent, reference
    `skills/uraeda/references/implementation.md`, with `implemented: true`, ordered with
    `pull-request`.
  - `goal("push")`: work "Push the branch's commits to its pull request", stop "the pull request is
    ready for review".

- [x] **Step 1: Write the failing tests**

Add rows to `pull_request_rows`: an open pull request whose head is the parent of the branch's tip
reads `Push`, waiting on the agent. One whose head is a child of the tip, not fetched, reads
`PullRequest`, waiting on the human. In `pulls.rs`, a test parses a merged pull request whose head
is the branch's tip, and the feature's step reads `done`. The existing `open #31` row keeps passing:
its head is the tip.

The break each test catches:

- Push: an open pull request read as the review whatever the branch holds.
- Behind: a local branch behind its pull request read as Push.
- Merged: the merge seen only after a fetch.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test steps --test pulls`
- Expected: FAIL, the ahead row reads `PullRequest`.

- [x] **Step 3: Implement**

The ancestry check reads git through gix, in the core's git module. Rebuild the binding.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates packages/binding packages/server specs/2026-10-30-feature-state/plan.md
git commit -m "feat(feature-state): an open pull request lacking the branch's commits is the agent's Push"
```

## Task 6: One feature status, on the server

**Risky:** It replaces the rule every view and the notifier read.

**Files:**

- Create: `packages/server/src/fate/feature-status.ts`
- Modify: `packages/server/src/fate/sessions.ts` (move `featureStatuses` out; export `turnsOf` and
  `statusOf` for the new module; `featureRecord` adds `status`)
- Modify: `packages/server/src/fate/sources.ts` (`workspace` adds each feature's `status`)
- Modify: `packages/server/src/fate/views.ts` (`WorkspaceRecord` features and `FeatureRecord` gain
  `status`)
- Modify: `packages/server/src/fate/needs-you.ts` (read `featureStatuses`, key with the turn)
- Modify: `packages/server/src/fate.ts` (export `FeatureStatus` for the web)
- Test: `packages/server/src/__tests__/sessions.test.ts`

**Interfaces:**

- Consumes: Task 4's `StatusReason` and `sessionStatus`.
- Produces:

```ts
// packages/server/src/fate/feature-status.ts
/** A feature's status, which every view and the notifier read. */
export type FeatureStatus = {
  label: string;
  reason: StatusReason | null;
  /** The session it follows: a running one, else the latest; null without one. */
  session: string | null;
  status: SessionStatus;
  /** That session's latest turn, as an ID: what Dismiss names; null without one. */
  turn: string | null;
};
/** The rules of the Feature status decision, from the feature's step and its sessions. */
export function featureStatusOf(ctx: RepoContext, feature: FeatureView): Promise<FeatureStatus>;
/** Each feature in flight, with its status: the notifier's list. */
export function featureStatuses(
  ctx: RepoContext,
): Promise<Array<{ feature: FeatureView; status: FeatureStatus }>>;
```

The rules, in order: a session running or queued, the latest started first, gives "Working". A
feature with problems gives "Needs you". The latest session's own status comes next, which already
reads its step. Without a session, the step gives "Needs you" when it waits on the human, else
"Idle". Each workspace feature and each `Feature` record carries `status`, a missing feature `IDLE`.
A notification's key carries `status.turn`. `featureStatusOf` reads the repository's main checkout,
so it answers a promise (R12).

- [x] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/sessions.test.ts, replacing "a feature's status is its latest
// session's, raised by an older one blocked" and "an older session's failed run does not hold its
// feature". `statusesOf` reads the `Feature` record's status, and checks the workspace's equals it.
test("a running session makes its feature Working everywhere, then it follows its latest", async () => {
  const server = await testServer();
  const older = await folderSession(server, AGENT);
  const running = doneTurn(server, older.id, { state: "running" });
  const latest = await folderSession(server, AGENT);
  const stopped = doneTurn(server, latest.id, { reason: SERVER_STOPPED, state: "stopped" });
  // The latest session was stopped by the server; the older one still runs: Working, from it.
  expect(await statusesOf(server, AGENT)).toEqual({
    label: "Working", reason: null, session: older.id, status: "working", turn: String(running),
  });
  expect(await needsYouRow(server, AGENT)).toBeUndefined();
  // Its run ends: the feature follows its latest session, which asks until dismissed.
  server.sessions.cache.endTurn(running, { state: "done" });
  expect(await statusesOf(server, AGENT)).toMatchObject({
    reason: "interrupted", session: latest.id, status: "attention", turn: String(stopped),
  });
  expect(await needsYouRow(server, AGENT)).toMatchObject({ reason: "attention" });
});
test("an older session's blocked or failed run does not hold its feature", ...);
// US1.2 and US1.3, on the fixture's feature at its questions: needs you under the first turn's
// key, Working with no row while a run runs, then needs you under a new key once it ends.
test("a run at a gate reads Working, and its end notifies the gate under a new key", ...);
```

The break each test catches:

- A stopped older session ranked above a running one, as the sidebar did.
- The notifier and the views reading different rules.
- The same notification key before and after a run, so it never fires again.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/__tests__/sessions.test.ts`
- Expected: FAIL, the `Feature` record has no `status`.

- [x] **Step 3: Implement**

`fate/sessions.ts` must end under 500 lines. Once the test passes, rank the latest session above a
running older one, see it fail, and restore it. Write what failed in the commit body.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-30-feature-state/plan.md
git commit -m "feat(feature-state): one feature status on the server"
```

## Task 7: Progress counts tasks built in parallel

**Files:**

- Modify: `crates/core/src/steps.rs` (`TaskProgress`, `feature_step`)
- Modify: `crates/core/src/workspace/branches.rs` or a new `workspace/tasks.rs` (the task branches'
  plans), and `crates/core/src/workspace.rs` (the `Feature` field only; it may not grow, so the read
  goes in the module)
- Modify: the readers of `progress.position`: `packages/web/src/sidebar/ItemCard.tsx`,
  `SessionAnnouncer.tsx`, `feature/next.ts`, `feature/SessionsPane.tsx`, `feature/Timeline.tsx`,
  `session/PlanProgress.tsx`, `sidebar/FeatureState.stories.tsx`, and their tests
- Test: `crates/core/tests/steps.rs`, `crates/core/tests/workspace.rs`

**Interfaces:**

- Consumes: Task 5's `steps.rs`.
- Produces:
  - `TaskProgress { done: u32, total: u32, title: String }`: `done` replaces `position`. It is the
    number of tasks whose boxes are all checked at the tip or on a local task branch of the
    feature's branch, `<branch>-task-N`, where the task with the same number and title has every box
    checked. `title` is the first task not done anywhere. `Step::task` names it too.
  - `Feature::task_branch_done: BTreeSet<(u32, String)>`: the tasks, by number and title, done on
    the task branches, read with the feature in the workspace read.
  - The card's progress reads `${done}/${total}`, named `${done} of ${total} tasks done`.

- [ ] **Step 1: Write the failing tests**

Rewrite `implementation_progress`'s rows from positions to counts: "11 tasks, the first 6 done"
gives `done: 6` with the title "Session column"; "tasks finished out of order" gives `done: 1` with
the title "One". In `workspace.rs`, add a row: a plan of 20 tasks, 12 checked on the feature branch,
task branches `-task-14` and `-task-15` with their boxes checked, `-task-16` with half, and a
`-task-21` the plan lacks, reads `done: 14`.

The break each test catches:

- Task branches ignored, so the wave reads 12.
- A half-done branch counted, or a task counted twice when both its branch and the tip hold it.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test steps --test workspace`
- Expected: FAIL, `TaskProgress` has no field `done`.

- [ ] **Step 3: Implement**

The task branches' plans are read from their tips through the core's git module, and kept with the
workspace read in the core's cache. A branch moving already drops it, as it watches `refs/`. Rebuild
the binding.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates packages/binding packages/web specs/2026-10-30-feature-state/plan.md
git commit -m "feat(feature-state): progress counts the tasks done on their task branches"
```

## Task 8: The skill and the docs gain the Push step

**Files:**

- Modify: `skills/uraeda/SKILL.md` (the step table's Push row, before the pull request's gate, and
  the same row for a finished feature)
- Modify: `skills/uraeda/references/implementation.md` (a "Push" section: what to push, with
  `git push`, never `--force`, and that the pull request waits for review again)
- Modify: `skills/uraeda/references/cli.md` (`ura next` names Push), and the templates or example
  files that copy the table, if any
- Modify: `docs/web-ui.md` (Dismiss, and a feature reading Working while any session runs),
  `docs/cli.md` (`ura next` and Push)
- Test: `crates/cli/tests/next.rs`

**Interfaces:**

- Consumes: Task 5's `StepName::Push`.
- Produces: the skill's table row "An open pull request lacks the branch's latest commits →
  Implementation, push", linking the push section this task writes in
  [Implementation](/skills/uraeda/references/implementation.md).

- [ ] **Step 1: Write the failing test**

A row of `crates/cli/tests/next.rs`: a feature whose open pull request's head is the parent of the
branch's tip prints the Push step and the implementation's reference.

- Break: `ura next` still printing the human gate.

- [ ] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-cli --test next`
- Expected: FAIL, unless task 5's step already prints it. Then the row guards it, and passes.

- [ ] **Step 3: Write the skill and the docs**

Follow the [writing rules](/skills/uraeda/references/writing.md). Read the example before changing a
template.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS, `specs:check` included.

- [ ] **Step 5: Commit**

```bash
git add skills docs crates/cli/tests/next.rs specs/2026-10-30-feature-state/plan.md
git commit -m "docs(feature-state): the Push step, in the skill and the docs"
```

## Task 9: Every view reads the feature's status

**Files:**

- Start from: `packages/web/src/sidebar/FeatureState.stories.tsx#NeedsAttention` and
  `#SessionBanners`
- Modify: `packages/server/package.json` (export `./status`, `runner/status.ts`, for the ranks)
- Modify: `packages/web/src/sidebar/cards.ts` (drop `STATUS_ORDER` and `featureStatus`; read
  `feature.status`; gate labels without "ready" while working; `push`)
- Modify: `packages/web/src/sidebar/entries.ts` (the row of `feature.status.session`; a running
  session of a feature not in flight is a session card)
- Modify: `packages/web/src/home/features.ts`, `packages/web/src/home/Core.tsx` (columns by the
  status)
- Modify: `packages/web/src/feature/next.ts`, `packages/web/src/feature/FeaturePage.tsx` (working
  from the status, at any step; the running session's link)
- Modify: `packages/web/src/sidebar/ItemCard.tsx` (Dismiss at the end of the first line, for a
  failed, stopped, or interrupted status)
- Modify: `packages/web/src/SessionAttention.tsx` (the banners' texts, `interrupted`, Dismiss)
- Modify: `packages/web/src/labels.ts` (`push`)
- Modify: `packages/web/src/sidebar/FeatureState.stories.tsx` (the card's own Dismiss)
- Test: `packages/web/src/__tests__/entries.test.ts`, `cards.test.ts` (their rows follow the new
  fields)

**Interfaces:**

- Consumes: Task 6's `FeatureStatus` on each workspace feature and `Feature` record; Task 4's
  `session.dismiss` and `"interrupted"`; Task 5's `push` step; Task 7's `progress.done`.
- Produces: nothing other tasks read.

- [ ] **Step 1: Make the views read the status**

The card's status, pane, and order come from `feature.status`. Home's Needs you lists the features
whose status needs the human, and In progress the others, problems apart. The feature page's "Next"
says the agent works, with a link to `status.session`, whenever the status is Working, even at a
gate or an open pull request. Dismiss on the card and the banner calls `session.dismiss` with
`status.turn`, or the session's latest turn; a refusal shows next to it.

- [ ] **Step 2: Run the web's tests and fix the rows that read the old fields**

- Run: `nix develop -c vp test packages/web`
- Expected: PASS, after `entries.test.ts` and `cards.test.ts` build their features with `status`.
  Rows that asserted the old first-row pick are replaced behaviour, listed in the spec.

- [ ] **Step 3: Review the views in the sandbox**

Run `vp run sandbox`. Check every story's state on the real app, in both themes, at a phone's and a
desktop's width. Check a running session on a merged feature, a stopped run and its Dismiss in two
tabs, a pull request with an agent at work, and progress in a wave. Check SC-004 in each sample
project: no running session is missing from the sidebar.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/package.json packages/web specs/2026-10-30-feature-state/plan.md
git commit -m "feat(feature-state): every view reads the feature's status"
```
