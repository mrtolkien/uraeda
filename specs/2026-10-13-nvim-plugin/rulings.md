# Rulings: Nvim plugin

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Candidates are padded to the longest section listed

- **Decision**: `draft::listed` pads each section's title to the longest title listed plus two
  spaces, so `Blocked  Benchmarks` gets two spaces and a list of `Now` and `Next` lines keeps its
  `Now   ` padding.
- **Rationale**: the padding lives in the core's
  [`actions/draft.rs`](/crates/core/src/actions/draft.rs), shared by `ura draft` and `ura start`,
  not in the CLI as the plan said. The plan's `{:<8}` leaves one space after `Blocked`, where its
  own test expects two, and changes the expected output of three existing CLI tests.
- **Alternatives considered**: `{:<9}`: fixes `Blocked` but rewrites the existing tests' expected
  output, which a fix of one section has no reason to change.
- **If wrong**: a display change of one line, with its test in `crates/cli/tests/draft.rs`.
- **Where**: task 1, `crates/core/src/actions/draft.rs`.

## R2: `ura lsp` adds 420 KB to the release binary

- **Decision**: the release `ura` (`cargo build --release -p uraeda-cli`, Linux x86-64) grows from
  4,936,136 bytes on task 1's commit to 5,366,376 bytes with `ura lsp` and its diagnostics: +430,240
  bytes, about 420 KB, or 8.7%. The pull request states it, as SC-005 asks.
- **Rationale**: the plan names this ruling R1, which task 1 already took. The growth is above the
  discovery's 263 KB, measured in a scratch crate: it adds the server's own code and the serde code
  of the `lsp-types` structures it uses, which a bare dependency does not instantiate. Later tasks
  use more of them, so the final growth is measured again for the pull request.
- **Alternatives considered**: none: `lsp-server` is the smallest server crate, and the
  [stack decision](../decisions/stack.md) names it.
- **If wrong**: a number in the pull request, measured again by one command.
- **Where**: task 2, `crates/lsp/`.

## R3: The server's tests use the example project

- **Decision**: the diagnostics tests copy the example project's `specs/` into a `TestRepo`
  (`feature_with_spec`, `write_example`), and edit its spec, instead of building a folder from
  `texts::spec("awaiting-human", 1, 1)`.
- **Rationale**: `texts::spec` is not a valid spec: it lacks thirteen required sections, so a test
  expecting one problem would get fourteen. The plan's own test replaces `risk-tier: high`, the
  example spec's value, and the example is the reference for valid files.
- **Alternatives considered**: a complete spec in `texts.rs`: a second copy of the template to keep
  in step with it, shared by the core's and the CLI's tests.
- **If wrong**: test fixtures only, in
  [`crates/lsp/tests/common/mod.rs`](/crates/lsp/tests/common/mod.rs).
- **Where**: task 2, `crates/lsp/tests/`.
