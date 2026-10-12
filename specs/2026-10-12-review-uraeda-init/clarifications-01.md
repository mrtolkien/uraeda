---
status: answered
---

# Clarifications, round 01: Review uraeda init and skill install flow

> [!NOTE]
>
> Answered on 2026-10-12.
>
> - Two choices last beyond this feature: the picker library, which the planned TUIs would share,
>   and the binary's size limit, which ratatui alone almost fills: 210 KB of the 212 KB left.
> - A gap in the proposal: no single folder reaches every agent. Claude Code reads only
>   `.claude/skills`, Codex only `.agents/skills`, so the second picker should allow both.
> - A user-level skill falls behind the binary after `ura upgrade` unless something refreshes it.
> - Eight points are settled without you, at the end, including what happens to projects that
>   already have the skill committed.

## Context

The [proposal](proposal.md) takes the skill out of `ura init`, which then only sets up `specs/`, and
adds `ura install`, with two ratatui pickers: user or repository, and `.agents/skills` or
`.claude/skills`. `ura init` should offer to install the skill for the user.

Today, [`ura init`](/crates/core/src/actions/init.rs) writes `specs/`, copies the skill embedded in
the binary to the repository's `.agents/skills/uraeda/`, with a `.ura-manifest` of hashes so that
running it again updates only the files nobody edited, and links `.claude/skills/uraeda` to it.
`--no-skill` leaves the skill out. `ura` has no TUI yet.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Which agent folders does `ura install` write?

