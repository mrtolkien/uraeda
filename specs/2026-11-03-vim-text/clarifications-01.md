---
status: answered
---

# Clarifications, round 01: Vim in text edit mode

> [!NOTE]
>
> Answered on 2026-11-03.
>
> - Verdict: worth building, with changes: one engine gives nearly every key, but only to fields
>   rebuilt on its editor. "All fields" means choosing which ones.
> - The engine is a choice that lasts: it adds two dependencies, and swaps Astryx's fields for
>   another editor while Vim is on.
> - Which fields get Vim and what Escape does work together: Escape already leaves a field today.
> - The buffer for every file reaches the inbox and the priorities. The core refuses to write them
>   as raw text today, and the master PR feature may change them.
> - Check the switch off by default, and no Vim on touch screens, before the questions.

## Context

### Goal

The [proposal](proposal.md) asks for Vim's keys in every text field of the web UI, as many as
possible. They work instantly, in the browser, without reinventing the wheel. A status indicator
shows the mode, and a shortcut opens any file, like the inbox or the priorities, as raw text. It is
for you: Neovim is your main editor. You would drop it if it costs too much.

### Today

The web UI has 23 text fields, in the three classes the
[UI components](../decisions/ui-components.md) decision names:

| Class         | Element                                        | Where                                                          |
| ------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| One-line      | Astryx `TextInput`, 13 sites                   | category and session names, searches, a slug, a password       |
| Several lines | Astryx `TextArea` through `TextField`, 8 sites | comments, answers, notes, the proposal editor, quick-add lines |
| Outline row   | a raw one-row `textarea`                       | the inbox's and the priorities' rows                           |
| Composer      | Astryx `ChatComposerInput`, a contenteditable  | a session, the New page                                        |

A field owns its keys: the page's keys never run in one
([`keys/fields.ts`](/packages/web/src/keys/fields.ts)). Escape leaves the composer and the proposal
editor, and cancels a row. The status line shows key hints and counts, no mode. The core writes a
whole file as text only for proposals, notes, and a feature's own files.

### Scope

Vim's keys in the chosen fields, the switch that turns them on, the mode in the status line, and the
buffer. The page's own Vim-like keys stay as they are. Vim on a phone without a keyboard is left
out.

### Sources

- The text fields, the key registry, the status line, the settings, and the core's text writes,
  linked in the discovery.
- Obsidian, Overleaf, JupyterLab, marimo, Observable, VS Code's Vim, Zed, Helix, and the browser
  extensions Surfingkeys, Firenvim, and wasavi.
