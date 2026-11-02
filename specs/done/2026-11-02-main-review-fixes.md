---
kind: change
finished: 2026-11-02
pull-request: https://github.com/mrtolkien/uraeda/pull/87
---

# Record: Fixes from the review of recent work on main

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-02, finished on
> 2026-11-02, in [its pull request](https://github.com/mrtolkien/uraeda/pull/87). Its full files are
> in git: `git log -- specs/changes/2026-11-02-main-review-fixes/`.

## What and why

The human asked to check that the recent pull requests and the commits made straight to main were
implemented properly, and to fix what was found. Shown the findings, the human kept one: nothing
stopped the web from importing a value of the server's fate module again, which had blanked the app
in development while every check passed. The rest was not worth the work, and stable buttons only
concern the buttons that act, like sending or starting, not a page drawing in after a navigation.

## Behaviour

- **The web's lint refuses a value imported from `uraeda-server/fate`**, a re-export and a dynamic
  import included, with "import only types from uraeda-server/fate: its values import Node's
  modules". Type imports pass. Tests, under `__tests__/` and `__focused__/`, run on Node and are
  exempt.
- **The stable-buttons record and the space and motion guide say which buttons stay put**: the
  buttons that act, like sending, starting, or committing. The start's frame, kept only in the tab
  that planned the start, and a refused start's flash once dismissed are accepted.

## Design

- **The rule**: `serverFate`, a `paths` entry of the web's `no-restricted-imports` in
  [`vite.config.ts`](/vite.config.ts), with `allowTypeImports`. The tests' override turns the whole
  rule off, the Markdown entry with it, which no test imports.
- **Its guard**: the fixture
  [`server-fate-value.tsx`](/packages/web/src/__lint__/server-fate-value.tsx), refused in the
  [lint test](/packages/web/src/__tests__/lint.test.ts).
- **The docs**: the [stable-buttons record](2026-11-01-stable-buttons.md) and
  [space and motion](/specs/ui/space-and-motion.md)'s "Buttons stay put through a flow".

## Gotchas

- **Only `/fate` is guarded**: the server's other entry points, its root, `/testing`, `/dev`, and
  `/runner/claude`, import Node's modules too, and nothing refuses their values in the web. None is
  imported there today.

## Changes after approval

- Of the proposal's findings, only the lint rule was made. The others were dropped, at the human's
  word: the start's frame and a refused start's flash, the focus guards and their tests, the order
  of In progress, `g g` in the key map, the review-all record's counts, and two comments.
