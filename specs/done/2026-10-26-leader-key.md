---
kind: feature
finished: 2026-10-27
pull-request: https://github.com/mrtolkien/uraeda/pull/63
---

# Record: Leader key/shortcut map

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-26, finished on
> 2026-10-27, in [its pull request](https://github.com/mrtolkien/uraeda/pull/63). Its full files are
> in git: `git log -- specs/2026-10-26-leader-key/`.

## What and why

Keyboard navigation for the whole web UI, because the human likes driving an app from the keyboard.
Two levels of keys: page keys, `h j k l` and mnemonics like `a i o`, that act on the page, its
columns, and an open pane; and Space, outside text fields, as a leader key opening a menu of nested
groups and pickers in the manner of LazyVim, Helix, and Emacs, shown only after half a second so
fast typing never flashes it. The human asked for a robust, extensible system rather than hardcoded
keys, so that a key map, a key search, and a dynamic status line can be built on it later.

## Behaviour

- **The leader menu (`Space`)**: outside text fields and open layers, Space (or Ctrl or Cmd+K, even
  with shortcuts off) starts the leader; the menu shows 500 ms after the last key while hidden, so
  Space `n` `n` typed fast runs with no menu, and once shown it stays and shows each next step at
  once, with no timeout. It is a bordered box in the bottom right above the status line, titled with
  the keys pressed (`Space`, `Space n`), spanning the window in one column on a phone; entries have
  an icon each and are sorted by key, Space and symbols first. Backspace goes up, Escape closes; an
  unbound printable key leaves the leader's shown menu open and does nothing, while named keys (F1
  to F12, PageUp, PageDown, Home, End, Enter, the arrows, Tab, any chord) end the sequence and reach
  the browser unprevented. It closes on a page change (a change of query alone counts), on a layer
  opening, on the switch turning off, and on a key the focused field already handled. The menu lists
  only entries whose guard holds at the focus. The top level: `Space` find anything, `c` Continue,
  `h i p d s` Home, Inbox, Priorities, Decisions, Sessions, `,` Settings, `n` New (`s c f n p`:
  session, change, feature, note, priority), `f` Find (`f c s d n p`, one picker per kind), `u` UI
  (`[` and `]` fold the navigation and the right column, declared by those columns, and `t` cycles
  the theme Mocha, Latte, System), and `r` opens the repository menu as a dialog of its own, a sheet
  on narrow screens. Continue (`Space c`) reads the navigation's Needs you cards and opens where a
  card's status button leads; several open a small "Continue" picker, and with none the entry reads
  "Nothing needs you" and pressing it shows a toast with the same words. A kind has one icon in the
  New group, the Find group, and the picker: a feature is a file, a change a wrench, a note the
  inbox's tray, a session the sessions' icon. Space taken from a button, a link, or a row is
  prevented on keydown and on its next keyup, so the button is never pressed (Firefox presses on
  keyup); checkboxes, radios, switches, selects, and comboboxes keep Space, and Enter still presses
  a button.
- **The base keymap and `g` (every page)**: `j k`, `↓ ↑`, and `+ -` move to the next or previous
  row, card, or option; on a page with no selectable rows (a session, the questions, a spec, a plan,
  the settings) they scroll the area holding the focus, else the main column, a few lines at a time,
  unhinted. `h l` and `← →` move between columns, Home and End go to the first and last row, `gg`
  and `G` to the top and bottom, Enter opens, Escape closes the pane or goes back a step, and a
  list's Escape acts only when the focus is on a row or the page. `J K` and Shift with `↓ ↑` move
  the selected item one place within its section, `H L` and Shift with `← →` to the end of the
  previous or next section that takes drops (Ongoing skipped, an empty section counts), with the
  same write as a drag, on the priorities and the inbox's notes only; a second move key pressed
  during a write queues and runs once the list shows the first, a failed move is dropped, and a
  write the list never shows holds the queue 2 seconds at most. `g` then `h i p d s ,` goes to a
  place; a pending `g` waits 2 seconds, shows the same menu titled `g` after the same delay, and any
  unbound key ends it. With the rail opened by hover, an Escape outside it runs the page's Escape
  first and folds the rail only when nothing took it; Escape inside the rail folds it.