- The engines: `@replit/codemirror-vim`, monaco-vim, Ace, vimee, Neovim in WebAssembly, their sizes
  measured; Chromium's reserved keys; WCAG 2.1.1, 2.1.2, and 2.1.4.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **Vim is a switch, off by default**, in the settings file's `[keyboard]` table beside the
  single-key switch, and on the settings page's Keyboard section. Every product compared defaults it
  off, and a field you type into should not surprise a new user. See
  [discovery](discovery-01.md#needs-no-choice).
- **No Vim on touch screens**: a phone's soft keyboard cannot drive normal mode, and the engine's
  issues say so. Fields there stay as they are, even with the switch on. See
  [discovery](discovery-01.md#standards-and-libraries).
- **Vim's single keys are not turned off by the single-key switch**: they act only inside a focused
  field, which WCAG's character-key rule accepts. The Vim switch turns them off. See
  [discovery](discovery-01.md#accessibility).
- **Some keys can never work**: the browser keeps Ctrl+W, Ctrl+T, and Ctrl+N, so insert mode's
  Ctrl-w closes the tab. Nothing in a page can change it. See
  [discovery](discovery-01.md#keys-a-page-cannot-have).
- **No Markdown highlighting**: fields stay plain text, as today. Highlighting would add 85 KB. See
  [discovery](discovery-01.md#standards-and-libraries).
- **A field opens in insert mode**: `i` on a row, a click, or a page that opens focused lets you
  type at once, as today. Escape then goes to normal mode. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

## Q1: Which Vim engine should the fields use?

Three engines are real candidates; real Neovim in WebAssembly is not (8 MB, an upstream demo, one
editor at a time).

| Engine                            | Keys                                                                                                             | Size, gzip | Maintenance                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------- |
| CodeMirror 6 and `codemirror-vim` | motions, operators, text objects, macros, marks, registers, `"+`, 37 ex commands (`:s`, `:g`, `:normal`, `:map`) | 134 KB     | active; Overleaf, Jupyter, Obsidian |
| vimee's textarea plugin           | motions, operators, text objects, macros, marks, registers; only `:w :q :s`                                      | 12 KB      | 7 months old, one maintainer        |

CodeMirror's engine works only inside a CodeMirror editor. While Vim is on, each chosen field would
be a CodeMirror editor, themed with Astryx's colours and fonts, instead of Astryx's field. vimee
attaches to a `<textarea>` and keeps Astryx's fields, but cannot reach the composer. More in
[discovery](discovery-01.md#the-engine).

Why it matters: this becomes a decision, with two new dependencies and an exception to "Astryx
wherever one fits". It also sets how far "as many keys as possible" goes.

- **A (recommended). CodeMirror 6 with `@replit/codemirror-vim`, loaded only when Vim is on; the
  fields stay Astryx's while it is off.**
  - [pro] nearly every key you use in Neovim, from the engine most web apps share.
  - [con] a second kind of field to keep looking like Astryx's, and 134 KB loaded with the switch
    on.
  - Why recommended: it is the only engine that meets "as many keys as possible" without reinventing
    the wheel.
- **B. vimee's textarea plugin on the textarea fields, keeping Astryx's fields.**
  - [pro] small, and nothing to restyle.
  - [con] no `:g`, `:normal`, `:map`, or clipboard register, and no Vim in the composer.
- **C. Drop the feature.**
  - [pro] no cost.
  - [con] the fields stay plain; Neovim stays where you write long text.

**Answer:** A: We don’t need to style it exactly like Astryx’s though. It can look more
“terminal-like”

## Q2: Which fields get Vim?

Products give Vim to their main editor only; one-line fields get it through a separate editor
(Surfingkeys). With CodeMirror (A in Q1), each class needs its own care:

- an outline row must keep Enter to save, Tab to indent, and one line;
- the composer must keep pasting and dropping images, and its folding on the phone;
- a one-line input needs Enter, the arrows in a search's results, and a password's masking rebuilt.

With vimee (B in Q1), the composer cannot get Vim. What Escape does in each is Q3. More in
[discovery](discovery-01.md#which-fields).

Why it matters: each class added is a variant of the editor to build and keep. The UI components
decision asks that every field of a class behave the same.

- **A (recommended). The fields you write in: multi-line fields, outline rows, and the composer.**
  - [pro] Vim wherever you write more than a word: answers, comments, notes, proposals, rows,
    messages.
  - [con] three variants: several lines, one row, and the composer.
  - Why recommended: it covers the text you write, and leaves out names and searches, where Vim
    changes little.
- **B. Multi-line fields only.**
  - [pro] one variant, the least work.
  - [con] the inbox and priorities rows and the messages to agents stay plain.
- **C. Every field, one-line inputs included.**
  - [pro] exactly "ALL text input fields".
  - [con] 13 more sites, among them searches and a password, rebuilt for little gain.

**Answer:** C: There’s a lot of gain, vim mode is super convenient event for single line inputs

While you’re at it make sure that single line inputs wrap: on mobile, a long single line input like
a priority is impossible to edit properly

## Q3: What does Escape do once Vim is in normal mode?

Example: you edit a priorities row in insert mode and press Escape. Vim goes to normal mode. You
press Escape again.

Escape leaves a field or cancels a row today, and the page's `j` `k` work again. The CodeMirror
engine lets an Escape in normal mode through to the page. JupyterLab, with the same problem, makes
that Escape leave the cell, and Shift+Escape leave from any mode. Observable's double Escape made a
user close full-screen view by over-pressing. WCAG's rule on keyboard traps accepts Escape as the
standard way out; another key must be told to the user. More in [discovery](discovery-01.md#escape).

Why it matters: it decides how you get from writing back to the page's keys, many times a day.

- **A (recommended). Escape in normal mode does what Escape does today: leave the field, or cancel a
  row, asking first when it changed. Shift+Escape does it from any mode.**
  - Example: the second Escape cancels the row, asking first since you changed it.
  - [pro] the habit you have today, one Escape later, as in JupyterLab.
  - [con] an extra Escape, out of habit, cancels a row or leaves the field.
  - Why recommended: it keeps one meaning of Escape, and passes the keyboard-trap rule.
- **B. Escape never leaves the field; Shift+Escape leaves, and the status line says so.**
  - Example: the second Escape does nothing; Shift+Escape cancels the row.
  - [pro] no field left by accident.
  - [con] a key unlike every other field, which must be told on screen.

**Answer:** A

## Q4: Where does the mode show?

The proposal asks for "a status indicator at the bottom: navigation, normal, insert". Vim has no
navigation mode: it is Uraeda's page keys, outside fields. Helix labels its modes `NOR`, `INS`,
`SEL` at the start of its status line; VS Code's Vim shows the mode in its status bar. The engine
also draws a block cursor in normal mode, whatever the answer. The phone has no status line. More in
[discovery](discovery-01.md#the-mode-indicator).

Why it matters: it is the one visible part of the feature when you are not typing.

- **A (recommended). At the start of the status line, while Vim is on: `NAV` outside fields, then
  `NOR`, `INS`, `VIS`, or `REP` in one, each in its own colour of the theme.**
  - [pro] the proposal's three states, always where you look for keys.
  - [con] one more item on the status line, on every page.
  - Why recommended: it is what the proposal asks, in Helix's form.
- **B. At the start of the status line, only while a field has the focus.**
  - [pro] the line stays as it is outside fields.
  - [con] no navigation state: an empty place means the page's keys.
- **C. Inside the field, under its text, as the engine's own `--INSERT--` panel.**
  - [pro] next to the cursor, and on the phone too.
  - [con] a line taken from every field, and not at the bottom as asked.

**Answer:** A: Should use the full mode name though, with an icon

## Q5: Which files can the buffer open?

The proposal asks for an "open as buffer" shortcut for all files, opening the text as is. The
proposal editor today edits proposals and notes, without their frontmatter. The core refuses to
write `INBOX.md`, `PRIORITIES.md`, decisions, and the UI guides as raw text: they change through
structured actions only. The master PR feature, started today, may change how the inbox and the
priorities are written, to avoid merge conflicts. More in [discovery](discovery-01.md#the-buffer).

Why it matters: widening the core's raw writes changes what the web UI can write. Part of the work
overlaps the master PR feature.

- **A (recommended). Any markdown file under `specs/`, frontmatter included, from a leader key on
  its page. It saves like the proposal editor, with the same check that the file did not change
  underneath.**
  - [pro] every file, as asked, with Vim when it is on.
  - [con] the core's writes widened, and a hand edit can break a file's format until `ura check`
    says so.
  - Why recommended: it is the proposal's ask, and the conflict check already exists.
- **B. Only the files written as text today: proposals, notes, and a feature's own files.**
  - [pro] no change in the core, no overlap with the master PR feature.
  - [con] not the inbox and the priorities, the two files the proposal names.
- **C. Leave the buffer to a later feature, after the master PR feature.**
  - [pro] a smaller first feature.
  - [con] no buffer for now.

**Answer:** A

## Q6: Where does a yank go?

Example: you yank a paragraph with `yap` in a comment, and paste it into a terminal.

In Vim, a yank stays in Vim's registers, and `"+y` copies to the system clipboard. Zed copies every
yank to the system clipboard by default. In Obsidian, that is the most requested change. The
CodeMirror engine has no such option: the plan would first check that a small override works. More
in [discovery](discovery-01.md#the-clipboard).

Why it matters: it decides whether a yank reaches other apps without `"+`.

- **A (recommended). Every yank also goes to the system clipboard; `p` pastes Vim's register.**
  - Example: Ctrl+V in the terminal pastes the paragraph.
  - [pro] what most people set first in their vimrc, `clipboard=unnamedplus`.
  - [con] every yank replaces what the clipboard held.
  - Why recommended: copying between Uraeda and other apps needs no extra keys.
- **B. Vim's registers, with `"+y` for the system clipboard, as Vim does.**
  - Example: Ctrl+V in the terminal pastes what was there before; `"+yap` would have copied it.
  - [pro] the clipboard changes only when asked.
  - [con] two more keys for each copy to another app.

**Answer:** A

## Q7: Can you add your own mappings, like `jj` for Escape?

The engine reads Vim's mapping commands, like `imap jj <Esc>`. Your Neovim configuration cannot be
read: it is Lua. JupyterLab and marimo take mappings from their settings; Obsidian's plugin reads a
vimrc file. A timed mapping like `jj` can never be the only way out of insert mode (WCAG 2.1.1).
More in [discovery](discovery-01.md#custom-mappings).

Why it matters: it adds a setting kept in the core, and a list you maintain beside your Neovim
configuration.

- **A (recommended). A list of Vim commands in the settings file, like `imap jj <Esc>`, run when Vim
  starts.**
  - [pro] your usual mappings, in the file you keep in your dotfiles.
  - [con] a wrong line fails silently in the engine, unless the page reports it.
  - Why recommended: it covers `jj` and friends with the settings file you already have.
- **B. No mappings: the engine's keys only.**
  - [pro] nothing to build.
  - [con] no `jj`.
- **C. A vimrc file of its own, `~/.config/uraeda/vimrc`.**
  - [pro] a familiar format and place.
  - [con] a second file beside the settings file.

**Answer:** A

## Settled without the human

### Behaviour

- **`:w` and `:q`** do what the field's keys do: `:w` saves or sends as Ctrl+Enter does, `:q` leaves
  the field keeping its text, `:wq` does both. See [discovery](discovery-01.md#needs-no-choice).
- **Ctrl+Enter** saves or sends in every mode, as today.
- **Enter** keeps the field's meaning in insert mode: a row saves, the composer adds a line. In
  normal mode it moves down a line, as in Vim, except in a row, where it saves.
- **`u`** in a field's normal mode undoes text; outside a field it undoes the page's last write, as
  today.
- **Registers, macros, and marks** are shared by every field of the tab, as in one Vim session. A
  yank in a comment pastes in a row.
- **Unsaved text, the Leave guard, and the restore notice** work as today: they follow the text, not
  the element.
- **The buffer** opens with or without Vim on, as a plain editor when it is off.
- **Escape then Tab** always leaves a CodeMirror field, CodeMirror's own way out for keyboard users.

### Under the hood

- **Loading**: with the switch on, the engine loads in its own chunk when the app starts, so the
  first focus is instant. With it off, it never loads.
- **One editor component** in `fields/` draws every Vim field, its variants by class, so each class
  keeps one behaviour.
- **Its look** comes from Astryx's theme tokens, listed in the plan as an Astryx gap, as the UI
  components decision allows.
- **The key allowlist** of the structural test gains the editor component's listener, as it lists
  `TextField`'s Ctrl+Enter today.
- **The switch** joins the core's `[keyboard]` settings; the worker lifecycle feature adds settings
  to the same files, a merge but no conflict.

**Notes:**

- **No Markdown highlighting**: Let’s add it if it’s only 85kcal

  Should be there for all text edit fields, even without vim mode
