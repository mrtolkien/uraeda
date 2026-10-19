---
status: active
approved-by: mrtolkien
icon: bot
---

# Agents

Uraeda drives the coding agent the user already installed and signed in to, never a bundled one, and
stays out of its credentials and settings. Every agent fits one adapter and one agent-neutral model
of sessions, turns, and items, so Claude Code is only the first. A feature has one session, where
workflow runs and the human's chat follow each other.

## Rules

- The server MUST run the user's installed agent and MUST NOT bundle one or depend on its SDK.
  Checked by review.
- Every agent MUST be reached through one adapter that keeps its formats inside and declares what it
  can do, and tests MUST use a fake adapter. Checked by review.
- Sessions, turns, and items MUST be stored and shown in one agent-neutral shape. Checked by the
  runner's tests.
- An agent MUST run with the least permission that still finishes unattended steps, never skipping
  permissions, and Uraeda MUST NOT touch its credentials or settings. Checked by the runner's tests
  and review.
- A feature MUST have one session, in its worktree and with the server's copy of the skill, where
  runs and chat follow each other and the agent acts on a chat only when asked. Checked by the
  runner's tests.
- Sessions MUST be a cache in Uraeda's data folder, never workflow state and never in a repository.
  Checked by review.

## Why

The installed `claude` runs on the user's own binary, settings, and login: the use Anthropic's terms
allow with a subscription
([how the server runs Claude Code](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code)).
A permission-gated mode is the safest that still finishes unattended steps on the user's machine.
One live process per session lets the human chat with a working agent, and keeps its prompt cache
([keeping a conversation going](../done/2026-10-13-chat-in-the-web-ui.md#q6-how-does-the-server-keep-a-conversation-going-with-claude-code)).

## Alternatives considered

- The Agent SDK: typed messages, but four dependencies, a second binary, and terms that ask for an
  API key.
- Skipping permissions, as most compared tools do: nothing blocked, but anything allowed on the
  user's machine.
- One process per run: abandoned for chats, since a message could never reach a working agent.
- Chats forked from the feature's session: two writers in one worktree.

## Consequences

- The server parses Claude Code's events itself, so the integration stays fragile across versions,
  an accepted cost.
- Without `claude` installed and signed in, the UI only commits.
- A branch that changes the skill does not run with its own version: the server's checkout decides.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), and every feature that starts,
  follows, or stops an agent: the chat, the git listener, benchmarks, notifications, and other
  agents' runtimes

## Revisit when

An agent with a documented protocol for prompts, approvals, and models joins the runner.
