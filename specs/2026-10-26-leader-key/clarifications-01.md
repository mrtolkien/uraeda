---
status: answered
---

# Clarifications, round 01: Leader key/shortcut map

> [!NOTE]
>
> Answered on 2026-10-26.
>
> - Verdict: worth building, with changes: it is too large for one spec, Space and `n` clash with
>   existing behaviour, and single-key shortcuts need an off switch.
> - Scope of this feature, and whether link hints belong in it.
> - Space taken from a focused button: the one behaviour change users feel on every page.
> - Two costs: the key library, a beta dependency or a module of ours. Also where the off switch
>   lives, in the browser or the settings file.
> - The starting keymap, with the look of the menu: both shape what you will see first.
> - A new `keyboard` decision, which would bind every later feature.
> - Points to check: `n` on two pages, `f` meaning find, screen readers.

## Context

### Goal

Navigate the whole web UI from the keyboard on desktop. Space, outside text fields, opens a
Vim-style leader menu of nested groups and pickers, shown after a short delay. Pages add their own
single-key shortcuts. Everything is declared in one extensible registry, so a key search and a
dynamic status line can come later.

### Today

Keyboard code exists, but scattered. A key and its status line hint are declared in two places, and
the rule "an open layer owns the keys" is copied three times. Nothing supports sequences like `g h`.

| Key                      | What it does today                       |
| ------------------------ | ---------------------------------------- |
| `j k h l`, arrows, Enter | move in lists and open rows              |
| `[` and `]`              | fold the navigation and the right column |
| `n` and `p`              | next, previous unanswered question       |
| `/`                      | Jump palette, on the decisions page only |
| `y n c`                  | answer the category delete dialog        |

