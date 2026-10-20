---
status: proposed
approved-by:
icon: bot
---

# Agents

Uraeda drives the coding agent the user already installed and signed in to, never a bundled one, and
stays out of its credentials and settings. Every agent fits one adapter and one agent-neutral model
of sessions, turns, and items, so Claude Code is only the first. Every conversation with an agent is
a session, a sub-agent's one too, and a workflow, a change or a feature, may grow around it, with
one or more sessions in its worktree. Only the human decides that a session grows.

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
- Every conversation with an agent MUST be a session, and a change or a feature MUST have one or
  more sessions, all in its worktree and with the server's copy of the skill, where the agent acts
  on a human's message only when asked. Checked by the runner's tests.
- An agent MUST offer, and MUST NOT perform alone, turning a session into a change or a change into
  a feature: the human accepts it in the session or in a round. Checked by review.
- Sessions MUST be a cache in Uraeda's data folder, never workflow state and never in a repository.
  Checked by review.

## Why

The installed `claude` runs on the user's own binary, settings, and login: the use Anthropic's terms
allow with a subscription
([how the server runs Claude Code](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code)).
A permission-gated mode is the safest that still finishes unattended steps on the user's machine.
One live process per session lets the human chat with a working agent, and keeps its prompt cache
([keeping a conversation going](../done/2026-10-13-chat-in-the-web-ui.md#q6-how-does-the-server-keep-a-conversation-going-with-claude-code)).
A session is one concept whatever workflow surrounds it, and a feature's work spans several, each
with its own page
([the session moves up](../2026-10-20-merge-chats/clarifications-01.md#q3-does-the-chats-conversation-become-the-changes-session),
[several sessions](../2026-10-20-merge-chats/spec.md#us5-several-sessions-for-a-change-or-a-feature-p2)).
The agent offers the move, and the human accepts it in one click, so nothing starts without them
([who moves a session up](../2026-10-20-merge-chats/clarifications-01.md#q1-who-may-move-a-chat-up-to-a-change-or-a-change-up-to-a-feature)).

## Alternatives considered

- The Agent SDK: typed messages, but four dependencies, a second binary, and terms that ask for an
  API key.
- Skipping permissions, as most compared tools do: nothing blocked, but anything allowed on the
  user's machine.
- One process per run: abandoned for chats, since a message could never reach a working agent.
- One session per feature, a new agent session replacing the previous one in place: its earlier
  turns lost a page of their own, and the human could not go back to them.
- Chats forked from the feature's session: two writers in one worktree.
- A new session for a change started from a chat, its first message linking the chat: the agent
  rereads what the chat already settled, and the human follows two sessions.
- An agent moving a session up alone: no wait, but branches and commits on the default branch
  without the human's yes.

## Consequences

- The server parses Claude Code's events itself, so the integration stays fragile across versions,
  an accepted cost.
- Without `claude` installed and signed in, the UI only commits.
- A session's history follows it into its worktree, so a long conversation weighs on the change's
  runs, until the human starts a new session for it.
- Several sessions share one worktree, so only one of them works at a time.
- A branch that changes the skill does not run with its own version: the server's checkout decides.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), and every feature that starts,
  follows, or stops an agent: the chat, the git listener, benchmarks, notifications, and other
  agents' runtimes

## Revisit when

An agent with a documented protocol for prompts, approvals, and models joins the runner.
