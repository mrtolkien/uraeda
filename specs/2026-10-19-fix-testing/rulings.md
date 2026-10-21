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
  - **Retained and named, unchanged**: all 305 baseline paths still exist; 273 are changed by
    neither the branch nor main, 15 are changed by the branch (below; `watch.rs`, the 15th, changed
    after the audit, R72 and R90), and 17 are changed by main and integrated by R70 without a
    conflict (none of them is among the branch's 14).
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
  - **Loosened, by ruling (second)**: `crates/core/tests/watch.rs`
    `a_new_worktree_is_reported_then_watched` (R72 item 3, bounded by R90). Before the branch it
    took the first report after its write: `let changes = next(&receiver);` then asserted the file
    list. R72's fix looped past any number of reports without files; R90 skips exactly one. Its
    assertion on the file list is unchanged.
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

  | Where                                                                                  | Old                          | New                                                                                            | Ruling              |
  | -------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------- |
  | `packages/binding/vite.config.ts` `testTimeout`                                        | 5 s (Vitest's default)       | 20 s                                                                                           | R61                 |
  | `scripts/vite.config.ts` `testTimeout` (new project)                                   | none                         | 130 s, above its nested runs' own 120 s                                                        | Task 2 review fixes |
  | `fast-discovery.test.ts` nested Vitest `timeout` (new)                                 | none                         | 120 s                                                                                          | Task 1              |
  | fast project `testTimeout` (new), per family                                           | none                         | its package's: 20 s (binding, server, benchmarks), 130 s (scripts), Vitest's default (package) | R11, R72, R91       |
  | `main.test.ts` waits on a spawned server                                               | 1 s (`expect.poll` default)  | 15 s, or the process's exit                                                                    | R60                 |
  | `main.test.ts` early request of "a second start during the first's start waits for it" | the handoff's 2 s            | 30 s                                                                                           | R60                 |
  | `attach.test.ts` chunked upload                                                        | 22 chunks sent, none counted | 64 sent, at most 30 read                                                                       | R21                 |
  | `packages/web/vite.config.ts` `testTimeout`                                            | 20 s                         | 20 s (moved, same value)                                                                       | R11                 |
  | `__focused__` composer cases                                                           | none                         | the web configuration's 20 s                                                                   | R11                 |

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
  relaxed are R31's wording pins and, by R90, one skipped empty report in `watch.rs`.
- **Alternatives considered**: Listing only the files with a changed assertion, which hides moved
  settings and timeouts.
- **If wrong**: Restore a loosened pin by its ruling, or a moved setting from `main`'s file.
- **Where**: `test-inventory.md`, this file.

## R72: Task 7's validation, coverage comparison, and edit matrix; SC-002 is not met for a root configuration edit

- **Decision**: Three test-owned or selection-owned fixes, no protection removed:
  1. `scripts/fast-selection.ts`: a file of `packages/binding/` (its helpers, loader, declarations)
     selects the binding family and `binding:touch`, but not the Rust crates; only the crates'
     sources, the skill, `Cargo.*` and `fixtures/` select `uraeda-core` and its reverse dependents.
     The crates read nothing of `packages/binding`. A new selector case fails on the old rule.
  2. `vite.fast.config.ts`: the scripts family's `testTimeout` is its project's 130 s, not the 20 s
     of the other families: a configuration edit's fast run timed out `fast-discovery.test.ts`'s
     nested Vitest at 20 s under a load of 150 (it passes in the `scripts` project).
  3. `crates/core/tests/watch.rs`: `a_new_worktree_is_reported_then_watched` takes the first report
     that lists a file after its write (a loop, which R90 bounds to one skipped report). Under a
     load of about 200 it received a late report with no files (`left: []`); alone it passed 60 of
     60 stress runs at load 95, so the failure was seen once, in a run of 1,078 tests, and its cause
     (a report of the new worktree's own watch landing after the 500 ms quiet window) is inferred
     from the assertion, not reproduced. The expected file list is still asserted exactly.
- **Rationale**: Measured on this 32-thread machine, which other checkouts' stress loops (64 busy
  loops each) kept at a load of 80 to 216 for about an hour; the quiet-machine samples are those
  with a load below 35 at their start. Complete uncached `vp run --no-cache ready` (the commands CI
  runs per job): run 1 at load 65 to 120 failed on timeouts only, none reproduced alone (the 41-case
  cascade in `session.test.tsx` passes whole in 193 s, one phone case `attach.test.tsx`, one
  `feature` accessibility case, one `session-tail` case, `review.test.tsx`, `spec-page`, and the
  desktop job killed with exit 137 after the graph was cancelled, as in R4). Run 2 (after the fixes
  above, 367 s at load 15 to 26): rust 1,078 tests, `ts:check`, `specs:check`, the storybook,
  `ui:smoke` and `ts:test` (152 files, 2,122 tests) passed; the phone job failed one case,
  `session.test.tsx` "idle at the end, send: the reply stays in view and no button shows" (the reply
  not in view within its `LIVE` bound), which passed in 6 of 6 runs alone, and the desktop job
  exited 137, cancelled with the graph. The two browser jobs run as CI runs them, each alone:
  `ready:browser-phone` passed (220 passed, 128 skipped, 495 s at load 18 to 4) and
  `ready:browser-desktop` passed (292 passed, 56 skipped, 397 s). No test was retried within a run;
  the phone case's root cause is not found and it stays open as evidence for the hosted runs.
  `vp run test:nvim` passed (every `tests/test_*.lua`, 0 fails, 44 s). One whole `ready` has not
  passed on this machine: the combined run's phone case failed once (load 15 to 26), so only the
  per-job runs are green.
- **Coverage** (`vp run coverage`, load 4 to 8, 273 s; baseline R6 on `85b4f233`; main's own
  additions since are in the new figures): TypeScript lines 80.89% (14,077 of 17,402) against 80.87%
  (13,966 of 17,268); statements 79.62% against 79.60%; branches 75.89% against 75.93%; functions
  78.49% against 78.36%; 152 files and 2,122 tests against 147 and 2,031. Rust lines 94.6% against
  94.8%; 1,077 tests passed, 11 skipped, against 1,039 and 11 (main added the completions and inbox
  tests and their code). `__focused__` is excluded, as `__tests__` is, so the denominators grew only
  by main's and this branch's product code. No threshold, no check.
- **Edit matrix** (complete `vp run fast`, warm cache, one file edited and restored; load is the
  1-minute average at the start and the end of the run). Quiet samples, after fixes 1 and 2:

  | Edit                                                  | Selected                                                                                              | Seconds            | Load                               | SC-002                                         |
  | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------- | ---------------------------------------------- |
  | `Composer.tsx` comment                                | `ts:check`; focused Composer suite (5 tests)                                                          | 16.1               | 2.2 to 2.9                         | met                                            |
  | `NoteImage.tsx` comment (leaf)                        | `ts:check`; no fast test imports it                                                                   | 15.5               | 2.9 to 5.5                         | met                                            |
  | `__tests__/helpers.tsx` comment                       | `ts:check`; none (legacy helper, deferred to ready)                                                   | 15.9               | 5.9 to 12.5                        | met                                            |
  | `crates/core/src/settings.rs` comment                 | `ts:check`, `binding:touch`, Rust core, binding (clippy), cli, lsp: 1,078 tests; `contracts.test.ts`  | 49.3 / 52.4 / 62.6 | 30 to 57 / 17 to 36 / 12.5 to 47.6 | met at load below about 40; 62.6 s at 12 to 48 |
  | `skills/uraeda/SKILL.md` word                         | the core's chain as above, plus `specs:check`                                                         | 50.9               | 8.7 to 35                          | met (67.5 at 47 to 64)                         |
  | `binding/test-repos.ts` comment                       | `ts:check`, `binding:touch`; binding, server, benchmarks, UI consumers (40 files, 766 tests); no Rust | 47.0               | 13.0 to 9.7                        | met (112.6 with the Rust chain, before fix 1)  |
  | `binding/index.d.ts` comment                          | `ts:check`, `binding:touch`; `contracts.test.ts`; no Rust                                             | 12.4               | 9.7 to 8.7                         | met (34.6 before fix 1)                        |
  | `vite.config.ts` comment                              | every family (75 files, 1,115 tests), `binding:touch`, Rust workspace (1,078 tests)                   | 82.4 / 93.6        | 48 to 27 / 52 to 30                | NOT met                                        |
  | a deleted tracked source (`DecisionCard.stories.tsx`) | `ts:check`; UI family (8 files, 40 tests)                                                             | 15.8               | 27 to 25                           | met                                            |
  | `README.md` (docs-only)                               | `ts:check`, `specs:check`                                                                             | 16.4               | 23 to 21                           | met                                            |
  | `packages/server/src/limits.ts` comment               | `ts:check`, `binding:touch`; server and consumers (41 files, 814 tests)                               | 57.4 / 49.6        | 21 to 17 / 30 to 17                | met, 7 s to spare                              |

  Every run deferred: application journeys, browser phone/desktop, production builds/package smoke,
  full workspace/editor checks. Samples at a load of 80 to 216 (composer 93.8 s, leaf 79.1, helper
  143, skill 220, declaration 221, limits 78, deletion 29, docs 25) took the type check and Vitest
  start-up to several times their quiet times and are not SC-002 samples; three failed on timing in
  their own tests (the `watch.rs` case above, `preview.test.ts` "a restart still updates the
  stories" and `sessions.test.ts` "a queued turn ended by take back while its process reopens does
  not start" at load 160, and `preview.test.ts` "a feature's turn that ends done starts its
  Storybook" at load 150), and none was reproduced alone or fixed: they are unresolved timing
  sensitivity of baseline server tests under a load above 100, which no check can bound.

- **SC-002**: NOT met for a root configuration edit: it selects every family and the Rust workspace
  by design (a configuration file can change every test), and costs the type check (about 15 s), a
  Vitest run of 75 files (about 50 s) and the workspace's Rust chain (about 22 s), in 82 to 94 s.
  Narrowing it would delete protection, so it is left, as the spec requires, unmet for that case.
  The core and skill edits meet it only on a machine below a load of about 40, and the server
  `limits.ts` edit by 7 s on a machine at a load of 17 to 30; each is load-sensitive.
- **SC-001 and SC-003** need three consecutive and five identical hosted runs: pending the push.
  **SC-004** to **SC-006**: the rule map and inventory (R70, R71) and Tasks 2, 4, 5 evidence.
  **SC-007**: each changed case passed alone by name in its task's evidence; the combined run's
  phone case is open.
- **Alternatives considered**: Retrying the failed browser case or the timed-out ones (forbidden);
  narrowing the configuration selection by file kind, which would let an effective change reach no
  test.
- **If wrong**: A hosted run of the same commit decides the open browser case and the SC-001 budget.
- **Where**: `scripts/fast-selection.ts`, `scripts/__tests__/fast-selection.test.ts`,
  `vite.fast.config.ts`, `crates/core/tests/watch.rs`.

## R80: The load-sensitive `idle at the end, send` case is a product race, found and not yet fixed

- **Resolved**: Round 03 Q2, option A, decided the product fix, and
  [R100](#r100-following-the-end-holds-its-columns-height-and-tells-the-hooks-own-scrolls-round-03-q2-a)
  made it (Task 8): while the human follows the end, the column never gets shorter under the view,
  and the hook's own scroll is told by the position it set. The record below, and its title that
  round 03 links to, are kept as found, with the two failed attempts.
- **Decision**: No code changes. The case
  `idle at the end, send: the reply stays in view and no button shows` (phone, `session.test.tsx`)
  is left as it is: its wait is the right condition, and raising `LIVE` cannot help, because the
  state it waits for never comes back. A human must decide the product fix (see If wrong); two
  attempts are recorded here so the next one does not repeat them.
- **Cause**: `useFollowEnd` (`packages/web/src/following.ts`) takes every scroll event as the
  human's and measures the page when the event is dispatched. A trace of a failing run (state
  recorded from the page, no sampler) shows: the session at its end after a failed run (the page
  1260 px tall, scrolled to 386); the human sends; the message draws and the failure banner leaves
  (the page shortens by 28 px, so the browser clamps the position to 358); the reply draws (the page
  grows to 1588 px); only then the browser dispatches the clamp's scroll event, which finds the
  human 356 px from the end and sets following to false for good, with the "Jump to the latest"
  button showing. Without load the clamp event comes before the reply, and following holds. A user
  on a slow machine, or with a slow reply, can hit the same order: the page then stops following and
  offers the button, which still works.
- **Reproduction**: whole-file runs of `session.test.tsx` on the phone project, 20 to 24 busy loops
  over the machine's own load (load 37 to 120): the case failed in 4 of about 26 runs (other cases
  of the same family, `a run that fails while the human is at its end keeps how it ended in view`,
  `US3.3`, `an ended session scrolled up also offers Jump to the latest`, failed in single runs).
  The case alone passed 40 of 40 at load 10 to 80, and 6 of 6 whole-file runs without load: the
  earlier cases of the file and the load decide it.
- **Attempts, not kept**: (1) Ignoring a scroll that comes with the page growing: it also swallows
  the human's own scroll (`a working session: a page of its own, following its end` failed 2 of 6
  runs without load). (2) Judging each position once, where a draw first leaves it (a layout effect
  and a `MutationObserver`), and reading that for a later event at the same position: a case that
  shortens then grows the page across a task passed with it and failed without it, but the real
  failure remained (1 in 40 whole-file runs under load, against about 4 in 26 before; 5 in 33 in
  another batch with other cases), because the shortening and the reply were drawn with no
  observable moment between them: the first measure already saw 358 px at a page 1588 px tall, the
  same as a human scrolling up 28 px. Both were reverted.
- **Rationale**: A fix that cannot tell the layout's clamp from the human's scroll hides a failure
  instead of fixing it; the remaining options change what the human sees, so they are not decided
  here.
- **Alternatives considered**: Telling the human's scrolls by input events (wheel, touch, keys,
  scrollbar): the browser tests scroll with `scrollTo` and would change; keeping the page from
  shortening while the human follows (keeping the failure banner's space until the reply draws):
  changes the layout.
- **If wrong**: A human decides between the two alternatives above, or accepts the race as a
  cosmetic one (the button shows, and pressing it follows again) and loosens the case with a ruling.
- **Where**: `packages/web/src/following.ts`, `packages/web/src/__browser__/session.test.tsx`.

## R90: The late empty report in `watch.rs` is skipped once, not any number of times

- **Decision**: `a_new_worktree_is_reported_then_watched` takes the report after its write and, when
  that one lists no file, takes the next; a second report without the file, or a write report that
  lists none, fails the assertion on the file list. This replaces R72 item 3's loop over any number
  of empty reports, which would also have passed a watcher that kept reporting nothing. The case
  passed 60 of 60 stress runs (nextest `--stress-count 60`) at a load of 93 to 111. The cause of the
  one late report seen (the new worktree's own watch reporting after the 500 ms quiet window) is
  still inferred, not reproduced. R71's list of loosened expectations names this case, with its
  before and after; the inventory's row for `watch.rs` points here.
- **Rationale**: The failure observed was one late report; the guard should tolerate that, and only
  that.
- **Alternatives considered**: Keeping the loop (hides a repeating spurious report); restoring the
  first-report assertion (fails under a load of 200, once).
- **If wrong**: A stress run showing two late empty reports would need a ruling naming the new
  bound.
- **Where**: `crates/core/tests/watch.rs`.

## R91: Fast's families take their packages' settings, setup files are family inputs, and `specs/` has its own check

- **Decision**: Review fixes to Task 1's selection and fast configuration, each a protection kept or
  added; no case removed.
  1. The files Vitest loads outside any test's imports are "setups": the binding's `test-setup.ts`,
     the UI's `setup.ts`, and `scripts/test-policy.ts`. An edit or deletion runs every family they
     apply to whole (before, the UI's setup selected nothing and fast passed with no test run, and
     the binding's selected only the contracts). They are inputs of those families.
  2. Non-UI fast projects have their packages' settings only: `gitTestTimeout` (20 s) for the
     binding, server and benchmarks, `scriptsTestTimeout` (130 s) for scripts, Vitest's default for
     the `package` family; setup files only where the package's configuration has them (no setup for
     the benchmarks, no `TZ`). The constants live in `scripts/test-policy.ts`, which the package
     configurations and `uiTestOptions()` import; this supersedes R11's and R72's 20 s for every
     non-UI family. The `package` family's bound is now 5 s, as in `vp test`.
  3. The UI family's tests are `src/__focused__/**/*.test.tsx` plus the named existing tests, so a
     new focused test needs no edit of the list. A scripts case fails when a file a family reads is
     no input of the cached `ts:test` task; it found `benchmarks/**` missing, now added.
  4. `specs/**` (workflow files and their images) selects `specs:check`; `editors/` and `.github/`
     still escalate to `ready`, because only `ready` runs the Neovim tests and the toolchain test's
     read of CI's workflow.
  5. The `fast` task no longer isolates git's configuration: `fast-check.ts` lists the changed files
     with the user's, so globally ignored files are not listed as new, then isolates it for every
     later check. The task still unsets git's repository variables.
  6. `fast-check.test.ts` stops its child when the "Waiting" line appears, with a 60 s outer bound
     in place of an 8 s kill; `fast-guards.test.ts` runs `runFocused` over a stub family to prove
     the unproven-family, failed-module and unhandled-error guards (each failed its case with the
     guard disabled).
  7. `runFocused` (item 6) first set `VITEST` after `fastConfig` had made the stylex plugin, which
     reads it: a complete `vp run fast` for a UI edit then never exited (its tests passed, then the
     process idled 10 minutes on the plugin's dev-server timer). `fastConfig` sets it first, as
     before the refactor; a scripts case fails without it, and the run exits in 35 s.
- **Rationale**: Fast must not pass what `ready` fails, nor pass with nothing run.
- **Alternatives considered**: Deriving the cache inputs from the families (would narrow `ready`'s
  cache inputs); loading each package's configuration in fast (loads the native freshness import).
- **If wrong**: A fast run passing where `ready` fails names the setting to align.
- **Where**: `scripts/fast-selection.ts`, `scripts/fast-check.ts`, `scripts/test-policy.ts`,
  `vite.fast.config.ts`, `vite.tasks.ts`, the packages' `vite.config.ts` files.

## R100: Following the end holds its column's height and tells the hook's own scrolls (round 03 Q2, A)

- **Decision**: `useFollowEnd` (`packages/web/src/following.ts`) keeps its interface,
  `useFollowEnd(ref, enabled)` returning `{ following, jumpToLatest }`, and changes in two ways:
  1. **Its column's height is held.** The column is the transcript's parent (on the session page:
     the header, the progress line, the transcript, the attention banner and the error), or the
     transcript itself when its parent is what scrolls. An inline `min-height` keeps the page's end
     no higher than the bottom of the view, as the human last left it: while the human follows the
     end, the column never gets shorter, so what leaves at its end leaves blank space instead of
     clamping the scroll position. The hold is set from the column's height and how far the page
     goes on past the view, at each scroll event, after each of the hook's own scrolls, and a frame
     after the width class changes. It never makes the column taller than it is. New content fills
     the space. Scrolled up past the end, what lies under the view is let go, so the human's scroll
     up takes the blank space away, and a hold the content outgrew is removed. It is removed when
     the width class changes (a height of the other layout) and when the transcript unmounts.
  2. **The hook's own scrolls are told by the position they set.** When the hook moves the scroller
     to the end (following as the session works, or "Jump to the latest"), it keeps where that put
     it; the next scroll event that finds the scroller still there is the hook's own, dispatched
     late, and does not change whether the human follows. Any other position is judged as before, so
     a wheel, a touch drag, a key, the scrollbar, Find in page, `scrollTo` from a test, and Back's
     restored place all behave as they did. A scroll to the end that did not move the scroller
     records nothing.
- **What changes for a user**: at the end of a session, when the banner of a failed, stopped, or
  halted run leaves as the human sends, a blank strip the banner's size stays under the message
  until the message and the reply fill it, and the reply comes into view. The same holds for
  anything else that leaves at the column's end while the human reads at the end (a note's banner, a
  tool group folded there): its space stays blank until new content fills it or the human scrolls
  up. A message taken back at the end of an idle session leaves its space blank until the human
  scrolls up or leaves the page (round 03's stated cost). **What does not change**: the human's own
  scroll still stops following, at once and by any input; "Jump to the latest" still shows when the
  human is away from the end and brings them back; the transcript growing never stops following;
  Back, reload, and the width change keep the place as before; a reader scrolled up sees nothing
  new. No existing test changed.
- **Cause, and why both parts**: R80's trace showed a scroll the human did not make, queued as the
  page changed and dispatched only at the next rendering update, after the reply drew, read as the
  human scrolling up. Two such scrolls exist: the clamp when the page shortens under the view (part
  1 removes it), and the hook's own move to the end when the human's message draws (part 2
  recognises it). On today's session page the failed run's banner and the message change the page
  together by +8 px, so the late scroll there is the hook's own; with a page that shortens, it is
  the clamp. Each part is required by one of the two new cases.
- **Evidence**: see Task 8's evidence in the plan: the two forcing cases, their failures on the
  unchanged hook, the fault injections, the stress batches, and the browser projects.
- **Rationale**: The human chose option A, which removes the clamp without guessing whose scroll it
  was. Part 2 is not input detection (option B): it recognises only the hook's own move, by the
  exact position it set and for one event, and judges every other scroll as before, so R80's attempt
  (1), ignoring scrolls that come with growth, which swallowed the human's, is not repeated.
- **Alternatives considered**: The stopped draft's floor (the tallest height since following began,
  held whole, raised by a `ResizeObserver`): it kept blank space under a reader who scrolled up
  within it, raised the floor only after layout, one update late, and left the hook's own late
  scroll stopping following (the session page's case fails with the hold alone). Input events
  (option B) and a loosened case (option C) were not chosen.
- **If wrong**: the button showing after a send means a late scroll still read as the human's; a
  blank strip that never fills is a hold not released, and the column's inline `min-height` names
  it.
- **Record edits**: the plan's Task 8 boxes are checked and its evidence list added; no other plan
  text changed. The inventory's row for `__browser__/session.test.tsx` names the two added cases.
  R80 says it is resolved, its record kept.
- **Where**: `packages/web/src/following.ts`, `packages/web/src/__browser__/session.test.tsx`.

## R101: SC-002 re-measured as amended: every budgeted edit meets its minute

- **Decision**: SC-002, as spec revision 3 amends it, is met for every budgeted edit of Task 7's
  matrix; the root configuration edit is measured and reported without a budget. No code changed for
  it.
- **Method**: on 2026-10-21, after the following fix's commit, on a clean tree of this branch. Each
  sample appends a comment (a sample-numbered line) to one file, or deletes it, runs the complete
  `nix develop -c vp run fast` (wall time, from the shell), then restores the file; three samples
  per edit, the median kept. A sample starts only when the 1-minute load is below 6 and no other
  checkout runs a check (no `vitest`, `cargo`, `nextest`, `playwright`, or `vp run|test|check`
  process outside this worktree; the main checkout's `vp run start` dev server ran throughout and is
  not a check). Every sample got its quiet start; none was waived. Warm: the toolchain, the dev
  shell, and the unchanged tasks' caches were warm from the samples before; the first sample of an
  edit can still rebuild what the previous edit changed (the fixture's first sample rebuilt the
  binding after the skill's samples). The load is the 1-, 5-, and 15-minute averages at the start,
  and the 1-minute one at the end; the 5- and 15-minute averages, and the end loads above 6, are
  this measurement's own Rust and Vitest runs. The deleted source is `QuickAdd.stories.tsx`: Task
  7's `DecisionCard.stories.tsx` is gone from main.

  | Edit (budget: under 60 s)                  | Selected (as fast printed it)                                                     | Samples, s         | Median, s | Load at start (1/5/15 min), and at end                        | SC-002     |
  | ------------------------------------------ | --------------------------------------------------------------------------------- | ------------------ | --------- | ------------------------------------------------------------- | ---------- |
  | `Composer.tsx` comment                     | `ts:check`; focused Composer suite (1 file, 5 tests)                              | 14.4 / 14.6 / 14.6 | 14.6      | 2.0/2.2/3.5, 2.1; 2.1/2.3/3.5, 2.6; 2.6/2.4/3.5, 3.2          | met        |
  | `NoteImage.tsx` comment (leaf)             | `ts:check`; no fast test imports it                                               | 11.1 / 12.3 / 12.3 | 12.3      | 3.2/2.5/3.5, 10.2; 5.6/3.7/3.9, 5.8; 5.6/3.8/3.9, 5.3         | met        |
  | `__tests__/helpers.tsx` comment            | `ts:check`; none (legacy helper, deferred to ready)                               | 12.4 / 12.5 / 12.1 | 12.4      | 5.3/3.8/3.9, 4.8; 4.8/3.7/3.9, 4.3; 4.3/3.7/3.9, 4.5          | met        |
  | `crates/core/src/settings.rs` comment      | `ts:check`, `binding:touch`, the core and its dependents (1,112 tests); contracts | 50.5 / 49.1 / 51.5 | 50.5      | 4.5/3.7/3.9, 38.1; 5.6/9.3/6.5, 41.2; 5.3/11.8/8.5, 50.3      | met        |
  | `skills/uraeda/SKILL.md` line              | the core's chain as above, plus `specs:check`                                     | 49.5 / 51.7 / 51.2 | 51.2      | 5.3/14.6/11.0, 30.4; 5.7/14.1/11.8, 44.6; 5.2/14.6/13.0, 46.5 | met        |
  | `binding/test-repos.ts` comment (fixture)  | `ts:check`, `binding:touch`; binding and consumers (44 files, 832 tests); no Rust | 57.6 / 59.5 / 57.1 | 57.6      | 5.9/16.0/14.5, 5.8; 5.8/14.2/14.0, 5.7; 5.7/12.6/13.4, 6.0    | met, 2.4 s |
  | `binding/index.d.ts` comment (declaration) | `ts:check`, `binding:touch`; `contracts.test.ts` (5 tests)                        | 12.6 / 11.4 / 12.6 | 12.6      | 4.9/10.9/12.8, 10.6; 5.2/10.1/12.4, 4.8; 4.8/9.9/12.3, 4.7    | met        |
  | `server/src/limits.ts` comment             | `ts:check`, `binding:touch`; server and consumers (44 files, 876 tests)           | 55.4 / 54.0 / 54.3 | 54.3      | 4.7/9.6/12.2, 5.9; 5.9/9.1/11.8, 6.1; 5.2/8.3/11.4, 5.6       | met        |
  | deleted `QuickAdd.stories.tsx`             | `ts:check`; UI family (8 files, 41 tests)                                         | 13.3 / 14.4 / 13.0 | 13.3      | 5.6/7.8/11.0, 11.1; 5.3/7.7/10.8, 7.3; 6.0/7.7/10.7, 5.4      | met        |
  | `README.md` line (docs)                    | `ts:check`, `specs:check`                                                         | 14.5 / 11.2 / 11.1 | 11.2      | 5.4/7.5/10.5, 5.0; 5.0/7.3/10.4, 11.3; 5.5/7.4/10.3, 5.0      | met        |
  | `vite.config.ts` comment (root config)     | every family (79 files, 1,195 tests), `binding:touch`, the Rust workspace (1,112) | 89.4 / 73.6 / 76.8 | 76.8      | 5.0/7.3/10.2, 22.1; 5.5/11.1/11.6, 10.1; 5.4/10.0/11.3, 10.5  | no budget  |

  Every run passed and deferred to ready: application journeys, browser phone and desktop,
  production builds and package smoke, full workspace and editor checks.

- **Rationale**: Revision 3 asks for the median of 3 warm runs while no other checkout runs checks;
  R72's single samples, several under other checkouts' load, are superseded for SC-002 by these. The
  fixture edit has the least margin (2.4 s): its selection grew from R72's 40 files and 766 tests to
  44 files and 832, with main's new server and binding tests.
- **Alternatives considered**: Narrowing a selection to widen a margin: removes protection, which
  the spec forbids.
- **If wrong**: a sample over a minute on a quiet machine names its edit; the fixture and
  `limits.ts` edits will cross first as their families grow.
- **Where**: `scripts/fast-check.ts`, `scripts/fast-selection.ts` (measured, unchanged).

## R102: Two failures remain after the following fix, neither the race R80 found

- **Status (2026-10-21)**: both settled by the human's decisions in the session chat. Item 1 is
  resolved by
  [R110](#r110-a-scroll-made-before-the-transcript-first-draws-wins-over-opening-at-the-end): the
  human's scroll wins over opening at the end. Item 2 is removed by the human's decision ("not
  important"; "drop flaky tests that don't test important behaviour"): see
  [R111](#r111-the-desktop-progress-line-width-case-is-removed).
- **Decision**: No code changes, and no case loosened; both come back to the human (plan Task 8,
  step 3).
  1. **`US4.2–US4.4: scrolled up, Jump to the latest brings the end back, and the page follows it`
     (phone)** failed 3 times in 80 whole-file runs under 22 to 24 busy loops (load 25 to 31), each
     with `expected 346 to be +0` at its "keeps its position as lines arrive" assertion. Cause,
     traced: the session page's end is 346 px down, so the case's "scrolled up 400 px" lands at the
     top; then the transcript's `settled` callback (`Transcript.tsx`, called by `tail.tsx`'s
     `useSettled` with the commit that first draws the tail's pieces) runs `openAtEnd` and scrolls
     the window to the end, after the human scrolled up. Under load the tail's first draw comes
     after the case's scroll. The same failure, with the same trace, comes on the unchanged hook (1
     in 7 runs of the file's first two cases at load 27, against 1 in 27 and 1 in 42 with the fix):
     it is not the following race and not caused by this task. It is a product behaviour: a page
     that opens at its end scrolls there again once its tail draws, even if the human scrolled
     meanwhile.
  2. **`opening the line moves the place read, which the next width keeps` (desktop)** failed twice
     with `expected 6.90625 to be less than 2`: once in 13 whole-file runs with the first version of
     the fix, and once in the first full `ready:browser-desktop` run with the final one. It passed
     55 whole-file runs and 2 more full project runs with the final fix, and 8 whole-file runs on
     the unchanged hook; a trace of a passing run shows the hold inert there (the column held at its
     own height, then let go on the scroll up). The cause is not found, and whether the fix changed
     its rate is not known.
- **Rationale**: Task 8 fixes the race the human decided; a remaining failure is reported, not
  hidden by a longer wait or a retry.
- **Alternatives considered**: For 1, making `settled` skip `openAtEnd` once the human has scrolled
  since the page opened: a product change to how a page opens, which needs the same telling of the
  human's scroll from the page's own; or scrolling the case up from a longer page, which hides a
  real jump. For 2, none without a cause.
- **If wrong**: 1 needs a human's decision on whether opening at the end may override a scroll made
  before the tail drew. 2 needs a failing trace (the instrumented case is described in Task 8's
  evidence) before any change.
- **Where**: `packages/web/src/Transcript.tsx`, `packages/web/src/tail.tsx`,
  `packages/web/src/__browser__/session.test.tsx`.

## R110: A scroll made before the transcript first draws wins over opening at the end

- **Decision**: By the human's decision in the session chat on 2026-10-21, a page that opens at its
  end no longer scrolls there once its tail draws when the human scrolled away meanwhile. A new
  hook, `useScrolledAway` in `SessionPane` (`SessionPage.tsx`), watches the scrolls of each session
  until its log draws, not counting the page's own moves (to the end, or the first scroll found
  where the page opened). `useOpenAtEnd` and the transcript's `settled` callback (`Transcript.tsx`)
  skip opening at the end when the human scrolled away; after the log draws, `settled` reads the
  log's own following state, which `useFollowEnd` (`following.ts`) now also returns as
  `isFollowing`. Back, reload, and a `#turn-` link still take precedence. The forcing case,
  "scrolled up before the transcript first draws, the page keeps the place and offers Jump to the
  latest" (phone), holds the page's Turn and TurnLog requests with its own gate, scrolls up 400 px
  from the end, then releases them: on the unchanged code it failed 5 of 5 runs with
  `expected 0 to be greater than or equal to 400`, and it passes with the fix, including all 40 runs
  of the batch below.
- **For a user**: a session opened while its log is still loading keeps the place the human scrolled
  to, and offers "Jump to the latest", instead of jumping to the end when the log arrives. A session
  opened without a scroll still opens at its end; Back, reload, and links keep the place as before.
- **Evidence**: the phone session file passed 39 of 40 whole-file runs under 22 busy loops (load 4.8
  on the first run, 16 to 34 after); it passed 3 of 3 at normal load, and the desktop session file 8
  of 8. A first version that kept watching after the log drew made the desktop case "opening the
  line moves the place read, which the next width keeps" fail 5 to 7 runs in 8; the watch now stops
  once the log draws, and that case passed 8 of 8, as on today's code.
- **Resolved by
  [R112](#r112-a-tail-that-first-draws-late-keeps-the-place-it-finds-instead-of-a-stale-saved-one)**
  (was open, accepted by the human on 2026-10-21, "commit and move on"): the one failing run (run
  25, load 28) was `US4.2–US4.4` timing out after "Jump to the latest": the next line, "A line after
  the jump.", never came into view. An earlier version of the fix failed the same way twice in 40
  runs. The guess, a following race hidden by the late `openAtEnd`, was wrong: R112 traces it to the
  late tail restoring the page's own saved position.
- **Alternatives considered**: keeping opening at the end over the human's scroll and making the
  case wait for the tail's first draw, which the human declined; tracing the failure after the jump
  before committing, which the human declined for now.
- **If wrong**: trace the failure after the jump from `r110-load.txt.25.log`'s run with the
  instrumented case; a page that must open at its end over an early scroll needs the human's
  decision again.
- **Where**: `packages/web/src/following.ts`, `packages/web/src/SessionPage.tsx`,
  `packages/web/src/Transcript.tsx`, `packages/web/src/__browser__/session.test.tsx`.

## R111: The desktop progress-line width case is removed

- **Decision**: `opening the line moves the place read, which the next width keeps` (desktop) is
  removed from `packages/web/src/__browser__/session.test.tsx`, by the human's decision in the
  session chat on 2026-10-21: flaky tests that do not guard important behaviour are dropped, not
  investigated.
- **Rationale**: It failed with `expected 6.90625 to be less than 2` with no cause found (R102 item
  2). Its guarantee, that a width change keeps the line read, is asserted in both directions by the
  case just before it, which stays; the removed case only adds opening the progress line first and a
  2 px tolerance.
- **Retained guarantee**: the [UI layout](../decisions/ui-layout.md) rule that a width change keeps
  the open detail and the place read, by the preceding case and the `__browser__/layout` cases.
- **If wrong**: a regression that moves the read line only after the progress line opens goes unseen
  until a layout case catches it.
- **Where**: `packages/web/src/__browser__/session.test.tsx`.

## R112: A tail that first draws late keeps the place it finds instead of a stale saved one

- **Cause, traced**: under load, the transcript's tail can first draw well after its lines show, so
  its `settled` callback (`Transcript.tsx`) runs late: in the failing trace, 170 ms after "Jump to
  the latest". `settled` read the history entry's `scroll` at that moment, as Back's or a reload's
  position. But the session page's `useRestoreScroll` saves the page's own position into the entry
  at most every 500 ms as the human scrolls, so the entry held the human's place before the jump
  (the top, 0 px; the jump moved from 0 to 346 px). `settled` scrolled back there; `useFollowEnd`
  read that scroll as the human's, away from the end, and stopped following, so the next line stayed
  below the view. The trace: `jump` 0 to 346, the jump's own scroll read as its own and at the end,
  then `settled` (not away), then a scroll to 0, not the hook's own, not at the end. On main the
  same late `settled` came before the jump and failed the case earlier (R102 item 1); R110's skip of
  opening at the end let the run reach the jump, where it failed this way instead. Neither
  `following.ts`'s hold nor its own-scroll telling was involved.
- **Fix**: the transcript reads the entry's `scroll` once, as it mounts (the page opening, Back, or
  a reload), and `settled` uses that, not the entry as it is when the tail draws; `openAtEnd`
  (`following.ts`) takes that opening entry from `settled` instead of reading the current one.
- **What changes for a user**: on a busy machine, a session whose transcript finishes drawing late
  no longer jumps back to where the human was half a second earlier, which after "Jump to the
  latest" stopped the page following. Back and a reload restore the saved place as before, and a
  `#turn-` link still wins.
- **Evidence (load)**: before, instrumented, the phone session file failed this case once in 57
  whole-file runs under 24 busy loops (load 30 to 37), with the trace above. After, 40 whole-file
  phone runs, two streams of 20 at once, one with 22 busy loops (load 7 to 35): all 40 passed. The
  desktop session file passed once (9 cases), and `vp check` passes. No forcing case: making the
  tail's first draw come after a jump needs the tail's data held past a drawn log, which the page
  cannot do without the test owning its loading; the evidence is the trace and the batches.
- **If wrong**: the case fails again after the jump; trace the scrolls after the jump with
  `useFollowEnd`'s `read` and `settled` logged, as here.
- **Where**: `packages/web/src/Transcript.tsx`, `packages/web/src/following.ts`.
