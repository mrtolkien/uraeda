---
status: active
approved-by: mrtolkien
icon: cpu
---

# Models

A session runs on one agent, one account, and one model, set when it starts, and an effort, the
model's depth of reasoning, which may change between turns. The human picks the model and the
effort, where the session starts or in the run options, else the agent's own defaults apply; Uraeda
picks the account, a login of the agent, among those the human listed. Another model or another
account means another session.

## Rules

- A session MUST keep the agent and the model it started with, its automatic runs included. Checked
  by the runner's tests.
- A session MUST keep the account it started on, a limit that refuses its run included. Checked by
  the runner's tests.
- A new session MUST start on the model and effort the human picked for it, where it starts or in
  the run options of its step or role, else on the agent's own defaults. Checked by the runner's
  tests.
- Every runtime that lists its models MUST offer them where a session starts, beside its agent.
- An effort MUST be picked among the levels the model takes, separately from the model. Checked by
  the runner's tests.
- A session's effort MAY change between its turns, from its next turn on, by the human or by the
  next step it runs.

## Why

A model that changes during a session would surprise the human, and a feature's runs would land on a
model nobody picked for them. Effort changes cost and depth as much as the model, but keeps the
conversation and the model, so the human tunes it as the work goes, or per step. Without a pick, the
agent's defaults already express the human's preference. An account that changes re-reads the
conversation uncached. History: [Multi-accounts](../2026-11-10-multi-accounts/spec.md).

## Alternatives considered

- Changing the model between turns, as Claude Code and Codex allow: one session per feature, but the
  model drifts under its runs, and the prompt cache restarts.
- Remembering the last pick: one pick lasts, but a stale pick runs silently.
- Moving a run a limit refused to another account: no wait for the reset, but the new account
  re-reads the whole conversation uncached.

## Consequences

- A step that needs another model starts a new session, which forgets the conversation.
- Steps sharing a session share its agent and model; only their efforts may differ.
- A run a limit refused waits for its own account's reset, even while another account has room.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), the runtimes built in and those of
  extensions, and every view or feature that starts a session
