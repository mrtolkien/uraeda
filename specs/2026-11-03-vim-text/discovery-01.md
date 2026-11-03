# Discovery, round 01: Vim in text edit mode

## Summary

A "Vim mode" in a web app is almost always one library: the Vim emulation engine first written for
CodeMirror, now `@replit/codemirror-vim` for CodeMirror 6, used by Overleaf, JupyterLab, and
Obsidian. Products turn it on with one per-user setting, off by default, and give it only to their
main multi-line editor. They show the mode as text (`--INSERT--`, `NOR`/`INS`), and settle what
Escape means when Escape also leaves the field. Each product gives `:w` and `:q` its own meaning.

The proposal asks for Vim in every text field, with as many keys as possible, client side, a mode
indicator in the status line, and an "open as buffer" shortcut for any file. Uraeda's web UI has 23
text-field call sites in three classes: one-line Astryx `TextInput`s, multi-line Astryx `TextArea`s
through [`TextField`](/packages/web/src/fields/TextField.tsx), and a contenteditable Astryx
`ChatComposerInput` in the composer. No engine works on all three. The complete engine needs its
fields to become CodeMirror 6 editors, and the only `<textarea>` engine is young and thin. Nothing
exists for an arbitrary contenteditable. Today no page writes `INBOX.md`, `PRIORITIES.md`, or a
decision as raw text: the core refuses them.

## How other products do it

### Obsidian

