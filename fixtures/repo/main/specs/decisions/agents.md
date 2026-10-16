---
status: active
approved-by: mrtolkien
icon: bot
---

# Agents

Uraeda's server runs coding agents by starting the agent's own command-line tool, installed on the
machine and signed in by the user. Every agent is reached through one adapter, as sessions of turns
and items.

## Rules

- The server MUST run Claude Code by spawning the `claude` binary found on the machine's `PATH`.
  Checked by review.
- Every agent MUST be reached through one adapter interface. Checked by review.

## Why

The agent's own tool keeps its sign-in, its updates, and its settings.

## Consequences

- An agent that is not installed shows as missing, with how to install it.

## Applies to

- The server's runner
