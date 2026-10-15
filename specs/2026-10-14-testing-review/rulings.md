# Rulings: Testing review

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Hung Rust tests are bounded by nextest, not by timeouts in each test

- **Decision**: the spec's "timeouts in the Rust LSP tests that have none" are nextest's
  `slow-timeout` of every profile: `cli/tests/lsp.rs` and the LSP session's `Drop` get no timeout of
  their own.
- **Rationale**: a process per test, killed after 2 minutes, bounds every hang, including ones in
  code no one thought to time out ([cargo-nextest](discovery-01.md#cargo-nextest)); the `Session`'s
  reads already have deadlines.
- **Alternatives considered**: a deadline on each blocking read and join: more code in the helpers,
  and only for the hangs already known.
- **If wrong**: a bare `cargo test` can still hang on those two; adding deadlines there later is
  local to the helpers.
- **Where**: task 1.

## R2: The Neovim tests' git isolation lives in `minimal_init.lua`, not `helpers.repo`

- **Decision**: `minimal_init.lua` sets `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`
  and clears the inherited `GIT_*` variables, instead of `helpers.repo` alone as the spec's Testing
  says.
- **Rationale**: the runner and every child Neovim load it, so `helpers.git`, the child's `ura lsp`,
  and its git all inherit it, however the tests are started.
- **Alternatives considered**: `helpers.repo` passing an environment to each git call: it misses the
  git that `ura lsp` runs in the child.
- **If wrong**: a test that needs the user's git configuration, which none does, would have to set
  its own.
- **Where**: task 7.

## R3: CI cancels an older run on any branch but `main`, and can be started by hand

- **Decision**: `cancel-in-progress` is `github.ref != 'refs/heads/main'` instead of pull requests
  only, and `ci.yml` gets a `workflow_dispatch` trigger.
- **Rationale**: task 10 measures CI on the branch before its pull request exists, and its runs
  should cancel each other the way a pull request's do; `main`'s runs are never cancelled, so each
  merge keeps its coverage artifact.
- **Alternatives considered**: measuring only once the draft pull request is open: after the final
  review, when a miss would mean reopening the work.
- **If wrong**: a branch pushed twice in a row loses its first run, which is what the spec asks for
  pull requests.
- **Where**: task 9.

## R4: A change to `specs/` also reruns `vp check`

- **Decision**: US2.5's checkbox in a plan reruns `specs:check` and `ts:check`, not `specs:check`
  alone.
- **Rationale**: `vp check` formats Markdown with `proseWrap: "always"`
  ([`vite.config.ts`](/vite.config.ts)), so a spec's text is one of its inputs; leaving it out would
  let a badly wrapped spec pass `ready` from the cache.
- **Alternatives considered**: excluding `specs/` from `ts:check`'s inputs: a stale pass on
  unformatted files, which CI would then fail.
- **If wrong**: about 8 seconds per spec edit.
- **Where**: task 3.

## R5: The image attachments' SC-002 is measured nowhere

- **Decision**: the browser test "SC-002: a 1440×900 screenshot is linked within a second of its
  drop" is removed, with no benchmark taking its place.
- **Rationale**: its only assertion beyond US1.1's link is the duration, which the code-quality
  decision keeps out of the tests; the browser tests have no benchmark runner.
- **Alternatives considered**: a browser benchmark harness for one criterion: a new tool for a
  measure nobody reads today.
- **If wrong**: a slow image pipeline goes unnoticed until someone times it; the server's encoding
  time stays covered by `bench_bombs_are_refused_fast` and the core's image tests.
- **Where**: task 6.

## R6: The search for sleeps and clocks finds the session's deadlines and the watcher's spacing

- **Decision**: task 2's search expects the LSP session's deadlines, the 10 ms spacing between the
  writes of `a_burst_of_writes_is_reported_together`, and the timing lines inside the benchmarks,
  instead of "the watcher tests' deadlines and the iCCP child's process measure", which the search
  does not match.
- **Rationale**: the session's deadlines bound waits for a message and assert no duration; the
  watcher's spacing builds the burst the debounce is tested on, so without it the test could pass
  without a debounce; `grep -v bench_` drops lines, not functions, so the benchmarks' bodies show.
- **Alternatives considered**: removing the watcher's spacing: the operating system may then merge
  the writes itself, and the test would no longer show the debounce at work.
- **If wrong**: the watcher test keeps a 100 ms total of sleeps, outside SC-005's letter; replacing
  them with a write sequence the watcher acknowledges is local to `watch.rs`.
- **Where**: task 2.

## R7: The binding is marked as built on every run, by an uncached `binding:touch`

- **Decision**: `binding:touch` (`cache: false`) runs `touch -c` on `packages/binding/*.node` after
  `binding:build`, hit or miss, and `ts:test`, the browser tasks and `bench` depend on it. The
  toolchain test's `untracked` skips a task that only touches files, as it skips the groups.
- **Rationale**: a hit restores the `.node` file with the time it was built at. A binding source
  saved since with the same content, by `git stash` and `pop` or a checkout there and back, is newer
  than that, so the web configs' `checkBinding` refused a current binding: `ts:test` failed with
  "the native binding is older than the Rust core", and the build its message names was undone by
  the next hit. The cache matches the binding to its sources' content, so marking it as built now is
  true. Review focus 3's fallback, `binding:build` without outputs, keeps the old time too, and
  would not put back a deleted `.node` file, which the spec's edge case asks for.
- **Alternatives considered**: skipping `checkBinding` under Vitest: `vp dev` after `ready` would
  still refuse the restored binding; comparing the file's change time: `main.test.ts` sets the times
  it tests with `utimesSync`, which moves the change time to now.
- **If wrong**: a task in the graph that checks nothing; removing it brings the refusal back, and a
  `checkBinding` that compares content would make it unneeded.
- **Where**: task 3.

## R8: `GIT_DIR` is kept from the tests only in a cached run

- **Decision**: the edge case of an exported `GIT_DIR` is checked with
  `GIT_DIR=/nonexistent vp run ready` after `vp cache clean`, as the spec's Testing says, instead of
  `vp run --no-cache ready:rust`.
- **Rationale**: Vite Task passes the whole environment to a task run without its cache, with
  `--no-cache` or `cache: false`: `vp run --no-cache ready:rust` failed 21 tests before nextest
  stopped, with "fatal: not a git repository: '/nonexistent'", and a cached run passes. CI, which
  runs `--no-cache`, exports no `GIT_*` variable, and `test:nvim`, uncached, gets them cleared by
  `minimal_init.lua` in task 7 (R2).
- **Alternatives considered**: unsetting the `GIT_*` variables in each test task's command: a longer
  command for a case only a hook calling `vp run --no-cache` reaches.
- **If wrong**: a hook that runs `vp run --no-cache` fails the git tests; prefixing the test
  commands with `env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR` fixes it.
  Superseded by task 4: the test commands drop the variables, so an uncached run passes too (R13).
- **Where**: task 3. Superseded by task 4 (R13).

## R9: The server tests' negative waits follow a sentinel or a running fake clock

- **Decision**: "a take-back is published to every reader" runs a fake clock that still advances
  (`shouldAdvanceTime`), and jumps it past `SESSION_UPDATE_MS` where it slept; "a change in one
  repository sends no update to another" switches the first repository's branch as its sentinel,
  whose updates (`Workspace`, `SessionList`) differ from the second's (`Workspace`, `Priorities`);
  "closed hosts stop following the file" waits for other hosts, open on the same list, to follow two
  additions. The waits' 1 s timeouts in `repositories.test.ts` become 10 s.
- **Rationale**: the take-back's update merges into the update the sends left pending, so waiting
  for it would also pass on the pending one: only the clock's jump says the earlier ones are out. A
  sentinel of the same kind as the change would let the leaked update pass for it. With one
  addition, the closed hosts' reload, in the break that keeps their watch, still ran after the
  assertion; with two, the break failed 3 runs out of 3. A timeout bounds a wait for a condition, so
  it is no duration check, but a 1 s one fails a loaded machine: SC-004's second is measured by no
  test, as R5 does for SC-002 of the image attachments.
- **Alternatives considered**: waiting for the take-back's update without the clock: a false pass
  when the take-back sends none. A fake clock that only moves when told: the server's own timers, in
  the same process, would stop.
- **If wrong**: a test that waits up to 10 s where it failed in 1 s; the scenario of SC-002's live
  test also arrives through the repository's watcher, so its "at once" is checked by the unit test
  "a session's status change is published at once…", and its second by `live.bench.ts`.
- **Where**: task 4.

## R10: The web configs leave `.env` out through an option of the settings' readers

- **Decision**: `loadEnv`, `loadDataDir` and `devHandler` take `{ file: false }`, which
  `packages/web/vite.config.ts` passes under Vitest; `dev.test.ts`'s variables are `vi.stubEnv`'s,
  undone after each test, instead of a saved copy of the browser setup's.
- **Rationale**: the config has no other way to keep the settings of `vp dev` while the tests read
  the environment only; the tests themselves still set `URAEDA_REPO` and `URAEDA_DATA_DIR` for the
  handler, which the next tests must not get.
- **Alternatives considered**: pointing the tests' root at a folder without `.env`: the root is also
  the repository opened when `URAEDA_REPO` is not set.
- **If wrong**: one option on three functions; dropping it brings the developer's `.env` back into
  the tests.
- **Where**: task 4.

## R11: The session tests wait for the session's own view before typing again

- **Decision**: `session.test.tsx`'s `openTurn` waits for its message in the session's transcript,
  and `thumbnails` returns the buttons its wait saw, so
  `Unable to find role="button" and name "Send"`, and the `/^Remove /` failures, are fixed in the
  tests, not the product.
- **Rationale**: reproduced with 10 runs of the file at once (3 failed, US1.3, US1.4 and a hand-over
  test): the typed text never reached the draft, as a debug log of its setter showed, because `send`
  typed into the empty view's composer while the session's view replaced it. A person types into the
  composer on screen, which the draft carries over; the test held an element the page was removing.
  The page that seemed empty was hidden by React while it suspended on the hand-over's redirect, a
  synchronous update. With the waits, 24 runs at once passed; without `openTurn`'s, 1 of 12 failed
  again.
- **Alternatives considered**: keeping the empty view's composer mounted across the change, in
  `SessionPage.tsx`: a product change for a race only a test, holding a stale element, can hit.
- **If wrong**: a real loss of typed text would show as an empty composer after the first message;
  the unmerged `2026-10-14-session-view` branch rewrites much of this file but keeps `openTurn`,
  `send` and `thumbnails` as they were, so the two changes merge without a conflict in them.
- **Where**: task 4.

## R12: gix's `parallel` feature, and a teardown that waits for the page's requests

- **Decision**: the workspace's gix dependency gets its `parallel` feature, with a core test of a
  worktree whose object store is deleted before its status is read; the web tests' helpers unmount
  the page, wait for the server to answer every request, then close the hosts and the sessions, in
  one `afterEach`.
- **Rationale**: without `parallel`, gix's object store handle is not thread-safe, and the worktree
  status converts it with `into_arc().expect("arc conversion always works")`, which opens the store
  again from disk: a missing `objects` folder panics, and a panic in a napi call cannot unwind, so
  Node aborts. With `parallel`, the handle is already shared, and the conversion cannot fail; the
  new test panicked at that line before, and passes after. The abort needed a read going while its
  repository was deleted: the web tests closed their hosts and sessions before unmounting the page
  (Vitest runs `afterEach` hooks last registered first), and nothing waited for the requests the
  page sent as it went before the file's temporary folder was deleted; the same order left the
  unhandled `FateRequestError` of run 38515969774. `parallel` adds `crossbeam-deque` and
  `crossbeam-epoch`.
- **Alternatives considered**: checking that the store's folder exists before each status: a race
  still, between the check and the reopen. Catching the panic with `catch_unwind`: the panic is
  gix's bug path, still printed, and the reopened store is not needed.
- **If wrong**: gix's status may use more threads; dropping the feature brings the abort back, and
  the test shows it.
- **Where**: task 4.

## R13: Every test task drops the git variables a hook exports

- **Decision**: `vite.config.ts`'s `isolatedGit`, the start of every test task's command, is
  `env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1`.
- **Rationale**: Vite Task passes the whole environment to an uncached run, which CI's `--no-cache`
  is (R8): `GIT_DIR=/nonexistent nix develop -c vp run --no-cache ready:rust` failed 22 tests with
  "not a git repository" before, and passes after. One home for every test task.
- **Alternatives considered**: keeping R8's cached-only guarantee: a hook running
  `vp run --no-cache` would fail the git tests.
- **If wrong**: a longer command in each test task's summary; the helpers' own isolation stays.
- **Where**: task 4.

## R14: Waits found beyond the plan's lines

- **Decision**: `links.test.ts`'s 50 ms wait becomes `quiet()`; `claude.test.ts`'s polls every 50 ms
  become `vi.waitFor`, with 10 s instead of 3 s; `editor.test.tsx`'s `setTimeout(resolve)` stays;
  `crates/lsp/tests/commands.rs`'s waiting hook also ends once its repository is gone.
- **Rationale**: the plan's search finds these. `quiet()` waits for what the 50 ms stood for, every
  answer drawn. The polls already waited for a condition; a 3 s bound failed nothing yet, but is a
  duration under load. The editor's wait is for the next task, of no duration, as `answered` does.
  The hook of `requests_are_answered_while_a_command_runs` looped for 1 h 42 min after a killed run
  had deleted its repository, which no `Drop` could end.
- **Alternatives considered**: leaving the polls as they were: their 50 ms is a poll interval, not a
  sleep, but the search cannot tell.
- **If wrong**: none changes what a test checks.
- **Where**: task 4.

## R15: `atSize` reads the instance's viewport, and skips through its scope's options

- **Decision**: `atSize` takes the size from the instance's configured viewport
  (`server.config.browser.viewport`, under 768 px the phone), and at the other size sets `skip` in
  the options of the block it is called in (`TestRunner.getCurrentSuite()`), which every test and
  block declared after it inherits, as `describe.skip` does. A file whose tests are all of one size
  calls it at its top (`round.test.tsx`, `task.test.tsx`); the others in a `describe` around their
  tests.
- **Rationale**: Vitest's `skipIf` decides per test or per block at the call that declares it, so a
  call at the top of a scope cannot use it; the options are where `describe.skip` puts the same
  flag. The configured viewport does not move when a test resizes the window, as `layout.test.tsx`
  and `round.test.tsx` do. The helper's test failed with `{ hooked: 3 }` when the skip was a hook's
  `context.skip()`, and on the width assertions when the sizes were swapped; the full runs skip 11
  tests on the phone and 4 on the desktop, exactly the early returns' and the helper's.
- **Alternatives considered**: `describe.skipIf(size !== "desktop")` at each call site: the
  condition repeated in every file; `context.skip()` in a `beforeEach`: the file's own hooks run
  first, taking a repository.
- **If wrong**: the options are the runner's, typed but rarely used: a Vitest upgrade that stops
  reading them fails the helper's test. At a file's top, the options belong to the runner's default
  block, which is not reset between files: each browser file runs in a frame of its own (Vitest's
  default `isolate`), so nothing leaks today; turning isolation off would need the `describe` form.
- **Where**: task 5.

## R16: The round's scroll offsets were a test behind the product, not a flake

- **Decision**: `round.test.tsx` keeps its waits; only `atSize("desktop")` replaces its early
  returns.
- **Rationale**: both CI failures (runs 38519227740 and 38527830753, on `main` at 9290d4b and
  30e0356) failed the same two polls with the same values, 326.721874 and 863.378124: deterministic,
  not timing. Commit a1a0286 opened a round not started on its intro, at the top, while the tests
  still expected it at Q1; 4b8de71 fixed the tests after both runs. The test of 30e0356, run on
  today's code, fails with exactly those two values; the current test passed 10 runs out of 10
  beside `vp run --no-cache ready:rust`, and 10 out of 10 with 48 busy loops on 32 cores (load 52).
- **Alternatives considered**: waiting for `scrollStopped()` before each offset poll: slower, and
  for a race that the evidence does not show.
- **If wrong**: a real scroll race would fail one poll with a varying offset; its failure screenshot
  and value would tell it from this one.
- **Where**: task 5.

## R17: The attachments' negative waits set the clock or follow a sentinel

- **Decision**: "text typed at the cursor during an upload…" types under fake `setTimeout` and
  `clearTimeout`, advances them 1 s, and asserts no save request was sent; "a paste of text with a
  picture of it…" pastes an image alone after it, as a sentinel, and asserts that only the
  sentinel's upload was sent, replacing its "Adding pasted image" and images folder checks; the
  SC-002 test loses its duration and its 10 ms poll, and is named "SC-002: a 1440×900 screenshot
  dropped is linked" until task 6 removes it (R5).
- **Rationale**: the debounce is a timer of the page, which the test's clock can pass at once; a
  paste is uploaded in order, so once the sentinel's link shows, any upload the first paste started
  was sent before it. The count fails for the upload the old checks saw, and also for one started
  without cancelling the paste. Breaks seen: saving while an upload holds the text fails with
  `expected 1 to be +0`; uploading a text paste fails with `expected 2 to be 1`.
- **Alternatives considered**: waiting for the save state shown on the page: an unscheduled save
  shows nothing to wait for.
- **If wrong**: fake timers stop the page's other timers for 1 s of fake time, which the test does
  not depend on; a page that uploads pastes out of order would pass the paste test wrongly.
- **Where**: task 5.

## R18: Task 5's commands, as run

- **Decision**: the helper's test runs from the root
  (`vp test --project phone packages/web/src/__browser__/sizes-helper.test.tsx`); both sizes run at
  once as two processes, after `vp run binding:touch`:
  `vp run --no-cache --ignore-depends-on browser:phone` and the same for `browser:desktop`; the
  search for early returns is a multi-line one, apart from the sleeps' and clocks'.
- **Rationale**: from `packages/web`, `vp test` reads that package's config, which has no `phone`
  project; `vp run` takes one task, and passes a second one to the first as an argument, so the
  plan's command ran the phone only; without `--ignore-depends-on`, two `--no-cache` runs would
  build the binding at the same time. The plan's `innerWidth\s*[<>]` also finds the tests at both
  sizes that branch on the width, which task 5 keeps.
- **Alternatives considered**: `vp run ready`: every other check too.
- **If wrong**: none changes what runs on CI, whose two browser jobs are two machines.
- **Where**: task 5.
