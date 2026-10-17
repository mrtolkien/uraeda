# Rulings: Restart a Storybook when its checkout's commit changes

The low-impact choices made while building [the change](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: The commit is read at each view, and a moved one restarts at that view

- **Decision**: each view reads the checkout's commit with the core's `checkoutCommit`, and the
  runner starts the Storybook again when it differs from the one it started at. Nothing watches the
  checkout between views.
- **Rationale**: a view already reads the checkout's preview decision from disk, so one more read
  costs little, and a Storybook nobody looks at is not restarted for nothing. Agents commit after
  every step, so a commit marks the point where `.storybook/`, the dependencies, or the server code
  may have changed.
- **Alternatives considered**: watching `.storybook/`, `package.json`, and the lockfile, which
  covers uncommitted edits but misses the server and binding code that Uraeda's own Storybook runs,
  and needs debouncing and recursive watches.
- **If wrong**: an uncommitted change to Storybook's configuration still needs "Try again", as
  before. Undo by reverting the `view` branch in
  [`runner.ts`](/packages/server/src/preview/runner.ts).
- **Where**: [`runner.ts`](/packages/server/src/preview/runner.ts),
  [`fate/preview.ts`](/packages/server/src/fate/preview.ts)

## R2: A restart for a moved commit starts the new Storybook before it stops the old one

- **Decision**: the new Storybook's entry replaces the old one under the same base before the old
  process is stopped, so the base never goes without a state.
- **Rationale**: a base without a state makes fate forget the records read for it, so a page would
  see "starting" and never get the update to ready. The test
  `a view after a new commit in the checkout restarts its Storybook, and updates its stories` fails
  with the other order.
- **Alternatives considered**: going through `restart`, which stops first, with fate's `restarting`
  guard around the view: two places to keep in step for one behaviour.
- **If wrong**: both processes run for the few seconds the old one takes to exit, on different
  ports.
- **Where**: `Previews.#replace` in [`runner.ts`](/packages/server/src/preview/runner.ts)

## R3: An unknown commit never restarts, and a failed Storybook restarts on a new commit

- **Decision**: when either commit could not be read, the Storybook is kept as it is. A failed
  Storybook at an older commit starts again, as a running one does.
- **Rationale**: a checkout without a commit, or one the core cannot open, must not restart at every
  view. A new commit may hold the fix for what made it fail.
- **Alternatives considered**: keeping a failed Storybook failed until "Try again", as views do at
  the same commit: the human would press it after every fix an agent commits.
- **If wrong**: a Storybook that fails at each commit starts once per commit viewed, not more.
- **Where**: `moved` in [`runner.ts`](/packages/server/src/preview/runner.ts)
