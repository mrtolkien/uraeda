---
kind: feature
finished: 2026-10-13
pull-request: https://github.com/mrtolkien/uraeda/pull/7
---

# Record: Review uraeda init and skill install flow

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-12, finished on
> 2026-10-13, in [its pull request](https://github.com/mrtolkien/uraeda/pull/7). Its full files are
> in git: `git log -- specs/2026-10-12-review-uraeda-init/`.

## What and why

`ura init` used to copy the skill into every repository it set up, which the human found inelegant:
"I don't like the skill living in all repos". `ura init` now sets up `specs/` only, and offers to
install the skill once for the user; a new `ura install` installs or updates it, for the user or a
repository, with two pickers built with ratatui, and flags for agents and scripts.

## Behaviour

- `ura install` asks, in a terminal, for the scope, the user first, then the repository, and for the
  folders, `.agents/skills` (Codex and most agents) and `.claude/skills` (Claude Code), both
  checked. Flags give every answer: `--user` or `--repo`, `--agents`, `--claude`. Without a
  terminal, or with `--no-input`, a missing answer exits 1 naming its flags, as in
  `ura: no terminal to ask: pass --user or --repo, and --agents, --claude, or both`. Esc, `q`, or
  Ctrl-C cancel with `ura: cancelled: nothing installed`. Outside a repository, the user is implied.
- With both folders, the skill is copied to `.agents/skills/uraeda/` with a `.ura-manifest` of
  hashes, and `.claude/skills/uraeda` links to it, with a target relative to the link's real folder;
  with one, it is copied there. Running it again updates the files nobody edited, and keeps and
  names the edited ones.
- `ura install` writes only into folders it created: a folder without `.ura-manifest`, like a copy
  from `npx skills add`, or a link, like one to a checkout of Uraeda, is kept whole and reported.
  Manifest paths outside the skill folder are ignored. A first copy goes through `uraeda.ura-tmp`,
  so a failure leaves nothing behind. A copy at the other scope is reported with a `note` line.
- `ura install --update` updates every copy ura installed at a scope, and installs nothing new;
  `nothing to update: ura installed no skill in ~/` when there is none.
- `ura init` writes `specs/` and nothing else, and never touches a skill committed by an older
  version. When no Uraeda skill exists for the user or in the repository, it asks
  `Install the Uraeda skill for your user?`, yes by default, then shows the folder picker; without a
  terminal, it prints `No Uraeda skill found: install it with ura install --user --agents --claude.`
  `--no-skill` is gone.
- `ura upgrade`'s shell runs the new binary's `ura install --user --update --no-input` once the
  installer or `brew upgrade` succeeded.
- CI prints the release binary's size and no longer fails on it.

## Design

The install logic left `ura init`'s action for its own, which takes a base folder, the home folder
or the repository's top level, and decides what to do with each skill path by what is there:
nothing, a folder with a manifest, a folder without one, or a link. The CLI resolves its answers
from flags in one table, and asks for the missing ones with one ratatui picker, inline under the
command's output, which leaves its answer as a line.

- The install action, `install`, `update`, and `existing`, in
  [`crates/core/src/actions/install.rs`](/crates/core/src/actions/install.rs); `ura init`'s action,
  `specs/` only, in [`init.rs`](/crates/core/src/actions/init.rs).
- `ura install`, its flags, answer resolution, and lines, in
  [`crates/cli/src/install.rs`](/crates/cli/src/install.rs); `ura init`'s offer in
  [`crates/cli/src/init.rs`](/crates/cli/src/init.rs).
- The picker, its key handling separate from its drawing, in
  [`crates/cli/src/picker.rs`](/crates/cli/src/picker.rs), and the terminal check shared with
  `ura draft`, in [`crates/cli/src/terminal.rs`](/crates/cli/src/terminal.rs).
- The upgrade shells, in [`crates/cli/src/upgrade.rs`](/crates/cli/src/upgrade.rs).
- Every CLI test runs with its own temporary `HOME`, through
  [`crates/cli/tests/common/mod.rs`](/crates/cli/tests/common/mod.rs).

## Questions

### Round 01

#### Q1: Which agent folders does `ura install` write?

**Answer:** A: a multi-select of `.agents/skills` and `.claude/skills`, both checked; with both, a
copy in `.agents` and a link from `.claude`, with `--agents` and `--claude` flags.

#### Q2: Which library draws the pickers?

**Answer:** A: ratatui, drawing inline, as the proposal said, and as the planned TUIs will.

#### Q2.A: What is the binary's size limit?

**Answer:** "Remove the hard cap: we are trying to keep the binary _as small as possible_ while
bringing in necessary features", with binary optimization later.

#### Q3: What does `ura init` say about the skill?

**Answer:** A: when no Uraeda skill exists, it asks in a terminal to install it for the user, and
prints a line naming `ura install` without one; `--no-skill` goes away.

#### Q4: How does a user-level skill stay in step with `ura`?

**Answer:** A: `ura upgrade` runs the new binary's install on the user's copies after the installer.

#### Q5: What else is in scope?

**Answer:** A: neither a removal command nor a Claude Code plugin, "We'll review distribution
later".

## Decisions

- [TUI](../decisions/tui.md), new: every TUI of `ura` is drawn with ratatui on crossterm, prompts
  draw inline and leave their answer as a line, and TUIs use the terminal's 16 colours and read
  without colour.
- [CLI](../decisions/cli.md), changed: CI prints the binary's size without failing on it, and a
  feature that adds a CLI dependency measures its size.

## Changes after approval

- `ura install --repo --update` with nothing installed says `... no skill in this repository` (R1).
- `j` and `k` move in the pickers, like the arrows (R3).
- The `Install the Uraeda skill for: your user` line prints only when the scope was implied, outside
  a repository, not with `--user` (R6); no `note` line when the home folder is the repository (R7).
- The picker leaves raw mode itself, and calls `ratatui::restore` only on a panic, which would leave
  an alternate screen the inline viewport never entered (R9).
- `ura upgrade`'s shell uses `set -e` rather than `&&`, with the same effect (R10).
- From the final review: the `.claude` link's target is relative to its real folder, so a linked
  `~/.claude` works, and a link counts as ura's own only when it reaches the `.agents` copy (R11);
  manifest paths outside the skill folder are ignored; the README's install line passes every flag.
- The release binary is 4,928,984 bytes with ratatui, its defaults off (R4).
- `vp test`'s browser stage could not start on the machine that built it: missing Playwright webkit,
  or a taken port (R8).

## Follow-ups

- An update follows links inside an installed folder, like a `references/` replaced by a link to the
  user's own folder: its unedited files can be rewritten or removed there.
- The `--no-input` half of `ura init`'s no-terminal test passes with stdin closed whether or not the
  flag works: a unit test of `offer`, or a pseudo-terminal test, would pin it.
- Terminal paths are checked by hand in a pseudo-terminal, not by `vp run ready`.
- Distribution, like a Claude Code plugin, and a removal command, left for later (Q5).
