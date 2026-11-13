---
icon: keyboard
---

# Keyboard

> "Mouse is not necessary to do _any_ action."

Said of the review pages, and meant for the product: "We're adding keyboard navigation for the
_whole_ application." The key registry is the app's one list of shortcuts: each key with what it
does, its label, and its hint. The leader menu is the menu of key sequences that Space opens. Which
keys a view takes, and how it shows them, is the [keyboard guide](../ui/keyboard.md)'s.

## Rules

- Every action works by keyboard and by tap, never by hover or a single key alone. _So:_ a new view
  ships with its keys in the same feature. A session's side column that no key reached was a bug,
  not a later feature.
- A shortcut is declared in the key registry, and listened for nowhere else. _So:_ a page that adds
  `n` declares it there, and the leader menu, the status line, and the key map show it with no
  further work. Only the keys a text field or an open dialog takes for itself stay with it.
- A key never means two things at once on one page; another page, or a selection that shows it while
  it holds, may give it another meaning. _So:_ `n` is New on most pages and Next on a round of
  questions. A held question's `a` to `f` pick its options, so `b` is Back again only after Escape.
  `m` opens a composer's model picker only on pages with no row to move.
- Single-key shortcuts can be switched off, by a setting in the settings file. _So:_ with the switch
  off, `?` does nothing, and `Ctrl+K` still opens the leader menu, where `?` opens the key map.
- Keys work at every width: a narrow screen hides their hints, never the keys. _So:_ a round's `n`
  and `p` reach the blank questions on a tablet with a keyboard, while the phone's bars show icons
  and no key.

## Why

The human works from the keyboard all day, with LazyVim's habits, and a view that needs the mouse
stops them. Keys handled inside views drift from their hints and clash unseen. One registry feeds
every place that shows a key, and catches a clash as the view is made. A single key is a slip away
under speech input or a screen reader, so single keys can be turned off. History:
[Leader key](../done/2026-10-26-leader-key.md).

## Alternatives considered

- No keys on narrow screens, since a phone has no keyboard: a tablet's keyboard, or a narrow window
  on a desk, would lose them.
- The switch for single keys kept on the device: it would not follow the human to their next device,
  as the settings file does.

## Applies to

- [`app/`](/app/), and every feature that adds or changes a view, an action, or a shortcut
- [`crates/core/`](/crates/core/)'s settings, for the switch
