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
- **Where**: task 3.
