# Discovery, round 01: CLI core features

## Summary

Workflow CLIs in this space fall into two families. Spec Kit's `specify` and OpenSpec install
templates and agent files, then mostly list, show, and validate (`--json` everywhere,
`--no-interactive` for agents). Backlog.md goes further: its CLI is the only sanctioned way to edit
task files, and it adds a Kanban TUI. None of them has a human review TUI with line comments: the
closest tools are plan annotators for Claude Code, like Plannotator, which send line-anchored
feedback back to the agent.

The [proposal](proposal.md) asks for five commands: `ura init`, `ura status` (with JSON),
`ura draft` (a PRIORITIES picker that creates a file and opens `$EDITOR`), `ura answer` (a TUI that
walks through the questions), and `ura review` (a TUI to approve, refuse, and comment on a line of a
spec or plan). It then asks for the skill to use the CLI for every workflow step, for a mock of a
coherent TUI, and for missing commands.

Today, `ura` has one temporary command, `ura status <folder>`, which reads the `status` field of the
clarifications, spec, and plan files of one folder in the working tree. The skill describes about
thirty mechanical operations that agents do by hand: finding the next step, starting and postponing
features, flipping review blocks into records, setting statuses, counters, and validating the
templates' structure. Most of them are deterministic, and none has a command yet. Three findings
shape the feature: features live on branches the working tree does not show, the constitution
requires the workflow to keep working without the CLI, and a "line" comment needs a markdown
renderer that knows which source lines it drew.

## How other products do it

### GitHub Spec Kit

