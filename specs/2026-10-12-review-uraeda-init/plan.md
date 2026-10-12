---
status: auto-approved
spec-revision: 1
---

# Plan: Review uraeda init and skill install flow

**Goal:** `ura init` sets up `specs/` only and offers the skill for the user, `ura install` installs
or updates the skill for the user or the repository, with ratatui pickers or flags, and
`ura upgrade` refreshes the user's copy.

**Architecture:** the install logic moves from `ura init`'s action into its own core action, taking
a base folder, and refusing to write into folders it did not create. The CLI resolves its answers
from flags, and asks for the missing ones with one ratatui picker module, inline. See the
[spec's design](spec.md#design).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **A `uraeda.ura-tmp` folder left by an interrupted first install** is removed and the install
   runs normally: no error, no stale file in the result. Task 1.
2. **`HOME` set to an empty string** is treated as unset: `ura install --user` exits 1 with the
   `HOME is not set` error, and `ura init` prints the `No Uraeda skill found` line. Tasks 1 and 3.
3. **A dangling link at `.claude/skills/uraeda`**, whose target is gone, is kept and reported as a
   link, and nothing is written through it or in its place. Task 1.
4. **`ura install --repo` in a linked worktree** writes at that worktree's top level, the folder git
   reports, and never in the main checkout. Task 1.
5. **Keys the help line does not name**, letters, digits, Tab, and resize events, change nothing in
   a picker; `j` and `k` move like ↓ and ↑. Task 4.

## Global constraints

From the decisions and the spec, word for word. Every task's requirements include these.

From [CLI](../decisions/cli.md):

- Every rule the CLI enforces or checks MUST be written in the skill, `skills/uraeda/`. The CLI MUST
  NOT require anything the skill does not state.
- A change to a command's behaviour MUST update the skill in the same change, and a change to a
  skill rule a command follows MUST update the command.
- The CLI MUST embed the skill and its templates from `skills/uraeda/` at build time. No second copy
  of a template or a rule MAY live in the code.
- Every action a TUI offers MUST also be available through flags, without a terminal. A TUI MUST
  start only when stdin and stdout are terminals and `--no-input` is not set; otherwise the command
  MUST exit 1 and name the flags to pass.
- Commands MUST print data to stdout and messages to stderr, exit 0 on success and 1 on any error,
  validation errors included, except a path not built yet, which MAY stop with `unimplemented!`, and
  print no colour without a terminal or when `NO_COLOR` is set.
- CI MUST NOT fail on the release binary's size, and MUST print that size on every run.

From [TUI](../decisions/tui.md):

- Every TUI of `ura`, prompts and pickers included, MUST be drawn with ratatui on its crossterm
  backend. Other prompt or TUI libraries, like dialoguer, inquire, or cliclack, and hand-written
  terminal control MUST NOT be added.
- Prompts inside a command, like pickers and confirmations, MUST draw inline, under the command's
  output, and MUST leave the chosen answer as a line of that output once they close.
- Reusable TUI parts, like the picker, MUST live in their own modules of `crates/cli/`, with their
  key handling testable without a terminal.
- A TUI MUST restore the terminal on every exit: a confirmation, a cancel with Esc or Ctrl-C, an
  error, and a panic.
- A TUI MUST use the terminal's own 16 colours, never fixed RGB values, and MUST stay readable
  without colour: the cursor and a checked item show as characters, `>` and `[x]`, not as colour
  alone.

From [Git](../decisions/git.md):

- In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines.

From [Toolchain](../decisions/toolchain.md):

- Rust code MUST pass `cargo fmt --check`, `cargo clippy` with warnings as errors, and `cargo test`.
- Windows MUST NOT be assumed supported until a decision adds it.

From [the spec](spec.md), exact text (`~/` is the printed prefix for the home folder, empty for the
repository; `<N>` the number of files):

- `created ~/.agents/skills/uraeda/ (<N> files)`, `updated ~/.agents/skills/uraeda/ (1 file)`,
  `linked  ~/.claude/skills/uraeda -> ../../.agents/skills/uraeda`
- `kept    ~/.agents/skills/uraeda/: up to date`,
  `kept    ~/.agents/skills/uraeda/SKILL.md: edited since installed`,
  `kept    ~/.agents/skills/uraeda: not installed by ura`,
  `kept    ~/.claude/skills/uraeda: a link to <target>`, and `kept    ~/.claude/skills/uraeda` for
  ura's own link
- `note    another copy in <path>: Claude Code reads the user's copy, other agents the repository's`
- `nothing to update: ura installed no skill in ~/`
- `ura: no terminal to ask: pass --user or --repo, and --agents, --claude, or both`, naming only
  what is missing: `pass --user or --repo`, or `pass --agents, --claude, or both`
- `ura: cancelled: nothing installed`, `ura: HOME is not set: set it, or pass --repo`,
  `ura: not in a git repository: run git init first`, `ura: could not write <path>: <system error>`
- Picker lines, as in [the mockup](mockups/install.txt): `Install the Uraeda skill for:`,
  `> Your user, in ~/: every repository on this machine`, `  This repository, in <folder>/`,
  `Into the folders your agents read:`,
  `> [x] .agents/skills   Codex, Gemini CLI, Copilot, Cursor, OpenCode, Amp`,
  `  [x] .claude/skills   Claude Code`, help lines `↑/↓ move · enter confirm · esc cancel` and
  `↑/↓ move · space check · enter confirm · esc cancel`, and with nothing checked after Enter,
  `check at least one folder · ↑/↓ move · space check · esc cancel`
- Answer lines: `Install the Uraeda skill for: your user` or `... for: this repository`,
  `Into: .agents/skills, .claude/skills`, `Install the Uraeda skill for your user? yes` or `no`
- `ura init`: `Install the Uraeda skill for your user?` with
  `Yes, in ~/: every repository on this machine` and `No`;
  `Skill not installed: install it later with ura install.`;
  `No Uraeda skill found: install it with ura install --user --agents --claude.`; the
  `Next: ask your agent to write specs/CONSTITUTION.md with you, then commit.` line stays last.

## Code read

- [`crates/core/src/actions/init.rs`](/crates/core/src/actions/init.rs): `run(root, skill)` writes
  `specs/`, then `install_skill` (the manifest logic: write missing files, rewrite files whose hash
  matches the manifest, keep edited ones, remove dropped files nobody edited) and `link_claude`.
  `InitLine` has `Created`, `Kept`, `Updated`, `Installed`, `Linked`. The only reader of the skill
  constants and `InitLine` is [`crates/cli/src/init.rs`](/crates/cli/src/init.rs).
- [`crates/core/src/actions/mod.rs`](/crates/core/src/actions/mod.rs): `ActionError`, with
  `Io(String)` and `From<std::io::Error>`, which loses the path.
- [`crates/core/src/embedded.rs`](/crates/core/src/embedded.rs): `SKILL`, the embedded
  `skills/uraeda/`, with `include_dir`.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): `Git::discover(start)`, failing with "not in
  a git repository: run git init first", and `root()`, the working tree's top level, a linked
  worktree's own.
- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs): clap derive `Command` enum, one module per
  command returning `Result<ExitCode, String>`, errors printed as `ura: <message>`.
- [`crates/cli/src/editor.rs`](/crates/cli/src/editor.rs): `available()`, the only terminal check,
  used by [`draft.rs`](/crates/cli/src/draft.rs). [`output.rs`](/crates/cli/src/output.rs) has the
  private `colours()` check, with `NO_COLOR` and `TERM=dumb`.
- [`crates/cli/src/upgrade.rs`](/crates/cli/src/upgrade.rs): `exec`s `sh -c INSTALL` or
  `brew upgrade`, with unit tests in the module.
- [`crates/cli/tests/common/mod.rs`](/crates/cli/tests/common/mod.rs): `ura(repo, args)` and
  `ura_in(dir, args, env)` run the built binary with stdin closed, `URA_TODAY`, and `NO_COLOR`; they
  inherit the real `HOME` today. `TestRepo` is in
  [`crates/core/tests/common/repo.rs`](/crates/core/tests/common/repo.rs), with `parent()`, a
  temporary folder next to the repository.
- [`crates/cli/tests/init.rs`](/crates/cli/tests/init.rs): today's skill tests, which move to
  `tests/install.rs`; [`tests/skill.rs`](/crates/cli/tests/skill.rs) fails when a subcommand is not
  named in `SKILL.md` or a reference.
