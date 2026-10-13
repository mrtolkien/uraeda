---
status: awaiting-human
---

# Clarifications, round 01: Nvim plugin

> [!IMPORTANT]
>
> 10 questions on the Neovim plugin, about 35 minutes.
>
> - Two choices last beyond this feature: how the plugin reaches the workflow logic, which becomes a
>   rule of the stack decision for every editor plugin, and where the plugin lives in the
>   repository.
> - The proposal reads as editor work only, but `ura` cannot do half of it today: drafting the
>   cursor line, reading a file's allowed values, and committing a draft need new flags and
>   commands.
> - Picking a status like `approved` can either edit the line or approve the spec, with its commit:
>   the proposal does not say which.
> - Three questions work together on what the first version holds: what goes beyond the four
>   actions, who commits plain edits, and how a frontmatter change reaches the file.
> - Fourteen points are settled without you, at the end: check them.

## Context

The [proposal](proposal.md) asks for a Neovim plugin that does in your editor what the web UI does:
turn a `PRIORITIES.md` line into a draft, a draft into a proposal, comment on a spec line, and edit
frontmatter with a picker, using LazyVim's pickers and leader menu, and leaving agents out.

Your setup runs Neovim 0.12.5 and LazyVim 16.0.1, with snacks.picker as the only picker and the
markdown extra on. `ura` already starts features ([`start.rs`](/crates/core/src/actions/start.rs))
and adds review comments ([`review.rs`](/crates/core/src/actions/review.rs)), but its write commands
print text only, it drafts a line only by matching its text
([`draft.rs`](/crates/core/src/actions/draft.rs)), and no command lists or sets frontmatter values
([`values.rs`](/crates/core/src/check/values.rs)). The web UI reaches a richer API through the napi
binding ([`api.rs`](/crates/core/src/api.rs)), which Lua cannot load.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: How does the plugin reach the workflow logic?

