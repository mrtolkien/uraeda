# Discovery, round 01: Nvim plugin

## Summary

Editor plugins for file-based workflows (obsidian.nvim, zk-nvim, telekasten, mkdnflow, orgmode)
share a shape: one command with subcommands, actions on the cursor line or a visual selection that
create a new file, a picker to jump between items, a fast way to change an item's state, and
validation shown as diagnostics. Review plugins (octo.nvim, review.nvim, commentry, codereview.nvim)
take comments on a line range in a floating multiline buffer. They differ most on how they reach
their tool's logic: zk-nvim is a thin client over the `zk lsp` server, obsidian.nvim does everything
in Lua with an in-process language server, and octo.nvim and nvim-lint run a command-line tool and
parse its output.

The [proposal](proposal.md) asks for four actions in Neovim, the human's main editor: a
`PRIORITIES.md` line to a draft, a draft to a proposal, a comment on a spec line, and frontmatter
edits with a picker, fitting LazyVim's pickers and leader menu. It leaves agents out.

`ura` already performs three of the four actions, but its write commands print text only, it cannot
draft the line under the cursor, comments point at the committed version of a file, and no command
lists or sets frontmatter values. The richer API the web UI uses lives in the napi binding, out of a
Lua plugin's reach. The [stack decision](../decisions/stack.md) puts parsing and workflow states in
the Rust core, which rules out a plugin that parses workflow files in Lua without a human ruling.

## How other products do it

### obsidian.nvim