- [`package.json`](/package.json): `vp run ready` runs `cargo fmt --check`, clippy with
  `-D warnings`, `cargo test --workspace --exclude uraeda-binding`, `ura check` on `specs` and the
  example, then the TypeScript checks. [`ci.yml`](/.github/workflows/ci.yml) runs it, then the size
  step.
- ratatui 0.30.2 (in the local cargo registry): `try_init_with_options(TerminalOptions)` enables raw
  mode, installs a panic hook that restores the terminal, and returns a terminal on stdout;
  `restore()`; `Viewport::Inline(height)`; `ratatui::crossterm` re-exports crossterm 0.29; the
  `crossterm` feature alone gives the backend and the widgets.

## Constitution check

| Principle                        | Complies | Notes                                                                 |
| -------------------------------- | -------- | --------------------------------------------------------------------- |
| I. Humans stay in control        | yes      | Within the approved spec and its decisions                            |
| II. Git and plain text first     | yes      | The skill and its manifest stay plain text                            |
| III. Asynchronous by default     | yes      | Every picker has flags; tests run with stdin closed                   |
| IV. Review effort matches impact | yes      | Small choices in [rulings](rulings.md)                                |
| V. Tools are optional            | yes      | The skill's setup section keeps the manual steps and `npx skills add` |
| VI. Code is checked against spec | yes      | Every scenario has a test or, for terminal paths, a key-table test    |

## Decisions

The decisions this plan relies on, and where it follows them:

- [CLI](../decisions/cli.md): `--no-input` and flags for every picker (tasks 1, 3, 4); the skill
  updated with each command change (tasks 1 to 5); the size step (task 6).
- [TUI](../decisions/tui.md): ratatui, inline, answer lines, terminal restored, 16 colours (task 4).
- [Git](../decisions/git.md): the top level through `Git::discover` (tasks 1 and 3).
- [Toolchain](../decisions/toolchain.md): `vp run ready` in every task's last run.

## Complexity tracking

| Abstraction or exception                          | Why it is needed                                                             | Simpler alternative rejected because                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `actions::install`, out of `actions::init`        | Two commands use it, at two base folders                                     | Keeping it in `init` would tie `ura install` to `ura init`'s module           |
| `Picker`, with `handle` separate from `render`    | Three prompts share it, and the TUI decision wants key handling tested alone | Three hand-written loops would triple the terminal code and its restore paths |
| `install::resolve` and `Choice`                   | One table decides picker, answer, or error, tested row by row                | Branches inline in `run` could only be tested through a terminal              |
| `terminal::interactive`                           | `ura draft`, `ura init`, and `ura install` share one check                   | Copying `editor::available` would let the checks drift                        |
| `HOME` set per test in `ura_in`, `TestRepo::home` | No test reads or writes the real home folder                                 | Tests on the real home break on any machine that has the skill installed      |

---

## Task 1: The install action, and `ura install` with flags

**Files:**

- Create: `crates/core/src/actions/install.rs`, `crates/cli/src/install.rs`,
  `crates/cli/src/terminal.rs`, `crates/cli/tests/install.rs`
- Modify: `crates/core/src/actions/mod.rs` (`pub mod install`), `crates/core/src/actions/init.rs`
  (only the skill constants and helpers move; `run` keeps its `skill` flag until task 3, calling the
  new action), `crates/cli/src/main.rs` (`Install`), `crates/cli/src/editor.rs` and
  `crates/cli/src/draft.rs` (use `terminal::interactive(false)`), `skills/uraeda/SKILL.md` (command
  table), `crates/core/src/embedded.rs` (doc comment)
- Modify: `crates/cli/tests/common/mod.rs` (`HOME`), `crates/core/tests/common/repo.rs` (`home()`)

**Interfaces:**

- Produces, in `uraeda_core::actions::install`:
  - `pub const AGENTS_DIR: &str = ".agents/skills/uraeda"`,
    `pub const CLAUDE_DIR: &str = ".claude/skills/uraeda"`,
    `pub const MANIFEST: &str = ".ura-manifest"`
  - `#[derive(Clone, Copy, Debug, PartialEq, Eq)] pub struct Folders { pub agents: bool, pub claude: bool }`
  - `pub enum InstallLine { Installed(String, usize), Updated(String, usize), Linked(String, String), Kept(String, Option<String>) }`,
    paths already prefixed with `shown`
  - `pub fn install(base: &Path, shown: &str, folders: Folders) -> Result<Vec<InstallLine>, ActionError>`
  - `pub fn existing(base: &Path) -> Vec<&'static str>`: those of `AGENTS_DIR`, `CLAUDE_DIR` with
    any entry at the path (`symlink_metadata`), links included, dangling or not
