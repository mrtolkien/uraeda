---
icon: bot
---

# Agents

> "Use the agent I installed and signed in to, and never touch its settings."

Claude Code is only the first agent: every agent is reached through one adapter, and a conversation
with one is a session.

## Rules

- The server runs the user's installed agent, never a bundled one or the agent's SDK, and never
  reads or changes its credentials or settings. _So:_ a missing `claude` shows how to install it.
- Every agent is reached through one adapter, and its sessions are kept in one agent-neutral shape.
  _So:_ a second agent adds an adapter, and its sessions show on the same page.
- An agent runs with the least permission that lets unattended steps finish, never with its
  permissions skipped. _So:_ no `--dangerously-skip-permissions`.
- Only the human turns a session into a change, or a change into a feature. _So:_ an agent proposes
  the branch, and waits for the human's yes.
- Sessions are a cache in Uraeda's data folder, never stored in a repository. _So:_ deleting the
  data folder loses chats, never work.

## Why

Running the user's own `claude` uses their binary, settings, and login: the use Anthropic's terms
allow with a subscription. Skipped permissions would let an agent do anything on the user's machine.
History: [Merge chats](../done/2026-10-20-merge-chats.md).

## Alternatives considered

- The Agent SDK: typed messages, but more dependencies, a second binary, and terms that ask for an
  API key.
- Skipping permissions, as most compared tools do: anything allowed on the user's machine.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), and every feature that starts,
  follows, or stops an agent: the chat, benchmarks, notifications, and other agents' runtimes

## Revisit when

An agent with a documented protocol for prompts, approvals, and models joins the runner.
