---
status: active
approved-by: mrtolkien
icon: bot
---

# Agents

Uraeda drives the coding agent the user already installed and signed in to, and never touches its
credentials or settings. Every agent is reached through one adapter, and its conversations are kept
in one agent-neutral shape, so Claude Code is only the first agent. A conversation with an agent is
a session, which only the human can turn into a change or a feature.

## Rules

- The server MUST run the user's installed agent, never a bundled one or the agent's SDK. Checked by
  review.
- Every agent MUST be reached through one adapter, which keeps the agent's formats inside it and
  declares what the agent can do. Checked by review.
- Sessions, their turns, and their items MUST be stored and shown in one agent-neutral shape.
  Checked by the runner's tests.
- An agent MUST run with the least permission that still lets unattended steps finish, never with
  its permissions skipped. Checked by the runner's tests.
- Uraeda MUST NOT read or change an agent's credentials or settings. Checked by review.
- Every conversation with an agent MUST be a session, run in the worktree of its change or feature.
  Checked by the runner's tests.
- An agent MUST NOT turn a session into a change, or a change into a feature, unless the human
  accepts it. Checked by review.
- Sessions MUST be a cache in Uraeda's data folder, never stored in a repository. Checked by review.
- Tests MUST reach agents through a fake adapter, never a real agent. Checked by review.

## Why

Running the user's own `claude` uses their binary, settings, and login: the use Anthropic's terms
allow with a subscription. Skipped permissions would let an agent do anything on the user's machine.
One concept of a session, whatever workflow surrounds it, gives each conversation a page and a
history of its own. History: [Merge chats](../done/2026-10-20-merge-chats.md).

## Alternatives considered

- The Agent SDK: typed messages, but more dependencies, a second binary, and terms that ask for an
  API key.
- Skipping permissions, as most compared tools do: nothing blocked, but anything allowed on the
  user's machine.
- An agent turning a session into a change alone: no wait, but branches and commits without the
  human's yes.

## Consequences

- The server parses Claude Code's events itself, so a new version of Claude Code can break it.
- Without `claude` installed and signed in, the web UI only commits.
- Several sessions share one worktree, so only one of them works at a time.
- A branch that changes the skill runs with the server's copy of the skill, not its own.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), and every feature that starts,
  follows, or stops an agent: the chat, benchmarks, notifications, and other agents' runtimes

## Revisit when

An agent with a documented protocol for prompts, approvals, and models joins the runner.
