---
status: active
approved-by: mrtolkien
icon: keyboard
---

# Keyboard

The whole web UI can be driven from the keyboard, and every shortcut is declared once, in one
registry. Space opens the leader menu, a menu of nested groups of shortcuts, and every page shares
one base set of keys. Single-key shortcuts can be turned off, and no key is ever the only way to do
something.

## Rules

- A shortcut MUST be declared in the key registry, and listened for nowhere else. Checked by a
  structural test and review.
- Every action MUST work by keyboard and by tap, never by hover or a single key alone. Checked by
  review.
- Single-key shortcuts MUST be switchable off by a setting in the settings file. Checked by the
  settings page's tests.
- A chord with a modifier key MUST open the leader menu while single-key shortcuts are off. Checked
  by the settings page's tests.
- Space MUST open the leader menu outside text fields and open layers, after a short wait, so quick
  typing shows nothing. Checked by the UI tests.
- Shortcuts MUST work at every width, with their hints hidden on narrow screens. Checked by the UI
  tests.
- Every page MUST share one base set of keys, following Vim's habits to move, add, edit, and go to a
  page. Checked by review.
- A key MUST NOT mean two things on one page, though two pages may give it different meanings.
  Checked by the registry's tests.
- A page's own keys SHOULD be few and mnemonic. Checked by review.
- The status line SHOULD show the keys that work on the page, drawn from the registry. Checked by
  the UI tests.

## Why

Keys scattered through components drifted from their hints, and one rule had three copies, so one
registry feeds the leader menu, the hints, and a search of the keys. A Space leader follows LazyVim
and Helix, the editors these keys imitate. The accessibility guideline WCAG 2.1.4 asks for a way to
turn single-key shortcuts off. History: [Leader key](../done/2026-10-26-leader-key.md).

## Consequences

- A new feature declares its keys in the registry, and the leader menu, the status line, and the key
  search read them with no further work.
- A key conflict on one page fails a test, instead of being found by pressing keys.
- Every shortcut needs a label, an icon, and a group, and a page cannot grab a key on its own.
- The switch is read by the server and the page, so it lives in the Rust core with the other
  settings.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view or a shortcut
- [`crates/core/`](/crates/core/)'s settings, for the switch
