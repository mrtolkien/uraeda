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

## R12: A status read catches gix's panic, and a teardown waits for the page's requests

- **Decision**: the three status reads of `crates/core/src/git/status.rs` run in `catch_unwind`, and
  fail with "its repository was deleted during the read" when gix panics, with a core test of a
  worktree whose object store is deleted before its status is read; the web tests' helpers unmount
  the page, wait for the server to answer every request, then close the hosts and the sessions, in
  one `afterEach`.
- **Rationale**: gix's object store handle is not thread-safe without its `parallel` feature, and
  the worktree status converts it with `into_arc().expect("arc conversion always works")`, which
  opens the store again from disk: a missing `objects` folder panics, and a panic in a napi call
  cannot unwind, so Node aborts. Caught in the core, the panic becomes the read's error; the new
  test panicked at that line before, and passes after. The abort needed a read going while its
  repository was deleted: the web tests closed their hosts and sessions before unmounting the page
  (Vitest runs `afterEach` hooks last registered first), and nothing waited for the requests the
  page sent as it went before the file's temporary folder was deleted; the same order left the
  unhandled `FateRequestError` of run 38515969774. Measured with
  `cargo build --release -p uraeda-cli` (`stat -c %s target/release/ura`): 6,717,112 bytes without
  the feature, 6,797,144 with it (+80,032 bytes, 78 KB, 1.2%, from `crossbeam-deque` and
  `crossbeam-epoch`), 6,716,888 with the caught panic. The CLI decision keeps the binary as small as
  possible, so the caught panic won.
- **Alternatives considered**: gix's `parallel` feature, the first fix: the store already open is
  shared, so the conversion cannot fail and the reads list nothing, for 78 KB. Checking that the
  store's folder exists before each status: a race still, between the check and the reopen, which
  comes after the index is read.
- **If wrong**: the panic is still printed to stderr by Rust's default hook, once per read that
  meets a deleted repository, which the teardown now avoids; each status read also opens the store
  again, as it did before this pull request. A gix that stops panicking there returns its own error
  instead, and fails the test's message.
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
- **If wrong**: a page timer set while the clock is faked and not due within the advanced second
  never fires: `vi.useRealTimers()` discards it rather than resuming it, and the test depends on
  none; a page that uploads pastes out of order would pass the paste test wrongly.
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

## R19: The toolchain test reads retries anywhere a runner takes them, and automatic inputs

- **Decision**: `retried` strips comments, then looks for `retries =` in TOML, `retry:` anywhere in
  a Vitest config, and `--retry`, `--retries`, or `NEXTEST_RETRIES` in CI's workflow; it reads every
  `packages/*/vite*.config.ts`, found, not listed. A new `retriedTasks` looks for the same flags and
  variable in every task's command and `untrackedEnv`. `untracked` reports an `{ auto }` input, and
  skips a touch only when it is the task's whole command, a single string.
- **Rationale**: the plan's line-start patterns missed `test: { retry: 2 }` on one line, and nothing
  read the other ways a runner is told to retry; a task whose array of commands began with a touch
  was skipped, and an `{ auto: true }` input passed, both against "a check MUST NOT rely on
  automatic input tracking". Each new fixture row failed first; breaks seen on the repository's
  files: `--retry 2` on `ts:test`'s command, `retry: 2` on `packages/binding/vite.config.ts`'s one
  line, and `{ auto: true }` in `lua:fmt`'s inputs each failed the repository test.
- **Alternatives considered**: importing each Vitest config and reading `test.retry`: the web
  configs check the binding as they load, and a retry set in a project or an instance is nested
  deeper than `test`.
- **If wrong**: a comment stripper of two patterns can drop a setting after a `//` in a string on
  the same line, which no config has.
- **Where**: task 3.

## R20: Four tasks read more than the spec's Data table lists

- **Decision**: `ts:test` also lists `.config/nextest.toml`, `.github/workflows/ci.yml`,
  `crates/*/Cargo.toml`, and `crates/*/src/lib.rs`; `specs:check` lists every `**/*.md` outside
  `node_modules/` and `target/`; `binding:build` adds `pnpm-lock.yaml` and `rust-toolchain.toml`;
  `rust:fmt` adds `rust-toolchain.toml`.
- **Rationale**: each is a file the task reads that the table missed. The toolchain test, run by
  `ts:test`, reads the runners' settings, CI's workflow (task 9 compares its jobs with `ready`), and
  the crates' manifests: after `vp run ts:test`, appending `retries = 2` to `.config/nextest.toml`
  replayed a pass from the cache, and with the inputs it reran and failed. `ura check` resolves the
  specs' links to any Markdown file, such as `README.md` or `AGENTS.md`: an edit of `AGENTS.md`
  replayed `specs:check` before, and reruns it after. napi's CLI comes from the lockfile, and the
  toolchain pins rustc and rustfmt.
