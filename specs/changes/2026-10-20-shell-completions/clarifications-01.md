---
status: answered
---

# Clarifications, round 01: Tab completion for `ura` in fish and zsh

> [!NOTE]
>
> Answered on 2026-10-20.
>
> - Verdict: worth building as proposed. A prototype already completes subcommands and flags in
>   fish, and adds 70 KB to the binary.
> - How completion reaches your shell decides whether this stays a change. If `ura install` sets it
>   up, a new flag makes it a feature.
> - Homebrew installs the completion too, through a release step that adds one line to the formula
>   dist generates. It can only be tried on the next release.
> - Completion reads only local branches and files, never GitHub, so Tab stays fast.
> - `clap_complete`'s dynamic mode is marked unstable, so its version is pinned exactly.

## Context

### Goal

The [proposal](proposal.md) asks for Tab to complete `ura`'s commands in fish and zsh. In the chat,
you chose dynamic completion, where the shell asks the `ura` binary for candidates each time you
press Tab.

### Today

`ura` parses its arguments with clap 4 ([`main.rs`](/crates/cli/src/main.rs)) and has no completion.
Both shells complete file names instead.

A shell only asks a binary for completions after a small registration script tells it to.
[`clap_complete`](https://docs.rs/clap_complete/4.6.11/clap_complete/env/index.html) prints that
script when the binary runs with `COMPLETE=fish` or `COMPLETE=zsh`, and then answers each Tab
itself. Its documented setup is one line per shell:

| Shell | The line                      | Where                                 |
| ----- | ----------------------------- | ------------------------------------- |
| fish  | `COMPLETE=fish ura \| source` | `~/.config/fish/completions/ura.fish` |
| zsh   | `source <(COMPLETE=zsh ura)`  | `~/.zshrc`, after `compinit`          |

The line runs `ura` when the shell starts, so its script always matches the installed version. A
prototype, with one line added to `main`, completed subcommands and flags with their help text in
fish. The release binary grew from 7,202,200 to 7,272,344 bytes, 70 KB or 1%. The
[CLI](/specs/decisions/cli.md) decision asks each dependency to measure its cost and stay small.

Packages can install the script where each shell finds it without setup:
`share/fish/vendor_completions.d/` and `share/zsh/site-functions/`. The [flake](/flake.nix)'s
package can do it at build time. Homebrew supports this kind of completion directly:
`generate_completions_from_executable(bin/"ura", shell_parameter_format: :clap)` in a formula runs
`COMPLETE=<shell> ura` at install time
([`shell_completion.rb`](https://github.com/Homebrew/brew/blob/master/Library/Homebrew/utils/shell_completion.rb)).
But dist generates `ura`'s formula, and
[its template](https://github.com/axodotdev/cargo-dist/blob/main/cargo-dist/templates/installer/homebrew.rb.j2)
installs only the binary, with no setting to add a step
([dist#2429](https://github.com/axodotdev/cargo-dist/issues/2429), open). The installer script
writes only the binary too.

### Scope

Tab completion of `ura`'s subcommands, flags, and values in fish and zsh, and the documentation of
its setup. Bash and other shells come for free with `clap_complete`, but are not tested or
documented in this change.

### Sources

- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs), [`install.rs`](/crates/cli/src/install.rs),
  and [`init.rs`](/crates/cli/src/init.rs).
- The [CLI](/specs/decisions/cli.md) and [distribution](/specs/decisions/distribution.md) decisions.
- `clap_complete`'s
  [`env` module](https://docs.rs/clap_complete/4.6.11/clap_complete/env/index.html) and its
  [registration scripts](https://github.com/clap-rs/clap/blob/master/clap_complete/src/env/shells.rs).
- dist's [Homebrew installer](https://axodotdev.github.io/cargo-dist/book/installers/homebrew.html).

## Q1: How should completion reach your shell?

Example: you install `ura` with Homebrew on a new laptop, and type `ura st` then Tab.

Why it matters: it decides how many users get Tab completion without doing anything. Changing what
`ura install` does also changes a public command. The change flow makes that a feature, with its own
spec.

- **A (recommended). The Nix package installs the scripts, and the README and the skill's CLI
  reference give the one line per shell.**
  - Outcome: you paste one line into your fish or zsh config once, and Tab completes `start`.
  - [pro] no command or flag changes, and nothing writes to your shell's config.
  - [con] users of the installer script have one manual step.
  - Why recommended: the line never goes stale, and it stays a change.
- **B. Also have `ura install` offer to set it up, with a `--completions` flag for agents.**
  - Outcome: `ura install` asks whether to write `~/.config/fish/completions/ura.fish`, or to add
    the line to `~/.zshrc`, and Tab completes `start`.
  - [pro] no manual step on any install.
  - [con] `ura` edits your shell's config, and the change becomes a feature with its own spec.

**Answer:** A and B: No need for a full feature, this is small enough imo

Writing to `~/.config/fish/completions/ura.fish` is ok (no conflict, it's its own file), but for
~/.zshrc let's just tell the user to do it

## Settled without the human

### Check these

- **Homebrew installs the completion**: the release workflow's Homebrew publishing becomes a job of
  ours. It adds the `generate_completions_from_executable` line to dist's formula, then pushes it to
  the tap. It touches the release, which only a tag runs, so it is first tried on the next release.
  Homebrew's completion folders are found without setup by a fish or zsh from Homebrew; other shells
  need them added once, as Homebrew's [shell completion](https://docs.brew.sh/Shell-Completion) page
  says.
- **What Tab completes after a command**: `start` completes drafts and backlog entries. `next`,
  `review`, `clean`, and `check` complete the started features and changes, by slug, and so does
  `note --about`. `note --category` completes the inbox's categories, and `answer` completes the
  round's open questions. `--risk-tier` and `--plan-review` complete their values.
- **Completion never reaches GitHub**: it reads local branches and files only, since `ura status`
  takes 0.6 s with its pull request lookups. A candidate that needs a pull request's state is left
  out.

### Behaviour

- **Every command keeps its arguments and output**: the only addition is that `ura` answers
  `COMPLETE=<shell>` and prints nothing else then.

### Under the hood

- **`clap_complete` is pinned to an exact version**, since its dynamic mode is exempt from semver.
- **The tests run the completer** as fish and zsh call it, on a fixture repository, and check the
  candidates.

**Notes:**
