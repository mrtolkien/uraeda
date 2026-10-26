---
status: changes-requested
revision: 2
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Leader key/shortcut map

> [!NOTE]
>
> Changes requested on 2026-10-26: 1 comment in spec-review.md.
>
> - You approve a Space leader menu, `g` sequences, and one base keymap on every page, all declared
>   in one key registry, with a setting in the settings file that turns single-key shortcuts off.
> - Since your review, all seven comments are done but one part: shifted `+` and `-` cannot move an
>   item, because `+` already needs Shift. `J K H L` and Shift with the arrows do.
> - Changed decision: [Keyboard](../decisions/keyboard.md) now says each key is declared with its
>   label, icon, and whether the status line shows it. The menu and the sidebar share one list of
>   places and their icons.
> - New: `c` is Continue, which goes to what needs you, with a small picker when there is more than
>   one. The New page's kinds have keys: `s`, `c`, `f`.
> - Read one way: the menu is in alphabetical order of its keys, `+` is next and `-` previous, and
>   the shifted movement keys move the selected item itself.
> - Unverified, unchanged: Space under a screen reader's browse mode, and the preview's raw file
>   text, which the plan's first tasks check.
> - Risk tier `medium`, unchanged. The plan does not wait for your review. Users drive the whole web
>   UI from the keyboard. Space opens a leader menu of nested groups and searches, `g` sequences go
>   to pages, and every page shares one base keymap. One registry declares every key, so a key
>   search and a dynamic status line can come later. See the [proposal](proposal.md),
>   [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## Your review

- **C1** (icons, one definition, derive from features): done. The menu shows the Space key as its
  icon and every entry with one. The sidebar, the phone's tabs, and the menu read one list of
  places, and the menu's entries come from the keys each feature declares, with their label and
  icon.
- **C2** (a key for Needs you): done. `c` is Continue: it opens the one thing that needs you, or a
  small picker of them when there are several.
- **C3** (alphabetical menu): done. Entries are in alphabetical order of their keys, Space and the
  symbols first.
- **C4** (`+` and `-`): done. `+` moves to the next row and `-` to the previous, like `j` and `k`.
- **C5** (New page keys): done. On the New page, `s`, `c`, and `f` pick Session, Change, or Feature.
- **C6** (shifted movement): done, in part. `J K H L` and Shift with the arrows move the selected
  item itself. Shift with `+` and `-` is not offered: `+` already needs Shift, and Shift with `-`
  types `_`, so the keys could not be told apart.
- **C7** (which keys the status line shows): done. Each key is declared with whether its hint shows:
  the line shows `j k`, and not the arrows, `+`, or `-`.

## Decisions

- **New: [Keyboard](../decisions/keyboard.md)**. Every shortcut is declared in one registry, pages
  share a base keymap, and single-key shortcuts can be switched off and are never the only path.

Relied on:

| Decision                                     | What it means for this spec                                     |
| -------------------------------------------- | --------------------------------------------------------------- |
| [UI behaviour](../decisions/ui-behaviour.md) | every action works by keyboard, and lists share one keyboard    |
| [UI layout](../decisions/ui-layout.md)       | the menu is a sheet on narrow screens                           |
| [UI coherence](../decisions/ui-coherence.md) | one drawing of a key, shared by the menu and the status line    |
| [Settings](../decisions/settings.md)         | the switch lives in the settings file, through the Rust core    |
| [UI checks](../decisions/ui-checks.md)       | tests press keys as a user does, and screenshots are reviewed   |
| [Preview](../decisions/preview.md)           | the menu's mockups are stories, and two sketches are HTML pages |

## User stories

### US1: Open the leader menu with Space (P1)

Outside text fields, Space opens a menu of what the next key does. Keys typed quickly run without
showing it. A group key goes down a level, Backspace goes up, and Escape closes. Each entry has an
icon, the Space key is drawn as its own, and the entries are in alphabetical order of their keys,
Space and the symbols first.

[Leader menu, top level](/packages/web/src/keys/LeaderMenu.stories.tsx#TopLevel)

[Leader menu, New group](/packages/web/src/keys/LeaderMenu.stories.tsx#NewGroup)

The top level, from the groups you chose:

| Key                 | Does                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Space`             | find anything: every kind of thing in one picker                                                             |
| `c`                 | continue: open what needs you, or pick among them when there are several                                     |
| `h` `i` `p` `d` `s` | Home, Inbox, Priorities, Decisions, Sessions                                                                 |
| `,`                 | Settings                                                                                                     |
| `n`                 | new: `s` session, `c` change, `f` feature, `n` note, `p` priority                                            |
| `f`                 | find, one picker per kind: `f` features, `c` changes, `s` sessions, `d` decisions, `n` notes, `p` priorities |
| `u`                 | ui: `[` fold navigation, `]` fold right column, `t` theme                                                    |
| `r`                 | switch repository                                                                                            |

Key scenarios:

1. **Given** the inbox with no field focused, **When** you press Space, `n`, `n` within half a
   second, **Then** the add-note form opens and the menu never showed.
2. **Given** the home page, **When** you press Space and wait half a second, **Then** the menu shows
   with the title `Space`, and the entries above.
3. **Given** the menu at `Space n`, **When** you press Backspace, **Then** it shows `Space`; Escape
   closes it.
4. **Given** the focus in the chat composer, **When** you press Space, **Then** a space is typed and
   no menu opens.

More scenarios:

1. **Given** three cards need you, **When** you press `Space` `c`, **Then** a small picker lists
   them, and Enter opens the selected one. With one card it opens at once, and with none the menu
   says "Nothing needs you".
2. **Given** the menu is open, **When** you press a key bound to nothing, **Then** the menu stays
   open and nothing runs.
3. **Given** a dialog is open, **When** you press Space, **Then** the dialog's own keys act.
4. **Given** the focus on the "Note" button, **When** you press Space, **Then** the menu opens and
   the button is not pressed; Enter still presses it.
5. **Given** the focus on a checkbox, **When** you press Space, **Then** it ticks, and no menu
   opens.
6. **Given** a phone-width window with a keyboard, **When** you press Space and wait, **Then** the
   menu spans the window's width above the page, in one column.

### US2: Go anywhere, and move the same way everywhere (P1)

`g` then a letter goes to a page, `gg` scrolls to the top, and every page answers the same base
keys. A pending `g` shows the same menu after the same delay, titled `g`, and waits up to 2 seconds
for its second key.

The base keymap, outside text fields and with no layer open:

| Keys                                     | Do                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `j` `k`, `↓` `↑`, `+` `-`                | move to the next or previous row, card, or option                                                            |
| `h` `l`, `←` `→`                         | move between columns, where a page has them                                                                  |
| `J` `K` `H` `L`, `Shift` with the arrows | move the selected item itself: down, up, to the previous or next column or section, where items can be moved |
| `Home` `End`                             | first and last row                                                                                           |
| `g` `g`, `G`                             | top and bottom of the page                                                                                   |
| `Enter`, `Escape`                        | open the selected row, close the pane or go back one step                                                    |
| `[` `]`                                  | fold the navigation, fold the right column                                                                   |
| `a`                                      | add the page's main kind of item, at its default place                                                       |
| `o`                                      | add beside the selected row: same section or category                                                        |
| `i`                                      | edit the selected item in place, or focus the page's text box                                                |
| `g` then `h` `i` `p` `d` `s` `,`         | go to Home, Inbox, Priorities, Decisions, Sessions, Settings                                                 |

A key a page has no use for is unbound there and not hinted.

Key scenarios:

1. **Given** the priorities page, **When** you press `g` then `i`, **Then** the inbox opens.
2. **Given** a spec page scrolled halfway, **When** you press `g` `g`, **Then** it scrolls to the
   top, and `G` scrolls to the bottom.
3. **Given** you pressed `g`, **When** 2 seconds pass without a key, **Then** the sequence ends, and
   a later `a` acts as `a` does on that page.
4. **Given** the priorities page with a Next entry selected, **When** you press `j`, **Then** the
   selection moves to the next row and its pane follows, as today.

More scenarios:

1. **Given** you pressed `g`, **When** you press `x`, which no `g` sequence uses, **Then** the
   sequence ends and `x` does nothing.
2. **Given** the questions page, **When** you press `n`, **Then** it jumps to the next unanswered
   question, as today.

### US3: A few keys of each page's own (P2)

Pages add few keys beyond the base ones, each a mnemonic. Home and Sessions have none besides `a`.

| Page                                  | Keys beyond the base                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Home, Sessions                        | `a` opens the New page                                                                                                      |
| Priorities                            | `a` opens the add form, `o` adds in the selected row's section, `i` edits the line, `m` opens a menu to move it             |
| Inbox                                 | `a` opens the add-note form, `o` adds in the selected note's category, `i` edits the note, `m` moves it to another category |
| Questions, triage, decisions check    | `n` `p` next and previous unanswered question, as today                                                                     |
| Decisions                             | `/` opens the decisions picker, as today                                                                                    |
| A session                             | `i` focuses the text box, and Escape leaves it, keeping the draft                                                           |
| New                                   | `s` `c` `f` pick Session, Change, or Feature, `i` focuses the text box                                                      |
| Documents, features, settings, editor | the base keys only                                                                                                          |

Key scenarios:

1. **Given** the inbox with a note in "Ideas" selected, **When** you press `o`, **Then** the add
   form opens with "Ideas" as its category.
2. **Given** a session's page, **When** you press `i`, **Then** the composer takes the focus, and
   Escape returns the focus to the page with the draft kept.
3. **Given** the priorities page with a line selected, **When** you press `m`, **Then** the move
   menu opens for that line.
4. **Given** the Next section's second line selected, **When** you press `K`, **Then** it moves
   above the first, as a drag would, and `L` moves it to Later.
5. **Given** the New page with Session picked, **When** you press `f`, **Then** the Feature card is
   picked, as a click would.

### US4: Find anything with a picker (P2)

`Space f` then a kind opens a picker over that kind, and `Space Space` over every kind. It is the
Jump palette generalised: an input, a list, and a preview of the selected item as raw markdown.

[Picker with a raw markdown preview](mockups/picker.html)

The kinds are features, changes, sessions, decisions, notes, and priorities. A feature's and a
change's preview is its proposal, a decision's its file, a note's its text, and a priority's its
line with its children. A session's preview is its title, state, and branch, as plain lines.

Key scenarios:

1. **Given** any page, **When** you press `Space` `f` `d` and type "ui", **Then** the list shows the
   decisions matching, the first selected, with its file as raw markdown beside it.
2. **Given** that picker, **When** you press Enter, **Then** the decision opens and the picker
   closes.
3. **Given** any page, **When** you press `Space` `Space`, **Then** the list holds every kind, each
   row labelled by its kind.
4. **Given** the decisions page, **When** you press `/` and type three letters, **Then** Enter opens
   the decision they name, as today.

More scenarios:

1. **Given** the picker is open, **When** you press Escape, **Then** it closes and the focus returns
   to where it was.
2. **Given** a phone-width window, **When** the picker opens, **Then** it is a sheet showing the
   list alone.

### US5: Turn single-key shortcuts off (P2)

A Keyboard section of the settings page has one switch, "Single-key shortcuts", on by default. Off,
the leader, the `g` sequences, and every letter key stop acting. Arrow keys, Home, End, Enter,
Escape, and Ctrl or Cmd+K keep working.

[The setting, on and off](mockups/keyboard-setting.html)

Key scenarios:

1. **Given** the switch on, **When** you turn it off, **Then** Space, `g`, and letter keys stop
   acting at once, and the status line shows no letter hints.
2. **Given** the switch off, **When** you press Ctrl+K, **Then** the leader menu opens, and its keys
   work while it is open.
3. **Given** the switch off, **When** you press `j`, **Then** nothing moves; `↓` still does.

More scenarios:

1. **Given** the settings file says `single_key_shortcuts = false`, **When** the page loads,
   **Then** the switch shows off and the shortcuts are off.

### US6: The status line shows the keys that work (P3)

The status line draws the hints of the page's registered keys, as it does now. Each key says whether
its hint shows, so a line with `j k` does not also list the arrows, `+`, and `-`. On a phone it
shows none, and the keys still work.

Key scenarios:

1. **Given** the questions page on a wide screen, **When** it shows, **Then** the status line reads
   `n p unanswered` among its hints, drawn from the registry.
2. **Given** the priorities page, **When** you open a dialog, **Then** the page's hints leave the
   line until it closes.
3. **Given** a list page, **When** it shows, **Then** the line reads `j k move`, and the arrows,
   `+`, and `-` move too without a hint.

## Architecture

The keys become data. A registry in `packages/web/src/keys/` holds every binding, and the menu, the
picker, and the status line read it, while no component listens for keys on its own. This follows
the [Keyboard decision](../decisions/keyboard.md), and fixes the three copies of the open-layer rule
found in [the code](discovery-01.md#rules-and-their-owners). We write the matching ourselves, as you
chose, rather than adding a library: [the options](discovery-01.md#the-key-library).

- **The places** are one list of Home, Inbox, Priorities, Sessions, Decisions, and Settings, each
  with its label, icon, and path. The navigation column, the phone's tabs, and the leader menu read
  it, so an icon is defined once. It exists already in the mockup's code.
- **The key registry** holds each binding: its keys, label, icon, group, page, whether its hint
  shows, and handler. A feature adds its keys there, and the leader menu is whatever the registry
  holds for the step, sorted by key, so it grows with the features. It owns the one window listener,
  matching by the typed character, skipping text fields, composition, and open layers, and it owns
  sequences with their 2-second wait. It refuses two meanings for one key on a page.
- **The off switch** is read by the registry. Off, it drops every binding of a single character, and
  keeps the modifier chord for the menu.
- **The leader menu** draws the registry's current step after a half-second delay, in the bottom
  right, titled with the keys pressed. Its mockup is already a story.
- **The key picker** is the Jump palette made general: one component, a source per kind, and a raw
  markdown preview. The decisions page's `/` uses its decisions source, and Continue uses a source
  of what needs you.
- **The keyboard setting** adds a `[keyboard]` table to the settings in the Rust core, and a
  Keyboard section to the settings page. See [the data model](data-model.md).
- **The status line** reads hints from the registry, replacing its separate declarations.
- **The key cap** draws a key as typed. It is already shared by the status line and the menu.

Tradeoffs:

- Matching by hand means we own sequences, composition, and their tests, and have no layout
  fallback.
- The decisions picker loses its rendered preview for now: raw markdown shows instead.
- Moving every existing shortcut onto the registry touches about ten files in one feature.
- `Escape` leaves a composer for the page, a new meaning for it there.

## Edge cases

| Importance | Situation                                     | What happens                                                    |
| ---------- | --------------------------------------------- | --------------------------------------------------------------- |
| High       | Space in a text field, or while composing     | it types a space or composes; no menu                           |
| High       | A dialog, menu, or select is open             | its keys act; the leader and page keys stay silent              |
| High       | The switch is turned off with the menu open   | the menu closes                                                 |
| High       | Space on a focused button                     | the menu opens and the button is not pressed; Enter presses it  |
| High       | The settings file cannot be read              | shortcuts stay on, and the settings page says so                |
| High       | `Space` `c` with nothing that needs you       | the menu says "Nothing needs you" and nothing opens             |
| Normal     | Space on a checkbox, radio, switch, or select | it keeps Space                                                  |
| Normal     | The page changes while the menu is open       | the menu closes                                                 |
| Normal     | A letter on AZERTY or Dvorak                  | it matches the character typed, so `h j k l` follow the letters |
| Normal     | Escape in a composer with unsent text         | focus leaves; the draft stays                                   |
| Normal     | `K` on the first line of its section          | nothing moves                                                   |
| Niche      | `/` with the browser's quick find             | the page's key wins outside text fields                         |

## Success criteria

- **SC-001** (three keys): Any page of the leader's top level opens in at most three key presses.
- **SC-002** (no flash): A key typed within the delay after Space shows no menu.
- **SC-003** (no clash): The registry's tests fail when a page binds one key twice.
- **SC-004** (nothing lost): Every shortcut that exists today works as before, through the registry.
- **SC-005** (three letters): Each decision opens with three letters or fewer between `/` and Enter.
- **SC-006** (off means off): With the switch off, no letter key, Space, or `g` sequence acts.
- **SC-007** (one icon): A place's icon and label are written once, and the navigation, the tabs,
  and the menu draw it from there.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, with
what your answers and notes changed:

- Every page gets its keys in this feature, as you chose.
- `u`, not `v`, is the ui group.
- Keys work at every width, and only the hints leave phones; the menu shows there as a sheet.
- A `g` sequence waits up to 2 seconds, not 1.
- `gg` goes to the top of the page.
- `n` means different things on different pages; `a` is the base add key.
- Previews are raw markdown.
- The menu's order: alphabetical by key, Space and the symbols first, as your review asked.

Settled while writing this spec:

- **`G`** goes to the bottom of the page, the pair of `gg`.
- **`Space Space`** opens the all-kinds picker, built from the same sources as the find group.
- **A pending `g`** shows the same menu box as Space, titled `g`, after the same delay.
- **Ctrl or Cmd+K** opens the leader menu outside text fields, and stays on when shortcuts are off.
- **`,`** is Settings, as the one top-level key left.
- **`o`** differs from `a` by the place: the selected row's section or category, not the default.
- **The setting** has no flag or variable, like the run settings.
- **Settings in the file** are read as the others are, a missing key meaning on.
- **A session's preview** is its title, state, and branch: it has no markdown.
- **`+` and `-`** move to the next and the previous row, in that order, like `j` and `k`.
- **Shifted movement** moves the selected item with the same mechanism as a drag, and only where
  items can be moved: the priorities and the inbox's notes.
- **Continue** reads the cards of the navigation's Needs you pane, so the two always agree.
- **Raw file text** for previews comes from the server, a small addition if the document tree omits
  it.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: the settings file gains a table, and every page's keys move onto a new registry.

## History

> [!NOTE]
>
> Changes requested on 2026-10-26: seven comments on the menu, the keys, and the status line.
>
> - You approve a Space leader menu, `g` sequences, and one base keymap on every page, all declared
>   in one key registry, with a setting in the settings file that turns single-key shortcuts off.
> - New decision: [Keyboard](../decisions/keyboard.md). Every key lives in the registry, pages share
>   a base keymap, and a letter key is never the only way to do something.
> - You chose every page in this one feature. It stays at 6 stories, but the keymap tables in the
>   second and third stories are what to check, key by key.
> - Read one way among several: `a` adds at the page's default place, `o` adds beside the selected
>   row, and `i` edits it. `n` is no add key, so the questions page keeps it for "next unanswered".
> - Settled while writing: `G` goes to the bottom, `Space Space` searches all kinds, a pending `g`
>   shows the same menu, and on phones the menu spans the window.
> - Unverified: Space under a screen reader's browse mode, and the preview's raw file text, which
>   the plan's first tasks check.
> - Risk tier `medium`: the settings file gains a table, and every page's keys change. The plan does
>   not wait for your review.