- `specify init` scaffolds a project "from assets bundled inside the specify-cli package, so
  initialization does not need network access and templates match the installed CLI version"; it
  moved from downloading templates to bundling them in 0.4.0
  ([\_assets.py](https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/_assets.py),
  [CHANGELOG](https://raw.githubusercontent.com/github/spec-kit/main/CHANGELOG.md)).
- `init` takes `--here`, `--force` ("merge/overwrite"), `--integration <agent>`, and
  `--non-interactive`: "Never prompt … Required for agent harnesses that allocate a PTY but cannot
  send arrow-key input". In a non-empty folder without `--force`, it asks on a terminal and exits 1
  otherwise
  ([command_init.py](https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/command_init.py)).
- It writes each agent's files to its own folder (`.claude/skills`, `.agents/skills` for Codex,
  `.cursor/skills`, ...), records a SHA-256 hash per file, removes only unmodified files on
  uninstall, and refuses to upgrade over local edits without `--force`
  ([integrations](https://github.github.io/spec-kit/reference/integrations.html)).
- It has no review or approval command: `clarify` writes answers into the spec, under
  `## Clarifications`
  ([clarify.md](https://github.com/github/spec-kit/blob/main/templates/commands/clarify.md)).

### OpenSpec

- `init --tools`, `update`, `list --json`, `show --json --no-interactive`,
  `validate --all --strict --json`, `view` (a TUI dashboard), `status --json`, and
  `instructions <artifact> --json`, which hands the agent its next instructions
  ([cli.md](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md)).
- Commands that would prompt fail without a terminal: "archive exits 1 without changing anything and
  names the rerun command". Exit code 1 covers validation failures (same page).
- The human reviews by reading the files and asking for changes in chat; there is no comment format
  ([commands.md](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md)).

### Backlog.md

- A markdown task tracker in git with a CLI (`task create`, `task edit --check-ac`,
  `task list --plain|--json`), a Kanban TUI (`board`, where `E` opens `$EDITOR`), and a local web UI
  ([CLI-INSTRUCTIONS.md](https://raw.githubusercontent.com/MrLesk/Backlog.md/main/CLI-INSTRUCTIONS.md)).
- Re-running `init` "preserves existing config, allows updates" (same page).
- Its agent guidelines say "NEVER EDIT TASK FILES DIRECTLY. Edit Only via CLI"
  ([agent-guidelines.md](https://raw.githubusercontent.com/MrLesk/Backlog.md/main/src/guidelines/agent-guidelines.md));
  its README is softer: prefer the CLI "over hand-editing".

### Kiro

- Specs are driven from the agent chat or the IDE; `kiro-cli` has no spec command
  ([cli-commands](https://kiro.dev/docs/reference/cli-commands/)). The human confirms each phase,
  and edits `requirements.md` directly before asking for an update
  ([requirements-first](https://kiro.dev/docs/specs/feature-specs/requirements-first/)).

### Plan annotators: Plannotator, Ano, open-plan-annotator

- Plannotator hooks Claude Code's plan mode: the human annotates the plan, then approves or denies,
  and "structured feedback [is] sent to agent". Its export is markdown:
  `## 1. (lines 41–44) Feedback on: "<quoted original text>"` followed by `> <comment>`: a line
  range plus the quoted text
  ([README and `packages/ui/utils/parser.ts`](https://github.com/backnotprop/plannotator), read
  through the GitHub API).
- Its outcomes are `approved`, `approved-with-notes`, `denied`, and `feedback`. Approved with notes
  tells the agent: "The notes below are non-blocking guidance, not a request for another revision …
  Carry the notes into subsequent work"; denied says "You MUST revise … ALL of the feedback"
  (`packages/shared/prompts.ts`). Feedback is stored outside the repository, in a local JSONL file.
- Ano keeps annotations in a `plan.md.annotations.json` sidecar, anchored by line with two lines of
  context and a hash, re-anchored with fuzzy matching; only `blocker` annotations block, and
  `ano approve` records the approval ([Ano](https://github.com/vedpawar2254/Ano)).
- open-plan-annotator lets the human strike, replace, insert, or comment on selected text, then
  "Approve" or "Request Changes"
  ([README](https://cdn.jsdelivr.net/gh/ndom91/open-plan-annotator@main/README.md)).

### Code review tools

- **GitHub** has three review outcomes: Comment, Approve, and Request changes. Line comments stay
  pending until the review is submitted with one verdict and a summary
  ([about reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews)).
  The body is "Required when using REQUEST_CHANGES or COMMENT", optional with APPROVE
  ([REST reviews](https://docs.github.com/en/rest/pulls/reviews)).
- GitHub anchors a comment to `path`, `commit_id`, `line`, and `side`, keeps `originalLine` and the
  diff hunk, and marks it `outdated` when a later commit changes the line, instead of moving it
  ([REST comments](https://docs.github.com/en/rest/pulls/comments),
  [GraphQL schema](https://docs.github.com/public/fpt/schema.docs.graphql)). Threads can be
  resolved.
- **Gerrit** keeps votes apart from comments. Comments are unresolved by default and closed with
  "Done" or "Ack"
  ([review UI](https://gerrit-review.googlesource.com/Documentation/user-review-ui.html)); on a new
  patch set, it "tries to calculate the position of this comment on the new version", and falls back
  to a file-level comment
  ([porting](https://gerrit-review.googlesource.com/Documentation/user-porting-comments.html)).
- **Google's Critique**: LGTM and approval are hard requirements, unresolved comments soft ones; an
  approval can come with comments the author still addresses
  ([Software Engineering at Google, ch. 19](https://abseil.io/resources/swe-book/html/ch19.html)).
- **GitLab** offers Approve, Comment, and Request changes on submit, with an optional summary
  ([reviews](https://docs.gitlab.com/user/project/merge_requests/reviews/)).

### Terminal UIs

- **lazygit**: `j`/`k` for items, `h`/`l` for panels, `/` then `n`/`N` to search, `?` for the
  keybindings menu, `e` for the external editor, Esc to cancel, `q` to quit, and a bottom line "that
  contains keybinding info" (`gui.showBottomLine`)
  ([keybindings](https://raw.githubusercontent.com/jesseduffield/lazygit/master/docs/keybindings/Keybindings_en.md),
  [config](https://raw.githubusercontent.com/jesseduffield/lazygit/master/docs/Config.md)).
- **helix**: `hjkl`, Ctrl+D/U half pages, `gg` and `ge` for the start and end, `/` and `n`/`N`;
  pickers move with Ctrl+N/P or the arrows, Enter opens, Esc closes
  ([keymap](https://docs.helix-editor.com/keymap.html)).
- **yazi**, **gitui**, **gh-dash**, and **k9s** follow the same conventions: `j`/`k`, `g`/`G` for
  the top and bottom, `/` to search or filter, `?` or F1 for help, Esc to leave a mode, `q` to quit
  ([yazi](https://yazi-rs.github.io/docs/quick-start),
  [gitui](https://raw.githubusercontent.com/gitui-org/gitui/master/vim_style_key_config.ron),
  [gh-dash](https://www.gh-dash.dev/getting-started/keybindings/navigation/),
  [k9s](https://k9scli.io/topics/commands/)). gitui advertises "context based help (no need to
  memorize tons of hot-keys)" in a bottom bar.
- **atuin** shows its picker inline, `inline_height` lines tall, and a help row with the keymap mode
  ([config](https://docs.atuin.sh/latest/configuration/config/)).
- **Codex CLI** is a ratatui app (`openai/codex`, `codex-rs/tui`, read at commit `806d9732`): its
  own pulldown-cmark renderer, its own text area, about 195 insta snapshots. Its style guide keeps
  the terminal's colours: default foreground, `dim` for secondary text, bold key hints separated by
  `·`, and no hard-coded black, white, blue, or yellow (`codex-rs/tui/styles.md`).
- **Codex** inserts a newline with Ctrl+J, Shift+Enter, or Alt+Enter, and its footer shows
  Shift+Enter only when the terminal reports enhanced keys, Ctrl+J otherwise (`chat_composer.rs`).
  Ctrl+G opens the input in `$VISUAL` or `$EDITOR`, through a temporary `.md` file
  (`external_editor.rs`).
- **Claude Code**: Ctrl+G or Ctrl+X Ctrl+E opens the prompt in the editor; Shift+Enter works without
  setup in Ghostty, Kitty, iTerm2, WezTerm, foot, and Alacritty 0.16+, not in GNOME Terminal;
  "Ctrl+J, or type `\` and then press Enter … work in every terminal"
  ([interactive mode](https://code.claude.com/docs/en/interactive-mode),
  [terminal config](https://code.claude.com/docs/en/terminal-config)). Its screen reader mode drops
  the full-screen interface for plain linear text and numbered menus
  ([accessibility](https://code.claude.com/docs/en/accessibility)).

### The human's setup

- Neovim with **LazyVim** (`~/.config/nvim/lazyvim.json`) and the **catppuccin-mocha** colorscheme
  (`lua/plugins/colorscheme.lua`). The statusline is LazyVim's default lualine: section a is the
  mode, as a bold coloured block (blue in normal mode, green in insert, mauve in visual, peach in
  command), then the branch, the path, and on the right the position and a clock, with powerline
  separators (LazyVim's `plugins/ui.lua`;
  [lualine README](https://raw.githubusercontent.com/nvim-lualine/lualine.nvim/master/README.md)).
- Ghostty 1.3.1, with its default theme, and the binding `shift+enter=text:\n`: Shift+Enter sends a
  line feed, which crossterm reads as Ctrl+J in raw mode (`~/.config/ghostty/config`; crossterm 0.29
  `src/event/sys/unix/parse.rs`). No tmux; zellij 0.45 without a config.

### What they have in common

Capabilities users of these tools may expect, whether or not the proposal mentions them:

- Machine output (`--json`) on every read command, and a non-interactive path on every interactive
  one, failing with the flags to pass when there is no terminal.
- A validation command, usable in CI and pre-commit hooks, exiting 1 on errors.
- An `init` that is safe to re-run, and a way to install or update the agent instructions.
- A command that tells the agent what to do next (OpenSpec `instructions`, Backlog.md
  `instructions overview`).
- A review verdict kept apart from comments, with feedback required on a refusal and optional on an
  approval; comments anchored to a line and the quoted text; a record of how each was handled.
- In TUIs: `j`/`k`, `g`/`G`, `/` search, `?` help, Esc, `q`, a bottom bar with the keys of the
  current mode, and an external editor key.

## Standards and libraries

### Command-line conventions

- [clig.dev](https://clig.dev/): data to stdout and messages to stderr; exit 0 on success; `--json`
  for machines; "Only use prompts or interactive elements if `stdin` is an interactive terminal";
  `--no-input`; no colour when not a TTY, when `NO_COLOR` is set, or with `TERM=dumb`; "If you
  change state, tell the user"; confirm dangerous actions or require `--force`.
- [NO_COLOR](https://no-color.org/): no colour when the variable is set and non-empty.
- Stable machine output: `cargo metadata` has a top-level `"version": 1` and treats new fields as
  compatible ([cargo metadata](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html));
  Terraform asks consumers to ignore unknown properties and reject an unknown major version
  ([json format](https://developer.hashicorp.com/terraform/internals/json-format));
  `git status --porcelain` v1 is "guaranteed not to change in a backwards-incompatible way"
  ([git-status](https://git-scm.com/docs/git-status)).
- `git init` in an existing repository "will not overwrite things that are already there"
  ([git-init](https://git-scm.com/docs/git-init)); `cargo init` refuses an existing package
  ([cargo_new.rs](https://raw.githubusercontent.com/rust-lang/cargo/master/src/ops/cargo_new.rs)).

### ratatui and crossterm

- ratatui 0.30.2 (MSRV 1.88), with crossterm 0.29 re-exported as `ratatui::crossterm`
  ([crates.io](https://crates.io/api/v1/crates/ratatui),
  [ratatui-crossterm](https://raw.githubusercontent.com/ratatui/ratatui/main/ratatui-crossterm/Cargo.toml)).
- `ratatui::init()` enables raw mode, enters the alternate screen, and installs a panic hook that
  restores the terminal; it does not enable bracketed paste or keyboard enhancement
  ([init](https://docs.rs/ratatui/0.30.2/ratatui/fn.init.html)). `Viewport::Inline(n)` draws a
  picker under the prompt without the alternate screen, like atuin.
- The docs describe the Elm architecture (a model, messages, a pure `update`, a `view`) and a
  component architecture
  ([application patterns](https://ratatui.rs/concepts/application-patterns/)).
- Tests render into `TestBackend` and compare insta snapshots; snapshots hold text only, and
  `assert_buffer` compares styles too
  ([snapshot recipe](https://ratatui.rs/recipes/testing/snapshots/)).
- Running `$EDITOR` from a TUI: leave the alternate screen, disable raw mode, run the editor, then
  restore and clear; with a background event reader, pause it, or the editor's terminal queries end
  up in the app ([spawn-vim recipe](https://ratatui.rs/recipes/apps/spawn-vim/)).

### Markdown rendering in a terminal

- **tui-markdown** 0.3.10 converts markdown to a ratatui `Text`, with GFM alerts and tables; it
  calls itself "an experimental Proof of Concept", keeps no link between the output and the source
  lines, and its default `highlight-code` feature brings syntect
  ([README](https://raw.githubusercontent.com/joshka/tui-markdown/main/tui-markdown/README.md)).
- **pulldown-cmark** 0.13.4 parses GFM alerts into
  `BlockQuote(Some(Note | Tip | Important | Warning | Caution))` with `ENABLE_GFM`, and
  `into_offset_iter()` gives each event "the corresponding range in the markdown source"
  ([Parser](https://docs.rs/pulldown-cmark/0.13.4/pulldown_cmark/struct.Parser.html),
  [Options](https://docs.rs/pulldown-cmark/0.13.4/pulldown_cmark/struct.Options.html)). Codex
  renders its markdown with its own code on top of it (`codex-rs/tui/src/markdown_render.rs`).
- **comrak** 0.56 has source positions on every node but no terminal renderer, and heavy default
  features ([docs](https://docs.rs/comrak/0.56.0/comrak/)). **termimad** 0.35 draws directly with
  crossterm, not ratatui, and lacks ordered lists and links
  ([README](https://github.com/Canop/termimad)).

### Text input

- **ratatui-textarea** 0.9.3 is the maintained fork of tui-textarea, moved to the ratatui
  organization after two years without releases: multi-line, undo and redo, soft wrap, Unicode
  widths. Its default Emacs keys map Ctrl+J to "delete to line head", so the app has to map its own
  keys ([README](https://raw.githubusercontent.com/ratatui/ratatui-textarea/main/README.md),
  [discussion #2367](https://github.com/ratatui/ratatui/discussions/2367)).
- **edtui** 0.11.7 is a vim-modal editor widget; its defaults bring a clipboard crate and syntect
  ([README](https://raw.githubusercontent.com/preiter93/edtui/main/README.md)).
- Any Unicode character arrives as `KeyCode::Char`, and pasted text as `Event::Paste` once bracketed
  paste is enabled (crossterm 0.29 `parse.rs`). The proposal's "ASCII characters" would exclude
  answers in other languages.

### Shift+Enter and the kitty keyboard protocol

- In the legacy encoding, Shift+Enter sends the same byte as Enter; Alt+Enter sends `ESC CR` and is
  distinguishable ([kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/)).
  Ctrl+J sends a line feed, which crossterm reads as Ctrl+J in raw mode.
- The protocol is implemented by kitty, Alacritty, foot, Ghostty, iTerm2, WezTerm, Windows Terminal,
  and others (same page), and enabled in crossterm with `PushKeyboardEnhancementFlags`
  ([docs](https://docs.rs/crossterm/0.29.0/crossterm/event/struct.PushKeyboardEnhancementFlags.html)).
  GNOME Terminal (VTE) does not support it:
  [VTE issue 2601](https://gitlab.gnome.org/GNOME/vte/-/issues/2601) is open. tmux needs
  `extended-keys` set ([tmux wiki](https://github.com/tmux/tmux/wiki/Modifier-Keys)).
- Codex disables event-type reporting on Ghostty and iTerm2, which "can leak shortcut release
  events", and skips enhancement where it "can break dead-key composition"
  (`codex-rs/tui/src/keyboard_modes.rs`).

### Fuzzy matching

- **nucleo-matcher** 0.3.1, helix's matcher, is MPL-2.0; **frizbee** 0.13 is MIT with no required
  dependencies; **fuzzy-matcher** has had no release since 2020
  ([nucleo](https://raw.githubusercontent.com/helix-editor/nucleo/master/README.md),
  [frizbee](https://crates.io/api/v1/crates/frizbee)). PRIORITIES.md holds tens of lines at most.

### Editors

- git picks the editor from `$GIT_EDITOR`, `core.editor`, `$VISUAL`, `$EDITOR`, then `vi`, and the
  value "is meant to be interpreted by the shell" ([git-var](https://git-scm.com/docs/git-var)); it
  skips `$VISUAL` when `TERM=dumb`
  ([editor.c](https://raw.githubusercontent.com/git/git/master/editor.c)). Codex reads `$VISUAL`,
  then `$EDITOR`, split as shell words.
- lazygit's presets open a file at a line with `+N` for the vi family, nano, micro, and helix, and
  `--goto file:N` for VS Code
  ([config](https://raw.githubusercontent.com/jesseduffield/lazygit/master/docs/Config.md)).

### Binary size

Measured for this discovery: a clap-only stub, built with the repository's release profile
(`opt-level = "z"`, LTO, strip), on Linux x64. The current `ura` is 1,176,168 bytes, and CI fails
above 3,000,000 ([ci.yml](/.github/workflows/ci.yml)).

| Added to clap                                   | Size added |
| ----------------------------------------------- | ---------- |
| ratatui 0.30.2 and crossterm                    | +185 KB    |
| pulldown-cmark 0.13                             | +335 KB    |
| tui-markdown, without `highlight-code`          | +556 KB    |
| tui-markdown, with syntect                      | +1.57 MB   |
| ratatui-textarea 0.9.3                          | +104 KB    |
| ratatui, tui-markdown, textarea, nucleo-matcher | +740 KB    |

The TUI stack without syntect brings `ura` to about 1.9 MB.

### Git from Rust

- **The system `git`** runs the user's hooks (this repository's pre-commit hook runs
  `vp check --fix`, through `core.hooksPath = .vite-hooks/_`), signing, and credentials; its
  plumbing and `--porcelain` output are stable to parse
  ([git-status](https://git-scm.com/docs/git-status),
  [githooks](https://github.com/git/git/blob/master/Documentation/githooks.adoc)).
- **git2** 0.21 (libgit2, C) covers every local operation, but does not run hooks, and signing is
  manual ([Repository](https://docs.rs/git2/latest/git2/struct.Repository.html)).
- **gix** 0.89 reads branches, trees, and status, and writes commits and refs; it has no hooks, no
  checkout or switch orchestration, no "tree from index", and no push
  ([crate status](https://github.com/GitoxideLabs/gitoxide/blob/main/crate-status.md)).
- The stack decision left the choice to this feature or the git listener feature, and noted that jj
  moved to the system `git` for fetch and push
  ([stack discovery](../2026-10-10-stack-decision/discovery-01.md#git-and-jujutsu-libraries)).
- Reading another branch without checking it out: `git for-each-ref` lists branches, `git ls-tree`
  lists files, and `git cat-file --batch` reads many files in one process
  ([for-each-ref](https://github.com/git/git/blob/master/Documentation/git-for-each-ref.adoc),
  [cat-file](https://github.com/git/git/blob/master/Documentation/git-cat-file.adoc)). A branch
  checked out in one worktree cannot be checked out in another
  ([worktree](https://github.com/git/git/blob/master/Documentation/git-worktree.adoc)).

### Plain-text anchors for comments

- **Obsidian block references**: a link `[[file#^id]]` points to a block whose line ends with
  ` ^id`, written in the target file; IDs are letters, digits, and dashes, and "Links containing
  block references won't work outside of Obsidian"
  ([Obsidian links](https://obsidian.md/help/links)). No native link to a line number was found
  (forum and plugin search results only). So `[[spec.md#^50]]` means "the block marked `^50`", not
  line 50.
- **GitHub** links to a line of a markdown file only in its plain view, `?plain=1#L50`, and to a
  fixed version with a commit hash in the URL
  ([permanent links](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-a-permanent-link-to-a-code-snippet)).
  Heading links use a lowercased, hyphenated slug, and break when the heading is renamed
  ([basic formatting](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)).
- **W3C Web Annotation**: a `TextQuoteSelector` stores the exact text with a prefix and a suffix; a
  text position "is very brittle with regards to changes"
  ([annotation model](https://www.w3.org/TR/annotation-model/)). Hypothesis re-anchors with fuzzy
  matching on the quote and its context
  ([fuzzy anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/)).
- **CriticMarkup** (`{==text==}{>>comment<<}`) must stay within one block and renders as literal
  braces outside the tools that support it
  ([syntax](https://fletcher.github.io/MultiMarkdown-6/syntax/critic.html)). HTML comments are
  hidden on GitHub; `%%…%%` only in Obsidian ([Obsidian syntax](https://obsidian.md/help/syntax)).
- **git notes** live outside the files, in `refs/notes/commits`, invisible on GitHub, in Obsidian,
  and to an agent reading files ([git-notes](https://git-scm.com/docs/git-notes)).

### Distribution

- dist builds release binaries and installers from its own generated GitHub Actions workflow,
  triggered by pushing a version tag; its book lists shell, PowerShell, npm, Homebrew, and MSI
  installers ([dist book](https://axodotdev.github.io/cargo-dist/book/introduction.html)).
- The stack decision moved the release pipeline into this feature: "releasing belongs with the
  install experience the CLI feature designs"
  ([Q11](../2026-10-10-stack-decision/clarifications-01.md#q11-what-does-the-skeleton-set-up-beyond-local-checks)).
  The platforms are Linux and macOS, x64 and arm64
  ([Q5](../2026-10-10-stack-decision/clarifications-01.md#q5-which-platforms-are-supported)).

### Agent skills

- An Agent Skill is a folder with `SKILL.md` (`name`, `description`) and optional `references/`,
  `assets/`, and `scripts/` ([specification](https://agentskills.io/specification)). Clients read
  `.<client>/skills/` and the shared `.agents/skills/`, in the project and in the home folder
  ([client guidance](https://agentskills.io/client-implementation/adding-skills-support)).
- Claude Code reads `.claude/skills/` and plugins
  ([skills](https://code.claude.com/docs/en/skills)); Codex reads `.agents/skills/`
  ([build skills](https://learn.chatgpt.com/docs/build-skills)).
- `npx skills add owner/repo` installs a repository's `skills/` folder into about 80 agents, by
  symlink or copy ([vercel-labs/skills](https://github.com/vercel-labs/skills)): this repository's
  layout already works with it.
- Templates embedded at build time match the binary's version and need no network; `include_dir`
  reads them from `$CARGO_MANIFEST_DIR/../../skills/uraeda/assets/templates`
  ([include_dir](https://docs.rs/include_dir/latest/include_dir/)). An `include_str!` outside the
  crate breaks `cargo publish`, which does not apply while every crate is `publish = false`
  ([publishing](https://doc.rust-lang.org/cargo/reference/publishing.html)).

## The code

### Important reads

- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs): clap 4.6 with one subcommand,
  `status <folder>`.
- [`crates/core/src/temporary_status.rs`](/crates/core/src/temporary_status.rs): reads the `status`
  field of `clarifications-NN.md`, `spec.md`, and `plan.md` in one folder, with the allowed values
  per file from the skill's table; frontmatter through serde-saphyr; `temporary_read_specs` lists
  feature folders newest first. All of it is marked `TEMPORARY: replaced by the CLI feature`.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs) and
  [`packages/server/src/temporary-spec-folders.ts`](/packages/server/src/temporary-spec-folders.ts):
  the server shows the same types through napi-rs, so the core's types are a shared API for the CLI
  and the web UI.
- [`fixtures/`](/fixtures/): broken files (no frontmatter, bad YAML, unknown status, not UTF-8), a
  folder named with an impossible date, and a round numbered `clarifications-1.md`.
- [Stack decision](../decisions/stack.md): logic, parsing, validation, and states in the Rust core;
  the CLI needs no other runtime. [Toolchain decision](../decisions/toolchain.md): new crates join
  `vp run ready`; no Windows.
- [Stack spec](../2026-10-10-stack-decision/spec.md): `ura status` has no `--json` yet, "the CLI
  feature designs its output formats"; the release matrix comes with the CLI feature; the size limit
  of 3 MB.
- [`SKILL.md`](/skills/uraeda/SKILL.md) and its [references](/skills/uraeda/references/): the
  operations listed below.
- [`specs/drafts/web-ui.md`](../2026-10-11-web-ui/proposal.md): the web UI will also answer,
  approve, and request changes, set the statuses, turn the block into a record, and commit. Both
  tools need the same actions, in the core.

### Mechanical operations in the skill

From [`SKILL.md`](/skills/uraeda/SKILL.md) and the references. Deterministic means a function of the
files and git alone.

| Operation                                                      | Who           | Deterministic            | Proposal command |
| -------------------------------------------------------------- | ------------- | ------------------------ | ---------------- |
| Set up `specs/` from three templates                           | agent         | yes; the constitution no | `init`           |
| Pick the target from PRIORITIES Now and the branches           | agent         | mostly                   | `status`, partly |
| Find the step from the 12-row table (7 rows for bugs)          | agent         | yes, except PR rows      | none             |
| Start a feature: Now, commit, branch, move the draft, commit   | human asks    | yes, except the slug     | `draft`, partly  |
| Start a bug on `fix/YYYY-MM-DD-<slug>`                         | human asks    | yes, except the slug     | none             |
| Postpone, block, drop                                          | human asks    | yes, except the reason   | none             |
| Answer the questions, set `answered`                           | human         | the status only          | `answer`         |
| Skip follow-ups whose parent answer does not pick them         | human, agent  | for letter answers       | `answer`         |
| Reset an `answered` file with blanks                           | agent         | yes                      | none             |
| Turn the `[!IMPORTANT]` block into a `[!NOTE]` record          | tool or agent | yes, except the summary  | implied          |
| Approve or request changes on a spec, plan, or bug assessment  | human         | the status only          | `review`         |
| Change `risk-tier` or `plan-review` on approval                | human         | yes                      | none             |
| Counters: `revision`, `clarifications`, `spec-revision`, `NN`  | agent         | yes                      | none             |
| Activate decisions and apply proposed changes                  | agent         | partly                   | none             |
| Plan progress from checkboxes                                  | agent         | yes                      | `status`, partly |
| Commit messages: type, scope, body                             | agent, human  | yes, except the subject  | none             |
| Validate frontmatter, headings, structured items, links, names | agent         | yes                      | none             |
| Read features in flight on other branches                      | agent         | the listing              | `status`, partly |

### The proposal's path and existing actions

- **`ura init`** today: the skill copies `README.md`, `CONSTITUTION.md`, and `PRIORITIES.md`, and no
  folders ([Setting up a project](/skills/uraeda/SKILL.md#setting-up-a-project)). The proposal adds
  "+ folders": git does not track an empty `drafts/`, `backlog/`, `decisions/`, or `bugs/` folder.
- **`ura status`** from `main` today: the cli-core feature is invisible, because its folder exists
  only on its branch. The remote branch `origin/2026-10-10-stack-decision` is still listed although
  its pull request is merged.
- **`ura draft`**: the skill has two places for a new idea. A draft file in `drafts/`, written
  before the feature starts, and the start itself, which moves the entry to **Now** on the default
  branch, creates the branch, and moves the draft into `specs/YYYY-MM-DD-<slug>/proposal.md`
  ([Starting](/skills/uraeda/SKILL.md#starting-postponing-and-dropping-a-feature)). This feature
  began a third way: the human wrote the dated folder on `main` and linked the PRIORITIES entry to
  it (commit `20e8cc5`), a link the skill does not describe.
- **`ura answer`** from `main`: the questions are on the feature's branch, which the human must have
  checked out to answer, as the skill says ("the human answers and approves on it too").
- **Answering**: the example's answers are free text ("B and C: we need …", "C, we want a simple
  feature"), and its `Q2.B` stays blank because Q2 was answered C
  ([example](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md)).
- **`ura review`**: a refusal writes a `## Changes requested` section at the end of the file; the
  revision then removes it, and turns the block into a record with the feedback "in one line"
  ([Coming back to the human](/skills/uraeda/SKILL.md#coming-back-to-the-human)). There is no
  neutral "comment" state: a comment without a verdict leaves the file `awaiting-human`, and no
  agent runs. An approval has no place for notes.
- **Line comments**: the example spec is hard-wrapped at 100 columns, so one sentence spans two or
  three lines, and a rendered paragraph does not map to one source line.
- **Commits by the CLI**: this repository's pre-commit hook runs `vp check --fix`, which needs
  `node_modules`: a commit made in a fresh temporary worktree would fail it.
- **An agent with the CLI**: the skill forbids agents to set human statuses unless the human asks in
  the session ([Workflow status](/skills/uraeda/SKILL.md#workflow-status)); a CLI does not know who
  runs it.

### Likely changes

- [`crates/core/`](/crates/core/): a model of the whole `specs/` folder (features, bugs, drafts,
  decisions, PRIORITIES), every file's frontmatter, the structured items, the next step, validation,
  and the actions: answer, approve, request changes, start. Under every option; the
  `temporary_status` module goes.
- [`crates/cli/`](/crates/cli/): the commands, the plain and JSON output, and, with the TUIs in this
  feature ([scope](#scope)), a `tui` module per screen.
- [`crates/binding/`](/crates/binding/) and [`packages/server/`](/packages/server/): follow the
  core's new types, replacing the temporary ones.
- [`skills/uraeda/`](/skills/uraeda/): `SKILL.md`, the references, templates, and example, for the
  commands ([the skill and the CLI](#the-skill-and-the-cli)) and, if they change, the review format
  ([where review feedback lives](#where-review-feedback-lives)).
- [`.github/workflows/`](/.github/workflows/): a release workflow, with
  [release and install](#release-and-install).
- [`fixtures/`](/fixtures/): files for each validation rule and step.
- [`README.md`](/README.md): install and commands.

## The proposal

### "Use the CLI for all workflow steps" meets principle V

The constitution says "The workflow MUST work with any agent, with or without the uraeda CLI" and
"Tools MUST only enforce rules that humans and agents can follow unaided"
([principle V](../CONSTITUTION.md#v-tools-are-optional)). A skill that only says "run `ura X`"
breaks the first rule; a CLI whose checks are not written in the skill breaks the second.
Backlog.md's "never edit directly" is the model the constitution rules out.

### `ura draft` and the start of a feature

The proposal's `draft` turns a PRIORITIES line into "a real file". It does not say whether that file
is a draft in `drafts/`, written before the feature starts, or the started feature's `proposal.md`,
with its branch and commits.

### Features live on branches

Every feature's files live on its branch until its pull request is merged, and PRIORITIES lives on
the default branch. A status read from the working tree shows only the current branch's feature.
Answering or reviewing from another branch means writing on a branch that is not checked out.

### "Typing ASCII characters goes directly in the response box"

If any printable key starts typing, the motion keys (`j`, `k`, `h`, `l`, `g`, `q`) cannot also start
an answer: an answer beginning with "just" would scroll. And answers in other languages need more
than ASCII.

### `[[spec.md#^50]]` is not a line link

In Obsidian, `^50` is a block ID that must be written into `spec.md` itself, and the link works
nowhere else ([plain-text anchors](#plain-text-anchors-for-comments)). It cannot point to line 50.

### Approve with comment

The proposal asks whether approving or refusing with a comment changes the flow. Refusing with
comments is today's flow, with the feedback in `## Changes requested`. Approving with a comment has
no place in the files and no rule for who acts on it.

### Missing operations

Most of the skill's mechanical operations have no command in the proposal: the next step,
validation, starting bugs, postponing, the record blocks, the counters
([mechanical operations](#mechanical-operations-in-the-skill)).

### Inherited work

The release pipeline and the binary's install were moved into "the CLI feature" by the stack
decision, and git integration was left to it. The proposal does not mention either.

### `ura status` "CLI + TUI"

The proposal writes "CLI + TUI" after `ura status`, without saying what the TUI shows beyond the
pickers of `answer` and `review`.

## Approaches

Criteria come from the [proposal](proposal.md) (fast human actions, a coherent and beautiful TUI,
less error-prone agents), the [constitution](../CONSTITUTION.md) (II plain text in git, III
asynchronous, IV review effort, V tools optional), the [stack decision](../decisions/stack.md)
(logic in the core, shared with the web UI), and the 3 MB size limit.

### Scope

What this feature delivers, and in which order. The proposal holds independent pieces: the core
model and non-interactive commands, three TUIs, the skill's rewrite, and, by inheritance, the
release pipeline.

| Option                                                                   | Time to reliable agents | Time to the TUIs | Size of one review |
| ------------------------------------------------------------------------ | ----------------------- | ---------------- | ------------------ |
| A. Core, commands, skill, and release here; the TUIs as the next feature | Shortest                | Later            | Medium             |
| B. Everything in this feature                                            | Longest                 | One delivery     | Largest            |
| C. The TUIs first, the skill's rewrite and release later                 | Longest                 | Shortest         | Medium             |

### The skill and the CLI

How the skill tells agents about the commands, within
[principle V](#use-the-cli-for-all-workflow-steps-meets-principle-v).

| Option                                                                       | Principle V        | Agent errors         | Drift between skill and CLI |
| ---------------------------------------------------------------------------- | ------------------ | -------------------- | --------------------------- |
| A. Rules stay in the skill; each step names its command, used when installed | Kept               | Low with the CLI     | Low: one rule, one pointer  |
| B. One section mapping operations to commands; the steps unchanged           | Kept               | Medium: easy to miss | Medium                      |
| C. CLI first: agents must use the CLI, the rules live in the CLI             | Needs an amendment | Lowest               | None                        |

### Commands

Which commands exist, beyond the proposal's. Relies on
[mechanical operations](#mechanical-operations-in-the-skill) and
[what they have in common](#what-they-have-in-common).

| Command                                         | Serves                                 | Risk                               |
| ----------------------------------------------- | -------------------------------------- | ---------------------------------- |
| `ura check`: validate every rule                | CI, pre-commit, agents' self-review    | None: read-only                    |
| `ura next`: the target and its step             | Agents, the future runner and listener | None: read-only; PR rows need `gh` |
| `ura start`: the full start of a feature or bug | Humans, agents                         | Writes on the default branch       |
| `ura postpone`, `ura drop`                      | Humans                                 | Merges or deletes branches         |
| `ura round`: scaffold the next round's files    | Agents                                 | Low                                |

### Drafting

What `ura draft` creates. Relies on
[`ura draft` and the start of a feature](#ura-draft-and-the-start-of-a-feature).

| Option                                                                                 | Git             | Matches the skill |
| -------------------------------------------------------------------------------------- | --------------- | ----------------- |
| A. A draft file in `drafts/`, linked from the PRIORITIES line; starting stays separate | None            | Yes               |
| B. The full start: Now, branch, dated folder, `proposal.md`, two commits               | Branch, commits | Yes, as `start`   |
| C. A dated folder with `proposal.md` on the current branch, as done for this feature   | None            | No                |

### Status

What `ura status` reads and shows. Relies on
[features live on branches](#features-live-on-branches).

| Option                                                                                         | Other branches | Uncommitted edits | Matches the skill's target rule |
| ---------------------------------------------------------------------------------------------- | -------------- | ----------------- | ------------------------------- |
| A. Every feature and bug, from the default branch and each branch's tip, plus the working tree | Yes            | Yes, flagged      | Yes                             |
| B. The working tree only                                                                       | No             | Yes               | No                              |
| C. PRIORITIES entries only, each resolved to its branch                                        | Yes            | No                | Partly: no unlinked entries     |

A dashboard TUI on top of A or B (`ura` alone, lazygit-style) is a separate choice.

### Writing on a feature's branch

Where `answer` and `review` write when the feature's branch is not checked out. Relies on
[git from Rust](#git-from-rust).

| Option                                                                                            | Disrupts the working tree | Runs the hooks                         | Handles uncommitted work |
| ------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------- | ------------------------ |
| A. Use the branch's worktree if it has one; otherwise switch to it when the working tree is clean | When switching            | Yes                                    | Refuses                  |
| B. A temporary worktree for the commit, removed after                                             | No                        | Fails here (`vp` needs `node_modules`) | Not affected             |
| C. Write the commit with plumbing, without a worktree                                             | No                        | No                                     | Not affected             |

### Committing

Whether the commands commit the human's actions.

| Option                                            | Async (principle III) | Human control            |
| ------------------------------------------------- | --------------------- | ------------------------ |
| A. Commit on submit, with the user's git identity | Immediate             | `--no-commit` to opt out |
| B. Write the files, print the commit to run       | One more step         | Full                     |

### Git backend

How the core runs git. Relies on [git from Rust](#git-from-rust).

| Option                                        | Coverage         | Hooks and signing | Binary    | Runtime needs |
| --------------------------------------------- | ---------------- | ----------------- | --------- | ------------- |
| A. The system `git`                           | Everything       | Yes               | No change | `git` on PATH |
| B. gix for reads, the system `git` for writes | Everything       | Yes, for writes   | Larger    | `git` on PATH |
| C. git2 (libgit2)                             | Local operations | No                | C build   | None          |

### Review verdicts

What a review can conclude. Relies on [approve with comment](#approve-with-comment) and
[code review tools](#code-review-tools).

| Option                                                                                            | Wakes an agent   | Rules to add                     |
| ------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------- |
| A. Approve, with optional notes the next steps carry out; request changes, with required comments | Yes              | Where notes go, who applies them |
| B. Approve with no comments; request changes with comments                                        | Yes              | None                             |
| C. A, plus a comment-only review that leaves the file waiting                                     | No, for comments | A third state                    |

### Where review feedback lives

Relies on [plain-text anchors](#plain-text-anchors-for-comments) and
[plan annotators](#plan-annotators-plannotator-ano-open-plan-annotator).

| Option                                                                  | Without tools (V) | Durable record      | Files to read | Workflow change |
| ----------------------------------------------------------------------- | ----------------- | ------------------- | ------------- | --------------- |
| A. A review file per review, `spec-review-NN.md` or `plan-review-NN.md` | Yes               | Yes, in the folder  | Two           | New file type   |
| B. The `## Changes requested` section, with numbered comments           | Yes               | Git history only    | One           | Small           |
| C. Inline comments in the reviewed file (CriticMarkup, HTML comments)   | Awkward           | Removed on revision | One           | New syntax      |

### Comment anchors

How a comment points to its place.

| Option                                                           | Typed by hand  | Survives a revision   | GitHub and Obsidian |
| ---------------------------------------------------------------- | -------------- | --------------------- | ------------------- |
| A. Line numbers at the reviewed `revision`, plus the quoted text | Yes            | The quote reads alone | Plain text, both    |
| B. The nearest heading or structured ID (`US2`, `SC-003`)        | Yes            | Yes, unless renamed   | Links differ        |
| C. Obsidian block IDs written into the spec                      | Edits the spec | Yes                   | Obsidian only       |

### Review view

How `ura review` shows the file, and what the cursor's "line" is. Relies on
[markdown rendering in a terminal](#markdown-rendering-in-a-terminal).

| Option                                                                                     | Reads like the document | Exact anchor      | Size    |
| ------------------------------------------------------------------------------------------ | ----------------------- | ----------------- | ------- |
| A. Rendered markdown; the cursor moves by block (paragraph, list item, table row, heading) | Yes                     | The block's lines | +335 KB |
| B. The source, styled (headings bold, callouts coloured), line by line                     | Like an editor          | Exact line        | ~0      |
| C. A, with a key to toggle B                                                               | Both                    | Both              | +335 KB |
| D. tui-markdown, no source mapping                                                         | Yes                     | None              | +371 KB |

### Answer input

How typing starts in `ura answer`. Relies on
["typing ASCII characters"](#typing-ascii-characters-goes-directly-in-the-response-box).

| Option                                                                                                           | Keystrokes to answer "B"   | Conflicts with motions              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------- |
| A. Uppercase letters, digits, and space start typing; lowercase are motions; `i` or Enter to start with anything | One                        | None                                |
| B. Any key that is not a motion starts typing                                                                    | One, except motion letters | Answers starting with `j`, `g`, ... |
| C. The answer box always has focus; motions on Ctrl keys and arrows only                                         | One                        | None, no vi motions                 |

### Look

The visual direction. Relies on [terminal UIs](#terminal-uis) and
[the human's setup](#the-humans-setup).

| Option                                                                    | Follows the user's theme | Matches LazyVim | Needs a Nerd Font |
| ------------------------------------------------------------------------- | ------------------------ | --------------- | ----------------- |
| A. The terminal's 16 colours, LazyVim-shaped bottom bar, plain separators | Yes                      | Shape           | No                |
| B. Catppuccin Mocha in true colour, powerline separators                  | No                       | Exactly         | Yes               |
| C. Monochrome: bold, dim, and reverse only                                | Yes                      | No              | No                |

### Init and the skill

What `ura init` writes, and whether it installs the skill. Relies on [agent skills](#agent-skills).

| Option                                                                                    | Skill matches the CLI | Agents reached                            | Footprint            |
| ----------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------- | -------------------- |
| A. The `specs/` files; the skill installed by `npx skills add` or a plugin                | No guarantee          | ~80, through the tool                     | None                 |
| B. The `specs/` files, plus the embedded skill in `.agents/skills/` and `.claude/skills/` | Yes                   | Claude Code, Codex, and `.agents` readers | A copy per project   |
| C. B, plus a pointer block in `AGENTS.md`                                                 | Yes                   | Any agent reading AGENTS.md               | One more file edited |

### Release and install

How users get `ura`. Relies on [distribution](#distribution).

| Option                                                                                | Without Rust installed | Work   |
| ------------------------------------------------------------------------------------- | ---------------------- | ------ |
| A. dist: release binaries and a shell installer on version tags, for the four targets | Yes                    | Medium |
| B. `cargo install --git` only                                                         | No                     | None   |
| C. A, plus a Nix flake package and a Homebrew tap                                     | Yes                    | Larger |

### Needs no choice

- **Machine output**: every read command gets `--json`, with a top-level `version`, additions
  allowed, as cargo and Terraform do; the JSON comes from the same core types napi exports, as the
  stack decision requires.
- **Non-interactive paths**: every TUI action has flags (`ura review spec.md --approve`), and the
  TUI starts only when stdin and stdout are terminals and `--no-input` is not set, as clig.dev and
  OpenSpec do. Agent harnesses may allocate a terminal, which is why the flag exists.
- **Validation and exit codes**: errors exit 1, as OpenSpec and the temporary `ura status` do.
- **The workspace root**: the git top-level folder holds `specs/`, as the skill assumes; monorepos
  are under Later in PRIORITIES.
- **`init` on existing files**: create what is missing, never overwrite, report what was kept, like
  `git init`.
- **Templates**: embedded at build time from `skills/uraeda/assets/templates/`, one source of truth.
- **Libraries**: no syntect, and a plain substring filter rather than a fuzzy matcher (MPL-2.0 for
  nucleo, tens of lines to filter); ratatui-textarea for the answer box.
- **Editor**: `$VISUAL`, then `$EDITOR`, then `vi`, run through the shell, with `+N` for the line.
- **Shift+Enter**: Ctrl+J and Alt+Enter insert a newline everywhere; Shift+Enter where the terminal
  reports it, with the bottom bar naming the key that works, as Codex does.
- **Accessibility**: `NO_COLOR`, a minimum terminal size, and the files and flags as the path
  without a TUI.
- **Answer drafts**: answers are written to the file as each is validated, so quitting loses
  nothing; the status changes only on submit.

## Not checked

- dist's current version, targets, and installer details: only its introduction page was read.
- GitHub's ` ```suggestion ` block syntax and GitLab's: search results only.
- Whether CriticMarkup and `==highlight==` render on GitHub and in Obsidian.
- Whether Ghostty applies its `shift+enter` binding before the kitty protocol's encoding.
- The comments of VTE issue 2601, for partial progress.
- Published binary-size figures for ratatui: none found; the sizes above are local measurements.
