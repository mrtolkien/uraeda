---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Review uraeda init and skill install flow

> [!NOTE]
>
> Approved on 2026-10-12.
>
> - New decision, [TUI](../decisions/tui.md): ratatui is `ura`'s only TUI library, its prompts draw
>   inline, and every TUI uses the terminal's 16 colours and reads without colour.
> - Changed decision, [CLI](../decisions/cli.md#proposed-change-2026-10-12-review-uraeda-init): I
>   read "remove the hard cap" as CI printing the binary's size without ever failing on it, and each
>   new dependency's size being measured in its feature. Say so if you wanted the size step gone
>   entirely.
> - `ura install` never writes into a skill folder ura did not install, nor through a link: your
>   `~/.claude/skills/uraeda`, a link to your checkout, stays as it is, and so does a copy from
>   `npx skills add`.
> - `ura upgrade` runs the new binary's `ura install --user --update` after the installer, in the
>   same shell, so `ura` is not running while the installer replaces it. Upgrades from versions
>   before this feature do not refresh the skill: `ura install` must run once.
> - `ura init --no-skill` is removed: scripts passing it fail with clap's unknown-argument error.
> - Risk tier `medium`: a new command writing in the user's home folder, and a first dependency for
>   TUIs. The plan does not wait for your review.

`ura init` stops writing the skill into repositories: it sets up `specs/` only, and offers to
install the skill once for the user, when no Uraeda skill is found. A new command, `ura install`,
installs or updates the skill, for the user or in the repository, in `.agents/skills`,
`.claude/skills`, or both, with two ratatui pickers in a terminal and flags without one;
`ura upgrade` keeps a user's copy in step with the binary. It serves `ura`'s users, who no longer
get a skill committed to every project, and their agents. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Install the skill for your user (P1)

A user runs `ura install`. In a terminal, a first picker asks for the scope, the user or the current
repository, and a second one for the folders, `.agents/skills` and `.claude/skills`, both checked.
With both, the skill is copied to `.agents/skills/uraeda/`, and `.claude/skills/uraeda` links to it;
with one, the skill is copied there. Flags give every answer: `--user` or `--repo`, and `--agents`,
`--claude`, or both. The mockups are in [Mockups](#mockups), and `~` below is the user's home
folder.

Why this priority: it is the proposal's new command, and the only way to get the skill once
`ura init` stops writing it.

Acceptance scenarios:

1. **Given** a home folder with no `.agents` or `.claude` folder, **When**
   `ura install --user --agents --claude` runs without a terminal, **Then**
   `~/.agents/skills/uraeda/` holds every file of the embedded skill and a `.ura-manifest`,
   `~/.claude/skills/uraeda` is a link to `../../.agents/skills/uraeda`, and stdout is
   `created ~/.agents/skills/uraeda/ (<N> files)` then
   `linked  ~/.claude/skills/uraeda -> ../../.agents/skills/uraeda`, with `<N>` the skill's number
   of files.
2. **Given** an empty home folder, **When** `ura install --user --claude` runs, **Then**
   `~/.claude/skills/uraeda/` is a folder with the skill and its `.ura-manifest`, and no `~/.agents`
   folder exists.
3. **Given** an empty home folder, **When** `ura install --user --agents` runs, **Then**
   `~/.agents/skills/uraeda/` holds the skill, and no `~/.claude` folder exists.
4. **Given** a repository with a `crates/` folder, **When** `ura install --repo --agents --claude`
   runs in `crates/`, **Then** the skill is in the repository's top level, `.agents/skills/uraeda/`,
   linked from `.claude/skills/uraeda`, and nothing is written in the home folder.
5. **Given** a terminal and an empty home folder, in a repository, **When** the user runs
   `ura install` and presses Enter twice, **Then** the result is that of scenario 1, and the output
   keeps the lines `Install the Uraeda skill for: your user` and
   `Into: .agents/skills, .claude/skills`.
6. **Given** a terminal, in a repository, **When** the user runs `ura install`, presses Down and
   Enter, then Down, Space, and Enter, **Then** the skill is copied to the repository's
   `.agents/skills/uraeda/` only, and the output keeps
   `Install the Uraeda skill for: this repository` and `Into: .agents/skills`.
7. **Given** no terminal, **When** `ura install --user` runs, **Then** it exits 1, stderr is
   `ura: no terminal to ask: pass --agents, --claude, or both`, and nothing is written.
8. **Given** no terminal, **When** `ura install` runs, **Then** it exits 1, stderr is
   `ura: no terminal to ask: pass --user or --repo, and --agents, --claude, or both`, and nothing is
   written.
9. **Given** a terminal, **When** `ura install --no-input --agents` runs, **Then** it exits 1,
   stderr is `ura: no terminal to ask: pass --user or --repo`, and nothing is written.
10. **Given** a terminal, **When** the user runs `ura install` and presses Esc in either picker,
    **Then** it exits 1, stderr is `ura: cancelled: nothing installed`, and nothing is written. `q`
    and Ctrl-C do the same.

### US2: Set a repository up without the skill (P1)

`ura init` writes the `specs/` folder, and nothing else in the repository. A repository set up by an
older `ura init` keeps its skill as it is.

Why this priority: it is the proposal's first ask, "the skill living in all repos" is what the human
does not want.

Acceptance scenarios:

1. **Given** a repository without `specs/`, and a home folder with the skill, **When** `ura init`
   runs, **Then** it creates the files and `.gitkeep` folders of `specs/` it creates today, the
   repository has no `.agents` or `.claude` folder, and the last line of stdout is
   `Next: ask your agent to write specs/CONSTITUTION.md with you, then commit.`
2. **Given** a repository with `.agents/skills/uraeda/` and `.claude/skills/uraeda` from an older
   `ura init`, its `references/plan.md` older than the embedded one, **When** `ura init` runs,
   **Then** every file of both paths is unchanged, byte for byte.
3. **Given** any repository, **When** `ura init --no-skill` runs, **Then** it exits 1 with clap's
   error for an unexpected argument, and writes nothing.

### US3: `ura init` offers the skill for your user (P2)

When no Uraeda skill exists, for the user or in the repository, `ura init` asks in a terminal
whether to install it for the user, yes by default, then shows the folder picker of US1. Without a
terminal, or with `--no-input`, it prints a line naming the command to run.

Why this priority: a new user leaves `ura init` with a working skill, as the proposal's "should
offer to install the skill for the active user" asks
([Q3](clarifications-01.md#q3-what-does-ura-init-say-about-the-skill)); US1 alone already delivers
the skill.

Acceptance scenarios:

1. **Given** a terminal, a new repository, and an empty home folder, **When** the user runs
   `ura init` and presses Enter at `Install the Uraeda skill for your user?`, then Enter in the
   folder picker, **Then** `specs/` is created, the home folder holds the skill as in US1's scenario
   1, and the last line is the `Next:` line.
2. **Given** the same, **When** the user picks `No`, or presses Esc or Ctrl-C at the question,
   **Then** nothing is written in the home folder, the output keeps
   `Install the Uraeda skill for your user? no`, then
   `Skill not installed: install it later with ura install.`, the last line is the `Next:` line, and
   `ura init` exits 0.
3. **Given** no terminal, a new repository, and an empty home folder, **When** `ura init` runs,
   **Then** the line before the `Next:` line is
   `No Uraeda skill found: install it with ura install --user --agents --claude.`, and nothing is
   written in the home folder. `ura init --no-input` in a terminal does the same.
4. **Given** a terminal, and `~/.claude/skills/uraeda` a link to a checkout of Uraeda, **When**
   `ura init` runs, **Then** it asks nothing, and prints no line about the skill.
5. **Given** a terminal, an empty home folder, and a repository with `.agents/skills/uraeda/`,
   **When** `ura init` runs, **Then** it asks nothing, and prints no line about the skill.

### US4: The user's skill follows `ura upgrade` (P2)

`ura install --update` updates every copy ura installed at a scope, in place, keeping the files the
human edited, without asking for folders. `ura upgrade` runs it for the user, with the new binary,
once the installer is done.

Why this priority: a user's skill is shared by all their projects, and a stale one names commands
the binary no longer has
([Q4](clarifications-01.md#q4-how-does-a-user-level-skill-stay-in-step-with-ura)).

Acceptance scenarios:

1. **Given** `~/.agents/skills/uraeda/` installed by an older `ura`, whose `references/plan.md` is
   unedited and differs from the embedded one, and whose `SKILL.md` the human edited, **When**
   `ura install --user --update` runs, **Then** `references/plan.md` is the embedded text,
   `SKILL.md` is unchanged, and stdout is
   `kept    ~/.agents/skills/uraeda/SKILL.md: edited since installed` then
   `updated ~/.agents/skills/uraeda/ (1 file)`.
2. **Given** `~/.claude/skills/uraeda/` installed alone by `ura install --user --claude`, **When**
   `ura install --user --update` runs, **Then** that folder is updated, and no `~/.agents` folder is
   created.
3. **Given** a home folder where ura installed nothing, **When** `ura install --user --update` runs,
   **Then** stdout is `nothing to update: ura installed no skill in ~/`, it exits 0, and nothing is
   written.
4. **Given** `ura` installed by the installer script at `~/.cargo/bin/ura`, and a newer release,
   **When** `ura upgrade` runs, **Then** the shell that runs the installer then runs
   `~/.cargo/bin/ura install --user --update --no-input`, only if the installer succeeded.
5. **Given** `ura` installed by Homebrew, and a newer release, **When** `ura upgrade` runs, **Then**
   after `brew upgrade mrtolkien/tap/ura` succeeds, the same shell runs
   `"$(brew --prefix mrtolkien/tap/ura)/bin/ura" install --user --update --no-input`.
6. **Given** the latest release already installed, **When** `ura upgrade` runs, **Then** it prints
   `ura <version> is the latest release`, as today, and runs no install.

## Edge cases

- **A link at a skill path**: `ura install` never writes through a link. With both folders,
  `~/.claude/skills/uraeda` as a link to `/home/me/dev/uraeda/skills/uraeda` is reported as
  `kept    ~/.claude/skills/uraeda: a link to /home/me/dev/uraeda/skills/uraeda`; the link ura
  makes, to `../../.agents/skills/uraeda`, as `kept    ~/.claude/skills/uraeda`. A link at
  `.agents/skills/uraeda` is reported the same way, and nothing is written through it.
- **A skill folder ura did not install**, without `.ura-manifest`, like a copy from
  `npx skills add mrtolkien/uraeda -g`: kept untouched, reported as
  `kept    ~/.agents/skills/uraeda: not installed by ura`. With both folders chosen, a missing
  `.claude/skills/uraeda` is still linked to it.
- **Run again with nothing changed**: `kept    ~/.agents/skills/uraeda/: up to date`, and
  `kept    ~/.claude/skills/uraeda` for the link; nothing is written.
- **A newer skill drops a file**: the old file is removed when nobody edited it, and kept otherwise,
  as `ura init` does today.
- **`.claude/skills` alone, then both**: the `~/.claude/skills/uraeda/` folder, which has a
  manifest, is updated in place, and `~/.agents/skills/uraeda/` gets a copy: two copies, both
  updated by `--update`.
- **Another copy at the other scope**: `ura install --user` in a repository with
  `.agents/skills/uraeda` or `.claude/skills/uraeda` at its top level, or `ura install --repo` with
  either in the home folder, ends with
  `note    another copy in <path>: Claude Code reads the user's copy, other agents the repository's`,
  one line per copy. Nothing is deleted.
- **Outside a git repository**: the scope picker is skipped, since only the user scope is possible,
  and the output keeps `Install the Uraeda skill for: your user`. `--repo` exits 1 with
  `ura: not in a git repository: run git init first`.
- **Conflicting flags**: `--user` with `--repo`, and `--update` with `--agents` or `--claude`, exit
  1 with clap's conflict error.
- **`--update` without a scope**: in a terminal, the scope picker asks for it; without one, it exits
  1 with `ura: no terminal to ask: pass --user or --repo`.
- **No folder checked**: Enter in the folder picker does nothing, and its help line starts with
  `check at least one folder`.
- **`HOME` not set**: `ura install --user` exits 1 with
  `ura: HOME is not set: set it, or pass --repo`; `ura init` treats the user as having no skill,
  never asks, and prints the `No Uraeda skill found` line.
- **The first upgrade to this version**: the old `ura upgrade` replaces itself with the installer
  and runs nothing after it, so the user's skill is refreshed from the next upgrade on.
- **A failing installer or `brew upgrade`**: the shell stops, the skill is not touched, and
  `ura upgrade` exits with the installer's code.
- **Windows**: not supported, as the [toolchain](../decisions/toolchain.md) decision says; links are
  made on unix only, as today.

## Success criteria

- **SC-001**: In a terminal, from a new repository with no Uraeda skill anywhere, `ura init`
  installs the skill for the user with two presses of Enter, and no other key.
- **SC-002**: Without a terminal, `ura init` and `ura install` never wait for input: every test of
  [Testing](#testing) runs them with stdin closed, and each exits 0 or 1.
- **SC-003**: `ura init` writes nothing outside `specs/`, in every case.
- **SC-004**: `ura install` leaves every file under a link, or in a folder without `.ura-manifest`,
  byte for byte as it was.
- **SC-005**: CI prints the release binary's size, and passes whatever that size is.

## Design

### Approach

The install logic of `ura init`, the copy, the `.ura-manifest`, and the updates of unedited files,
moves unchanged into its own action, which takes a base folder: the home folder or the repository's
top level ([important reads](discovery-01.md#important-reads)). `ura install` resolves the scope and
the folders from its flags, asks for the missing ones with pickers in a terminal, and calls it;
`ura init` calls it for the user after its question. The pickers are built with ratatui, inline, as
the new [TUI](../decisions/tui.md) decision says, and every answer has a flag, as the
[CLI](../decisions/cli.md) decision requires. The install now refuses to write into folders it did
not create, since a user's home folder holds skills from other tools and links to checkouts, which a
repository rarely did. `ura upgrade` keeps replacing itself with a shell, so the installer can
replace the binary, and that shell runs the new binary's update after it
([keeping the skill in step](discovery-01.md#keeping-the-skill-in-step-with-ura)).

### Data

Nothing new is stored. The `.ura-manifest` keeps today's format, one `<sha256>  <path>` line per
file of the skill, as `sha256sum` writes it; it now also lives in `~/.agents/skills/uraeda/` and
`~/.claude/skills/uraeda/`.

The install's input, built by the command from flags and pickers:

- `base: PathBuf`: `$HOME` for the user, the repository's top level for `--repo`.
- `shown: &str`: the prefix of printed paths, `~/` for the user, empty for the repository.
- `folders: Folders { agents: bool, claude: bool }`, at least one `true`; or `update: true`, which
  takes no folders.

Its output is a list of lines, printed in order, each a verb padded to 8 columns and a path:

- `created <dir>/ (<N> files)`, `updated <dir>/ (<N> file|files)`, `linked  <link> -> <target>`;
- `kept    <path>`, with an optional `: <reason>`: `up to date`, `edited since installed`,
  `not installed by ura`, `a link to <target>`;
- `note    another copy in <path>: ...`, for a copy at the other scope.

What the install does with each chosen skill path, `<base>/.agents/skills/uraeda` or
`<base>/.claude/skills/uraeda`, by what is there:

| At the path                      | Install                                                       | `--update` |
| -------------------------------- | ------------------------------------------------------------- | ---------- |
| Nothing                          | Copy; for `.claude` with both chosen, link to `.agents`'s     | Skipped    |
| A folder with `.ura-manifest`    | Update the files nobody edited, from the manifest             | Same       |
| A folder without `.ura-manifest` | Kept, `not installed by ura`                                  | Skipped    |
| A link                           | Kept, `a link to <target>`, or plain `kept` for ura's own one | Skipped    |

A first copy is written to a temporary sibling folder, `uraeda.ura-tmp`, then renamed into place, so
a failed copy never leaves a folder without a manifest, which the next run would refuse.

How each command resolves its answers, `terminal` meaning stdin and stdout are terminals, `TERM` is
not `dumb`, and `--no-input` is not set:

| Missing                     | `terminal`                   | Otherwise                         |
| --------------------------- | ---------------------------- | --------------------------------- |
| Scope, in a repository      | Scope picker, the user first | Exit 1, naming `--user or --repo` |
| Scope, outside one          | The user, shown as an answer | The user                          |
| Folders, without `--update` | Folder picker, both checked  | Exit 1, naming the folder flags   |
| `ura init`'s question       | Yes or No, Yes first         | The `No Uraeda skill found` line  |

When both are missing without a terminal, one error names both, as in US1's scenario 8.

### Components

- **Install action** (`crates/core/src/actions/install.rs`, new): moved from
  [`init.rs`](/crates/core/src/actions/init.rs), with `install(base, shown, folders)`,
  `update(base, shown)`, and `existing(base) -> Vec<PathBuf>`, the skill paths present at a base,
  whatever their kind, for `ura init`'s check and the `note` lines. Depends on the embedded skill
  only; never on git or the terminal.
- **Init action** ([`init.rs`](/crates/core/src/actions/init.rs)): `run(root)` writes `specs/` only;
  its line type loses the skill's variants.
- **Picker** (`crates/cli/src/picker.rs`, new): `select(title, items, default)` and
  `multi_select(title, items, checked)`, returning the choice or `None` on cancel, drawn inline with
  ratatui and closed into their answer line. Its key handling is a state machine,
  `handle(key) -> Step`, separate from drawing, so tests run it without a terminal. Restores the
  terminal on every exit, panics included.
- **Terminal check** (`crates/cli/src/terminal.rs`, new): `interactive(no_input)`, the check of
  [`editor.rs`](/crates/cli/src/editor.rs)'s `available` moved here and shared by `ura draft`,
  `ura init`, and `ura install`.
- **`ura install`** (`crates/cli/src/install.rs`, new, and [`main.rs`](/crates/cli/src/main.rs)):
  `ura install [--user | --repo] [--agents] [--claude] [--update] [--no-input]`, resolving answers
  as the table of [Data](#data) says, then calling the install action and printing its lines.
- **`ura init`** ([`init.rs`](/crates/cli/src/init.rs)): drops `--no-skill`, adds `--no-input`, and
  after the `specs/` lines, when `existing` finds nothing at the home folder or the top level, asks
  or prints the hint; the `Next:` line stays last.
- **`ura upgrade`** ([`upgrade.rs`](/crates/cli/src/upgrade.rs)): the shell it becomes runs the
  installer, or `brew upgrade`, then, with `&&`, the new binary's
  `install --user --update --no-input`, as US4 says.
- **CI** ([`ci.yml`](/.github/workflows/ci.yml)): the size step prints `ura: <size> bytes` and no
  longer tests it.
- **Dependencies** ([`Cargo.toml`](/Cargo.toml), [`crates/cli/Cargo.toml`](/crates/cli/Cargo.toml)):
  ratatui 0.30, on its crossterm backend, without the features the picker does not use, in the CLI
  crate only.
- **The skill** ([`SKILL.md`](/skills/uraeda/SKILL.md)): **Setting up a project** says `ura init`
  sets up `specs/` and offers the skill for the user, and `ura install` installs or updates it, with
  its flags, telling agents to always pass them with `--no-input`, since an agent's terminal can
  pass the check yet not press keys; the command table gets `ura install`, and `ura upgrade`'s
  refresh of the user's skill.
- **The README** ([`README.md`](/README.md)): **Install** and **The `ura` CLI** name `ura install`,
  and keep `npx skills add mrtolkien/uraeda` for those without `ura`.

### Mockups

- [Install](mockups/install.txt): the scope picker and the folder picker open, the folder picker
  with nothing checked, the output of an install, of a run again next to a link and a repository
  copy, of `--update`, the errors without a terminal and on cancel, and `ura init`'s question, its
  answers, and its line without a terminal.

### Error handling

- **Flags missing without a terminal**: exit 1, `ura: no terminal to ask: pass ...`, naming only
  what is missing, as in US1; nothing is written.
- **Cancel** in `ura install`'s pickers: exit 1, `ura: cancelled: nothing installed`. In `ura init`,
  a cancel at the question or in the folder picker counts as No, and `ura init` exits 0, since
  `specs/` is written.
- **A failed write or link**: exit 1, `ura: could not write <path>: <system error>`. A first copy
  leaves nothing at the skill path; an update leaves the files already written, which the next run
  recognizes by their hash.
- **`HOME` not set, outside a repository, conflicting flags**: as in [Edge cases](#edge-cases).
- **A terminal error while drawing**: the terminal is restored, and `ura` exits 1 with
  `ura: <error>`.

### Testing

Integration tests run the built `ura` in a temporary repository, with stdin closed and `HOME` set to
a temporary folder that each test owns, as the shared helpers of
[`tests/common`](/crates/cli/tests/common/mod.rs) will do for every test, so no test reads or writes
the real home folder. Pickers are tested apart: their key handling as a table of key sequences and
outcomes, and their drawing on ratatui's `TestBackend`, against the mockup's text. Paths in the
terminal, which tests cannot drive without a pseudo-terminal, are checked by hand in the plan's last
task.

| What                                                                | Test                                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| US1 scenarios 1 to 4, 7 to 9                                        | One integration test each, in `tests/install.rs`                            |
| US1 scenarios 5, 6, 10; US3 scenarios 1, 2; SC-001                  | Table-driven test of the picker's keys; by hand in a terminal               |
| Picker states: open, nothing checked, answer line                   | `TestBackend` tests against [the mockup](mockups/install.txt)               |
| US2 scenarios 1 to 3; SC-003                                        | Integration tests in `tests/init.rs`, rewritten                             |
| US3 scenarios 3 to 5                                                | Integration tests in `tests/init.rs`, `--no-input` run under a closed stdin |
| US4 scenarios 1 to 3                                                | Integration tests in `tests/install.rs`                                     |
| US4 scenarios 4 to 6                                                | Unit tests of the shell command `ura upgrade` builds, per install kind      |
| Edge cases: links, no manifest, run again, dropped file, both later | Integration tests in `tests/install.rs`; SC-004 compares bytes before/after |
| Edge cases: other scope's copy, outside a repository, flags, `HOME` | Integration tests in `tests/install.rs`                                     |
| Answer resolution table of [Data](#data)                            | Table-driven test: flags, terminal, repository → picker, answer, or error   |
| SC-002                                                              | Every integration test above, with stdin closed and a test timeout          |
| SC-005                                                              | The CI run of the pull request                                              |
| `ura install` named in the skill                                    | The existing [`tests/skill.rs`](/crates/cli/tests/skill.rs)                 |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The scope picker offers the user first, as the default, then the repository; flags `--user` and
  `--repo`.
- Without a terminal, or with `--no-input`, `ura install` takes its answers from flags and exits 1
  naming the missing ones; the skill tells agents to pass flags.
- The install logic is today's, moved out of `ura init`, at the home folder or the repository's top
  level.
- An existing link or folder at `.claude/skills/uraeda` is kept and reported, never overwritten.
- Projects with the skill committed keep it: `ura init` no longer touches it, `ura install` reports
  it as another copy, and nothing is deleted.
- `ura next` keeps printing references as `skills/uraeda/references/<step>.md`.
- The server's runs are unaffected: they load the server's own copy as a plugin.
- The skill and the README describe `ura install`, and keep `npx skills add mrtolkien/uraeda`.

Settled while writing this spec:

- `ura install` writes only into folders it created: a folder without `.ura-manifest`, or a link, is
  kept whole. Today's `ura init` would add missing files to such a folder; in a home folder, that
  folder may be a checkout or another tool's install.
- `--update` updates every copy ura installed at the scope, in `.agents` and `.claude`, and installs
  nothing new, so `ura upgrade` never creates a folder the user did not choose.
- `ura upgrade` keeps replacing itself with a shell, which runs the update after the installer:
  waiting for the installer from a running `ura` could fail to replace its binary while it runs.
  Q4's "waits for the installer" holds, in that shell.
- `ura upgrade` does not refresh the skill when the binary is already the latest:
  `ura install --user --update` does it by hand.
- `ura init`'s question is a two-item picker, Yes and No, the same widget as the scope picker, and
  any Uraeda skill found, at either scope and of any kind, means no question.
- `ura init` keeps printing its lines on stdout, and `ura install` follows it; errors go to stderr.
- The size step stays in CI, printing the size without testing it
  ([Q2.A](clarifications-01.md#q2a-what-is-the-binarys-size-limit)). The [git](../decisions/git.md)
  decision's consequence mentioning a 3 MB limit is left as it was written.
- No change to the templates or the example: the setup section of the skill is not a workflow step.

## Decisions

New, applied when this spec is approved:

- [TUI](../decisions/tui.md): every TUI of `ura` is drawn with ratatui on crossterm, prompts draw
  inline and leave their answer as a line, and TUIs use the terminal's 16 colours and read without
  colour.

Changed, applied when this spec is approved:

- [CLI](../decisions/cli.md): CI prints the binary's size and never fails on it, and a feature that
  adds a CLI dependency measures its size; see its
  [proposed change](../decisions/cli.md#proposed-change-2026-10-12-review-uraeda-init).

Relied on:

- [CLI](../decisions/cli.md): the skill is embedded; every picker has flags, and `--no-input` or no
  terminal never starts one; `ura install` is named in the skill, and the skill changes with it.
- [Toolchain](../decisions/toolchain.md): the new dependency and tests run in `vp run ready`; the
  size step stays a CI-only step; Windows stays unsupported.
- [Git](../decisions/git.md): `ura install --repo` and `ura init` find the top level through the
  core's git module, and neither commits.
- [Agents](../decisions/agents.md): the server's runs keep their own copy of the skill.

## Constitution check

| Principle                        | Complies | Notes                                                                                                    |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control        | yes      | Within the answers; the new and changed decisions wait for this approval                                 |
| II. Git and plain text first     | yes      | The skill and its manifest are plain text; no workflow state moves out of git                            |
| III. Asynchronous by default     | yes      | Every prompt has flags; no step needs a terminal                                                         |
| IV. Review effort matches impact | yes      | Every question had a recommended answer; details settled here as assumptions                             |
| V. Tools are optional            | yes      | `specs/README.md` still links to the skill; it installs by hand or with `npx skills add` too             |
| VI. Code is checked against spec | yes      | Every scenario has a test; the picker, a new abstraction, is justified in the plan's complexity tracking |

## Risk tier

**Medium**: a new command writing in the user's home folder, and the first TUI dependency, with no
change to any workflow file's format.
