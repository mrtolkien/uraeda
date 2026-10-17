---
status: proposed
approved-by:
icon: bot
---

# Agents

Uraeda drives the coding agent the user already installed and signed in to, never a bundled one, and
stays out of its credentials and settings. Every agent fits one adapter and one agent-neutral model
of sessions, turns, and items, so Claude Code is only the first. A feature has one session, where
workflow runs and the human's chat follow each other.

## Rules

- The server MUST run the user's installed `claude` binary, and MUST NOT bundle an agent or depend
  on the Agent SDK. Checked by review.
- Every agent MUST be reached through one adapter, in
  [`packages/server/src/runner/`](/packages/server/src/runner/), that keeps its formats inside and
  declares what it can do; the UI MUST offer only that, and `vp run ready`'s tests MUST use a fake
  adapter. Checked by review.
- Sessions, turns, and items MUST be stored and shown in one agent-neutral shape, with tool calls in
  the [Agent Client Protocol](https://agentclientprotocol.com/protocol/tool-calls)'s kinds and
  statuses, and a turn MUST end only once its reply and its non-ambient background tasks have.
  Checked by the runner's tests.
- Sessions MUST pass `--permission-mode auto`, never a mode that skips permissions; a granted
  permission MUST be a narrow `--allowedTools` rule until the process closes, never saved; tools
  MUST NOT touch the agent's credentials, model, effort, attribution, or settings. Checked by the
  runner's tests and review.
- A session MUST work in its feature's worktree, or the main checkout without a feature, MUST load
  the server's copy of the Uraeda skill, failing to open without it, and MUST NOT switch a checkout.
  Checked by the runner's tests.
- A feature MUST have at most one session, with one live process and one turn at a time, and a
  message sent during a turn MUST be steered into it or queued, as the adapter declares, never start
  a second process. Checked by the runner's tests.
- Every message MUST be stored and shown as the human's turn: a workflow run's carries its step,
  reference, and trigger, and a chat after a run opens by saying a human is chatting, so the agent
  acts only when asked. Checked by the runner's tests.
- The run after a spec's approval MUST start a fresh agent session in the feature's session when the
  `build_in_fresh_session` setting is on, its default, keeping earlier turns in view. Checked by the
  runner's and the web UI's tests.
- Stopping MUST use the agent's own interrupt, which keeps the session, then SIGINT and SIGTERM 10
  seconds apart; an idle process MUST close after 15 minutes, never while a background task runs.
  Checked by the runner's tests.
- Sessions MUST be cached in `runner.sqlite`, through `node:sqlite`, in Uraeda's data folder, MUST
  NOT hold workflow state, and MUST NOT live in a repository. Checked by review.

## Why

The installed `claude` runs on the user's own binary, settings, and login: the use Anthropic's terms
allow with a subscription
([how the server runs Claude Code](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code)).
`auto` is the safest mode that still finishes unattended steps on the user's machine. One live
process per session lets the human chat with a working agent, and keeps its prompt cache
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