The [stack decision](../decisions/stack.md) puts parsing, validation, and workflow states in the
Rust core, and forbids TypeScript from reimplementing them; it says nothing of Lua. zk-nvim is a
thin client over the `zk lsp` language server, octo.nvim and nvim-lint run a command and parse its
output, and obsidian.nvim does everything in Lua. More in
[discovery](discovery-01.md#reaching-the-workflow-logic).

Why it matters: it sets the Rust work of this feature, whether other editors benefit, and becomes a
rule of the stack decision for every editor plugin after this one.

- **A (recommended). The plugin is Lua for the editor side (pickers, windows, keys) and runs `ura`
  for every read and write, with JSON output; `ura` gains what it lacks: drafting by line, JSON on
  `draft`, `start`, and `review`, and a read of a file's fields and allowed values. A language
  server can come later, as its own feature.**
  - [pro] small Rust work, no new dependency, and the same additions serve the planned `ura` TUIs.
  - [con] `ura` writes on disk: actions save the buffer first, and are undone with git, not `u`.
  - Why recommended: it delivers the four actions soonest, within the stack decision, and leaves the
    language server open.
- **B. A `ura lsp` language server, with a thin Lua layer for pickers and input windows: diagnostics
  while typing, completion of frontmatter values, and actions as code actions and commands.**
  - [pro] Helix, VS Code, and Zed get the same features; edits land in the buffer, undoable.
  - [con] the largest Rust work by far, and about 263 KB more in the binary.
- **C. The plugin parses workflow files in Lua, without `ura`.**
  - [pro] the most responsive, all in the buffer, no Rust work.
  - [con] a second parser that drifts from the core's rules, which the stack decision's intent
    forbids: it needs your explicit exception.

**Answer:**

### Q1.A: How does a frontmatter change reach the file?

Only if you picked A in Q1. The core's own setter replaces the whole line, dropping a comment like
`discovery: high # low, medium, or high`. More in [discovery](discovery-01.md#frontmatter-edits).

- **A (recommended). `ura` reads the buffer's text on stdin and returns each field, its line, and
  its allowed values; the plugin replaces that one line in the buffer, keeping its comment, and you
  save.**
  - [pro] undoable with `u`, works on unsaved buffers, and Lua never parses the file.
  - [con] the change is unsaved until you save it.
  - Why recommended: it edits like any other edit in your editor.
- **B. A new `ura set <file> <field> <value>` writes the file on disk; the plugin saves the buffer
  first and reloads it after.**
  - [pro] the same command serves the TUIs and scripts.
  - [con] undone only by editing again, and a buffer is saved without you asking.

**Answer:**

## Q2: What does picking a human status do?

Humans set `answered` on a round, and `approved` or `changes-requested` on a spec, plan, or
assessment. `ura answer --submit` and `ura review --approve` do more than edit the line: they record
the `> [!IMPORTANT]` block, write the review's verdict, and commit with the skill's message
([workflow status](/skills/uraeda/SKILL.md#workflow-status)). Editing the line alone is allowed: the
next step records the block. More in [discovery](discovery-01.md#human-statuses).

Why it matters: it decides whether approving from Neovim is one action, or an edit plus a commit you
write.

- **A (recommended). Picking a human status runs the same action as `ura`: `answered` submits the
  round, `approved` and `changes-requested` record the verdict, ask for the risk tier on a spec, and
  commit. Other fields edit the line.**
  - [pro] the same result as the web UI and the CLI, with the right commit message.
  - [con] picking a value commits, unlike every other field in the picker.
  - Why recommended: approving is what you mean when you pick `approved`.
- **B. Picking any value edits the line only; you commit.**
  - [pro] the picker does one thing for every field.
  - [con] the block stays until the next step records it, and the commit message is yours to write.
- **C. Statuses stay out of the picker; approving and submitting are their own actions.**
  - [pro] no picker value commits.
  - [con] two ways to look at the same field.

**Answer:**

## Q3: What does the first version include beyond the four actions?

Similar plugins show validation as diagnostics, list items in a picker, and jump between them, and
the web UI shows review comments next to their lines. More in
[discovery](discovery-01.md#scope-beyond-the-four-actions) and
[what they have in common](discovery-01.md#what-they-have-in-common).

Why it matters: it sets the size of the feature.

- **A (recommended). The four actions, plus `ura check` problems as diagnostics on save, a picker of
  the workflow files waiting on you, and keys to jump between questions and between comments.**
  - [pro] the daily loop, find what waits, answer it, check it, stays in Neovim; no more Rust work.
  - [con] about a third more Lua than the four actions alone.
  - Why recommended: the additions reuse `ura status` and `ura check` as they are.
- **B. The four actions only.**
  - [pro] the smallest feature.
  - [con] finding what waits on you stays in the web UI or the CLI.
- **C. A, plus existing comments shown next to the spec lines they point at.**
  - [pro] reviewing in Neovim looks like reviewing on GitHub.
  - [con] `ura` must expose each comment's lines, and the display must follow edits.

**Answer:**

## Q4: Who commits the edits the plugin does not commit itself?

`ura draft` writes a draft without committing it, and an edited field is a plain edit. The web UI
commits these with the skill's messages, `chore: draft <title>` or
`chore(<slug>): edit the proposal`, through the core; the CLI has no command for it. With A in Q2,
statuses commit through their action whatever the answer here. More in
[discovery](discovery-01.md#commits-of-plain-edits).

Why it matters: it decides whether your workflow commits read like the web UI's.

- **A (recommended). A plugin action commits the current workflow file with the message the web UI
  writes, through a new `ura commit <file>` command.**
  - [pro] the same messages from every tool, and one key in Neovim.
  - [con] one more command to add to `ura` and the skill.
  - Why recommended: the core already computes the messages; the command only exposes them.
- **B. You commit with your own git tools, writing the messages yourself.**
  - [pro] no new command.
  - [con] the skill's messages are written by hand, and drift.

**Answer:**

## Q5: Where does the plugin live?

lazy.nvim installs a plugin from a repository's root, and its author declined a subfolder option.
Unison ships its Vim plugin from a subfolder, with a runtimepath workaround in its docs; zk-nvim is
a separate repository. Locally, `dir = "~/Development/ai/uraeda/editors/nvim"` works with any
layout. More in [discovery](discovery-01.md#where-the-plugin-lives).

Why it matters: it sets how you and others install it, and whether the plugin and `ura` change in
the same commit.

- **A (recommended). In `editors/nvim/` in this repository; you load it with `dir`, and the README
  gives the runtimepath spec for others.**
  - [pro] a plugin change and the `ura` change it needs land together; one new folder.
  - [con] installing from GitHub needs a workaround spec, which some users report failing.
  - Why recommended: you run `ura` from this checkout anyway, and a mirror can come once others ask.
- **B. `lua/`, `plugin/`, and `doc/` at this repository's root, installed as `mrtolkien/uraeda`.**
  - [pro] a plain lazy.nvim install.
  - [con] three editor folders at the root of a Rust and TypeScript monorepo.
- **C. A separate repository, `uraeda.nvim`.**
  - [pro] the cleanest install, with version tags.
  - [con] keeping it in step with `ura` by hand, in two pull requests.

**Answer:**

## Q6: How do you type a review comment?

octo.nvim, commentry, review.nvim, and codereview.nvim all open a floating multiline buffer, saved
with `:w` or `Ctrl-s`; `vim.ui.input` is one line, styled by snacks. More in
[discovery](discovery-01.md#comment-input).

Why it matters: comments are often several lines, with a quote or a list.

- **A (recommended). A floating markdown buffer over the selected lines: `:w` or `Ctrl-s` adds the
  comment, `q` or `Esc` cancels.**
  - [pro] full Neovim editing, multiline.
  - [con] a small window to build.
  - Why recommended: it is what every review plugin converged on.
- **B. A one-line `vim.ui.input` prompt.**
  - [pro] the least code.
  - [con] one line per comment.

**Answer:**

## Q7: What does Neovim do after a draft becomes a proposal?

`ura start` commits on `main`, creates the branch and its worktree, `.worktrees/<folder>/`, and
commits the proposal there. LazyVim finds a buffer's root from its path, so a file opened from the
worktree gets pickers rooted there. More in [discovery](discovery-01.md#after-a-start).

Why it matters: your session either stays where it was, or moves to the new feature.

- **A (recommended). Open the new `proposal.md` from the worktree, in the current window.**
  - [pro] nothing else changes; pickers follow the buffer.
  - [con] the terminal's folder stays the main checkout.
  - Why recommended: you see the result at once, without leaving your session.
- **B. Open it in a new tab whose folder is the worktree.**
  - [pro] one tab per feature.
  - [con] tabs to manage.
- **C. A notification only.**
  - [pro] no window changes.
  - [con] you open the proposal yourself.

**Answer:**

## Q8: Which leader prefix holds the actions?

In your setup, `h`, `j`, `k`, `m`, `o`, `r`, `v`, `z` and most capitals are free. LazyVim's overseer
extra claims `o` and its refactoring extra claims `r`, both off here. The plugin ships `<Plug>`
mappings and a ready-made lazy.nvim spec with a which-key group, so the prefix is a default you can
change. More in [discovery](discovery-01.md#leader-prefix).

Why it matters: it is the key you will press every day.

- **A (recommended). `<leader>U`, "Uraeda".**
  - [pro] free in LazyVim and its extras, and easy to remember.
  - [con] shifted.
  - Why recommended: no extra you enable later takes it.
- **B. `<leader>j`.**
  - [pro] unshifted, free in LazyVim and its extras.
  - [con] nothing to remember it by.
- **C. Another key you name.**
  - [pro] yours.
  - [con] none.

**Answer:**

## Q9: How is the plugin's code checked?

The [toolchain decision](../decisions/toolchain.md) requires every new language's checks in
`vp run ready`, inside the Nix dev shell, which has no Neovim or Lua tools today. The plugin
guidelines recommend busted run through nlua; mini.test runs a child Neovim and compares
screenshots, suited to pickers and windows. More in [discovery](discovery-01.md#lua-toolchain).

Why it matters: it adds tools to the dev shell and to CI.

C can come on top of A or B.

- **A (recommended). StyLua for formatting, and mini.test for tests, with Neovim and StyLua added to
  the dev shell.**
  - [pro] two tools, and tests that drive real windows and keys.
  - [con] mini.test is fetched or vendored for the tests.
  - Why recommended: the fewest dependencies for tests that cover the UI.
- **B. StyLua, and busted run through nlua, with LuaRocks.**
  - [pro] the community's recommended setup.
  - [con] LuaRocks, busted, and nlua in the dev shell, and UI tests by hand.
- **C. lua-language-server type checks of the annotations.**
  - [pro] catches type errors before the tests.
  - [con] one more tool, and slower checks.

**Answer:**

## Settled without the human

- **One `:Uraeda` command** holds every action as a subcommand with completion, each also a `<Plug>`
  mapping and a Lua function, with no `setup()` required and options in `vim.g.uraeda`, as Neovim's
  plugin guide recommends. See [discovery](discovery-01.md#plugin-conventions).
- **Pickers** go through `vim.ui.select`, which reaches snacks.picker, fzf-lua, or telescope in
  every LazyVim setup, with a `kind` you can style; with A or C in Q3, the files waiting on you also
  get a snacks source with previews when snacks is installed. See
  [discovery](discovery-01.md#lazyvim).
- **The frontmatter picker** lists the current file's fields, then the allowed values with the
  current one marked; numbers like `revision` are typed in a prompt. See
  [discovery](discovery-01.md#important-reads).
- **Drafting** takes the cursor's line in `PRIORITIES.md` by its line number, through a new
  `ura draft --line` flag rather than matching its text, then opens the draft. With C in Q1, Lua
  finds the line itself. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The new feature's slug** is the one `ura start` chooses, without a prompt, as the CLI does. See
  [discovery](discovery-01.md#important-reads).
- **Comments** are offered on a spec, plan, or assessment waiting on you, on the cursor line or the
  visual selection, and refused with a message when the buffer differs from its committed version,
  since their lines point at that version. Editing or removing one opens the review file. See
  [discovery](discovery-01.md#comments-on-a-changed-file).
- **`ura` runs from the buffer's own folder**, so files in `.worktrees/` resolve to their branch,
  after saving the buffer it reads, and buffers of the files it wrote are reloaded. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Actions run in the background**, with a notification replaced in place while hooks run, and
  `ura`'s error message shown as it is. See [discovery](discovery-01.md#git-plugins).
- **`:checkhealth uraeda`** checks that `ura` and `git` are on the path and that `ura` is recent
  enough. See [discovery](discovery-01.md#plugin-conventions).
- **Neovim 0.11** is the minimum, LazyVim's own. See
  [discovery](discovery-01.md#neovim-011-and-012).
- **Rendering** stays with render-markdown.nvim, which already draws the callouts; typed bullets
  stay plain text. See [discovery](discovery-01.md#lazyvim).
- **The stack decision** gets a proposed rule for editor plugins, following your answer to Q1, and
  the skill documents every new flag and command, as the [CLI decision](../decisions/cli.md)
  requires. See [discovery](discovery-01.md#likely-changes).
- **No dependency is added to `ura`** with A in Q1, so its size does not change. See
  [discovery](discovery-01.md#rust-language-server-crates).
- **The `BlockedBenchmarks` listing bug** of `ura draft` is fixed on the way, since drafting by line
  touches the same code. See [discovery](discovery-01.md#important-reads).

**Notes:**
