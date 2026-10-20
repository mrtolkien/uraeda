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
