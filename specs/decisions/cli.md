---
status: proposed
approved-by:
icon: terminal
---

# CLI

The `ura` CLI is a fast path through the workflow, never the only one. The skill states every rule
it follows, and every action it offers can be done by hand. It serves humans and agents alike, so
nothing it does needs a terminal, and what it prints is stable enough for tools to read.

## Rules

- Every rule the CLI enforces or checks MUST be written in the skill,
  [`skills/uraeda/`](/skills/uraeda/), and a change to either MUST update the other in the same
  change. Checked by review.
- The skill MUST keep the manual instructions of every step, and a step SHOULD name the command that
  performs it. Checked by review.
- The CLI MUST embed the skill and its templates, with no second copy of a template or a rule in the
  code. Checked by review.
- Every action a TUI offers MUST also be available non-interactively, so an agent never meets a
  prompt it cannot answer. Checked by the CLI's tests.
- What commands print MUST be stable for tools to read: data apart from messages, and versioned JSON
  on every read command. Checked by the CLI's tests.
- The release binary MUST stay as small as possible, and a feature adding a CLI dependency SHOULD
  measure what it adds and pick the smallest that does the job. Checked by review.

## Why

Agents make fewer errors through a CLI than through prose, but principle V requires the workflow to
work without it
([the skill and the CLI](../done/2026-10-10-cli-core.md#q2-how-does-the-skill-send-agents-through-the-cli)).
The human chose a binary "_as small as possible_" over a size cap each dependency must fit under
([the binary's size limit](../done/2026-10-12-review-uraeda-init.md#q2a-what-is-the-binarys-size-limit)).

## Alternatives considered

- Rules living in the CLI, like Backlog.md: the fewest agent errors, but it conflicts with principle
  V.
- A fixed size limit in CI: abandoned when one dependency came within 2 KB of it.

## Consequences

- The skill keeps its full length, and each command change is a skill change, reviewed together.
- Runners and the web UI read stable JSON.
- The binary grows with each dependency the human accepts, and review keeps it small.

## Applies to

- [`crates/cli/`](/crates/cli/), [`skills/uraeda/`](/skills/uraeda/),
  [`.github/workflows/ci.yml`](/.github/workflows/ci.yml), and every feature that adds or changes a
  command or a TUI
