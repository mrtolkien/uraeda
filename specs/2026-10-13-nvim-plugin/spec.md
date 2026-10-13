---
status: approved
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Nvim plugin

> [!NOTE]
>
> Approved on 2026-10-13.
>
> - One changed decision: the [stack](../decisions/stack.md#proposed-change-2026-10-13-nvim-plugin)
>   gains a language server, `ura lsp` on `lsp-server`, and a rule that editor plugins never parse
>   workflow files. Code actions only edit the open buffer: nothing that commits is a quick fix.
> - Approving, requesting changes, and submitting answers open their own verdict window, with a
>   coloured border and the commit it will make, from `<leader>av` or from a human status in the
>   field picker: my reading of "look and feel different".
> - You asked whether all of Q3 is too complex: it is not. The language server already knows the
>   lines diagnostics, jumps, and comments need. Inline comments are the one story you could drop,
>   US9, without touching the others.
> - Every key sits under `<leader>a`, next to Claude Code's: none of its keys collide, so no
>   `<leader>au` is needed. The prefix is one option, `vim.g.uraeda.prefix`.
> - The commit action covers drafts, proposals, and `PRIORITIES.md`, the files the web UI commits.
>   Other edits are committed with your git tools.
> - Moving a `PRIORITIES.md` line between sections, "set priority" from our chat, is out of scope:
>   say so if you want it in.
> - Risk tier `high`, a new service, a new language, and a new crate: the plan waits for your
>   review.

Workflow files opened in Neovim get Uraeda's own language server: the rules of `ura check` as
diagnostics while typing, frontmatter values completed, and questions and comments in the outline. A
Lua plugin, in this repository's `editors/nvim/`, puts every action under `<leader>a`: drafting a
`PRIORITIES.md` line, starting a draft as a feature, commenting on lines of a spec, picking a
frontmatter value, approving, and committing drafts, with LazyVim's pickers. Neovim is the human's
main editor, and the web UI is not where they write. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Workflow files get the language server (P1)

The human adds the plugin to LazyVim with a `dir` spec. Opening any markdown file under a `specs/`
folder that holds `PRIORITIES.md` starts `ura lsp` for that checkout, next to marksman. The problems
`ura check` would report show as diagnostics while typing, frontmatter values complete from the
allowed ones, and the outline (`<leader>ss`, aerial) lists headings, questions, user stories, tasks,
and comments. Markdown files elsewhere never get it.

Why this priority: every other story runs through the server.

Acceptance scenarios:

1. **Given** `specs/2026-10-13-nvim-plugin/spec.md` open, **When** the human changes
   `risk-tier: high` to `risk-tier: extreme`, without saving, **Then** line 5 shows the error
   `risk-tier "extreme" is not one of low, medium, high`, from the source `uraeda`.
2. **Given** the same buffer, **When** the human types `risk-tier: ` and asks for completion,
   **Then** the items are `low`, `medium`, and `high`.
3. **Given** `clarifications-01.md` with questions Q1, Q1.A, and Q2 open, **When** the human opens
   the symbols picker, **Then** it lists the questions Q1, Q1.A, and Q2 under their headings.
4. **Given** `README.md` at the repository's root open, **When** it loads, **Then** `ura lsp` is not
   attached to it, and marksman is.
5. **Given** `specs/2026-10-13-nvim-plugin/spec.md` open in the main checkout and
   `.worktrees/2026-10-13-nvim-plugin/specs/2026-10-13-nvim-plugin/spec.md` open in another window,
   **When** both load, **Then** two `ura lsp` clients run, one rooted at each checkout.

### US2: Draft a priorities line (P1)

In `PRIORITIES.md`, on a line that has no link yet, `<leader>an` drafts it, as `ura draft` does: a
draft file in `specs/drafts/`, from the proposal template, with the line linked to it. The draft
opens in the current window, not committed.

Why this priority: it is the first action of the proposal, and of every feature.

Acceptance scenarios:

1. **Given** `PRIORITIES.md` with the line `- Codex runtime` under Later, the cursor on it, **When**
   the human presses `<leader>an`, **Then** `specs/drafts/codex-runtime.md` exists with the title
   `# Codex runtime`, the line reads `- [Codex runtime](drafts/codex-runtime.md)`, the draft is open
   in the current window, and nothing is committed.
2. **Given** the cursor on a line that already links a draft, **When** the human presses
   `<leader>an`, **Then** the linked draft opens, and nothing is written.
3. **Given** `PRIORITIES.md` with unsaved changes, **When** the human presses `<leader>an`, **Then**
   the buffer is saved first, and the line drafted is the one under the cursor after saving.

### US3: Start a draft as a feature (P1)

In a draft or a backlog file, `<leader>ap` starts the feature, as `ura start` does: the
`PRIORITIES.md` entry moves to Now, the branch and its worktree are created, and the proposal is
committed there. The new `proposal.md` replaces the draft in the current window.

Why this priority: it is the proposal's second action.

Acceptance scenarios:

1. **Given** `specs/drafts/codex-runtime.md` open, on 2026-10-14, **When** the human presses
   `<leader>ap`, **Then** a notification says `Starting Codex runtime…` while the hooks run, then
   `Started 2026-10-14-codex-runtime`;
   `.worktrees/2026-10-14-codex-runtime/specs/2026-10-14-codex-runtime/proposal.md` is open in the
   current window, the draft's buffer is gone, and the two commits
   `chore(codex-runtime): start Codex runtime` and `chore(codex-runtime): proposal` exist.
2. **Given** a file that is not a draft or a backlog file, **When** the human runs `:Uraeda start`,
   **Then** the error `Only a draft or a backlog file can be started.` shows, and nothing is
   written.

### US4: Comment on lines of a spec (P1)

On a spec, plan, or assessment waiting for the human, `<leader>am` on a line, or on a visual
selection, opens a floating markdown window over the lines. `:w` or `Ctrl-s` adds the comment to the
review file, as `ura review --comment` does; `q` or `Esc` closes it without saving. On lines that
already have a comment, the window opens with its text: saving edits it, saving it empty removes it.

Why this priority: commenting is how the human reviews, the proposal's third action.

Acceptance scenarios:

1. **Given** `spec.md` waiting for the human, committed, lines 50 to 52 selected, **When** the human
   presses `<leader>am`, types `Rename this field`, and saves, **Then** `spec-review.md` has
   `## C1: Lines 50–52, under "<the heading above line 50>"`, the three lines quoted, then the text,
   with `verdict: pending`, and nothing is committed.
2. **Given** C1 on lines 50 to 52, **When** the human presses `<leader>am` on line 51, **Then** the
   window opens with `Rename this field`; replacing it with `Rename it to tier` and saving changes
   C1's text.
3. **Given** the same, **When** the human empties the window and saves, **Then** C1 is removed.
4. **Given** `spec.md` with a change not committed, **When** the human presses `<leader>am`,
   **Then** the error
   `spec.md differs from its last commit: comments point at the committed version. Commit or undo the change first.`
   shows, and no window opens.
5. **Given** a spec whose status is `approved`, **When** the human runs `:Uraeda comment`, **Then**
   the error `spec.md is not waiting for a review.` shows.

### US5: Pick a frontmatter value (P1)

`<leader>ae` lists the current file's frontmatter fields with their values, then the chosen field's
allowed values, the current one marked. Picking a value changes that line in the buffer, keeping any
comment after it, unsaved and undoable with `u`. Numbers, like `revision`, are typed in a prompt.
The same edits are offered as code actions on a field's line.

Why this priority: the proposal's fourth action.

Acceptance scenarios:

1. **Given** `proposal.md` with `discovery: high # low, medium, or high`, **When** the human picks
   `discovery`, then `low`, **Then** the line reads `discovery: low # low, medium, or high`, the
   buffer is modified, and `u` restores `high`.
2. **Given** `spec.md` with `revision: 1`, **When** the human picks `revision` and types `2`,
   **Then** the line reads `revision: 2`.
3. **Given** `spec.md` waiting for the human, **When** the human picks `status`, **Then** the values
   are `awaiting-human`, `approved…`, and `changes-requested…`, the last two marked as committing;
   picking `approved…` opens the verdict window of US6 instead of editing the line.
4. **Given** the cursor on `risk-tier: high`, **When** the human opens code actions (`<leader>ca`),
   **Then** they include `Set risk-tier to low` and `Set risk-tier to medium`, and no action that
   commits.

### US6: Approve, request changes, or submit answers (P2)

`<leader>av` on a spec, plan, or assessment waiting for the human asks for a verdict, approve or
request changes, then opens the verdict window: a float with a coloured border, the file, the commit
it will make, the number of comments, and for a spec the risk tier and plan review, each cycled with
`Tab` on its line, and a summary to type. `Ctrl-s` commits, `q` cancels. On a round of questions,
the same window submits the answers. It does what `ura review` and `ura answer --submit` do: the
block becomes a record, the review gets its verdict, and the commit is made.

Why this priority: it closes the loop of US4, but the CLI and the web UI already approve.

Acceptance scenarios:

1. **Given** `spec.md` waiting for the human, `risk-tier: high`, one comment, **When** the human
   picks Approve, sets the risk tier to `medium`, and presses `Ctrl-s`, **Then** the spec has
   `status: approved`, `risk-tier: medium`, `plan-review: false`, its block reads
   `Approved on 2026-10-13.`, `spec-review.md` has `verdict: approved`, and the commit
   `spec(nvim-plugin): approve` exists.
2. **Given** `spec.md` with no comment, **When** the human picks Request changes, **Then** the error
   `Requesting changes needs at least one comment.` shows, and no window opens.
3. **Given** `clarifications-01.md` with every question answered, **When** the human presses
   `<leader>av` and `Ctrl-s`, **Then** the round is `answered`, its block reads
   `Answered on 2026-10-13.`, and the commit `discovery(nvim-plugin): answer round 01` exists.
4. **Given** `clarifications-01.md` with Q3 and Q5 blank, **When** the human presses `<leader>av`,
   **Then** the window says `Q3 and Q5 have no answer.`, and `Ctrl-s` does nothing.

### US7: Commit a draft, a proposal, or the priorities (P2)

`<leader>ag` commits the current draft, backlog file, proposal, or `PRIORITIES.md`, with the message
the web UI writes, after saving it.

Why this priority: drafts are written over several sessions, and the messages should not drift.

Acceptance scenarios:

1. **Given** `specs/drafts/codex-runtime.md` and its `PRIORITIES.md` link not committed, **When**
   the human presses `<leader>ag` in the draft, **Then** both are committed as
   `chore: draft Codex runtime`.
2. **Given** a committed proposal edited, **When** the human presses `<leader>ag`, **Then** the
   commit is `chore(nvim-plugin): edit the proposal`.
3. **Given** `spec.md`, **When** the human presses `<leader>ag`, **Then** the error
   `Only drafts, backlog files, proposals, and PRIORITIES.md are committed from the editor.` shows.

### US8: Find what waits, and move between items (P2)

`<leader>aw`, from any buffer, lists the workflow files waiting for the human in every checkout,
each with its feature and the first line of its block, in the snacks picker with a preview of the
file. In a file, `]u` and `[u` jump to the next and previous question in a round of questions, or
the next and previous comment in a spec, plan, or assessment under review.

Why this priority: it saves opening the web UI to know what waits.

Acceptance scenarios:

1. **Given** a feature `2026-10-14-codex-runtime` whose `clarifications-01.md` waits for the human,
   its block opening with `7 questions, about 25 minutes.`, and nothing else waiting, **When** the
   human presses `<leader>aw`, **Then** the picker shows one item,
   `codex-runtime · clarifications-01.md · 7 questions, about 25 minutes.`, and confirming opens the
   file from its worktree.
2. **Given** a round with Q1, Q1.A, Q2, the cursor on Q1's context, **When** the human presses `]u`
   twice, **Then** the cursor is on `### Q1.A`, then on `## Q2`.
3. **Given** a spec with comments on lines 12 and 50, the cursor on line 20, **When** the human
   presses `]u`, **Then** the cursor is on line 50.

### US9: See comments next to their lines (P3)

In a spec, plan, or assessment with a pending review, each comment shows as virtual lines under the
last line it is about, with its number and text. `<leader>at` hides or shows them.

Why this priority: reviewing reads better with comments in place, but US4 works without it.

Acceptance scenarios:

1. **Given** C1 on lines 50 to 52 with the text `Rename this field`, **When** the spec opens,
   **Then** under line 52 a virtual line reads `▎ C1  Rename this field`.
2. **Given** that, **When** the human presses `<leader>at`, **Then** the virtual lines disappear,
   and come back on the next press.
3. **Given** a comment added with US4, **When** the window closes, **Then** its virtual lines show
   at once.

## Edge cases

- **`ura` is not on the path**: the server does not start, and `:checkhealth uraeda` says
  `ura not found on PATH`. Keys under the prefix are not set, since no client attaches.
- **`ura` older than the plugin**: `:checkhealth uraeda` reports the version found and the version
  needed; `ura lsp` fails with `unrecognized subcommand 'lsp'`, shown as an error once.
- **A file under `specs/` that is not a workflow file**, like a mockup's `.md`: the server attaches,
  reports no diagnostics, and lists only its headings.
- **A buffer with unsaved changes**: actions that read the file on disk save it first (`:update`);
  the comment action refuses instead, as in US4, since saving would not make it committed.
- **A buffer written by an action**, like `PRIORITIES.md` after a draft, or a spec after approval:
  it is reloaded (`:checktime`).
- **A commit's hook fails**: the action's error shows the hook's message, as `ura` does, and files
  written before the commit stay, as with `ura`.
- **A second action while one runs**: the server runs one write at a time; the second waits.
- **`PRIORITIES.md` changed on disk since it was opened**: drafting refuses with
  `PRIORITIES.md changed on disk. Nothing was drafted.`, the core's conflict message.
- **The draft's buffer after a start**: the file has moved to the proposal, so its buffer is wiped
  once the proposal opens; unsaved changes in it were saved before the start.
- **Neovim older than 0.11**: the plugin does nothing, and `:checkhealth uraeda` says
  `Neovim 0.11 or later is required`.
- **Diagnostics with no line**, like a missing section: they show on line 1.
- **No snacks.nvim**: the waiting picker uses `vim.ui.select`, without a preview.
- **The prefix set to `false`**: no keys are set; commands and `<Plug>` mappings remain.

## Success criteria

- **SC-001**: A change in a buffer shows its diagnostics within 300 ms, on the example's `spec.md`.
- **SC-002**: Every action of US2 to US9 runs from one key under the prefix, from a `:Uraeda`
  subcommand with completion, and from a `<Plug>` mapping.
- **SC-003**: No Lua file of the plugin reads a workflow file's text to find a field, a question, a
  comment, or a line: every such fact comes from the server.
- **SC-004**: `vp run ready` runs StyLua's check and the plugin's tests, and fails when either
  fails.
- **SC-005**: The release `ura`'s size before and after the server is measured, and the growth is
  stated in the pull request.

## Design

### Approach

A language server in Rust, as the human chose
([Q1](clarifications-01.md#q1-how-does-the-plugin-reach-the-workflow-logic)), reached as `ura lsp`,
holds every rule and every action: it reads the open buffers' text, so diagnostics and edits work
before saving, and it calls the core's functions, the same ones the web UI calls through the binding
([`api.rs`](/crates/core/src/api.rs)). It is built on `lsp-server`, the smallest crate, synchronous
like the core ([Rust language server crates](discovery-01.md#rust-language-server-crates)).

Standard requests give every editor diagnostics, completion, symbols, and code actions that edit the
buffer. Actions that write other files or commit are `workspace/executeCommand` commands, run only
when the user asks, and reads that standard requests do not cover are custom `uraeda/*` requests.
The Lua plugin holds what the protocol leaves to editors: keys, pickers, the comment and verdict
windows, inline comments, and opening the files an action produced
([plugins over a tool's logic](discovery-01.md#plugins-over-a-tools-logic)).

It lives in [`editors/nvim/`](discovery-01.md#where-the-plugin-lives), loaded with a lazy.nvim `dir`
spec, and follows Neovim's plugin conventions: one `:Uraeda` command, `<Plug>` mappings, no
`setup()` required ([plugin conventions](discovery-01.md#plugin-conventions)).

### Data

Nothing stored changes: workflow files keep their format. The data is the protocol between the
server and the plugin, with 1-based line numbers inside `uraeda/*` messages, as in workflow files,
and 0-based positions in standard LSP messages.

**Fields** of the core, made public for the server: for each file kind, its fields and their allowed
values, and who sets each value, from the [workflow status](/skills/uraeda/SKILL.md#workflow-status)
table, kept in one place in [`check/values.rs`](/crates/core/src/check/values.rs) so `ura check` and
the server cannot disagree.

```rust
pub struct Field {
    pub name: String,          // "status"
    pub line: Option<u32>,     // 1-based; None when the field is missing
    pub value: Option<String>, // as written, without a trailing comment
    pub kind: FieldKind,       // Choice, Integer, Boolean, Date, Text
    pub values: Vec<Choice>,   // empty unless Choice or Boolean
}
pub struct Choice {
    pub value: String,         // "approved"
    pub action: Option<Action>,// Some for values the human sets by an action
}
pub enum Action { Approve, RequestChanges, Submit }
```

**Custom requests**, answered from the open text when the file is open, else from disk:

| Method            | Params    | Result                                                                                |
| ----------------- | --------- | ------------------------------------------------------------------------------------- |
| `uraeda/fields`   | `{ uri }` | `Field[]`                                                                             |
| `uraeda/items`    | `{ uri }` | `{ kind: "question" \| "comment", label, line, endLine }[]`, in file order            |
| `uraeda/comments` | `{ uri }` | `{ number, line?, endLine?, text }[]` of the pending review, `line` absent if general |
| `uraeda/verdict`  | `{ uri }` | `{ file, kind, commit message, comments, riskTier?, planReview?, blank: string[] }`   |
| `uraeda/waiting`  | `{}`      | `{ feature, file, path, line }[]`: every checkout's files waiting on the human        |

**Commands** (`workspace/executeCommand`), each answering with the paths it wrote, to reload or
open:

| Command                 | Arguments                                      | Core function                      |
| ----------------------- | ---------------------------------------------- | ---------------------------------- |
| `uraeda.draft`          | `{ uri, line }`                                | `create_draft`, by the line's id   |
| `uraeda.start`          | `{ uri }`                                      | `start_feature`                    |
| `uraeda.comment`        | `{ uri, line?, endLine?, text }`               | `add_comment`                      |
| `uraeda.editComment`    | `{ uri, number, text }`; empty text removes it | `edit_comment`, `remove_comment`   |
| `uraeda.approve`        | `{ uri, summary?, riskTier?, planReview? }`    | `approve`                          |
| `uraeda.requestChanges` | `{ uri, summary? }`                            | `request_changes`                  |
| `uraeda.submit`         | `{ uri }`                                      | `submit_answers`                   |
| `uraeda.commit`         | `{ uri }`                                      | `commit_text`, `commit_priorities` |

Results are `{ opened?: path, written: path[] }`, absolute paths. Errors are LSP errors whose
message is the core's, with the core's code (`refused`, `conflict`, `hook`) in `data`.

**Flow**: the plugin saves the buffer when the action reads it, sends the command, shows a
notification replaced in place while the server reports `$/progress`, then reloads `written` and
opens `opened`.

### Components

- **Fields** ([`crates/core/src/check/values.rs`](/crates/core/src/check/values.rs)): the table
  above, public, used by `check` and the server. `frontmatter::set` keeps a trailing comment, which
  also fixes the [web UI's regex](/packages/web/src/discovery.ts) case for the server; the web UI is
  left as it is.
- **Check of a text** ([`crates/core/src/check/mod.rs`](/crates/core/src/check/mod.rs)): a variant
  of `check` that takes one file's text in place of its file on disk, reading the rest of the folder
  from disk, so diagnostics follow the buffer.
- **Language server** (`crates/lsp/`, new crate `uraeda-lsp`): the protocol loop on `lsp-server`,
  the open documents, and one module per capability: diagnostics, completion, symbols, code actions,
  custom requests, and commands. Commands run on a worker thread, one at a time, reporting
  `$/progress`, so the loop keeps answering. It depends on the core only.
- **`ura lsp`** ([`crates/cli/src/main.rs`](/crates/cli/src/main.rs)): runs the server over stdio.
- **Plugin entry** (`editors/nvim/plugin/uraeda.lua`, `editors/nvim/lsp/uraeda.lua`): defines
  `:Uraeda` and the `<Plug>` mappings, and enables the `uraeda` LSP config, whose `root_dir`
  attaches to markdown files under a `specs/` folder holding `PRIORITIES.md`, unless
  `vim.g.uraeda.lsp` is `false`. Nothing is required until a command runs.
- **Client** (`editors/nvim/lua/uraeda/client.lua`): finds the buffer's `uraeda` client, sends
  requests and commands, saves and reloads buffers, and shows progress and errors.
- **Actions** (`editors/nvim/lua/uraeda/actions.lua`): one function per story's action, used by the
  command, the `<Plug>` mapping, and the key.
- **Pickers** (`editors/nvim/lua/uraeda/pickers.lua`): the field and value pickers through
  `vim.ui.select` with the kinds `uraeda_field` and `uraeda_value`, and the waiting picker as a
  snacks source with a file preview, or `vim.ui.select` without snacks.
- **Comment window** (`editors/nvim/lua/uraeda/comment.lua`): the float of US4, a scratch markdown
  buffer, saved with `:w` or `Ctrl-s`.
- **Verdict window** (`editors/nvim/lua/uraeda/verdict.lua`): the float of US6, read from
  `uraeda/verdict`, with the border in `UraedaVerdictBorder`, linked to `DiagnosticWarn`.
- **Inline comments and jumps** (`editors/nvim/lua/uraeda/marks.lua`): virtual lines in the `uraeda`
  namespace from `uraeda/comments`, in `UraedaComment`, linked to `DiagnosticInfo`, and `]u` and
  `[u` over `uraeda/items`.
- **Keys** (`editors/nvim/lua/uraeda/keys.lua`): on `LspAttach` of a `uraeda` client, buffer-local
  keys under `vim.g.uraeda.prefix`, default `<leader>a`: `n` draft, `p` start, `m` comment (normal
  and visual), `e` field, `v` verdict, `g` commit, `t` inline comments, with descriptions starting
  with `Uraeda`. `<leader>aw`, the waiting picker, is global. None collides with LazyVim's AI keys
  under `<leader>a` (`a`, `b`, `c`, `C`, `d`, `f`, `r`, `s`).
- **Health** (`editors/nvim/lua/uraeda/health.lua`): Neovim's version, `ura` and `git` on the path,
  and `ura`'s version against the one the plugin needs.
- **Docs** (`editors/nvim/doc/uraeda.txt`, [`README.md`](/README.md)): the lazy.nvim spec, the
  options, commands, keys, and highlight groups.
- **Skill** ([`skills/uraeda/SKILL.md`](/skills/uraeda/SKILL.md)): `ura lsp` in the CLI table, as
  the [CLI decision](../decisions/cli.md) requires.
- **Toolchain** ([`flake.nix`](/flake.nix), [`package.json`](/package.json),
  [`vite.config.ts`](/vite.config.ts)): Neovim, StyLua, and mini.test in the dev shell, StyLua's
  check and the tests in `vp run ready`, and `*.lua` staged files formatted with StyLua.

Options, all in `vim.g.uraeda`, validated with `vim.validate`:

```lua
vim.g.uraeda = {
  prefix = "<leader>a", -- false sets no keys
  lsp = true,           -- false: the plugin does not enable the server
  cmd = { "ura", "lsp" },
  inline_comments = true,
}
```

The lazy.nvim spec, in the README and the vimdoc:

```lua
{ dir = "~/Development/ai/uraeda/editors/nvim", name = "uraeda.nvim" }
```

### Mockups

- [Neovim screens](mockups/nvim.html): the `<leader>a` menu in a spec, the field and value pickers,
  the comment window, inline comments, the verdict window for a spec and for a round, the waiting
  picker, and an error.

### Error handling

- Every core error reaches the user as `vim.notify` at the error level, titled `Uraeda`, with the
  core's message as it is, like `PRIORITIES.md changed on disk. Nothing was drafted.`
- A hook failure shows the hook's output in the notification, and the files written before it stay,
  as with `ura`.
- An action in a buffer without a `uraeda` client: `This file is not a Uraeda workflow file.`
- A command the server does not know, from an older `ura`:
  `ura is older than the plugin: run ura upgrade.`
- The server never exits on a malformed file: a parse failure is a diagnostic.

### Testing

Rust integration tests drive the server through `lsp-server`'s in-memory connection, on a temporary
git repository built from the [`fixtures/`](/fixtures/) files, with the date set by the test as the
core's tests do. Plugin tests use mini.test: a child Neovim loads the plugin, runs the real
`ura lsp` built by cargo on such a repository, and drives it with keys, checking buffers, files,
commits, and screenshots of the windows.

| What                                          | Test                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| US1.1, US1.2, US1.3, SC-001                   | Server: diagnostics after a change, completion, symbols                                       |
| US1.4, US1.5                                  | Plugin: attaching by path, one client per checkout                                            |
| US2.1–3, the conflict edge case               | Server: `uraeda.draft`; plugin: the key on a line                                             |
| US3.1–2, the draft buffer edge case           | Plugin: start from a draft, commits and the opened proposal                                   |
| US4.1–5                                       | Server: comment commands and refusals; plugin: the comment window                             |
| US5.1–4                                       | Server: fields, code actions; plugin: pickers with `vim.ui.select` stubbed                    |
| US6.1–4                                       | Server: `uraeda/verdict`, approve, request changes, submit; plugin: verdict window screenshot |
| US7.1–3                                       | Server: `uraeda.commit`                                                                       |
| US8.1–3                                       | Server: `uraeda/waiting`, `uraeda/items`; plugin: picker and jumps                            |
| US9.1–3                                       | Plugin: virtual lines and the toggle, screenshot                                              |
| Unsaved buffer, reload, hook failure          | Plugin: save before, `:checktime` after, notification on a failing hook                       |
| `ura` missing or old, Neovim too old          | Plugin: `:checkhealth uraeda` output                                                          |
| Diagnostics without a line, non-workflow file | Server: table-driven over fixture files                                                       |
| Allowed values                                | Core: table-driven, one row per file kind and field                                           |
| SC-002                                        | Plugin: every action has a key, a subcommand, and a `<Plug>` mapping                          |
| SC-003                                        | Review: the plan's final review reads every Lua module                                        |
| SC-004                                        | `vp run ready` in CI                                                                          |
| SC-005                                        | The release build's size, before and after, in the pull request                               |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human), as they stand with
a language server:

- One `:Uraeda` command holds every action as a subcommand with completion, each also a `<Plug>`
  mapping and a Lua function, with no `setup()` required and options in `vim.g.uraeda`.
- Pickers go through `vim.ui.select`, reaching snacks in LazyVim; the waiting picker is a snacks
  source with previews when snacks is installed.
- The field picker lists the current file's fields, then the allowed values with the current one
  marked; numbers are typed in a prompt.
- Drafting takes the cursor's line by its position, through the core's line ids, not by matching its
  text.
- The new feature's slug is the one `ura start` chooses, without a prompt.
- Comments are offered on files waiting for the human, on the cursor line or the selection, and
  refused when the buffer differs from its committed version. Editing and removing reuse the same
  window, which changes from the clarifications' "open the review file", since the server reaches
  the core's edit and remove functions.
- The server runs per checkout, so files in `.worktrees/` act on their branch; buffers are saved
  before an action reads them, and reloaded after it writes.
- Actions run in the background, with a notification replaced in place while hooks run.
- `:checkhealth uraeda` checks `ura`, `git`, and versions.
- Neovim 0.11 is the minimum.
- Rendering stays with render-markdown.nvim.
- The stack decision gets the editor rules, and the skill documents `ura lsp`.
- The `BlockedBenchmarks` listing bug of `ura draft` is fixed on the way.
- Changed by Q1: `ura` gains a dependency, `lsp-server` with `lsp-types`, measured at about 263 KB
  alone; the plan measures the real binary.

Settled while writing this spec:

- Your answer to Q1.A, edits in the buffer, holds with the server: picked values reach the buffer as
  LSP edits, undoable.
- Diagnostics are errors, as `ura check` fails on them; a problem without a line shows on line 1.
- Code actions only set frontmatter values. Drafting, starting, and commenting are commands, so no
  quick fix writes another file or commits: the stack change's rule.
- The verdict window, not the field picker, is where verdicts happen: picking a human status in the
  picker opens it, so both paths look the same
  ([Q2](clarifications-01.md#q2-what-does-picking-a-human-status-do)).
- The commit action covers the files the core can commit with a message today, drafts, backlog
  files, proposals, and `PRIORITIES.md`; other edits are committed with git.
- Keys inside a workflow file are buffer-local, so the `<leader>a` menu shows Uraeda's keys only
  where they apply, as `:help lua-plugin` advises; the waiting picker is global, to reach it from
  anywhere.
- `]u` and `[u` are free in LazyVim's and Neovim's default keys.
- mini.test comes from nixpkgs in the dev shell, pinned by `flake.lock`, so tests need no network.
- The comment window opens over the commented lines, not in a split, as commentry and review.nvim do
  ([Q6](clarifications-01.md#q6-how-do-you-type-a-review-comment)).
- After a start, the proposal opens in the current window, and Neovim's folder stays where it was
  ([Q7](clarifications-01.md#q7-what-does-neovim-do-after-a-draft-becomes-a-proposal)).

## Decisions

Changed, applied when this spec is approved:

- [Stack](../decisions/stack.md): editors reach the workflow through `ura lsp`, in `crates/lsp` on
  `lsp-server`; editor plugins live in `editors/` and never parse workflow files; code actions only
  edit the open document. See its
  [proposed change](../decisions/stack.md#proposed-change-2026-10-13-nvim-plugin).

Relied on:

- [CLI](../decisions/cli.md): `ura lsp` is documented in the skill, every rule the server reports is
  a rule of `ura check`, and the new dependency's size is measured.
- [Git](../decisions/git.md): the server writes through the core's git module, with the user's
  hooks, in the worktree that has the branch, never switching the checkout.
- [Toolchain](../decisions/toolchain.md): StyLua and the plugin's tests join `vp run ready` and the
  dev shell.

## Constitution check

| Principle                            | Complies | Notes                                                                                       |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | Verdicts and starts run only from explicit keys or commands, never from a quick fix         |
| II. Git and plain text first         | yes      | The plugin edits workflow files as text; nothing is stored outside the repository           |
| III. Asynchronous by default         | yes      | Each action ends on disk or in a commit, like the CLI's                                     |
| IV. Review effort matches impact     | yes      | The verdict window shows the commit and its effects before it is made                       |
| V. Tools are optional                | yes      | Every action stays doable by hand and with `ura`; the server reports only the skill's rules |
| VI. Code is checked against the spec | yes      | Every scenario has a test; the new crate is justified in the plan's complexity tracking     |

## Risk tier

**High**: a new long-running service, a new language and test toolchain, and a new crate that
commits on the user's behalf.