- Produces, in the CLI: `terminal::interactive(no_input: bool) -> bool` (stdin and stdout terminals,
  `TERM` not `dumb`, and `!no_input`); `install::print(lines: &[InstallLine])`, the 8-column format;
  `install::home() -> Option<PathBuf>` (`HOME`, `None` when unset or empty);
  `enum Scope { User, Repo }`; `enum Choice<T> { Given(T), Implied(T), Ask }`;
  `install::resolve(flags: &Flags, interactive: bool, in_repo: bool) -> Result<(Choice<Scope>, Option<Choice<Folders>>), String>`,
  `None` folders with `--update`.
- Produces, in tests: `TestRepo::home(&self) -> PathBuf`, `parent()/home`, created on first call;
  `ura(repo, args)` passes `HOME=repo.home()`; `ura_in` sets `HOME` to a new temporary folder, kept
  until the run ends, unless `env` names `HOME`. `skill_files() -> usize`, the number of files under
  `repository()/skills/uraeda`.

- [ ] **Step 1: Write the failing tests, and the helpers they use**

In `crates/cli/tests/install.rs`, each test Arrange, Act, Assert on `TestRepo` and its home:

- `installs_for_the_user_in_both_folders`: `ura install --user --agents --claude` → stdout is
  exactly
  `created ~/.agents/skills/uraeda/ ({skill_files()} files)\nlinked  ~/.claude/skills/uraeda -> ../../.agents/skills/uraeda\n`;
  `home/.agents/skills/uraeda/SKILL.md` and `.ura-manifest` exist; `read_link` of
  `home/.claude/skills/uraeda` is `../../.agents/skills/uraeda`; the repository has no `.agents`.
- `installs_for_claude_alone`: `--user --claude` → `home/.claude/skills/uraeda/.ura-manifest` is a
  file in a real folder, `home/.agents` does not exist.
- `installs_for_agents_alone`: `--user --agents` → no `home/.claude`.
- `installs_in_the_repository_from_a_subfolder`: run in `crates/` with `--repo --agents --claude` →
  `.agents/skills/uraeda/SKILL.md` at the top level, the link, and the home folder empty.
- `installs_in_a_linked_worktree_at_its_own_top_level` (review focus 4): `git worktree add` in
  `repo.parent()/wt`, `--repo --agents` there → `wt/.agents/skills/uraeda/SKILL.md` exists, the main
  checkout has no `.agents`.
- `without_a_terminal_names_the_missing_flags`, table-driven over `[]`, `["--user"]`,
  `["--agents"]`, `["--no-input", "--agents"]` → exit 1, stderr as in the global constraints, home
  and repository unchanged.
- `updates_the_files_nobody_edited`: today's `updates_the_skill_files_nobody_edited`, moved, on the
  home folder with `--user --agents`.
- `run_again_keeps_everything`: two runs of `--user --agents --claude` → second stdout is
  `kept    ~/.agents/skills/uraeda/: up to date\nkept    ~/.claude/skills/uraeda\n`.
- `drops_files_an_older_skill_had`: a manifest line for `references/old.md` with its file unedited →
  removed; edited → kept.
- `a_link_is_never_written_through`: `home/.claude/skills/uraeda` linked to `home/dev/skill` holding
  `SKILL.md` = `ours\n` → line `kept    ~/.claude/skills/uraeda: a link to {home}/dev/skill`, the
  file byte for byte the same; a link at `.agents/skills/uraeda` is kept the same way, nothing is
  written through it, and a missing `.claude/skills/uraeda` is linked to it, as the spec's edge case
  says.
- `a_dangling_link_is_kept` (review focus 3): `home/.claude/skills/uraeda` → `home/gone` → kept as a
  link, `home/gone` still missing.
- `a_folder_without_a_manifest_is_kept`: `home/.agents/skills/uraeda/SKILL.md` = `npx\n` →
  `kept ~/.agents/skills/uraeda: not installed by ura`, no file added in it (folder lists one
  entry), and with `--claude` too the `.claude` link to it is created.