Space and `g` are free. Space currently scrolls the page. Full table:
[the keys in use](discovery-01.md#rules-and-their-owners).

### Scope

Covers the registry, the leader menu, the delay, sequences, the status line fed by the registry, and
a picker. It leaves out Vimium-style link hints, the key search, and a remapping editor, unless you
say otherwise below.

### Sources

- Code: [`useListKeys.ts`](/packages/web/src/lists/useListKeys.ts),
  [`statusHints.tsx`](/packages/web/src/statusHints.tsx),
  [`StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx),
  [`DecisionsPage.tsx`](/packages/web/src/decisions/DecisionsPage.tsx), Astryx's `useHotkeys`.
- Products: which-key.nvim and LazyVim, Snacks, Helix, Emacs which-key, Spacemacs, Vimium, GitHub,
  Gmail, Todoist, VS Code.
- Standards: WCAG 2.1.4, `aria-keyshortcuts`, MDN's `KeyboardEvent`.
- An experiment on Space and focused controls, in Chromium, Firefox, and WebKit.
- The full investigation is in [discovery](discovery-01.md).

## Check these

- **`n` on two pages** means "new" on most pages and "next unanswered question" on the questions
  page, whose status line says so. A page's keys are its own, so no page has both. See
  [discovery](discovery-01.md#n-means-two-things).
- **`f` means find**, not files, because Uraeda has no file browser. `f` opens the find group, with
  a picker per kind. See [discovery](discovery-01.md#f-for-files-has-no-files).
- **Letter shortcuts are an extra path**, never the only one. A screen reader in browse mode takes
  single letters before the page sees them, and the menu is also reachable with Ctrl or Cmd+K. See
  [discovery](discovery-01.md#aria-keyshortcuts-and-screen-readers).
- **No keys on narrow screens.** The leader, the `g` sequences, and the page keys work on wide and
  semi-wide screens, as the status line's hints already do.
- **Page `g` sequences mirror the leader's destinations**, so `g i` and `Space i` both open the
  inbox. You learn one set of mnemonics.

## Q1: How much of the proposal should this feature build?

The proposal asks for a registry, a leader menu, pickers, page shortcuts for every page, and a
dynamic status line. It names shortcut maps and search as later work. A spec past 6 stories cannot
be approved in one sitting. This one would have about 8 or more.

Example: the questions page, the spec page, the session page, and the inbox each need their own
keys. Doing all of them here makes the spec as long as the whole UI.

Why it matters: it decides the size of the first spec and what you can review in one sitting. The
registry built now shapes every later keyboard feature.

- **A (recommended). Build the registry, a leader menu with a few groups, the `g` sequences, the
  status line fed by the registry, and one picker. Give every other page's keys their own later
  features.**
  - [pro] one spec you can approve, and a registry proven on real keys before pages depend on it.
  - [con] some pages stay mouse-first until their feature lands.
  - Why recommended: it keeps the spec within the split rule and builds the foundation first.
- **B. Build all of that, plus new page shortcuts on every page, in this one feature.**
  - [pro] the whole application becomes keyboard-navigable at once.
  - [con] a spec of 8 or more stories that nobody reviews in one sitting, and a long branch.
- **C. Build only the registry and the leader menu, with no picker.**
  - [pro] the smallest first step.
  - [con] the menu would only go to pages, and the proposal asks for pickers.

**Answer:** B: All pages will have extremely similar keymaps: arrows/hjkl for navigation, aio for
insertion/creation, and then a few page-specific shortcuts. While it will be more stories, they
should be easy to validate. I'm mostly validating keymaps.

## Q2: Should Vimium-style link hints be part of this feature?

Vimium shows a letter over each link after you press `f`, and typing it follows the link. Your
priorities list mentions "vimium for extra links". It needs labels drawn over every link and its own
key space, so it collides with the `f` find group and the list keys.

Why it matters: it decides whether this feature also designs a second overlay, or stays with the
leader menu.

- **A (recommended). Leave link hints for a later feature of their own.**
  - [pro] the leader menu and the registry ship first, with no overlay on every link.
  - [con] following a link still needs the mouse, or Tab, until then.
  - Why recommended: link hints are a separate design, and the registry makes them easier.
- **B. Build link hints here.**
  - [pro] every link becomes reachable from the keyboard now.
  - [con] a hint overlay on every page, tests per page, and a key to give up.

**Answer:** A: We don't need this if we have a good leader menu

## Q3: What should Space do when the focus is on a button?

Example: you click "Note" in the sidebar, so the focus rests on that button. You press Space.
Natively, Space presses the focused button again.

The leader menu wants Space. I checked in Chromium, Firefox, and WebKit. When the leader handles
Space and stops its default, the button does not also click, and the page does not scroll. Space is
the native way to press a button or tick a checkbox. Enter still presses a button. The New page's
radio cards and selects keep Space either way. More in
[discovery](discovery-01.md#space-on-a-focused-control).

Why it matters: this changes what Space means on every page. It runs against the usual keyboard
expectation of buttons, and for a keyboard-first user it decides whether Space works after a click.

- **A (recommended). The leader opens everywhere except in a text field, with a layer open, and on
  checkboxes, radios, switches, and selects, which keep Space. A focused button gives Space to the
  leader and keeps Enter.**
  - Example: after clicking "Note", Space opens the menu and Enter presses the button.
  - [pro] Space works as the leader after any click, with no need to move the focus.
  - [con] a focused button no longer presses on Space.
  - Why recommended: a keyboard-first user's focus often rests on a button, and Enter still works.
- **B. The leader opens only when the focus is on the page, a link, or a list row. Any other control
  keeps Space.**
  - Example: after clicking "Note", Space presses it again, and you press Escape first.
  - [pro] every control keeps its native behaviour.
  - [con] the leader seems broken after a click, until the focus is moved.
- **C. Do not use Space as the leader: use `,` or only Ctrl or Cmd+K.**
  - [pro] no conflict with any control.
  - [con] departs from the proposal and from the LazyVim and Helix muscle memory you named.

**Answer:** A

## Q4: How should the shortcuts be turned off, as accessibility asks?

Accessibility guideline 2.1.4 (level A) says single-key shortcuts need a way to turn them off, remap
them, or apply only on focus. People who use speech input type words that fire stray shortcuts.
GitHub and Gmail both offer an off switch. Ctrl or Cmd+K stays available as a modifier path in every
option below, and opens the same menu.

Why it matters: by decision, settings live in one file. A switch kept in the browser is an exception
to ask for. A remap editor is a feature of its own.

- **A (recommended). A switch on the settings page, kept in the browser like the navigation column's
  fold. Off turns off the leader, the `g` sequences, and the page letter keys. Ctrl or Cmd+K
  stays.**
  - [pro] small, and per device: a speech-input computer can have it off while another has it on.
  - [con] it is not in your dotfiles, and an exception to "settings live in the file".
  - Why recommended: it meets the guideline at the lowest cost.
- **B. The same switch kept in the settings TOML file, through the Rust core.**
  - [pro] follows the settings decision, travels with your dotfiles.
  - [con] changes in the core, the binding, the server, and the settings page, for one boolean.
- **C. A remap instead of a switch: every shortcut can be rebound to a modifier chord.**
  - [pro] the most complete.
  - [con] a keymap editor, which the proposal names as later work.

**Answer:** B

## Q5: Which key library should the registry use?

The registry owns each key's handler, label, group, and status line hint. Whatever matches the keys,
the menu's tree, its delay, and its drawing are ours. Today Astryx's `useHotkeys` matches single
keys only. The decision [stack](/specs/decisions/stack.md) and the toolchain pin exact versions of
UI dependencies, and a new dependency is yours to approve.

Why it matters: Uraeda either takes a beta dependency for the keys, or owns key matching of about
two hundred lines. It must then test them.

| Option                             | New dependency               | Gives                                                        |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------ |
| A. A small module of ours          | none                         | Handlers, hints, groups, and one layer check in one place    |
| B. TanStack Hotkeys under our tree | yes, beta 0.17, 16.7 kB gzip | Sequences, layout fallback, conflict finding, a binding list |
| C. react-hotkeys-hook              | yes, 3.0 kB gzip             | Sequences, scopes; no binding list                           |

More in [discovery](discovery-01.md#libraries).

- **A (recommended). Write a small module of ours that matches `event.key`, with sequences and a
  timeout, and registers handlers, hints, and groups together.**
  - [pro] no dependency, and it fixes the three copies of the layer rule in one place.
  - [con] key matching, sequences, and IME handling are ours to test, and there is no layout
    fallback.
  - Why recommended: the menu's tree needs our own registry anyway, and a library's API may change.
- **B. Use TanStack Hotkeys for matching sequences, and build the menu's tree and hints on top.**
  - [pro] sequences, layout fallback, and conflict detection already exist.
  - [con] a beta dependency whose API "is still subject to change", and a second registry beside
    ours.
- **C. Use react-hotkeys-hook for matching.**
  - [pro] small and widely used.
  - [con] no list of its bindings, so our registry would still hold every key itself.

**Answer:** A

## Q6: What should the first leader menu hold?

Example: you want a new note. Pressing Space `n` `n` creates one, under the new group. Pressing
Space `i` opens the inbox.

Your proposal gives mnemonics: `n` new, `f` find, `g` go. I resolved `f` and `n` above. The page
keys `g h` and `g i` could mirror the leader's destinations. Pickers are Q7.

| Key                 | Option A                                               | Option B                      |
| ------------------- | ------------------------------------------------------ | ----------------------------- |
| `Space`             | Jump to anything                                       | Jump to anything              |
| `h` `i` `p` `d` `s` | Home, Inbox, Priorities, Decisions, Sessions           | under `g` go: `g h`, `g i`... |
| `n`                 | new: session, change, feature, note, priority          | the same                      |
| `f`                 | find: features, decisions, sessions, notes, priorities | the same                      |
| `v`                 | view: fold navigation, fold right column, theme        | the same                      |
| `r`                 | switch repository                                      | under `v`                     |
| `?`                 | search keys, once that exists                          | the same                      |

Why it matters: the top level is what you press most. It sets the muscle memory for every later
feature that adds entries.

- **A (recommended). Top-level keys for the destinations you use most (`h`, `i`, `p`, `d`, `s`), the
  groups `n` new, `f` find, and `v` view, `r` for repositories, and `Space` for jump to anything.**
  - Example: Space `p` opens priorities, Space `n` `p` creates a priority.
  - [pro] the common moves are two keys, as you asked for.
  - [con] the top level uses most letters, so each new top-level entry needs a free one.
  - Why recommended: it matches "top-level entries for the most used features".
- **B. Everything in groups, as LazyVim does: destinations under `g` go, so Space `g` `p` opens
  priorities.**
  - [pro] a short top level with room to grow.
  - [con] the common moves take three keys.
- **C. Start with only `Space` for jump to anything and `n` for new.**
  - [pro] the smallest menu to approve.
  - [con] a menu that does not yet show the nested groups you asked for.

**Answer:** A: Use u instead of v for _ui_ toggles

## Q7: Which pickers should the first version have?

Example: you press Space `f` `d`, type "ui", and Enter opens the decision "UI behaviour".

A picker is a search over a kind of thing, like the LazyVim picker: an input, a list, Enter to open.
The decisions page already has one, the Jump palette, built on Astryx's `CommandPalette`. The
sidebar already lists sessions, changes, and features, so their data is at hand. More in
[discovery](discovery-01.md#pickers).

Why it matters: it decides how much of the leader menu is real on day one, and whether pickers share
one component.

- **A (recommended). One "jump to anything" picker, listing features, changes, sessions, decisions,
  notes, and priorities with a kind label, also opened already filtered by the find group.**
  - Example: Space `Space` searches everything, Space `f` `d` searches decisions only.
  - [pro] one component, one source list, grown from the Jump palette.
  - [con] no preview pane at first.
  - Why recommended: it follows "one component per kind of information" with the least work.
- **B. One picker per kind, each with a preview pane beside the list as Snacks has.**
  - [pro] closest to the LazyVim picker.
  - [con] several sources and previews, which makes this feature much larger.
- **C. Only the decisions page's palette, reached from the menu.**
  - [pro] nothing new to build.
  - [con] the menu can search nothing else.

**Answer:** B: Show the previews as raw markdown for the moment so the preview is easy to add

## Q8: How should the leader menu look?

Each prototype is live: press Space, wait half a second, then press `n`. In every look the title in
the border shows the keys pressed so far, Backspace goes up, and Escape closes. On narrow screens
none appears.

Why it matters: it is the first thing you see of the feature. Later key searches and status line
features reuse the menu's look.

- **A (recommended). A bordered box in the bottom right corner, above the status line, titled with
  the keys pressed, as Helix does.**

  Box, bottom right (`mockups/bottom-right-box.html`, deleted)

  - [pro] hides only a corner, and matches the terminal look of panes titled in their border.
  - [con] about 10 entries per column, so a long group needs a second column.
  - Why recommended: it keeps the page visible and uses the look you chose.

- **B. A full-width panel above the status line, entries in columns, as which-key's classic
  layout.**

  Panel over the status line (`mockups/bottom-panel.html`, deleted)

  - [pro] fits 20 or more entries without scrolling.
  - [con] hides a whole band of the page.

- **C. A centred modal that dims the page.**

  Centred modal (`mockups/centered-modal.html`, deleted)

  - [pro] the easiest to notice.
  - [con] a dialog for what should feel instant, and it hides the page you act on.

- **D. A strip that replaces the status line while the menu is open.**

  Status line strip (`mockups/status-line-strip.html`, deleted)

  - [pro] hides nothing and needs no new surface.
  - [con] wraps badly past 5 or 6 entries, and the status line's own hints disappear.

**Answer:** A

## Q9: Should keyboard rules become a decision?

A decision binds every later feature, and agents read it before each task that applies. The
candidates are four rules. The leader key is Space. Every key is declared in the registry. Letter
shortcuts are never the only path. An off switch exists. Today two rules in
[UI behaviour](/specs/decisions/ui-behaviour.md) mention keys, and three layer checks drifted apart
in the code.

Why it matters: without a decision, the next feature can add keys outside the registry. A decision
only starts when the spec that lists it is approved, so you can still change its wording there.

- **A (recommended). A new `keyboard` decision, listed in this feature's spec.**
  - [pro] one owner for the keys, so later features register theirs and follow the rules.
  - [con] one more decision for agents to read, and for you to approve.
  - Why recommended: the registry and the off switch are rules every later page must follow.
- **B. Extend UI behaviour's two keyboard rules.**
  - [pro] no new file.
  - [con] the decision grows long and mixes keys with saving and git writes.
- **C. No decision; the spec holds the rules.**
  - [pro] nothing new to approve.
  - [con] the spec is replaced by a record, so the rules vanish from where agents look.

**Answer:** A

## Settled without the human

### Behaviour

- **The menu appears after 500 ms.** Keys typed faster than that run without showing it, so fast use
  never flashes the menu. which-key.nvim waits 200 ms and Emacs 1 s. See
  [discovery](discovery-01.md#needs-no-choice).
- **Nothing times out once the menu is open.** Escape closes it, and Backspace goes up one level, as
  in which-key. Pressing a key that is bound to nothing leaves the menu open.
- **The leader and the page keys stay silent in text fields**, with a layer open, and while an input
  method is composing. This is the rule the list keys already follow.
- **Keys match the character typed**, not the physical key, so mnemonics follow letters on AZERTY
  and Dvorak, as Astryx's `useHotkeys` does. See [discovery](discovery-01.md#key-code-ime).
- **The existing keys keep their meaning**: the list keys, `[` and `]`, `/` on the decisions page,
  `n` and `p` on the questions page, and `y n c` in their dialog. They only move onto the registry.
- **A sequence like `g h` waits 1 second** for its second key, then starts over, as the libraries
  read do. While one is pending, the status line shows the choices, which settles the status line's
  place in the menu's look.

### Under the hood

- **One registry owns a key's handler and its hint**, so the status line and a later key search read
  one source. It replaces the pairing of `useHotkeys` and `useStatusHints` by hand. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **One check says a layer is open**, replacing the three copies in `useListKeys.ts`, `Rail.tsx`,
  and `DecisionsPage.tsx`.
- **The menu draws keys as the status line does**, in the UI's font and the key's colour, not with
  Astryx's capitalised `Kbd`.
- **The existing shortcuts move onto the registry in this feature**, as a first user of it.
- **The plan's first task checks Space in NVDA and VoiceOver**, which the discovery could not
  verify.

**Notes:**

- **n**: Yes, New and Next can exist on different page with an n binding
- **No keys on narrow screens.**: Well all keys should work on narrow screens too, it'll just be
  that usually phones don't have a keyboard available without open text input.

  Just don't show the hints on the phone, but the behaviour stays there.

- **Page**: Ok, but I also need gg to go to the top of the page!
- **A sequence like**: Go up to 2s
