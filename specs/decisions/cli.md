---
status: active
approved-by: mrtolkien
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
- The CLI MUST embed the skill and its templates at build time, with no second copy of a template or
  a rule in the code. Checked by review.
- Commands acting on a feature, change, draft, or workflow file MUST take one optional target, a
  path or a name matching one item, else the current branch's item or the only one waiting, else
  exit 1 listing candidates. Checked by the core's and the CLI's tests.
- Every action a TUI offers MUST also be available through flags, and a TUI MUST start only on a
  terminal without `--no-input`, else exit 1 naming the flags. Checked by the CLI's tests.
- Every read command MUST offer `--json`, an object whose top-level `"version"` increases only for
  incompatible changes. Checked by review.
- Commands MUST print data to stdout and messages to stderr, exit 0 on success and 1 on any error,
  validation errors included, and print no colour without a terminal or with `NO_COLOR`. Checked by
  the CLI's tests.
- CI MUST print the release binary's size on every run and MUST NOT fail on it. Checked by review.
- A feature adding a CLI dependency MUST measure what it adds to the release binary, in its
  discovery or spec, and SHOULD pick the smallest that does the job, unless a decision names one.
  Checked by review.

## Why

Agents make fewer errors through a CLI than through prose, but principle V requires the workflow to
work without it
([the skill and the CLI](../done/2026-10-10-cli-core.md#q2-how-does-the-skill-send-agents-through-the-cli)).
Agents and runners need the same actions as humans, without a terminal, and a stable output to read.
The human chose a binary "_as small as possible_" over a size cap each dependency must fit under
([the binary's size limit](../done/2026-10-12-review-uraeda-init.md#q2a-what-is-the-binarys-size-limit)).

## Alternatives considered

- Rules living in the CLI, like Backlog.md: the fewest agent errors, but it conflicts with principle
  V.
- A fixed size limit in CI, 3 MB then 5 MB: abandoned when ratatui alone came within 2 KB of it.

## Consequences

- The skill keeps its full length, and each command change is a skill change, reviewed together.
- Runners and the web UI read stable JSON, and agents never meet a prompt they cannot answer.
- The binary carries the skill, about 300 KB of text, and grows with each dependency the human
  accepts.
- Growth shows in a change's CI run, not as a failure: review keeps the binary small.

## Applies to

- [`crates/cli/`](/crates/cli/), [`skills/uraeda/`](/skills/uraeda/),
  [`.github/workflows/ci.yml`](/.github/workflows/ci.yml), and every feature that adds or changes a
  command or a TUI
