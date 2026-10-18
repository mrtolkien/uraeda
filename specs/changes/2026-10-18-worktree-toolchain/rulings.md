# Rulings: Worktree toolchain fixes

The low-impact choices made while making [the proposal](proposal.md), inside the decisions. None
binds future work: those are decisions.

## R1: Which tasks take the heavy lock

- **Decision**: `ts:check`, `rust:clippy`, and `rust:test` run under `--lock heavy --slots 2`.
- **Rationale**: they are the longest and most memory-hungry cached checks, and round 01's Q2 asked
  for the type checks, the lints, and the Rust tests. `rust:fmt`, `rust:features`, and `specs:check`
  are short or light, and `specs:check` builds with the same cargo cache as clippy.
- **Alternatives considered**: every cargo task: more waiting for little memory saved.
- **If wrong**: add or remove a task's `heavyRun` prefix in [`vite.tasks.ts`](/vite.tasks.ts).
- **Where**: the `heavyRun` constant of `vite.tasks.ts`.

## R2: The decision's word budget

- **Decision**: trimmed a few words elsewhere in the toolchain decision, with no change of meaning.
- **Rationale**: naming the heavy limit in its rule put the decisions over the core test's word
  budget, `every_decision_of_the_repository_holds_at_most_10_rules`.
- **Alternatives considered**: raising the budget: it is the human's limit to change.
- **If wrong**: restore the trimmed sentences and make room another way.
- **Where**: [`specs/decisions/toolchain.md`](/specs/decisions/toolchain.md).
