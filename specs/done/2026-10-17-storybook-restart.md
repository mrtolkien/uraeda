---
kind: change
finished: 2026-10-17
---

# Record: Restart a Storybook when its checkout's commit changes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-17, finished on
> 2026-10-17, merged without a pull request. Its full files are in git:
> `git log -- specs/changes/2026-10-17-storybook-restart/`.

## What and why

A checkout's Storybook was started once and kept until it idled out, failed, or "Try again" was
pressed. After a commit that changed what Storybook reads only as it starts, its configuration and
fixture in `.storybook/`, its dependencies, or the server code it runs, the embeds showed stale or
blank stories: the round mockups of the clarifications redesign rendered blank, since their
Storybook had started before the commit that added their fixture.

## Behaviour

- A view of a checkout's stories at another commit than the one its Storybook started at starts it
  again, as "Try again" does, a failed one included. The page's embeds show "starting", then turn
  ready live, without a reload.
- A view at the same commit, or at a commit that could not be read, keeps the Storybook as it is, a
  failed one staying failed until "Try again".
- Every commit counts, the web UI's own included: submitting answers, or committing the inbox or the
  priorities, restarts that checkout's Storybook at its next view, though only `specs/` changed.
  Uncommitted edits to `.storybook/` still need "Try again".

## Design

The core reads a checkout's commit through gix,
[`checkout_commit`](/crates/core/src/api/preview.rs), exposed by the binding as `checkoutCommit`.
[`runnable`](/packages/server/src/fate/preview.ts) puts it on the `Checkout` of every view, and
[`Previews.view`](/packages/server/src/preview/runner.ts) compares it with the commit its Storybook
started at. A moved commit goes through `#replace`: the new Storybook's entry takes the base before
the old one is stopped, since a base without a state makes fate forget the records a page read, and
the page would stay on "starting".

## Changes after approval

- The review asked for a check that the replaced Storybook's process ends: the commit test waits for
  it.

## Follow-ups

- A Storybook whose first commit read failed never restarts on a commit until it idles out (inbox,
  Deferred fixes).
- Two views racing a commit can restart a Storybook back to the older commit, then forward again
  (inbox, Deferred fixes).
- Skipping commits that change only `specs/` would spare the restarts the web UI's own commits
  cause, with a diff read in the core.
- `runner.ts` is at 477 of its 500 lines: its next growth splits it.
