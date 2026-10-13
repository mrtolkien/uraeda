---
kind: feature
finished: 2026-10-13
pull-request: https://github.com/mrtolkien/uraeda/pull/9
---

# Record: Nvim plugin

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-13, finished on
> 2026-10-13, in [its pull request](https://github.com/mrtolkien/uraeda/pull/9). Its full files are
> in git: `git log -- specs/2026-10-13-nvim-plugin/`.

## What and why

A Neovim plugin to edit workflow files and do what the web UI does: draft a `PRIORITIES.md` line,
start a draft as a feature, comment on lines of a spec, and pick frontmatter values, with LazyVim's
pickers and leader menu. Neovim is the human's main editor; they also use the web UI, and the plugin
is a second way in, not a replacement. Agents stay out of it: it is about editing files. It became a
language server, `ura lsp`, so every editor can get the same rules, with a thin Lua plugin for keys,
pickers, and windows.

## Behaviour

- US1, the language server: markdown files under a `specs/` folder holding `PRIORITIES.md` attach
  `ura lsp`, one client per checkout (a worktree is its own root); other markdown files never do.
  Diagnostics are `ura check`'s rules on the unsaved text, as errors, a problem without a line on
  line 1; frontmatter values complete from the allowed ones, replacing the whole value but not a
  trailing comment; the outline names questions, stories, tasks, and comments by their id (`Q1.A`,
  `US1`, `Task 3`, `C1`). In `PRIORITIES.md`, the sections are symbols and each linked entry ends
  with an inlay hint, its step and who it waits on, or `draft`.
- US2, draft a line: `<leader>an` in `PRIORITIES.md` saves the buffer, drafts the cursor's line by
  its position as `ura draft` does, and opens the draft, not committed; a line already linked opens
  its draft. Refused outside the default branch's checkout.
- US3, start: `<leader>ap` in a draft or a backlog file starts the feature as `ura start` does, with
  a progress notification, opens the new `proposal.md` from its worktree in the current window, and
  deletes the draft's buffer without force. Refused outside the default branch's checkout.
- US4, comment: `<leader>am`, on a line or a selection of a spec, plan, or assessment waiting for
  the human, opens a floating markdown window over the lines; `:w` or `Ctrl-s` adds the comment
  uncommitted, `q` or `Esc` cancels. On lines with a comment it edits it, and saving it empty
  removes it. The server refuses before the window opens when the file is not waiting, or differs
  from its last commit.
- US5, pick a value: `<leader>ae` lists the file's fields, then the allowed values with the current
  one marked; numbers and text are typed. The edit is the server's, in the buffer, unsaved, undoable
  with `u`, keeping a trailing comment. A value set by a verdict opens the verdict window instead.
  Code actions on a field's line offer the same edits, and never one that commits.
- US6, verdicts: `<leader>av` asks Approve or Request changes, then opens the verdict window, a
  float with its own border colour showing the commit it will make, the comments, a spec's risk tier
  and plan review (`Tab` cycles them), and a summary; `Ctrl-s` saves and commits, `q` cancels. On a
  round of questions it submits the answers, and says which questions are blank. It refuses a file
  not waiting before the window opens, a round that is not the latest, requesting changes without a
  comment, and a file changed on disk since it was opened.
- US7, commit: `<leader>ag` saves and commits a draft, backlog file, proposal, or `PRIORITIES.md`
  with the web UI's messages; other files are refused, and so is any of them outside the default
  branch's checkout.
- US8, what waits: `<leader>aw`, global, lists the files waiting on the human in every checkout of
  the current repository, in snacks.picker with a preview or `vim.ui.select`, and says
  `Nothing waits on you.` when empty; `]u` and `[u` jump between the questions of a round or the
  comments of a pending review, through the jumplist.
- US9, inline comments: a pending review's comments show as virtual lines under their last line,
  `▎ C1  <text>`, redrawn after a comment, a save, or a verdict; `<leader>at` toggles them per
  buffer, and `inline_comments = false` starts them hidden.
- Every action is a `:Uraeda` subcommand, a `<Plug>(uraeda-<name>)` mapping, and a key; keys are
  buffer-local under `vim.g.uraeda.prefix` (default `<leader>a`, `false` sets none), set when a
  `uraeda` client attaches. Core errors show as they are, titled `Uraeda`; a failed command reloads
  the files it wrote; an `ura` without `lsp` is said once:
  `ura is older than the plugin: run ura upgrade.`

## Design

A synchronous language server on `lsp-server` holds every rule and every action: it reads the open
buffers' text and calls only the core, the same functions the web UI reaches through the binding.
Standard requests give diagnostics, completion, symbols, inlay hints, and code actions that edit the
open buffer; actions that write another file or commit are `workspace/executeCommand` commands run
on a worker thread, one at a time, with `$/progress`; reads the protocol lacks are `uraeda/*`
requests. The Lua plugin only holds keys, pickers, windows, and reloading, and never parses a
workflow file.

- The core: fields and their allowed values, public, in
  [`check/values.rs`](/crates/core/src/check/values.rs); a check of one file's text in
  [`check/mod.rs`](/crates/core/src/check/mod.rs); the outline of a file in
  [`files/outline.rs`](/crates/core/src/files/outline.rs); `waiting` and `priority_links` in
  [`api.rs`](/crates/core/src/api.rs); `frontmatter::set` keeping a trailing comment.
- The server, `uraeda-lsp` in [`crates/lsp/`](/crates/lsp/src/lib.rs), run by `ura lsp`
  ([`main.rs`](/crates/cli/src/main.rs)): the loop and worker in
  [`server.rs`](/crates/lsp/src/server.rs), open texts in
  [`documents.rs`](/crates/lsp/src/documents.rs),
  [`diagnostics.rs`](/crates/lsp/src/diagnostics.rs),
  [`completion.rs`](/crates/lsp/src/completion.rs), [`symbols.rs`](/crates/lsp/src/symbols.rs),
  [`hints.rs`](/crates/lsp/src/hints.rs), code actions and `uraeda/setField` in
  [`actions.rs`](/crates/lsp/src/actions.rs), the reads in
  [`requests.rs`](/crates/lsp/src/requests.rs), and the commands with their refusals in
  [`commands.rs`](/crates/lsp/src/commands.rs).
- The plugin, in [`editors/nvim/`](/editors/nvim/README.md): the entry in
  [`plugin/uraeda.lua`](/editors/nvim/plugin/uraeda.lua) and the LSP config in
  [`lsp/uraeda.lua`](/editors/nvim/lsp/uraeda.lua); one registry of actions, each with its key,
  subcommand, and mapping, in [`actions.lua`](/editors/nvim/lua/uraeda/actions.lua) and
  [`keys.lua`](/editors/nvim/lua/uraeda/keys.lua); requests, saving, reloading, progress, and errors
  in [`client.lua`](/editors/nvim/lua/uraeda/client.lua);
  [`pickers.lua`](/editors/nvim/lua/uraeda/pickers.lua),
  [`comment.lua`](/editors/nvim/lua/uraeda/comment.lua),
  [`verdict.lua`](/editors/nvim/lua/uraeda/verdict.lua), inline comments and jumps in
  [`marks.lua`](/editors/nvim/lua/uraeda/marks.lua), and
  [`health.lua`](/editors/nvim/lua/uraeda/health.lua); the help in
  [`doc/uraeda.txt`](/editors/nvim/doc/uraeda.txt).
- Checks: Neovim, StyLua, and mini.test in the dev shell ([`flake.nix`](/flake.nix)), StyLua's check
  and `vp run test:nvim` in `vp run ready` ([`package.json`](/package.json)), mini.test tests with
  screenshots in [`editors/nvim/tests/`](/editors/nvim/tests/), and server tests in
  [`crates/lsp/tests/`](/crates/lsp/tests/).

## Questions

### Round 01

#### Q1: How does the plugin reach the workflow logic?

**Answer:** B: a `ura lsp` language server, with a thin Lua layer for pickers and input windows.

#### Q2: What does picking a human status do?

**Answer:** A, a human status runs the same action as `ura`: "We should have an 'approve spec'
action that does it. It should look and feel different from other actions that simply edit a field."

#### Q3: What does the first version include beyond the four actions?

**Answer:** A and C: diagnostics, a picker of what waits, jumps between items, and comments shown
next to their lines, "with the decision to go in the direction of an LSP, it shouldn't be that bad
to add all those? Tell me if it's too complex."

#### Q4: Who commits the edits the plugin does not commit itself?

**Answer:** A: a plugin action commits the current workflow file with the web UI's message.

#### Q5: Where does the plugin live?

**Answer:** A: in `editors/nvim/`, loaded with `dir`, "we might review that once there's more users
but let's start with the simple path".

#### Q6: How do you type a review comment?

**Answer:** A: a floating markdown buffer over the selected lines, saved with `:w` or `Ctrl-s`.

#### Q7: What does Neovim do after a draft becomes a proposal?

**Answer:** A: the new `proposal.md` opens from the worktree, in the current window.

#### Q8: Which leader prefix holds the actions?

**Answer:** "Add the actions to `<leader>a` which is currently the ai menu in lazyvim", with
`<leader>au` on too many collisions, and an easy way to change the prefix.

#### Q9: How is the plugin's code checked?

**Answer:** A: StyLua for formatting, and mini.test for tests, with Neovim and StyLua in the dev
shell.

## Decisions

- [Stack](../decisions/stack.md), changed: editors reach the workflow through `ura lsp`, in
  `crates/lsp` on `lsp-server` and `lsp-types` without an async runtime; editor plugins live in
  `editors/<editor>/` and never parse workflow files; completions and code actions only edit the
  open document, and actions that write or commit are explicit commands.

## Changes after approval

- Spec review C1: `PRIORITIES.md` gets an inlay hint per linked entry, its step and who it waits on,
  or `draft`, and its sections as symbols.
- Spec review C2: the plugin is a second way in, next to the web UI the human also uses.
- The spec's refusal texts are the server's, checked before the core, whose own messages differ;
  submitting another file than a round is refused (R7).
- Picked and typed values both go through a new `uraeda/setField` request, which refuses a value set
  by a verdict; the picker lists only the fields the file has (R12).
- The comment window asks a new `uraeda/canComment` request before it opens (R13).
- The waiting picker starts a server attached to no buffer when none runs, and `]u`/`[u` are
  registry entries with their own `lhs`, outside the prefix (R15).
- Inline comments redraw by folder, and `inline_comments = false` only hides them until toggled
  (R16).
- A round is submitted only from its own buffer, when it waits and is the latest (R18).
- Drafting, starting, and committing drafts or the priorities are refused outside the default
  branch's checkout, naming the checkout to use (R19).
- A server exiting before its initialization is an older `ura`, said once (R20).
- The verdict window refuses a file not waiting before it opens (R21).
- A verdict is refused when the open text differs from the disk (R22).
- The waiting picker asks the current repository's server, not the first one running (R23).
- A failed command lists the files it wrote in its error, and the plugin reloads them (R24).
- A completed value replaces the whole value, up to a trailing comment (R25).

## Follow-ups

- Inlay hints read the whole workspace on the server's main loop: cache them per text version, or
  move them to the worker.
- Hints show the core's raw step names, like `human-gate · waits on you`.
- A quick double save in the comment window can add the comment twice, and the window's buffer stays
  'modified'.
- `vim.lsp.inlay_hint.enable` on every `uraeda` attach also turns on other servers' hints in
  workflow buffers.
- The worker's shutdown comment overstates its safety: Neovim may kill the server during a slow hook
  on `:qa`.
- A verdict checks the spec's buffer but not an unsaved `spec-review.md` buffer, so the commit can
  keep older comment text than shown.
- `<leader>aw` exists only after a `uraeda` client attached once in the session.
- A hook failure's notification shows the hook's output twice.
- The release binary grew about 420 KB, 8.7%, with `ura lsp` (R2).
- Moving a `PRIORITIES.md` line between sections, "set priority", was left out of scope.