- `claude_alone_then_both_updates_both`: `--user --claude`, then `--user --agents --claude` →
  `home/.claude/skills/uraeda` stays a real folder, `home/.agents/skills/uraeda` a copy.
- `notes_a_copy_at_the_other_scope`: repository with `.agents/skills/uraeda/SKILL.md`,
  `--user --agents` → last line
  `note    another copy in .agents/skills/uraeda: Claude Code reads the user's copy, other agents the repository's`;
  and `--repo --agents` with a home copy → `note another copy in ~/.agents/skills/uraeda: ...`.
- `outside_a_repository`: `--user --agents` in a temporary non-repository folder → first line
  `Install the Uraeda skill for: your user`, installed; `--repo --agents` there → exit 1,
  `ura: not in a git repository: run git init first`.
- `conflicting_flags`, table-driven: `--user --repo`, `--update --agents` → exit 1, stderr starts
  with `ura: the argument`.
- `home_not_set` (review focus 2), table-driven over `HOME` removed and `HOME=""` → exit 1,
  `ura: HOME is not set: set it, or pass --repo`. A new helper, `ura_without_home(dir, args)`, runs
  with `env_remove("HOME")`; the empty value goes through `ura_in`'s `env`.
- `a_stale_temporary_folder_is_replaced` (review focus 1): `home/.agents/skills/uraeda.ura-tmp/x.md`
  → install succeeds, `uraeda.ura-tmp` gone, no `x.md` in the skill.
- `a_failed_first_install_leaves_nothing`: `home/.agents/skills` made read-only (0o555) → exit 1,
  stderr starts with `ura: could not write ~/.agents/skills/uraeda`, and no
  `home/.agents/skills/uraeda`. Skipped when the test runs as root (`id -u` is `0`).
- `the_manifest_checks_with_sha256sum`: moved from `tests/init.rs`, on the home folder.

In `crates/cli/src/install.rs`, `#[cfg(test)]`: `resolves_answers`, one row per line of the spec's
resolution table: (flags, interactive, in_repo) → expected `Choice`s or error text.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test install`
- Expected: FAIL to compile, or `error: unrecognized subcommand 'install'` in every test.

- [ ] **Step 3: Implement `actions::install`**

`install` handles each chosen path by what `symlink_metadata` finds, as the spec's
[Data](spec.md#data) table says, `.agents` first. A first copy writes every file and the manifest
into the sibling `uraeda.ura-tmp` (removed first when present), then `fs::rename`s it; on error it
removes the temporary folder. An update is today's `install_skill` loop, without its first-install
branch. Every I/O error becomes `ActionError::Io(format!("could not write {shown_path}: {error}"))`,
with the shown path of the file or folder written.

- [ ] **Step 4: Implement `terminal.rs` and `ura install` with flags**

`Flags { user, repo, agents, claude, update, no_input }`, clap `conflicts_with` for `user`/`repo`
and `update`/`agents`/`claude`. `run` resolves; a `Choice::Ask` stops with
`unimplemented!("pickers: task 4")`. A `Choice::Implied(Scope::User)` prints its answer line first.
After the lines, a `note` line for each `existing` path at the other scope (the repository only when
in one). Add a row to `SKILL.md`'s command table, after `ura init`: the command `ura install`, with
`--user`, `--repo`, `--agents`, `--claude`, and `--update`, which "Installs the skill", linked to
**Setting up a project**.

- [ ] **Step 5: Run all tests**

- Run: `vp run ready`
- Expected: PASS, the existing `tests/init.rs` included, since `ura init` still installs through the
  moved code.

- [ ] **Step 6: Commit**

```bash
git add crates skills/uraeda/SKILL.md
git commit -m "feat(review-uraeda-init): ura install with flags"
```

## Task 2: `ura install --update`

**Files:**

- Modify: `crates/core/src/actions/install.rs`, `crates/cli/src/install.rs`
- Test: `crates/cli/tests/install.rs`

**Interfaces:**

- Consumes: task 1's `install` module and `resolve`.
- Produces: `pub fn update(base: &Path, shown: &str) -> Result<Vec<InstallLine>, ActionError>`:
  every path of `AGENTS_DIR`, `CLAUDE_DIR` that is a real folder with `MANIFEST`, updated; an empty
  list when there is none.

- [ ] **Step 1: Write the failing tests**

- `update_keeps_edited_files`: install `--user --agents`, then set `references/plan.md` to an
  unedited old text and `SKILL.md` to an edited one, as task 1's test does → `--user --update`
  stdout is exactly
  `kept    ~/.agents/skills/uraeda/SKILL.md: edited since installed\nupdated ~/.agents/skills/uraeda/ (1 file)\n`.
- `update_follows_what_was_installed`: `--user --claude`, then `--user --update` → the `.claude`
  folder updated, no `home/.agents`.
- `update_with_nothing_installed`: `--user --update` on an empty home → stdout
  `nothing to update: ura installed no skill in ~/\n`, exit 0, home still empty; and
  `--repo --update` → `nothing to update: ura installed no skill in this repository\n`.
- `update_skips_links_and_foreign_folders`: a link at `.claude` and a folder without a manifest at
  `.agents` → `nothing to update: ...`, both unchanged.
- `update_without_a_scope`: `--update` with stdin closed →
  `ura: no terminal to ask: pass --user or --repo`.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test install update`
