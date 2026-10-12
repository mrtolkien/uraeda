---
status: active
approved-by: mrtolkien
---

# CLI

The `ura` CLI is a fast path through the workflow, never the only one: every rule it follows or
checks is written in the skill, and every action it offers can be done by hand. It serves humans and
agents alike, with flags for every interactive action and versioned JSON for every read.

## Rules

- Every rule the CLI enforces or checks MUST be written in the skill, `skills/uraeda/`. The CLI MUST
  NOT require anything the skill does not state.
- The skill MUST keep the manual instructions of every step. A step SHOULD name the command that
  performs it, for agents to use when `ura` is installed.
- A change to a command's behaviour MUST update the skill in the same change, and a change to a
  skill rule a command follows MUST update the command.
- The CLI MUST embed the skill and its templates from `skills/uraeda/` at build time. No second copy
  of a template or a rule MAY live in the code.
- Commands that act on a feature, a bug, a draft, or a workflow file MUST take it as one optional
  target argument, resolved the same way everywhere: a path under `specs/`, or a name matching
  exactly one item (a folder name, a slug, or a draft's file name). Without a target, a command MUST
  use the current branch's feature, or the only item waiting for that action, and otherwise exit 1
  listing the candidates. Several matches MUST exit 1 listing them.
- Every action a TUI offers MUST also be available through flags, without a terminal. A TUI MUST
  start only when stdin and stdout are terminals and `--no-input` is not set; otherwise the command
  MUST exit 1 and name the flags to pass.
- Every read command MUST offer `--json`: an object with a top-level `"version"`, increased only for
  incompatible changes. Adding a field or a value MUST NOT increase it.
- Commands MUST print data to stdout and messages to stderr, exit 0 on success and 1 on any error,
  validation errors included, except a path not built yet, which MAY stop with `unimplemented!`, and
  print no colour without a terminal or when `NO_COLOR` is set.

## Why

The proposal asks for agents to go through the CLI, which is less error-prone than prose, while
principle V requires the workflow to work without it, and tools to enforce only rules that humans
and agents can follow unaided
([Q2](../done/2026-10-10-cli-core.md#q2-how-does-the-skill-send-agents-through-the-cli),
[the skill and the CLI](../done/2026-10-10-cli-core.md#q2-how-does-the-skill-send-agents-through-the-cli)).
Agents and runners need the same actions as humans, without a terminal, and a stable output to read
([command-line conventions](../done/2026-10-10-cli-core.md)). A skill that names commands must match
the binary that runs them
([Q15](../done/2026-10-10-cli-core.md#q15-does-ura-init-install-the-skill)).

## Alternatives considered

- CLI first, with the rules living in the CLI, like Backlog.md: the fewest agent errors, but it
  conflicts with principle V.

## Consequences

- The skill keeps its full length: commands are added to it, not substituted for it.
- Each command change is a skill change too, reviewed together.
- Runners and the web UI read stable JSON, and agents never meet a prompt they cannot answer.
- The binary carries the skill, about 300 KB of text.

## Applies to

- [`crates/cli/`](/crates/cli/), [`skills/uraeda/`](/skills/uraeda/), and every feature that adds or
  changes a command or a TUI