- **Alternatives considered**: moving the toolchain test out of `ts:test`, to a task of its own: it
  would need a Vitest project of its own, for one file.
- **If wrong**: an unrelated Markdown or toolchain edit reruns a check that would have passed, a few
  seconds each.
- **Where**: task 3.

## R21: The composer's two pasted images are checked in happy-dom

- **Decision**: the browser test "US2.1: two images pasted in the composer are thumbnails, sent with
  the message" is removed.
- **Rationale**: it pasted two images in a session's composer, saw two thumbnails and "Add images",
  and checked the agent got the text with both images. Happy-dom's `session.test.tsx` "US2.1: two
  pasted images show as removable thumbnails" checks the thumbnails and the button, and "US2.2: a
  message with images shows them above its text" checks the sent message's text and its two images,
  through the same server. The paste is a synthetic event in both, so WebKit adds no real input.
- **Alternatives considered**: keeping it at the phone size only: a second copy of the same
  scenario, at 2 to 3 seconds a run.
- **If wrong**: a WebKit-only failure of the composer's paste would show in `attach.test.tsx`'s "a
  message not read yet has its images dimmed, as its text", kept in WebKit, which pastes an image in
  the same composer, sees its thumbnail, and sends it with a text; the editor's paste,
  `US1.2: a pasted image is linked as "pasted image"`, also still runs in WebKit.
- **Where**: task 6.

## R22: The session page's drop is checked in happy-dom

- **Decision**: the browser test "a file dropped anywhere on a session's page joins the message" is
  removed.
- **Rationale**: it dropped an image on a session's page, checked the drop was cancelled, and saw
  one thumbnail. Happy-dom's `session.test.tsx` "an image dropped anywhere on the session page joins
  the message" drops on the same page and sees the thumbnail; the browser's own handling of a drop
  outside a field, that the page cancels it, is `attach.test.tsx`'s "a drop outside every field
  stays in the app", which still runs in WebKit.
- **Alternatives considered**: keeping it for its `defaultPrevented` check: the same page handler as
  the kept drop test's.
- **If wrong**: a session page that lets WebKit open a dropped file goes unseen until used.
- **Where**: task 6.

## R23: A verdict held back by a comment's image is checked in happy-dom, at both widths

- **Decision**: the browser test "a verdict waits for a comment holding an image to be added or
  cancelled" is removed.
- **Rationale**: it dropped an image in a review comment, pressed "Approve only", and checked the
  refusal shows once, in the comment's form on the phone and under the verdict on the desktop, with
  the image kept and the spec not approved. Happy-dom's `review.test.tsx` "at %i px, the verdict's
  refusal is in the comment form", at 402 and 1440 px, checks the refusal, its place, its
  announcement, and that no approval is committed; "a verdict after a comment with an image was
  cancelled deletes the image" checks the image's fate once the comment is cancelled.
- **Alternatives considered**: keeping it at the phone size, where the sheet lies over the page's
  end: the happy-dom test already places the refusal by width, which is what the sheet changes.
- **If wrong**: a refusal hidden under WebKit's real sheet goes unseen; the layout checks of the
  review page with an open comment still run at both sizes.
- **Where**: task 6.

## R24: "Add image" is checked in happy-dom

- **Decision**: the browser test 'US1.3: "Add image" picks a file' is removed.
- **Rationale**: it chose a file through "Add image"'s input, and checked the link at the cursor and
  the saved image. Happy-dom's `editor.test.tsx` "a draft that gets an image opens at its folder's
  proposal" picks a file through the same input and checks the link, the saved image, and the draft
  moved to its folder; `userEvent.upload` opens no real picker in WebKit either. The link's place at
  the cursor is the drops' and pastes' code, checked in WebKit by "US1.1: a screenshot dropped
  anywhere on the page is linked at the cursor".
- **Alternatives considered**: none: the browser adds nothing a picker would need.
- **If wrong**: a WebKit-only failure of the file input goes unseen; the input is a plain
  `<input type="file">`.
- **Where**: task 6.

## R25: The editor's drop hint is checked by the layout checks

- **Decision**: the browser test "a file dragged over the editor shows it is taken" is removed.
- **Rationale**: it dragged an image over the editor's page, checked the drag was accepted, and saw
  "Drop to add to proposal.md". `layout.test.tsx` "the editor with an image's link, a refusal, and
  the drop hint", at both sizes and in both themes, drags an image over the editor and waits for the
  same hint, then runs the layout checks on it; "a drop outside every field stays in the app" checks
  that the page accepts a drag over its body.
- **Alternatives considered**: keeping it for its drag over the page's body: the kept drop test
  sends the same events to the page's body.
- **If wrong**: a hint shown for a drag over the field but not over the rest of the editor's page
  goes unseen.
- **Where**: task 6.

## R26: Task 6 as built

