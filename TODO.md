# TODO

Open design questions to settle before the PoC. Each item has a recommendation to review.

- [ ] Define how a workflow step is done
- [ ] Define risk tiers
- [ ] Define the decision template

## Define how a workflow step is done

A git listener, or a fresh agent, must be able to tell from the files alone whether a step is
waiting for the human, waiting for an agent, or approved. For example, it must not start the spec
while the human has answered only 3 of the 12 questions.

### Recommendation

Add a `status` field in the frontmatter of each workflow file:

```md
---
status: awaiting-human
---
```

| File                | Set by the agent | Set by the human                  |
| ------------------- | ---------------- | --------------------------------- |
| `clarifications.md` | `awaiting-human` | `answered`                        |
| `spec.md`           | `awaiting-human` | `approved` or `changes-requested` |
| `plan.md`           | `awaiting-human` | `approved` or `changes-requested` |
| `plan.md`           | `auto-approved`  | (when the risk tier allows it)    |
| `tasks.md`          | none             | none: checkboxes track progress   |

- Agents only ever set `awaiting-human` or `auto-approved`. Only a human sets `answered`, `approved`
  or `changes-requested`, which follows constitution principle I.
- The listener triggers an agent run when a human-set status is committed.
- With `changes-requested`, the human writes their feedback in a `## Review` section at the end of
  the file, so the agent knows what to change.
- The status values and their meaning are documented in `specs/README.md`.

Alternatives considered:

- A single state file per spec folder: one place to read, but it duplicates information that belongs
  to each file, and it gets out of sync.
- Commit message trailers (`Uraeda-Step: spec-approved`): invisible when reading the files, which
  breaks "readable and editable without uraeda tools" (constitution principle II).

## Define risk tiers

The risk tier decides how much human review a feature gets. Today it only decides whether the human
must approve the plan.

### Recommendation

Start with two tiers, and add a third one only if a real need appears:

| Tier   | Plan approval  | Typical features                                                                  |
| ------ | -------------- | --------------------------------------------------------------------------------- |
| `low`  | auto-approved  | Isolated UI or behaviour changes, no data or interface change                     |
| `high` | human required | Changes to stored data, security, public interfaces (contracts), new dependencies |

- The agent proposes a tier in the spec with a one-line reason. The human can raise or lower it when
  approving the spec.
- When unsure, the agent proposes `high`.
- A feature with a `data-model.md` or `contracts/` is `high` by default.
- The constitution can set a minimum tier for the whole project, for example "every feature is
  `high`" while a project is young.
- Code is always reviewed in the PR, whatever the tier: the tier only controls the extra plan
  review.

## Define the decision template

Decision statuses are defined (proposed, active, overridden), but not what a decision file contains.

### Recommendation

A short version of the classic ADR format (Michael Nygard), with the status in the frontmatter like
the other workflow files:

```md
---
status: proposed # proposed | active | overridden
overridden-by: # number of the newer decision, only when overridden
spec: 001-recurring-tasks # spec folder that produced the decision
date: 2026-10-07
---

# 0003. Recurring tasks use presets

## Context

Why a decision was needed. Links to the clarification question and to `research.md`.

## Decision

What was decided, written as a rule agents can check: "Recurrence MUST be one of daily, weekly,
monthly."

## Consequences

What this makes easier or harder, and what it rules out.
```

- Writing the decision as a MUST/SHOULD rule lets specs and plans be checked against it, like the
  constitution.
- Alternatives stay in `research.md`, to keep decision files short.
- Later, an `affects` field (files, folders, or topics the decision applies to) would help find the
  decisions relevant to a proposal. It could feed the "is this decision relevant?" classifier in the
  Later priorities.
