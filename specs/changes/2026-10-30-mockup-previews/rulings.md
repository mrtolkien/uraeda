# Rulings: Mockup previews

The low-impact choices made while building [the proposal](proposal.md), inside its limits and the
decisions. None binds future work: those are decisions.

## R1: Storybook builds a missing binding as it starts

- **Decision**: Uraeda's Storybook config builds the native binding first when the worktree has
  none, as `freshBinding` already rebuilt a stale one, through `vp run binding:touch`.
- **Rationale**: Storybook runs Uraeda's real server, which loads the binding as Storybook reads its
  config. A worktree that only ran its install has no binding, so every story of its branch failed
  with "Storybook did not start: └ Storybook exited with an error". A cold build takes about 20
  seconds with the seeded `target/`, inside the runner's 2 minutes.
- **Alternatives considered**: building in the [preview](../../decisions/preview.md) decision's
  `preview-command`: a change to an active decision, and every start would pay for the build's
  check.
- **If wrong**: a worktree without a seeded `target/` may take more than 2 minutes to build; its
  embed then fails once, and Try again finds the build in cargo's cache.
- **Where**: `packages/server/src/binding.ts`, `packages/web/.storybook/main.ts`
