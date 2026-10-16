---
status: active
approved-by: mrtolkien
---

# Agents

Uraeda's server runs coding agents by starting the agent's own command-line tool, installed on the
machine and signed in by the user, never through a bundled binary or Claude's SDK. Every agent is
reached through one adapter, as sessions of turns and items: a session keeps one process while it is
used, and takes the human's messages as they come. Claude Code is the first agent. A feature has one
session, where the workflow's runs and the human's chat follow each other; a session without a
feature works in the main checkout. What the server remembers of sessions lives in a local SQLite
cache that is never committed. A run's turn lasts until every background task of it has ended,
background commands included.

## Rules

- The server MUST run Claude Code by spawning the `claude` binary found on the machine's `PATH`, in
  print mode, with `--input-format stream-json` and `--output-format stream-json`, keeping its stdin
  open for the session's later messages. It MUST NOT depend on the Claude Agent SDK, or bundle a
  Claude Code binary. Checked by review.
- Every agent MUST be reached through one adapter interface, in
  [`packages/server/src/runner/`](/packages/server/src/runner/): open or resume a session in a
  directory, send it messages, stream its events, interrupt its turn, and close it. Each adapter
  MUST declare its capabilities, such as steering a message into a turn, queueing one after it,
  taking one back, asking for approvals, and reporting sub-agents and background commands, and the
  UI MUST offer only what the session's agent declares. The tests that `vp run ready` runs MUST use
  a fake adapter, and MUST NOT run a real agent. Validation scripts, run by hand when an agent's
  integration breaks, MAY run the real agent, and MUST be kept in the repository. Checked by review.
