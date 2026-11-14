# Uraeda

Uraeda is a git-driven, asynchronous development workflow for coding agents. Humans write proposals,
answer questions, and approve specs. Agents investigate, ask, and write specs, plans, and code, and
every step is checkpointed as plain text in git. The project is an early proof of concept: the
workflow ships as an agent skill, with `ura`, a small command-line tool that checks its files, says
what is next, and serves pages to answer and review on. Other people's tools run the agents and hold
the human's notes.

It works like an asynchronous [superpowers](https://github.com/obra/superpowers), with
[Spec Kit](https://github.com/github/spec-kit)'s file names where they fit: a capable agent does the
hard work upfront, autonomously, and the human only answers the questions only they can decide and
approves specs, in files built so their time goes into thinking, not searching. It targets technical
users for now.

## A human's request stands above everything

A human's direct request stands higher than any test, decision, rule, or the constitution. Never
refuse it, never water it down, and never silently overrule it: not by reverting it, not by skipping
it, not by bending it to fit.

If a request conflicts with an existing test, a decision, or the constitution, do it anyway when it
is safe and reversible, or stop when it is not, and tell the human in the same response: what
conflicts, and what each way out costs. The human arbitrates. A test that fails because of a
requested change is the test to change or remove, after telling the human, never the request.

## Constitution

Read `specs/CONSTITUTION.md` before any work. It holds the project's principles, ordered by
priority: when two conflict, the higher one wins. Its MUST and SHOULD rules are binding, and any
conflict with them must be resolved by a human. Only a human amends it: report a problem instead of
editing it.

## Understanding the workflow

- `skills/uraeda/SKILL.md` and its `references/`: the workflow, its source of truth.
- `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/`: the reference for what good
  artifacts look like. Read it before writing or changing a template, a reference, or an example
  file. `skills/uraeda/assets/example/notes/` is the example of the human's notes.
- `README.md`: user-facing, for people discovering the project. It describes what Uraeda is and
  links into the skill and the example, with a quick install. Every way to install is in
  `INSTALL.md`, the reference for users (the `ura` CLI and its pages, the `specs/` folder) in
  `docs/`, and building, testing, and releasing in `CONTRIBUTING.md`. The
  [documentation guide](specs/guides/documentation.md) says what goes where: update the page a
  change makes wrong.
- `specs/guides/`: how testing, statuses, and the documentation are meant to work. Read the one for
  the area you touch.
- `specs/decisions/`: the boundaries the human set, each in their own words, with a case each rule
  settles. Short enough to read all of them before any work.
- What is being worked on, the inbox, and proposals not started yet are in the human's notes,
  outside git: `ura vault ls projects/uraeda` lists them, as the skill's `references/notes.md` says.

## Repository layout

- `skills/uraeda/`: the Uraeda skill, harness-agnostic, following the
  [Agent Skills format](https://agentskills.io/specification)
  - `SKILL.md`: the entry point that finds the current workflow step and stops at human gates
  - `references/`: one file per workflow step, and one each for the conventions, the human's notes,
    setting up and starting features, the `ura` CLI, and the steps by hand
  - `assets/templates/`: artifact skeletons, `specs/` at the same paths as in a user's `specs/`
    folder, and `notes/` for the human's notes
  - `assets/example/`: a filled-in example project (todo app), its `specs/` and its `notes/`
- `specs/`: Uraeda's own workflow files. Not the templates installed in users' projects.
- `crates/`: Rust, in one cargo workspace
  - `core/` (`uraeda-core`): the workflow logic, parsing, validation, and states, the settings, and
    a read of git with gix
  - `text/` (`uraeda-text`): what is read in a Markdown text alone, its document tree, links, and
    the patch between two texts
  - `serve/` (`uraeda-serve`): `ura serve`'s pages, drawn as HTML in Rust with plain JavaScript and
    CSS embedded, and the desktop's side of the vault's sync
  - `vault/` (`uraeda-vault`): the human's notes, one vault for every repository: its layout, its
    links to the specs, the sync's plan, and the Obsidian plugin the sync carries to the phone
  - `cli/` (`uraeda-cli`): the `ura` binary
  - `xtask/` (`uraeda-xtask`): the repository's own tools: the start of a release, `just release`,
    and the tests of the toolchain's configuration
- `benchmarks/`: the benchmark's suites, cases, simulated human, and each run's record, scores, and
  specs. Their runner is gone, and waits for a new one (see its [README](benchmarks/README.md))
- `fixtures/`: workflow files the tests and the sandbox share, some broken on purpose
- `scripts/`: the shell scripts the recipes run
- `justfile`: every check and build, as recipes

The [stack](specs/decisions/stack.md) and [toolchain](specs/decisions/toolchain.md) decisions say
what goes where. Code marked `TEMPORARY:` is a placeholder that a named feature replaces: change it
freely, and do not build on it.

A change to the workflow touches the skill, its templates, and the example together: a step's
reference, its template, and the example's file must agree.

Markdown files can link to any file in the repository. Write markdown links with a relative path or
a path from the repository root (`/src/...`). Humans may also write wikilinks (`[[file-name]]`).

## Shell

- Commands run in zsh or fish, where an unquoted glob that matches no file fails the whole command
  (`no matches found: --include=*.ts`). Quote globs, `--include='*.ts'`, or use `rg -g '*.ts'`.
- Run the toolchain inside the dev shell, `nix develop -c <command>`: outside it, `cargo nextest`,
  `just`, and other pinned tools are missing. The toolchain is Rust 1.100.0 (`rust-toolchain.toml`).
- Every check and build is a recipe of the `justfile`, `nix develop -c just <recipe>`, and `just`
  lists them: `just task <crates>` after a task, `just check` after a merge, `just ready` for the
  full pass, `just fmt` to format, `just specs` to check `specs/` and the skill's example. The
  repository holds no Node, pnpm, or Vite+: a check that needs one is wrong. A commit is formatted
  by the hook of `.githooks/`, turned on once in a clone with `git config core.hooksPath .githooks`:
  it formats the staged text alone, and stops a commit whose file staged in part is not formatted.
- In a new worktree, the dev shell clones the `target/` of the closest checkout once, the feature's
  worktree for a task's, so the first build compiles only the workspace's crates: see
  `scripts/worktree-seed.sh`. `du` counts the clone's shared blocks; `btrfs filesystem du` does not.
- **To review a change to `ura serve`'s pages, run `nix develop -c just sandbox`**: `ura serve` over
  sample projects built from `fixtures/`, each feature's branch in a worktree, with a `gh` that
  lists their pull requests, at http://127.0.0.1:4420. Its state stays in `.sandbox/` until
  `just sandbox --reset` rebuilds it, and it never reads the human's projects or settings.
  `--port 0` takes a free port, and `--folder DIR` puts it elsewhere. Every page is reviewed on it,
  at a desk's width and a phone's. Stop a sandbox you started by its process id.
- Every test and sandbox recipe, and whatever `hidden-display` runs, goes through
  `scripts/isolated.sh`: its data, configuration, cache, and state folders are temporary, and the
  run fails when it wrote in the person's `uraeda-next` folders (ruling R356).
- **Never open a window on the human's screen without asking.** On Linux, `hidden-display <command>`
  runs a command on an X display of 1400 by 800 that no screen shows, with a session bus of its own,
  so a notification sent there reaches no desktop. It is how Obsidian is run to check the vault's
  sync: the command loses the session's Wayland display, so Electron apps take
  `--ozone-platform=x11`, as in `hidden-display obsidian --ozone-platform=x11`, on a vault in a
  temporary folder, never the human's.
- `ura serve` listens on 4320 by default, keeps its token in `uraeda-next` of the system's data
  folder, and reads `config.toml` in `~/.config/uraeda/`. A test or a run of yours always names its
  own port and data folder, `--port 0 --data-dir <a temporary folder>`, and its own config folder,
  `URAEDA_CONFIG_DIR`: never the human's settings or vault.

## Working with the human

- Give one complete response per turn. When a subagent's result matters to the answer, such as an
  adversarial review, wait for it, act on it, and only then respond, with its findings already taken
  into account. Never send a response and then a second one when the subagent finishes.
- Keep responses short: what changed, what the human must decide, and the next action.

## Authorship

Never mention a coding agent, a model, or an AI tool as an author or a tool used: not in commit
messages (no `Co-Authored-By` lines, no "generated with" footers), not in the README, not in any
file or pull request. This applies to every coding agent working on this repository. The work is
made by its human owner, who takes the decisions an agent executes, the same way a README does not
name the code editor it was written in.