- **Decision**: "a chat whose last message has images opens at its end", kept at both sizes, moves
  from `attach.test.tsx` to the browser `session.test.tsx`, with its `chatImage` helper, so
  `attach.test.tsx` declares the phone at its top. `sizes.test.tsx`, at the desktop only, loses its
  phone branch (the 17 px text). The desktop's tests of `priorities.test.tsx` are two blocks, by
  mouse and by keyboard. Both sizes ran as R18 runs them. The phone runs 94 tests and skips 14, the
  desktop runs 70 and skips 38.
- **Rationale**: with `attach.test.tsx`'s 21 phone tests in a `describe`, its callback was 372
  lines, over Oxlint's `max-lines-per-function`; `session.test.tsx` is the file of the transcript's
  end and its scrollers, which differ by size, and has the same `scroller`. The phone's 17 px is
  checked on every page by the layout checks' `checkTextSizes`, at each size. One desktop block of
  four tests was 102 lines. The plan's counts were made before task 5 added `sizes-helper.test.tsx`,
  whose three tests run two and skip one at each size: 92 + 2 and 13 + 1, 68 + 2 and 37 + 1.
- **Alternatives considered**: several `describe("on the phone")` blocks of under 100 lines in
  `attach.test.tsx`: blocks that split the editor's tests at arbitrary lines.
- **If wrong**: a test in the file of the view it checks rather than the feature it came with;
  moving it back takes a `describe` per group of phone tests.
- **Where**: task 6.

## R27: The Neovim tests' hostile git configuration adds a failing template hook

- **Decision**: task 7's run with a hostile `HOME` adds `init.templateDir`, pointing at a template
  whose `commit-msg` hook exits 1, to the plan's `commit.gpgSign` and `init.defaultBranch`, and sets
  `HOME` inside the dev shell. The README's development section drops `cargo build -p uraeda-cli`,
  which `test:nvim` runs itself.
- **Rationale**: `helpers.repo` sets `commit.gpgSign = false` and `core.hooksPath` in each
  repository, and its `--initial-branch main` beats `init.defaultBranch`, so the plan's
  configuration passes with or without the isolation and proves nothing. The template's hook reaches
  every repository `git init` makes, and `ura`'s own commits run it: without the isolation 5 cases
  fail, with `minimal_init.lua`'s none. Nix itself reads `HOME`, so it is changed for the task only.
- **Alternatives considered**: the plan's configuration alone: a run that cannot fail.
- **If wrong**: a global setting no local one overrides and the template does not reach could still
  leak; `GIT_CONFIG_GLOBAL=/dev/null` ignores the whole file, so none can.
- **Where**: task 7.

## R28: The toasts' closings run on the desktop, under the test's clock

- **Decision**: "committing closes the page's toasts" and "discarding closes the page's toasts", in
  `priorities.test.tsx`, run under fake `setTimeout` and `clearTimeout` from before the Delete that
  opens the toast, never advanced, and poll for the Undo's end with the default timeout instead of
  `{ timeout: 2000 }`. They wait for a button with `expect.poll`, not `findByRole`, and move from
  the phone to the desktop, in a block of their own. `atSize` throws when called after a test of its
  scope or inside a test.
- **Rationale**: the 2-second poll stood for "well before the toast's own 5 seconds", a duration
  that a loaded runner can exceed without a bug. With the toast's timer faked, it cannot close by
  itself, so only the commit or the discard can close it, however long either takes. Testing
  Library's `findBy` ends each wait with a `setTimeout` of the page, which never fires under the
  fake clock. On the phone, the toast lies over Commit and Discard: under the fake clock, the click
  waits for it until the test's timeout, and the old tests took 5.9 seconds, passing because the
  click landed only once the toast had closed by itself. On the desktop, a click reaches both
  buttons. Breaks seen: without the commit's `closeUndoToasts()`, the commit test fails with
  `expected <button …> to be null`, and the same for the discard's; the old tests passed on the
  phone either way. The search for other `timeout:` options below their default (`vi.waitFor`'s 1 s,
  the browser `expect.poll`'s and Testing Library's 5 s) finds none: the rest raise a wait, and
  `cache.test.ts`'s `{ timeout: 50 }` is SQLite's busy timeout, an input of the code under test. The
  phone runs 94 tests and skips 16, the desktop runs 74 and skips 36: `sizes-helper.test.tsx` has
  two more tests, of a misplaced call, at each size.
- **Alternatives considered**: keeping them on the phone, pressing Commit through the keyboard: a
  path no finger takes while the toast is shown; a click with `force`: the toast takes it.
- **If wrong**: a toast that covers the commit bar on the desktop too would hang both tests until
  their timeout, with a failure screenshot that shows it. Whether the phone's toast should leave
  Commit and Discard reachable is the human's to decide.
- **Where**: task 6.
