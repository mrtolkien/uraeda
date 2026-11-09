# Rulings: `m` opens the model picker

The low-impact choices made while building [the change](proposal.md), inside the limits of the
[Keyboard](/specs/decisions/keyboard.md) decision. None binds future work: those are decisions.

## R1: `m` lives with the picker, wherever it shows

- **Decision**: the picker declares `m` beside its `Space a`, so `m` works wherever a composer picks
  what a session runs on: the New page, a session's page, and a feature's session in a review page's
  column. In a running session it opens the effort step, as the button and `Space a` do.
- **Rationale**: the proposal asks for every page where the model or effort can change. One
  declaration in [`SessionPicker.tsx`](/packages/web/src/SessionPicker.tsx) covers them all, and
  goes with the picker where it does not show.
- **Alternatives considered**: a binding per page, which a new place for the picker would miss.
- **Where**: [`SessionPicker.tsx`](/packages/web/src/SessionPicker.tsx)

## R2: `m` is free on these pages, though a list's base key

- **Decision**: `m` keeps its base meaning, move mode, on a list whose rows move, and means the
  model on the pages above, none of which has a row to move. The
  [keyboard guide](/specs/ui/keyboard.md) names it among the pages' own keys.
- **Rationale**: the decision forbids a key meaning two things on one page, not across pages. The
  only other `m` bindings are the movable rows of home, the inbox, and the priorities, and the Git
  page's conflicts menu: no page shows both. The New page's entries list moves no row.
- **If wrong**: a page that one day shows a session's composer beside movable rows would declare `m`
  twice, and the registry's conflict check would throw on that page, in its tests as in the app.
- **Where**: [`keyboard.md`](/specs/ui/keyboard.md)

## R3: The status line hints `m model`, or `m effort`

- **Decision**: `m` has a status-line hint, "model" on the New page and before a session's first
  message, "effort" in a running session, before `i insert`.
- **Rationale**: picking the model is one of the few things done on these pages before writing, and
  the guide's status line holds the page's most important keys. `Space a` stays unhinted, a second
  key for the same action.
- **Where**: [`SessionPicker.tsx`](/packages/web/src/SessionPicker.tsx)
