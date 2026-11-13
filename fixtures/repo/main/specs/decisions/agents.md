---
icon: bot
---

# Agents

> "Use the agent I already have installed and signed in."

The server runs coding agents through their own command-line tools, each reached through one
adapter.

## Rules

- The server runs Claude Code by spawning the `claude` binary on the machine's `PATH`. _So:_ no
  copy of the agent ships with Uraeda.
- Every agent is reached through one adapter interface. _So:_ a new agent adds an adapter, never a
  path of its own through the server.

## Why

The agent's own tool keeps its sign-in, its updates, and its settings.

## Applies to

- The server's runner
