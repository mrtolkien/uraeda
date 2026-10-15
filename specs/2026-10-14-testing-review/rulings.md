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
- **Where**: task 4. Superseded on the rebase onto `main`, which had fixed the same panic in
  `9bec9f7` ("fix: small test bugfixes"), with the same `catch_unwind` in `status_items` and its own
  core test, `status_returns_an_error_when_the_object_directory_disappears`: `main`'s code and test
  are kept, and this branch's are dropped. The teardown order stays, merged into `main`'s request
  settling (R29).

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

## R29: The rebase onto `main` adds its new checks to the task graph

- **Decision**: `main`'s `ready` gained the `@uraeda/ui` package's build and smoke test, and its
  tests in `packages/uraeda`. They become the tasks `ui:build` (`node scripts/build.ts` in
  `packages/uraeda`, after `web:build` and `binding:build`, its built `dist/`, `plugin/` and `web/`
  as outputs) and `ui:smoke` (`smoke.ts --binding packages/binding`, after `ui:build` and
  `binding:touch`), both in `ready:typescript`; `ts:test` runs the `@uraeda/ui` project too, depends
  on `web:build`, and reads the built web UI, since `main.test.ts` now starts the server on it. The
  web helpers keep `main`'s request settling, named `settleRequests`, with this branch's order: the
  page unmounted, its requests settled, then the hosts and the sessions closed, in one `afterEach`.
  The R10 `{ file: false }` option is added to `main`'s new `loadEnv(root: string | null, ...)` and
  `loadDataDir(root, core, ...)`.
- **Rationale**: the toolchain decision's `ready` runs every check; `main` added these while this
  branch was open, and the first run after the rebase failed on `main.test.ts` "a server that
  answers 404" with "the web UI is not built", because `ts:test` ran before `web:build`.
- **Alternatives considered**: leaving the smoke test to CI only: the decision keeps CI-only checks
  for slow or secondary ones, and `main` ran it in `ready`.
- **If wrong**: a task reading a file outside its inputs replays a stale pass locally; CI's uncached
  run still runs it.
- **Where**: the rebase, after task 7.

## R30: Three tests from `main` and this branch that failed under load, fixed on the rebase

- **Decision**: `session-aside.test.tsx` "US1.4" waits for "Changed on the branch", which draws once
  the branch's changes are read, after the column; `shell.test.tsx` "US6 5" waits for the undo's
  whole text, since a read during the write sees an empty file; `live.test.ts` "a change in one
  repository sends no update to another" checks that the first repository heard none of the second's
  `Priorities` updates and one `Workspace` update, instead of an exact list, which `main`'s new
  `Feature` and `BranchChanges` updates on a branch switch broke.
- **Rationale**: each failed in `vp run ready` after the rebase and passed alone; the first two read
  the page or the file before what they check was there, the third asserted more than its scenario,
  as the task 3–4 review had warned.
- **Alternatives considered**: none: the toolchain decision fixes a test that fails without a bug in
  the pull request that finds it.
- **If wrong**: a write that truncates `PRIORITIES.md` before writing it can also show a reader,
  such as a live view, an empty file; that is the product's, not this test's, and is listed for the
  human in the pull request.
- **Where**: the rebase, after task 7.

## R31: Task 6 applied again on `main`'s browser tests, and `main`'s new tests sized

- **Decision**: the rebase took `main`'s `attach.test.tsx`, `overlay.test.tsx`, and
  `session.test.tsx`, losing task 6's changes to them; they are made again. `attach.test.tsx` loses
  the SC-002 test (R5) and the five of R21 to R25, and declares the phone at its top; "a chat whose
  last message has images opens at its end" moves to `session.test.tsx`, at both sizes (R26), its
  `sendMessage` imported as `sendTo` beside the helpers' own. `overlay.test.tsx`'s two history races
  run on the phone. Every covering test the removals' rulings name still exists on `main`. The 39
  browser tests `main` added get these sizes, and none is removed:
  - `layout.test.tsx`, at both: a feature's session at its implementation with its column, a chat
    with one reply, a round with a settled point's comment and another's form open, the notes
    restored after a reload, and the "Leave page?" and "Discard your comment?" confirmations, each
    in light and dark; on the desktop: the session with its column hidden, in both themes, and at
    1024 px with the sidebar open; on the phone: the session with its progress line open, in both
    themes.
  - `session.test.tsx`, at both: US4.2–US4.4's Jump to the latest, which runs the layout checks with
    the button shown; on the phone: an ended session's Jump to the latest, a message sent from the
    end, and US3.3's progress line across a link and Back; on the desktop: a session opened from a
    task view's pane, the column turning into the line across 768 px, a paragraph keeping its place
    across 768 px, and the line opened moving the place read. `main`'s "a working session: a page of
    its own" stays at both, with its layout checks, and "Back from a session view" too (R26).
  - `overlay.test.tsx`: "a confirmation is as tall as what it asks" at both, and "a confirmation
    answers once the browser went back over its entry" on the phone.
  - `fields.test.tsx`, at both: the fields' rows (the round's, the review's, the editor's, quick
    add's, the composer's), the content and the forms' buttons that do not move at the first letter,
    and "Ctrl+Enter saves" on a wide screen only; on the desktop: the resize handle.
  - `leave.test.tsx`, on the phone: Back from unsaved text, and "Leave page" as the main button.
