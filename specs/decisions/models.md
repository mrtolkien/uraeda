---
status: active
approved-by: mrtolkien
icon: cpu
---

# Models

A session runs on one agent and one model, set when it starts, on an effort, the model's depth of
reasoning, which may change between turns, and on an account, a login of the agent, which changes
only when a usage limit refuses its run. The human picks the model and the effort, where the session
starts or in the run options, else the agent's own defaults apply; Uraeda picks the account among
those the human listed. Another model means another session.

## Rules

- A session MUST keep the agent and the model it started with, its automatic runs included. Checked
  by the runner's tests.
- A session whose run a usage limit refuses MUST move to another listed account with room that can
  resume its conversation; otherwise it keeps the account it started on. Checked by the runner's
  tests.
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
model nobody picked for them. Effort keeps the conversation and the model, so the human tunes it as
the work goes. An account that changes re-reads the conversation uncached, so a session moves only
when a limit refuses its run: waiting for the reset costs hours, and the same read. History:
[Multi-accounts](../done/2026-11-10-multi-accounts.md), changed on 2026-11-11.

## Alternatives considered

- Changing the model between turns, as Claude Code and Codex allow: one session per feature, but the
  model drifts under its runs, and the prompt cache restarts.
- Remembering the last pick: one pick lasts, but a stale pick runs silently.
- Keeping a run a limit refused on its account: one account per session, but the run waits hours for
  the reset while another account has room.

## Consequences

- A step that needs another model starts a new session, which forgets the conversation.
- Steps sharing a session share its agent and model; only their efforts may differ.
- A run a limit refused goes on at once on another account, whose first turn re-reads the
  conversation uncached. It waits for its own account's reset only when no other has room.
- A session's account can change between two turns: its header names the one it runs on now.

## Applies to

- [`crates/server/src/runtimes/`](/crates/server/src/runtimes/), the runtimes built in and those of
  extensions, and every view or feature that starts a session