- Expected: FAIL, `update_keeps_edited_files` on its stdout.

- [ ] **Step 3: Implement `update`, and `--update` in `ura install`**

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(review-uraeda-init): ura install --update"
```

## Task 3: `ura init` without the skill

**Files:**

- Modify: `crates/core/src/actions/init.rs` (`run(root: &Path)`, `InitLine` keeps `Created` and
  `Kept`), `crates/cli/src/init.rs`, `crates/cli/src/main.rs` (`Init { no_input }`),
  `skills/uraeda/SKILL.md` (**Setting up a project**)
- Test: `crates/cli/tests/init.rs`, rewritten

**Interfaces:**

- Consumes: `install::existing`, `install::home`, `terminal::interactive`.
- Produces: `uraeda_core::actions::init::run(root: &Path) -> Result<Vec<InitLine>, ActionError>`; in
  the CLI, `init::offer(root: &Path, interactive: bool) -> Result<(), String>`, whose interactive
  branch is `unimplemented!("pickers: task 4")` until task 4.

- [ ] **Step 1: Write the failing tests**

In `crates/cli/tests/init.rs`, on `TestRepo` and its home:

- `sets_up_specs_only_from_a_subfolder`: today's first test, with the skill in the home folder
  (`ura install --user --agents` first) → the `specs/` files, no `.agents` or `.claude` in the
  repository, last line the `Next:` line, no `No Uraeda skill` line.
- `keeps_existing_files`: unchanged.
- `leaves_a_committed_skill_alone`: `.agents/skills/uraeda/references/plan.md` = `old\n` and a
  `.claude/skills/uraeda` link → after `ura init`, both byte for byte the same, the link's target
  unchanged.
- `no_skill_is_refused`: `ura init --no-skill` → exit 1, stderr contains
  `unexpected argument '--no-skill'`, no `specs/`.
- `without_a_terminal_names_ura_install`: empty home → the line before the `Next:` line is
  `No Uraeda skill found: install it with ura install --user --agents --claude.`, home still empty;
  same with `--no-input`.
- `no_line_when_a_skill_exists`, table-driven: a link at `home/.claude/skills/uraeda`, a folder at
  the repository's `.agents/skills/uraeda` → no line about the skill.
- `home_not_set_prints_the_line` (review focus 2): `HOME` removed, and `HOME=""` → the
  `No Uraeda skill found` line, exit 0.
- `outside_a_repository`: unchanged.

Remove the skill tests moved in task 1.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test init`
- Expected: FAIL, `sets_up_specs_only_from_a_subfolder` finding `.agents` in the repository.

- [ ] **Step 3: Implement**

