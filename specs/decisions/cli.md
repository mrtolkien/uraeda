---
status: active
approved-by: mrtolkien
icon: terminal
---

# CLI

The `ura` CLI is a fast path through the workflow, never the only one: the skill states every rule
it follows, and every action it offers can be done by hand. It serves humans and agents alike, so
nothing it does needs a terminal, and what it prints is stable enough for tools to read.

## Rules

- Every rule the CLI enforces or checks MUST be written in the skill, in
  [`skills/uraeda/`](/skills/uraeda/). Checked by review.
- A change to a rule MUST update the skill and the CLI in the same change. Checked by review.
- The skill MUST keep the manual instructions of every step. Checked by review.
- The CLI MUST embed the skill and its templates, with no second copy of a template or a rule in its
  code. Checked by review.
- Every action of a TUI, a full-terminal interactive screen, MUST also be available without one, so
  an agent never meets a prompt it cannot answer. Checked by the CLI's tests.
- What commands print MUST be stable for tools to read, with versioned JSON on every read command.
  Checked by the CLI's tests.
- The release binary MUST stay as small as possible. Checked by review.
- A step of the skill SHOULD name the command that performs it. Checked by review.
- A feature adding a CLI dependency SHOULD measure what it adds, and pick the smallest that does the
  job. Checked by review.

## Why

Agents make fewer errors through a CLI than through prose, but the constitution's principle V
requires the workflow to work without it. A binary kept as small as possible serves better than a
fixed size cap each dependency must fit under. History: [CLI core](../done/2026-10-10-cli-core.md).

## Alternatives considered

- Rules living in the CLI only, like Backlog.md: the fewest agent errors, but against principle V.
- A fixed size limit in CI: abandoned when one dependency came within 2 KB of it.

## Consequences

- The skill keeps its full length, and each command change is a skill change, reviewed together.
- Runners and the web UI read stable JSON.
- The binary grows with each dependency the human accepts, and review keeps it small.

## Applies to

- [`crates/cli/`](/crates/cli/), [`skills/uraeda/`](/skills/uraeda/),
  [`.github/workflows/`](/.github/workflows/), and every feature that adds or changes a command or a
  TUI
