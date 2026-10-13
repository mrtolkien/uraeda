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
