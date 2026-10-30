---
status: auto-approved
spec-revision: 1
---

# Plan: Performance pass

**Goal:** every page and key answers within 100 ms from caches on the server and in the browser,
writes show their result at once, commits land in order behind a toast, and starting a feature never
makes the human wait.

**Architecture:** the core keeps each watched repository's workspace between reads. The watcher's
file events and every write invalidate it, and a generation counter keeps a read that raced a change
from being stored. In the server, a commit splits in two. The core writes the files at once and
defers the commit, and the server's write queue lands the deferred commits one after another, per
repository. It publishes them as one live record, `WriteQueue`. A hook's refusal undoes the files
the write left, and stays in the record with its output. The start answers once the core has planned
it, and the queue runs it, its steps and the hook's output in the same record. A message sent
meanwhile waits for it in the runner. The browser keeps every page it read, reads the selected row's
page ahead, and gives every file write fate's `optimistic` result. Pages load as chunks. A benchmark
drives the sandbox on a release build. See the [spec's architecture](spec.md#architecture).

Ownership:

- **The core** owns freshness ([`cache.rs`](/crates/core/src/cache.rs), new), deferral and undo
  ([`actions/deferred.rs`](/crates/core/src/actions/deferred.rs), new), and the start's plan and its
  restore on a refusal ([`actions/start/`](/crates/core/src/actions/start/)). The CLI never turns
  deferral on, so `ura` commits as today.
- **The server** owns the order of git writes and their record
  ([`packages/server/src/writes/`](/packages/server/src/writes/), new), and the message queued for a
  start (the runner).
- **The web UI** owns only what it shows: optimistic results, which fate rolls back on a refusal,
  and the toast and the start's steps, drawn from the server's record. It never decides a write's
  order or its outcome.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name. Each gets a test,
or a row of one, in the task that owns the code.

1. **A read that runs while a write changes the files** never stores its stale workspace as fresh:
   the next read sees the write. Task 3.
2. **A refused commit whose file a later write changed** keeps the later text: undo only puts back a
   path that still holds what the refused write left. Task 7.
3. **Two writes whose commits touch the same file**: the second write's files wait for the first
   commit to land, so each commit holds only its own write. Task 12.
4. **A start whose slug another start already planned** is refused at once, with the spec's message,
   not when its commit runs. Task 13.
5. **A message queued for a start, then the server stops**: nothing is sent, and the proposal stays
   where it was or the feature is made without its agent; no message is sent twice. Task 13.
6. **The repository list's watcher stops** (a repository removed): its cache entry goes, and reads
   go back to reading git. Task 3.

## Global constraints

Every task's requirements include these.

From the spec, word for word:

- "Every page draws within 100 ms, reloads within a second. Nothing shows a loading state." (US1)
- "A commit shows its result at once and takes the human where it leads. A glass toast at the bottom
  right says what is still landing, and the next commits wait their turn behind it." (US3)
- "The read cache, in the core, keeps each repository's workspace between calls. The watcher's
  changes drop what changed, and a write refreshes it before it answers. It owns freshness: no read
  answers from data older than the last change the watcher saw."
- "The write queue, in the server, runs each repository's git writes one after another, in order. It
  publishes them as one live record, each running, waiting, or refused, with the hook's output
  streamed from the core. The core's write lock becomes one per repository."
- The toast's copy, from [`CommitToast.tsx`](/packages/web/src/writes/CommitToast.tsx): "A hook
  refused the commit: what it showed is back as it was." The start's, from
  [`StartSteps.tsx`](/packages/web/src/session/StartSteps.tsx): "Nothing was committed: your
  proposal is in its file, as you left it." "Your message is queued: the agent starts with it once
  the steps end." The slug's refusal: "A feature named performance-pass exists already".
- The toast "sits where the leader menu rises, over the status line, and the open menu covers it. On
  the phone, it sits over the bottom bar, across the screen's width."
- "The tab coming back to the foreground still reads its pages again, now from the server's cache."

From [Performance](../decisions/performance.md):

- The server MUST answer reads from what it already read, reading git again only for what changed
  since. Checked by the core's tests.
- The browser MUST keep the data of the pages it has shown, and read the page of the selected row
  ahead, so a key reaches it as fast as a click. Checked by review.
- A benchmark over the sandbox's projects MUST measure the target's pages and actions on demand, and
  a development build MUST warn when an interaction passes 100 ms. Checked by the benchmark's run in
  each feature's review.
- Every navigation and every action SHOULD draw its result within 100 ms, and a reload within 1
  second, on a release build serving a repository the size of Uraeda's own. Checked by the
  benchmark.
- A page SHOULD NOT show a loading state: what it shows comes from what the server and the browser
  already hold. Checked by review and the benchmark.
- A commit's hooks and an agent's work MAY take longer than the target, as long as their progress
  shows. Checked by review.

From [UI behaviour](../decisions/ui-behaviour.md):

- Status MUST show next to what it concerns, and an error MUST stay there until dealt with, never
  only in a toast. Checked by review.
- A write MUST show its result at once and take the human where it leads, and a refused write MUST
  put back what it showed and say why next to what it concerns. Checked by review.
- A git write MUST show its progress in a toast until it lands, and git writes MUST land one after
  another, in the order they were made, without blocking the human. Checked by review.
- Back and reload MUST keep the human's place and what they were reading. Checked by review.
- Every action MUST work by tap and by keyboard, never by hover alone. Checked by review.

From [Stack](../decisions/stack.md):

- Workflow logic, parsing, validation, and states MUST live in the Rust core, and TypeScript MUST
  reach them only through the binding, never reimplemented. Checked by review.
- The CLI MUST be Rust needing no runtime, the server TypeScript on Node, and the web UI React with
  Astryx, fed only by the server through fate. Checked by review.

From [Git](../decisions/git.md):

- Tools MUST NOT lose the user's work: they never force-remove a worktree, force-push, or delete a
  branch the default branch lacks, and remove or delete anything only when a human asks. Checked by
  the core's tests.
- Tools MUST NOT bypass the user's hooks, signing, or credentials, and MUST NOT switch the user's
  checkout unless the human asks. Checked by the core's tests and review.
- Rust tools MUST read git with gix and run the system `git` for writes, through one core module.
  Checked by review.

From [UI look](../decisions/ui-look.md): what floats over the page, such as the phone's bottom bars
or the leader menu, SHOULD be frosted glass: a light tint of its own, what is behind it blurred, and
square corners.

From [Toolchain](../decisions/toolchain.md): the web UI MUST be compiled by React Compiler, and new
code SHOULD NOT memoize by hand for speed. After every task, fast MUST check formatting, lint,
types, affected focused tests and boundary checks, and name broader checks deferred to ready. Rust
tests MUST run under cargo-nextest. Test runners MUST NOT retry a failed test.

From [Code quality](../decisions/code-quality.md): Rust and TypeScript functions and files MUST stay
within limits on length, parameters, and nesting (500 lines a file, 100 a function, 7 parameters in
TypeScript; clippy's in Rust), and a new marker MUST NOT be added unless a human approves it in the
plan. Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.
Files near their limit that tasks touch: [`api.rs`](/crates/core/src/api.rs) (449 lines),
[`binding/src/lib.rs`](/crates/binding/src/lib.rs) (412), [`data.ts`](/packages/web/src/data.ts)
(456), [`App.tsx`](/packages/web/src/App.tsx) (431), and
[`fate/mutations.ts`](/packages/server/src/fate/mutations.ts) (440): new code goes in new modules.

From [Testing](../decisions/testing.md), at the `early` stage: a test of the web UI MUST guard
behaviour that is costly to lose and that using the UI would not show, such as unsaved text or a git
write. A test that guards behaviour the spec replaces is removed in the task that changes the
behaviour.

Existing guarantees to preserve:

- `ura` and every core call made without the server's deferral commit as today: a hook's refusal
  keeps the files written and returns its output. Guarded by
  [`a_refused_commit_keeps_the_answers_and_can_be_tried_again`](/crates/core/tests/actions.rs) and
  the other refusal tests of [`actions.rs`](/crates/core/tests/actions.rs).
- The watcher reports what changed, as [`crates/core/tests/watch.rs`](/crates/core/tests/watch.rs)
  checks.
- A file write over a version changed elsewhere is refused as `conflict:`: the writes' hashes stay.

## Code read

- [`crates/core/src/api.rs`](/crates/core/src/api.rs): `open` and `read_workspace` call
  `Workspace::read` on every call; one global `WRITES` mutex, `write_lock()`, taken by 79 calls in
  `api/` and `api.rs`. `checked` runs `ura check` on each feature read from disk, per read.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs): its `snapshot` reads the whole workspace
  after 200 ms without events; it watches `specs/` of every worktree, each worktree's top level, and
  git's common directory, its `refs/` and `worktrees/`, which hold everything a read depends on.
  Tested in [`crates/core/tests/watch.rs`](/crates/core/tests/watch.rs) with `watching` and `next`.
- [`crates/core/src/workspace/read.rs`](/crates/core/src/workspace/read.rs) `folder_uncommitted`: a
  gix status per checked-out feature, the slow part after a fresh worktree.
- [`crates/core/src/actions/commit.rs`](/crates/core/src/actions/commit.rs) `commit` and
  `commit_only`: the one place every committing action ends (answers, verdicts, text, priorities,
  inbox, drop, changes, default rounds). A hook's refusal is
  `ActionError::Hook { message, output }`, `hook:` at the binding. The start and the promotion
  commit through `Git::commit` directly.
- [`crates/core/src/git/process.rs`](/crates/core/src/git/process.rs) `run`: `Command::output`, so
  the hook's output arrives only at the end.
- [`crates/core/src/actions/start/`](/crates/core/src/actions/start/): `Start::run` calls
  `self.plan(slug, today)` first, which checks everything before writing, then moves the proposal,
  `commit_start`, and `create_branch` (`git worktree prune` and `add`,
  [`git.rs`](/crates/core/src/git.rs) `add_worktree_new`). A refused commit returns
  `StartError::Partial`, the move left written.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): every function a `job` on libuv's pool;
  `watch` passes a `ThreadsafeFunction`, the pattern for a streamed callback.