`init::run` loses `skill` and the install. The CLI prints the `specs/` lines, calls `offer` when
`existing` is empty at both the home folder (if any) and the top level, then the `Next:` line.
Rewrite **Setting up a project**'s last paragraph in `SKILL.md`: `ura init` sets up `specs/` and,
when no Uraeda skill is found, offers to install it for the user; `ura install` installs or updates
the skill, for the user (`--user`) or the repository (`--repo`), in `.agents/skills/uraeda/`
(`--agents`), `.claude/skills/uraeda` (`--claude`), or both, the second linked to the first, with a
`.ura-manifest` so that running it again updates the files nobody edited, never writing into a
folder it did not install or through a link; `--update` updates every copy it installed; agents
always pass the flags and `--no-input`, since an agent's terminal can pass the check yet not press
keys.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates skills/uraeda/SKILL.md
git commit -m "feat(review-uraeda-init): ura init sets up specs/ only"
```

## Task 4: The pickers

**Files:**

- Create: `crates/cli/src/picker.rs`
- Modify: `Cargo.toml`
  (`ratatui = { version = "0.30.2", default-features = false, features = ["crossterm"] }` in
  `[workspace.dependencies]`), `crates/cli/Cargo.toml` (`ratatui.workspace = true`),
  `crates/cli/src/install.rs` (the `Ask` branches), `crates/cli/src/init.rs` (`offer`'s interactive
  branch), `crates/cli/src/output.rs` (`pub fn colours()`)

**Interfaces:**

- Produces, in `picker`:
  - `pub struct Item { pub label: String, pub detail: String }`; a select row is `{label}{detail}`
    (`"Your user, in ~/"` + `": every repository on this machine"`), a multi row
    `[x] {label padded to the longest + 3 spaces}{detail}`
  - `pub struct Picker`, `Picker::select(title: &str, items: Vec<Item>, cursor: usize)`,
    `Picker::multi(title: &str, items: Vec<Item>, checked: Vec<bool>)`
  - `pub enum Answer { One(usize), Many(Vec<bool>) }`,
    `pub enum Step { Continue, Done(Answer), Cancel }`
  - `Picker::handle(&mut self, event: &Event) -> Step`, `Picker::render(&self, frame: &mut Frame)`,
    `Picker::height(&self) -> u16` (title, items, help)
  - `pub fn run(picker: Picker) -> std::io::Result<Option<Answer>>`: `try_init_with_options` with
    `Viewport::Inline(height)`, draws, reads `crossterm::event::read()` until `Done` or `Cancel`,
    clears the viewport, `restore()`s on every return, `None` on cancel

- [ ] **Step 1: Write the failing tests**

In `picker.rs`, `#[cfg(test)]`:

- `keys`, table-driven, one row per key sequence on a two-item picker → final `Step` and cursor:
  `[Enter]` → `Done(One(0))`; `[Down, Enter]` → `One(1)`; `[Down, Down, Enter]` → `One(1)`;
  `[Up, Enter]` → `One(0)`; `[j, Enter]` → `One(1)`; `[j, k, Enter]` → `One(0)`; `[Esc]`, `[q]`,
  `[Ctrl-C]` → `Cancel`; on a multi picker with both checked, `[Enter]` → `Many([true, true])`,
  `[Down, Space, Enter]` → `Many([true, false])`, `[Space, Down, Space, Enter]` → `Continue` with
  the warning on; review focus 5: `[a, 1, Tab, Resize(80, 24), Enter]` → `Done(One(0))`, and `Space`
  on a select picker changes nothing; key release events are ignored.
- `draws_the_scope_picker`, `draws_the_folder_picker`, `draws_nothing_checked`: render on
  `TestBackend::new(100, picker.height())` with `NO_COLOR`-free styles, and compare the buffer's
  lines, trimmed at the end, to mockup states 1, 2, and 3 of [the mockup](mockups/install.txt).
- `the_cursor_reads_without_colour`: with colours off, the cursor row starts with `> ` and its cells
  carry no foreground colour.