- **Rationale**: the audit's rules (US4): a layout check of a governed page at both sizes; a
  behaviour at the size its scenario is about, at both only where the layouts differ, the phone
  otherwise. The early returns `main` added become `atSize` blocks, as task 5's did. A field's
  height, what moves as one fills, and a confirmation's height depend on the width, its text size,
  and the sheet against the dialog; Back over an entry, a button's colour, and a session's following
  do not, as the window scrolls the transcript at both sizes since `main`'s session view. A resize
  handle is dragged with a mouse. `overlay.test.tsx`'s "as tall" test stays last: it leaves its
  confirmation open, and its history entry with it, which failed the three history tests run after
  it with `expected 'Discard your comment?' to be undefined`. Counts, both sizes at once as R18 runs
  them: the phone runs 125 tests and skips 24, the desktop runs 105 and skips 44.
- **Alternatives considered**: `main`'s new tests at both sizes, as written: the early returns ran
  as passes at the other size, which US4.2 forbids, and the behaviour tests doubled.
- **If wrong**: a phone-only test of a behaviour that breaks only on the desktop, or the reverse,
  goes unseen; moving it is one `describe`.
- **Where**: the rebase, task 6.

## R32: US3.3 reads its position once the progress line's sections are drawn

- **Decision**: `session.test.tsx` "US3.3: the open progress line survives a file link and Back"
  waits for the open line's task list and its "Changed on the branch" text before scrolling to the
  `plan.md` link and reading the position. The product is unchanged.
- **Rationale**: it failed on the phone in `vp run ready` with `expected 702 to be 68`; with 48 busy
  loops on 32 cores, 8 runs out of 10 failed with the same values, and alone it passed. A trace of
  the window's scrolls showed the cause: the `plan.md` link, in the line's "Feature" section, shows
  before the sections above it, each read in a `Suspense` of its own; the plan's 11 tasks drew 76 ms
  after the position was read, growing the page from 3254 to 3878 px and moving the link from 437 to
  1061 px, below the window. The click then scrolled the link into view, to 702, and clicked it
  there; the page saved 702 for Back and restored it, as it should. With the waits, 10 runs out of
  10 passed under the same load.
- **Alternatives considered**: `grown()`, the helper that waits for the page's height to stay the
  same for 200 ms: a section read slower than that still moves the link; restoring the scroll in the
  product: it restored the position the human left at.
- **If wrong**: a section added above the link later moves it again; the failure's 702 against a
  smaller number shows it.
- **Where**: the rebase, task 6.

## R33: The failed session's layout checks wait for "Allow and retry" to be enabled

- **Decision**: `layout.test.tsx` "a feature's session, failed, and its agent section", in both
  themes, waits for "Allow and retry" to be enabled before its layout checks.
- **Rationale**: the button shows disabled while the session still works, at half its opacity, and
  fades in over a transition once enabled. The test waited for the button alone: axe-core measured
  its contrast mid-fade, failing with `color-contrast: <span …>Allow and retry</span>` on the
  desktop in 3 runs out of 8, alone. A trace showed it found disabled at an opacity of 0.5, still
  0.5 once `drawn()` returned, as the fade had not started when `drawn()` read the animations, and
  0.75 as axe-core ran. With the wait, 8 runs out of 8 passed.
- **Alternatives considered**: waiting in `checkAccessibility` for every transition: the fade had
  not started when the animations were read.
- **If wrong**: another control that fades in after its data comes fails the same way; its failure
  names the control.
- **Where**: the rebase, task 6.

## R34: `vp run coverage`, as built

- **Decision**: Vitest's `coverage.include` is `src/**/*.{ts,tsx}` and `scripts/**/*.ts`, with the
  tests' helpers (`__tests__/`, `__browser__/`), the lint fixtures (`__lint__/`), declaration files
  and the generated theme excluded; every package's `scripts/` counts, the server's and the web UI's
  tools with `@uraeda/ui`'s. The task runs `mkdir -p coverage` first, runs the `@uraeda/ui` project
  with the other unit projects, and depends on `web:build` too. The summary's test lives with the
  server's tests, and `ts:test` reads `scripts/**`. The root `package.json` declares
  `"type": "module"`.