- Sessions, turns, and items MUST be stored and sent to the UI in one agent-neutral shape: a session
  has Uraeda's own ID, the agent's kind, and the agent's own session ID; a turn is one message until
  the agent settles, once its reply has ended and every background task of its run has ended,
  sub-agents, workflows, and background commands alike, except the tasks the agent marks as ambient;
  a turn reopens when the agent goes on by itself after it; items are messages, the agent's text,
  tool calls with the [Agent Client Protocol](https://agentclientprotocol.com/protocol/tool-calls)'s
  kinds and statuses, sub-agents, background commands, blocked actions, and system lines. An agent's
  own formats MUST stay inside its adapter. Checked by the runner's tests.
- Tools MUST NOT read, store, or pass the agent's credentials: the binary uses the user's own login
  or API key. Checked by review.
- Every session MUST pass `--permission-mode auto` explicitly. Tools MUST NOT pass
  `bypassPermissions` or `--dangerously-skip-permissions`. A permission the human grants from the UI
  MUST be a narrow allow rule, passed with `--allowedTools` when the session's process is reopened,
  lasting until that process closes, and never written to a settings file. Checked by the runner's
  tests.
- A feature's session MUST work in the feature's worktree, as the core returns it. A session without
  a feature MUST work in the repository's main checkout, as the core returns it. Tools MUST NOT
  switch any checkout. Checked by the runner's tests.
- The skill MUST come from the server's own copy, `skills/uraeda`, loaded as a plugin with
  `--plugin-dir`, in every session, with or without a feature. The session MUST fail to open when
  the plugin does not load. Checked by the runner's tests.
- A feature MUST have at most one session. A session MUST have at most one live process and at most
  one turn at a time. A message sent during a turn MUST be steered into it or queued after it, as
  the adapter declares, and MUST NOT start a second process. Checked by the runner's tests.
- A workflow run MUST carry the step, its reference, and the trigger in its message, since a resumed
  session keeps its first system prompt. A chat message on a feature that follows a workflow run, or
  opens the session, MUST start with one line saying that a human is chatting, and that the agent
  changes files, commits, or moves the workflow only when asked. Every message sent to an agent MUST
  be stored, and shown in its session as the human's turn. Checked by the runner's tests.
- Sessions, turns, and their items MUST be stored in a SQLite database, `runner.sqlite`, through
  Node's built-in `node:sqlite`, in Uraeda's data folder for the user: `URAEDA_DATA_DIR` when it is
  set, or else the operating system's default, `$XDG_DATA_HOME/uraeda/` on Linux
  (`~/.local/share/uraeda/` when `XDG_DATA_HOME` is unset), `~/Library/Application Support/uraeda/`
  on macOS, and `%APPDATA%\uraeda\` on Windows. Its rows MUST be keyed by the repository's main
  checkout path and the session's own ID, with the feature's folder when the session has one. It
  MUST NOT live in a repository. It is a cache: workflow state MUST NOT be stored in it, and losing
  it MUST cost only new sessions and the old transcripts. Checked by review.
- Stopping MUST interrupt the session's turn through the agent's own interrupt, which keeps the
  session. When the turn has not ended 10 seconds later, the server MUST end the process: SIGINT
  first, and SIGTERM when it is still running 10 seconds after that. Checked by the runner's tests.
- A session's process MUST be closed after 15 minutes without a turn, and MUST NOT be closed while
  one of its background tasks still runs; it is resumed with its next message. Checked by the
  runner's tests.
- Tools MUST NOT change the agent's commit attribution, model, effort, or settings, except the
  permission mode above: the user's active Claude Code settings apply. Checked by review.

## Why

The human picked the installed command-line tool over the Agent SDK. It adds no dependency, runs the
user's own binary, settings, and login, and is the case Anthropic's terms allow explicitly: "an end
user signing in to the unmodified Claude Code binary with their own Claude subscription". The terms
ask products built on the SDK to use API keys
([Q1](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code),
[launching](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code),
[credentials](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code)).
An adapter keeps Codex or pi one more adapter, and lets CI run without Claude Code.

`-p` denies anything that would prompt, so the mode decides whether a step finishes. `auto` is the
safest mode that runs unattended, and has worked well while developing Uraeda. The agent runs on the
user's machine, outside a container, and can be started from a phone
([Q2](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q2-what-may-the-agent-do-without-asking),
[permission mode](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q2-what-may-the-agent-do-without-asking)).

The human picked the server's own copy of the skill: one version, whatever the project has
([Q4](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q4-which-copy-of-the-skill-does-the-session-use)).
They asked for the session IDs and parsed transcripts to be kept in a small local database
([Q5](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q5-what-does-the-ui-show-of-a-run)),
in an app data folder from the operating system's defaults rather than the repository's git folder,
and for the model and effort to come from the active settings, since the command-line tool cannot
list its models (the runner's spec review, C1 and C2). Principle III makes the repository the only
durable state, so the database can only be a cache.

For the chat in the web UI, the human asked for back-and-forth chats like the ones they hold with
Claude Code in the terminal, and for concepts generic enough for Codex and pi-durable. They chose
one conversation per feature
([Q1](../done/2026-10-13-chat-in-the-web-ui.md#q1-how-do-chats-about-a-feature-relate-to-the-session-its-workflow-runs-use)),
chats that may act when asked
([Q2](../done/2026-10-13-chat-in-the-web-ui.md#q2-what-may-the-agent-change-during-a-chat)), the
main checkout for sessions without a feature
([Q5](../done/2026-10-13-chat-in-the-web-ui.md#q5-where-does-a-session-without-a-feature-work)), one
process per open session
([Q6](../done/2026-10-13-chat-in-the-web-ui.md#q6-how-does-the-server-keep-a-conversation-going-with-claude-code)),
messages steered into a turn
([Q6.A](../done/2026-10-13-chat-in-the-web-ui.md#q6a-what-happens-to-a-message-you-send-while-the-agent-works)),
a generic model with Claude as its only adapter
([Q7](../done/2026-10-13-chat-in-the-web-ui.md#q7-how-far-does-the-generic-agent-design-go-now)),
and blocked actions allowed by a narrow rule, as today
([Q8](../done/2026-10-13-chat-in-the-web-ui.md#q8-what-happens-when-auto-mode-blocks-an-action-during-a-chat)).
Claude Code takes several messages in one process with its stdin open, and interrupts a turn without
ending the process; a process per message would lose the prompt cache at every commit, and could
never reach a working agent
([driving Claude Code](../done/2026-10-13-chat-in-the-web-ui.md#q6-how-does-the-server-keep-a-conversation-going-with-claude-code)).
Codex, pi, and pi-durable share the same session, turn, and item shape, which ACP's vocabulary
names, while ACP itself would need the Agent SDK
([common ground](../done/2026-10-13-chat-in-the-web-ui.md)).

the UI said "Needs you" while a background command, like a long review, still ran, and then went
back to working when it reported; the human asked for runs to "_fully_ finish" before saying they
wait on them, and chose to count background commands too, since "a background command is part of an
agent run" and agents leave no dev servers running when they are done
([Q8](../2026-10-16-redesign-interface/clarifications-01.md#q8-does-a-background-command-keep-a-run-working),
[when a run is over](../2026-10-16-redesign-interface/discovery-01.md#when-a-run-is-over)). Claude
Code's print mode already stays open for background commands, and stops those of unattended sessions
after 30 minutes by default
([end of a run](../2026-10-16-redesign-interface/discovery-01.md#claude-codes-end-of-a-run)).

## Alternatives considered

- The Agent SDK in the server, which the stack decision expected: typed messages and a permission
  callback, but four dependencies, a second binary, and terms that ask for an API key.
- `bypassPermissions`, the mode most compared tools use: nothing blocked, but anything allowed on
  the user's machine.
- The project's own skill install, `.claude/skills/uraeda`: each branch would run its own skill.
- One process per run, with one message, from the
  [Claude Code runner](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code):
  the documented path, abandoned when the human asked for back-and-forth chats, since a message
  could never reach a working agent, and every commit cost the prompt cache.
- Chats as sessions forked from the feature's session, like Claude Code's `/btw`: a clean workflow
  session, but two writers in one worktree, and nothing settled in a chat reaching the next run.
- Background commands not holding a turn, which only reopened when they reported back: the first
  rule, abandoned when the UI said "Needs you" while a long review still ran (2026-10-16).

## Consequences

- No new dependency: `node:sqlite` ships with Node 24, as a release candidate.
- The server parses Claude Code's events, and writes its control messages, itself, and must follow
  their changes between Claude Code versions. The interrupt is not in Claude Code's public docs: the
  validation script checks it, and the human accepted that this integration stays fragile
  ([Q6](../done/2026-10-13-chat-in-the-web-ui.md#q6-how-does-the-server-keep-a-conversation-going-with-claude-code)).
- `claude` must be installed and signed in for sessions to work. Without it, the UI only commits.
- Actions that `auto` mode blocks are skipped, shown in the session, and allowed for the session's
  reopened process.
- A branch that changes the skill is not run with its own version: the server's checkout decides.
- One process stays alive per session in use, for up to 15 minutes after its last turn.
- A session without a feature can edit and commit in the main checkout, the one the server may run
  from.
- Remote Control and interactive approvals still need a channel these rules do not give.
- Claude Code is the first agent, not the recommended one: it is hard to interoperate with, so later
  features should prefer agents built to be driven by another program (the runner's spec review,
  C1).
- Codex and pi-durable each become one more adapter, declaring what they can do. pi-durable runs in
  the server's process, so its adapter has no process to signal.
- A background command the agent forgets, like a server, holds the session "Working" until Claude
  Code's own limit stops it, 2 hours at most.
- The idle timer waits for background work, so a process lives as long as its longest background
  task.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), and every feature that starts,
  follows, or stops an agent, or talks to one: the chat in the web UI, the git listener, benchmarks,
  notifications, and the Codex and pi-durable runtimes

## Revisit when

An agent that is easier to drive than Claude Code, such as one with a documented protocol for
prompts, approvals, and models, joins the runner.