- **Each page's own keys**: `a` adds the page's main item at its default place (Home and Sessions:
  the New page, off on Home in a repository without specs; Priorities: the add form; Inbox: the
  add-note form). On the priorities and the inbox, `o` opens the add form in the focused or selected
  row's section or category (a Blocked line opens it in Next, which the form offers; the chosen
  category beats a new category's name left in the form), `i` edits the line inside its card (saving
  under the shared unsaved-text key, so the card and the task view restore each other's text; a
  renamed line stays selected and focused under its new key; `i` on another card does nothing while
  an editor holds unsaved text), and `m` opens the card's `…` menu, which holds a note's Category
  moves. Row keys find a card by its key, never its place among links, and a line the file no longer
  holds has no editor or menu. `n p` jump to the next and previous unanswered question on the
  questions, triage, and decisions check pages at every width. The decisions page keeps `/` for its
  picker. Wherever a composer is mounted, `i` focuses it, and Escape leaves it for the page, keeping
  the draft. The New page's `s c f` pick Session, Change, or Feature as a click would, and its
  Feature title field has its own `i`.
- **The key picker**: `Space f` then a kind, `Space Space` for all kinds, the decisions page's `/`,
  and Continue open one picker: a search field, a list, and a preview of the selected item as its
  raw file in plain lines wrapped at words (a feature's or change's proposal, a decision's file, a
  note's text, a priority's line with its children, a session's title, state, and branch, archived
  sessions last with "Archived · "). Titles read "Find decisions", "Find anything"; among several
  kinds each row ends with its kind. It shows at once with "Loading…", keeps what is typed
  meanwhile, and a failed read closes it with the toast "Could not load the list to search."; the
  proposals load in one request after the list, stop once the picker closes, and one that fails says
  "Could not load the proposal." in its own preview only. Principles are found by their numeral.
  Escape closes it and the dialog returns the focus; a pick opens its page after the dialog closed,
  so that page keeps the focus. On a phone it is a sheet with the list alone.
- **The off switch**: the settings page's Keyboard section, after Appearance, has one switch,
  "Single-key shortcuts", stored as `[keyboard] single_key_shortcuts` in the settings file, `true`
  when unset, saved at once and kept across a repository switch. Off, every binding whose first key
  is one printable character stops (letters, shifted letters, `+ - [ ] / ,`, Space, every `g`
  sequence) and their hints leave the status line, as do the category delete dialog's Y, N, C keys
  and the "Jump to…" button's `/` and its key cap; the dialog's buttons still answer by click. Named
  keys, Shift with them, and Ctrl or Cmd+K stay, and a menu opened by the chord walks its tree with
  letters. An unreadable settings file leaves the shortcuts on, and the section shows the file's
  problem.
- **The status line**: draws the hints of the keys registered on the page, each binding saying
  whether it is hinted, so `j k move` shows without the arrows, `+`, and `-`; a page's hints leave
  while a layer is open, and a phone shows none, though every key works at every width.
- **Every key**: matches the character typed, never the physical key, so mnemonics follow AZERTY and
  Dvorak. A Latin letter's case is Shift's, never Caps Lock's, so Caps Lock `j` is `j`; a character
  typed with AltGr, or with Option on a Mac other than a Latin letter (`[` `]` on German or French
  layouts), is that character; held keys repeat; composition, keyCode 229, dead keys, `Process`, and
  `Unidentified` are no shortcut. A key never means two things on one page, a binding spelt as no
  keydown spells it, and a sequence through a group without a name all throw outside production.
  Nothing outside the registry listens for page keys, and a full-screen story or a non-manual
  popover holding the focus is a layer that owns its keys.

## Design

Keys are data: one registry in [`packages/web/src/keys/`](/packages/web/src/keys/) holds every
binding, owns the one window listener, and the leader menu, the picker, and the status line read it;
no component listens for page keys on its own. The matching, the sequences, and the layer rule are
ours rather than a library's, so there is no layout fallback, and the sequences are a pure state
machine tested with fake timers. The leader menu is whatever the registry holds for the keys
pressed, so a feature that declares a binding grows it.

