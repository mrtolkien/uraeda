# Discovery, round 01: Leader key/shortcut map

## Summary

Keyboard systems with a leader key share one shape: a key that is not typed text (Space in LazyVim,
Helix, Spacemacs) opens a tree of mnemonic groups. A popup lists what each next key does, after a
short delay. Products differ in the delay (200 ms to 1 s), where the popup sits, whether bindings
are declared as data, and how they guard text input. Web apps add a second layer the proposal also
asks for: single keys and two-key `g` sequences per page, with a `?` cheat sheet.

The [proposal](proposal.md) asks for exactly this, in two levels, plus pickers, mockups, and a
registry that later features (a keymap search, a dynamic status line) can build on. Uraeda already
has keyboard code, but scattered: three single-key shortcuts through Astryx's `useHotkeys`, list
keys in `useListKeys`, and a status line fed by a second registry that handlers pair with by hand.
Nothing supports key sequences, and nothing defines one place that owns which keys are taken.

The proposal holds four gaps: Space conflicts with focused controls, `n` is already taken on the
questions page, WCAG requires an off switch for single-key shortcuts, and the whole proposal is
larger than one spec.

## How other products do it

### which-key.nvim and LazyVim

- Bindings are found from each keymap's `desc`. Groups are declared as data,
  `{ "<leader>f", group = "file" }`, and `desc`, `group`, and `icon` can be functions evaluated when
  the popup opens ([which-key.nvim README](https://github.com/folke/which-key.nvim)).
- The popup's `delay` defaults to 200 ms, independent of the key timeout. Backspace goes up one
  level, and a "hydra" mode keeps the popup open until Escape (same source).
- LazyVim sets Space as leader, with groups such as `<leader>f` find, `<leader>s` search,
  `<leader>g` git, `<leader>b` buffers, `<leader>c` code, `<leader>u` toggles. `<leader><space>`
  finds files, and `<leader>sk` searches the keymaps, so the key list is itself a picker
  ([LazyVim keymaps](https://www.lazyvim.org/keymaps)).

### Snacks picker (LazyVim's picker)

- Three windows, input, list, and preview, each shown or hidden. Layouts include a default with the
  preview at 50% on the right, a bottom panel, and a dropdown.
- Ctrl-j and Ctrl-k or Ctrl-n and Ctrl-p move, Enter confirms, Escape cancels, `?` toggles help, and
  matching is fuzzy with fzf syntax. A custom picker is a finder, a format, and a confirm action
  ([Snacks picker docs](https://raw.githubusercontent.com/folke/snacks.nvim/main/docs/picker.md)).

### Helix

- Space opens a mode "mostly pickers": `f` files, `b` buffers, `s` symbols, `/` global search, `?`
  command palette. `g` is a goto mode (`gh`, `gl`, `gd`). Minor modes are one-shot and return to
  normal after one command ([keymap](https://docs.helix-editor.com/keymap.html)).
- A new mode is declared by nesting a TOML table under a key
  ([remapping](https://docs.helix-editor.com/remapping.html)).
- Its info box is bordered, with a title, at the bottom right above the status line
  ([source](https://github.com/helix-editor/helix/blob/master/helix-term/src/ui/info.rs)). The pages
  give no delay for it.

### Emacs which-key, Spacemacs

- `which-key-idle-delay` defaults to 1.0 s, and zero "might cause issues". The popup is a side
  window at the bottom by default. `u` undoes the last key, and `C-h` pages
  ([emacs-which-key](https://github.com/justbur/emacs-which-key)).
- Spacemacs uses Space with mnemonic groups (`f` files, `b` buffers, `p` projects, `t` toggles, `h`
  help), `SPC SPC` for commands, and `SPC ?` to search every binding. A prefix is named with
  `spacemacs/declare-prefix` ([documentation](https://www.spacemacs.org/doc/DOCUMENTATION.html),
  first 100k of 178k characters read).

### Vimium

- `f` shows link hints, `?` lists the bindings, and `i` enters an insert mode where every command is
  ignored until Escape. Mappings are customised with `map` and `unmap`
  ([README](https://github.com/philc/vimium)).

### GitHub, Gmail, Todoist

- GitHub: `?` opens the page's shortcuts; `g` then `c`, `i`, `p`, `a` go to code, issues, pulls,
  actions. Accessibility settings can turn character-key shortcuts off
  ([GitHub docs](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts)).
- Gmail: shortcuts are off until enabled in settings. `g` then `i` goes to the inbox, `?` shows the
  cheat sheet, and Google warns that shortcuts are not supported by all keyboards
  ([Gmail help](https://support.google.com/mail/answer/6594)).
- Todoist: `Q` quick-adds, `G` then `H`, `I`, `T` goes home, inbox, today. QWERTY and QWERTZ are
  supported; other layouts "may break some shortcuts"
  ([Todoist help](https://www.todoist.com/help/articles/use-keyboard-shortcuts-in-todoist-Wyovn2)).
- Notion's letter shortcuts all use a modifier
  ([Notion help](https://www.notion.com/help/keyboard-shortcuts)).

### VS Code

- Chords are written with a space, `ctrl+k ctrl+w`. Keybindings have `when` clauses, a searchable
  editor, and "Show Same Keybindings" to find conflicts
  ([keybindings](https://code.visualstudio.com/docs/configure/keybindings)). A which-key extension
  exists, marked Preview ([VSpaceCode](https://github.com/VSpaceCode/vscode-which-key)).

### What they have in common

- **Bindings are data**, with a label and a group, so the menu is generated: which-key `desc` and
  `group`, Spacemacs `declare-prefix`. Hand-drawn menus drift from the keys.
- **A delay before the popup**: 200 ms (which-key.nvim), 1 s (Emacs). Sequence libraries use 1 s as
  the time between keys.
- **Back, close, and search**: Backspace goes up a level, Escape closes, and a searchable list of
  every key (`<leader>sk`, `SPC ?`, `?` dialogs) sits beside the menu.
- **Text input is protected**, by an insert mode (Vimium), or by ignoring input fields (tinykeys,
  TanStack).
- **An off switch or remap** for single-key shortcuts: GitHub, Gmail.
- **Layout caveats**: Todoist and Gmail admit non-QWERTY breakage; VS Code offers scan codes.

## Standards and libraries

### WCAG 2.1.4 Character Key Shortcuts

- Level A: a shortcut of only letters, punctuation, numbers, or symbols needs a way to turn it off,
  a way to remap it with a modifier, or to be active only while its component has focus. Two-key
  sequences count, and so does Shift plus `/` for `?`
  ([Understanding 2.1.4](https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts.html)).
- Astryx's own `useHotkeys` source carries the same warning (see
  [Astryx](#astryx-usehotkeys-kbd-commandpalette)).

### aria-keyshortcuts and screen readers

- `aria-keyshortcuts` only declares a shortcut. The script must implement it, and the page should
  avoid single-letter shortcuts and screen-reader keys
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts)).
- In a screen reader's browse mode, single letters are quick navigation and never reach the page.
  NVDA passes one key through with NVDA+F2
  ([NVDA guide](https://download.nvaccess.org/documentation/userGuide.html), first 100k of 418k
  characters read). So letter shortcuts are an extra path, never the only one
  ([APG keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)).

### key, code, IME

- `event.key` follows the layout: the same physical key gives `a` on AZERTY and `q` on QWERTY.
  `event.code` is the physical key, and tells nothing about the printed letter
  ([key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key),
  [code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code)).
- During composition, check `isComposing` and `keyCode === 229`
  ([keydown](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event)).

### Libraries

Sizes are minified plus gzip from bundlephobia, versions from the npm registry, read on 2026-10-26.

| Library                                                                    | Version      | Size          | Sequences                         | Lists its bindings      | Notes                                     |
| -------------------------------------------------------------------------- | ------------ | ------------- | --------------------------------- | ----------------------- | ----------------------------------------- |
| [TanStack Hotkeys](https://tanstack.com/hotkeys/latest/docs/overview)      | 0.17.0       | 16.7 kB       | Yes, 1000 ms                      | Yes, `useAppHotkeyList` | Beta: "API subject to change"; MIT        |
| [react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook) | 5.3.3        | 3.0 kB        | Yes, `g>h`, 1000 ms               | No                      | Matches physical codes by default; MIT    |
| [tinykeys](https://github.com/jamiebuilds/tinykeys)                        | 4.0.1        | 1.1 kB        | Yes, `g i`, 1000 ms               | `parseKeybinding` only  | No React binding; no scopes; MIT          |
| [@github/hotkey](https://github.com/github/hotkey)                         | 3.1.4        | 2.5 kB        | Yes, blocks clashing keys 1500 ms | No                      | Attribute based (`data-hotkey`); MIT      |
| [hotkeys-js](https://github.com/jaywcjlove/hotkeys-js)                     | 4.0.8        | 3.5 kB        | No ordered sequences              | `getAllKeyCodes()`      | One active scope; MIT                     |
| [mousetrap](https://github.com/ccampbell/mousetrap)                        | 1.6.5        | 2.4 kB        | Yes                               | No                      | Last commit 2020-01-23; Apache-2.0        |
| [kbar](https://github.com/timc1/kbar), [cmdk](https://github.com/dip/cmdk) | 1.0.0, 1.1.1 | 27.5, 16.7 kB | Not confirmed, none               | No                      | Command palettes, not hotkey systems; MIT |

- TanStack declares bindings as data with `defineAppHotkeys`, lists them for cheat sheets, finds
  conflicts, and ignores text inputs by the first step of a sequence
  ([app hotkeys](https://tanstack.com/hotkeys/latest/docs/framework/react/guides/app-hotkeys),
  [defaults](https://tanstack.com/hotkeys/latest/docs/framework/react/guides/sensible-defaults)).
  Its sequences are flat lists of chords with no groups or labels, so a menu tree is still ours to
  build.
- tinykeys' first matching binding wins, so `g` would shadow `g a`
  ([README](https://github.com/jamiebuilds/tinykeys)). TanStack blocks a standalone `c` only while a
  `g c` sequence is pending, as @github/hotkey does.

### Astryx: useHotkeys, Kbd, CommandPalette

Read from the installed 0.7.3 source, `node_modules/.pnpm/@astryxdesign+core@0.7.3…/src/`.

- `useHotkeys` listens on `window`, matches `event.key` lowercased, skips typing targets (input,
  textarea, select, contenteditable) and IME events, and calls `preventDefault` on a match. It has
  no sequences, scopes, or registry (`hooks/useHotkeys.ts`).
- `Kbd` writes keys in capitals (`J K`): the status line draws its own
  ([StatusLine.tsx](/packages/web/src/shell/StatusLine.tsx)).
- `CommandPalette` is a modal with input, list, group, item, and footer parts, and no hotkey
  registry. The decisions page already builds its Jump palette on it
  ([JumpPalette.tsx](/packages/web/src/decisions/JumpPalette.tsx)).

### Space on a focused control, checked

A throwaway experiment, run outside the repository with Playwright 1.63's Chromium, Firefox, and
WebKit: a `keydown` handler calls `preventDefault` on Space while focus is on a button, a checkbox,
a link, and a `role="radio"` div.

- With `preventDefault`, no `click` fired on the button or the checkbox in any of the three
  browsers, and the page did not scroll.
- Without it, the button and the checkbox clicked, and WebKit scrolled the page 10 px.
- A Firefox bug report found by search said Space still clicks a focused button after
  `preventDefault` ([Bugzilla](https://bug635044.bugzilla.mozilla.org/show_bug.cgi?id=1552419), a
  search snippet only). Firefox did not show it in this run.

So the leader can take Space from a focused control and the control will not also activate. Whether
it should is [a choice](#space-on-a-focused-control).

## The code

### Important reads

- [`lists/useListKeys.ts`](/packages/web/src/lists/useListKeys.ts): j k h l, arrows, Home, End,
  Enter, Escape for every list with a pane, on a `document` listener. It acts only on a row or the
  page, and never while a layer is open. It declares its hints through `useStatusHints` in the same
  file.
- [`statusHints.tsx`](/packages/web/src/statusHints.tsx): the status line's registry. A page or the
  shell declares `{ keys, label }` hints, and they leave as it unmounts. Handlers are registered
  elsewhere, so a key and its hint are paired by hand.
- [`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx): draws the hints on wide screens
  only, then the page's controls, then counts. A sheet that covers it hides it.
- [`decisions/DecisionsPage.tsx`](/packages/web/src/decisions/DecisionsPage.tsx): `/` opens the Jump
  palette, with its own `inLayer` check, plus a hint and an `aria-keyshortcuts="/"` button.
- [`shell/Column.tsx`](/packages/web/src/shell/Column.tsx) and
  [`layout/SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx): `[` and `]` fold the columns.
- [`RoundOutline.tsx`](/packages/web/src/RoundOutline.tsx): `n` and `p` jump to the next and
  previous unanswered question.
- [`KindCards.tsx`](/packages/web/src/KindCards.tsx): Y, N, and C answer the category delete dialog
  on a capture listener; the New page's radio cards take Space and the arrows.
- [`sandbox/mountSandboxBar.tsx`](/packages/web/src/sandbox/mountSandboxBar.tsx): Alt+Shift+P,
  matched by `event.code`, on the sandbox's own bar.
- [`Composer.tsx`](/packages/web/src/Composer.tsx): Ctrl or Cmd+Enter sends.
- [`routeTable.ts`](/packages/web/src/routeTable.ts): every page's path. A leader entry that goes to
  a page is a path built by `repoPath` or `useRepoPath`.
- [`shell/ColumnPanes.tsx`](/packages/web/src/shell/ColumnPanes.tsx): the navigation's destinations
  (Home, Inbox, Priorities, Decisions, Settings), "New" (the New page), and "Note" (the inbox's form
  through `useOpenAddForm`).

### The proposal's path and existing actions

- Space pressed on a page with no focus on a field: nothing happens today, and the browser scrolls
  the page down. With the leader, Space no longer scrolls.
- Space in a composer, a text field, or a line editor must stay a space. Astryx's typing-target
  check covers these ([useHotkeys.ts](#astryx-usehotkeys-kbd-commandpalette)).
- Focus on a list row (a link inside `data-row`) or on a button:
  [see the experiment](#space-on-a-focused-control-checked).
- While a dialog, a menu, or a Selector is open, its keys are its own: the leader must not open.
- Opening an item never puts the focus in a text field
  ([UI behaviour](/specs/decisions/ui-behaviour.md)), so `g`-sequences stay usable after a list key.
- Back and reload keep the place ([UI layout](/specs/decisions/ui-layout.md)). A leader menu is
  transient and not part of the URL, unlike a picker the human keeps open (see [pickers](#pickers)).
- `g` is not used by any shortcut today (searched in `packages/web/src`).

### Rules and their owners

**Which keys are taken today**

| Key                                | Meaning                                  | Owner                                                                   |
| ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `j` `k` `h` `l`, arrows, Home, End | move in a list, between columns          | `useListKeys.ts`                                                        |
| Enter, Escape                      | edit the selected row, close the pane    | `useListKeys.ts`                                                        |
| `[`                                | fold the navigation column               | `shell/Column.tsx`                                                      |
| `]`                                | fold the right column                    | `layout/SideColumn.tsx`                                                 |
| `n` `p`                            | next, previous unanswered question       | `RoundOutline.tsx`                                                      |
| `/`                                | Jump palette, on the decisions page      | `decisions/DecisionsPage.tsx`                                           |
| `y` `n` `c`                        | answer the category delete dialog        | `KindCards.tsx`                                                         |
| Space, arrows                      | pick a card on the New page              | `KindCards.tsx`                                                         |
| Alt+Shift+P                        | pick mode of the sandbox bar             | `sandbox/mountSandboxBar.tsx`                                           |
| Ctrl or Cmd+Enter                  | send a composer, save a multi-line field | `Composer.tsx`, `fields/TextField.tsx`                                  |
| Enter, Escape                      | add or cancel in one-line fields         | `AddNote.tsx`, `QuickAdd.tsx`, `EditableLine.tsx`, `sidebar/Search.tsx` |

**Rules with several copies**

- "A layer that is open owns the keys" has three copies: `isLayerOpen` in
  [`useListKeys.ts`](/packages/web/src/lists/useListKeys.ts), `isOverlayOpen` in
  [`shell/Rail.tsx`](/packages/web/src/shell/Rail.tsx), and `inLayer` in `DecisionsPage.tsx`. A
  leader would be a fourth, under
  [one home per rule](/skills/uraeda/references/code-quality.md#one-home-per-rule).
- "A key and its hint" is declared twice, a handler in `useHotkeys` and a hint in `useStatusHints`,
  in `Column.tsx`, `RoundOutline.tsx`, and `DecisionsPage.tsx`. `useListKeys` declares its hints
  from the same hook as its handler.
- "Not while typing" is Astryx's `isTypingTarget` for `useHotkeys`, and `useListKeys` has its own
  check (focus on a row or the page).

### Likely changes

- A key registry module in `packages/web/src/`, whatever the library choice, owning bindings,
  groups, handlers, hints, and the one layer check: replaces `statusHints.tsx`'s role and the three
  copies.
- A leader menu component in the shell, beside `StatusLine`, with its look from
  [the look](#look-of-the-menu).
- Migrating the existing shortcuts (`[`, `]`, `/`, `n p`, list hints) onto the registry, so the
  status line and any later key search read one source. Under every option.
- A picker built on Astryx's `CommandPalette`, as the Jump palette is, under the pickers options.
- With a setting stored in the TOML file: `crates/core` (the settings), the binding, the server's
  settings, and the settings page ([settings decision](/specs/decisions/settings.md)).
- A new decision, `keyboard.md`, if asked for ([the decision](#a-keyboard-decision)).
- Tests in `packages/web/src/__tests__/` that press keys as a user does, per
  [UI checks](/specs/decisions/ui-checks.md).

### Other features in flight

- `2026-10-26-testing-communication` rewrites the testing strategy and the record formats. It
  touches the skill and the tests, not the web UI's keys, so it does not overlap. Its new testing
  rules will apply to this feature's tests.

## The proposal

### Scope

It asks for a registry, a leader menu with nested groups, pickers, page shortcuts for the whole
application, a delayed menu, a dynamic status line, and mockups, and names shortcut maps and search
as later work. Counting stories (registry, leader menu, `g` sequences, each picker, page shortcuts
on every page), it passes the 6-story line of
[the split rule](/skills/uraeda/references/writing.md#a-spec).

### `n` means two things

The proposal gives `n` to "something new". The questions page already uses `n` for the next
unanswered question, and the status line says so. A page's keys are its own, so the two never meet
on one page, but a person learns one `n`.

### Space needs the focus off every control

The proposal says Space acts as leader "when we're not editing text". A focused button, link, or
list row is not text, yet Space is the native way to press a button or tick a checkbox
([experiment](#space-on-a-focused-control-checked)).

### Single-key shortcuts need an off switch

Every letter shortcut and `g` sequence falls under WCAG 2.1.4, which asks for a way to turn them
off, remap them, or scope them to focus. The proposal has none.

### "f for files" has no files

The app has no file browser: it shows features, their documents, decisions, notes, and priorities.
`f` could mean find, or one kind of thing.

### The status line has no room for a menu

The status line is one line, hidden on narrow screens, and fills with the page's hints.

## Worth it and feasibility

- **Gain**: keyboard-first navigation of a tool the human uses all day, with a registry that later
  features (key search, dynamic status line) need anyway. The existing keys already follow Linear
  and Gmail ([UI behaviour](/specs/decisions/ui-behaviour.md)).
- **Cost**: a registry and its migration, a menu, a picker, a setting if stored in the file, and
  tests that press keys. A library choice may add a beta dependency. The work is mostly in the web
  package.
- **Outside behaviour it relies on**: Space's default is stopped by `preventDefault` in the three
  browsers ([checked](#space-on-a-focused-control-checked)). Whether a screen reader in browse mode
  passes Space is **unverified**: the plan's first task should check NVDA and VoiceOver, or the spec
  states the leader as an extra path only.
- **Guards relaxed**: none. All keys act inside the page, and nothing leaves the browser.
- **Verdict**: worth building, with changes: split it, settle Space and `n`, and add the off switch.

## Approaches

Criteria come from [the proposal](proposal.md), the [UI behaviour](/specs/decisions/ui-behaviour.md)
rule that every action works by keyboard, the [UI coherence](/specs/decisions/ui-coherence.md) rule
of one component per kind of information, the [UI look](/specs/decisions/ui-look.md) terminal style,
the [stack](/specs/decisions/stack.md) and [settings](/specs/decisions/settings.md) decisions,
constitution principle VI (one home per rule, justified abstractions), and WCAG 2.1.4.

### The scope of the feature

How much of the proposal this feature builds.

| Option                                                                                                    | Stories   | Risk                                        | Matches the proposal                                |
| --------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------- | --------------------------------------------------- |
| A. Registry, leader menu with a few groups, `g` sequences, the status line from the registry, one picker. | About 5   | Low: one reviewable spec                    | Its first level and its "extensible system"         |
| B. Everything above plus page shortcuts on every page of the app.                                         | 8 or more | High: a spec nobody approves in one sitting | All of the proposal's first goal                    |
| C. Only the registry and the menu, with no picker.                                                        | About 3   | Low                                         | Leaves the picker, which the proposal asks for, out |

### Link hints

Only the proposal's "Next" line in [priorities](/specs/PRIORITIES.md) mentions "vimium for extra
links". Vimium shows a letter over each link after `f` ([README](https://github.com/philc/vimium)).
It needs labels drawn over every link and a key space of its own, and the pages' keys must not
collide with the labels.

| Option                                     | Cost                                          | Collides with                |
| ------------------------------------------ | --------------------------------------------- | ---------------------------- |
| A. A later feature of its own.             | None now                                      | Nothing                      |
| B. In this feature, on `f` or another key. | A hint overlay for every link, tests per page | `f` find, `n` new, list keys |

### Space on a focused control

What Space does when the focus is on something that is not a text field. See
[the experiment](#space-on-a-focused-control-checked).

| Option                                                                                                     | Keyboard-first use                                | Native expectation                                      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| A. The leader opens everywhere but a text field, an open layer, and checkboxes, radios, switches, selects. | Works after a click left the focus on a button    | A focused button no longer presses on Space; Enter does |
| B. The leader opens only when focus is on the page, a link, or a row; any control keeps Space.             | After a click on a button, Space presses it again | Fully native, as TanStack's default                     |
| C. A key other than Space, such as `,` or Ctrl+K only.                                                     | Free of the problem                               | Departs from the proposal                               |

### Off switch for character shortcuts

WCAG 2.1.4 asks for one of three things. Ctrl or Cmd+K as an always-on modifier path is common
(Notion, GitHub, Todoist).

| Option                                                                                                    | Where it lives              | Cost                                                                  |
| --------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| A. A switch on the settings page, kept in the browser like the column's fold; Ctrl+K opens the same menu. | The browser, per device     | Small; a speech-input device is its own device                        |
| B. The same switch in the settings TOML file, through the core.                                           | The file, for every browser | Rust core, binding, server, and UI changes; per the settings decision |
| C. Remap the leader and page keys to modifier chords.                                                     | The file or the browser     | A keymap editor: the proposal's later "shortcut maps"                 |

### The key library

What matches keys and sequences. The menu's tree, delay, and drawing are ours under every option.

| Option                                                                   | New dependency         | Gives                                                            | Lacks                                           |
| ------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| A. A small module of ours on `event.key`, as Astryx's `useHotkeys` does. | None                   | One registry owning handlers, hints, groups, and the layer check | Layout fallback, devtools, a recorder           |
| B. TanStack Hotkeys under our tree.                                      | Yes, beta 0.x, 16.7 kB | Sequences, layout fallback, conflict finding, a binding list     | Groups, labels, hints; API "subject to change"  |
| C. react-hotkeys-hook.                                                   | Yes, 3.0 kB            | Sequences, scopes                                                | A binding list, `key`-based matching by default |

### The starting keymap

What the first menu and page sequences hold. Mnemonics follow the proposal: `n` new, `f` find, `g`
go. A page-level `g` sequence and the leader's entries could share their keys, so `g h` and `SPC h`
both go home.

| Option                                                                                      | Top level                           | Groups                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| A. Destinations at the top, `n`, `f`, `v` as groups; `g` sequences mirror the destinations. | `h` `i` `p` `d` `s` `r` `Space` `?` | `n` new, `f` find, `v` view         |
| B. Everything in groups, as LazyVim does; destinations under `g`.                           | `Space`, `?`                        | `g` go, `n` new, `f` find, `v` view |
| C. Only `Space` for the picker and `n` for new, nothing else.                               | `Space`, `n`                        | `n` new                             |

### Pickers

Which pickers the first version has. The decisions page's Jump palette already searches the
decisions ([jump.ts](/packages/web/src/decisions/jump.ts)). The sidebar already lists sessions,
changes, and features ([sidebar/entries.ts](/packages/web/src/sidebar/entries.ts)).

| Option                                                                        | Pickers                                                                                 | Cost                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------- |
| A. One "jump to anything" picker, also opened pre-filtered by the find group. | Features, changes, sessions, decisions, notes, priorities in one list with a kind label | One component, the Jump palette generalised |
| B. One picker per kind, with a preview pane as Snacks has.                    | The same kinds, each its own                                                            | Several sources, a preview each             |
| C. Only the decisions page's palette, reached from the menu.                  | Decisions                                                                               | None                                        |

### Look of the menu

Four prototypes, each live: press Space, wait 500 ms, then `n`. Add `#open` or `#nested` to the
address to start with it shown. Narrow screens show none of them.

- Box, bottom right (`mockups/bottom-right-box.html`, deleted): Helix's info box, bordered, titled
  with the keys pressed, above the status line.
- Panel over the status line (`mockups/bottom-panel.html`, deleted): which-key's classic full-width
  panel in columns.
- Centred modal (`mockups/centered-modal.html`, deleted): like VSpaceCode, dimming the page.
- Status line strip (`mockups/status-line-strip.html`, deleted): the current choices in the status
  line itself.

| Option            | Hides page content      | Fits many entries       | Matches terminal look (borders with titles)      |
| ----------------- | ----------------------- | ----------------------- | ------------------------------------------------ |
| Box, bottom right | A corner                | About 10 in one column  | Yes, like a Neovim float                         |
| Panel             | A bottom band           | 20 or more in columns   | Yes                                              |
| Modal             | The centre, and dims it | About 12 in two columns | Yes, but a dialog the UI rule keeps for confirms |
| Strip             | Nothing                 | 5 to 6; wraps badly     | Reuses the status line                           |

### A keyboard decision

Choices that last beyond the feature: the leader key, the off switch, the registry as one owner of
keys, the rule that a letter shortcut is never the only path. The spec step creates a decision only
from an answer ([what is a decision](/skills/uraeda/references/spec.md#what-is-a-decision)).

| Option                                       | Effect                                                       |
| -------------------------------------------- | ------------------------------------------------------------ |
| A. A new `keyboard` decision.                | Later features must register their keys and follow the rules |
| B. Extend UI behaviour's two keyboard rules. | One fewer file; the decision gets longer and mixes topics    |
| C. No decision; the spec holds the rules.    | Later features can drift, as the three layer checks did      |

### Needs no choice

- **Delay before the menu**: 200 ms to 1 s in the products read. A fast typist must not see a flash,
  as the proposal says.
- **Closing and going back**: Escape and Backspace, as in which-key.
- **A key space the human has not seen**: an unbound key in an open menu does nothing and keeps the
  menu open.
- **Search over every key**: a later feature of the proposal. The registry only has to list its
  bindings.
- **Layouts and IME**: matching by `event.key` follows the layout, and composition is skipped, as
  Astryx does.
- **Screen readers**: browse mode takes letters, so keys stay an extra path.
- **A dynamic status line**: the registry feeds the existing status line, with no new component.
- **Touch and narrow screens**: no keys, as the status line's hints already leave on narrow screens.

## Not checked

- Linear's, Slack's, and Raycast's own shortcut documentation (404 or rate-limited), and Obsidian's
  Leader Hotkeys plugin.
- Community complaints about delays, mistyped sequences, and browser conflicts: no forum or issue
  thread was read.
- Doom Emacs' leader documentation, Spacemacs' which-key delay default, and Helix's popup timing.
- Vimium's exclusion rules, and `aria-keyshortcuts` in the WAI-ARIA 1.2 text (MDN was read).
- JAWS and VoiceOver behaviour on Space and single letters; NVDA's guide was read in its first
  fifth.
- Firefox's Quick Find on `/` (search snippet only): the plan checks it if `/` becomes global.
- npm release dates for tinykeys, and kbar's sequence support.
- `Keyboard.getLayoutMap()` browser support (the MDN compatibility table was not in the fetched
  text).
