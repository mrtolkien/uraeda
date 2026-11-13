---
icon: workflow
---

# Run options

> "I want to be able to select models per step for the workflow still"

Said of what any tool that runs the workflow must keep. A step is one stage of the workflow that an
agent runs, as the spec or the build. Its pick is what it runs on: an agent, a model, and an effort,
the model's depth of reasoning.

## Rules

- The human picks how each step runs: its agent, model, and effort, and which steps share a session.
  Defaults are in the settings, and a feature's own picks go over them. _So:_ steps share a session
  only where the human joined them: a change promoted to a feature runs the feature's first step in
  a new session.
- Another agent or model means another session: a session keeps the agent and the model it started
  with. _So:_ a step set to another model starts a new session, and steps joined into one session
  run on one model. Only the effort may change between a session's turns.
- Uraeda starts every sub-agent of a workflow run itself, as a session on the agent, model, and
  effort of its role, never the agent's built-in sub-agents. _So:_ an agent's own sub-agent tool is
  turned off in a workflow run, and an agent added later must let Uraeda do the same.

## Why

Some steps need a stronger model or a clean context, others a cheaper one, and most of a build's
usage is its sub-agents. A model that changes during a session would surprise the human, and a pick
an agent can override inside its own sub-agents is no pick. A feature's options stay out of git, as
[Settings](settings.md) says, an exception to the constitution's "git and plain text first".
History: [Run options](../done/2026-11-08-run-options.md).

## Alternatives considered

- Changing the model between a session's turns, as Claude Code and Codex allow: one session per
  feature, but the model drifts under its runs.

- Sub-agents left to each agent, their models passed as hints: no server work, but the agent may
  pick another model, and only its own agent.
- A feature's options in its proposal's frontmatter: in git and portable, but a cloned repository
  would pick the models and efforts the human pays for.

## Applies to

- [`crates/server/src/runner/`](/crates/server/src/runner/), the settings in
  [`crates/core/`](/crates/core/), the run options' views in [`app/`](/app/), every view or feature
  that starts a session, and the skill's guidance on sub-agents and reviews

## Revisit when

The human decides whether Uraeda keeps running agents itself, or sits on another orchestrator with
its skill, its CLI, and a small view: they asked on 2026-11-13, and it is open. The first rule is
the one they said must survive either way.
