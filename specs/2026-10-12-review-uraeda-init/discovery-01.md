# Discovery, round 01: Review uraeda init and skill install flow

## Summary

Tools that ship agent instructions install them in one of two places: in each repository, per agent
(Spec Kit, OpenSpec), or once per user, through a plugin or a shared folder (superpowers, Gemini
CLI's default, Vercel's `skills -g`). Installers that do both ask two things, like the proposal: the
scope, user or project, and the agents. Vercel's `skills` CLI keeps one copy in `.agents/skills/`
and links each agent's own folder to it.

No single folder reaches every agent: Claude Code reads only `.claude/skills/`, Codex only
`.agents/skills/`, and most other agents read both. Today, `ura init` writes `specs/`, then copies
the embedded skill into the repository's `.agents/skills/uraeda/`, with a manifest of hashes, and
links `.claude/skills/uraeda` to it. The proposal moves the skill out of `ura init` into a new
`ura install`, with two pickers built with ratatui: user or repository, and `.agents/skills` or
`.claude/skills`.

What is in the way: `ura` has no TUI yet, so the picker library is a new dependency, and the binary
is 212 KB under the 5 MB limit its CI enforces, which ratatui alone almost fills. A user-level skill
also needs a way to stay in step with the binary when `ura` is upgraded.

## How other products do it

### Spec Kit

