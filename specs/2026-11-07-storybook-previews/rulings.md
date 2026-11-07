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