Claude Code reads skills only from `.claude/skills`, Codex only from `.agents/skills`, and Gemini
CLI, Copilot, Cursor, OpenCode, and Amp read both, at user and project level. Vercel's `skills` CLI,
like `ura init` today, keeps one copy in `.agents/skills` and links `.claude/skills` to it. More in
[discovery](discovery-01.md#agent-folders).

Why it matters: a single choice leaves either Claude Code or Codex without the skill.

- **A (recommended). The second picker is a multi-select of `.agents/skills` (Codex and most agents)
  and `.claude/skills` (Claude Code), both checked by default; with both, the skill is copied to
  `.agents/skills/uraeda` and `.claude/skills/uraeda` links to it. Flags: `--agents`, `--claude`, or
  both.**
  - [pro] every agent with one install, and either folder alone for those who want it.
  - [con] a link to maintain, unix only, as today.
  - Why recommended: it keeps the proposal's picker and fixes its gap, the way established
    installers do.
- **B. The second picker is a single choice between `.agents/skills` and `.claude/skills`, as the
  proposal says.**
  - [pro] the simplest picker, no link.
  - [con] Claude Code and Codex users must run it twice, getting two copies to keep in step.
- **C. No second picker: `ura install` always writes both, as `ura init` does today.**
  - [pro] one question fewer.
  - [con] a `.claude` folder for people who do not use Claude Code, and the reverse.

**Answer:** A

## Q2: Which library draws the pickers?

`ura` has no TUI yet, so this adds a dependency. Measured on `ura`'s release profile, two pickers
add 210 KB with ratatui, which needs its select list and key loop written by hand, 36 KB with
dialoguer's ready prompts, 265 KB with inquire, and 203 KB with cliclack. The planned answer,
review, and draft TUIs name ratatui ([draft](../drafts/cli-tuis.md)). The binary has 212 KB left
under its 5 MB limit: Q2.A. More in [discovery](discovery-01.md#the-picker-library).

Why it matters: the library becomes the base of every later TUI, or a second library next to ratatui
once those come.

- **A (recommended). ratatui, drawing inline under the shell's output, as the proposal says.**
  - [pro] one TUI library for `ura`, already chosen for the planned TUIs.
  - [con] a select widget to write, about 100 lines by my estimate, and the size limit must rise.
  - Why recommended: the TUIs will bring ratatui anyway, so another library now would be a second
    one later.
- **B. dialoguer, its ready `Select` and `MultiSelect`.**
  - [pro] 36 KB, almost no code.
  - [con] a second library once the planned TUIs adopt ratatui, with a different look.
- **C. inquire or cliclack, ready prompts with a more polished look.**
  - [pro] the look of Vercel's `skills` installer, with cliclack.
  - [con] as heavy as ratatui, and still a second library later.

**Answer:** A

### Q2.A: What is the binary's size limit?

Only if you picked A or C in Q2. CI fails at 5,000,000 bytes; `ura` is 4,787,616 bytes today, and
would be about 4,998,000 with ratatui: the next change would fail. You raised the limit from 3 MB to
5 MB during [CLI core](../done/2026-10-10-cli-core.md#changes-after-approval). More in
[discovery](discovery-01.md#ratatui-and-the-size-limit).

- **A (recommended). Raise it to 6 MB.**
  - [pro] room for the planned TUIs' screens.
  - [con] less pressure to keep dependencies small.
  - Why recommended: the TUIs need room, and 6 MB is still small next to Spec Kit's or OpenSpec's
    runtimes.
- **B. Raise it to 5.5 MB, and ask again for the TUIs.**
  - [pro] a tighter budget keeps dependencies in check.
  - [con] the question comes back with the next TUI.

**Answer:** Remove the hard cap: we are trying to keep the binary _as small as possible_ while
bringing in necessary features. We'll do some binary optimization later too, right now it's pretty
basic.

## Q3: What does `ura init` say about the skill?

Your proposal says `ura init` should "offer to install the skill for the active user", while it is
"now just about setting up the current repo". Without a terminal, `ura init` must not prompt
([CLI decision](../decisions/cli.md)). More in
[discovery](discovery-01.md#what-ura-init-says-about-the-skill).

Why it matters: it decides whether a new user leaves `ura init` with a working skill.

- **A (recommended). When no Uraeda skill exists at user level or in the repository, `ura init` asks
  in a terminal "Install the skill for your user?", yes by default, then runs `ura install` at user
  level, with its folder picker; without a terminal, or with `--no-input`, it prints a line naming
  `ura install`. `--no-skill` goes away.**
  - [pro] the offer you asked for, and one command to get started.
  - [con] `ura init`'s first prompt.
  - Why recommended: it is what the proposal asks, and stays scriptable.
- **B. `ura init` never prompts, and prints a line naming `ura install` when no skill exists.**
  - [pro] `ura init` stays one non-interactive command.
  - [con] a second command to run before the agent knows the workflow.

**Answer:** A

## Q4: How does a user-level skill stay in step with `ura`?

A user's skill is shared by all their projects, like the binary, and must match the commands the
binary has ([CLI decision](../decisions/cli.md)). `ura upgrade` replaces its own process with the
installer script or `brew upgrade`, so nothing runs after it today; Nix installs are updated through
their flake. OpenSpec has `openspec update` for this, Vercel `skills update`. More in
[discovery](discovery-01.md#keeping-the-skill-in-step-with-ura).

Why it matters: a stale skill names commands or rules the binary no longer has.

B can come on top of A.

- **A (recommended). `ura upgrade` waits for the installer, then runs the new binary's install on
  every user-level copy that has a `.ura-manifest`, keeping edited files as today.**
  - [pro] upgrading the binary upgrades the skill, with nothing to remember.
  - [con] Nix users still run `ura install` by hand.
  - Why recommended: it covers the common installs with no new concept.
- **B. `ura install` records `ura`'s version in the manifest, and `ura next` and `ura status` warn
  when the user's skill comes from another version.**
  - [pro] covers Nix and copies installed by hand.
  - [con] a warning line in commands agents read.
- **C. Nothing: running `ura install` again updates it, as `ura init` does today.**
  - [pro] no code.
  - [con] a skill falls behind silently.

**Answer:** A

## Q5: What else is in scope?

Spec Kit, Vercel's `skills`, and plugin managers can remove what they installed. superpowers ships
as a Claude Code plugin, installed with `/plugin install`, and the server already wraps the skill as
a plugin for its own runs. More in [discovery](discovery-01.md#scope-beyond-the-proposal).

Why it matters: each one is more to build and maintain in this feature.

B and C can be combined.

- **A (recommended). Neither: deleting the skill's folder removes it.**
  - [pro] the smallest feature.
  - [con] no command to undo `ura install`.
  - Why recommended: removal is one `rm`, and a plugin serves Claude Code only, unlike
    `ura install`.
- **B. `ura install --remove`, deleting the files nobody edited and the link.**
  - [pro] a clean undo.
  - [con] one more flag and its tests.
- **C. A Claude Code plugin marketplace in this repository, for `/plugin install`.**
  - [pro] updates through Claude Code's plugin manager.
  - [con] Claude Code only, and a second way to install to document.

**Answer:** A: We'll review distribution later

## Settled without the human

- **The scope picker** offers user level first, as the default, then the repository; flags `--user`
  and `--repo`, as every installer has. See [discovery](discovery-01.md#needs-no-choice).
- **Without a terminal, or with `--no-input`**, `ura install` takes its answers from flags and exits
  1 naming the missing ones, as the [CLI decision](../decisions/cli.md) requires; the skill tells
  agents to pass flags, since an agent's terminal can pass the check yet not press arrows, which
  hung Spec Kit. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The install logic is today's**, moved out of `ura init`: the copy, the `.ura-manifest`, the
  updates of unedited files, at `~` or the repository root. See
  [discovery](discovery-01.md#important-reads).
- **An existing link or folder at `.claude/skills/uraeda`**, like a link to a checkout of this
  repository, is kept and reported, never overwritten, as today. See
  [discovery](discovery-01.md#important-reads).
- **Projects with the skill committed** keep it: `ura init` no longer touches it, and `ura install`
  at user level reports a repository copy, since Claude Code prefers the user's copy and other
  agents the project's. Nothing is deleted. See
  [discovery](discovery-01.md#existing-repository-installs).
- **`ura next`** keeps printing references inside the skill, `skills/uraeda/references/<step>.md`,
  wherever the skill is installed. See [discovery](discovery-01.md#important-reads).
- **The server's runs** are unaffected: they load the server's own copy as a plugin
  ([agents decision](../decisions/agents.md)).
- **The skill and the README** describe `ura install` in **Setting up a project** and the command
  table, and keep `npx skills add mrtolkien/uraeda` for those without `ura`. See
  [discovery](discovery-01.md#likely-changes).

**Notes:**
