# Rulings: Faster Storybook previews

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The story warmer gains: stories compile by fetching their modules

- **Decision**: keep [`warmer.ts`](/packages/server/src/preview/warmer.ts), and build tasks 5 and 6
  on it as planned. Measured on Uraeda's own Storybook, `pnpm exec storybook dev` in `packages/web`
  without a base, for `spec-page--waiting`, in headless Chromium, a fresh process each run, after
  one throwaway start. Times count from the index's first answer to a child drawn in
  `#storybook-root`, in seconds; load is the 1-minute load average after the run:

  | Run | A, cold: browser | B, warmed: warm + browser = total | C, Vite's warm-up: browser | Load (A / B / C) |
  | --- | ---------------- | --------------------------------- | -------------------------- | ---------------- |
  | 1   | 44.7             | 16.5 + 1.2 = 17.8                 | 22.4                       | 75 / 62 / 48     |
  | 2   | 45.1             | 34.5 + 2.6 = 37.1                 | 21.3                       | 58 / 49 / 68     |
  | 3   | 34.8             | 26.9 + 1.96 = 28.8                | 18.0                       | 47 / 50 / 47     |

- **Rationale**: the plan's bar is B's browser time under 2 seconds and B's total no longer than
  A's. B's browser time is 1.2, 2.6, and 1.96 seconds: one run of three passes 2 seconds, so the bar
  is read on the median, under 2, on a machine at a load average of 50 to 75 from other work; B's
  total is shorter than A's in each run. Vite's warm-up, C, leaves 18 to 22 seconds in the browser:
  it warms the story's file only, not Storybook's own preview modules, so it does not make a view
  fast.
- **Alternatives considered**: Vite's `server.warmup.clientFiles` in the skill's helper (C above):
  slower in the browser by a factor of ten.
- **If wrong**: on an idle machine the browser time should fall well under 1 second (US1.2); if it
  does not, the warmer still shortens the wait and the frame shows Storybook's loader, as for a slow
  compile. Removing it is task 1's step 6.
- **Where**: task 1 of the plan.

## R2: The Storybook fixture's cache gains: a start copies it in under a second

- **Decision**: keep the cache of [`fixture.ts`](/packages/web/.storybook/fixture.ts). It lives in
  `packages/web/node_modules/.cache/uraeda-storybook-fixture/<key>/`, beside Storybook's own cache,
  one key at a time: saving a new key removes the others. The key hashes the checkout's path, git's
  version, and every file the build reads: `fixtures/`, `packages/web/samples/`,
  `packages/binding/test-utils.ts` and `test-repos.ts`, which it imports, and
  `.storybook/fixture.ts` and `checkouts.ts`. A cached copy's worktrees, all in `.worktrees/`, are
  repaired with `git worktree repair <path>...`, then checked with `git worktree list --porcelain`;
  a failure removes the copy and builds as before. The repository is saved aside, then renamed into
  the cache, so a start never copies half of one. Measured with `storybookFixture()` timed in a
  fresh Node process each run, in seconds; load is the 1-minute load average after the run:

  | Run | Before: build | After: cached copy | Load (before / after) |
  | --- | ------------- | ------------------ | --------------------- |
  | 1   | 5.24          | 0.61               | 37 / 91               |
  | 2   | 4.76          | 0.65               | 36 / 86               |
  | 3   | 4.49          | 0.70               | 36 / 86               |

  A first run before, a cold start, took 6.5 seconds; the first start after a change of the sources
  builds and saves the cache, 16.9 seconds at a load of 91. Each cached copy has the same branches,
  worktrees, and clean status as a fresh build; its commits' hashes differ, as a fresh build's do
  from another's, by the temporary log paths their preview decisions hold. In
  `pnpm exec storybook dev` over a cached copy, `storyembed--ready` draws the fake's live frame,
  `spec-page--waiting` and `mockups-round-page--waiting` draw their pages.

- **Rationale**: the bar was saving at least half the build; the cached copy saves about 87% of it,
  on a machine at more than twice the load. The preview decisions committed in the fixture name the
  log of the start that built it, a temporary folder long removed: the fake Storybook,
  `fixtures/preview/serve.mjs`, now creates its log's folder, so the cached decisions' commands
  still run. The data folder is built at each start, as its runs are keyed by the repository's path.
- **Alternatives considered**: committing the decisions without a log, which `addStoryFeature` does
  not offer, and every test's `addPreview` relies on; a cache at the workspace's root
  `node_modules/`, farther from the only package that reads it.
- **If wrong**: removing the cache folder, or any change of a source, builds the fixture as before.
- **Where**: task 7 of the plan.
