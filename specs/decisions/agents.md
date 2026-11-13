---
icon: bot
---

# Agents

> "While we only support claude, we'll also support Codex and Pi-durable soon: the concepts need to
> be generic and the data model + UI need to be properly abstracted"

An agent is a coding agent Uraeda drives, Claude Code and Codex today. Each is reached through one
adapter, the only code that knows that agent's formats. A session is one conversation with an agent.

## Rules

- Only an agent's adapter knows its formats: sessions, their turns, and their items are stored and
  shown in one agent-neutral shape. _So:_ Codex was added without a change to a session's page, and
  the sandbox's sample sessions are sent through the session manager, never written as rows.
- Every conversation with an agent is a session, whether it is a chat, a change, a feature, or a
  sub-agent: what differs is the workflow around it. _So:_ a feature has one or more sessions, each
  with a page of its own, a sub-agent's included, and no view lists chats apart from sessions.
- An agent runs with the least permission that still lets unattended steps finish: never with its
  permissions skipped, and each action outside its worktree, the network included, reviewed before
  it runs. _So:_ Codex gets no writable folder beside its session's, though its spec gave it the
  extensions folder, and a Codex thread that reports full access is refused.
- An agent never turns a session into a change, or a change into a feature, without the human's yes.
  _So:_ a session offers the change as a card and waits for the press. A job the human scheduled has
  that yes in advance, for the changes its runs start.
- Sessions are a cache in Uraeda's data folder, never stored in a repository. _So:_ clearing the
  data folder loses conversations, and no spec, answer, or step of the workflow.
- Uraeda never reads, stores, or passes an agent's credentials: the agent runs on the human's own
  login. _So:_ with several accounts, the human signs in to each account's folder themselves, and
  Uraeda only tells the agent which folder to use.

## Why

More agents come, and a view written for one agent's formats is rewritten for the next. One concept
of a session gives every conversation a page and a history, and fewer things to learn. Skipped
permissions, or an unreviewed network, would let a hostile page make an agent act on, or send away,
the human's code. A branch started without the human's yes is a choice they did not make. Sessions
kept out of git leave a repository with only what the workflow needs: another agent resumes from the
repository alone.

## Alternatives considered

- A rule that every agent is the human's own install, never a bundled one: it holds for Claude Code
  and Codex, whose terms ask for it, but Uraeda may bundle a harness of its own.
- One session per feature: a feature has one or more, and its sub-agents are sessions too.
- Skipping permissions, as most compared tools do: nothing blocked, but anything allowed on the
  human's machine.

## Applies to

- [`crates/server/src/runtimes/`](/crates/server/src/runtimes/), the adapters built in and those of
  extensions, and every feature that starts, follows, or stops an agent

## Revisit when

The human decides whether Uraeda keeps running agents itself, or sits on another orchestrator with
its skill, its CLI, and a small view: they asked on 2026-11-13, and it is open. Or agents run in a
container, where the human wants them free of permission prompts.
