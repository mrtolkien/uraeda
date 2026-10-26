---
verdict: changes-requested
commit: d47de07
---

# Review: Spec, Leader key/shortcut map

## C1: Line 58, under "US1: Open the leader menu with Space (P1)"

> [Leader menu, top level](/packages/web/src/keys/LeaderMenu.stories.tsx#TopLevel)

Story LeaderMenu.stories.tsx#TopLevel, desktop, element with “space Find anything…”: Use the space
key icon, and use icons for all entries. Make sure the icons are defined only once for both the
sidebar and the leader menu. The leader menu should derive cleanly from features, because it will
grow as we add more features.

## C2: Lines 55–56, under "US1: Open the leader menu with Space (P1)"

> Outside text fields, Space opens a menu of what the next key does. Keys typed quickly run without
> showing it. A group key goes down a level, Backspace goes up, and Escape closes.

We also need a key for "Needs You", but n is taken. C for "Continue", which then opens a small
picker if there's more than one option.

## C3: Line 60, under "US1: Open the leader menu with Space (P1)"

> [Leader menu, New group](/packages/web/src/keys/LeaderMenu.stories.tsx#NewGroup)

Story LeaderMenu.stories.tsx#NewGroup, desktop, group “Space n”: The leader menu should be in
alphabetical order

## C4: Line 107, under "US2: Go anywhere, and move the same way everywhere (P1)"

> | `j` `k`, `↓` `↑` | move to the next or previous row, card, or option |

also accept `+` and `-`

## C5: Line 149, under "US3: A few keys of each page's own (P2)"

> | A session, and the New page | `i` focuses the text box, and Escape leaves it, keeping the draft
> |

Well the new page needs keys to select the kind of new activity we are creating!

## C6: Line 145, under "US3: A few keys of each page's own (P2)"

> | Priorities | `a` opens the add form, `o` adds in the selected row's section, `i` edits the line,
> `m` moves it to another section |

Accept HJKL (shifted versions) for movement, same with shift+arrow and shift+`+/-`

## C7: Lines 213–214, under "US6: The status line shows the keys that work (P3)"

> The status line draws the hints of the page's registered keys, as it does now, and nothing else.
> On a phone it shows none, and the keys still work.

We need to tell which shortcuts should be in the status bar and which shouldn't, or it will become
too messy: add the metadata to keys. For example just show HJKL, not the arrows or + and -