In `install.rs`, `#[cfg(test)]`: `answer_lines`: `answer_line(Scope::User)` is
`Install the Uraeda skill for: your user`, `folders_line(Folders { agents: true, claude: false })`
is `Into: .agents/skills`.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli picker`
- Expected: FAIL to compile: no `picker` module.

- [ ] **Step 3: Implement `picker.rs`**

The cursor row is bold cyan (`Color::Cyan`) when `output::colours()`, the help line dim; the warning
is set by Enter with nothing checked, cleared by Space. Ctrl-C arrives as a key in raw mode.

- [ ] **Step 4: Wire the pickers**

`ura install`: `Ask` scope → select of `Your user, in ~/` and
`This repository, in <top-level folder name>/`, cursor 0; `Ask` folders → multi of `.agents/skills`
(`Codex, Gemini CLI, Copilot, Cursor, OpenCode, Amp`) and `.claude/skills` (`Claude Code`), both
checked; each closed picker prints its answer line; a cancel returns
`Err("cancelled: nothing installed")`. `ura init`'s `offer`: select of
`Yes, in ~/: every repository on this machine` and `No`; Yes prints `... your user? yes` then the
folder picker and the install's lines; No, or a cancel at either picker, prints `... your user? no`
when at the question, then `Skill not installed: install it later with ura install.`, and `ura init`
exits 0.

- [ ] **Step 5: Run all tests, and the size**

- Run: `vp run ready`, then `cargo build --release -p uraeda-cli && stat -c %s target/release/ura`
- Expected: PASS; the size near 4,998,000 bytes, as the discovery measured: record it in the commit
  body.

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml Cargo.lock crates
git commit -m "feat(review-uraeda-init): pickers for ura install and ura init"
```

## Task 5: `ura upgrade` updates the user's skill

**Files:**

- Modify: `crates/cli/src/upgrade.rs`, `skills/uraeda/SKILL.md` (the `ura upgrade` row)

**Interfaces:**

- Produces: `fn installer(install: &Install, tag: &str, exe: &Path) -> Command`, and
  `fn newer(current: &str, latest: &str) -> bool` (`latest != current`, as today's check).

- [ ] **Step 1: Write the failing tests**

In `upgrade.rs`'s tests:

- `the_script_updates_the_skill_after_the_installer`:
  `installer(&Install::Script, "v0.2.0", Path::new("/home/me/.cargo/bin/ura"))` → program `sh`, args
  `["-c", INSTALL, "sh", "{RELEASES}/download/v0.2.0/uraeda-cli-installer.sh", "/home/me/.cargo/bin/ura"]`;
  `INSTALL` starts with `set -e` and its last line is `"$2" install --user --update --no-input`.
- `homebrew_updates_the_skill_after_brew`: `Install::Homebrew` → `sh -c BREW sh mrtolkien/tap/ura`;
  `BREW` starts with `set -e`, then `brew upgrade "$1"`, then
  `"$(brew --prefix "$1")/bin/ura" install --user --update --no-input`.
- `the_latest_release_installs_nothing`: `newer("0.2.0", "0.2.0")` is false,
  `newer("0.1.0", "0.2.0")` true.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --bin ura upgrade`
- Expected: FAIL to compile: no `installer`.

- [ ] **Step 3: Implement**

`run` keeps `exec`ing, now `installer(...).exec()`. The `ura upgrade` row of `SKILL.md`'s table
becomes `Installs \`ura\`'s latest release, then updates the user's skill`.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/cli/src/upgrade.rs skills/uraeda/SKILL.md
git commit -m "feat(review-uraeda-init): ura upgrade updates the user's skill"
```

## Task 6: CI, README, and a check in a terminal

**Files:**

- Modify: `.github/workflows/ci.yml` (size step), `README.md` (**Install**, **The `ura` CLI**, and
  the "To start in a project" paragraph)

- [ ] **Step 1: Remove the size test from CI**

The step keeps its build and `echo "ura: $size bytes"`, and drops `test "$size" -lt 5000000`.

- [ ] **Step 2: Update the README**

**Install**: `ura install` installs the skill for your user or the repository, `ura init` sets up
`specs/` and offers it; `npx skills add mrtolkien/uraeda` stays for those without `ura`;
`ura upgrade` also updates your skill. **The `ura` CLI**:
`ura init  # specs/, and the skill offered for your user` and a new
`ura install --user  # the skill, for your agents` line.

- [ ] **Step 3: Check the terminal paths by hand**

In a terminal, with `HOME` set to a temporary folder and a new repository: `ura install` and two
Enter (US1 scenario 5, SC-001), Down Enter Down Space Enter (scenario 6), Esc (scenario 10), and
`ura init` with Enter Enter (US3 scenario 1), then No (scenario 2). Expected: the outputs of
[the mockup](mockups/install.txt), states 4, 10, 11, and the terminal usable after each. Record the
result in the commit body.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "docs(review-uraeda-init): ura install in the README, no size limit in CI"
```
