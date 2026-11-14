---
icon: workflow
---

# Run options

> "I want to be able to select models per step for the workflow still"

Said of what any tool that runs the workflow must keep. A step is one stage of the workflow that an
agent runs, as the spec or the build. Its pick is what it runs on: an agent, a model, and an effort,
the model's depth of reasoning. `ura` runs no agent: the session host, or the human, starts each
session, and `ura next` tells it the pick.

## Rules

- The human picks how each step runs: its agent, model, and effort, and which steps share a session.
  The picks are in the settings file, which `ura serve`'s settings page edits, and `ura next` prints
  the step's. _So:_ steps share a session only where the human joined them: the plan starts in a new
  session unless they join it, and a step with no pick runs on the session's own.
- The build's implementers and its reviewers run on their own picks, as sub-agents, which the
  session host starts when it can run an agent on a pick. _So:_ an agent whose session host cannot
  start a session on the reviewers' pick uses its own sub-agents, and says so in the pull request.

## Why

Some steps need a stronger model or a clean context, others a cheaper one, and most of a build's
usage is its sub-agents. The picks stay out of git, as [Settings](settings.md) says, an exception to
the constitution's "git and plain text first": a cloned repository would otherwise pick the models
and efforts the human pays for. History: [Run options](../done/2026-11-08-run-options.md).

## Alternatives considered

- Changing the model between a session's turns, as Claude Code and Codex allow: one session per
  feature, but the model drifts under its runs.
- Sub-agents started by Uraeda's own server, each as a session on its role's pick, with the agent's
  own sub-agent tool turned off, the 2.x way: a pick no agent could override, but a server that runs
  agents, which Uraeda light removed.
- A feature's options in its proposal's frontmatter: in git and portable, but a cloned repository
  would pick the models and efforts the human pays for.

## Applies to

- The settings in [`crates/core/`](/crates/core/), `ura next` in [`crates/cli/`](/crates/cli/), the
  settings page in [`crates/serve/`](/crates/serve/), and the skill's guidance on sessions,
  sub-agents, and reviews
