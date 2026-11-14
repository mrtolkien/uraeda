---
icon: terminal
---

# CLI

> "We should then tell our skill/reference files to use the CLI for all workflow steps which will be
> less error prone than telling an agent what it needs to do."

The constitution keeps the workflow working without any tool. So the `ura` CLI is a fast path
through the workflow, never the only one: the skill says everything it does. A TUI is a
full-terminal interactive screen, like a picker. The human chose its library, and asked for more
than a library: "Use ratatui for TUI. Make the TUI coherent and beautiful: look for inspiration and
make a mock."

## Rules

- Every rule the CLI checks or enforces is written in the skill, beside the way to do the step by
  hand. _So:_ `ura next` names a step's pick and session from the settings, and the skill's
  "Sessions and picks" says how to run without them; every link `ura check --fix` repairs, the
  skill's "By hand" repairs the same way.
- An agent never meets a prompt it cannot answer: every action of a TUI is also a command with
  flags. _So:_ `ura install` asks for its scope and folders in a terminal, and takes `--user`,
  `--repo`, `--agents`, and `--claude` without one; `--no-input` fails and names the flags missing.
- Every interactive screen of `ura`, a one-question picker included, is drawn with ratatui, and no
  other prompt or terminal library is added. _So:_ the two pickers of `ura install` were written by
  hand on ratatui, though dialoguer had them ready at a sixth of the size.
- A terminal screen uses the terminal's own colours, never colours of its own. _So:_ it follows the
  user's theme, and everyone else's, rather than matching one theme exactly.

## Why

Agents make fewer errors through a command than through prose, so each step of the skill names its
command. But a rule that lives only in a tool cannot be followed without it, and the workflow is the
product, not the tool. An agent has no terminal to answer in: a command that waits on a prompt hangs
its run. History: [CLI core](../done/2026-10-10-cli-core.md).

## Alternatives considered

- Rules living in the CLI only, with agents told never to edit a workflow file by hand. It gives the
  fewest agent errors, but the workflow then needs the tool, against the constitution.
- dialoguer for the pickers: ready select prompts, but a second library beside ratatui, which looks
  different.

## Applies to

- [`crates/cli/`](/crates/cli/), [`skills/uraeda/`](/skills/uraeda/), and every feature that adds or
  changes a command, a check, or a TUI