- [`packages/server/src/fate.ts`](/packages/server/src/fate.ts) `liveBus`: every `listen` sends an
  update at once. fate 1.12.1's `createLiveEventBus` keeps no version, so the bus itself must know
  what changed.
- [`packages/server/src/live.ts`](/packages/server/src/live.ts) `publish`: each watcher change sends
  the workspace, the needs-you list, and each changed feature's records.
- [`packages/server/src/fate/mutations.ts`](/packages/server/src/fate/mutations.ts),
  [`file-mutations.ts`](/packages/server/src/fate/file-mutations.ts),
  [`inbox-mutations.ts`](/packages/server/src/fate/inbox-mutations.ts): the committing mutations are
  `review.approve`, `review.requestChanges`, `answers.submit`, `defaultRound.submit`,
  `commit.retry`, `defaultRound.retry`, `text.commit`, `priorities.commit`, `changes.commit`,
  `feature.drop`, `feature.start`, `change.start`, `feature.promote`, and the inbox's commits
  (`inbox.remove` and its undos). `feature.start` awaits `startFeature`, then reads the feature.
- [`packages/server/src/__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts):
  `testApp`, `mutate(app, name, input, select)`, `byId`, and
  [`live-stream.ts`](/packages/server/src/__tests__/live-stream.ts) for a live stream.
- [`packages/web/src/clients.ts`](/packages/web/src/clients.ts): `createFateClient` without
  `gcReleaseBufferSize`. [`data.ts`](/packages/web/src/data.ts): `readPriorities`, `readInbox`, and
  `rereadChanges` read `network-only` around writes; `useRefreshOnShow` reads again on show.
- [`packages/web/src/writes/store.ts`](/packages/web/src/writes/store.ts), `WriteButton`,
  `useOwnWrite`: one git write at a time, the others blocked, the card's action. Used by
  `useStartFrom.ts`, `Shell.tsx`, `CommitActions.tsx`, `useComposerSend.ts`, `CommitPage.tsx`,
  `NewChangePage.tsx`, `OfferCard.tsx`, `ProposalStart.tsx`, `dropItem.ts`, `RoundSubmit.tsx`,
  `layout/useUndoToast.ts`, `lists/useWritesInTurn.ts`, `lists/useOutline.tsx`, and
  `sidebar/Cards.tsx`. Its tests: [`writes-store.test.tsx`](/packages/web/src/__tests__/).
- [`CommitToast.tsx`](/packages/web/src/writes/CommitToast.tsx) and
  [`StartSteps.tsx`](/packages/web/src/session/StartSteps.tsx): the spec's mockups, real components
  with their stories, the starting point of tasks 14 and 15.
- The start's path: [`useStartFrom.ts`](/packages/web/src/useStartFrom.ts) (4 to 5 calls),
  [`useEditorActions.ts`](/packages/web/src/useEditorActions.ts) (`feature.start`, then navigates),
  [`ProposalStart.tsx`](/packages/web/src/ProposalStart.tsx),
  [`HandOver.tsx`](/packages/web/src/HandOver.tsx) (`?continue=<trigger>`),
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx).
- The web UI calls about 90 mutations, `fate.mutations.<name>(...)`, across `packages/web/src/`.
- The sandbox ([`packages/web/sandbox/`](/packages/web/sandbox/)): sample projects `sample`,
  `realistic`, `broken`, `empty`, built by `seed`; Playwright 1.63 is installed for the screenshot
  scripts in [`packages/web/scripts/`](/packages/web/scripts/).
- Validation: `vp run fast` after each task, `vp run ready` before the push; Rust tests through
  `nix develop -c cargo nextest run -p uraeda-core`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

The read cache and the write queue live in memory only: principle III allows caches, and a commit
the queue never ran stays as files written in git's working tree, which the commit page lists.

## Complexity tracking

| Abstraction or exception                            | Why it is needed                                                                                                       | Simpler alternative rejected because                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `cache.rs`, the per-repository read cache           | the Performance decision's MUST, and the only way under 100 ms (discovery)                                             | a cache in the server would duplicate the core's freshness rule in TypeScript, against the stack decision |
| `actions/deferred.rs`, deferred commits and undo    | the spec's high edge cases: a queued commit's files stay written if the server stops, and a hook's refusal undoes them | queuing the whole call writes nothing until its turn, so a reload or a stop loses what the page showed    |
| `packages/server/src/writes/`, the write queue      | the spec's queue, in order, across tabs                                                                                | a queue in the browser cannot be shared by two tabs, nor survive a reload                                 |
| `WriteQueue`, a live record                         | the toast and the start's steps read the same record in every tab                                                      | per-mutation results end with the request, so a reload loses the toast                                    |
| `process::run_streaming`, git's output line by line | the start's steps show the hook's output as it comes                                                                   | `Command::output` returns it only at the end                                                              |
| `useWriteQueue` and `useRefusal`, web hooks         | every page that shows a refusal where it happened reads the same record                                                | each page reading the record itself would copy the matching of a refusal to its file                      |
| The benchmark script                                | the Performance decision's MUST                                                                                        | a unit test of timings is forbidden by the code quality decision                                          |

## Test map

The core's tests run on temporary repositories built with `TestRepo`, with real git and its hooks
(`set_hook`), and a real watcher. The server's run `testApp` over a temporary repository, the real
binding, and a fake agent. The web's few tests render with the existing helpers of
`packages/web/src/__tests__/helpers.tsx` against a fake fate client. Timings are checked only by the
benchmark (task 16), never a unit test. New tests: 15, against 17 allowed (14 key scenarios and 3
high edge cases).

| Spec                                                                                         | Task | Test                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| US1 1, 2, 3, more 1; SC-001, SC-002, SC-006                                                  | 16   | the benchmark's pages, keys, and reloads                                                                                    |
| US1 more 2; edge: changes outside Uraeda; SC-005                                             | 3    | `crates/core/tests/cache.rs`: "a change made outside shows on the next read once the watcher saw it"                        |
| Review focus: a read that raced a write; the watcher stops                                   | 3    | `cache.rs`: "a read racing a write never keeps the old workspace", "without a watch, every read reads git"                  |
| SC-006 (fresh worktree), outside behaviour                                                   | 1    | the check recorded in `rulings.md`, then the benchmark (task 16)                                                            |
| US2 1, 2 (optimistic results); outside behaviour of fate's rollback                          | 2    | `packages/web/src/__tests__/optimistic.test.tsx`: "an optimistic insert survives a live refresh, and rolls back on refusal" |
| US2 3 (a message shows at once)                                                              | 10   | none: an optimistic result the human sees; the benchmark times it                                                           |
| US2 more 1 (stale save retried once)                                                         | 5    | `packages/web/src/__tests__/fresh-base.test.ts`: "a write refused as a conflict reads again and retries once"               |
| US2 more 2 (refused move back with its refusal)                                              | 9    | none: fate's rollback, checked by task 2; the refusal's row is the outliners' existing behaviour                            |
| US3 1 (approve shows Approved, toast)                                                        | 12   | `packages/server/src/__tests__/write-queue.test.ts`: "a commit answers with its written files, then lands in the queue"     |
| US3 2 (the next commit waits); edge: a refused write, then the next one                      | 12   | `write-queue.test.ts`: "writes land in order, and a refused one does not stop the next"                                     |
| US3 3, more 2 (refusal undone, output where it happened); edge: hook refuses after moving on | 7    | `crates/core/tests/deferred.rs`: "a refused deferred commit puts back what its write left, with the hook's output"          |
| Review focus: a refused commit whose file changed since                                      | 7    | `deferred.rs`: row of the test above                                                                                        |
| Review focus: two writes on one file                                                         | 12   | `write-queue.test.ts`: row of "writes land in order"                                                                        |
| US3 3 (the verdict's place shows the output)                                                 | 14   | `packages/web/src/__tests__/commit-toast.test.tsx`: "a refused commit shows its output on its file and in the toast"        |
| US3 more 1 (two tabs, one toast); edge: reload with commits queued                           | 12   | `write-queue.test.ts`: row: the record read by a second client                                                              |
| Edge: the server stops with commits queued                                                   | 7    | `deferred.rs`: "a deferred commit never landed leaves its files written, uncommitted"                                       |
| US4 1 (New page in one request)                                                              | 8    | `crates/core/tests/proposal.rs`: "a drafted proposal writes its line and its file in one call"                              |
| US4 2 (session at once, steps run)                                                           | 13   | `packages/server/src/__tests__/start-queue.test.ts`: "a start answers once planned, then runs its steps"                    |
| US4 3 (message queued, agent starts after)                                                   | 13   | `start-queue.test.ts`: "a message sent during a start waits, then starts the agent"                                         |
| US4 more 1 (start refused by a hook); review focus: server stops with a queued message       | 11   | `crates/core/tests/actions.rs`: "a start refused by a hook puts the proposal back, nothing committed"                       |
| US4 more 1 (message back in the composer)                                                    | 13   | `start-queue.test.ts`: row of "a message sent during a start waits"                                                         |
| Review focus: a slug planned twice; edge: slug taken                                         | 13   | `start-queue.test.ts`: row of "a start answers once planned"                                                                |
| US4 more 2 (Ctrl+Enter and Enter start the same way)                                         | 15   | none: one code path, `useStart`, shared by the three; the human checks it in the sandbox                                    |
| Edge: the human leaves the session while its start runs                                      | 13   | none: the queue runs in the server, apart from any page                                                                     |
| Edge: two tabs save the same file                                                            | 5    | row of "a write refused as a conflict reads again"                                                                          |
| Edge: the start refused, slug taken                                                          | 13   | row of "a start answers once planned"                                                                                       |
| Edge: a page over 100 ms; US5 2                                                              | 6    | none: a development warning, read by the human; the benchmark (task 16) checks the pages                                    |
| US5 1; SC-003, SC-004                                                                        | 16   | the benchmark's actions                                                                                                     |
| Live updates resolved once                                                                   | 4    | `packages/server/src/__tests__/live.test.ts`: "a subscription made with nothing changed gets no update"                     |
| Error: the start's slug planned, then taken before its turn                                  | 13   | row of "a start answers once planned": its steps show the refusal                                                           |

Tests removed, as the spec's [replaced behaviour](spec.md#replaced-behaviour) lists, in task 14:
`writes-store.test.tsx`'s "a write started during another one keeps the bar until it ends", "a
commit shows on its card while it runs, then 10 seconds at most", "the server's status for the item
ends the action", "a failed write shows the server's status again at once", and "a write that fails
after the server's status changed never shows its action again"; and in task 15, `editor.test.tsx`'s
"Start saves the text typed, then starts the feature from it (US2 4)", rewritten to the new start.
Through the server, a refused commit no longer keeps its files written: see ruling R2.

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1 and 2: the spec's two unverified outside behaviours, one in the core's git, one in the
   web UI's fate; checked first, as a failure stops the build.
2. Tasks 3, 4, 5, and 6: the core's cache, the server's live bus and timing header, the browser's
   cache, and the pages' chunks; four separate parts: the core, the server's `fate.ts` and `app.ts`,
   the web's data layer and lists, and its `App.tsx` and `routes.tsx`.
3. Tasks 7, 8, 9, and 10: deferred commits in the core and the binding, the one-request draft and
   the cards' changes, and the optimistic results in two halves of the web UI's call sites. Tasks 7
   and 8 each add their own module to `crates/binding/src/` and a line to its `lib.rs`.
4. Tasks 11 and 12: the start's plan and steps in the core, and the server's write queue.
5. Tasks 13 and 14: the start through the queue in the server, and the toast in the web UI.
6. Task 15: the start's flow in the web UI, on tasks 13 and 14.
7. Task 16: the benchmark, on everything.

---

## Task 1: Refresh a new worktree's index, once checked

**Files:**

- Modify: `crates/core/src/git.rs` (`add_worktree_new`)
- Modify: `specs/2026-10-29-performance-pass/rulings.md` (the check's result)

**Interfaces:**

- Produces: `Git::add_worktree_new` leaves the new worktree's index refreshed, as `git status` would
  leave it.

- [ ] **Step 1: Measure the slow reads, before the change**

On a clone of this repository outside it (`git clone . /tmp/uraeda-check`), with a release build of
the binding, time `readWorkspace` (median of 5) before and right after
`git worktree add .worktrees/check-1 -b check-1`, then after
`git -C .worktrees/check-1 update-index -q --refresh`. Keep the script outside the repository.

- Expected: the read after `worktree add` is slower than before by about 10 ms in release, about 3 s
  in debug, and back to the first time after the refresh.

- [ ] **Step 2: If the refresh does not end the slow reads, stop**

The spec marks this unverified. If the read after the refresh is still slower by over 5 ms in a
release build, stop the build here and start a new round of questions with the measures: the stories
relying on SC-006 need the human's choice.

- [ ] **Step 3: Implement the refresh**

After `git worktree add`, run `git update-index -q --refresh` in the new worktree, through the same
`run` as the other git writes. A failure of the refresh is ignored: it only costs speed.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`, then `nix develop -c cargo nextest run -p uraeda-core`
- Expected: PASS. Deferred to ready: the whole TypeScript suite.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/git.rs specs/2026-10-29-performance-pass/rulings.md
git commit -m "feat(performance-pass): a new worktree's index is refreshed, so reads stop rehashing it"
```

## Task 2: Upgrade fate, and check its optimistic rollback through live refreshes

**Files:**

- Modify: `pnpm-workspace.yaml` (fate's catalog entry), `pnpm-lock.yaml`
- Test: `packages/web/src/__tests__/optimistic.test.tsx`

**Interfaces:**

- Produces: fate at its latest 1.x release, at least 1.12.2, whose `optimistic` results later tasks
  use.

- [ ] **Step 1: Write the failing test, through the real fate client**

```ts
// packages/web/src/__tests__/optimistic.test.tsx
test("an optimistic insert survives a live refresh, and rolls back on refusal", async () => {
  // A fate client over a server whose `inbox.add` waits until released; a live update of the
  // Inbox record arrives while it waits. The inserted note stays shown; then a refused add takes
  // it back out, the list as before.
});
```

The break it catches: an optimistic insertion that disappears during a background refresh, the bug
1.12.2 fixed; a rollback that leaves the note.

- [ ] **Step 2: Run it to check it fails on 1.12.1**

- Run: `vp test packages/web/src/__tests__/optimistic.test.tsx`
- Expected: FAIL, the inserted note gone after the live update.

- [ ] **Step 3: Upgrade fate**

Raise `@nkzw/fate` and `react-fate` to their latest release, run `vp install`, and fix what the
upgrade changes in the types.

- [ ] **Step 4: If the test still fails, stop**

The spec marks this unverified. A failure means optimistic results cannot be trusted under live
updates: stop and start a new round of questions.

- [ ] **Step 5: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS. Deferred to ready: the Storybook build and the whole suite.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/web/src/__tests__/optimistic.test.tsx
git commit -m "chore(performance-pass): upgrade fate, whose optimistic inserts survive live refreshes"
```

## Task 3: The core's read cache, and one write lock per repository

**Risky:** a cache that misses a change shows stale data, and the lock serializes every write.

**Files:**

- Create: `crates/core/src/cache.rs`
- Modify: `crates/core/src/api.rs` (`open`, `read_workspace`, `write_lock`), every `write_lock()`
  call in `crates/core/src/api/` and `api.rs`, `crates/core/src/watch.rs` (`watch`, `snapshot`),
  `crates/core/src/lib.rs`
- Test: `crates/core/tests/cache.rs`

**Interfaces:**

- Produces:
  - `pub(crate) fn write_lock(repo: &Path) -> WriteGuard`: one lock per repository, keyed by its
    main checkout. Dropping the guard invalidates that repository's cache.
  - `pub(crate) fn open(repo: &Path) -> Result<(Git, Arc<Workspace>)>`: callers keep using
    `&workspace`.
  - `pub fn cache_stats(repo: &Path) -> CacheStats { reads: u64, hits: u64 }`, `#[napi(object)]`:
    the reads of git and the answers from memory since the watch started, for the tests and the
    server's `Server-Timing`.
  - `watch::watch` enables the cache of its repository while the returned `Watcher` lives.

- [ ] **Step 1: Write the failing tests**

```rust
// crates/core/tests/cache.rs
#[test]
fn a_change_made_outside_shows_on_the_next_read_once_the_watcher_saw_it() {
    // A watch runs; two reads, the second from memory (`cache_stats` hits 1). An answer written
    // in the feature's file; once the watcher reports it, `read_file` returns the new text.
}

#[test]
fn a_read_racing_a_write_never_keeps_the_old_workspace() {
    // A watch runs. A write (save an answer) runs while a read is held between reading git and
    // storing, through a test hook of the cache; the next read returns the written answer.
}

#[test]
fn without_a_watch_every_read_reads_git() {
    // No watch: two reads, `cache_stats` hits 0; a file changed between them shows at once.
}
```

The break each catches: a cache never invalidated by the watcher; a read storing what it read after
a write invalidated it (no generation check); the CLI answering from a cache nobody invalidates.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test cache`
- Expected: FAIL, `cache_stats` not found.

- [ ] **Step 3: Implement the cache**

In `cache.rs`, one entry per repository, keyed by the main checkout's path, present only while a
watch runs. An entry holds a generation, bumped by every invalidation, and the last workspace read
with the generation it was read at. A read takes the generation, reads git when the entry holds no
workspace at that generation, and stores what it read only if the generation did not move meanwhile.
The watcher invalidates on each raw file event, before its 200 ms debounce, so a read never answers
from before a change it saw. The write guard invalidates when dropped. `read_workspace`'s `checked`
problems and its priorities' hash go into the entry with the workspace. The watcher's `snapshot`
reads through the cache too. Keep `api.rs` under 500 lines.

- [ ] **Step 4: Make the write lock one per repository**

`write_lock(repo)` in every caller; each has its repository's path in scope. The lock is keyed like
the cache.

- [ ] **Step 5: Make the breaks**

Remove the generation check, and see `a_read_racing_a_write_never_keeps_the_old_workspace` fail;
remove the raw event's invalidation, and see the first test fail. Restore both. Report what failed
in the commit's body.

- [ ] **Step 6: Run the task's validation**

- Run: `vp run fast`, then `nix develop -c cargo nextest run -p uraeda-core`
- Expected: PASS, the watch tests included. Deferred to ready: the server's tests.

- [ ] **Step 7: Commit**

```bash
git add crates/core/src crates/core/tests/cache.rs
git commit -m "feat(performance-pass): the core answers reads from the workspace it read, until a change"
```

## Task 4: Live updates resolved once, and the server's timing header

**Files:**

- Modify: `packages/server/src/fate.ts` (`liveBus`), `packages/server/src/app.ts`
- Test: `packages/server/src/__tests__/live.test.ts`

**Interfaces:**

- Produces: every response of `/fate` and `/r/<name>/fate` carries `Server-Timing: app;dur=<ms>`,
  which task 16 reads.

- [ ] **Step 1: Write the failing test**

```ts
// packages/server/src/__tests__/live.test.ts
test("a subscription made with nothing changed gets no update", async () => {
  // Subscribe to the Workspace record; no change. No update arrives within the bus's replay
  // window. Then a change published 50 ms before a new subscription: that one gets it.
});
```

The break it catches: the bus sending an update on every subscription, which resolves each record
twice; a bus that misses a change made between a read and its subscription.

- [ ] **Step 2: Run it to check it fails**

- Run: `vp test packages/server/src/__tests__/live.test.ts`
- Expected: FAIL, an update arrives with nothing changed.

- [ ] **Step 3: Implement**

The bus remembers when it last sent each record's update. A new subscription gets an update at once
only when its record was updated within the last 2 seconds, covering the read made just before it.
Add the `Server-Timing` header in a Hono middleware of `app.ts`, the time from the request to the
response's headers.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS. Deferred to ready: the whole server suite.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/fate.ts packages/server/src/app.ts packages/server/src/__tests__/live.test.ts
git commit -m "feat(performance-pass): a subscription is sent a record only when it changed, and responses say their time"
```

## Task 5: The browser keeps what it read, and reads the selected row's page ahead

**Files:**

- Modify: `packages/web/src/clients.ts`, `packages/web/src/data.ts` (`readPriorities`, `readInbox`,
  `rereadChanges`), their callers, and the shared list keyboard behaviour (where a list's selection
  moves)
- Create: `packages/web/src/freshBase.ts`, `packages/web/src/readAhead.ts`
- Test: `packages/web/src/__tests__/fresh-base.test.ts`

**Interfaces:**

- Produces:
  - `withFreshBase<T>(read: (mode: "cache-first" | "network-only") => Promise<string>, write: (hash: string) => Promise<T>): Promise<T>`:
    writes over the cached hash; on a `conflict:` refusal, reads `network-only` and writes once
    more.
  - `readAhead(fate: FateClient, request): void`: requests and retains a page's request, so the page
    draws from memory.

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/__tests__/fresh-base.test.ts
test("a write refused as a conflict reads again and retries once", async () => {
  // A write over hash "a" refused "conflict: changed elsewhere"; the read gives "b"; the write
  // over "b" lands. A second conflict is the refusal the caller gets.
});
```

The break it catches: retrying forever; not retrying; retrying over the old hash.

- [ ] **Step 2: Run it to check it fails**

- Run: `vp test packages/web/src/__tests__/fresh-base.test.ts`
- Expected: FAIL, `withFreshBase` not found.

- [ ] **Step 3: Implement**

- `fateClients` sets `gcReleaseBufferSize` so every request of the session stays: ruling R5 sets the
  number.
- The reads made before a write (`readPriorities`, `readInbox`, their hashes) read `cache-first`
  through `withFreshBase`; the reads after a write go, as the write's answer and the live update
  bring the record.
- As a list's selection moves, by key or by click, `readAhead` requests the selected row's page.
  Each list with a pane names its row's page request where it names the row's link.
- `useRefreshOnShow` stays, as the spec's assumption says.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS. Deferred to ready: the Storybook build, the whole web suite.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(performance-pass): the browser keeps every page it read, and reads the selected row's ahead"
```

## Task 6: Pages as chunks, and a warning past 100 ms in development

**Files:**

- Modify: `packages/web/src/App.tsx` (the pages' imports), `packages/web/src/routes.tsx`
- Create: `packages/web/src/pages.ts` (the lazy pages and their preload), `packages/web/src/slow.ts`
  (the development warning and the user timings)

**Interfaces:**

- Produces: a `performance.measure` named `navigate <path>` from each route change to the frame that
  draws it, and `interaction <name>` for each click or key, which task 16 reads; in a development
  build, `console.warn("[uraeda] <name> took <ms> ms")` past 100 ms.

- [ ] **Step 1: Split the pages**

Each page a `lazy` import in `pages.ts`; once the first page has drawn, every page's chunk is
fetched, idle, so no navigation waits on one. No new Suspense fallback shows a loading state: the
route's existing deferral keeps the old page until the new one draws.

- [ ] **Step 2: Warn past 100 ms, in development only**

`slow.ts` observes the browser's event timing entries (`PerformanceObserver`, type `event`,
`durationThreshold` 100), and warns with the interaction's name, its target's accessible name and
its type ("click on Performance pass"), and its time. It runs only when `import.meta.env.DEV`.

- [ ] **Step 3: Run the task's validation**

- Run: `vp run fast`, then `vp run --filter uraeda-web build`
- Expected: PASS, and the build lists one chunk per page. Deferred to ready: Storybook, the suite.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src
git commit -m "feat(performance-pass): pages load as chunks, and development warns past 100 ms"
```

## Task 7: Deferred commits, and their undo, in the core and the binding

**Risky:** it changes what a commit does through the server, and undo writes the human's files.

**Files:**

- Create: `crates/core/src/actions/deferred.rs`, `crates/core/src/api/deferred.rs`,
  `crates/binding/src/deferred.rs`
- Modify: `crates/core/src/actions/commit.rs` (`commit`, `commit_only`),
  `crates/core/src/actions/place.rs` (`reach`), `crates/core/src/git/process.rs`,
  `crates/core/src/git/commit.rs`, `crates/binding/src/lib.rs` (its module line)
- Test: `crates/core/tests/deferred.rs`

**Interfaces:**

- Consumes: `write_lock(repo)` from task 3.
- Produces:
  - `api::defer_commits(repo: &Path, on: bool)`: turns deferral on for a repository, for the server.
    Off by default: `ura` and tests commit as today.
  - `api::take_deferred(repo: &Path) -> Vec<DeferredView>`: the commits the last calls deferred,
    each `{ id: String, subject: String, paths: Vec<String> }`, taken once.
  - `api::land(repo: &Path, id: &str, on_output: impl Fn(&str)) -> Result<CommitView>`: runs the
    deferred commit with the hooks, under the repository's write lock, `on_output` called with each
    line git and its hooks print. On a hook's refusal, it undoes the write and returns the `hook`
    error with the whole output.
  - `pub(crate) fn run_streaming(program, args, dir, on_line: &dyn Fn(&str)) -> Result<Vec<u8>, Failure>`
    in `process.rs`.
  - Binding: `deferCommits(repo, on)`, `takeDeferred(repo): Array<Deferred>`,
    `land(repo, id, onOutput: (line: string) => void): Promise<CommitView>`.

- [ ] **Step 1: Write the failing tests**

```rust
// crates/core/tests/deferred.rs
#[test]
fn a_refused_deferred_commit_puts_back_what_its_write_left_with_the_hooks_output() {
    // Deferral on. Save answers (uncommitted), then submit the round: the file reads answered at
    // once, no commit yet. A hook printing "a sentence of 31 words" and exiting 1; `land` is
    // refused with that output, and the file reads as before the submit: the saved answers kept,
    // `status: awaiting-human`. A second case: the file changed after the submit (a later save);
    // `land` refused leaves the later text.
}

#[test]
fn a_deferred_commit_never_landed_leaves_its_files_written_uncommitted() {
    // Deferral on; approve a spec; deferral dropped without landing (the server stopped). The
    // spec reads approved on disk, and `git status` lists it changed.
}
```

The break each catches: an undo that puts back the committed version and loses saved answers; an
undo that overwrites a later write; a deferral that reverts or commits on drop.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test deferred`
- Expected: FAIL, `defer_commits` not found.

- [ ] **Step 3: Implement deferral**

With deferral on for the repository, `place::reach` records, for the place it reaches, the list of
files under its `specs/` and the bytes of each Markdown file: the write's "before". `commit` and
`commit_only` then register the change with that before, and the bytes each path holds now, its
"after", and return without running git. `land` stages and commits the change as `commit` does, the
amend included. On a hook's refusal, each path of the change that still holds its "after" gets its
"before" back: the bytes when recorded, deleted when it did not exist then, left alone when it
existed but was not Markdown, such as an image. A path that changed since is left, and the refusal
says which. Deferred commits live in memory only.

- [ ] **Step 4: Stream git's output**

`run_streaming` reads git's merged output line by line and calls `on_line`, returning what `run`
returns. `land` uses it for `git commit`.

- [ ] **Step 5: Expose it in the binding**

A `ThreadsafeFunction` for `onOutput`, as `watch` does. New functions in `deferred.rs`, not in
`lib.rs` beyond its module line.

- [ ] **Step 6: Make the breaks**

Make undo restore the committed version, and see the first test fail on the saved answers; make it
skip the "after" check, and see its second case fail. Restore both. Report what failed in the
commit's body.

- [ ] **Step 7: Run the task's validation**

- Run: `vp run fast`, then `nix develop -c cargo nextest run -p uraeda-core`
- Expected: PASS, the refusal tests of `actions.rs` unchanged. Deferred to ready: the server suite.

- [ ] **Step 8: Commit**

```bash
git add crates/core crates/binding packages/binding/index.d.ts
git commit -m "feat(performance-pass): the core writes at once and defers the commit, undone if a hook refuses"
```

## Task 8: A proposal drafted in one request, and every card's changes in one

**Files:**

- Create: `crates/binding/src/drafts.rs`
- Modify: `crates/core/src/api/proposal_files.rs` or a new `api/drafts.rs`,
  `crates/core/src/changes.rs` (every branch's changes from one workspace read),
  `crates/binding/src/lib.rs` (its module line), `packages/server/src/fate/` (a `proposals.draft`
  mutation, an `AllBranchChanges` view), `packages/web/src/useStartFrom.ts`,
  `packages/web/src/sidebar/Cards.tsx`
- Test: `crates/core/tests/proposal.rs`

**Interfaces:**

- Consumes: `write_lock(repo)` and `open` from task 3.
- Produces:
  - `api::draft_proposal(repo: &Path, section: &str, title: &str) -> Result<ProposalFileView>`:
    inserts the title's line in the priorities' section, expands it into its file, and returns the
    file, as the 4 to 5 calls of `useStartFrom` did.
  - `changes::all_branch_changes(repo: &Path) -> Result<Vec<BranchChanges>>`, and the server's
    `AllBranchChanges` record, id `all-branch-changes`, live-updated with each feature's changes.

- [ ] **Step 1: Write the failing test**

```rust
// crates/core/tests/proposal.rs
#[test]
fn a_drafted_proposal_writes_its_line_and_its_file_in_one_call() {
    // `draft_proposal(repo, "Now", "Performance pass")`: the priorities' Now lists a line linking
    // the returned path, and the file's title is "Performance pass".
}
```

The break it catches: a draft that writes the file but not the line, or links another path.

- [ ] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test proposal`
- Expected: FAIL, `draft_proposal` not found.

- [ ] **Step 3: Implement the core, the binding, and the server**

`draft_proposal` reuses the existing insert and expand functions under one write lock.
`all_branch_changes` computes each feature's `BranchChanges` from one workspace read.

- [ ] **Step 4: Use them in the web UI**

`useStartFrom` calls `proposals.draft` once, then opens the editor. The sidebar's cards read
`AllBranchChanges` once, through one hook, instead of a request per card.

- [ ] **Step 5: Run the task's validation**

- Run: `vp run fast`, then `nix develop -c cargo nextest run -p uraeda-core`
- Expected: PASS. Deferred to ready: the whole suite.

- [ ] **Step 6: Commit**

```bash
git add crates packages
git commit -m "feat(performance-pass): a proposal is drafted in one request, and the cards' changes read in one"
```

## Task 9: Optimistic results for the files' writes

**Files:**

- Modify: the web UI's calls of `answers.*`, `defaultRound.*` but its submit, `review.comment`,
  `review.edit`, `review.remove`, `settled.*`, `text.save`, `text.discovery`, `notes.save`,
  `item.settings`, `repositories.*`, and the settings page's mutations

**Interfaces:**

- Consumes: fate's `optimistic`, checked by task 2.
- Produces: each of these calls passes `optimistic` with the record's fields it changes. A field
  only the core computes, like a path or a step, is left to the server's answer.

- [ ] **Step 1: Give each call its optimistic result**

For each call, the fields the write changes, from the input: an answer picked, a comment's text and
place, a text saved, a setting's value. A refusal is fate's rollback, and the existing error at the
call site says why where it happened.

- [ ] **Step 2: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS. Deferred to ready: the whole web suite, Storybook.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src
git commit -m "feat(performance-pass): answers, comments, texts, and settings show their result at once"
```

## Task 10: Optimistic results for the lists' and sessions' writes

**Files:**

- Modify: the web UI's calls of `inbox.*`, `proposals.*`, and `session.*` (`send`, `rename`,
  `archive`, `seen`, `stop`, `allow`, `allowAll`, `takeBack`, `newChat`)

**Interfaces:**

- Consumes: fate's `optimistic`, checked by task 2.
- Produces: each of these calls passes `optimistic`. A sent message shows in the transcript at once.
  The outliners keep their own drawn results, and stop waiting up to 2 s for each write to show
  before the next: fate's result shows it.

- [ ] **Step 1: Give each call its optimistic result**

As task 9. A note moved to Now with `p` opens the priorities with it in Now: the insert's optimistic
line, with a temporary id the server's replaces.

- [ ] **Step 2: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS, the outliners' tests unchanged. Deferred to ready: the suite, Storybook.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src
git commit -m "feat(performance-pass): lists and messages show their result at once"
```

## Task 11: The start, planned at once, then run with its steps

**Risky:** it changes the start's refusal: a refused commit now puts the proposal back.

**Files:**

- Modify: `crates/core/src/actions/start/mod.rs`, `commits.rs`, `crates/core/src/api/start.rs`
- Create: `crates/binding/src/start.rs`
- Modify: `crates/binding/src/lib.rs` (`start_feature` moves to `start.rs`)
- Test: `crates/core/tests/actions.rs`

**Interfaces:**

- Consumes: `run_streaming` from task 7, `write_lock(repo)` from task 3.
- Produces:
  - `api::plan_start(repo: &Path, proposal: &str, slug: Option<&str>, kind: Kind) -> Result<PlannedView>`:
    `{ folder, branch, slug, title }`, every check of the start made, nothing written. Refused with
    today's messages: a slug taken reads "A feature named <slug> exists already".
  - `api::start_feature(repo, proposal, slug, kind, on_step: impl Fn(StartProgress))`:
    `StartProgress` is `Committing`, `Output(line)`, `Branching`, or `Done`. On a hook's refusal of
    the start commit, the moved proposal and the priorities are put back as they were, nothing
    committed, and the `hook` error carries the output.
  - Binding: `planStart(...)`, and `startFeature(repo, proposal, slug, kind, onStep)`.

- [ ] **Step 1: Write the failing test**

```rust
// crates/core/tests/actions.rs
#[test]
fn a_start_refused_by_a_hook_puts_the_proposal_back_nothing_committed() {
    // A proposal file and its priorities line; a hook exiting 1. The start is refused with the
    // hook's output; the proposal is at its path, the priorities as before, no new commit, no
    // branch.
}
```

The break it catches: today's partial start, the proposal left in the feature's folder.

- [ ] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test actions`
- Expected: FAIL, the proposal not at its path.

- [ ] **Step 3: Implement**

`plan_start` runs `Start::plan` on the cached workspace, without writing. `start_feature` reports
its steps through `on_step`, streams the commit's output with `run_streaming`, and on a hook's
refusal moves the proposal back and writes the priorities read before. Other failures keep today's
`Partial` refusal. `start_change` gets the same `on_step`.

- [ ] **Step 4: Make the break**

Skip the restore, and see the test fail. Restore it, and report the failure in the commit's body.

- [ ] **Step 5: Run the task's validation**

- Run: `vp run fast`, then `nix develop -c cargo nextest run -p uraeda-core`
- Expected: PASS. Deferred to ready: the server suite.

- [ ] **Step 6: Commit**

```bash
git add crates packages/binding/index.d.ts
git commit -m "feat(performance-pass): a start is planned at once, runs its steps, and a refusal puts the proposal back"
```

## Task 12: The server's write queue

**Risky:** concurrency: every commit of the web UI goes through it.

**Files:**

- Create: `packages/server/src/writes/queue.ts`, `packages/server/src/fate/write-queue.ts` (its
  view, `writes.dismiss`)
- Modify: `packages/server/src/repositories.ts` (each host's queue, deferral on), the committing
  mutations listed in **Code read** but the starts, `packages/server/src/fate.ts` (exports)
- Test: `packages/server/src/__tests__/write-queue.test.ts`

**Interfaces:**

- Consumes: `deferCommits`, `takeDeferred`, `land` from task 7.
- Produces:
  - `WriteQueue` record, id `WRITE_QUEUE_ID = "write-queue"`, on each repository's endpoint:
    `{ writes: Array<{ id: string; label: string; href: string; folder?: string; file?: string; state: "running" | "waiting" | "refused"; output?: string; steps?: Array<StartStep> }> }`,
    `StartStep` as in `StartSteps.tsx`. Live-updated at each change.
  - Committing mutations take `write: { label: string; href: string }` in their input, and answer
    with what their files now hold, before the commit lands.
  - `writes.dismiss({ id })`.
  - `Host.queue: WriteQueue`, with `enqueue(write, land: (onOutput) => Promise<unknown>)`, which
    task 13 uses for the start.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/write-queue.test.ts
test("a commit answers with its written files, then lands in the queue", async () => {
  // A hook that waits until released. `review.approve` answers with the spec `approved`; the
  // record lists "Approving the spec of Performance pass" running; released, it lands: the record
  // is empty, and the branch has the approval's commit.
});

test("writes land in order, and a refused one does not stop the next", async () => {
  // Three commits; the hook refuses the first. The record shows it refused with the hook's output,
  // the next two land in order. Rows: a second client reads the same record; two writes on the
  // same file: the second one's files wait for the first's commit.
});
```

The break each catches: a mutation that waits for the hook; writes landing out of order; a refusal
that stops the queue; two commits mixing one file's writes.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/write-queue.test.ts`
- Expected: FAIL, no `WriteQueue` record.

- [ ] **Step 3: Implement**

Each host turns deferral on, and owns one queue. A committing mutation runs its core call, takes its
deferred commits, and enqueues them, all under the queue's own lock, so two calls' deferred commits
never mix; it answers at once. A call whose paths overlap a commit still queued waits for it before
writing. The queue lands one commit at a time, in order, with `land`. A refusal stays in the record
until `writes.dismiss`. A landed write leaves the record.

- [ ] **Step 4: Make the breaks**

Run two lands at once, and see the order test fail; drop the overlap's wait, and see its row fail.
Restore both, and report in the commit's body.

- [ ] **Step 5: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS. Deferred to ready: the whole suite.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src
git commit -m "feat(performance-pass): commits land in a queue per repository, in order, published live"
```

## Task 13: The start through the queue, and its queued message

**Files:**

- Modify: `packages/server/src/fate/mutations.ts` (`feature.start`, moved to its own module),
  `packages/server/src/fate/change-starts.ts`, `packages/server/src/runner/sessions.ts` (a message
  queued for a start), `packages/server/src/fate/sessions.ts` (`session.send`)
- Test: `packages/server/src/__tests__/start-queue.test.ts`

**Interfaces:**

- Consumes: `planStart`, `startFeature` from task 11; `Host.queue` from task 12.
- Produces:
  - `feature.start` answers once planned with a `StartPlan` record:
    `{ id: folder, folder, title, message }`, `message` the workflow's message of the feature's
    first step. The queue runs the start, its write's `steps` "Committing the proposal", "Making the
    branch and its worktree", "Starting the agent", each with its seconds, the commit's with its
    output.
  - `session.send` with the `folder` of a start still in the queue keeps the message, and sends it
    once the start lands. The start's write holds `queued: string` meanwhile. On a refusal, the
    message is dropped, and the refused write's `queued` holds its text for the composer.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/start-queue.test.ts
test("a start answers once planned, then runs its steps", async () => {
  // A hook that waits until released. `feature.start` answers with folder
  // "2026-10-29-performance-pass" and its message; the record's start write has its three steps,
  // the commit running. Released, every step done, the feature readable. Rows: a second start of
  // the same slug is refused at once, "A feature named performance-pass exists already".
});

test("a message sent during a start waits, then starts the agent", async () => {
  // The start held by its hook; `session.send` to its folder answers at once; the fake agent has
  // no turn. Released: the agent's turn starts with the text. Row: the hook refuses: no turn, and
  // the refused write's `queued` is the text.
});
```

The break each catches: a start that waits for the commit; a second plan of a planned slug accepted;
a message sent before the worktree exists, or lost on a refusal.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/start-queue.test.ts`
- Expected: FAIL, `feature.start` waits for the hook.

- [ ] **Step 3: Implement**

The planned slugs still in the queue count as taken for the next plan. The runner keeps the queued
message in memory: a server that stops drops it, and sends nothing twice. `change.start` follows the
same path.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS. Deferred to ready: the whole suite.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(performance-pass): a start answers once planned, and a message sent meanwhile waits for it"
```

## Task 14: The commit toast, and writes that never block

**Files:**

- Start from: `packages/web/src/writes/CommitToast.stories.tsx#Running`
- Modify: `packages/web/src/writes/store.ts`, `WriteButton.tsx`, `useOwnWrite.ts`,
  `CommitToast.tsx`, every caller listed in **Code read**, `packages/web/src/ReviewVerdict.tsx`,
  `packages/web/src/RoundSubmit.tsx`, the shell that mounts the toast
- Create: `packages/web/src/writes/useWriteQueue.ts` (`useWriteQueue`, `useRefusal`)
- Modify: `specs/ui/surfaces.md`, `specs/ui/space-and-motion.md`
- Test: `packages/web/src/__tests__/commit-toast.test.tsx`; remove the five tests of
  `writes-store.test.tsx` the spec lists

**Interfaces:**

- Consumes: the `WriteQueue` record and `writes.dismiss` from task 12.
- Produces:
  - `useWriteQueue(): ReadonlyArray<QueuedWrite>`, and
    `useRefusal(where: { folder: string; file?: string }): QueuedWrite | undefined`, the refused
    write of that place.
  - `WriteButton` runs its action and takes the human where it leads at once; it never blocks
    another, and shows no running state. `markPending` stays for the actions that are not git
    writes, such as "Starting the agent…".

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/__tests__/commit-toast.test.tsx
test("a refused commit shows its output on its file and in the toast", async () => {
  // A WriteQueue record with the approval of Performance pass refused, output "spec.md:12: a
  // sentence of 31 words". The spec's page shows the output at the verdict's place; the toast
  // lists the approval with Open and Dismiss; Open goes to the spec's verdict.
});
```

The break it catches: a refusal shown only in the toast; a toast that loses a refusal.

- [ ] **Step 2: Run it to check it fails**

- Run: `vp test packages/web/src/__tests__/commit-toast.test.tsx`
- Expected: FAIL, no toast.

- [ ] **Step 3: Implement**

Mount `CommitToastView` once, fed by `useWriteQueue`, where the leader menu rises; on the phone,
over the bottom bar, across the screen's width. Each committing call passes
`write: { label, href }`, the label its button's running text without "…". Remove the blocking
store, the thin bar, and the card's action for git writes, with the five tests the spec lists.
Rewrite the guides' paragraphs on git writes to the toast and the queue.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS. Deferred to ready: the suite, Storybook.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/ui
git commit -m "feat(performance-pass): commits land behind a glass toast, and no write blocks another"
```

## Task 15: Start lands at once on the session

**Files:**

- Start from: `packages/web/src/session/StartSteps.stories.tsx#Running`
- Modify: `packages/web/src/useEditorActions.ts`, `ProposalStart.tsx`, `HandOver.tsx`,
  `SessionPage.tsx`, `useComposerSend.ts`, `NewChangePage.tsx`
- Create: `packages/web/src/useStart.ts`
- Test: `packages/web/src/__tests__/editor.test.tsx` (its start test, rewritten)

**Interfaces:**

- Consumes: `StartPlan` and the start's write from task 13; `useWriteQueue` from task 14.
- Produces: `useStart()`, the one start of the button, `Ctrl+Enter`, and `Enter` in the slug: saves
  the text if needed, calls `feature.start`, and opens `/f/<folder>/session?continue=start` with the
  plan's message in the composer.

- [ ] **Step 1: Rewrite the start's test**

```tsx
// packages/web/src/__tests__/editor.test.tsx
test("Start saves the text typed, then opens the session at once (US4 2)", async () => {
  // Typed text, Start: the save, then `feature.start`; the session page of
  // "2026-10-29-performance-pass" opens with the plan's message in the composer, before the
  // start's write lands.
});
```

The break it catches: a start that waits for the commit; one that starts before the save.

- [ ] **Step 2: Run it to check it fails**

- Run: `vp test packages/web/src/__tests__/editor.test.tsx`
- Expected: FAIL, the session not opened before the write lands.

- [ ] **Step 3: Implement**

The session page of a folder whose start is in the queue draws `StartStepsView` where the transcript
will be, from the start's write. Send queues the message; a refusal puts `queued` back in the
composer, and the steps show the hook's output with the link to the proposal. A slug refused at
planning stays in the editor, under the slug.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS. Deferred to ready: the suite, Storybook.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(performance-pass): Start opens the session at once, its steps where the transcript will be"
```

## Task 16: The benchmark

**Files:**

- Create: `packages/web/scripts/performance.ts`, and its task, `vp run performance`
- Modify: `packages/server/src/__tests__/live.bench.ts` and `smoke.ts --timed`'s bounds where the
  new targets change them

**Interfaces:**

- Consumes: `Server-Timing` from task 4, the user timings from task 6.

- [ ] **Step 1: Write the benchmark**

It builds the binding in release and the web UI, seeds a sandbox in a temporary folder, serves it
with `main.ts`, and drives Chromium with Playwright over the `realistic` project, then over a clone
of this repository (69 features). It measures each criterion: SC-001 pages by click and by `j`, `k`,
`Enter`; SC-002 reloads; SC-003 each write's result from its press; SC-004 Start to the session with
its message; SC-005 a commit made with `git` outside to its page; SC-006 reads after a start. It
prints each time against 100 ms or 1 s, and exits non-zero past a target.

- [ ] **Step 2: Run it**

- Run: `vp run performance`
- Expected: every criterion within its target. A miss is fixed in the task that owns it, as a
  finding, before the review.

- [ ] **Step 3: Commit**

```bash
git add packages/web/scripts/performance.ts vite.tasks.ts packages/server/src/__tests__
git commit -m "feat(performance-pass): a benchmark measures the pages and actions against 100 ms"
```
