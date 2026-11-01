---
kind: change
finished: 2026-11-01
pull-request: https://github.com/mrtolkien/uraeda/pull/82
---

# Record: I dislike moving buttons: for example on feature start, the composer jumps…

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-01, finished on
> 2026-11-01, in [its pull request](https://github.com/mrtolkien/uraeda/pull/82). Its full files are
> in git: `git log -- specs/changes/2026-11-01-stable-buttons/`.

## What and why

The human disliked buttons that move: on a feature's start, the composer jumped around. They asked
for stable layouts, above all in the standard flow: opening a session, starting a feature or a
change.

## Behaviour

- **A session's composer sits at the window's foot from its first draw**: opening a session, its
  first message, and a change's start no longer move it down as the transcript loads and grows. It
  stays at the same place scrolled up, at the transcript's end, and while the agent works, on a
  desktop and on the phone, where the page is no taller than the window under the tabs and the bar.
- **A feature's start draws in its session's frame**: its page has the session's crumbs, named by
  the start's title, and its column, Activity and Changes. Its steps stay until the feature's
  session replaces them, once, at the same place, without the app's "Loading…".
- **A feature's page draws once, with its "Next"**: "Next" no longer arrives about 280 ms later on
  top, pushing the sessions and the timeline down by 180 px.
- **The UI guides say it**: [space and motion](/specs/ui/space-and-motion.md), "Buttons stay put
  through a flow".

## Design

- **The composer at the foot**: a session's [`Page`](/packages/web/src/layout/Page.tsx) is `isFull`,
  a flex column at least as tall as `--size-page-height`, which
  [`Shell.tsx`](/packages/web/src/Shell.tsx) sets to the window under the status line, less the
  phone's tabs. The composer in [`SessionView.tsx`](/packages/web/src/SessionView.tsx) takes
  `marginBlockStart: auto`. A full page has no bottom padding, so the composer at the page's end is
  where it sticks while the page scrolls; the box keeps the composer's own 14 px over the status
  line.
- **The start's frame**: `Framed`, in [`SessionView.tsx`](/packages/web/src/SessionView.tsx), gives
  a starting session the session's column without the branch's changes, which cannot be read before
  the start lands, and [`Crumbs`](/packages/web/src/Crumbs.tsx) takes the start's title until the
  workspace lists the feature. `FeatureOrStart`, in
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx), keeps the start's last plan and steps:
  once the start lands, the same [`StartingSession`](/packages/web/src/session/StartingSession.tsx)
  stays, reading nothing more, until the feature is read with `useFeature`'s request, then the
  feature's session replaces it. The steps vanished before because the write left the queue before
  the feature was read; the "Loading…" came from the feature's session suspending on its first read.
- **The feature page's "Next"**: [`FeaturePage`](/packages/web/src/feature/FeaturePage.tsx) asks for
  its history, the agent, and the recommended message with the feature, through `readAlong`, and
  "Next" lost its own `Suspense`, which drew nothing until the history was in and its two reads came
  after.
- **No test**: the [testing](/specs/decisions/testing.md) decision leaves layout to the human's
  review in the sandbox. Each item was measured in a headless browser on the sandbox, at 1400 px and
  390 px, in both themes.

## Gotchas

- **A short session leaves room between its transcript and its composer**: the composer at the
  window's foot is the stable place, which the space and motion guide's "no void" gives way to.
- **The composer's field is replaced once as a feature's start lands**: the start's page and the
  feature's session are different components. The draft is kept by its key, but a human typing at
  that moment loses the focus.

## Follow-ups

- A session boxed in a document's column keeps its composer under its transcript: the column was out
  of the proposal's flows.