- **Rationale**: run with `--project`, Vitest matches `include` from each project's folder, not the
  root's: the plan's `packages/server/src/**` matched no file, and the report read `0/0`. A glob
  cannot tell one package's `scripts/` from another's, and `@uraeda/ui`'s code is its `scripts/`.
  The binding's only `*.ts` besides its tests is `test-utils.ts`, a helper: its code is Rust, and
  its loader napi's. Without the exclusions, the lint fixtures and test helpers counted as code.
  cargo-llvm-cov failed with "failed to create file `coverage/rust.lcov`" on a fresh checkout.
  `ts:test` runs `@uraeda/ui` and needs the built web UI since R29. Node warned that the root's
  `scripts/coverage-summary.ts` had no module type; the root's only other script is the ESM
  `vite.config.ts`. The spawned `ura` is counted: the CLI tests keep the environment, so `ura`, an
  instrumented build, writes its profile where `LLVM_PROFILE_FILE` says, and
  `crates/cli/src/main.rs` reads 55 of 57 lines covered; `main.rs` has no tests of its own.
- **Alternatives considered**: running `vp test --coverage` without `--project`, so globs match from
  the root: it would run the browser instances; listing the server's and the web UI's tools by name
  in `exclude`: a list to keep in step with the folders.
- **If wrong**: the TypeScript total counts tools no unit test runs, a few points lower; an
  `exclude` per tool lifts it.
- **Where**: task 8.

## R35: Following the end ignores the window's scrolls until the place is put back

- **Decision**: `useFollowEnd` takes the window's position as the human's again a frame after the
  layout for a new width class commits, in the frame where `useKeepPlace` puts the place back, not
  at the commit. The test is unchanged.
- **Rationale**: `session.test.tsx` "the column turns into the collapsed progress line across 768
  px, at the same position" failed in `vp run ready` on the desktop with
  `expected 1493.953125 to be less than 2`; with 48 busy loops on 32 cores, 3 runs out of 8 failed
  with the same value, and alone it passed. A trace of the window's scrolls showed the cause: the
  narrow layout, shorter, clamped the window at its end, and its scroll event came after React
  committed the narrow layout but before `useKeepPlace`'s frame. `useFollowEnd` ignored a scroll
  only while the drawn width class differed from the window's, so it took the clamp for the human
  reaching the end: `useKeepPlace` put the place back, and in the same frame the transcript's resize
  made `useFollowEnd` scroll to the end. A human reading a working session in the middle while
  resizing the window across 768 px was thrown to its end the same way. With the fix, 16 runs out of
  16 of the file's three tests across 768 px passed under the same load.
- **Alternatives considered**: `useKeepPlace` telling `useFollowEnd` once it put the place back: a
  shared state between two hooks for what one frame orders.
- **If wrong**: a human who scrolls to the end in the very frame the width class changes is read a
  frame late; the next scroll reads them again.
- **Where**: task 8's `ready`, on `main`'s session view.

## R36: CI's jobs run `vp` through pnpm, with the action versions of `npm.yml`

- **Decision**: each job runs `nix develop --command pnpm exec vp run --no-cache <task>`, `neovim`'s
  `test:nvim` and `coverage` included; `notInCi` counts a task as run only after
  `vp run --no-cache`, outside a YAML comment. The jobs use `actions/checkout@v6` and
  `actions/upload-artifact@v7` instead of `@v4`; the workflow declares
  `permissions: contents: read`; the `release` and `coverage` jobs end with the clean tree check, as
  the others do.
- **Rationale**: the flake's dev shell has Node and pnpm but no `vp`, which comes from
  `node_modules`: the plan's `nix develop --command vp run …` would fail with "command not found";
  today's CI already runs `pnpm exec vp`. `test:nvim` and `coverage` are uncached, so `--no-cache`
  changes nothing for them, and one pattern reads every job. `npm.yml`, added on `main`, uses
  checkout `v6` and upload-artifact `v7`, both existing tags, checked with
  `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`; one version per action across the workflows. No
  job writes to the repository.
- **Alternatives considered**: adding `vite-plus` to the flake: a second pin of the version
  `package.json` already pins.
- **If wrong**: a job's step names a version that changes its inputs; actionlint 1.7.12 reports no
  problem in `ci.yml` and the setup action.
- **Where**: task 9.

## R37: CI measured on one run, without the reruns or the scratch branch