- One `:Obsidian` command with subcommands and completion; some only appear inside a note or in
  visual mode. `extract_note` turns the visual selection into a new note and links to it, and
  `link_new` uses the selection as a title
  ([README](https://github.com/obsidian-nvim/obsidian.nvim),
  [Commands wiki](https://github.com/obsidian-nvim/obsidian.nvim/wiki/Commands)).
- Pickers: telescope, fzf-lua, mini.pick, or snacks.picker, chosen with `picker.name`, autodetected
  otherwise, with a `vim.ui.select` fallback (`lua/obsidian/picker/` in the repository).
- Frontmatter: only `id`, `aliases`, and `tags` are managed; other fields "are left untouched and
  treated as metadata". There is no command or picker to edit a field
  ([Frontmatter wiki](https://github.com/obsidian-nvim/obsidian.nvim/wiki/Frontmatter)).
- Checkbox states cycle through a configurable `order`
  ([Checkbox wiki](https://github.com/obsidian-nvim/obsidian.nvim/wiki/Checkbox)).
- Completion, code actions (`gra`), and rename run through an in-process language server; user
  autocmds (`ObsidianNoteCreate`, `ObsidianNoteWritePost`) let users chain behaviour
  ([Autocmds wiki](https://github.com/obsidian-nvim/obsidian.nvim/wiki/Autocmds)).
- `:checkhealth obsidian`, and Neovim 0.11 or later.

### zk-nvim

- A "thin Lua friendly layer around `zk`'s LSP API": it starts `zk lsp` for markdown buffers inside
  a notebook, and adds commands (`:ZkNew`, `:ZkNotes`) and a Lua API
  ([README](https://github.com/zk-org/zk-nvim)). The language server lives in the `zk` binary, with
  custom commands like `zk.new` that create files
  ([zk editor integration](https://github.com/zk-org/zk/blob/main/docs/tips/editors-integration.md)).
- `:'<,'>ZkNewFromTitleSelection` makes a note from the selection, and replaces it with a link.
- Pickers: telescope, fzf, fzf-lua, mini.pick, snacks.picker, or `select` (`vim.ui.select`, the
  default). It "will not add any key mappings for you": the README gives `<leader>z` examples.
- It lives in its own repository, apart from `zk`.

### telekasten.nvim and mkdnflow.nvim

- telekasten: one `:Telekasten <sub-command>` command and a command palette, templates with
  `{{date}}` placeholders, and telescope required
  ([README](https://github.com/nvim-telekasten/telekasten.nvim)).
- mkdnflow: creates a link and its file from the text under the cursor or the selection, by default
  lowercased and prefixed with today's date, like Uraeda's dated folders. To-do statuses are named,
  with a configurable `status_order` to cycle through
  ([README](https://github.com/jakewvincent/mkdnflow.nvim)).

### nvim-orgmode and neorg

- orgmode captures text into a target file through a capture window, finalized with `<C-c>` and
  killed with `<Leader>ok`. `cit` and `ciT` cycle a heading's TODO state forward and back, or open a
  fast-access prompt with one key per state
  ([configuration](https://nvim-orgmode.github.io/configuration)).
- neorg cycles task states with `<C-Space>` and sets one directly with `<LocalLeader>t` keys, every
  action exposed as a `<Plug>` mapping
  ([Todo items wiki](https://github.com/nvim-neorg/neorg/wiki/Todo-Items)).

### taskwiki

- `:TaskWikiMod` prompts for a field change on the cursor line or the selection, with pick-lists of
  existing values: the closest analogue to editing a field with a picker
  ([README](https://github.com/tbabej/taskwiki)).

### Review comment plugins

| Plugin                                                                   | How the text is entered                                                   | Where comments go                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [octo.nvim](https://github.com/pwntester/octo.nvim)                      | A buffer, saved with `:w` to send it; normal or visual mode for a range   | GitHub, through `gh`                                                     |
| [review.nvim](https://github.com/georgeguimaraes/review.nvim)            | A popup: `Ctrl-s` submits, `Esc` cancels, `Tab` cycles the comment's type | A store per repository, exported as Markdown                             |
| [commentry.nvim](https://github.com/corymhall/commentry.nvim)            | "a floating multiline editor": `Ctrl-s` saves, `q` or `Esc` cancels       | A JSON file, exported as "deterministic markdown"                        |
| [codereview.nvim](https://github.com/MaraniMatias/codereview.nvim)       | A floating note editor saved with `:w`; `]n` and `[n` jump between notes  | A Markdown file with the file, the lines, and the note as a quote        |
| [meow.review.nvim](https://luarocks.org/modules/retran/meow.review.nvim) | Not documented                                                            | Extmarks track positions, and flag a comment stale when the code changes |

None of them uses `vim.ui.input` for a comment body: it is one line. jj.nvim offers both, a message
buffer or `vim.ui.input`, as an option ([README](https://github.com/NicolasGB/jj.nvim)).

### Git plugins

- Neogit edits commit messages in a buffer, and shows a console for slow commands, like hooks, after
  `console_timeout` (2 seconds by default), closed automatically on success. It fires
  `NeogitCommitComplete` and similar user events, and autodetects telescope, fzf-lua, mini.pick, or
  snacks, with a `vim.ui.select` fallback ([README](https://github.com/NeogitOrg/neogit)).
- git-worktree.nvim creates and switches worktrees, with a hook to update the current buffer on a
  switch, not registered by default ([README](https://github.com/polarmutex/git-worktree.nvim)).
- Progress: snacks.notifier replaces a notification sent with the same `id`
  ([notifier docs](https://github.com/folke/snacks.nvim/blob/main/docs/notifier.md)); Neovim 0.12
  adds progress messages to `nvim_echo()` ([news 0.12](https://neovim.io/doc/user/news-0.12/)).

### Plugins over a tool's logic

| Plugin                                                                                                                | How it reaches the tool                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| zk-nvim                                                                                                               | The tool's own language server, `zk lsp`                                                                                      |
| [typos-lsp](https://github.com/tekumara/typos-lsp)                                                                    | A language server written to give the `typos` CLI's diagnostics and fixes to every editor                                     |
| [markdown-oxide](https://github.com/Feel-ix-343/markdown-oxide), [marksman](https://github.com/artempyanykh/marksman) | Standalone markdown language servers, configured with `vim.lsp.config`                                                        |
| obsidian.nvim                                                                                                         | All in Lua, with an in-process language server                                                                                |
| [rustaceanvim](https://github.com/mrcjkb/rustaceanvim)                                                                | rust-analyzer's extension commands behind one `:RustLsp` command, configured without `setup()`                                |
| octo.nvim, [gh.nvim](https://github.com/ldelossa/gh.nvim)                                                             | The `gh` CLI                                                                                                                  |
| [nvim-lint](https://github.com/mfussenegger/nvim-lint)                                                                | Runs linters, parses their output (`vim.json.decode` for JSON), and sets `vim.diagnostic`; deliberately not a language server |

### What they have in common

Capabilities users of these plugins may expect, whether or not the proposal mentions them:

- One command with subcommands and completion, some only in a matching buffer or in visual mode
- Every action as a command, a `<Plug>` mapping, and a Lua function; default keymaps only
  buffer-local, or left to the user
- A picker that follows the user's choice, with a `vim.ui.select` fallback
- `:checkhealth`, checking the external tools and their versions
- Actions on a range: a selection becomes a new file
- A floating or real buffer for multiline input, `vim.ui.input` for one line
- Cycling or directly setting an item's state
- Jumping between items (questions, comments), and sending them to quickfix
- Validation shown as diagnostics, on save or live
- User events after each action
- Async commands with visible progress, and a console for slow hooks
- Statusline data
- Comments that stay anchored when the file changes
- Vimdoc, type annotations, a formatter, and headless tests

## Standards and libraries

### Neovim 0.11 and 0.12

The human runs Neovim 0.12.5 (`nvim --version`), and LazyVim needs 0.11.2 or later
([LazyVim NEWS](https://github.com/LazyVim/LazyVim/blob/main/NEWS.md)).

- `vim.system(cmd, opts, on_exit)` runs a process without a shell, asynchronously when `on_exit` is
  given, with `cwd`, `env`, `stdin`, and `timeout`. API calls from its callback need
  `vim.schedule_wrap()` ([lua docs](https://neovim.io/doc/user/lua/)).
- `vim.ui.select(items, {prompt, format_item, kind}, on_choice)` and `vim.ui.input` are meant to be
  replaced by picker plugins; `on_choice(nil)` is a cancel (same page).
- `vim.fs.root(source, marker)` finds the nearest folder holding a marker, like `specs/` (same
  page).
- `vim.diagnostic.set` needs a named namespace; items have `lnum`, `col`, `severity`, `message`,
  `source`; `setqflist` and `vim.diagnostic.jump` work on them
  ([diagnostic docs](https://neovim.io/doc/user/diagnostic/)).
- `vim.lsp.config()` and `vim.lsp.enable()` configure servers natively since 0.11, from
  `lsp/<name>.lua` files on the runtimepath; `cmd` may be a Lua function for an in-process server
  ([lsp docs](https://neovim.io/doc/user/lsp/), local `news-0.11.txt`).
- Neovim applies `workspace/applyEdit` and code-action edits into buffers with `nvim_buf_set_text`,
  so they stay unsaved and undoable (local runtime, `lua/vim/lsp/util.lua`).
- `vim.pack`, built in since 0.12, has no subfolder field, but `vim.pack.add(specs, {load = ...})`
  lets the caller load a plugin as it likes ([pack docs](https://neovim.io/doc/user/pack/)).

### Plugin conventions

From `:help lua-plugin` (local 0.12.5 runtime, [online](https://neovim.io/doc/user/lua-plugin/)) and
[nvim-best-practices](https://github.com/nvim-neorocks/nvim-best-practices):

- One scoped command with subcommands, each with its own completion, rather than many commands.
- No keymaps created automatically, except buffer-local ones for a filetype; `<Plug>` mappings and
  Lua functions for users to map.
- No `setup()` required: a small `plugin/<name>.lua` that does not `require` eagerly, configuration
  in a `vim.g` table, validated with `vim.validate`.
- `lua/<plugin>/health.lua` for `:checkhealth`, vimdoc, LuaCATS annotations, SemVer.
- Tests with busted run under Neovim through [nlua](https://github.com/mfussenegger/nlua), rather
  than plenary, which bundles a limited luassert.

### LazyVim

Read in the human's config, `~/.config/nvim`, and LazyVim's sources (16.0.1, installed under
`~/.local/share/nvim/lazy/LazyVim`):

- snacks.picker is the only picker installed: no picker extra is enabled, `vim.g.lazyvim_picker` is
  `auto`, and LazyVim's default order puts snacks first for this config
  ([`config/init.lua`](https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/init.lua)).
- `LazyVim.pick` maps generic names like `files` to the active picker, for LazyVim's own code and
  extras only
  ([`util/pick.lua`](https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/util/pick.lua)).
- `vim.ui.select` reaches the active picker in all three LazyVim setups: snacks sets it with
  `ui_select = true` by default, the fzf extra registers fzf-lua's, and the telescope extra goes
  through dressing.nvim
  ([snacks picker docs](https://github.com/folke/snacks.nvim/blob/main/docs/picker.md),
  `extras/editor/fzf.lua`, `extras/editor/telescope.lua`).
- snacks' `vim.ui.select` honours `format_item` and `kind`, and users style each `kind` through
  `picker.sources.select.kinds`; it has no file preview. A plugin wanting previews registers its own
  snacks source, as todo-comments does with `Snacks.picker.sources.todo_comments = ...`
  ([todo-comments config](https://github.com/folke/todo-comments.nvim/blob/main/lua/todo-comments/config.lua)).
- Keymaps go in the lazy.nvim `keys` spec, which users extend or disable; groups are declared with
  which-key v3's spec, `{ "<leader>U", group = "uraeda" }`, as the overseer extra does
  ([LazyVim plugins](https://www.lazyvim.org/configuration/plugins),
  [which-key](https://github.com/folke/which-key.nvim)).
- Free leader prefixes in the human's setup, from a dump of the 222 normal-mode `<leader>` mappings:
  `h`, `j`, `k`, `m`, `o`, `r`, `v`, `z` and most capitals, `U` among them. `o` is claimed by
  LazyVim's overseer extra, off here. `<localleader>` is `\`, unused in markdown.
- The `lang.markdown` extra is on: render-markdown.nvim already renders GitHub callouts like
  `> [!IMPORTANT]`
  ([render-markdown](https://github.com/MeanderingProgrammer/render-markdown.nvim)); typed bullets
  like `- [pro]` would need its `checkbox.custom`, documented with one-character states only.
- The human formats with stylua at 2 spaces and 120 columns (`~/.config/nvim/stylua.toml`), and
  markdown through `vp`'s oxfmt (`lua/plugins/extend-conform.lua`).

### Installing a plugin from a subfolder

- lazy.nvim installs a plugin from a repository's root: its author declined a subfolder field
  ([#183](https://github.com/folke/lazy.nvim/issues/183),
  [#756](https://github.com/folke/lazy.nvim/issues/756)). The documented workaround appends the
  subfolder to the runtimepath in `config`, plus a `packadd` to source its `plugin/` folder; some
  users report it failing ([#1319](https://github.com/folke/lazy.nvim/issues/1319)).
- Unison ships its plugin this way, from `editor-support/vim`, with that spec in its official docs
  ([Unison editor setup](https://www.unison-lang.org/docs/usage-topics/editor-setup)). vim-plug has
  a native `rtp` option for it ([vim-plug](https://github.com/junegunn/vim-plug)).
- `dir = "~/Development/ai/uraeda/editors/nvim"` loads a local subfolder directly
  ([lazy.nvim spec](https://lazy.folke.io/spec)).
- A separate repository, like zk-nvim, gives lazy.nvim clean version tags.

### Rust language server crates

Measured in a scratch crate with the repository's release profile (`opt-level = "z"`, LTO, one
codegen unit, stripped), against a 333 KB serde_json baseline:

- `lsp-server` 0.10.0 with `lsp-types` 0.97, the synchronous crate rust-analyzer uses: about +263
  KB, 20 crates ([crates.io](https://crates.io/api/v1/crates/lsp-server/0.10.0/dependencies)).
- `tower-lsp-server` 0.23.0 with tokio: about +1.26 MB, 55 crates
  ([crates.io](https://crates.io/api/v1/crates/tower-lsp-server/0.23.0/dependencies)).
- Today's release `ura` is 4.9 MB, and has no tokio. Inside `ura` the real growth would be smaller,
  since serde is shared: the [CLI decision](../decisions/cli.md) asks for a measurement on the real
  binary.

## The code

### Important reads

- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs): the commands. `status`, `next`, and `check`
  have `--json`; `draft`, `start`, `review`, and `answer` print text only, like
  `C1 added to specs/…/spec-review.md, on lines 12–13, under "…".`
- [`crates/cli/src/terminal.rs`](/crates/cli/src/terminal.rs): a TUI or `$EDITOR` opens only when
  stdin and stdout are terminals. A process started by `vim.system` never gets one.
- [`crates/core/src/actions/draft.rs`](/crates/core/src/actions/draft.rs): `ura draft <text>`
  matches a `PRIORITIES.md` line by a case-insensitive substring of its text, writes
  `specs/drafts/<slug>.md` on the default branch's checkout, links the line, and does not commit.
  `draft::create(place, id)` takes a line id like `next-2`, but only the binding exposes it.
- [`crates/core/src/actions/start.rs`](/crates/core/src/actions/start.rs): `ura start` commits the
  `PRIORITIES.md` move on the default branch, creates the branch and its worktree, and commits the
  proposal there: two commits, with the user's hooks.
- [`crates/core/src/actions/review.rs`](/crates/core/src/actions/review.rs):
  `ura review --comment 50-52 "text"` needs the file `awaiting-human`, refuses a line starting with
  `#`, and reads the lines from the file **as committed at the branch tip**, quoting them from
  there. It writes `spec-review.md` with `verdict: pending` and does not commit. `--approve` and
  `--request-changes` commit, record the `> [!IMPORTANT]` block, and set `risk-tier` and
  `plan-review` on a spec.
- [`crates/core/src/check/values.rs`](/crates/core/src/check/values.rs) and
  [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs): the fields of each file kind and
  their allowed values, in private functions. No command lists them or sets one.
- [`crates/core/src/files/frontmatter.rs`](/crates/core/src/files/frontmatter.rs): `parse` knows
  each field's line; `set` replaces the whole line, dropping a trailing comment like the proposal
  template's `discovery: high # low, medium, or high`.
- [`crates/core/src/files/document.rs`](/crates/core/src/files/document.rs) and
  [`items.rs`](/crates/core/src/files/items.rs): the document tree, with the source lines of every
  block, question, answer, and comment. Only the binding exposes it.
- [`crates/core/src/target.rs`](/crates/core/src/target.rs): a path target must be inside the
  current worktree: from the main checkout, a path under `.worktrees/` is "no feature or draft". Run
  from the file's own folder, it resolves.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs) and
  [`packages/binding/index.d.ts`](/packages/binding/index.d.ts): what the web UI uses, all through
  the binding: `createDraft` by line id, `addComment`, `editComment`, `removeComment`, `approve`,
  `startFeature`, `saveText` and `commitText` with hash guards against conflicts, and errors typed
  `refused`, `conflict`, or `hook`. `commitText` writes the messages `chore: draft <title>` and
  `chore(<slug>): edit the proposal`.
- [`packages/web/src/discovery.ts`](/packages/web/src/discovery.ts): the web UI changes the
  `discovery` field with a regular expression in TypeScript, keeping the comment: a precedent at
  odds with the stack decision, not a sanctioned pattern.
- `ura check --json`: `{"version": 1, "problems": [{"file", "line", "rule", "message"}]}`, `line`
  often `null`, no column, files on disk only; exit 1 when there are problems.
- `ura status --json`: features with their worktree, files, statuses, and step, and priorities with
  their section and position, but no source line.
- [`package.json`](/package.json) and [`flake.nix`](/flake.nix): `vp run ready` and the dev shell
  have nothing for Lua: no Neovim, StyLua, or Lua test runner.
- [`vite.config.ts`](/vite.config.ts): staged files other than Rust go to `vp check --fix`; Lua
  would need its own entry.
- Small bugs seen on the way, outside this feature: `ura draft` lists the Blocked section as
  `BlockedBenchmarks`, its padding being six characters ([`draft.rs`](/crates/cli/src/draft.rs)).

### The proposal's path and existing actions

- **A priorities line to a draft**: in `PRIORITIES.md`, on the line. Today `ura draft "<text>"`
  works if the text matches one line only; the plugin would pass the line's text, or the CLI would
  take a line. The draft lands on the default branch's checkout, which may not be the buffer's
  folder, and is not committed: the web UI commits it later with `chore: draft <title>`, the CLI
  cannot.
- **A draft to a proposal**: `ura start <draft>` works from any checkout, makes two commits and a
  worktree, and prints text. The plugin needs the new proposal's path to open it, and the commits
  run hooks that take seconds.
- **A comment on a spec line**: `ura review <spec> --comment N-M "text"` works without a terminal.
  Line numbers are those of the committed file: a buffer with unsaved or uncommitted changes shows
  other numbers. Editing or removing a comment exists in the core, not in the CLI; by hand, it is an
  edit of `spec-review.md`.
- **Frontmatter with a picker**: nothing exists. Setting a human status by hand is allowed by the
  skill, the next step recording the block, but the CLI's approve and answer actions also record the
  block, write the review, and commit with the right message
  ([workflow status](/skills/uraeda/SKILL.md#workflow-status)).
- **Undo**: a write by `ura` is on disk, outside the buffer's undo history; a commit is undone with
  git. An edit made in the buffer is undone with `u`.
- **Unsaved buffers**: `ura` reads the disk. An action on a modified buffer acts on its saved
  version unless the plugin saves it first.
- **Worktrees**: features live in `.worktrees/<branch>/`. The plugin must run `ura` from the
  buffer's folder, and reload buffers of files written elsewhere (`:checktime`).

### Other features in flight

- `2026-10-13-chat-in-the-web-ui` has only its proposal: chat sessions in the web UI. Its "see the
  actual message that goes with the commit" may add a way to preview commit messages in the core,
  which a plugin could reuse. No overlap in code yet.
- `fix/2026-10-13-flaky-tests` has no report yet.
- The [TUI draft](../drafts/cli-tuis.md) plans `ura` TUIs for drafting, reviewing, and answering:
  the same actions in a terminal, which would reuse the same CLI additions.

### Likely changes

- `editors/nvim/` or the repository root (`lua/`, `plugin/`, `doc/`), new: the plugin, with option A
  or B of [where the plugin lives](#where-the-plugin-lives); a separate repository with option C.
- [`crates/cli/`](/crates/cli/) and [`crates/core/`](/crates/core/): with option A or D of
  [reaching the workflow logic](#reaching-the-workflow-logic), drafting by line, JSON on `draft`,
  `start`, and `review`, a read of a file's fields and allowed values, and a way to commit a
  workflow file; with option B, a `ura lsp` command and its server module.
- [`skills/uraeda/SKILL.md`](/skills/uraeda/SKILL.md): every new command or flag, as the
  [CLI decision](../decisions/cli.md) requires, under options A, B, and D.
- [`package.json`](/package.json), [`flake.nix`](/flake.nix), [`vite.config.ts`](/vite.config.ts),
  [`.github/workflows/`](/.github/workflows/): Neovim, StyLua, and the Lua tests in `vp run ready`,
  under every option, as the [toolchain decision](../decisions/toolchain.md) requires.
- [`specs/decisions/stack.md`](../decisions/stack.md): a rule for editor plugins, under every
  option.
- [`AGENTS.md`](/AGENTS.md) and [`README.md`](/README.md): the new folder and how to install it.

## The proposal

### No CLI for half the actions

The proposal reads as editor work only ("this is just about file editing"), but drafting the cursor
line, opening the new proposal after a start, and listing frontmatter values need `ura` changes, or
logic in Lua that the stack decision forbids. See [important reads](#important-reads).

### "Edit frontmatter with a picker" and statuses

A picker that sets `status: approved` on a spec by editing the line skips what approving does today:
recording the block, writing the review's verdict, and committing. The proposal does not say whether
the picker edits text or performs the action.

### Comments on a changed file

Comment lines point at the committed file. The proposal does not say what happens when the buffer
differs.

### Commits

The proposal leaves agents out, not commits: two of its actions commit today (`ura start`, and
approving), one does not (`ura draft`), and nothing commits a draft or a frontmatter change.

### Where the plugin lives

LazyVim installs plugins from a repository's root, and this repository's root is a Rust and
TypeScript monorepo. The proposal does not say where the plugin lives or how it is installed.

### Beyond the four actions

Diagnostics from `ura check`, a picker of files waiting on the human, jumping between questions and
comments, and answering a round are what [similar plugins](#what-they-have-in-common) and the web UI
offer. The proposal lists four actions, with "similar to the web UI".

## Approaches

Criteria come from the [proposal](proposal.md) (LazyVim's pickers and leader menu, file editing
only), the [constitution](../CONSTITUTION.md) (II: plain text in git; V: tools optional, enforcing
only rules written in the skill; VI: tests for acceptance scenarios), and the active decisions:
[stack](../decisions/stack.md) (logic, parsing, and states in the Rust core),
[CLI](../decisions/cli.md) (rules in the skill, JSON reads, size measured),
[git](../decisions/git.md) (hooks, never switching the checkout), and
[toolchain](../decisions/toolchain.md) (every check in `vp run ready`).

### Reaching the workflow logic

How the plugin reads workflow files and performs actions. See
[plugins over a tool's logic](#plugins-over-a-tools-logic) and [important reads](#important-reads).

| Option                                 | Stack decision                      | Rust work                                                        | Lua work                         | Other editors                | Unsaved buffers and undo                               | Binary size  |
| -------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- | -------------------------------- | ---------------------------- | ------------------------------------------------------ | ------------ |
| A. Lua calls `ura`, JSON in and out    | Complies                            | Small: a few flags and two commands                              | Pickers, windows, async calls    | Each needs its own glue      | `ura` writes the disk: save first, reload, git to undo | None         |
| B. A `ura lsp` server, thin Lua on top | Complies                            | Large: document sync, diagnostics, completion, actions, commands | Small: pickers and input windows | Helix, VS Code, Zed for free | The server sees the buffer; edits are undoable         | About 263 KB |
| C. Lua parses the files itself         | Conflicts: parsing outside the core | None                                                             | Large: a second parser           | None                         | Best: all in the buffer                                | None         |
| D. A first, B later for live features  | Complies                            | Small now, large later                                           | Pickers now, less later          | Later                        | As A, then as B                                        | Later        |

Commits from a language server are side effects outside its edit model: the protocol applies an
action's edit, then runs its command
([LSP 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)).
Judgement: commits would stay behind explicit commands under B.

### Frontmatter edits

How a picked value reaches the file. Only with option A or D of
[reaching the workflow logic](#reaching-the-workflow-logic): under B, the server's edit lands in the
buffer.

| Option                                                                          | Stack decision                                           | Undo     | Unsaved changes | Rust work                                  |
| ------------------------------------------------------------------------------- | -------------------------------------------------------- | -------- | --------------- | ------------------------------------------ |
| A. `ura` reads the buffer's fields and values, Lua edits the line in the buffer | Complies: `ura` parses, Lua replaces a line it was given | `u`      | Kept            | A read command taking the text on stdin    |
| B. `ura set <file> <field> <value>` writes the disk                             | Complies                                                 | git only | Saved first     | A write command, keeping trailing comments |

### Human statuses

What picking a human status does: `answered`, `approved`, `changes-requested`. See
[statuses](#edit-frontmatter-with-a-picker-and-statuses).

| Option                                                   | Follows the skill                                | Commits | Effort                    |
| -------------------------------------------------------- | ------------------------------------------------ | ------- | ------------------------- |
| A. Run the action, `ura answer --submit` or `ura review` | Records the block, the review, the right message | Yes     | Small: the commands exist |
| B. Edit the line only                                    | Allowed; the next step records the block         | No      | None                      |
| C. Leave statuses out of the picker                      | Yes                                              | No      | None                      |

### Commits of plain edits

Who commits a new draft or a changed field. See [commits](#commits).

| Option                                                | Messages                            | Rust work                              |
| ----------------------------------------------------- | ----------------------------------- | -------------------------------------- |
| A. A plugin action, through a new `ura commit <file>` | The ones `ura` and the web UI write | A command over the core's `commitText` |
| B. The human, with their git tools                    | Written by hand                     | None                                   |

### Comment input

How the comment's text is typed. See [review comment plugins](#review-comment-plugins).

| Option                                            | Multiline | Familiar                                 | Effort |
| ------------------------------------------------- | --------- | ---------------------------------------- | ------ |
| A. A floating buffer, saved with `:w` or `Ctrl-s` | Yes       | octo, commentry, review.nvim, codereview | Medium |
| B. `vim.ui.input`                                 | No        | Styled by snacks                         | Small  |

### After a start

What Neovim does once `ura start` created the worktree. See [git plugins](#git-plugins).

| Option                                                             | Disrupts the session | Root of pickers                                             |
| ------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------- |
| A. Open the new `proposal.md`, nothing else                        | No                   | LazyVim's root detection finds the worktree from the buffer |
| B. Open it in a new tab, with the tab's folder set to the worktree | No, in a new tab     | The worktree                                                |
| C. Only a notification                                             | No                   | Unchanged                                                   |

### Where the plugin lives

See [installing a plugin from a subfolder](#installing-a-plugin-from-a-subfolder).

| Option                                                 | lazy.nvim install                                | Repository layout                       | Versions with `ura`  |
| ------------------------------------------------------ | ------------------------------------------------ | --------------------------------------- | -------------------- |
| A. `editors/nvim/` in this repository                  | `dir` locally; a runtimepath workaround remotely | One new folder                          | Same commit          |
| B. `lua/`, `plugin/`, `doc/` at this repository's root | Plain `mrtolkien/uraeda`                         | Three folders at the root of a monorepo | Same commit          |
| C. A separate repository                               | Plain, with version tags                         | Untouched                               | Kept in step by hand |

### Leader prefix

Which leader group holds the actions. See [LazyVim](#lazyvim).

| Option         | Free here                                                                        | Mnemonic | Speed     |
| -------------- | -------------------------------------------------------------------------------- | -------- | --------- |
| A. `<leader>U` | Yes                                                                              | Uraeda   | Shifted   |
| B. `<leader>j` | Yes                                                                              | None     | Unshifted |
| C. `<leader>r` | Yes, but LazyVim's refactoring extra claims it (`extras/editor/refactoring.lua`) | None     | Unshifted |

### Lua toolchain

How the plugin's code is checked in `vp run ready`. See [plugin conventions](#plugin-conventions).

| Option                                     | Dependencies in the dev shell                                | UI tests                  |
| ------------------------------------------ | ------------------------------------------------------------ | ------------------------- |
| A. StyLua and mini.test                    | Neovim, StyLua; mini.test as a test file fetched or vendored | Child Neovim, screenshots |
| B. StyLua and busted through nlua          | Neovim, StyLua, LuaRocks, busted, nlua                       | Possible, by hand         |
| C. Either, plus lua-language-server checks | Also lua-language-server                                     | Same                      |

### Scope beyond the four actions

What the first version includes. See [beyond the four actions](#beyond-the-four-actions).

| Option                                                                                                                      | Effort | Rust work                    |
| --------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------- |
| A. The four actions                                                                                                         | Small  | As above                     |
| B. Plus `ura check` diagnostics on save, a picker of files waiting on the human, and jumping between questions and comments | Medium | None more                    |
| C. B, plus existing comments shown next to the spec lines they point at                                                     | Large  | The comments' lines, in JSON |

### Needs no choice

- **One command with subcommands**, `:Uraeda <sub>` with completion, `<Plug>` mappings, and Lua
  functions: the conventions agree.
- **Picker**: `vim.ui.select` reaches the user's picker in every LazyVim setup, which is what the
  proposal asks; a snacks source adds previews when snacks is there.
- **`:checkhealth uraeda`**: checks `ura` and `git` are on the path, and `ura`'s version.
- **Actions on a range**: a comment takes the visual selection; a draft is one line.
- **Cycling a status**: a picker of the allowed values replaces cycling, with fewer keys to learn.
- **Async with progress**: `vim.system` and a notification replaced in place.
- **User events**: `User UraedaDone` style autocmds cost a line per action.
- **Statusline**, **anchored comments**, **rendering typed bullets**: none is asked for; comments
  are anchored by the committed lines `ura` quotes.
- **No `setup()` required**, `vim.g.uraeda` for configuration.

## Not checked

- render-markdown.nvim with a multi-character custom checkbox like `[pro]`: not documented, not
  tried.
- Whether oxfmt, through `vp check --fix`, touches `.lua` files.
- The real growth of the `ura` binary with `lsp-server`: measured in a scratch crate only.
- The lazy.nvim runtimepath workaround, not tried on this setup.
