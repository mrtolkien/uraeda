# Rulings: Fix testing

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Retain useful cases while measuring boundary costs

- **Decision**: Existing tests are retained by default. An inventory records every baseline path;
  removals, moves, skips, and weakened expectations require specific behavioral evidence.
- **Rationale**: The approved second round replaces the failed blanket deletion. Reusing immutable
  setup and narrowing focused imports targets cost without discarding distinct cases.
- **Alternatives considered**: Restore the previous flow rebuild, which lost independent guards and
  retained App fanout; use a coverage threshold, which the active toolchain decision forbids.
- **If wrong**: Revisit a specific retained or replaced case from its recorded behavior and
  measurements, rather than imposing a test quota.
- **Where**: Tasks 2 through 7; the inventory and coverage comparisons are added alongside their
  actual evidence.

## R2: One lightweight selection entry and shared UI transforms

- **Decision**: Fast uses its own configuration and one family/input registry. UI transforms are
  shared with production; ordinary ready still includes every existing test.
- **Rationale**: Existing package configurations eagerly import native freshness and dev-server
  setup before selecting tests. Filtering those configurations pays the wrong cost first.
- **Alternatives considered**: Direct-import-only selection, which skips indirect consumers; copied
  plugin configurations, which drift; globally shared mutable test state, which breaks isolation.
- **If wrong**: Adjust the measured discovery and family boundaries while preserving complete ready
  and explicit deferred checks.
- **Where**: Task 1's scripts and configurations; Task 2 proves the Composer and native consumers.

## R3: Preserve project constitutions while revising default guidance

- **Decision**: No constitution file is edited, including the skill's installed constitution
  template. Testing guidance follows each project's constitution when it is stricter.
- **Rationale**: Only the human amends constitutions. The current project's behavior-based amendment
  is already effective; the approved spec proposes no further amendment.
- **Alternatives considered**: Quietly changing the template's constitutional requirement during a
  testing rewrite, which would exceed approved scope.
- **If wrong**: A human may separately amend the template; this feature must not imply that its
  guidance overrides a project's higher rules.
- **Where**: Task 6's references, templates, and example.

## R4: Baseline validation before implementation

- **Decision**: Preserve the observed baseline failures and timings as evidence; do not describe
  cancelled browser jobs as test failures or stable passes.
- **Rationale**: At `29a1e418`, ready's TypeScript run passed 2,027 tests and failed one existing
  stack assertion rejecting `Prose`'s Markdown import. Nextest passed 1,040 tests in 44.108 seconds,
  with 10 pre-existing skips. TypeScript's Vitest duration was 367.45 seconds under concurrent
  validation. Both browser commands exited 137 after the failing task cancelled the graph; neither
  completed.
- **Alternatives considered**: Rerunning until green, which would conceal the observed failure;
  treating the browser exit code as proof of memory exhaustion without evidence.
- **If wrong**: Reproduce the specific assertion or inspect cancellation evidence; keep comparable
  standalone measurements separate from concurrent baseline timings.
- **Where**: Before Task 1. Main already contains the stack-test repair, which is integrated before
  the pilot. The temporary raw log is diagnostic only; these facts remain durable in git.

## R5: Integrate the completed keyboard, transcript, and inbox changes before the pilot

- **Decision**: Rebased onto main through `85b4f233`. Preserve Ctrl+Enter submission, bounded
  transcript mounting, shared Prose rendering, and the updated rule against noisy inbox notes.
- **Rationale**: These changes were approved and merged while planning. Their contract counts and
  structural lint checks protect requested behavior, consistent with the testing spec's revised
  assertion rule.
- **Alternatives considered**: Deferring integration until final review, which would build the
  Composer pilot against obsolete keyboard behavior and leave the known baseline stack failure in
  place.
- **If wrong**: Resolve a specific integration defect against the current main behavior, never
  restore the old Enter-to-send rule or delete the new bounded-mount checks.
- **Where**: Tasks 1, 2, 5, 6, and 7. The plan's rule map includes the new UI guarantees.

## R6: Product coverage and test inventory before repairs

- **Decision**: Use the completed coverage run and [baseline inventory](test-inventory.md) to
  diagnose lost protection. The inventory retains every baseline path by default; individual
  expectation changes still need behavioral evidence.
- **Rationale**: On main through `85b4f233`, before implementation, TypeScript coverage passed 2,031
  tests in 147 files (271.23 seconds). It measured 80.87% of lines (13,966/17,268), 79.60% of
  statements, 75.93% of branches, and 78.36% of functions. Rust line coverage was 94.8%; its
  coverage profile passed 1,039 tests with 11 existing skips in 15.986 seconds. The ordinary ready
  profile retains its memory-limit case; coverage's extra exclusion is not a new skip.
