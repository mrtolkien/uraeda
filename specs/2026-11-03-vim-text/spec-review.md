---
verdict: changes-requested
commit: 0fca081
---

# Review: Spec, Vim in text edit mode

## C1: Lines 86–87, under "US2: Vim's keys, behind a switch (P1)"

> You turn Vim keys on in the settings' Keyboard section, and every field takes Vim's keys, starting
> in insert mode. Escape goes to normal mode; a second Escape does what Escape did before.

The status line looks a bit weird, it should look close to LazyVim's default conf. But I see the
mockup is very basic. Navigation can be just "NAV".

Also call the setting "Vim mode"

## C2: Lines 156–157, under "US5: Open a file as a buffer (P2)"

> On any page showing one file, `Space b` opens the whole file as it is on disk, frontmatter
> included, in the editor. You edit it, Vim on or off, and save with Ctrl+Enter, `:w`, or Save.

In that case, the buffer should take _the whole page_. Remove all unnecessary UI.
