---
status: active
approved-by: mrtolkien
icon: keyboard
---

# Keyboard

The whole web UI can be driven from the keyboard, and every key is declared once, in one registry.
Space opens a leader menu of nested, mnemonic groups, and every page shares one base keymap with a
few keys of its own. The human can turn the single-key shortcuts off, and none of them is ever the
only way to do something.

## Rules

- A shortcut that acts on the page MUST be declared in the key registry, with its label, icon,
  group, and whether the status line shows it, and MUST NOT be listened for anywhere else. Checked
  by a structural test and review.
- Single-key shortcuts MUST be switchable off by a setting in the settings file, and a modifier
  chord MUST stay available to open the leader menu while they are off. Checked by the settings
  page's tests.
- A single-key shortcut MUST NOT be the only way to do something. Checked by review.
- Space MUST open the leader menu outside text fields and while no layer is open, and the menu MUST
  wait a short moment, so quick typing shows nothing. Checked by the UI tests.
- Keys MUST work at every width, and MUST NOT show their hints on narrow screens. Checked by the UI
  tests.
- Every page MUST share one base keymap, arrows or `h j k l` to move or scroll, `a`, `i`, and `o` to
  add and edit, and `gg` and `g` sequences to go, and its own keys MUST be few and mnemonic. Checked
  by review.
- A key MUST NOT mean two things on one page, though two pages may give it different meanings.
  Checked by the registry's tests.
- The status line SHOULD show the keys that work on the page, drawn from the registry. Checked by
  the UI tests.

## Why

Keys were scattered through components, each paired by hand with a status line hint, and the rule
"an open layer owns the keys" had three copies. One registry gives the leader menu, the hints, and
the later key search a single source
([the registry](../2026-10-26-leader-key/discovery-01.md#rules-and-their-owners)). The human asked
for keyboard navigation of the whole application, with a Space leader as in LazyVim and Helix, and
chose to turn single-key shortcuts off from the settings file, as accessibility guideline 2.1.4
requires a way to do
([the off switch](../2026-10-26-leader-key/clarifications-01.md#q4-how-should-the-shortcuts-be-turned-off-as-accessibility-asks),
[the scope](../2026-10-26-leader-key/clarifications-01.md#q1-how-much-of-the-proposal-should-this-feature-build),
[a decision](../2026-10-26-leader-key/clarifications-01.md#q9-should-keyboard-rules-become-a-decision)).

## Consequences

- A new feature declares its keys in the registry, and the leader menu, the status line, and a key
  search read them with no further work.
- A key conflict on one page fails a test, instead of being found by pressing keys.
- Every shortcut needs a label, an icon, and a group, and a page cannot grab a key on its own.
- The setting is read by the server and the page, so it lives in the Rust core with the others.

## Applies to

- [`packages/web/`](/packages/web/), its key registry, and every feature that adds or changes a view
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs), for the switch
