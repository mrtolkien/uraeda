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
