# Rulings: `m` opens the model picker

The low-impact choices made while building [the change](proposal.md), inside the limits of the
[Keyboard](/specs/decisions/keyboard.md) decision. None binds future work: those are decisions.

## R1: `m` belongs to a composer's picker

- **Decision**: a composer's picker declares `m` beside its `Space a`, with `hasPageKey`, so `m`
  works wherever a composer picks what a session runs on: the New page, a session's page, and a
  feature's session in a review page's column. In a running session it opens the effort step, as the
  button and `Space a` do. The other pickers, a round's banner beside "Apply the answers" on the
  inbox and the decisions, and the change's start dialog, keep the button and `Space a` alone.
- **Rationale**: the proposal names the New page and a session's page. An answered inbox triage's
  banner holds a picker on the same page as the inbox's movable notes, whose `m` is move mode: the
  registry refuses a key bound twice on one page, and the inbox stopped drawing. A start dialog is a
  layer, where no page key runs. One opt-in in
  [`ComposerPicker.tsx`](/packages/web/src/ComposerPicker.tsx) reaches every composer.
- **Alternatives considered**: `m` on every picker but the inbox's banner, which gives the decisions
  page's banner the key and the inbox's not, for the same banner.
- **If wrong**: one prop to pass to `RoundBanner`'s picker in
  [`StartChat.tsx`](/packages/web/src/StartChat.tsx), on the pages without movable rows.
- **Where**: [`SessionPicker.tsx`](/packages/web/src/SessionPicker.tsx),
  [`ComposerPicker.tsx`](/packages/web/src/ComposerPicker.tsx)

## R2: `m` is free on these pages, though a list's base key

- **Decision**: `m` keeps its base meaning, move mode, on a list whose rows move, and means the
  model on the pages above, none of which has a row to move. The
  [keyboard guide](/specs/ui/keyboard.md) names it among the pages' own keys.
- **Rationale**: the decision forbids a key meaning two things on one page, not across pages. The
  other `m` bindings are the movable rows of home, the inbox, and the priorities, and the Git page's
  conflicts menu, none of which draws a composer. The New page's entries list moves no row.
- **If wrong**: a page that one day draws a composer beside movable rows would declare `m` twice:
  the registry's conflict check throws in development and in the tests, and
  [`keys-inbox.test.tsx`](/packages/web/src/__tests__/keys-inbox.test.tsx) checks the inbox's case.
- **Where**: [`keyboard.md`](/specs/ui/keyboard.md)

## R3: The status line hints `m model`, or `m effort`

- **Decision**: `m` has a status-line hint, "model" on the New page and before a session's first
  message, "effort" in a running session, before `i insert`.
- **Rationale**: picking the model is one of the few things done on these pages before writing, and
  the guide's status line holds the page's most important keys. `Space a` stays unhinted, a second
  key for the same action.
- **Where**: [`SessionPicker.tsx`](/packages/web/src/SessionPicker.tsx)
