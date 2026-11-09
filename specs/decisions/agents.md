---
status: proposed
approved-by:
icon: bot
---

# Agents

Uraeda drives the coding agents the user already installed and signed in to, Claude Code and Codex,
through each agent's own protocol, and never touches their credentials or settings. Every agent is
reached through one adapter, provided by an extension, and its conversations are kept in one
agent-neutral shape. A conversation with an agent is a session, which only the human can turn into a
change or a feature.

## Rules

- Every agent MUST be reached through one adapter, which keeps the agent's formats inside it and
  declares what the agent can do.
- Sessions, their turns, and their items MUST be stored and shown in one agent-neutral shape.
  Checked by the runner's tests.
- An agent MUST run with the least permission that still lets unattended steps finish: never with
  its permissions skipped, and each action outside its worktree, the network included, reviewed
  before it runs. Checked by the runner's tests.
- Uraeda MUST NOT read or change an agent's credentials or settings.
- Every conversation with an agent MUST be a session, run in the worktree of its change or feature,
  or of one of its tasks. Checked by the runner's tests.
- An agent MUST NOT turn a session into a change, or a change into a feature, unless the human
  accepts it.
- Sessions MUST be a cache in Uraeda's data folder, never stored in a repository.
- Tests MUST reach agents through a fake adapter, never a real agent.
- A runtime SHOULD run the user's installed agent through the agent's own protocol, never a bundled
  agent, its SDK, or a wrapper package, where the agent's terms ask for it, as Claude Code's and
  Codex's do.

## Why

Running the user's own `claude` and `codex` uses their binaries, settings, and logins, the use their
subscriptions allow; a wrapper would sit between Uraeda and the agent. Skipped permissions, or an
unreviewed network, would let a hostile page make an agent act on, or send away, the user's code.
One concept of a session, whatever workflow surrounds it, gives each conversation a page and a
history of its own, a sub-agent's included. History:
[Run options](../2026-11-08-run-options/spec.md).

## Alternatives considered

- The Agent SDK: typed messages, but more dependencies, a second binary, and terms that ask for an
  API key.
- Skipping permissions, as most compared tools do, and as Codex's own setup often runs: nothing
  blocked, but anything allowed on the user's machine.
- An agent turning a session into a change alone: no wait, but branches and commits without the
  human's yes.

## Consequences

- The server parses each agent's events itself, and Codex's protocol is labelled experimental, so a
  new version of either agent can break its runtime.
- Without an agent installed and signed in, the web UI only commits.
- Several sessions share one worktree, so only one of them works at a time, but for a run's
  sub-agents, which work beside it.
- A branch that changes the skill runs with the server's copy of the skill, not its own.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), the runtimes built in and those of
  extensions, and every feature that starts, follows, or stops an agent: the chat, benchmarks,
  notifications, and other agents' runtimes

## Revisit when

Codex's app-server leaves its experimental label, or Claude Code documents a protocol for prompts,
approvals, and models.