- `specify init <project> --integration <key>` installs one agent's files in the repository; without
  `--integration`, a terminal prompts for one, and a session without one defaults to Copilot
  ([core reference](https://github.github.io/spec-kit/reference/core.html)).
- Each agent gets its own folder: Claude `.claude/skills`, Codex `.agents/skills`, Copilot
  `.github/skills`, Cursor `.cursor/skills`. Only one integration, Hermes, installs at user level
  ([integrations](https://github.github.io/spec-kit/reference/integrations.html)).
- `specify integration install|upgrade|uninstall` manages them. Upgrades use a manifest of hashes,
  and keep files edited since they were installed unless `--force` is passed
  ([upgrade](https://github.github.io/spec-kit/upgrade.html)), like `ura init` today.
- Its picker is hand-written on `readchar` and `rich`. Its `--non-interactive` flag exists because
  "agent harnesses often allocate a PTY (so `isatty()` is True) but cannot send arrow-key input,
  which previously hung in `select_with_arrows`"
  ([`command_init.py`](https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/command_init.py)).

### OpenSpec

- `openspec init` prompts for the tools to set up, or takes `--tools claude,cursor|all|none`
  ([CLI docs](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md)).
- Everything is per repository: `.claude/skills/openspec-*` for Claude, `.agents/skills` for Codex,
  and an `agents` target for ".agents/skills/, the shared root many agent tools read"
  ([supported tools](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/supported-tools.md)).
- `openspec update` rewrites the generated files after a CLI upgrade: they are "OpenSpec's to own"
  ([CLI docs](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md)).

### Vercel's `skills` CLI

- `npx skills add <repo>` asks for the scope, project by default or `-g` for the user, and the
  agents, `-a <agent>`; `-y` skips the prompts
  ([README](https://raw.githubusercontent.com/vercel-labs/skills/main/README.md)). The README
  already tells Uraeda's users to run it ([README](/README.md)).
- It keeps one copy in `<project>/.agents/skills` or `~/.agents/skills`, and links each agent's own
  folder to it, or copies with `--copy`
  ([`installer.ts`](https://raw.githubusercontent.com/vercel-labs/skills/main/src/installer.ts)).
- `skills update` refreshes installs from a lock file of hashes, `~/.agents/.skill-lock.json` for
  the user
  ([`skill-lock.ts`](https://raw.githubusercontent.com/vercel-labs/skills/main/src/skill-lock.ts)),
  and `skills remove` removes them
  ([README](https://raw.githubusercontent.com/vercel-labs/skills/main/README.md)).

### superpowers

- Installed once per user, as each agent's plugin or extension: `/plugin install` in Claude Code,
  Codex's plugin marketplace, `gemini extensions install`, and others. Nothing is copied into
  repositories, and updates are "often automatic"
  ([README](https://raw.githubusercontent.com/obra/superpowers/main/README.md)).

### Gemini CLI and Amp

- `gemini skills install <git> --scope user|workspace` installs at user level by default
  ([skills](https://geminicli.com/docs/cli/skills/)).
- `amp skill add <src>` installs in the project, or in `~/.config/agents/skills/` with `--global`
  ([skills](https://ampcode.com/docs/customize/skills)).

### What they have in common

- A scope choice, user or project, with flags for both, and the agents to install for.
- A non-interactive path for every prompt: flags, plus an explicit switch to never prompt.
- An update path that keeps the user's edits, or says it overwrites them.
- A way to remove what was installed: `uninstall`, `remove`, or the plugin manager.
- Tools that install per user (superpowers, Gemini CLI) go through each agent's plugin system;
  file-copying installers (Spec Kit, OpenSpec, Vercel) default to the project.

## Standards and libraries

### Where agents read skills

- [Agent Skills](https://agentskills.io/specification) mandates no location. Its client guide
  recommends `.agents/skills/` and `~/.agents/skills/` as "a widely-adopted convention for
  cross-client skill sharing", and a project skill overriding a user one
  ([adding skills support](https://agentskills.io/client-implementation/adding-skills-support.md)).
- Claude Code: `~/.claude/skills/` and `.claude/skills/`, symlinks followed; `.agents/skills` is not
  documented. A personal skill wins over a project one of the same name
  ([skills](https://code.claude.com/docs/en/skills)).
- Codex: `.agents/skills` from the current folder up to the repository root, and `~/.agents/skills`,
  symlinks followed; no `.claude/skills` ([skills](https://learn.chatgpt.com/docs/build-skills)).
- Both folders, at both levels: Gemini CLI (`.agents` as an alias, winning within a tier)
  ([skills](https://geminicli.com/docs/cli/skills/)), VS Code and Copilot
  ([agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)), Cursor
  ([skills](https://cursor.com/docs/context/skills)), OpenCode
  ([skills](https://opencode.ai/docs/skills/)), and Amp
  ([skills](https://ampcode.com/docs/customize/skills)).

### Claude Code plugins

- A git repository with `.claude-plugin/marketplace.json` is installed with
  `claude plugin install x@market --scope user|project|local`; auto-update is off by default for
  third-party marketplaces ([install](https://code.claude.com/docs/en/plugins/install),
  [marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)). The server already wraps the
  skill as a plugin, [`packages/server/plugin/`](/packages/server/plugin/), for `--plugin-dir`
  ([agents decision](../decisions/agents.md)).

### Picker libraries

Measured in this session: a binary with clap and two pickers, built with `ura`'s release profile
([`Cargo.toml`](/Cargo.toml): LTO, `opt-level = "z"`, stripped), against the same binary with clap
alone (524,072 bytes).

| Crate                                                                                                   | Version | Added size | What it gives                                                    |
| ------------------------------------------------------------------------------------------------------- | ------- | ---------- | ---------------------------------------------------------------- |
| [ratatui](https://ratatui.rs/faq/), with crossterm 0.29                                                 | 0.30.2  | 209,992 B  | A full TUI framework: the select list, keys, and restore by hand |
| [dialoguer](https://raw.githubusercontent.com/console-rs/dialoguer/main/README.md), no default features | 0.12.0  | 36,248 B   | Ready `Select`, `MultiSelect`, `Confirm`                         |
| [inquire](https://raw.githubusercontent.com/mikaelmello/inquire/main/README.md)                         | 0.9.4   | 265,480 B  | Ready prompts; `NotTTY` error without a terminal                 |
| [cliclack](https://raw.githubusercontent.com/fadeevab/cliclack/main/README.md)                          | 0.3.8   | 203,256 B  | Clack-style prompts, the look of Vercel's `skills`               |

- ratatui can draw inline, under the shell's output, with `Viewport::Inline`
  ([docs](https://docs.rs/ratatui/latest/ratatui/enum.Viewport.html)).
- cliclack's latest release is 0.5.6; 0.3.8 is what cargo resolved for `"0.3"`, so its size is
  indicative.

## The code

### Important reads

- [`crates/core/src/actions/init.rs`](/crates/core/src/actions/init.rs): `run(root, skill)` writes
  the three `specs/` files and the `.gitkeep` folders, then `install_skill` copies the embedded
  skill to `.agents/skills/uraeda/` with a `.ura-manifest` in `sha256sum` format, rewriting only
  files whose hash matches the manifest and removing old files nobody edited, and `link_claude`
  links `.claude/skills/uraeda` to `../../.agents/skills/uraeda`, unix only, keeping any existing
  path. The install logic takes a repository root but nothing in it is specific to a repository.
- [`crates/cli/src/init.rs`](/crates/cli/src/init.rs) and [`main.rs`](/crates/cli/src/main.rs):
  `ura init [--no-skill]`, printing one line per path.
- [`crates/cli/tests/init.rs`](/crates/cli/tests/init.rs): the install, the update of unedited
  files, `--no-skill`, an existing `.claude/skills/uraeda` kept, and the manifest checked by
  `sha256sum`.
- [`crates/cli/tests/skill.rs`](/crates/cli/tests/skill.rs): every subcommand must be named in the
  skill, so `ura install` needs a line in [`SKILL.md`](/skills/uraeda/SKILL.md).
- [`crates/core/src/embedded.rs`](/crates/core/src/embedded.rs): the whole skill is embedded with
  `include_dir`, as the [CLI decision](../decisions/cli.md) requires.
- [`crates/cli/src/upgrade.rs`](/crates/cli/src/upgrade.rs): `ura upgrade` replaces its own process
  with the installer script or `brew upgrade` (`exec`), so nothing runs after it; Nix installs are
  refused.
- [`crates/cli/src/editor.rs`](/crates/cli/src/editor.rs): the only terminal check today, stdin and
  stdout terminals and `TERM` not `dumb`. No command has `--no-input` yet, and no TUI exists.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): `ura next` prints references as
  `skills/uraeda/references/<step>.md`, a path inside the skill, wherever it is installed.
- [`.github/workflows/ci.yml`](/.github/workflows/ci.yml): CI fails when `target/release/ura` is
  5,000,000 bytes or more. Built in this session, it is 4,787,616 bytes: 212,384 bytes to spare. The
  limit rose from 3 MB to 5 MB in [CLI core](../done/2026-10-10-cli-core.md#changes-after-approval),
  and the [git decision](../decisions/git.md) notes the TUIs will draw on it.
- [`skills/uraeda/SKILL.md`](/skills/uraeda/SKILL.md#setting-up-a-project) and
  [`README.md`](/README.md): both describe `ura init` installing the skill; the README also offers
  `npx skills add mrtolkien/uraeda`.
- [CLI core record, Q15](../done/2026-10-10-cli-core.md#q15-does-ura-init-install-the-skill): the
  human chose the repository install, with an option to skip it, which became `--no-skill`.
- [`specs/drafts/cli-tuis.md`](../drafts/cli-tuis.md): the planned answer, review, and draft TUIs,
  "Use ratatui for TUI", in **Later** of [PRIORITIES.md](../PRIORITIES.md).
- On this machine, `~/.claude/skills/uraeda` is a symlink to this repository's `skills/uraeda`, and
  `~/.agents/skills/` holds other skills: a user install must not overwrite such a link.

### The proposal's path and existing actions

- **`ura init` in a new repository**: today it writes `specs/` and the skill. With the proposal,
  only `specs/`; the skill comes from `ura install`, or is already there at user level.
- **`ura init` run again**: today it updates the repository's unedited skill files. With the
  proposal, it no longer touches them, so repositories set up before stay on their old copy until
  someone acts.
- **`ura init --no-skill`**: the flag loses its meaning.
- **`ura install` without a terminal**, by an agent or a script: the
  [CLI decision](../decisions/cli.md) requires flags for both pickers, and an exit 1 naming them.
  Spec Kit's lesson applies: an agent's PTY passes the terminal check and cannot press arrows, so
  `--no-input` and the skill telling agents to pass flags matter.
- **`ura install` run again**: the manifest logic updates unedited files at either level.
- **`ura upgrade`**: a user-level skill stays at the old version, since upgrade `exec`s the
  installer. A repository-level one is per project, as today.
- **A skill both at user level and in the repository**: Claude Code prefers the personal one, the
  Agent Skills guide the project one, so two versions can disagree.
- **The server's runs**: unaffected, they load the server's own copy with `--plugin-dir`
  ([agents decision](../decisions/agents.md)).
- **A collaborator cloning a project**: today they get the skill with the repository; with a user
  install, they install it themselves.
  [`specs/README.md`](/skills/uraeda/assets/templates/specs/README.md) still links to the skill, as
  principle V requires ([constitution](../CONSTITUTION.md#v-tools-are-optional)).

### Likely changes

- [`crates/core/src/actions/init.rs`](/crates/core/src/actions/init.rs): `run` loses the skill; the
  install moves to a new `actions/install.rs`, taking a base folder (`~` or the repository root) and
  the folders to write. Under every option.
- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs), a new `crates/cli/src/install.rs`: the
  command, its flags, and its pickers. Under every option.
- [`crates/cli/src/init.rs`](/crates/cli/src/init.rs): the closing hint or offer, depending on
  [what `ura init` says about the skill](#what-ura-init-says-about-the-skill).
- [`Cargo.toml`](/Cargo.toml), [`crates/cli/Cargo.toml`](/crates/cli/Cargo.toml): the picker
  library, depending on [the picker library](#the-picker-library).
- [`.github/workflows/ci.yml`](/.github/workflows/ci.yml): the size limit, with ratatui or inquire.
- [`crates/cli/src/upgrade.rs`](/crates/cli/src/upgrade.rs): depending on
  [keeping the skill in step](#keeping-the-skill-in-step-with-ura).
- [`crates/cli/tests/init.rs`](/crates/cli/tests/init.rs), a new `tests/install.rs`.
- [`skills/uraeda/SKILL.md`](/skills/uraeda/SKILL.md): **Setting up a project** and the command
  table; [`README.md`](/README.md): setup and the command list.

## The proposal

### The second picker cannot reach every agent

The proposal asks for `.agents/skills` or `.claude/skills`. Claude Code reads only the second, Codex
only the first ([where agents read skills](#where-agents-read-skills)), so a single choice leaves
one of them out. Today's install, and Vercel's, write both through a link.

### "Offer" in `ura init`

The **What** says `ura init` is now only about the repository, without the skills; the **Why** says
it "should offer to install the skill for the active user". Whether it prompts, prints a hint, or
does nothing is open.

### Ratatui and the size limit

The proposal names ratatui. It adds 209,992 bytes of the 212,384 left
([picker libraries](#picker-libraries)), so `ura install` would ship at 2 KB under the limit, and
the next change would break CI. The library is also a new dependency, which lasts beyond this
feature.

### Existing repository installs

Projects set up with `ura init` keep a committed `.agents/skills/uraeda/` and
`.claude/skills/uraeda`. The proposal does not say what happens to them.

## Approaches

Criteria come from the [proposal](proposal.md) (no skill in every repository, a user install, two
pickers), the constitution (principle V,
[tools are optional](../CONSTITUTION.md#v-tools-are-optional); principle VI, explicit and simple
code), and the [CLI decision](../decisions/cli.md) (flags for every TUI action, `--no-input`, the
skill embedded).

### Agent folders

Which folders `ura install` writes. Relies on [where agents read skills](#where-agents-read-skills)
and [the second picker](#the-second-picker-cannot-reach-every-agent).

| Option                                                      | Claude Code | Codex | Others | Matches                |
| ----------------------------------------------------------- | ----------- | ----- | ------ | ---------------------- |
| A. Pick one or both; both is a copy in `.agents` and a link | yes         | yes   | yes    | Vercel's `skills`      |
| B. Pick one, as the proposal says                           | one of them |       | yes    | the proposal's wording |
| C. No picker: always both                                   | yes         | yes   | yes    | today's `ura init`     |

### What `ura init` says about the skill

| Option                                                     | Scriptable                 | Matches the proposal's "offer" |
| ---------------------------------------------------------- | -------------------------- | ------------------------------ |
| A. Asks, in a terminal, to install for the user            | yes, no prompt without one | yes                            |
| B. Prints a hint naming `ura install` when no skill exists | yes                        | partly                         |
| C. Says nothing                                            | yes                        | no                             |

### The picker library

A new dependency, which the later TUIs would share. Relies on [picker libraries](#picker-libraries)
and [the size limit](#ratatui-and-the-size-limit).

| Option       | Added size | Code to write                    | Shared with the planned TUIs |
| ------------ | ---------- | -------------------------------- | ---------------------------- |
| A. ratatui   | 210 KB     | a select widget and its key loop | yes, the draft names it      |
| B. dialoguer | 36 KB      | none: ready prompts              | no, a second library later   |
| C. inquire   | 265 KB     | none                             | no                           |
| D. cliclack  | 203 KB     | none                             | no                           |

With A, C, or D, the size limit rises or the binary shrinks.

### Keeping the skill in step with `ura`

A user-level skill is shared by every project on the machine, like the binary; nothing updates it
today after `ura upgrade` ([upgrade](/crates/cli/src/upgrade.rs)).

| Option                                                              | Covers Homebrew and Nix | Code                            |
| ------------------------------------------------------------------- | ----------------------- | ------------------------------- |
| A. `ura upgrade` runs the new binary's install on the user's copies | Homebrew, not Nix       | upgrade waits instead of `exec` |
| B. `ura install` again, by hand, as today's `ura init`              | yes, by hand            | none                            |
| C. Commands warn when the installed skill's version differs         | yes                     | a version in the manifest       |

### Scope beyond the proposal

What [other installers](#what-they-have-in-common) have that the proposal does not ask for: a
removal command, and distribution as a Claude Code plugin, as superpowers does.

| Option                                                 | Cost                                                      |
| ------------------------------------------------------ | --------------------------------------------------------- |
| A. Neither                                             | none; deleting the folder removes the skill               |
| B. `ura install --remove`                              | a small action, reusing the manifest                      |
| C. A Claude Code plugin marketplace in this repository | a `marketplace.json` and a release step; Claude Code only |

### Needs no choice

- **Scope picker, user or repository**: the proposal asks for it, and every installer has it.
- **Non-interactive path**: required by the [CLI decision](../decisions/cli.md).
- **Updates keeping edits**: the manifest logic already does it, at any base folder.
- **Existing repository installs**: reported, never deleted, see the settled points.

## Not checked

- The last part of [Claude Code's skills page](https://code.claude.com/docs/en/skills) was not read.
- [Spec Kit's overview](https://github.github.io/spec-kit/reference/overview.html) had no `init`
  flags; the core reference and the source were used instead.
- Windows: the link is unix only today, and was not investigated further.