- **Alternatives considered**: Reusing the failed rewrite's smaller coverage denominator, treating
  coverage as a pass threshold, or using counts alone to claim equivalent protection.
- **If wrong**: Compare changed product paths and owning assertions on equivalent coverage inputs;
  coverage cannot establish that a particular important guard is asserted.
- **Where**: Tasks 2 through 7. Raw LCOV files are temporary diagnostics; this summary and the
  inventory are durable. Focused test/helper directories must be excluded from product coverage
  consistently with existing test/helper directories.

## R7: Run fast's TypeScript checks beside its native and Rust chain

- **Decision**: `scripts/fast-check.ts` runs `binding:touch` first when selected, since its build
  regenerates the committed declarations the type check reads. Then `vp check` (and `specs:check`)
  runs concurrently with the ordered Rust chain (`cargo fmt`, `clippy`, `nextest`); the run waits
  for both and fails with the one error, or both in an `AggregateError`. Vitest still starts only
  after both succeed. The binding build already led the native chain, so the critical path is
  unchanged.
- **Rationale**: The core pilot's measured sequential command took 52.18 to 76.50 seconds warm and
  59.98 seconds cold for `uraeda-core` alone; reverse dependents add about 10 seconds. The type
  check reads committed declarations and needs no native output, so its 9 to 14 seconds overlapped
  nothing. Concurrent, the same edit with `uraeda-core`, `uraeda-cli` and `uraeda-lsp` took 46.41 to
  50.73 seconds under a load average above 60. No check, test, or package was removed.
- **Alternatives considered**: Dropping clippy's `--all-targets`, running fewer Rust packages, or
  splitting the Cargo build directory, which delete protection or defeat the seeded cache.
- **If wrong**: Interleaved output from the two chains is harder to read; prefix it or move the type
  check after the native build, then re-measure SC-002.
- **Where**: Task 2's core pilot; Task 7's edit matrix re-measures it.

## R8: Fast's binding and Composer membership follow the pilots' actual files

- **Decision**: Fast's binding family runs `packages/binding/contracts.test.ts` only; the legacy
  `index.test.ts`, `repositories.test.ts`, `stories.test.ts` and `test-utils.test.ts` stay in ready.
  The UI family's anticipated `src/__tests__/composer.test.tsx` is replaced by
  `src/__focused__/composer.test.tsx`. The discovery test's `ComposerImages.tsx` case now expects
  both suites that import it, the new focused Composer suite included.
- **Rationale**: The contracts suite proves the binding's transport (camelCase shape, a real write
  and reload, synchronous throws, rejection codes) in about 0.2 seconds; the legacy suite's watcher
  and git cases remain detailed ready coverage. The focused Composer suite imports
  `ComposerImages.tsx` through `Composer.tsx`, so excluding it would be the wrong selection.
- **Alternatives considered**: Keeping `index.test.ts` in fast, which adds its git fixtures and
  10-second watcher bound to every core edit.
- **If wrong**: Add a legacy binding case to fast only with its measured cost.
- **Where**: `scripts/fast-selection.ts`, `scripts/__tests__/fast-discovery.test.ts`.

## R9: Fast takes its heavy slot itself, after selecting

- **Decision**: The `fast` task runs `scripts/fast-check.ts` in a plain `test-run.ts` run folder,
  without `--lock heavy`. The script selects first; an escalation runs `vp run ready` holding no
  slot, and otherwise it takes one of the machine's two heavy slots in its own process (`acquire`
  from `test-run.ts`) around its checks and tests, released when they end.
- **Rationale**: Under the wrapper's lock, an escalation ran ready inside a held slot, and ready's
  `ts:check`, `rust:clippy` and `rust:test` each wait for one: two checkouts escalating at once held
  both slots and waited forever (wave 1 review, item 5).
- **Alternatives considered**: Releasing the wrapper's slot before ready, which `test-run.ts` cannot
  do for its command; one slot per command, which would let fast's concurrent type check and Rust
  chain take both slots of the machine.
- **If wrong**: A fast run killed with SIGKILL leaves its lock file, which the next run frees by its
  owner's liveness, as for every other slot.
- **Where**: `vite.tasks.ts`, `scripts/fast-check.ts`, `scripts/test-run.ts` (`lockFolder`
  exported); `scripts/__tests__/fast-check.test.ts` and the toolchain test.

## R10: Selection interfaces after the wave 1 review

- **Decision**: `Change` is `{ path, deleted, added }`, `added` for git's `A` or an untracked path.
  An edited existing test outside fast's lists is named in `deferred` (`existing test <path>`); only
  an added unknown test escalates to ready. A family's `inputs` list every file outside its root
  that its sources import, and the focused configuration instantiates each family whose inputs match
  a related path. `rustCommands(rust)` builds the Rust chain: selected crates plus their reverse
  dependents, clippy on all of them (`--workspace` for a root change), nextest on the default
  members or the selected crates without `uraeda-binding`. `unproven(families, projects)` names a
  selected whole family with no discovered test, which fails the run. Configuration files are
  matched by name (`vite*.ts`, `*.config.{js,ts}`, `tsconfig*.json`, `package.json`, `pnpm-*`,
  `flake.*`, `rust-toolchain.toml`).
