---
status: active
approved-by: mrtolkien
icon: cpu
---

# Models

A session runs on one agent and one model, picked when it starts among what the agent lists, and an
effort, the model's depth of reasoning, which the human may change between turns. Until the human
picks, the agent's own defaults apply, so its configuration stays the one source of defaults.
Another model means another session.

## Rules

- A session MUST keep the agent and the model it started with, its automatic runs included. Checked
  by the runner's tests.
- A new session MUST start on the agent's own default model and effort until the human picks others.
  Checked by the runner's tests.
- Every runtime that lists its models MUST offer them where a session starts, beside its agent.
- An effort MUST be picked among the levels the model takes, separately from the model. Checked by
  the runner's tests.
- A session's effort MAY change between its turns, from its next turn on, its automatic runs
  following it.

## Why

A model that changes during a session would surprise the human, and a feature's runs would land on a
model nobody picked for them. Effort changes cost and depth as much as the model, but keeps the
conversation and the model, so the human tunes it as the work goes. The agent's defaults already
express the human's preference. History:
[Codex runtime + model settings](../done/2026-11-08-codex-runtime.md).

## Alternatives considered

- Changing the model between turns, as Claude Code and Codex allow: one session per feature, but the
  model drifts under its runs, and the prompt cache restarts.
- Remembering the last pick: one pick lasts, but a stale pick runs silently.
- A model list kept in Uraeda: no agent to ask, but it goes stale as agents ship models.

## Consequences

- A step that needs another model starts a new session, which forgets the conversation.
- Defaults per step or per feature, planned by run options, change this decision.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), the runtimes built in and those of
  extensions, and every view or feature that starts a session
