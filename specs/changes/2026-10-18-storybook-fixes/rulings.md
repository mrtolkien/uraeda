# Rulings: Storybook preview fixes

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
active decisions. None binds future work: those are decisions.

## R1: A read stamp from the runner, not a clock

- **Decision**: `Previews.read()` gives an increasing number, `runnable` takes it before it reads
  the commit, and each Storybook keeps the stamp it started at. Only a commit read after that stamp
  can move it.
- **Rationale**: the proposal asks to restart only for a commit read after the Storybook started. A
  counter does not tie within one millisecond, as `Date.now()` can, and needs no clock shared
  between the fate layer and the runner's injected `now`.
- **Alternatives considered**: comparing `Date.now()` values, which can tie; comparing the two
  reads' stamps, which would also restart for a commit read between a view's start and its spawn.
- **If wrong**: a commit read just before a start waits for the next view to restart it, five
  minutes at most for an open page. Remove `read` and `stamp` to go back.
- **Where**: [`runner.ts`](/packages/server/src/preview/runner.ts) `moved`,
  [`fate/preview.ts`](/packages/server/src/fate/preview.ts) `runnable`.

## R2: A checkout without a stamp counts as read now

- **Decision**: `Checkout.read` is optional, and a checkout without it can always move a Storybook.
- **Rationale**: only `runnable` builds real checkouts, and it always stamps them; the runner's
  tests and other callers keep working without one.
- **Alternatives considered**: a required stamp, which would touch every test helper for no
  behaviour.
- **If wrong**: a caller that forgets the stamp loses the race protection only.
- **Where**: [`runner.ts`](/packages/server/src/preview/runner.ts) `Checkout`.

## R3: The validation script fixes its own folder for a change's worktree

- **Decision**: `checkoutFolder` strips `change/` from the branch name.
- **Rationale**: the script failed on a change's worktree before any item ran (`state: none`), and
  the Storybook page's address, which item 4 needs, takes the folder.
- **Alternatives considered**: leaving it and running the script from a feature or the main
  checkout: the item's check would not have run here.
- **If wrong**: a branch with another prefix still fails; the script says so.
- **Where**: [`validate-storybook.ts`](/packages/web/scripts/validate-storybook.ts).