- [`registry.tsx`](/packages/web/src/keys/registry.tsx): `KeysProvider` (the listener, the taken
  Space's keyup, the switch), `useKeys(bindings, place)` to declare keys while mounted, `useHints`,
  `useSingleKeys`, and `useLeader`.
- [`store.ts`](/packages/web/src/keys/store.ts): the `Binding` type (keys, label, `run`, optional
  `icon`, `hint`, `when`, fallback) and `createKeyStore`, whose clash, spelling, and group checks
  throw outside production. [`match.ts`](/packages/web/src/keys/match.ts): `tokenOf`, the key as a
  token, and `isCanonical`. [`fields.ts`](/packages/web/src/keys/fields.ts): which fields and
  controls own a key or Space. [`layers.ts`](/packages/web/src/keys/layers.ts): the one rule of "a
  layer is open", `isLayerOpen` at the key and `useLayerOpen`, checked once per frame, for what is
  drawn.
- [`sequence.ts`](/packages/web/src/keys/sequence.ts) and
  [`leader.ts`](/packages/web/src/keys/leader.ts): sequences, the 500 ms delay, and the 2-second
  wait. [`groups.ts`](/packages/web/src/keys/groups.ts) names the groups by key prefix (Find, New,
  UI); [`leaderTree.ts`](/packages/web/src/keys/leaderTree.ts) and
  [`LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx) declare the leader's tree and the `g`
  keys; [`kinds.ts`](/packages/web/src/keys/kinds.ts) holds each kind's icon, and
  [`destinations.ts`](/packages/web/src/destinations.ts) each place's label, icon, and path, read by
  the navigation column, the phone's tabs, and the menu.
- [`LeaderMenu.tsx`](/packages/web/src/keys/LeaderMenu.tsx), drawn by
  [`LeaderMenuHost.tsx`](/packages/web/src/keys/LeaderMenuHost.tsx), with its stories in
  [`LeaderMenu.stories.tsx`](/packages/web/src/keys/LeaderMenu.stories.tsx); a key is drawn as typed
  by [`KeyCap.tsx`](/packages/web/src/keys/KeyCap.tsx), shared with the status line.
- [`scroll.ts`](/packages/web/src/keys/scroll.ts): the scroll fallback, a registry default that runs
  only where no binding of the page handled the vertical key.
- The key picker, the decisions page's Jump palette made general:
  [`KeyPicker.tsx`](/packages/web/src/keys/KeyPicker.tsx),
  [`KeyPickerHost.tsx`](/packages/web/src/keys/KeyPickerHost.tsx) (mounted once in the shell),
  [`pickerSources.ts`](/packages/web/src/keys/pickerSources.ts) (a source per kind, read only once
  opened), and [`pickerState.ts`](/packages/web/src/keys/pickerState.ts); its ranking is
  `searchRanked` in [`decisions/jump.ts`](/packages/web/src/decisions/jump.ts). A decision's raw
  file comes from `Decision.text`, added to the ledger in
  [`crates/core/src/api/ledger.rs`](/crates/core/src/api/ledger.rs).
- [`Continue.tsx`](/packages/web/src/keys/Continue.tsx), over `needsYouEntries` in
  [`sidebar/entries.ts`](/packages/web/src/sidebar/entries.ts) and `statusPath` in
  [`sidebar/cards.ts`](/packages/web/src/sidebar/cards.ts), shared with the Needs you pane and the
  status line's count.
- The list keys: [`useListKeys.ts`](/packages/web/src/lists/useListKeys.ts) (rows by
  `data-row-key`), [`useRowKeys.ts`](/packages/web/src/lists/useRowKeys.ts) (`o i m`),
  [`RowEditors.tsx`](/packages/web/src/lists/RowEditors.tsx) (the in-card editors),
  [`useItemMoves.ts`](/packages/web/src/lists/useItemMoves.ts) (the move queue), and
  [`itemMoves.ts`](/packages/web/src/lists/itemMoves.ts) (where `J K H L` send an item), under
  [`WorkList.tsx`](/packages/web/src/lists/WorkList.tsx). Other pages' keys are declared by their
  owners: [`Composer.tsx`](/packages/web/src/Composer.tsx) (`i`),
  [`useNewKey.ts`](/packages/web/src/useNewKey.ts) (`a`),
  [`KindCards.tsx`](/packages/web/src/KindCards.tsx) (`s c f`),
  [`RoundOutline.tsx`](/packages/web/src/RoundOutline.tsx) (`n p`), and
  [`RepositoryMenu.tsx`](/packages/web/src/RepositoryMenu.tsx) (the `Space r` dialog).
- The setting: `KeyboardSettings` in [`crates/core/src/settings.rs`](/crates/core/src/settings.rs)
  and its file handling in [`settings/file.rs`](/crates/core/src/settings/file.rs), passed through
  [`crates/binding/src/settings.rs`](/crates/binding/src/settings.rs) and the server's
  [`settings.ts`](/packages/server/src/settings.ts) and
  [`fate/settings.ts`](/packages/server/src/fate/settings.ts); the web's
  [`KeyboardSettings.tsx`](/packages/web/src/settings/KeyboardSettings.tsx) draws the switch, and
  [`SingleKeysSetting.tsx`](/packages/web/src/settings/SingleKeysSetting.tsx) reads it without
  suspending the shell into the state [`App.tsx`](/packages/web/src/App.tsx) holds above the
  repository's client.
- [`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx) reads `useHints()` alone; the old
  hint API is gone, and [`statusHints.tsx`](/packages/web/src/statusHints.tsx) keeps only the cover.
- [`keys-structural.test.ts`](/packages/web/src/__tests__/keys-structural.test.ts) scans the web's
  source for key listeners (`useHotkeys`, `keydown`, `keyup`, `keypress`, `on…` handlers and
  properties, event names that are not literals) and fails for a file off its allowlist, each entry
  with its reason and its count of listeners: the text fields' own keys, the category delete's Y, N,
  C, the radio cards, the stories' overlays, the sandbox's bar, the sign-in page, and Escape inside
  the rail. A second test fails for any copy of the layer rule's selectors outside `keys/layers.ts`.

## Questions

### Round 01

#### Q1: How much of the proposal should this feature build?

**Answer:** B, everything in one feature, every page's keys included: "All pages will have extremely
similar keymaps: arrows/hjkl for navigation, aio for insertion/creation, and then a few
page-specific shortcuts", and "I'm mostly validating keymaps".

#### Q2: Should Vimium-style link hints be part of this feature?

**Answer:** A, left for later, "we don't need this if we have a good leader menu".

#### Q3: What should Space do when the focus is on a button?

**Answer:** A, the leader opens everywhere but in a text field, under an open layer, and on
checkboxes, radios, switches, and selects; a focused button gives Space to the leader and keeps
Enter.

#### Q4: How should the shortcuts be turned off, as accessibility asks?

**Answer:** B, a switch kept in the settings TOML file through the Rust core, not in the browser.

#### Q5: Which key library should the registry use?

**Answer:** A, a small module of ours matching `event.key`, with sequences and a timeout, and no new
dependency.

#### Q6: What should the first leader menu hold?

**Answer:** A, top-level keys for the most used places, the groups `n` new and `f` find, `r` for
repositories, and `Space` for jump to anything, with `u` instead of `v` for the UI toggles.

#### Q7: Which pickers should the first version have?

**Answer:** B, one picker per kind with a preview pane as Snacks has, "show the previews as raw
markdown for the moment".

#### Q8: How should the leader menu look?

**Answer:** A, a bordered box in the bottom right corner above the status line, titled with the keys
pressed, as Helix does.

#### Q9: Should keyboard rules become a decision?

**Answer:** A, a new Keyboard decision, listed in the spec.

#### Notes

- **`n` means New on most pages and next unanswered question on the questions page**: "Yes, New and
  Next can exist on different page with an n binding".
- **No keys on narrow screens**: overruled, "all keys should work on narrow screens too", since
  phones rarely have a keyboard outside a text field; only the hints are hidden on the phone.
- **Page `g` sequences mirror the leader's destinations**: agreed, "but I also need gg to go to the
  top of the page!".
- **A `g` sequence waits 1 second for its second key**: "Go up to 2s".

## Decisions

- [Keyboard](../decisions/keyboard.md), new: every shortcut that acts on the page is declared in one
  registry and listened for nowhere else, single-key shortcuts are switched off from the settings
  file with a chord left for the menu, none is the only way to do something, Space opens the leader
  menu after a short moment, keys work at every width with no hints on narrow screens, pages share
  one base keymap, and a key means one thing per page.
- Relied on: [UI behaviour](../decisions/ui-behaviour.md), [UI layout](../decisions/ui-layout.md),
  [UI coherence, now in UI components](../decisions/ui-components.md),
  [Settings](../decisions/settings.md), [UI checks, now in Testing](../decisions/testing.md), and
  [Preview](../decisions/preview.md).

## Changes after approval

- Before approval, the human's first review of the spec asked for an icon on every entry and a drawn
  Space key, with each place's icon defined once for the navigation and the menu, which grows from
  the features; `c` Continue with a small picker when several things need the human; the menu in
  alphabetical order; `+` and `-` beside `j k`; keys on the New page for its kinds (`s c f`);
  `J K H L` and Shift with the arrows to move the selected item (shifted `+ -` could not, since `+`
  already needs Shift); and a flag on each key saying whether the status line shows it. The Keyboard
  decision's first rule gained the label, icon, and hint flag.
- Before approval, the second review asked that the vertical keys scroll every page without
  selectable rows, unhinted, while pages with rows keep moving the selection; the decision's base
  keymap rule says "move or scroll".
- Caps Lock no longer turns `j` into the `J` that moves an item: a letter's case is Shift's, and
  keyCode 229 counts as composition.
- A binding spelt as no keydown spells it, or a sequence through a group with no name, throws in
  development instead of silently never running or showing no entry.
- A pending sequence lets named keys (F-keys, paging, the arrows, Enter, Tab, chords) end it and
  reach the browser, so `g` then F5 reloads; only printable keys are swallowed.
- The keyup of a Space the leader took is prevented too, so Firefox does not press the focused
  button.
- A key inside an open popover is the popover's, a full-screen story is a layer, and its Escape no
  longer also runs the page's.
- The menu lists only the entries whose guard holds at the focus; an unbound key ends a shown `g`
  menu, while the leader's stays open; a key the focused field already handled ends the menu; a page
  change of query alone closes it.
- A list's Escape acts only on a row or the page, as before the registry, so Escape on the decisions
  page's Jump button no longer sends the reader back to the constitution.
- A second move key queues behind the first write instead of being dropped, so `J J` or a held `J`
  moves twice.
- With the rail opened by hover, Escape closes the page's pane first and folds the rail on the next
  press, where both happened at once before.
- The key picker shows at once with "Loading…" instead of nothing, a failed read closes it with a
  toast instead of replacing the whole view with a server error, a pick's page keeps the focus,
  titles read "Find decisions" and "Find anything", and archived sessions are listed last; proposals
  stop loading once it closes, and a failed one fails only its own preview.
- The preview draws plain lines wrapped at words instead of a code block that broke words anywhere,
  and a row's kind sits at its end.
- `i` edits a line inside its card instead of opening its pane, keeps the line selected and focused
  after a rename, and never drops another card's unsaved text; the row keys find cards by key, so a
  card being edited no longer shifts them onto a neighbour; `o` on a Blocked line opens the form in
  Next; the category `o` chose beats a new category's name left in the form; renamed lines with
  non-ASCII text still redirect the task view.
- The questions' `n p` work at every width, not only on wide screens.
- The switch also governs the category delete dialog's Y, N, C and the Jump button's `/`, and keeps
  its value across a repository switch instead of flashing the letter hints.
- A kind has one icon across the New group, the Find group, and the picker: a feature is a file,
  where it was a pencil in one place and a spec page in another, and a note is the inbox's tray.
- On a Mac, a character typed with Option is that character, so German and French layouts fold with
  `[` and `]` again.
- `Space u t` cycles Mocha, Latte, and System; `Space r` opens the repository menu as a dialog of
  its own, since the heading's trigger is missing on most phone pages and on a folded rail.
- Rebased on the testing decision (`main` removed the browser runner and its tests, and the UI
  checks decision no longer keeps screenshots in git): the six real-browser tests this feature had
  written went, so Space on a focused button, link, row, and radio card, the scrolling on the real
  session page, the switch's effect on the delete dialog, and the shifted moves are checked by unit
  tests and by the human's use, not in a real browser, and the screenshots were not kept.

## Follow-ups

- Checks deferred to a human, by hand: in Firefox, `/` then a letter on the decisions page opens no
  quick find bar, and releasing Space after the leader took it from a focused button does not press
  it; on a Mac with a German or French layout, `[` and `]` typed with Option fold the columns; with
  NVDA's browse mode and VoiceOver's quick nav, whether Space on a non-field opens the menu, whether
  a button is still pressed, and whether the menu's group is announced (Ctrl or Cmd+K and the
  buttons remain if not).
- For the human to confirm: the Keyboard decision says each shortcut is declared "with its label,
  icon, group, and whether the status line shows it", but the built bindings require only a label
  and a handler, have an optional icon drawn only by the leader menu (the page keys have none), and
  no group field, a group being the prefix of a sequence's keys named in `keys/groups.ts`. Either
  the decision's wording follows the code, or the bindings gain required fields.
- Every decision in the ledger record now carries its whole file as `Decision.text`, for the
  picker's preview, so the ledger's payload grows with the decisions: worth measuring, or reading on
  demand.
- Seen while reviewing the views, not caused here: the desktop priorities page clips its Next
  column, a stray dash sits beside the phone questions page's count, and the picker's footer wraps
  its last key, `Esc Close`, onto a second line, as the decisions palette did before.
- On the phone, the leader menu leaves a sliver of the page's text showing.
- Left for later: a key search or `?` key map reading the registry, Vimium-style link hints, and a
  remap editor. The [inbox and priorities record](2026-10-25-inbox-priorities.md) planned `O`, `dd`,
  and `H L` to the same row; this keymap has no `O` or `dd`, and `H L` send an item to the end of a
  section.
