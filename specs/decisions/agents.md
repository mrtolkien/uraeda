---
status: proposed
approved-by:
icon: bot
---

# Agents

Uraeda drives the coding agent the user chose and signed in to, and never touches its credentials or
settings. Every agent is reached through one adapter, and its conversations are kept in one
agent-neutral shape, so Claude Code is only the first agent. A conversation with an agent is a
session, which only the human can turn into a change or a feature.

## Rules

- Outside a sandbox, the server MUST run the user's installed agent; inside one, the sandbox's copy
  of that agent, signed in to the user's own account. Never the agent's SDK.
- Every agent MUST be reached through one adapter, which keeps the agent's formats inside it and
  declares what the agent can do.
- Sessions, their turns, and their items MUST be stored and shown in one agent-neutral shape.
  Checked by the runner's tests.
- Outside a sandbox, an agent MUST run with the least permission that still lets unattended steps
  finish, never with its permissions skipped. Checked by the runner's tests.
- Uraeda MUST NOT read or change an agent's credentials or settings.
- Every conversation with an agent MUST be a session, run in the checkout of its change or feature.
  Checked by the runner's tests.
- An agent MUST NOT turn a session into a change, or a change into a feature, unless the human
  accepts it.
- Sessions MUST be a cache in Uraeda's data folder, never stored in a repository.
- Tests MUST reach agents through a fake adapter, never a real agent.
- Inside a sandbox, as [Agent sandboxes](agent-sandboxes.md) defines it, an agent MAY run with its
  permissions skipped. Checked by the runner's tests.

## Why

Running the user's own `claude` uses their binary, settings, and login: the use Anthropic's terms
allow with a subscription. A sandbox cannot run the host's binary on every platform, so it runs its
own copy, still signed in by the user. Skipped permissions would let an agent do anything on the
user's machine, but only what the sandbox holds inside one. History:
[Nix / Docker based execution environments](../2026-11-08-nix-docker/spec.md).

## Alternatives considered

- The Agent SDK: typed messages, but more dependencies, a second binary, and terms that ask for an
  API key.
- Skipping permissions outside a sandbox, as most compared tools do: nothing blocked, but anything
  allowed on the user's machine.
- An agent turning a session into a change alone: no wait, but branches and commits without the
  human's yes.

## Consequences

- The server parses Claude Code's events itself, so a new version of Claude Code, the host's or a
  sandbox's, can break it.
- Without `claude` installed and signed in, the web UI only commits.
- Several sessions share one checkout, so only one of them works at a time.
- A branch that changes the skill runs with the server's copy of the skill, not its own.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), and every feature that starts,
  follows, or stops an agent: the chat, benchmarks, notifications, sandboxes, and other agents'
  runtimes

## Revisit when

An agent with a documented protocol for prompts, approvals, and models joins the runner.
