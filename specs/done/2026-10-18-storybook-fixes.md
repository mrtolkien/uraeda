---
kind: change
finished: 2026-10-18
pull-request: https://github.com/mrtolkien/uraeda/pull/37
---

# Record: Storybook preview fixes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-18, in [its pull request](https://github.com/mrtolkien/uraeda/pull/37). Its full files are
> in git: `git log -- specs/changes/2026-10-18-storybook-fixes/`.

## What and why

Five loose ends of the Storybook preview, left as follow-ups by the change that restarts a
checkout's Storybook when its commit moves: two restart rules that went wrong in rare sequences, and
three gaps in what the tests and the validation script prove.

## Behaviour

- A Storybook whose first commit read failed restarts once, at the next view that reads a known
  commit, instead of staying until it idles out. A view at an unknown commit still keeps any
  Storybook.
- Two views racing a commit's move never restart a Storybook back to the older commit: only a commit
  read after the Storybook started can move it.
- The tests pin that the helper's `security` preset function receives Storybook's options, and that
  a head preset returning `undefined` adds nothing to the head.
- The validation script opens Storybook's interface inside Uraeda's own `/f/<folder>/storybook`
  page, served by Vite as `vp dev` serves it, so a regression only in the page's frame, such as the
  `?path=` forwarding, fails it. It also works from a change's worktree, which it did not.
- A failing "added export" check says whether the export was never listed or the page reloaded.

## Design

The restart rule is `moved` in [`runner.ts`](/packages/server/src/preview/runner.ts): the entry's
Storybook is at another commit when the view's commit is known and differs from the entry's (an
unknown one differs from any known one), and the view's commit was read after the entry started.
`Previews.read()` hands out an increasing stamp, [`runnable`](/packages/server/src/fate/preview.ts)
takes it before it reads the commit and puts it on the `Checkout`, and each entry keeps the count of
stamps given when it started. A checkout without a stamp counts as read now. The runner's process
helpers moved to [`process.ts`](/packages/server/src/preview/process.ts), since `runner.ts` was at
477 of its 500 lines.

The validation script, [`validate-storybook.ts`](/packages/web/scripts/validate-storybook.ts),
serves the UI with Vite and the fake agent, drives the interface and the story canvas as nested
frames, and sets its reload marker in the interface's own window. The helper tests are in
[`storybook-preview.test.ts`](/packages/web/src/__tests__/storybook-preview.test.ts), the restart
tests in [`runner.test.ts`](/packages/server/src/preview/__tests__/runner.test.ts) and
[`preview.test.ts`](/packages/server/src/__tests__/preview.test.ts).

## Changes after approval

- The review asked for tests of the stamp's boundary and of `runnable` giving the runner the stamp,
  and for the validation script to wait for the server's stop before removing its data folder.

## Follow-ups

- The validation script starts Vite and lists the repository outside its `try`, so a failure there
  leaks its temporary folders, and it copies the core's page-route and branch-to-folder rules
  (inbox, Deferred fixes).
- A Storybook started from a stale read is labelled with the older commit, so the next view restarts
  it once for nothing.