- "Use Vim key bindings when editing", under Settings, Editor, Advanced
  ([help](https://obsidian.md/help/settings)). Only the note body gets Vim: Escape in the title
  resets it
  ([forum, snippet](https://forum.obsidian.md/t/escape-resets-title-and-blocks-vim-workflow/12156)).
- No mode indicator built in. The community plugin
  [obsidian-vimrc-support](https://github.com/esm7/obsidian-vimrc-support) adds one to the status
  bar, reads `.obsidian.vimrc` (`map`, `nmap`, `noremap`, `exmap`, `obcommand`), and offers
  `set clipboard=unnamed`. Its maintainer is looking for someone to take over.
- Escape with a suggestion dropdown open closes the dropdown and stays in insert mode, so users
  press it twice
  ([forum, snippet](https://forum.obsidian.md/t/let-vim-insert-mode-escape-esc-to-normal-mode-even-if-suggestion-dropdown-open/35414)).
- Yanks stay in Vim's registers; "copy to the system clipboard by default" is a standing request
  ([forum, snippet](https://forum.obsidian.md/t/make-copy-to-system-clipboard-the-default-for-vim-mode-yank/52194)).
- Vim on mobile without a hardware keyboard "is not currently supported", for lack of an Escape key
  ([forum, snippet](https://forum.obsidian.md/t/support-vim-on-mobile-without-a-physical-keyboard-implement-extended-virtual-keyboard/60536)).

### Overleaf

- Keybindings None (default), Vim, or Emacs, a per-user setting. "Not all Vim/Emacs bindings are
  fully supported, especially pre-existing browser shortcuts"
  ([docs](https://docs.overleaf.com/navigating-in-the-editor/vim-and-emacs-keybinding)).
- No vimrc: custom mappings go through an unofficial userscript calling `Vim.map()`
  ([docs](https://docs.overleaf.com/navigating-in-the-editor/vim-and-emacs-keybinding/providing-custom-vim-key-bindings)).
- In its source, `:w` recompiles the PDF, and Ctrl-C in insert mode copies to the system clipboard
  ([keybindings.ts](https://github.com/overleaf/overleaf/blob/main/services/web/frontend/js/features/source-editor/extensions/keybindings.ts)).
- The Vimium browser extension breaks Esc and Ctrl-[ there (same docs page).

### JupyterLab

[jupyterlab-vim](https://github.com/jupyterlab-contrib/jupyterlab-vim) meets the same problem as
Uraeda: Escape already means "leave the cell" (command mode), where `j` `k` move between cells.

- Esc or Ctrl-[ goes from insert or visual to normal mode. From normal mode, Esc goes on to command
  mode, while `escToCmdMode` is on, its default. Shift-Esc leaves to command mode from any mode.
  Enter comes back. `:q` enters command mode.
- Settings
  ([schema](https://github.com/jupyterlab-contrib/jupyterlab-vim/blob/main/schema/plugin.json)):
  `enabled`, `enabledInEditors`, `escToCmdMode`, `shiftEscOverrideBrowser`, `extraKeybindings`.
- `imap`/`nmap` remaps go in settings; `:imap` typed in a cell "does not persist between sessions"
  ([issue, snippet](https://github.com/jwkvam/jupyterlab-vim/issues/17)).

### marimo

A notebook with `j` `k` between cells and Vim inside them
([docs](https://docs.marimo.io/guides/editor_features/overview/)): a "Vim keybindings" setting, `:w`
saves the notebook, Ctrl+Esc (Cmd+Esc on macOS) leaves the cell to command mode, `i` or Enter
returns. A `vimrc` path can be set in its config.

### Observable

An experimental Vim setting for cells. A user "found no way to blur / close that cell again", since
Esc only went to normal mode. Staff offered Esc-Esc and Alt-Esc; the user over-escaped and closed
full-screen view
([forum](https://talk.observablehq.com/t/is-it-possible-to-enable-the-codemirror-vim-keybindings/411)).

### VS Code web and github.dev (VSCodeVim)

[VSCodeVim](https://github.com/VSCodeVim/Vim) runs in the browser build. `vim.showmodename` shows
the mode in the status bar, `vim.cursorStylePerMode` sets the cursor per mode,
`vim.useSystemClipboard` is off by default, `vim.handleKeys` gives keys back to the app, and
`.vimrc` support is experimental, "only remaps".

### Zed

[Zed](https://zed.dev/docs/vim): a `vim_mode` toggle, `use_system_clipboard` defaulting to `always`,
`:w` saves and `:q` closes the buffer, mappings as JSON per context such as
`"j k": "vim::NormalBefore"`. Vim applies only in the `Editor` context.

### Helix

[Helix](https://docs.helix-editor.com/editor.html) labels the mode `NOR`, `INS`, `SEL` in its status
line, can colour it per mode (`color-modes`), and sets the cursor shape per mode.

### Browser extensions that bring Vim to every field

- [Surfingkeys](https://github.com/brookhong/Surfingkeys): in any field, Ctrl-i opens a "vim editor"
  (Ace in Vim mode) over it. For an `<input>` it has one line, Enter or `:w` writes back; for a
  `<textarea>`, Ctrl-Enter or `:w`. Esc or `:q` quits without writing.
- [Firenvim](https://github.com/glacambre/firenvim) replaces a textarea with a real Neovim, through
  a browser extension and a local `nvim`. Escape does not leave; the README suggests mapping
  `<Esc><Esc>` to give the page its focus back.
- [wasavi](https://github.com/akahuku/wasavi) turns a textarea into vi; `:set esctoblur` makes Esc
  in normal mode leave the editor.

### Products without one

Linear has `j` `k` and `g`-then-letter keys but no Vim text editing
([docs, snippet](https://linear.app/docs/select-issues)). Notion, Logseq, and Roam have only
third-party plugins. Logseq's [vimeditor](https://github.com/benjypng/logseq-vimeditor-plugin) opens
a block in a separate Vim panel and saves back.

### What they have in common

1. **One per-user switch, off by default** (Overleaf, Obsidian, Zed, marimo, VSCodeVim).
2. **Vim in the main multi-line editor only.** One-line fields get Vim only through extensions, by
   opening them in a separate editor (Surfingkeys, Firenvim).
3. **A mode indicator**: a text label in a status bar, sometimes coloured, and a block cursor in
   normal mode. Users ask for it where it is missing (Obsidian, Joplin, LeetCode).
4. **An Escape strategy** when Escape already has an app meaning: Escape in normal mode leaves
   (Jupyter, wasavi, codemirror-vim's default), a modified Escape leaves from any mode (Shift-Esc,
   Ctrl-Esc), or a user mapping like `jj`.
5. **`:w` and `:q` given the app's meaning**: save, compile, write back, leave.
6. **Custom mappings**, from a vimrc file, JSON keymaps, or settings; `imap jj <Esc>` is the usual
   first one.
7. **A clipboard policy**: Vim's internal registers (Obsidian, VSCodeVim) or the system clipboard
   (Zed). Yanking to the system clipboard is the most requested fix.
8. **"Edit this in a buffer"**: a separate editor for text that has no Vim in place (Surfingkeys,
   Firenvim, Logseq).
9. **No Vim on touch screens without a keyboard** (Obsidian staff).

## Standards and libraries

### `@replit/codemirror-vim` (CodeMirror 6)

- 6.4.0, 2026-07-28, MIT; last commit 2026-11-01, 33 open issues
  ([repository](https://github.com/replit/codemirror-vim)). Its engine moved to
  `@replit/codemirror-vim-core`, "editor-agnostic", with "700+ tests".
- Used by Overleaf (`services/web/package.json`) and jupyterlab-vim (`package.json`). Obsidian's Vim
  mode is "the CodeMirror vim emulation"
  ([Obsidian Hub, snippet](https://publish.obsidian.md/hub/04+-+Guides%2C+Workflows%2C+%26+Courses/for+Vim+users)).
- Coverage, read from `vim-core/vim.js`:
  - motions `hjkl w W e E b B ge`, `{ } ( )`, `gg G 0 ^ $ %`, `f F t T ; ,`, `H M L`, `gj gk`,
    marks, `/ ? n N * #`;
  - operators `d y c = > < g~ gu gU gc gq gw g?`, with counts and dot repeat;
  - text objects for brackets, quotes, words, paragraphs, sentences, and tags;
  - visual, visual line, and visual block; `q`/`@` macros; registers `a-z`, `0-9`, and `"+`;
  - 37 ex commands, among them `:s`, `:g`, `:v`, `:normal`, `:sort`, `:map`/`:noremap` and their
    mode variants, `:set`, `:registers`, `:marks`;
  - an API: `Vim.map`, `Vim.defineEx`, `Vim.defineAction`, `Vim.defineRegister`.
- The mode is reported by a `vim-mode-change` event, `{mode, subMode}`, with `normal`, `insert`,
  `replace`, `visual` and `linewise` or `blockwise`. It does not fire for the `:` command line
  ([issue #251](https://github.com/replit/codemirror-vim/issues/251)).
- **Escape in normal mode is not consumed**: `handleEsc` says "We're already in normal mode. Let
  '<Esc>' be handled normally", so the key reaches the page. In insert or visual mode the adapter
  prevents it. Ctrl-[, Ctrl-c, and Ctrl-Esc act as Escape.
- `:w` calls `CodeMirror.commands.save` when the app defines it.
- `"+y` writes with `navigator.clipboard.writeText`, `"+p` reads with `readText`. The engine has no
  `clipboard=unnamedplus` option; two issues ask for one
  ([#142](https://github.com/replit/codemirror-vim/issues/142)).
- Registers, macros, and mappings live in one module-level state, shared by every editor of the page
  (judgement, from the source).
- Known gaps: no list of what is supported
  ([#237](https://github.com/replit/codemirror-vim/issues/237)), no Select mode, no `g@`, dead keys
  and Chinese IMEs misbehave in normal mode (#159, #178), and it "doesn't work at all" on an Android
  tablet's soft keyboard ([#200](https://github.com/replit/codemirror-vim/issues/200)).
- **Sizes, measured** with esbuild and `gzip -9` in a throwaway folder:
  - CodeMirror's state and view, 65.8 KB;
  - with commands, history, and placeholder, 89.2 KB;
  - with the Vim engine, 133.8 KB;
  - with Markdown highlighting, 218.2 KB;
  - the Vim engine alone, as a lazily loaded chunk, 41.7 KB.

### CodeMirror 6 as a text field

- Its content element is `contenteditable` with `role="textbox"` and `aria-multiline="true"`, all
  overridable through `EditorView.contentAttributes`. A `<label for>` does not reach it:
  `aria-label` does. A Firefox bug shows an editor left with no accessible name
  ([bug 2071227](https://bugzilla.mozilla.org/show_bug.cgi?id=2071227)).
- It does not take Tab, "to make the default configuration pass the 'no keyboard trap' criterion":
  Escape then Tab always leaves it ([example](https://codemirror.net/examples/tab/)).
- `placeholder()` and `EditorView.lineWrapping` are built in. A one-line field takes a transaction
  filter refusing line breaks, as its author recommends
  ([forum](https://discuss.codemirror.net/t/codemirror-6-single-line-and-or-avoid-carriage-return/2979/2)).
- It grows with its text by default; a fixed number of rows is a height on its scroller.
- A `Compartment` swaps the Vim extension in and out at run time.
- CodeMirror's GitHub repositories were archived on 2026-04-15 and moved to `code.haverbeke.berlin`.
  npm releases go on: `@codemirror/view` 6.43.15 on 2026-10-19.
- It styles itself by injecting a `<style>` element at run time, not by importing a stylesheet.

### Other engines

| Engine                                                                                                                             | Works on     | Version, date   | Size, gzip        | What it lacks                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------- | ----------------- | ------------------------------------------------------------------------ |
| [monaco-vim](https://github.com/brijeshb42/monaco-vim)                                                                             | Monaco       | 0.4.4, 2025-11  | 66.9 KB, + Monaco | an older engine: no `:normal`, `:noremap`, `gq`; only dependency bumps   |
| Ace's [vim.js](https://github.com/ajaxorg/ace)                                                                                     | Ace          | 1.45.2, 2026-10 | 36.4 KB, + 127.8  | Ace itself, a second editor family                                       |
| [vimee](https://github.com/vimeejs/vimee) textarea plugin                                                                          | `<textarea>` | 0.1.2, 2026-03  | 12.4 KB           | only `:w :q :s`; no `:g`, `:normal`, `:map`, no `"+`; 1 maintainer, 44 ★ |
| [vim-prosemirror](https://github.com/KevinChristian30/vim-prosemirror)                                                             | ProseMirror  | 0.2.1, 2026-09  | not measured      | no registers, macros, or ex commands; 0 ★                                |
| Neovim to WebAssembly ([PR](https://github.com/neovim/neovim/pull/40772), [nvim-wasm](https://www.munenick.me/en/blog/nvim-wasm/)) | a Worker     | demo, 2026-08   | about 8 MB        | needs cross-origin isolation headers; "further stabilization" upstream   |
| [Firenvim](https://github.com/glacambre/firenvim)                                                                                  | any textarea | 0.2.17, 2026-05 | n/a               | a browser extension and a local Neovim; a page cannot use it alone       |

No library adds Vim to an arbitrary contenteditable element.

### Keys a page cannot have

- Chromium never gives a page Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Shift+T/N/W, or Ctrl+Tab
  (`kReservedCommandIds` in
  [accelerator_table.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/accelerator_table.cc)),
  except in an installed app's window. Firefox reserves the same
  ([browser-sets.inc](https://github.com/mozilla/gecko-dev/blob/master/browser/base/content/browser-sets.inc)).
  Insert mode's Ctrl-w (delete a word) closes the tab instead.
- Ctrl+R, Ctrl+O, Ctrl+V, and Ctrl+F can be taken from the browser.
- Android soft keyboards send `key="Unidentified"`, so normal-mode keys cannot be read on them
  ([Trix issue, snippet](https://github.com/basecamp/trix/issues/178)).
- `navigator.clipboard.readText` needs a secure context, and asks for a permission in Chromium
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)).

### Accessibility

- [WCAG 2.1.2, No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html):
  "if it requires more than unmodified arrow or tab keys or other standard exit methods, the user is
  advised of the method for moving focus away". "Pressing the Esc key is a commonly used 'standard
  exit method'."
- [WCAG 2.1.4, Character Key Shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)
  is met when a shortcut is "only active when that component has focus". Vim's normal-mode keys are
  only active in a focused field (judgement).
- [WCAG 2.1.1, Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) forbids
  requiring "specific timings for individual keystrokes": a timed `jj` cannot be the only way out
  (judgement).

## The code

### Important reads

- [`fields/TextField.tsx`](/packages/web/src/fields/TextField.tsx): the one multi-line field, Astryx
  `TextArea` with rows by `kind` and Ctrl+Enter. Used in 6 places: comments
  ([`CommentForm.tsx`](/packages/web/src/CommentForm.tsx)), a question's comment, the round's notes,
  a change offer's proposal, and the proposal editor
  ([`ProposalText.tsx`](/packages/web/src/ProposalText.tsx)). Two more use `kind="line"`, where
  Enter adds: [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx) and
  [`AddNote.tsx`](/packages/web/src/AddNote.tsx).
- [`fields/useTextField.ts`](/packages/web/src/fields/useTextField.ts): the unsaved-text store
  behind every field, independent of the element drawn.
- [`lists/OutlineEditor.tsx`](/packages/web/src/lists/OutlineEditor.tsx): the inbox's and
  priorities' row field, a raw one-row `<textarea>` (an Astryx gap). Enter saves, Escape cancels
  with a confirmation, Tab indents, leaving saves.
- [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx): the one-line field edited in place
  (category names, session titles, server settings). 12 other Astryx `TextInput`s are search
  filters, a slug, a password, a folder.
- [`ComposerField.tsx`](/packages/web/src/ComposerField.tsx) and
  [`Composer.tsx`](/packages/web/src/Composer.tsx): Astryx `ChatComposerInput`, a contenteditable.
  Uraeda uses only its text, `insertText`, and `onFiles` for pasted and dropped images: "no `@` or
  `/` triggers" (`Composer.tsx:156`). It folds to one line on the phone.
- [`keys/fields.ts`](/packages/web/src/keys/fields.ts): any `textarea`, `input`, or
  `[contenteditable]` is a text field, whose keys the registry never hears
  ([`registry.tsx:71`](/packages/web/src/keys/registry.tsx)). A CodeMirror editor matches already.
- [`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx): hints then counts, 240 lines, no
  mode today. The phone has a bar instead.
- [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx), at `/edit/<path>`: the only raw editor, for
  proposal and note files and a started proposal. It edits the body without its frontmatter, which
  the page's controls set.
- The core's text write, `save_text` in
  [`api/proposal_files.rs`](/crates/core/src/api/proposal_files.rs) and
  [`actions/text.rs`](/crates/core/src/actions/text.rs): it accepts a proposal or note file, or a
  feature's own file, and refuses the rest, `INBOX.md`, `PRIORITIES.md`, and decisions included. A
  stale hash fails as a conflict, which
  [`ConflictBanner`](/packages/web/src/pane/ProposalEditor.tsx) offers to resolve.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs): the `[keyboard]` table, with
  `single_key_shortcuts`; a new switch follows commit `4cdf07bb`'s path through the binding, the
  server, and the settings page.
- [`__tests__/keys-structural.test.ts`](/packages/web/src/__tests__/keys-structural.test.ts): an
  allowlist counts every `onKeyDown` and `keydown` listener per file. Code in `node_modules` is not
  scanned.
- The root [`vite.config.ts`](/vite.config.ts): raw `textarea` and `input` are forbidden without a
  reason, a new `.css` import fails `lint.test.ts`, and files stop at 500 lines, functions at 100.
  `Composer.tsx` has 416 lines.

### The proposal's path and existing actions

- **Focusing a field.** `i` on a row, a click, or a page that opens focused (New, a session's
  composer). Today typing starts at once. With Vim, typing starts at once only if the field opens in
  insert mode.
- **Escape.** Today it blurs the composer, the proposal editor, the slug, and the New page's search.
  It cancels an outline row and an in-place line, asking first when changed. Other fields ignore it.
  The [keyboard guide](/specs/ui/keyboard.md) says Escape "leaves the field, the layer, or the mode,
  and nothing more". With Vim, the first Escape is Vim's.
- **Enter and Ctrl+Enter.** Enter saves an outline row and an in-place line, adds a quick-add line,
  and adds a line in the composer and multi-line fields. Ctrl+Enter saves or sends everywhere. In
  Vim's normal mode, Enter moves down a line.
- **Tab** indents an outline row. In Vim, `>>` indents a line of text, not a row.
- **`u`.** Outside a field it undoes the page's last write; inside one, in normal mode, it would
  undo text.
- **Pasting an image** into a note, a row, or the composer attaches it, through the field's paste
  event.
- **Unsaved text, Leave guard, restore notice**: they read `useTextField`, not the element, and
  change nothing.
- **The single-key switch** removes the registry's one-letter keys. It does not reach a field's own
  keys.

### Rules and their owners

- **A text field owns its keys**: [`keys/fields.ts`](/packages/web/src/keys/fields.ts), read by the
  registry and the leader's Space.
- **Every field of a class behaves the same**: the
  [UI components](/specs/decisions/ui-components.md) decision. Owned by `TextField`, `LineField`,
  the outline row, and the composer field; Escape is copied into 6 files listed above.
- **What can be written as raw text**: the core's `text_place`, copied nowhere.
- **Settings**: the Rust core, by the [Settings](/specs/decisions/settings.md) decision.

### Other features in flight

- [Master PR](https://github.com/mrtolkien/uraeda/tree/2026-11-03-master-pr) wants fewer merge
  conflicts on `INBOX.md` and `PRIORITIES.md`, and may change how they are written. A raw buffer
  writes them too.
- [Worker lifecycle](https://github.com/mrtolkien/uraeda/tree/2026-11-03-worker-lifecycle) adds
  settings, in the same core and settings-page files. Both have only their proposal yet.

### Likely changes

- Under every option: [`settings.rs`](/crates/core/src/settings.rs) and
  [`settings/file.rs`](/crates/core/src/settings/file.rs), the binding, the server's `settings.ts`
  and fate settings, the web's `settings/KeyboardSettings.tsx`, for the switch;
  [`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx), for the mode; the keyboard guide
  and [`docs/web-ui.md`](/docs/web-ui.md).
- With CodeMirror: a new `fields/` editor component and its theme over Astryx's tokens, used by
  `TextField`, and, depending on the fields chosen, by `OutlineEditor`, `ComposerField`, and
  `LineField`; `packages/web/package.json` for the dependencies; the structural test's allowlist.
- With vimee: an attach hook in `TextField` and `OutlineEditor`; no composer.
- With the buffer: the core's `text_place` to accept more files, `EditorPage` or a new page for the
  whole file, a route, and a leader key.
- Tests guarding behaviour that changes:
  - `keys-pages.test.tsx`, "US3 2: `i` in a session focuses the composer, and Escape leaves it
    keeping the draft";
  - `keys-row-editing.test.tsx`, "Escape on a changed field asks first";
  - `keys-priorities.test.tsx`, "Escape closes the field and leaves the line as it was";
  - `keys-leader.test.tsx`, "Space types a space in a text field and a composer";
  - `editor.test.tsx`, the conflict test, if the buffer reuses the editor.

  All of them keep passing with Vim off, the default. With Vim on, they need a second variant.

## The proposal

### "ALL text input fields"

The fields are three different elements. The complete engine works on none of them as they are: it
needs each field to become a CodeMirror editor. The composer, a contenteditable, has no engine at
all. Products give Vim to their main editor only, and one-line fields through a separate editor. Vim
in a search filter or a password field changes little.

### "As many keys as possible"

Only the CodeMirror engine has macros, `:g`, `:normal`, `:map`, and the system clipboard register.
Even it is "an emulation": no Select mode, no `g@`, and a few Neovim differences. Keys the browser
reserves, like insert mode's Ctrl-w, can never work.

### "Navigation, normal, insert"

The proposal's indicator names a "navigation" mode, Uraeda's page keys outside fields. Vim has no
such mode; Jupyter calls it command mode.

### Escape

Escape already leaves a field in Uraeda, and Vim needs it to leave insert mode. The proposal does
not say which wins.

### "Open as buffer" for all files

The core writes only proposal, note, and feature files as raw text. The inbox, the priorities, and
the decisions change only through structured actions today. "As is" means with the frontmatter,
which the proposal editor hides. What `:w` and `:q` do in it is not said.

### Unstated: the switch, the phone, the clipboard, custom mappings

The proposal does not say whether Vim is always on or a setting, what happens on a phone, where a
yank goes, or whether mappings like `jj` can be added.

## Worth it and feasibility

- **Gain**: the human's main editor is Neovim
  ([Nvim plugin record](/specs/done/2026-10-13-nvim-plugin.md)), and Uraeda's text fields are where
  they write proposals, answers, comments, notes, and messages to agents. The page keys already
  follow Vim.
- **Cost, with CodeMirror** (judgement): one editor component with a theme over Astryx's tokens,
  one-line and multi-line variants, the composer's image paste, a setting through the core, a mode
  in the status line, and Escape's two meanings. About 134 KB gzip, loaded only when Vim is on. Two
  dependencies kept up to date, whose GitHub home moved this year.
- **Cost of the buffer**: widening the core's raw writes, a page over the editor, and the
  frontmatter shown as text. It overlaps the master PR feature on the inbox and priorities.
- **Cost, with vimee**: small, but its ex commands stop at `:w :q :s`, without macros' companions
  `:normal` and `:g`, mappings, or the clipboard register: not "as many keys as possible".

Outside behaviour it relies on:

- **Escape in normal mode reaches the page**: checked in the engine's source (`handleEsc`).
- **Swapping Vim on and off keeps the editor's state**: unverified; the plan's first task checks it.
- **Yanks reaching the system clipboard without `"+`**: unverified; the engine has no such option,
  and the plan would check that a register override works.
- **CodeMirror under React 19 with a hand-made wrapper**: unverified, but the wrapper is small.
- **Normal mode on a phone's soft keyboard**: checked as broken in the engine's issues (#200).

No option relaxes a security guard. A raw buffer writes only files under `specs/`, as the core's
`checked()` already enforces.

## Approaches

Criteria come from the proposal (every field, as many keys as possible, client side and instant, no
wheel reinvented), the [UI components](/specs/decisions/ui-components.md) decision (Astryx wherever
one fits, a raw element only for an Astryx gap, one behaviour per class of field), the
[Keyboard](/specs/decisions/keyboard.md) decision (keys only in the registry, single keys switchable
off), the [Performance](/specs/decisions/performance.md) decision (100 ms), and WCAG 2.1.2 and
2.1.4.

### The engine

Which library gives the fields their Vim. Relies on [the libraries](#standards-and-libraries).

| Option                                       | Keys covered                           | Fields it reaches                   | Astryx                                 | Size   | Maintenance                       |
| -------------------------------------------- | -------------------------------------- | ----------------------------------- | -------------------------------------- | ------ | --------------------------------- |
| A. CodeMirror 6 and `@replit/codemirror-vim` | nearly all, 37 ex commands, `"+`       | any, once it is a CodeMirror editor | replaced by CodeMirror while Vim is on | 134 KB | active, used by Overleaf, Jupyter |
| B. vimee's textarea plugin                   | motions, operators, macros, `:w :q :s` | textareas; not the composer         | kept                                   | 12 KB  | young, one maintainer             |
| C. Neovim in WebAssembly                     | all                                    | one editor at a time                | replaced                               | 8 MB   | an upstream demo                  |
| D. No Vim                                    | none                                   | none                                | kept                                   | 0      | none                              |

### Which fields

Only with A or B of [the engine](#the-engine). Relies on [the code](#important-reads) and
[what they have in common](#what-they-have-in-common).

| Option                                               | Sites | What it costs                                                     |
| ---------------------------------------------------- | ----- | ----------------------------------------------------------------- |
| A. Multi-line fields, outline rows, and the composer | 10    | the composer's image paste, the outline's Enter and Tab           |
| B. Multi-line fields only                            | 8     | least; rows and messages stay plain                               |
| C. Every field, one-line inputs included             | 23    | search filters and passwords as editors, Enter and arrows rebuilt |

### Escape

What Escape does once Vim is in normal mode. Relies on [JupyterLab](#jupyterlab),
[Observable](#observable), and the engine's Escape.

| Option                                                               | Standard exit (WCAG 2.1.2) | Matches         |
| -------------------------------------------------------------------- | -------------------------- | --------------- |
| A. Escape in normal mode does today's Escape: leave, or cancel a row | yes                        | Jupyter, wasavi |
| B. Escape stays in the field; a modified key, Shift+Escape, leaves   | needs telling the human    | marimo          |
| C. Escape twice leaves                                               | yes                        | Observable      |

### The mode indicator

Where and when the mode shows. Relies on [Helix](#helix) and
[VS Code](#vs-code-web-and-githubdev-vscodevim).

| Option                                                              | Shows                              |
| ------------------------------------------------------------------- | ---------------------------------- |
| A. In the status line, while a field has the focus                  | `NOR`, `INS`, `VIS`, `REP`         |
| B. In the status line, always while Vim is on, `NAV` outside fields | the proposal's navigation mode too |
| C. Inside the field, the engine's own panel                         | `--INSERT--` under the text        |

### The clipboard

| Option                                            | Matches                   |
| ------------------------------------------------- | ------------------------- |
| A. Every yank also goes to the system clipboard   | Zed, the Obsidian request |
| B. Vim's registers, `"+` for the system clipboard | Vim, Obsidian, VSCodeVim  |

### Custom mappings

| Option                                                      | Matches                    |
| ----------------------------------------------------------- | -------------------------- |
| A. Lines of Vim commands in the settings file, run at start | Jupyter's settings, marimo |
| B. None                                                     | Overleaf                   |
| C. A file such as `~/.config/uraeda/vimrc`                  | Obsidian's plugin          |

### The buffer

Relies on [the core's text write](#important-reads) and
[the proposal](#open-as-buffer-for-all-files).

| Option                                  | Core change        | Files                                     |
| --------------------------------------- | ------------------ | ----------------------------------------- |
| A. Every markdown file under `specs/`   | widen `text_place` | inbox, priorities, decisions, guides, all |
| B. Only the files written as text today | none               | proposals, notes, a feature's files       |
| C. A later feature                      | none               | none                                      |

### Needs no choice

- **One switch, off by default**: the [Settings](/specs/decisions/settings.md) decision puts it in
  the settings file, beside the single-key switch; every product compared defaults it off.
- **No Vim on touch screens**: soft keyboards cannot drive normal mode (engine issue #200), as
  Obsidian says.
- **`:w` and `:q`**: products give them the app's meaning; Uraeda's fields already have save
  (Ctrl+Enter) and leave (Escape).
- **Relative line numbers**: only Zed documents them; Uraeda's fields have no line numbers.
- **The cursor**: the engine draws a block cursor in normal mode.

## Not checked

- Screen readers with CodeMirror in Vim mode: no test report found, with NVDA or VoiceOver.
- Safari's reserved keys today, from an authoritative source: only a 2016 list post.
- Whether swapping the Vim extension in a `Compartment` keeps the mode (issue #130 says replacing
  the whole state does not).
- The CodeSandbox and LeetCode pages (403), Colab's official help, Kaggle, StackBlitz.
- vimee's textarea plugin on mobile, and how it draws its cursor.
