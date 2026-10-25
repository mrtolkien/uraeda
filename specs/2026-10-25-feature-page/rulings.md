# Rulings: Feature page in the terminal look

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The old look's page tests are replaced, not loosened

- **Decision**: the tests of `feature-page`, `feature-done`, `feature-sessions`, `feature-settings`,
  and `document` that assert the stepper, the cards, the tiles, the files list, or the old document
  page are rewritten against the new look; each keeps the behaviour it guarded (its story's
  scenario), and drops only the look.
- **Rationale**: the spec replaces the look, and its test map names the scenario each new test owns
  ([the plan's test map](plan.md#test-map)). A test of the stepper's markup guards nothing the human
  asked for ([UI checks](../decisions/ui-checks.md)).
- **Alternatives considered**: keeping the stepper tests with a compatibility layer: rejected, it
  would keep the old look alive.
- **If wrong**: a behaviour lost with its old test shows in the test map, which lists every
  scenario.
- **Where**: tasks 2, 5, 6, 7, and 8.

## R2: The story page keeps a 5-minute keep-alive test

- **Decision**: the test that the Storybook page asks for its Storybook again every 5 minutes
  becomes the same test on the story page, which draws the live window.
- **Rationale**: a page left open must not let its Storybook stop after 30 minutes without a view
  (`stories.test.tsx`); the story page is such a page.
- **Alternatives considered**: deleting it with the page: rejected, the embed's own test does not
  cover the page's route.
- **If wrong**: a story page left open stops its Storybook; the test shows it at once.
- **Where**: task 3.

## R3: The browser test of the Storybook page becomes the story page's

- **Decision**: `layout.test.tsx`'s "the Storybook page, ready" is replaced by the story page ready,
  in both modes, reading the live window's frame.
- **Rationale**: it guarded that a story shows at the page's size in both colour modes.
- **Alternatives considered**: deleting it: rejected, the story page is a view the decisions govern.
- **If wrong**: the story page's layout is unchecked; the browser run lists it.
- **Where**: task 3.

## R4: A stage with one round says "1 round"

- **Decision**: the timeline's Questions line reads "1 round" as well as "2 rounds", where the old
  stage line showed rounds only above one.
- **Rationale**: the spec's scenario pins "09:32 · 3 h 10 min · 1 round".
- **Alternatives considered**: none, the spec is exact.
- **If wrong**: a display change in `stageLine`.
- **Where**: task 6, replacing the old `two rounds of questions read as such` test's expectation.

## R5: Elapsed and a running turn's time are counted in the browser

- **Decision**: the server sends the sum of ended turns and the start of a running one; the browser
  adds `now − start`. Elapsed is `now −` the first stage's start, never sent.
- **Rationale**: a figure sent from the server is stale between live updates; the live updates carry
  no clock tick. Counting at the browser lets the figure grow while a turn runs, with no refresh.
- **Alternatives considered**: the server adds `now` on every read: rejected, the page would show a
  frozen figure between reads.
- **If wrong**: the figure is off by the browser's clock error; move the sum to the server.
- **Where**: tasks 1 and 7.

## R6: The story page keeps the Storybook address

- **Decision**: a story linked in a sentence opens at `/f/<folder>/storybook?story=<path>#<export>`
  as before, now drawing the story's own page; the same address without `?story=` opens the
  feature's Home, and `/storybook` opens Home.
- **Rationale**: documents and transcripts already written hold these links; a new address would
  break them. The spec says a bookmark of the address opens Home, which holds without a story.
- **Alternatives considered**: a new `/story` address with a redirect of the old one: rejected, two
  addresses for one page.
- **If wrong**: rename the route's segment and redirect the old one; one place, `routeTable.ts`.
- **Where**: task 3.

## R7: A drop done with its commit refused opens Home with the warning

- **Decision**: a drop the server refuses (an error) keeps the page and shows the refusal under the
  name until dismissed. A drop that happened but whose priorities commit did not
  (`committed: false`) opens Home with the dropped note and the warning, as the session says them.
- **Rationale**: the drop removed the worktree and archived the sessions before the commit: the page
  would draw an item that is gone. The spec's "the page stays" holds for a drop that did not happen.
- **Alternatives considered**: staying on the page for both: rejected, the feature no longer exists.
- **If wrong**: stay on the page for `committed: false` too, in `FeatureMenu`.
- **Where**: task 4.

## R8: Build lists its tasks by number, without waves or times

- **Decision**: Build's tasks are "Tasks 1–4" (done, grouped), the current task by number and title,
  and "Tasks 6–9" (to do, grouped): no wave or duration.
- **Rationale**: the plan's items give each task's number, title, and steps checked; they give no
  waves or times, and the spec asks only for "its tasks".
- **Alternatives considered**: the mockup's waves and minutes: rejected, they need data the core
  does not read.
- **If wrong**: the core would send them with the plan's items, and the rows add them.
- **Where**: task 6.
