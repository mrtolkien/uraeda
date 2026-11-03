---
status: auto-approved
spec-revision: 5
---

# Plan: Vim in text edit mode

**Goal:** every text field of the web UI becomes one CodeMirror editor, Markdown highlighted and
wrapped, with Vim's keys behind a switch, the mode in a LazyVim-shaped status line, a buffer for any
Markdown file under `specs/`, and a Commit page with a pane per branch.

**Architecture:** see the [spec's architecture](spec.md#architecture). Ownership:

- **The core** owns what can be read and written as a buffer, where it is written, and which files a
  buffer changed: a buffer's save records its path beside the checkout it wrote, and that record
  decides the Commit page's `- Edit <path>` lines and each branch's pane. It owns the settings keys
  `vim_mode` and `vim_commands`, their defaults and their file problems.
- **The server** owns the refusal while an agent works ("An agent is working on this feature. Stop
  it first, or wait for it."), through its existing `writable()`, for a buffer's save and a feature
  pane's commit.
- **The editor** (`packages/web/src/fields/editor/`) owns every text field's element: its variants,
  highlighting, wrapping, theme, accessible name, Ctrl+Enter, and the Escape hand-over. Callers keep
  their props; `useTextField` and the unsaved store stay the owners of unsaved text.
- **The Vim layer** (`fields/editor/vim/`) owns everything Vim: its lazy chunk, insert mode at
  focus, `:w` `:q` `:wq`, yanks to the clipboard, the human's commands and their errors. It only
  ever calls the editor's own actions (save, leave, cancel), so Escape keeps one meaning per field.
- **The mode store** (`fields/editor/modeStore.ts`) is the one place the status line reads the mode
  and the cursor's place from.

The Rust side follows the core's existing modules: settings in `settings.rs` and `settings/file.rs`,
writes through `actions/place.rs`'s `reach`, the Commit page's lines in `actions/changes.rs`.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A path that climbs out**, like `specs/../Cargo.toml`, `specs/x/../../a.md`, or a symlink under
   `specs/` pointing outside, is refused by the buffer's read and save, as `text::checked` refuses
   today. Task 2.
2. **A buffer path in a feature's subfolder**, like `specs/<folder>/contracts/api.md`, is written on
   the feature's branch, never the default branch. Task 2.
3. **A pane commit stages only the files it lists**: a file the agent left uncommitted in the same
   worktree stays out of the commit. Task 7.
4. **A buffer save of `INBOX.md` while the inbox has structured changes** shows one
   `- Edit specs/INBOX.md` line, and its commit holds the file as typed. Task 7.
5. **A commit message with surrounding blank lines** is committed as typed, trimmed of the blank
   lines only; a message of spaces is refused as empty. Task 7.
6. **Typing in the one-line field with an input method** (`isComposing`): Enter during composition
   does not save. Task 3.
7. **The Vim chunk never loads on a coarse main pointer**, even with the switch on. Task 6.

## Global constraints

From [Text editing](../decisions/text-editing.md), word for word:

- Every text field MUST be the one shared editor, unless it is part of another Astryx component,
  like a picker's filter, or only the browser's field can do the job, like a password. Checked by
  lint.
- The editor MUST highlight Markdown, with Vim on or off.
- Text MUST wrap in every field, one-line fields included, never scrolling sideways.
- Vim's keys MUST come from CodeMirror's Vim engine, never from keys handled by hand.
- Vim MUST stay off until the human turns it on in the settings file. Checked by the core's tests.
- Escape in Vim's normal mode MUST do what Escape does in the same field without Vim.
- A yank MUST also reach the system clipboard.
- The status line MUST name the Vim mode while Vim is on.

From [Git](../decisions/git.md):

- Tools MUST NOT commit the human's edits unless the human asks for that commit, on the Commit page
  or by an action that says it commits. Checked by the core's tests.
- Rust tools MUST read git with the gix library, and write through the system `git`, from one module
  of the core.
- Tools MUST NOT switch the user's checkout unless the human asks.

From [UI components](../decisions/ui-components.md): Views MUST use Astryx components wherever one
fits the job, except text fields, which follow the Text editing decision. Views MUST be styled only
through Astryx's theme, never with a global stylesheet or inline styles. The editor's own look goes
through CodeMirror's `EditorView.theme` over Astryx's theme tokens (`var(--…)`), which is no global
stylesheet: see Complexity tracking.

From [Keyboard](../decisions/keyboard.md): a shortcut MUST be declared in the key registry, and
listened for nowhere else; the structural test's allowlist names each field listener with its
reason. `Space b` is declared with `useKeys`.

From [Settings](../decisions/settings.md): the settings file is read and written by the core only,
keeping comments and order.

From [Code quality](../decisions/code-quality.md): files stop at 500 lines, functions at 100; a new
marker needs the plan's approval (none is added).

From [Testing](../decisions/testing.md): the stage is `early`; a test of the web UI guards behaviour
costly to lose that using the UI would not show. Each changed view is reviewed in the sandbox, both
themes, phone and desktop widths, before the hand-over.

Exact texts from the spec and the data model:

- "Discard your changes?" (Escape on a changed row, as today)
- "Vim mode is true or false." and "Vim commands are a list of lines, like [\"imap jj <Esc>\"]."
- "Line 2: Not an editor command \":nmpa Q dd\"" (the engine's message, prefixed `Line N: `)
- "An agent is working on this feature. Stop it first, or wait for it."
- "A commit needs a message."
- "Use the suggested message"; the conflict banner's "Copy my text" and "Load the new version".
- Lines `- Edit specs/PRIORITIES.md` (default branch, path from the repository root) and
  `- Edit spec.md` (a feature's pane, path from its folder); suggested messages
  `chore: edit specs/PRIORITIES.md` and `chore(<slug>): edit spec.md`, the slug the folder's name
  without its date.
- The mode names NAV, NORMAL, INSERT, VISUAL, V-LINE, V-BLOCK, REPLACE, COMMAND; Lucide icons NAV
  `compass`, NORMAL `square`, INSERT `pencil`, visual `square-dashed`, REPLACE `replace`, COMMAND
  `terminal`; colours: NAV grey, NORMAL blue, INSERT green, visual mauve, REPLACE red, COMMAND peach
  (Catppuccin, through the theme's tokens).
- One-line fields: past 9 lines, they scroll inside.

Preserved: Ctrl+Enter saves or sends every field; Enter saves a row and a one-line field; pasting an
image attaches it in the composer, a note, and an inbox row; unsaved text, the Leave guard, and the
restore notice follow `useTextField`; `keys/fields.ts` already counts `[role="textbox"]` and
`[contenteditable]` as a text field, which CodeMirror's content element is.

## Code read

- **Fields**: [`fields/TextField.tsx`](/packages/web/src/fields/TextField.tsx) (Astryx `TextArea`,
  rows by kind, Ctrl+Enter; 8 call sites), [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx)
  (`LineField`: Enter saves, Escape cancels; used by `InboxPage`, `SessionHeader`, `CategoryPane`,
  `EntryPane`, `ServerSettings`),
  [`lists/OutlineEditor.tsx`](/packages/web/src/lists/OutlineEditor.tsx) (raw one-row `textarea`;
  Enter, Escape, Tab, Backspace, paste of images through `OutlineImages`),
  [`ComposerField.tsx`](/packages/web/src/ComposerField.tsx) and
  [`Composer.tsx`](/packages/web/src/Composer.tsx) (Astryx `ChatComposerInput`; handle
  `{insertText, focus, getValue}`; Escape blurs; folding on the phone). Astryx's `ChatComposer`
  accepts a custom input through `ChatComposerContext` (`value`, `onChange`, `inputControlRef`):
  `dist/Chat/ChatContext.d.ts`. One-line `TextInput`s: `AddNote`, `AddRepository`, `NewPage`,
  `OfferCard`, `RepositoryMenu`, `SlugField`, `StartDialog`, `keys/KeyMap`, `settings/SettingsView`,
  `sidebar/FeatureSettings`, `sidebar/RenameSession`; `sign-in/SignInPage`'s password stays.
- **Keys**: [`keys/fields.ts`](/packages/web/src/keys/fields.ts),
  [`keys/registry.tsx`](/packages/web/src/keys/registry.tsx) (`useKeys(bindings, place)`,
  `useSingleKeys`),
  [`__tests__/keys-structural.test.ts`](/packages/web/src/__tests__/keys-structural.test.ts)
  (allowlist of listeners per file), [`keys/leaderTree.ts`](/packages/web/src/keys/leaderTree.ts).
- **Status line**: [`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx), 240 lines:
  `Hints`, `Counts`, the phone's `PhoneBar`.
- **Settings**: core `settings.rs` (`KeyboardSettings { single_key_shortcuts: Option<bool> }` :48,
  `set_single_key_shortcuts` :165, `change_table` :193 with toml_edit), `settings/file.rs`
  (`parse_keyboard` :172, message `Single-key shortcuts is true or false.`), tests
  `crates/core/tests/settings.rs` (`reads_the_keyboard_table` :478,
  `sets_single_key_shortcuts_in_its_own_table_keeping_the_hand_edits` :522); binding
  `crates/binding/src/settings.rs` (`setSingleKeyShortcuts`), `packages/binding/contracts.test.ts`;
  server `packages/server/src/settings.ts` (`KeyboardSettingsView`, `inForce` :93),
  `fate/settings.ts`, `fate/settings-mutations.ts` (`settings.setSingleKeyShortcuts` :68), tests
  `__tests__/settings.test.ts` and `settings-fate.test.ts`; web `views.ts:413`
  (`SettingsRecordView`), `data.ts:353` (`useSettings`), `settings/KeyboardSettings.tsx`,
  `settings/SingleKeysSetting.tsx`, `settings/SettingsPage.tsx:77`, `settings/optimistic.ts`. The
  path came in commits `63fc7ef5` and `068edc6d`.
- **Text writes**: `crates/core/src/api/proposal_files.rs` (`text_place` :109, `save_text` :127,
  `read_text` :173; feature files refused with a `/` past the folder),
  `crates/core/src/actions/text.rs` (`checked` :25, `save` :36 with the hash conflict "<name>
  changed on disk since you opened it. Your text was not saved."), `actions/place.rs` (`reach` :36
  uses the checkout with the branch, else a worktree, creating `.worktrees/<branch>`),
  `default_branch.rs` (`on_default`, `default_checkout`). Server `fate/mutations.ts` (`text.save`
  :335, `text.commit` :306), `fate/sessions.ts:384` (`writable`, only when
  `binding.pathFolder(path)` names a folder). Web `pane/useProposalEditor.ts` (`withFreshBase` save,
  conflict state, `reload`), `pane/ProposalEditor.tsx` (`ConflictBanner`), `EditorPage.tsx`,
  `routeTable.ts:135`. Tests `crates/core/tests/api.rs` (`:290`
  `proposal_file_paths_stay_in_the_proposal_files`, `:481`), `actions.rs:860`, web
  `__tests__/editor.test.tsx:87`, server `sessions.test.ts:1340`.
- **Commit page**: web [`CommitPage.tsx`](/packages/web/src/CommitPage.tsx) (lines from
  `PrioritiesView.changeLines`, `changes.commit` and `changes.discard`, keys Enter, mod+Enter, `d`);
  server `fate/inbox-mutations.ts` (`changes.commit` :37 queued under `LISTS`, `changes.discard`
  :44); core `api/proposal_edits.rs` (`change_list` :22, only in the default checkout),
  `actions/changes.rs` (`Changes {count, lines}` :31, `list` :350, `message` :379, `commit` :414
  refusing "INBOX.md and PRIORITIES.md have no change to commit", `discard` :442),
  `api/inbox_edits.rs` (`commit_changes` :327, `discard_changes` :336). Tests
  `crates/core/tests/priorities.rs` (:232, :268, :348, :398), `inbox_moves.rs` (:313, :427, :789),
  server `inbox.test.ts:416` and `:433`, web `commit-toast.test.tsx`. Writes with deferral on wait
  for `land` (`actions/deferred.rs`).
- **Tests**: Vitest through `vp test`, under happy-dom (`packages/web/src/__tests__/setup.ts`);
  `renderPage(path, repo, …)` renders the whole app over a fixture repository copied per test
  (`__tests__/helpers.tsx`), whose `type(element, value)` sets a field's value; `__focused__/`
  renders the composer alone. Rust tests run with `cargo nextest`, over example repositories built
  per test.
- **Validation**: `vp run fast` after each task, `vp run ready` before a push (Rust fmt, clippy,
  nextest, `vp check`, `vp test`, the web build, Storybook build, `ura check`). `vp run performance`
  is the performance decision's benchmark, on demand.
- **Lint**: root [`vite.config.ts`](/vite.config.ts): `forbiddenElements` (:103) forbids raw `input`
  and `textarea`; `no-restricted-imports` (:190) has the pattern to forbid Astryx's text fields;
  `__tests__/lint.test.ts` lints one fixture per banned pattern in `src/__lint__/`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

The record of files a buffer changed is tool state beside the checkout, like the deferred commits:
losing it only turns `- Edit <path>` lines back into the structured lines of today.

## Complexity tracking

| Unit                                                   | Why                                                                                                        | Simpler alternative rejected                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `fields/editor/` (the editor, its variants, its theme) | the spec's one editor for 23 call sites                                                                    | a wrapper per field kind: four copies of Escape and Ctrl+Enter                             |
| The editor's theme through `EditorView.theme`          | CodeMirror styles itself with an injected `<style>`; the theme reads Astryx's tokens as CSS variables      | StyleX on CodeMirror's inner elements: StyleX cannot reach elements CodeMirror creates     |
| `fields/editor/modeStore.ts`                           | the status line reads the focused field's mode and cursor; the fields write it                             | a React context: every field would re-render the shell                                     |
| `fields/editor/vim/` (its own chunk)                   | SC-004: the engine's chunk is never requested with Vim off                                                 | importing it statically: 42 KB for everyone                                                |
| Core `actions/edited.rs`, the buffer's record          | US5 2 and US6 need the files a buffer changed, apart from the inbox's structured diff and an agent's files | listing every uncommitted file of a worktree: an agent's work in progress would be offered |
| `__tests__/helpers.tsx`'s `type` over CodeMirror       | 25 test files type into fields; one helper sets an editor's text through its view                          | each test dispatching CodeMirror transactions itself                                       |
| `shell/status/` (the status line's sections)           | `StatusLine.tsx` is 240 lines; LazyVim's sections are files of their own, as the spec says                 | growing `StatusLine.tsx` past 500 lines                                                    |

## Test map

Web tests render the app over a fixture repository under happy-dom, with CodeMirror's real view and
the real Vim engine; the clipboard is happy-dom's. Core tests run over example repositories with the
system `git`. The stage is `early`: UI behaviour the sandbox shows has no test.

| Spec item                                              | Task | Check                                                                                              |
| ------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------- |
| US1 1 (bold, Ctrl+Enter saves a comment)               | 3    | existing comment-saving tests in `review.test.tsx`, through the new `type`; highlighting: sandbox  |
| US1 2 (a row wraps and grows on the phone)             | 4    | none: layout, seen in the sandbox                                                                  |
| US1 3 (Escape leaves a comment, keeps text; `j` moves) | 3    | `editor-field.test.tsx` "Escape leaves a comment keeping its text, and the page's keys work again" |
| US1 more 1 (paste "first\nsecond" in a row)            | 4    | `keys-row-editing.test.tsx` row of "a row refuses line breaks" (existing test, rewritten)          |
| US1 more 2 (a PNG pasted in the composer)              | 5    | `__focused__/composer.test.tsx`'s existing paste test, through the new editor                      |
| US2 1 (`i`, insert mode at focus)                      | 6    | `vim.test.tsx` "a field opens in insert mode"; a row's: each row test's `rowPage` (R10)            |
| US2 2 (`dw` then Escape asks to discard)               | 6    | `vim.test.tsx` "Escape twice in a changed row asks before dropping the change" (R10)               |
| US2 3 (Shift+Escape leaves from insert)                | 6    | `vim.test.tsx` "Shift+Escape leaves a comment from insert mode, keeping its text"                  |
| US2 4 (`yy` reaches the clipboard, `p` in a row)       | 6    | `vim.test.tsx` "a yank reaches the clipboard"                                                      |
| US2 more 1 (`:w` `:q` `:wq`)                           | 6    | `vim.test.tsx` "`:w` saves a comment", "`:w` saves a row", "`:q` in a changed row asks…" (R12)     |
| US2 more 2 (Enter in normal mode)                      | 6    | none: the engine's key, seen in the sandbox                                                        |
| US2 more 3 (no Vim on touch)                           | 6    | `vim-load.test.ts` "the engine loads only with the switch on and a fine pointer"                   |
| US3 1–3, more 1 (the mode in the status line)          | 8    | none: drawn, seen in the sandbox; the mode store's names: `vim.test.tsx` asserts NORMAL and INSERT |
| Niche edge: the mode read out to a screen reader       | 8    | `status-line.test.tsx` "a mode's change in a field is read out once, politely"                     |
| US4 1 (`imap jj <Esc>`)                                | 6    | `vim.test.tsx` "the human's commands run when Vim starts"                                          |
| US4 2 (a refused line's error)                         | 6    | `vim-load.test.ts` "a refused command gives its line and the engine's message"                     |
| US4 3 (a string, not a list)                           | 1    | core `reads_the_keyboard_table`, new rows                                                          |
| US5 1 (`Space b` opens the priorities)                 | 10   | `buffer.test.tsx` "Space b opens the page's file, frontmatter and all"                             |
| US5 2 (`:w` writes, not committed; Commit lists it)    | 2, 7 | core `a_buffer_save_writes_without_committing`; core `a_buffer_edit_is_one_edit_line`              |
| US5 3 (a conflict)                                     | 2    | core `a_buffer_save_over_a_changed_file_writes_nothing`; banner: `editor.test.tsx`'s existing test |
| US5 more 1 (a feature's spec on its branch)            | 2    | core `a_buffer_writes_a_features_file_on_its_branch`                                               |
| US5 more 2 (refused while the agent works)             | 2    | server `buffer.test.ts` "a feature's buffer is refused while its agent works"                      |
| US5 more 3–5 (`:q`, the phone, no `Space b`)           | 10   | none: seen in the sandbox; the Leave guard is the existing `leave.test.tsx`                        |
| US6 1 (a pane per branch)                              | 7    | core `each_branch_lists_its_buffer_edits`                                                          |
| US6 2 (a pane commits its branch only)                 | 7    | core `a_branch_commits_alone`                                                                      |
| US6 3 (the message as typed)                           | 7    | core `a_branch_commits_alone` (rewritten message row)                                              |
| Edge: Vim on, a changed row, Escape twice              | 6    | `vim.test.tsx` "Escape twice in a changed row asks before dropping the change" (R10)               |
| Edge: a buffer over a changed file                     | 2    | as US5 3                                                                                           |
| Edge: a buffer breaks a file's format                  | 2    | `a_buffer_save_writes_without_committing` saves a broken decision as typed                         |
| Edge: an emptied commit message                        | 7    | core `an_empty_message_is_refused`                                                                 |
| Edge: Vim off with unsaved text                        | 6    | `vim.test.tsx` "turning Vim off keeps the field's text"                                            |
| Edge: changes grow after a rewritten message           | 7    | none: the field's state, seen in the sandbox                                                       |
| Edge: two panes on the phone                           | 7    | none: layout                                                                                       |
| Edge: Escape in a dialog's field                       | 6    | none: the editor's Escape inside a layer, seen in the sandbox                                      |
| Edge: a feature pane committed while its agent works   | 7    | server `inbox.test.ts` new row "a feature pane is refused while its agent works"                   |
| Edge: Shift+Escape in Chrome; dead keys; `"+p`; Ctrl+W | 6    | none: browser behaviour                                                                            |
| Edge: a 2,000-character line                           | 3    | none: layout                                                                                       |
| Edge: a screen reader hears the mode                   | 8    | none: a polite live region, checked in the sandbox                                                 |
| SC-001 (every field is the editor)                     | 9    | `lint.test.ts` new fixtures                                                                        |
| SC-002 (keystroke 16 ms) and SC-003 (reload 1 s)       | 11   | `vp run performance`, new keystroke measure                                                        |
| SC-004 (switch off, no chunk)                          | 6    | `vim-load.test.ts`                                                                                 |
| SC-005 (settings keys)                                 | 1    | core `reads_the_keyboard_table`, `sets_vim_keys_keeping_the_hand_edits`                            |
| SC-006 (buffer paths and conflict)                     | 2    | core buffer tests                                                                                  |
| Review focus 1, 2                                      | 2    | core `a_buffer_refuses_paths_outside_specs`, `a_buffer_writes_a_features_file_on_its_branch`       |
| Review focus 3, 4, 5                                   | 7    | core `a_branch_commits_alone`, `a_buffer_edit_is_one_edit_line`, `an_empty_message_is_refused`     |
| Review focus 6                                         | 3    | `editor-field.test.tsx` row "Enter while composing does not save"                                  |
| Review focus 7                                         | 6    | `vim-load.test.ts`                                                                                 |

## Waves

1. Tasks 1, 2, 3: the settings keys, the core's buffer, the editor. No file in common; task 2 and
   task 1 both add to the binding's `index.d.ts`, generated, and to `crates/binding/src/lib.rs` side
   by side.
2. Tasks 4, 5, 6, 7: one-line fields and rows, the composer, the Vim layer with its settings, the
   Commit page. They each add rows to `keys-structural.test.ts`'s allowlist.
3. Tasks 8, 9: the status line, the lint rule.
4. Task 10: the buffer page.
5. Task 11: documentation and the benchmark.

---

## Task 1: The `vim_mode` and `vim_commands` settings

**Risky:** the settings file's format, read and written by the core.

**Files:**

- Modify: `crates/core/src/settings.rs`, `crates/core/src/settings/file.rs`,
  `crates/binding/src/settings.rs`, `packages/binding/index.d.ts`, `packages/binding/index.js`,
  `packages/binding/contracts.test.ts`, `packages/server/src/settings.ts`,
  `packages/server/src/fate/settings.ts`, `packages/server/src/fate/settings-mutations.ts`,
  `packages/web/src/views.ts`, `packages/web/.fate/client.generated.ts`,
  `packages/web/src/settings/optimistic.ts`, `packages/web/src/settings/SettingsView.stories.tsx`
- Test: `crates/core/tests/settings.rs`, `packages/server/src/__tests__/settings.test.ts`,
  `packages/server/src/__tests__/settings-fate.test.ts`

**Interfaces:**

- Produces:
  - Core:
    `KeyboardSettings { single_key_shortcuts: Option<bool>, vim_mode: Option<bool>, vim_commands: Option<Vec<String>> }`;
    `pub fn set_vim_mode(dir: &Path, on: bool) -> Result<Settings, ApiError>`;
    `pub fn set_vim_commands(dir: &Path, lines: &[String]) -> Result<Settings, ApiError>`.
  - Binding: `setVimMode(dir, on): Promise<Settings>`,
    `setVimCommands(dir, lines): Promise<Settings>`;
    `KeyboardSettings { singleKeyShortcuts?: boolean; vimMode?: boolean; vimCommands?: Array<string> }`.
  - Server:
    `KeyboardSettingsView { singleKeyShortcuts, vimMode: Setting<boolean>, vimCommands: Setting<Array<string>> }`,
    in force `false` and `[]`; mutations `settings.setVimMode({ on: boolean })` and
    `settings.setVimCommands({ lines: Array<string> })`, both returning the settings record.
  - Web: `SettingsRecordView.keyboard.vimMode` and `.vimCommands`; `shown.setVimMode(on)` and
    `shown.setVimCommands(lines)` in `optimistic.ts`.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/settings.rs`, add rows to `reads_the_keyboard_table`: `vim_mode = true` and
`vim_commands = ["imap jj <Esc>", "nmap Y y$"]` read as written; a file without them reads `None`;
`vim_mode = "yes"` fails with `line N, vim_mode: Vim mode is true or false.`;
`vim_commands = "imap jj <Esc>"` and `vim_commands = [1]` fail with
`line N, vim_commands: Vim commands are a list of lines, like ["imap jj <Esc>"].` Add
`sets_vim_keys_keeping_the_hand_edits`: over a file with a comment on `single_key_shortcuts`,
`set_vim_mode(dir, true)` then `set_vim_commands(dir, &["imap jj <Esc>"])` leave the comment and the
key order, and append the two keys in `[keyboard]`. Server: `settings.test.ts` asserts the defaults
in force (`vimMode.inForce === false`, `vimCommands.inForce` empty); `settings-fate.test.ts` sets
both through the mutations and reads them back.

The break each test catches: a default of `true`; a list read from a string; a write that drops a
comment or reorders keys; a mutation not reaching the file.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test settings`
- Expected: FAIL, compile error `no field vim_mode` or the missing `set_vim_mode`.

- [x] **Step 3: Implement the keys, from the core to the web's view**, following
      `single_key_shortcuts`'s path (commit `63fc7ef5`). Rebuild the binding with
      `vp run --filter uraeda-binding build`, and regenerate the fate client with the web's build,
      `vp run --filter uraeda-web build`, whose fate plugin writes it.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat(vim-text): the Vim mode and Vim commands settings"
```

## Task 2: The core's buffer: read and save any Markdown file under `specs/`

**Risky:** it widens what the web UI can write, a security guard, and records state beside a
checkout.

**Files:**

- Create: `crates/core/src/actions/edited.rs`, `crates/core/src/api/buffer.rs`,
  `crates/binding/src/buffer.rs`, `packages/server/src/fate/buffer.ts` (the mutation),
  `packages/server/src/fate/views-buffer.ts` (the data view and its source, apart from the mutation,
  which imports the sources)
- Modify: `crates/core/src/actions/mod.rs`, `crates/core/src/api/mod.rs`,
  `crates/binding/src/lib.rs`, `packages/binding/index.d.ts`, `packages/binding/index.js`,
  `packages/server/src/fate/mutations.ts` (or the server's list of mutation modules),
  `packages/server/src/fate/sources.ts`, the fate types the server exports
- Test: `crates/core/tests/buffer.rs`, `packages/server/src/__tests__/buffer.test.ts`

**Interfaces:**

- Produces:
  - Core: `pub fn read_buffer(repo: &Path, path: &str) -> Result<BufferView>` with
    `BufferView { path: String, text: String, hash: String, branch: String }`, the text whole,
    frontmatter included;
    `pub fn save_buffer(repo: &Path, path: &str, text: &str, previous: &str) -> Result<String>`
    returning the new hash, never committing.
  - Core: `actions::edited::{record(place, path), list(place) -> Vec<String>, clear(place, paths)}`:
    the paths (from the repository root) a buffer saved in the checkout of `place`, kept in a file
    of that checkout's own git directory (`git rev-parse --git-dir`, `Git::git_dir`), named
    `uraeda-edited`, one path per line, so each worktree has its own.
  - Where a path is written: under `specs/<folder>/` or `specs/changes/<folder>/` of a known feature
    or change, at any depth, on its branch through `place::reach`; any other `specs/**/*.md`, and a
    merged feature's files, which have no branch left, on the default branch. A path not ending in
    `.md`, outside `specs/`, with `..`, or resolving outside the repository through a symlink, is
    refused with `"<path> is not a Markdown file of specs/"`. A stale hash is the existing conflict.
  - Core: `pub fn buffer_folder(repo: &Path, path: &str) -> Result<Option<String>>`, the folder of
    the feature or change whose branch the file is written on, a finished feature's record
    `specs/done/<folder>.md` included; none for a file of the default branch.
  - Binding: `readBuffer(repo, path): Promise<BufferView>`,
    `saveBuffer(repo, path, text, previous): Promise<string>`,
    `bufferFolder(repo, path): Promise<string | null>`.
  - Server: a `Buffer` source by id (the path) and mutation `buffer.save({ path, text, hash })`
    returning the `Buffer`, refused through `writable(ctx, { folder })` while an agent works, the
    folder from `binding.bufferFolder`: `pathFolder` reads `done` for a finished feature's record.

- [x] **Step 1: Write the failing tests**

`crates/core/tests/buffer.rs`:

- `a_buffer_save_writes_without_committing`: save `specs/PRIORITIES.md` with "- Global undo" added
  under Now; the file holds the text, `HEAD` is unchanged, and `edited::list` names the path. A
  second row saves a decision with a section removed: written as typed.
- `a_buffer_save_over_a_changed_file_writes_nothing`: the error's code is `conflict`; the file is
  unchanged.
- `a_buffer_writes_a_features_file_on_its_branch`: `specs/<folder>/spec.md` and
  `specs/<folder>/contracts/api.md` land in the feature's worktree, and the default checkout's tree
  is unchanged.
- `a_buffer_refuses_paths_outside_specs`: rows `Cargo.toml`, `specs/../Cargo.toml`,
  `specs/x/../../a.md`, `specs/<folder>/../PRIORITIES.md` (inside `specs/`, but routed to the
  feature's branch), `specs/image.png`, a symlink `specs/out.md` to a file outside, a dangling
  symlink, and a file under a symlinked folder: each refused with the message above, read or saved,
  nothing written.
- `a_buffer_reads_the_whole_file`: `read_buffer("specs/<folder>/spec.md")` starts with `---`.

Server `buffer.test.ts`: "a feature's buffer is refused while its agent works" (with a running fake
session, as `sessions.test.ts:1340` sets one up): the refusal is "An agent is working on this
feature. Stop it first, or wait for it."

The break each test catches: a commit on save; a write over a stale hash; a feature file written on
the default branch; a path escape; the frontmatter stripped; a missing refusal.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test buffer`
- Expected: FAIL, unresolved `read_buffer`.

- [x] **Step 3: Implement `read_buffer`, `save_buffer`, and the record**, reusing `text::save` for
      the hash check and `place::reach` for the branch; widen `text::checked` only through the new
      API, leaving `save_text`'s rules as they are. Then the binding and the server's source and
      mutation.

- [x] **Step 4: Make the breaks**: remove the `..` check, and the symlink check, one at a time; see
      `a_buffer_refuses_paths_outside_specs` fail; restore.

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git commit -m "feat(vim-text): read and save any Markdown file of specs/ as a buffer"
```

## Task 3: The editor, and every several-lines field on it

**Files:**

- Create: `packages/web/src/fields/editor/Editor.tsx`, `fields/editor/theme.ts`,
  `fields/editor/markdown.ts`, `fields/editor/modeStore.ts`, `fields/editor/oneLine.ts`,
  `fields/editor/keys.ts` (the field's keys), `fields/editor/slot.ts` (`vimSlot`, the registry of
  the slot's extensions, and each editor's actions)
- Modify: `packages/web/package.json` (`@codemirror/state`, `@codemirror/view`,
  `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown`, `@lezer/highlight`
  for the highlighting's tags, `@replit/codemirror-vim`, exact versions), `fields/TextField.tsx`,
  `attach/useImageText.ts` (the ref and paste of an image field reach the editor), `AddNote.tsx`,
  `QuickAdd.tsx` (`onEnter` in place of their key handler), `ProposalText.tsx` (`onEscape`),
  `__tests__/helpers.tsx` (`type`, and `fieldText` reading a field's text), `__tests__/setup.ts`
  (happy-dom's `selectionchange`, fired at once, is dropped: CodeMirror read it as a new update
  inside its own), `__tests__/keys-structural.test.ts` (CodeMirror's `domEventHandlers` and
  `keymap.of` count as listeners), the tests that set a `textarea`'s value directly or read its
  `value` (`round`, `review`, `leave`, `sign-in`, `inbox-images`, `keys-inbox`, `keys-promote`) to
  call `type` and `fieldText`
- Test: `packages/web/src/__tests__/editor-field.test.tsx`

**Interfaces:**

- Produces:
  - `Editor(props: EditorProps)`, with
    `EditorProps = { variant: "line" | "lines"; label: string; value: string; onChange: (value: string) => void; onSubmit?: () => void; onEnter?: () => void; onEscape?: (leave: () => void) => "handled" | "pass"; onPaste?: (event: ClipboardEvent) => boolean; onFocus?: () => void; id?: string; rows?: number; placeholder?: string; isAutoFocused?: boolean; isDisabled?: boolean; ref?: Ref<EditorHandle> }`
    and
    `EditorHandle = { focus(): void; insertText(text: string): void; view(): EditorView | null; element(): HTMLElement | null }`.
    `onEscape` runs on Escape outside Vim's insert or visual modes, `leave` blurring the field; its
    default blurs the field, keeping the text, or inside a layer passes the key to it. `onEnter`
    runs on Enter, Shift+Enter aside, in a `line` (which never inserts a line break) or in `lines`
    when given, as the ＋ forms' one-line entries; Ctrl+Enter and Cmd+Enter run `onSubmit`, in every
    variant. None runs while composing. `useEditorElement(handle)` gives the editor's element as a
    ref, for the drop's target.
  - The `line` variant refuses line breaks (a pasted "first\nsecond" reads "first second"), wraps,
    and grows to 9 lines, then scrolls inside. `lines` is `rows` lines tall, scrolling past them, as
    `mockups/fields.html` draws it (R6).
  - `modeStore`:
    `setFocused(field: { mode: Mode; line: number; column: number; progress: string } | null)`,
    `setMode(mode: Mode)`, `setPlace(place: { line; column; progress })` (the cursor moved),
    `useMode(): { mode: Mode | "nav"; line?: number; column?: number; progress?: string }`, with
    `Mode = "normal" | "insert" | "visual" | "visual-line" | "visual-block" | "replace" | "command"`.
    Without Vim, a focused field reports `insert`; the status line hides it with Vim off. `progress`
    is Vim's ruler: `All`, `Top`, `Bot`, or a percentage of the field's scroll.
  - A compartment slot `vimSlot` in each editor, which task 6 fills, in `fields/editor/slot.ts`:
    `registerEditorExtension(ext: () => Extension): () => void` puts `ext()` in every editor's slot,
    mounted or to come, until the returned function removes it; `editorActions(view)` gives the
    field's `{ enter(), escape(), submit() }`, which the Vim layer's `:w`, `:q`, and Escape call.
  - `__tests__/helpers.tsx`'s `type(element, value)` sets a CodeMirror field's text through
    `EditorView.findFromDOM`, else as today.
  - `TextField` keeps its props (`kind`, `onSubmit`, `label`, `value`, `onChange`, …), drawn by the
    editor, `lines` variant, `rows` by kind.

- [x] **Step 1: Write the failing tests**

`editor-field.test.tsx`, over `renderPage` on a round's page with a comment field:

- "Escape leaves a comment keeping its text, and the page's keys work again": type "draft", press
  Escape on the field's content element; the focus leaves it, the field still reads "draft", and the
  round's `n` jumps to the first unanswered question (`j` only scrolls a round's page).
- "a field's text survives a Compartment swap": reconfigure the editor's `vimSlot` with the Vim
  extension, then with nothing; the text and the selection are unchanged (the discovery's unverified
  outside behaviour).
- A row "Enter while composing does not save", on the ＋ form's "Proposal" field, whose Enter adds:
  a keydown of Enter with `isComposing` leaves the form open and the file unchanged; Enter once
  composed adds the line.

The break each test catches: an Escape that clears the text or keeps the focus; a swap that rebuilds
the state; a save during composition.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/editor-field.test.tsx`
- Expected: FAIL, the comment field is still a `textarea` (`EditorView.findFromDOM` returns null).

- [x] **Step 3: Implement the editor, its theme over Astryx's tokens in the terminal look of
      `mockups/editor.css`, Markdown highlighting with dimmed marks, `TextField` on it, and `type`**

The accessible name goes on the content element through `contentAttributes` (`aria-label`). The
theme's font is the theme's monospace token. Move the tests that set a field's value directly to
`type`, keeping their assertions. Add the editor's listener to the structural allowlist with its
reason.

- [x] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS, every existing web test included

- [x] **Step 5: Commit**

```bash
git commit -m "feat(vim-text): one editor for text fields, Markdown highlighted and wrapped"
```

## Task 4: One-line fields and outline rows on the editor

**Files:**

- Create: `fields/TextLine.tsx` (`TextLine`, the one-line field under Astryx's `Field` label, and
  `arrowKeys`)
- Modify: `fields/editor/Editor.tsx` (`keys`, `onBlur`, `data-autofocus`, a caller's text placing
  the cursor after it), `EditableLine.tsx` (`LineField`), `lists/OutlineEditor.tsx`,
  `lists/useOutlineField.ts`, `AddNote.tsx`, `AddRepository.tsx`, `NewPage.tsx` (the search),
  `OfferCard.tsx`, `RepositoryMenu.tsx`, `SlugField.tsx`, `StartDialog.tsx`, `keys/KeyMap.tsx`,
  `settings/SettingsView.tsx`, `sidebar/FeatureSettings.tsx`, `sidebar/RenameSession.tsx`,
  `__tests__/keys-structural.test.ts`, and the tests that type into them
- Test: `__tests__/keys-row-editing.test.tsx` (rewritten row)

**Interfaces:**

- Consumes: `Editor` with `variant: "line"`, `onEnter`, `onEscape`, `onPaste` (task 3).
- Produces: `EditorProps.keys?: ReadonlyArray<FieldKey>`, with
  `FieldKey = { key: string; run: () => boolean }` (CodeMirror's key names, before its own keymap:
  the first render's keys, each running its latest `run`), and `EditorProps.onBlur?: () => void`,
  run as the focus leaves the editor, from its text or its Vim prompt (ruling R12);
  `TextLine(props)`, `Editor`'s props with `variant: "line"` set, plus `description`, `status`,
  `isLabelHidden`, `hasAutoFocus`, and `width`, as Astryx's `TextInput` had; and `arrowKeys(move)`,
  Down and Up for a field over a list. Each field keeps its props and its keys: each field keeps its
  props and its keys: Enter saves a row or a line, Escape cancels it asking "Discard your changes?"
  when changed, Tab and Shift+Tab indent a row, Backspace drops an empty new row, an image pasted in
  an inbox row goes to its images, a search's arrows still move its results. The password in
  `SignInPage.tsx` stays a `TextInput`.

- [x] **Step 1: Write the failing test**: in `keys-row-editing.test.tsx`, a new test "a row refuses
      line breaks": `type(row, "first\nsecond")`, the field reads "first second", then Enter saves
      "first second" in `PRIORITIES.md`.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test packages/web/src/__tests__/keys-row-editing.test.tsx`
- Expected: FAIL once the row is on the editor without `oneLine`, the field reading two lines. On
  the `textarea`, the test passes: its `onChange` already replaced a line break, and the core writes
  one line either way, so the failing run is the editor's with `oneLine` taken out.

- [x] **Step 3: Move every one-line field and the outline row to the editor**, keeping each one's
      handlers through `onEnter`, `onEscape`, and `onPaste`; Tab on a row goes through the editor's
      keymap, not a listener of its own. Move the tests that type into them to `type`.

- [x] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat(vim-text): one-line fields and outline rows on the editor"
```

## Task 5: The composer on the editor

**Files:**

- Create: `packages/web/src/fields/editor/ComposerEditor.tsx`
- Modify: `ComposerField.tsx`, `Composer.tsx`, `ComposerImages.tsx`, `NewPage.tsx`,
  `NewFeatureComposer.tsx`, `NewChangePage.tsx`, `fields/editor/Editor.tsx` and `theme.ts` (the
  `composer` variant, R8), `attach/useImageDrop.ts` (drops heard first, R9),
  `__focused__/helpers.tsx`, `__focused__/composer.test.tsx`, `__tests__/keys-structural.test.ts`,
  and the tests reading the composer's `textContent` (`commit-toast`, `keys-pages`, `new-feature`,
  `new-page`, `setup-message`), now through `fieldText`

**Interfaces:**

- Consumes: `Editor`, `EditorHandle` (task 3).
- Produces: `ComposerEditor`, the composer variant: an `Editor` with `variant: "composer"` and
  `maxRows` (R8) reading and writing `ChatComposerContext`'s `value` and `onChange`, registering
  `inputControlRef.current = { focus }`, growing upward to 20 rows, 9 on the phone, then scrolling
  inside, folding to one line as today. The pages' `inputRef` becomes
  `RefObject<EditorHandle | null>` (`focus`, `insertText`). Escape blurs keeping the draft; Enter
  adds a line; Ctrl+Enter sends; pasted and dropped images reach `onFiles`.

- [x] **Step 1: Check the composer's existing tests type through `type`**, and add the paste test,
      which did not exist: a row each for a PNG pasted in and dropped on the editor's content
      element, attached and not typed.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__focused__/composer.test.tsx`
- Expected: FAIL, the content element has no `EditorView`.

- [x] **Step 3: Implement `ComposerEditor`, and give it to `FoldingField`**

- [x] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat(vim-text): the composer on the editor"
```

## Task 6: The Vim layer, and its settings

**Files:**

- Create: `fields/editor/vim/load.ts` (the lazy loader), `fields/editor/vim/vim.ts` (the chunk: the
  extension, Escape, `:w` `:q` `:wq`, the clipboard, the commands),
  `fields/editor/vim/VimSetting.tsx` (reads the setting and the pointer, loads, reports the
  commands' errors), `settings/VimSettings.tsx` (the Keyboard section's switch and commands field)
- Modify: `settings/KeyboardSettings.tsx`, `settings/SettingsPage.tsx`, `settings/categories.ts`,
  `settings/ServerSettings.tsx` (`ServerActions` gains `setVimMode` and `setVimCommands`),
  `settings/SettingsView.stories.tsx`, `Shell.tsx` (mounts `VimSetting` beside `SingleKeysSetting`),
  `fields/editor/Editor.tsx` (exports `placeOf`), `fields/editor/modeStore.ts` (`modeNow()`, the
  store read outside React), `__tests__/helpers.tsx` (`renderPage`'s `config`, the server's config
  folder), `__tests__/keys-structural.test.ts`
- Test: `__tests__/vim.test.tsx`, `__tests__/vim-load.test.ts`

**Interfaces:**

- Consumes: `vimSlot` and the editor's actions (task 3); `SettingsRecordView.keyboard.vimMode`,
  `.vimCommands`, `settings.setVimMode`, `settings.setVimCommands` (task 1).
- Produces:
  - `loadVim(settings: { on: boolean }, pointer: { fine: boolean }): Promise<VimLayer | undefined>`,
    importing `./vim.ts` only when `on && fine` (`finePointer()`, `matchMedia("(pointer: fine)")`);
    `VimLayer` is the chunk's module: `runCommands` and `extension`, the factory `VimSetting` gives
    `registerEditorExtension`. The commands' errors are kept beside it, `setVimErrors(errors)` and
    `useVimErrors()`, which the Keyboard section reads: `undefined` while the engine is not loaded,
    where the field says "Checked when Vim mode is on, with a mouse or trackpad."
  - `runCommands(lines: ReadonlyArray<string>): Array<string>` in the chunk: each line through the
    engine's `Vim.handleEx`, the errors as `Line N: <the engine's message>`.
  - The mode reaches `modeStore.setMode` on the engine's `vim-mode-change`, and `command` while its
    `:` prompt is open.
  - A yank writes the unnamed register's text to `navigator.clipboard.writeText`; `p` pastes the
    engine's register.
  - Fields open in insert mode at focus. Escape in normal mode, and Shift+Escape in any mode, run
    the editor's Escape; Escape after a pending key, like `d`, only drops it; Enter in normal mode
    runs a one-line field's Enter. `:w` runs the field's `onSubmit`, `:q` its Escape action keeping
    the text, `:wq` both, once the engine's prompt has closed: a one-line field `:wq` saves is left
    as a click away leaves it, not by its Escape, which would ask to discard what it just saved
    (ruling R17). The engine and the layer's keys sit at `Prec.highest` in the slot, before the
    editor's own keys.

- [x] **Step 1: Write the failing tests**

`vim-load.test.ts`:

- "the engine loads only with the switch on and a fine pointer": with a mocked import counter, rows
  (off, fine) and (on, coarse) never import; (on, fine) imports once.
- "a refused command gives its line and the engine's message":
  `runCommands(["imap jj <Esc>", "nmpa Q dd"])` returns
  `["Line 2: Not an editor command \":nmpa Q dd\""]`.

`vim.test.tsx`, with `vim_mode = true` and `vim_commands = ["imap jj <Esc>"]` in the server's
settings file (`renderPage`'s `config`) and a fine pointer, on a round's comment field, since the
priorities' rows reach the editor in task 4, run beside this one (R10):

- "a field opens in insert mode": a comment holding "Review the UI guidelines properly", focused,
  then `x` typed through the engine: the field reads "Review the UI guidelines properlyx" and the
  mode store reads `insert`.
- "Escape in normal mode does the field's Escape, the first leaving insert mode": the first Escape
  goes to normal mode in the field, `0dw` deletes "Review ", the second runs the comment's Escape,
  which leaves it keeping the text; a row's Escape, the same action, asks "Discard your changes?".
- "Shift+Escape leaves a comment from insert mode, keeping its text".
- "a yank reaches the clipboard": `yy` in a comment; `navigator.clipboard.readText()` gives the
  line.
- "`:w` saves a comment": `:w` then Enter saves it as Ctrl+Enter does.
- "the human's commands run when Vim starts": `jj` typed quickly in insert mode leaves normal mode
  reading NORMAL, no `j` inserted.
- "turning Vim off keeps the field's text": unsaved text, then the setting off: the field keeps it
  and has no Vim.

The break each test catches: the chunk loaded for everyone or on touch; an error without its line; a
field opening in normal mode; Escape dropping changes unasked; a yank kept in Vim only; `:w`
ignored; commands not run; a switch that rebuilds the field.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/vim-load.test.ts packages/web/src/__tests__/vim.test.tsx`
- Expected: FAIL, `fields/editor/vim/load.ts` does not exist.

- [x] **Step 3: Implement the layer and the Keyboard section**: the "Vim mode" switch, and "Vim
      commands" as a several-lines editor, one command per line, saved as the list, each error under
      the field. Use `Vim.defineEx` for `w`, `q`, `wq`, and the engine's register controller for the
      clipboard.

- [x] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat(vim-text): Vim's keys behind the Vim mode setting"
```

## Task 7: The Commit page, a pane per branch

**Risky:** git writes on several branches, and a commit message the human types.

**Files:**

- Modify: `crates/core/src/actions/changes.rs`, `crates/core/src/api/proposal_edits.rs`,
  `crates/core/src/api/inbox_edits.rs`, `crates/binding/src/inbox_writes.rs`,
  `packages/binding/index.d.ts`, `packages/binding/index.js`,
  `packages/server/src/fate/inbox-mutations.ts`, the server's sources and views,
  `packages/web/src/CommitPage.tsx`, `packages/web/src/views.ts`, `packages/web/src/data.ts`, the
  sidebar's Commit count
- Create: `packages/web/src/commit/BranchPane.tsx` (one pane: its lines, its message field, Commit
  and Discard), `commit/usePaneWrites.ts`, `commit/useCommitPanes.ts`; core
  `actions/changes/{edits,panes,discard}.rs`, `api/commit_panes.rs`; server
  `fate/commit-mutations.ts` (the two mutations, out of `inbox-mutations.ts`, at its 500 lines)
- Test: `crates/core/tests/branch_commits.rs`, `packages/server/src/__tests__/buffer.test.ts` (with
  its running-agent helper)

**Interfaces:**

- Consumes: `actions::edited::{list, clear}` (task 2); `Editor` (task 3).
- Produces:
  - Core: `pub fn branch_changes(repo: &Path) -> Result<Vec<BranchPane>>` with
    `BranchPane { branch: String, folder: Option<String>, count: u32, lines: Vec<String>, message: String }`:
    the default branch's pane first, when it has changes, then each feature or change branch whose
    worktree has buffer edits. A path in `edited::list` reads one `- Edit <path>` line in place of
    its structured lines, from the root on the default branch, from the folder on a feature's.
    `message` is the suggestion: as today on the default branch, with `edit <path>` as a subject;
    `chore(<slug>): edit <name>` on a feature's, `, and N more` past one.
  - Core: `pub fn commit_branch(repo: &Path, branch: &str, message: &str) -> Result<CommitView>`:
    commits the pane's files only, with the message as typed, trimmed of blank lines around it, one
    text git commits verbatim (ruling R22); refused with "A commit needs a message." when it is
    blank. The record of a path ends once a commit by any route changes its file in `HEAD`, so a
    refused deferred commit keeps its pane, and an agent's later edit of a file committed elsewhere
    is not the human's (ruling R14). `pub fn discard_branch(repo: &Path, branch: &str)` restores
    what the pane lists, the files a buffer edited included. The default branch keeps today's
    `commit_changes` and `discard_changes` behaviour through these; those, the editor's
    `uraeda.commit`, and a proposal file's commit leave out the files a buffer edited other than the
    lists (ruling R21). A branch's pane belongs to the feature or change on it, finished or not, as
    a buffer's file does (ruling R2). The commit bar's count (`Priorities.changes`, `Inbox.changes`)
    sums every pane's. A message equal to the suggestion may amend as today; any other never amends
    (ruling R11), nor is amended by a later commit (ruling R13); only the default branch's commit
    marks itself typed, so a feature pane's commit leaves that mark (ruling R16).
  - Binding: `commitPanes(repo)` (the name `branchChanges` is a feature's diff already),
    `commitBranch(repo, branch, message)`, `discardBranch(repo, branch)`.
  - Server: mutations `changes.commit({ write, branch, message })` and
    `changes.discard({ branch })`, `branch` left out committing the default branch with the
    suggestion as before; a feature branch's commit goes through `writable(ctx, { folder })`. A
    `CommitPanes` record (id `commit`, `panes`), as `BranchChanges` names a feature's diff already,
    sent live with the priorities, on a feature's change, and on each buffer's save, with the
    priorities and the inbox, whose count it changes.
  - Web: the page's selected pane for `j` `k`; Enter and `d` act on it; Ctrl+Enter in a message
    commits its pane; "Use the suggested message" shows once the message differs from the
    suggestion. A typed message is unsaved text, in the store as `commit:<branch>#message` through
    `useTextField`, so the Leave guard, the "Unsaved message" mark, and the restore notice apply; it
    stays until its commit lands, through a hook's refusal (ruling R20). With one pane the page
    looks as today; on the phone, two panes put their buttons in each pane and the bottom bar holds
    none.

- [x] **Step 1: Write the failing tests**

`crates/core/tests/branch_commits.rs`:

- `each_branch_lists_its_buffer_edits`: buffer saves of `specs/PRIORITIES.md` and a feature's
  `spec.md`; panes `main` with `- Edit specs/PRIORITIES.md` and message
  `chore: edit specs/PRIORITIES.md`, then the feature's with `- Edit spec.md` and
  `chore(<slug>): edit spec.md`.
- `a_buffer_edit_is_one_edit_line`: a buffer save of `INBOX.md` beside an inbox addition made by the
  structured action: one `- Edit specs/INBOX.md` line, and the commit holds the file as typed.
- `a_branch_commits_alone`: committing the feature's pane with "chore: drop the clock" makes one
  commit on its branch with that subject, leaves the `main` pane, and leaves an untracked file of
  the worktree out of the commit; a row commits `main` with "\n\nchore: add Global undo to Now\n"
  and reads "chore: add Global undo to Now".
- `an_empty_message_is_refused`: rows "" and " ": refused with "A commit needs a message.", nothing
  staged.

Existing tests keep passing with the suggested message: `priorities.rs` :232, :268, :348;
`inbox_moves.rs` :313, :427, :789. Server `inbox.test.ts`: a row "a feature pane is refused while
its agent works", in `buffer.test.ts`.

The break each test catches: a pane listing an agent's files; structured lines beside a buffer edit;
a commit on the wrong branch or with other files; a rewritten message; an empty commit.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test branch_commits`
- Expected: FAIL, unresolved `branch_changes`.

- [x] **Step 3: Implement the panes, from the core to the page**, after `mockups/commit.html`.

- [x] **Step 4: Make the break**: stage the whole worktree in `commit_branch`; see
      `a_branch_commits_alone` fail; restore.

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git commit -m "feat(vim-text): the Commit page commits each branch apart, with its message"
```

## Task 8: The status line in LazyVim's shape

**Files:**

- Create: `packages/web/src/shell/status/Mode.tsx`, `shell/status/Sections.tsx` (lualine's
  separators, drawn triangles), `shell/status/Place.tsx` (the cursor's place), and a store for the
  branch section, `shell/status/branch.ts`
- Modify: `shell/StatusLine.tsx`, `theme/icons.ts` and `theme/editorIcons.ts` (Lucide `compass`,
  `square`, `square-dashed`, `replace`; `pencil` and `terminal` were registered already),
  `fields/editor/vim/load.ts` and `VimSetting.tsx` (`useVimOn()`: whether the Vim layer is in the
  fields, the switch on and a fine pointer)
- Test: `__tests__/status-line.test.tsx` (the mode named with Vim on, left out with Vim off, its
  change read out once), `__tests__/theme-tokens.test.ts` (the mode's colours read at 4.5:1)

**Interfaces:**

- Consumes: `modeStore.useMode` (task 3), the Vim setting in force (task 1).
- Produces: `useStatusBranch(branch: string | undefined)`, which a page calls to show its branch in
  section b while it is drawn (task 10's buffer); the line reads it with `useShownBranch()`.

- [x] **Step 1: Draw the line after `mockups/statusline.html`**: with Vim on, the mode block first,
      NAV outside a field; with Vim off, the same sections without it; the cursor's place as "Top
      3:9" at the right end while a field has the focus; the mode announced in a polite live region,
      once per change. The phone's bar is unchanged.

- [x] **Step 2: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS, `keys-hints.test.tsx` included

- [x] **Step 3: Review it in the sandbox**: `vp run sandbox`, Vim on and off, both themes, wide.

- [x] **Step 4: Commit**

```bash
git commit -m "feat(vim-text): the status line in LazyVim's shape, with the Vim mode"
```

## Task 9: Lint keeps every text field on the editor

**Files:**

- Modify: `vite.config.ts` (`no-restricted-imports` paths `@astryxdesign/core/TextInput`,
  `@astryxdesign/core/TextArea`, and `ChatComposerInput` from `@astryxdesign/core/Chat`, the message
  "use the shared editor, fields/editor (Text editing decision)"; the `input` and `textarea`
  messages of `forbiddenElements` name the editor), `SignInPage.tsx` (an `oxlint-disable-next-line`
  with its reason: the password, for password managers)
- Create: `packages/web/src/__lint__/astryx-text-input.tsx`, `__lint__/astryx-composer-input.tsx`
- Test: `packages/web/src/__tests__/lint.test.ts`

- [x] **Step 1: Add the fixture and its row to `lint.test.ts`**: importing `TextInput` fails with
      the message above.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test packages/web/src/__tests__/lint.test.ts`
- Expected: FAIL, no lint error for the fixture.

- [x] **Step 3: Add the rule**, with the Storybook mockup stories allowed by their existing
      override. The editor's own files need none: they import only Astryx's type
      `ChatComposerInputControl`, which the rule leaves alone.

- [x] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat(vim-text): lint keeps every text field on the shared editor"
```

## Task 10: The buffer page and `Space b`

**Files:**

- Create: `packages/web/src/buffer/BufferPage.tsx`, `buffer/Bufferline.tsx`, `buffer/useBuffer.ts`,
  `buffer/useBufferKey.ts`
- Modify: `routeTable.ts`, `App.tsx`, and `pages.ts` (`/buffer/<path>`), `pane/ProposalEditor.tsx`
  (`ConflictBanner` takes a buffer too), the pages showing one file (`PrioritiesPage`, `InboxPage`,
  `FilePage` for a feature's documents, `EditorPage` for a proposal or a note file, the decisions
  page's reader for a decision or the constitution; no UI guide has a page), and the editor:
  `fields/editor/Editor.tsx` (`isReadFirst`, `onQuit`, the `page` variant), `slot.ts` (the
  `readFirst` facet and the `quit` action), `theme.ts`, `vim/vim.ts` (R15). The right column needs
  no change: the buffer's page has none, as the shell draws a page's own column only.
- Test: `packages/web/src/__tests__/buffer.test.tsx`

**Interfaces:**

- Consumes: `Buffer` source and `buffer.save` (task 2); `Editor` (task 3); the Vim layer's `:w` and
  `:q` through `onSubmit` and Escape (task 6); `useStatusBranch` (task 8).
- Produces: `useBufferKey(path: string | undefined)`: declares `Space b`, "Open as a buffer", on a
  page showing one file; not declared where `path` is undefined, and leading to the page's address,
  which `bufferPath(path)` in the same file builds. `useBuffer(path)`, the buffer's read and save
  over `withFreshBase`, as the proposal editor's, its record read through a `BufferView` of its own.

- [x] **Step 1: Write the failing test**

`buffer.test.tsx`: "Space b opens the page's file, frontmatter and all": on a feature's spec page,
`Space b` navigates to `/buffer/specs/<folder>/spec.md`, whose field's text starts with `---`;
typing a line and Ctrl+Enter writes the file in the feature's worktree, and no commit is made.

The break it catches: the frontmatter dropped; a save on the wrong branch; a commit on save.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test packages/web/src/__tests__/buffer.test.tsx`
- Expected: FAIL, `Space b` is not declared: the location stays on the spec's page.

- [x] **Step 3: Implement the page after `mockups/buffer.html`**: the bufferline "specs ›
      PRIORITIES.md" with its unsaved dot, the conflict banner of the proposal editor, the agent's
      refusal in it, the restore notice over unsaved text kept from before, the cursor at the start
      in normal mode with Vim on, the Leave guard on `:q` or `b` with unsaved text, and on the phone
      Back and Save in the bottom bar. The text scrolls in its own scroller, the room under the
      bufferline, so Vim's screen motions work (R19); `:q` and Back go home when the buffer was the
      first page the app opened; `Space b` is declared only for a file that exists.

- [x] **Step 4: Run the task's validation, and review it in the sandbox**

- Run: `vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat(vim-text): open any file of specs/ as a buffer"
```

## Task 11: Documentation and the benchmark

**Files:**

- Modify: `skills/uraeda/references/conventions.md` (a buffer's edits wait on the Commit page),
  `specs/ui/keyboard.md` (Vim mode, Escape, Shift+Escape, `Space b`), `docs/web-ui.md` (the editor,
  Vim mode and its commands, the buffer, the Commit page's panes),
  `packages/web/scripts/performance-writes.ts`, `performance.ts`, `performance-report.ts`, and
  `performance-setup.ts` (a keystroke in a 2,000-character comment with Vim on, SC-002, against 16
  ms, its row's criterion `keystroke`), and the UI guides `surfaces.md`, `flows.md`, `phone.md`,
  `wide.md`, and `components.md`, whose status line, fields, and Commit page changed

- [x] **Step 1: Write the pages**, each where [documentation](../decisions/documentation.md) says.

- [ ] **Step 2: Run the benchmark**

- Run: `nix develop -c vp run performance`
- Expected: every target met, the keystroke within 16 ms and reloads within 1 second.

- [x] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 4: Commit**

```bash
git commit -m "docs(vim-text): Vim mode, the buffer, and the Commit page's panes"
```
