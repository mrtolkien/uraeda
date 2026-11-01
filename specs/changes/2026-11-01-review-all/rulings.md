# Rulings: Review all the inbox entries

The low-impact choices made while reviewing the inbox's eleven entries, inside the limits of
[the proposal](proposal.md) and the decisions. None binds future work: those are decisions.

## R1: A failed run at a step that waits on the human still reads "Needs you"

- **Decision**: keep the order of `sessionStatus`: a step that waits on the human wins over a failed
  or stopped run, which asks again, with Dismiss, once the step moves to the agent. Only the test
  row that passed without reading the dismissal is removed.
- **Rationale**: the [feature-state record](/specs/done/2026-10-30-feature-state.md) approved it,
  and its row "a failed turn at a step that waits on the human" guards it. Once the step moves, a
  run that ended well reads "Needs attention" too, as halted, so the human sees the same status
  either way, only its reason differs.
- **Alternatives considered**: the failure first, then "Needs you" once dismissed: a change to
  approved behaviour, for a reason text.
- **Where**: [`runner/status.ts`](/packages/server/src/runner/status.ts)

## R2: Dropped entries that do not reproduce, or change nothing a user sees

- **Decision**: three entries are dropped without a change:
  - a pull request merged on GitHub, not fetched, makes its feature done without its number: the
    branch's record names the pull request, and the feature view reads it from there
    ([`view/feature.rs`](/crates/core/src/view/feature.rs), `recorded_pull_request`). Only a feature
    merged without the finish step lacks it, which the workflow no longer makes;
  - in Firefox, an SVG drawn in an `<img>` follows the OS's colour scheme: Firefox 155, headless,
    draws an SVG's `prefers-color-scheme` styles in the page's `color-scheme`, which Astryx sets on
    `<html>` from the picked theme, as Chromium 153 does;
  - a clicked link to an SVG in `mockups/` opens through the mockup route, which lets its scripts
    run: they run sandboxed in an opaque origin, as every HTML mockup's do, and the
    [links test](/packages/web/src/__tests__/links.test.ts) states it as the intended route.
- **Rationale**: the proposal drops what has no impact on usability.
- **If wrong**: each is a small change to the file named.

## R3: The snug panes stay opt-in, pane by pane

- **Decision**: name a merged feature's record and the opt-in in
  [the phone guide](/specs/ui/phone.md), and keep `isSnugOnPhone` on each pane.
- **Rationale**: the feature's page mixes snug panes, its record's, with roomy ones, its timeline
  and sessions: a page-wide context would still need an exception per pane, across 25 call sites,
  for no change a user sees.
- **Where**: [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx)

## R4: The New page's start keeps its tests as they are

- **Decision**: add no web test of a feature started from an inbox note, of a hook refusing its
  commit, or of one with an image.
- **Rationale**: the [testing decision](/specs/decisions/testing.md), at the `early` stage, tests
  the UI rarely; the server's start tests own the git writes
  ([`change-starts.test.ts`](/packages/server/src/__tests__/change-starts.test.ts),
  [`start-queue.test.ts`](/packages/server/src/__tests__/start-queue.test.ts)), and the sandbox
  shows the page.
