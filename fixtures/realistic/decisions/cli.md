---
icon: terminal
---

# CLI

> "The CLI is a fast path through the workflow, never the only one."

## Rules

- Every rule the CLI enforces is written in the skill, which keeps the manual instructions of every
  step. _So:_ a new check in `ura check` changes the skill in the same change.
- The CLI embeds the skill and its templates, with no second copy in its code. _So:_ a template is
  edited in one place.
- Every action of a full-terminal screen is also available without one. _So:_ an agent never meets
  a prompt it cannot answer.
- What commands print is stable for tools to read, with versioned JSON on every read command. _So:_
  a renamed field bumps the version.

## Why

Agents make fewer errors through a CLI than through prose, but the constitution's principle V
requires the workflow to work without it. History: [CLI core](../done/2026-10-10-cli-core.md).

## Alternatives considered

- Rules living in the CLI only, like Backlog.md: the fewest agent errors, but against principle V.

## Applies to

- [`crates/cli/`](/crates/cli/), [`skills/uraeda/`](/skills/uraeda/),
  [`.github/workflows/`](/.github/workflows/), and every feature that adds or changes a command or a
  TUI