- **Rationale**: The wave 1 review found an edit of a file another package imports ran none of its
  consumers, a core edit skipped `uraeda-cli` and `uraeda-lsp`, a root change ran nextest on the
  workspace (which links napi into every crate's tests), an edited legacy test escalated to the full
  ready run, and a source named `config.rs` broadened everything.
- **Alternatives considered**: Instantiating every family for any related path, which loads the
  server's whole graph for a Composer edit; reading `cargo metadata` at run time, which adds a cargo
  call to every fast run (a test compares the static map with it instead).
- **If wrong**: A missing import owner fails the selection test that walks each family's imports; a
  missing reverse dependent fails the `cargo metadata` comparison.
- **Where**: `scripts/fast-selection.ts`, `scripts/fast-check.ts`, `vite.fast.config.ts`, and their
  tests.

## R11: The focused UI project and endpoint follow the web configuration and the server

- **Decision**: `uiTestOptions()` in `packages/web/vite.transforms.ts` holds the web tests' settings
  (time zone, happy-dom page URL and frame loading, the binding's per-file setup, the UI setup,
  timeout); the web configuration and fast's UI project both spread it. The request fixture accepts
  a chat upload only with `chat=1`, no `path`, and a file part, records the query's `name`, and
  answers a `DELETE` of a chat image it did not save, or the case did not start with (`chatImages`),
  with 404. `rewritten` moved to `fate/select.ts`, shared by the app and the fixture.
- **Rationale**: The copied UI settings dropped per-file isolation; the fixture accepted uploads the
  server refuses, so a client dropping `chat=1` stayed green (wave 1 item 6, wave 2 items 1 and 2).
- **Alternatives considered**: Loading the web configuration in fast, which imports the native
  freshness check and dev server (R2).
- **If wrong**: Move further shared settings into `uiTestOptions()` rather than copying them.
- **Where**: `packages/web/vite.{config,transforms}.ts`, `vite.fast.config.ts`,
  `packages/server/src/__tests__/request-fixture.ts`, `packages/web/src/__focused__/helpers.tsx`.

## R12: Fixture history is built once per test file and cloned for each caller

- **Decision**: `fixtureRepo(name)` builds the named history once per test file, in a
  `uraeda-template-*` folder no caller receives, and returns a recursive copy of it for each call,
  made with `COPYFILE_FICLONE` (a copy-on-write clone on btrfs, an ordinary copy elsewhere) and
  verbatim symbolic links. A template whose folder is gone, because the file's `afterAll` removed
  its temporary folder and the worker went on to another file, is built again. A failed build or
  copy removes its folder at once. The repository helpers (`isolateGit`, `temporaryFolder`,
  `fixture`, `git`, `fixtureRepo`) moved to `packages/binding/test-repos.ts`, re-exported unchanged
  by `test-utils.ts`, which had reached the 500-line limit; fast's binding loaders and
  `storybook:build`'s inputs name the new module.
- **Rationale**: The plan said "once per isolated worker"; the isolated unit is the test file, whose
  temporary folder `test-setup.ts` removes after it. A template kept per process across files would
  need a folder outside the file's ownership. Per file, the server project's 522 calls took 69
  builds instead of 522, and the web project's 871 calls 69. Hard links and `git clone --shared`
  would share mutable git data (config, index, refs, packs) between callers; the isolation case
  fails on both a shared directory and a hard-linked copy.
- **Alternatives considered**: A template per process or per run on disk, keyed by the fixture's
  content (more reuse, but a lifetime outside the file's cleanup and cross-worker locking);
  `git clone --local` (hard-linked objects); templating `addStoryFeature` (its committed preview
  decision names each call's own log file, so its history differs per call).
- **If wrong**: A test that needs commit times or object ids unique per repository builds its own
  commits; `fixtureRepo`'s copies share the template's ids within a file.
- **Where**: `packages/binding/test-repos.ts`, `packages/binding/test-utils.ts`,
  `packages/binding/test-utils.test.ts`, `scripts/fast-selection.ts`,
  `scripts/__tests__/fast-selection.test.ts`, `vite.tasks.ts`.

## R13: Server and UI fixture teardown stays as it is

- **Decision**: No lifecycle helper changed. Profiled per test: the preview server's teardown
  (`closeAllConnections`, `close`, `server.stop()`) took 0 to 31 ms across `proxy.test.ts`'s 16
  cases; the UI helpers' `afterEach` (settle requests, close hosts, settings, sessions, runners) 8
  to 39 ms and `renderPage` 4 to 176 ms across `review.test.tsx`'s 50 cases, whose time is in their
  own interactions (about 2 s each). A running preview's setup spends about 560 ms in `ready`, the
  runner's first index read after `POLL_MS` (500 ms), and about 300 ms in `addStoryFeature`'s
  commits.
- **Rationale**: The plan allows lifecycle changes only where profiling shows overhead; neither
  teardown is material, and the readiness wait is a product interval the plan forbids altering.
- **Alternatives considered**: An injectable poll interval for tests, a production change to shave
  about 0.5 s from each running-preview case.
- **If wrong**: Task 7's matrix names the preview cases as the server's slowest; the poll interval
  would need its own ruling and the human's agreement.
- **Where**: `packages/server/src/preview/__tests__/helpers.ts`,
  `packages/web/src/__tests__/helpers.tsx` (unchanged).

## R20: The install rollback case fails a first copy after it staged files

- **Decision**: `a_first_install_failing_after_staging_files_leaves_nothing` runs `ura install`
  under a POSIX shell's `ulimit -f`, the signal past it ignored, through the CLI tests'
  `ura_with_file_limit`. Each file is capped at the first embedded file's size, in 512-byte blocks:
  the first file is written whole, the copy fails with `EFBIG` at the first larger one, and the case
  asserts that file's name in the error, exit 1, and an empty `.agents/skills`. The capped run's
  coverage profile goes to `/dev/null`. The old `a_failed_first_install_leaves_nothing` is retained:
  it owns the distinct refusal when the staging folder cannot be made.
- **Rationale**: The old case fails before the temporary folder exists, so it passes with the
  cleanup removed; the new one fails then (`left: 1, right: 0`, the `uraeda.ura-tmp` folder left
  behind). The cap needs no product seam or dependency, and its file order and sizes are read from
  `skills/uraeda/`, so editing the skill does not break it. Under `cargo llvm-cov`, a profile cut at
  the cap failed the whole merge ("file header is corrupt").
- **Alternatives considered**: A test-only failure hook in `install.rs`, a product change the plan
  limits to precise seams; an unwritable folder inside the staging folder, which the copy removes
  and makes again; `prlimit`, a util-linux command that is not everywhere.
- **If wrong**: A shell whose `ulimit -f` counts in 1024-byte blocks fails at a later file, or not
  at all, and the case fails on its expected error, not silently.
- **Where**: `crates/cli/tests/install.rs`, `crates/cli/tests/common/mod.rs`.

## R21: Attachment refusals must be their own, not another refusal

- **Decision**: In `packages/server/src/__tests__/attach.test.ts`, the chunked case's body is 64
  MiB, three times the limit, and the case asserts reading stopped by the 30th chunk (23 measured,
  the rest read-ahead margin); it is renamed "…, and stops reading it". The two cross-site cases
  assert the guard's text, `Forbidden origin` and `Forbidden site`, besides 403. A new case sends a
  body under the limit holding no file and expects `refused: The body holds no file.`, with no
  worktree made.
- **Rationale**: Review focus 2. With the body limit removed, both limit cases receive
  `refused: The body holds no file.`, so their exact texts already separate the limit from a parse
  failure; but a limit that read a chunked body whole before refusing kept the old case green (22
  MiB sent, the same 21 MB text) and fails the new bound
  (`expected 65 to be less than or equal to 24`, at the first bound). The no-file refusal was the
  one line of `attach.ts` no test ran. No assertion was loosened or removed.
- **Alternatives considered**: Asserting the exact chunk count, 23, which a stream's read-ahead
  could change without a defect.
- **If wrong**: Raise the bound by the stream's read-ahead, never past the 64 chunks sent.
- **Where**: `packages/server/src/__tests__/attach.test.ts`.

## R22: Task 4's audit retains every guard it read

- **Decision**: No case of `answered.rs`, `settings_writes.rs`, `images.rs`, `clean.rs`,
  `install.rs`, `claude.test.ts`, `sessions.test.ts`, or the preview lifecycle cases is removed,
  skipped, or loosened. Their merge/squash shapes, exact bytes, pixel placement, frame delays,
  permission rules, and controlled-clock lifecycles are the contracts the plan names, and no
  duplicate across them was established.
- **Rationale**: Each injected fault failed its owning case (Task 4 evidence). The comment beside a
  replaced value is owned by `keeps_windows_line_ends` alone, which also owns CRLF; one case owning
  both is not a gap.
- **Alternatives considered**: Merging the core preservation cases into tables, which changes no
  protection and is not needed for the budget.
- **If wrong**: Remove a case only with the duplicate that owns its guarantee named.
- **Where**: Task 4's files.

## R30: The thumbnail-focus failure was a product race, fixed in the product

- **Decision**: `useFocusAfterRemove` (`ComposerImages.tsx`) now records the removed image's index
  and key, and takes the focus only once the images no longer hold that key. A draw of the same
  images (such as one just saved) that reaches the effect first leaves the request in place. The
  case "removing a thumbnail moves the focus to the next one, then to the message" in
  `session.test.tsx` is unchanged. A new case in `composer-images.test.tsx` draws the same images
  just before the removal.
- **Rationale**: The wave 3 failure (`activeElement` had no label for the whole wait) was not a
  readiness weakness of the test. Reproduced under load (12 busy loops, load 40 to 60), the same
  case copied 40 times failed 2 of 40, and a focus log showed the first Remove button took the focus
  (`in Remove one.png — image 1 of 2`) before the removal, then left with its button. The click
  handler records the target, then removes; an effect owed to an earlier draw (the image's save
  settling) ran at the start of that update, consumed the request on the old buttons, and the
  removal then left the focus on the body. A user who removes an image right as its save ends can
  reach it. With the key check, the same 40 copies passed under the same load, and the new case
  fails on the old code (the focused element is not the Remove two.png button).
- **Alternatives considered**: A longer wait or a retry would have hidden it (forbidden). Moving the
  request into the removal's state update would change how the draft is held.
- **If wrong**: Revert the key check; the new case and the 40-copy run then fail again.
- **Where**: `packages/web/src/ComposerImages.tsx`,
  `packages/web/src/__tests__/composer-images.test.tsx`.

## R31: Home's readiness no longer depends on a heading's words

- **Decision**: `home.test.tsx` finds the first card, the first count and the card's list by place,
  and waits for a link to a fixture feature that waits on the human; the order cases accept any text
  for the first heading and the first count's name. `usage.test.tsx`, `sign-in.test.tsx`, and
  `notify.test.tsx` wait for that link (`homeShown`, `homeHidden` in `helpers.tsx`) instead of the
  heading "Needs you". The other headings, counts, and the card's rows, verbs, and links keep their
  assertions.
- **Rationale**: Renaming the heading "Needs you" to "Waiting on you" (the card, its list, its
  count) failed 5 cases of `home.test.tsx` and 5 more of `notify`, `sign-in`, and `usage`. All pass
  now with the rename applied, and also without it. The first card's identity is still checked by
  its rows (the waiting feature and its verb) and its position.
- **Alternatives considered**: Renaming in the tests only, which keeps the coupling.
- **If wrong**: A card moved from first place makes the rows' assertions fail, as they should.
- **Where**: `packages/web/src/__tests__/{home,usage,sign-in,notify}.test.tsx` and `helpers.tsx`.

## R32: The round's submit case counts its commits from a baseline, then reloads

- **Decision**: "submitting commits the round and shows its record" in `round.test.tsx` captures the
  feature branch's commit count before the tap, expects exactly one more after, and reloads the page
  from the repository to see the answered step. Nothing was loosened.
- **Rationale**: US1 key 3 asks for one commit and the reloaded step; the case asserted the last
  subject only, which a second commit with the same subject would satisfy. A fault committing an
  empty duplicate with the same message now fails it (`expected 4 to be 3`).
- **If wrong**: A product change that adds a record commit to a submit changes the baseline by its
  count: update it with the human's rule.
- **Where**: `packages/web/src/__tests__/round.test.tsx`.

## R33: No case moved to the focused boundary; the browser checks are unchanged

- **Decision**: No case of the six application suites was removed, skipped, or moved, and none was
  loosened except the home page's heading wording and first count's name, which R31 records. No file
  of `__browser__` or `editors/nvim/tests` was edited.
- **Rationale**: Step 1's map found each local Composer variant of `session.test.tsx` either already
  owned by `__focused__/composer.test.tsx` (the refused send, the upload gate, the workflow's
  images, in Task 2) or tied to the session page's own state (the draft across a session's creation,
  take-back with its images, thumbnails told apart, drops on the page), which the focused fixture
  does not reproduce. The browser cases hold what no emulator reaches: the frame's sandbox and its
  messages (`story-embed`, `story-comments`: a size and a pick from a window that is not the embed's
  frame, trusted picks that persist through a reload and a restart), focus and pick mode in the real
  frame, scroll and layout at both sizes and both themes (`layout`, `session-tail`), and the
  editor's smoke (every `tests/test_*.lua`). Moving more would trade a measured protection for a
  time not asked of this task.
- **Alternatives considered**: Deleting the `session.test.tsx` image cases that resemble the focused
  ones: they send through the page's real draft and reload, which the focused cases do not.
- **If wrong**: Task 7's edit matrix names the cost; move a case only with its duplicate named.
- **Where**: Task 5's files.

## R34: Browser protection is proven by its messages, not the frame's attributes

- **Decision**: The owners of review focus 4 stay: `story-comments.test.tsx` "a message from another
  window is ignored" (a frame of the page posts a pick; no form opens, the hint stays) and
  `story-embed.test.tsx` "a size from any window other than one of the embed's frames is ignored"
  (also a window posting to itself), beside the trusted picks and sizes of the same files.
- **Rationale**: With the source check of `StoryFrames.tsx` removed (`false` in place of
  `frame.current?.contentWindow !== event.source`), exactly those two cases failed on the desktop
  project, and every other case of both files passed. Restored, all 34 pass.
- **If wrong**: A frame check that accepts any `MessageEvent.source` is a hole in the stack
  decision's isolation: do not relax the two cases.
- **Where**: `packages/web/src/__browser__/{story-embed,story-comments}.test.tsx`.

## R60: A spawned server's start is awaited by its event, bounded for a broken process

- **Decision**: In `main.test.ts`, the cases that wait for a spawned server's progress (its host
  token, the lines it prints after its address) wait through `until`: the condition, or the
  process's exit with its stderr as the failure, bounded at 15 s in place of Vitest's 1 s. "A second
  start during the first's start waits for it" waits for the token file to hold its 43 characters
  (the file exists a moment before it does), and gives its early request 30 s in place of the
  handoff's 2 s default. No retry, no sleep, no assertion was loosened.
- **Rationale**: Under machine load (16 busy loops over a load of 60 to 80) the case failed 3 times
  in 30 runs at the 1 s poll: the server process had not taken its port. With that bound lifted it
  failed 2 in 40 at the handoff's 2 s: the request waits for `startServer`, which takes seconds
  under load. At the highest load (40 busy loops) the next failures were the poll seeing the token
  file created and empty (`unauthorized`), and a second start's own 2 s handoff expiring, which the
  test cannot lengthen: that bound is production behavior and is kept.
- **Alternatives considered**: Retrying the case or sleeping before the read (forbidden); a longer
  poll alone (the empty file and the 2 s handoff remained).
- **If wrong**: A start that is truly broken still fails, with its stderr, within 15 s.
- **Where**: `packages/server/src/__tests__/main.test.ts`.

## R61: The binding project's tests share the server project's 20 s test bound

- **Decision**: `packages/binding/vite.config.ts` sets `testTimeout: 20_000`, the server project's
  value, in place of Vitest's 5 s default. No assertion changed.
- **Rationale**: Under machine load (20 busy loops over a load of about 55) "each fixture repository
  owns its history, refs, index, configuration, and files" of `test-utils.test.ts` timed out at 5 s
  once in 60 whole-project runs (6.1 s for a case of about 60 git processes); the single file alone
  never failed in 50 runs under 24 busy loops. The case does a fixed amount of git work, so the
  bound only measured the load.
- **Alternatives considered**: A timeout on that one case (the other git-heavy cases share the
  cause); removing its `gc`, hard-link, or alternates checks (protection, kept).
- **If wrong**: A hung binding test still fails, at 20 s.
- **Where**: `packages/binding/vite.config.ts`.

## R70: Main is integrated by rebase; its tests and rules are owned, not re-decided

- **Decision**: The branch was rebased onto `main` at `953e37fc` (54 commits after `85b4f233`: shell
  completions, inbox images and fixes, the chat-right and start fixes, priorities passes). History
  stays linear. Two textual conflicts: `specs/INBOX.md`, where main's slimmed version is kept and
  the eight `[fix-testing]` notes this branch added are appended again, and
  `skills/uraeda/references/change.md`, where main's new "What was done" item leads the pull
  request's order and this branch's line about removed, skipped, or loosened tests stays in item 4.
  No decision or constitution file changed on main
  (`git diff 85b4f233 main -- specs/decisions specs/CONSTITUTION.md` is empty), so no rule changed.
  The plan's rule map keeps every row; the two CLI rules about non-interactive and stable output
  also name `install_completions.rs` and `complete.rs`, and the first attachment rule names the
  inbox images' `inbox_images.rs` and `inbox_clean.rs`. The inventory records the three test files
  main added, the seventeen it changed, and the helpers its first list omitted.
- **Rationale**: Every MUST or SHOULD rule of the decisions that names a test as its check has a
  row, checked by a script over the decision files. Every owner path of the map exists after the
  rebase. Main's new Rust tests live in `crates/cli/tests/`, which the selector runs through
  `uraeda-cli` (a path under `crates/` selects its crate and reverse dependents); its `Cargo.toml`,
  `Cargo.lock` and `flake.nix` edits select the workspace or every family by the configuration-name
  rule, and the completions' sources are Rust, embedded by nothing under `skills/`. No registry
  entry is needed: the selector's own tests (imports of each family, `cargo metadata` dependents)
  pass on the rebased tree.
- **Alternatives considered**: Merging main, which leaves a non-linear history the workflow forbids;
  dropping the `[fix-testing]` inbox notes, which would lose agents' findings.
- **If wrong**: A main change that adds a runtime input outside `crates/`, `packages/`, `skills/`,
  `fixtures/` or a configuration name falls to the selector's escalation to `ready`, never to no
  check.
- **Where**: `test-inventory.md`, the plan's rule map, `specs/INBOX.md`, `change.md`.

## R71: The audit of every old test's disposition and every changed assertion

- **Decision**: No baseline test is removed, skipped, ignored, or loosened without a ruling; the
  changes below are all of them, read from `git diff main...HEAD` over the test files, the helpers,
  and the configurations (108 removed lines, 13 of them assertions). Each baseline path of the
  [inventory](test-inventory.md) keeps its row, with the disposition its change needs.
  - **Retained and named, unchanged**: all 305 baseline paths still exist; 274 are changed by
    neither the branch nor main, 14 are changed by the branch (below), and 17 are changed by main
    and integrated by R70 without a conflict (none of them is among the branch's 14).
  - **Strengthened, nothing removed**: `crates/core/tests/clean.rs` `leaves_a_locked_worktree` and
    `leaves_a_worktree_outside_worktrees` assert the whole `left` list (worktree, then branch with
    `WorktreeLeft`), an empty `did`, and that the branch remains; the old assertions on `left[0]`
    are the first entries of the new ones. Wave 3 of Task 4 recorded it; this is its ruling.
    `attach.test.ts` (R21), `install.rs` (R20), `round.test.tsx` (R32), `composer-images.test.tsx`
    (R30), `test-utils.test.ts` (R12: four cases added, its imports moved to `test-repos.ts`'s
    names), and `toolchain.test.ts` (two cases added: `ts:test` reruns on `vite.fast.config.ts`, and
    `fast` selects before optional builds; its config readers also list `vite.fast.config.ts` and
    `scripts/vite.config.ts`, so the project and binding-config cases cover them).
  - **Loosened, by ruling**: the home page's heading wording "Needs you" and its first count's name
    are no longer asserted by `home.test.tsx` (the card is found by place, the first count by place,
    and the card by the waiting feature's link and verb), and `notify`, `sign-in`, and `usage` wait
    for that link instead of the heading (R31, named by R33). These are the 13 removed assertions;
    the home order case now accepts any first heading. The headings' other words, the rows, verbs,
    and links keep their assertions.
  - **Replaced**: `main.test.ts`'s `expect.poll(...)` waits on a spawned server are `until(...)`,
    which waits for the same condition or the process's exit and fails with its stderr (R60). The
    chunked-upload case of `attach.test.ts` sends 64 MiB in place of 22 and asserts the 21 MB
    refusal and a bound on chunks read (R21): its title gained "and stops reading it".
  - **Moved, not removed**: `web/vite.config.ts`'s test settings (time zone `UTC`, happy-dom URL and
    frame loading, the two setup files, 20 s timeout) and its plugin list moved into
    `uiTestOptions()` and `uiTransforms()` in `vite.transforms.ts` with the same values (the second
    setup file's path is absolute); `testWorkers` (`min(4, availableParallelism())`) moved to
    `scripts/test-policy.ts`, read by `vite.config.ts` and the fast configuration; `lockFolder` was
    exported by `test-run.ts`; `test-utils.ts` lost 84 lines to `test-repos.ts`.
  - **No skip, `todo`, `only`, ignore, or retry** was added by the branch (a search of the whole
    diff), and no `retry` is configured.
- **Timeouts and bounds changed** (old to new):

  | Where                                                                                  | Old                          | New                                     | Ruling              |
  | -------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------- | ------------------- |
  | `packages/binding/vite.config.ts` `testTimeout`                                        | 5 s (Vitest's default)       | 20 s                                    | R61                 |
  | `scripts/vite.config.ts` `testTimeout` (new project)                                   | none                         | 130 s, above its nested runs' own 120 s | Task 2 review fixes |
  | `fast-discovery.test.ts` nested Vitest `timeout` (new)                                 | none                         | 120 s                                   | Task 1              |
  | fast project `testTimeout` (non-UI families, new)                                      | none                         | 20 s, the server project's              | R11                 |
  | `main.test.ts` waits on a spawned server                                               | 1 s (`expect.poll` default)  | 15 s, or the process's exit             | R60                 |
  | `main.test.ts` early request of "a second start during the first's start waits for it" | the handoff's 2 s            | 30 s                                    | R60                 |
  | `attach.test.ts` chunked upload                                                        | 22 chunks sent, none counted | 64 sent, at most 30 read                | R21                 |
  | `packages/web/vite.config.ts` `testTimeout`                                            | 20 s                         | 20 s (moved, same value)                | R11                 |
  | `__focused__` composer cases                                                           | none                         | the web configuration's 20 s            | R11                 |

- **Coverage exclusions and denominators**: `**/__focused__/**` joins `**/__tests__/**`,
  `**/__browser__/**`, `**/__lint__/**` in the root coverage `exclude` (R6), so the focused tests
  and helpers are not product files. `scripts/vite.config.ts` is a new Vitest project, so the
  coverage command's `vp test` also runs the scripts suite; `scripts/` sources were already in the
  denominator. The comparison with R6's baseline is in R72.
- **File and function growth** (existing files the branch grew, lines before to after, from
  `git diff main...HEAD --stat` and a parse of each file's functions at `main` and `HEAD`; new files
  are listed in the inventory and are not growth):

  | File                                                  | Lines                | Functions grown or added                                                                                                               |
  | ----------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
  | `crates/cli/tests/common/mod.rs`                      | 163 to 186           | `ura_with_file_limit` (13) added                                                                                                       |
  | `crates/cli/tests/install.rs`                         | 834 to 878           | the rollback case (19) and two helpers added                                                                                           |
  | `crates/core/tests/clean.rs`                          | 417 to 430           | `leaves_a_locked_worktree` 12 to 17; `leaves_a_worktree_outside_worktrees` 23 to 31                                                    |
  | `packages/binding/test-utils.test.ts`                 | 23 to 148            | four cases (9 to 37 lines) and five helpers added                                                                                      |
  | `packages/binding/vite.config.ts`                     | 7 to 9               | none                                                                                                                                   |
  | `packages/server/src/__tests__/attach.test.ts`        | 368 to 392           | cross-site upload 13 to 15; origin-less 14 to 17; the chunked case grew by its comment and a 3-line bound; the no-file case (15) added |
  | `packages/server/src/__tests__/main.test.ts`          | 881 to 908           | `until` (12) and `readTokenFile` (2) added; "a second start" 21 to 27                                                                  |
  | `packages/server/src/__tests__/toolchain.test.ts`     | 696 to 728           | `runnerConfigs` 11 to 18; `projectNames` 16 to 19; `bindingConfigs` 15 to 18; `browserProjects` 5 to 7; two cases (5, 10) added        |
  | `packages/server/src/fate/select.ts`                  | 31 to 39             | `rewritten` (6) added, moved from `app.ts` (199 to 191)                                                                                |
  | `packages/web/src/ComposerImages.tsx`                 | 90 to 96             | `useFocusAfterRemove` 26 to 27                                                                                                         |
  | `packages/web/src/__tests__/composer-images.test.tsx` | 55 to 67             | `Fixture` 28 to 32; one case (7) added                                                                                                 |
  | `packages/web/src/__tests__/helpers.tsx`              | 533 to 554           | `homeShown`, `homeHidden` (3 each) added                                                                                               |
  | `packages/web/src/__tests__/home.test.tsx`            | 387 to 402           | `count` 3 to 7; `needsCard` (5) added; the empty-card case 14 to 15                                                                    |
  | `packages/web/src/__tests__/round.test.tsx`           | 1378 to 1386         | the submit case 13 to 21                                                                                                               |
  | `packages/web/src/__tests__/{sign-in,usage}.test.tsx` | 351 to 353, 69 to 70 | none                                                                                                                                   |
  | `vite.config.ts`                                      | 261 to 263           | none                                                                                                                                   |
  | `vite.tasks.ts`                                       | 416 to 426           | none (task entries)                                                                                                                    |

  Shrunk: `packages/binding/test-utils.ts` 486 to 402, `packages/web/vite.config.ts` 139 to 90,
  `packages/server/src/app.ts` 199 to 191.

- **Unresolved**: (1) the two coverage runs are not on equal inputs: main added tests and code since
  `85b4f233` (R72). (2) `ready` has not yet passed whole on this machine in one run: the failures
  are listed in R72, none reproduced alone. (3) SC-001 and SC-003 need hosted runs. (4) W7 of Task 2
  (typing mutation answers needs production `as const`) was not done. (5) `crates/core/src/actions`
  `install.rs` lines 170, 281 to 283, 323, and 382 to 385 are run by no `install.rs` test (Task 4).
- **Rationale**: SC-005 asks every old file a disposition and every weakening a replacement; the
  inventory and this list are that record. Nothing here removes a case, and the only expectations
  relaxed are R31's wording pins.
- **Alternatives considered**: Listing only the files with a changed assertion, which hides moved
  settings and timeouts.
- **If wrong**: Restore a loosened pin by its ruling, or a moved setting from `main`'s file.
- **Where**: `test-inventory.md`, this file.
