---
kind: change
finished: 2026-11-01
pull-request: https://github.com/mrtolkien/uraeda/pull/83
---

# Record: When creating a new session/change/feature the focus should be on the text field

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-01, finished on
> 2026-11-01, in [its pull request](https://github.com/mrtolkien/uraeda/pull/83). Its full files are
> in git: `git log -- specs/changes/2026-11-01-text-focus/`.

## What and why

Opening the New page, or a feature's New session, left the focus on the page: the human had to click
the text field, or press `i`, before typing what they came to start. The human asked for the focus
to be in the text field, and to be told if that was not a good idea or would behave weirdly.

## Behaviour

- **The New page opens with the focus in the picked kind's composer**, a session's or a change's
  message, or a feature's proposal, on every visit: from "＋ New", `a`, `g n`, the leader's
  `Space n s c f`, a proposal's Start, Home's Setup, and Back to a page left at its top.
- **`s c f` pick a card and move the focus to its composer**, as a click or Space on a card does.
  The cards' arrows, Home, and End move the pick and keep the focus on the cards.
- **The New page's single keys wait for `Escape`**: with the focus in the composer, `s c f`, `/`,
  `j k`, and `Space` type into it, until `Escape` leaves the field for the page, as on every field.
  `i` comes back to the composer.
- **Back to a New page scrolled down its entries keeps its place**, and the focus where it was:
  focusing the composer, above the entries, would scroll the human's place away.
- **The phone's New page with no card picked has no composer to focus**: the pick focuses it, as
  before. Opened at a kind, it focuses the composer, which opens the phone's keyboard.
- **A feature's New session (`?new`) opens with the focus in its composer.** A session that is not
  new, the feature's latest or an earlier one, leaves the focus to the page.
- **An open overlay, or the next page while the New page is still drawn, never takes the focus to
  the composer.**

## Design

The New page focuses its composer once per visit, a history entry, in `useComposerFocus`
([`NewPage.tsx`](/packages/web/src/NewPage.tsx)): a pick by the arrows goes through `redirect()`,
which keeps the entry, so it never takes the focus, while the leader's `Space n c` on the New page
pushes a new entry, a new visit, though the page stays mounted. The effect skips an entry with a
saved scroll, an overlay's entry, and a location that is no longer the New page, since the page is
drawn a step behind the location. [`KindCards.tsx`](/packages/web/src/KindCards.tsx) passes
`focus: true` for `s c f`. The feature's New session focuses in `useFocusOnOpen`
([`Composer.tsx`](/packages/web/src/Composer.tsx)), when `isNewSession` is set.
[`text-focus.test.tsx`](/packages/web/src/__tests__/text-focus.test.tsx) checks each entry point,
the arrows, Back, the phone, and a session that is not new. The
[keyboard guide](/specs/ui/keyboard.md#focus) says the rule.

## Gotchas

- **Focusing on the page's mount is not enough**: the page's key is its pathname, so `/new` and
  `/new?kind=change` share one mounted page, and only the history entry tells a new visit
  ([`App.tsx`](/packages/web/src/App.tsx), `pageKey`).
- **Astryx's composer handle has no `preventScroll`**: its `focus()` restores the caret, so it is
  kept, and Back to a scrolled page skips the focus rather than focusing out of view.
- **The UI tests press keys on `document.body`** whatever holds the focus, so the New page's key
  tests in `keys-pages.test.tsx` still pass with the focus in the composer: they check the keys, not
  what a user's typing reaches.