- **Decision**: task 10 ran CI once on the branch, by hand (run 38681678318), and measured it; the
  10 reruns of SC-002 and US1.1, the cancellation of US3.2, and the scratch branch of US3.4 were not
  run.
- **Rationale**: the human asked for one run, and no scratch branch, on 2026-10-15. The run passed
  every job in 6 min 7 s (SC-001, under 8 minutes; up to 15 before), with the browser jobs' summed
  file times at 162.7 s (phone) and 149.0 s (desktop) (SC-004, at most 180 s). Locally,
  `vp run ready` passed three times in a row after the rebase, twice uncached, which stands in for
  SC-002's reruns.
- **Alternatives considered**: the plan's 10 reruns and scratch branch: declined by the human.
- **If wrong**: a flake that fails one CI run in ten shows on the pull request's runs instead; the
  clean tree check's failure path is untested until a job leaves a file changed.
- **Where**: task 10.

## R38: The tests follow `main`'s new workflow prompts and statuses, and following the end follows a run's ending

- **Decision**: `main`'s d25a7e7 ("new auto-filled prompts for the UI") changed the workflow's
  message, the session statuses, and the feature page's agent panel, and updated only the runner's
  own tests: 19 tests of `vp run ready` failed, and one browser test failed on the phone. Each was
  judged against d25a7e7's code and its tests (`runner/__tests__/message.test.ts`, `status.test.ts`,
  `crates/core/tests/steps.rs`):
  - **(a) Expectation outdated, updated to the new behaviour exactly**, each still checking what it
    checked:
    - `sessions.test.ts` "US2.1: WorkflowMessage gives the message…": the message is now the run's
      goal and where it stops; the fixture's `cli-tuis` spec has `plan-review: true`, so "Write the
      plan, starting with …plan.md. Stop when the plan waits for my review, …", the exact text.
    - `sessions.test.ts` "US3.6: SessionList … needs you first" and `shell.test.tsx` "US3.6: needs
      you sorts first in its group": a failed session is now `attention`, "Needs attention"; the
      order is unchanged (`attention` takes `failed`'s rank, after `needs-you`), and both still
      check it.
    - `sessions.test.ts` "session.stop stops the turn, and keeps the session": a stopped latest turn
      is now "Needs attention", reason `stopped`, before and after `session.seen` (status.test's "a
      stopped turn, seen"), where it was "New reply" then "Stopped". It still checks the interrupt,
      the turn's `stopped` state, that the session's record stays, and `session.seen`.
    - `agent-panel.test.tsx` "Review and start the agent opens the session…" and "US2.5: during a
      chat turn…", and `commit-actions.test.tsx` "US2.1", "US2.2", both "US2.4", "the workflow's
      message goes before what the human typed", "Try again after a refused hook…", and "a refused
      hand-over says why…": the `MANUAL` and `ANSWERED` messages, exact, in the new form. US2.2's
      sent message now contains the whole `ANSWERED` instead of the trigger's sentence, which no
      message has any more ("the message does not say what the human did").
    - `commit-actions.test.tsx` "approving a spec…", "requesting changes…", and "committing a
      proposal and starting a feature…": they matched the trigger's sentence ("The human approved
      the spec."), now gone; they match the step's goal and stop the commit leads to instead: the
      plan (`recurring-tasks` has `plan-review: true`), the spec's revision, and discovery for the
      proposal and the started feature.
    - `agent-panel.test.tsx` "the feature page shows the session's status and Open the session": a
      workflow run that ends while the step still waits on the agent is now "Needs attention",
      reason `halted` (status.test's "a workflow turn that ended while the step still waits on the
      agent"); the test checks that label and its dot instead of "New reply".
    - `agent-panel.test.tsx` "Stop stops the turn, and Review and try again…" and "Review and try
      again after a failure…": "Review and try again" is gone by design (AgentPanel's comment: no
      start "when its latest turn needs the human's attention, which they answer in the session").
      Renamed "Stop stops the turn, and the session then says the agent was stopped" and "a failed
      run needs attention, and the session says it failed", they check the run's line (`Stopped`,
      `Failed`), "Needs attention", that the panel offers no start, that "Open the session" leads to
      the session, which shows the new banner ("You stopped the agent.", "The agent's run failed."),
      and that nothing more was sent.
  - **(b) A bug in the new code, fixed**: the browser test `session.test.tsx` "an ended session
    scrolled up also offers Jump to the latest", on the phone. The fake agent's exit fails the run,
    and d25a7e7's banner ("The agent's run failed.") is drawn below the transcript in the commit
    that ends the session's work. `useFollowEnd` follows only while the session works: the commit
    that turns it off also drew the banner, so a human reading the end was left 96 px above it, the
    banner out of view, with "Jump to the latest" shown though they never scrolled. The test then
    scrolled to the end and found the button still there two frames later. Alone, it failed 3 runs
    out of 3, and 8 out of 8 under 48 busy loops on 32 cores; after the file's other tests, it
    passed. `useFollowEnd` now follows once more as the session stops working. The new test "a run
    that fails while the human is at its end keeps how it ended in view" failed first on the phone
    (the banner never came into view); with the fix, both tests passed 10 runs out of 10, 8 of them
    under the same load.
- **Rationale**: the [implementation reference](/skills/uraeda/references/implementation.md)'s
  catch-up: a failure the default branch brings in is fixed like a final review finding. d25a7e7's
  updated runner tests state the new messages and statuses, so the old expectations describe
  behaviour that was replaced on purpose, not a regression; the banner left out of view is behaviour
  no test of d25a7e7 asked for, and it breaks US4.4 (at the end, no button).
- **Alternatives considered**: drawing the banner inside the transcript's observed element: the
  observer is disconnected in the same commit, so it would not follow either. Keeping a way to retry
  from the panel: d25a7e7 removed it on purpose.
- **If wrong**: a banner or a line that comes in a later commit than the end of the work is not
  followed; its failure shows "Jump to the latest" after a run ends.
- **Where**: the rebase onto `main` with d25a7e7.

## R39: The unit tests' tasks select their Vitest projects by exclusion

- **Decision**: `ts:test` and `coverage` run `vp test --project '!phone' --project '!desktop'`,
  every project of `test.projects` but the browser's, instead of naming the four unit projects one
  by one. The toolchain test checks that every project of `test.projects`, by its name (a package's
  `package.json` name, a config file's browser instances), is run by some `vp test` of `ready`'s
  tasks, and says to select by exclusion or add a task when one is not.
- **Rationale**: the final review found that a package added to `test.projects` would have been run
  by no task of `ready` and no CI job, silently, where `ready` ran a bare `vp test` before this
  branch: the toolchain decision's `ready` runs every check. The new table row "a Vitest project no
  task selects" failed first (the check returned nothing); with `ts:test`'s `uraeda-web` removed by
  hand, the repository's check failed with its message. `vp run --no-cache ts:test` ran the same 62
  files as the four named projects (`vp test list --filesOnly --json`: 3, 25, 2, and 32).
- **Alternatives considered**: keeping the explicit list with only the check: a new package then
  fails `ready` until it is named in two tasks, where exclusion runs it at once. Reading the names
  from `vp test list` in the test: authoritative, but it starts Vitest inside a unit test.
- **If wrong**: a new browser project, or a project that should not run in `ts:test`, runs there
  until it is excluded; a project named another way than the check reads is reported as unknown, and
  the check is taught its name.
- **Where**: the final review, finding I1.

## R40: The smoke test times the first page only under `--timed`, which `bench` and the release pass

- **Decision**: `smoke.ts` waits for each start's first 200 up to its `WAIT_MS` (10 s), a bound only
  a broken server reaches, and asserts no duration; the outside-git start waits the same way, where
  it read `/` once. `--timed` keeps the run-ui feature's SC-002 ("the server answers its first
  request within 2 seconds"), now checked on the answer itself, not only on the polls before it, and
  prints how long it took. `vp run bench` runs it with `--timed`, after `ui:build`, and `npm.yml`'s
  release gate passes `--timed`, so the gate is unchanged. `ui:smoke` in `ready` runs it untimed.
- **Rationale**: since R29 `ready` runs the smoke test under the load of its other checks, and its
  2-second deadline was a duration check outside a benchmark, against the code quality decision and
  this feature's SC-005. With a preload answering 503 for the server's first 3 seconds, the old
  script failed ("/ did not answer 200 within 2000 ms of the start"); the new one passes untimed and
  fails under `--timed` ("…(SC-002), but 503"). `vp run --no-cache ui:smoke` passed, and
  `vp run bench` passed with "the repository's page answered 165 ms after the start". The release
  gate runs on a runner of its own, not under `ready`'s load, and is where the distribution decision
  checks the package before publishing, so it keeps SC-002.
- **Alternatives considered**: a separate benchmark script for SC-002: a second install of the
  package for one number. Dropping SC-002 from the gate: the run-ui feature measured it there.
- **If wrong**: a start slower than 2 seconds passes `ready` and shows only in `vp run bench` or the
  release gate; a slow runner can fail the gate, which stops the release before anything is
  published.
- **Where**: the final review, finding I2.
