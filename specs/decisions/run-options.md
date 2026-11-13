---
status: active
approved-by: mrtolkien
icon: workflow
---

# Run options

How each workflow step runs, on which agent, model, and effort, in which session, with which
sub-agents and reviewers, is set by the human: defaults in the settings, and a feature's own choice
over them. Uraeda runs every sub-agent itself, so a pick holds whatever the agent would choose. A
feature's options stay on the human's machine, out of the repository.

## Rules

- A workflow run MUST end with its step. Checked by the runner's tests.
- Uraeda MUST start the next step's run itself, until the next human gate. Checked by the runner's
  tests.
- Steps MUST share a session only where the human joined them. Checked by the runner's tests.
- A step on another agent or model MUST start a new session. Checked by the runner's tests.
- Every sub-agent of a workflow run MUST be a session Uraeda starts, on the agent, model, and effort
  its role is set to, never the agent's built-in sub-agents. Checked by the runner's tests.
- A reviewer MUST be either an agent, using that agent's own review where it has one, or a command
  the human wrote.
- Every reviewer's findings MUST be committed in the feature's folder before they are fixed.
- A feature's options MUST be kept in Uraeda's data folder, never in a repository. Checked by the
  runner's tests.
- Run options MUST be shown and edited as one diagram of the steps, the same wherever they appear,
  every action by keyboard and by tap.
- A value the human never picked SHOULD fall back to the settings, then to the agent's own default.

## Why

Some steps need a stronger model or a clean context, others a cheaper one, and most of a build's
usage is its sub-agents. A pick an agent can override inside its own sub-agents is no pick. Findings
in git survive a stopped run. A repository someone else wrote must never choose what the human's
runs spend. History: [Run options](../done/2026-11-08-run-options.md).

## Alternatives considered

- One session for the whole feature, switching models: the conversation stays, but every switch
  re-reads it uncached, and another agent can never join.
- Sub-agents left to each agent, their models passed as hints: no server work, but the agent may
  pick another model, and only its own agent.
- A feature's options in its proposal's frontmatter: in git and portable, but a cloned repository
  would pick the models and efforts the human pays for.

## Consequences

- Uraeda serves each agent a sub-agent tool of its own, and turns the agent's built-in sub-agents
  off in workflow runs.
- A run that ended its step without reaching it is not chained: it asks for the human.
- A clone on another machine runs on that machine's defaults.
- Every later runtime must accept an outside tool and let its own sub-agents be turned off.

## Applies to

- [`crates/server/src/runner/`](/crates/server/src/runner/), the settings in
  [`crates/core/`](/crates/core/), the run options' views in [`app/`](/app/), and the skill's
  [implementation](/skills/uraeda/references/implementation.md) and
  [change](/skills/uraeda/references/change.md) references on sub-agents and reviews
