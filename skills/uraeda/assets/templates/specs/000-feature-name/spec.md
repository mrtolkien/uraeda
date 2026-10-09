---
status: awaiting-human
revision: 1
clarifications: [latest round included: 1]
risk-tier: [low | medium | high]
plan-review: false # medium only
---

# Spec: [Feature name]

> [!IMPORTANT]
>
> Spec to review, about [M] minutes.
>
> - [Where your attention matters most, one line each: new and changed decisions, risky assumptions,
>   the risk tier, costs or migrations]

[One paragraph: what the feature does, for whom, and why. Links to the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).]

## User stories

### US1: [Title] (P1)

[The user's journey, in plain language.]

Why this priority: [reason]

Acceptance scenarios:

1. **Given** [state], **When** [action], **Then** [outcome]

## Edge cases

- [What happens when ...]

## Success criteria

- **SC-001**: [Measurable outcome]

## Design

### Approach

[The chosen approach in a few sentences, and why it fits. Links to the decisions and discovery
topics behind it.]

### Data

[What is stored or changes, and how data flows between the components.]

### Components

- **[Unit]** ([`path`](/path)): [what it does, how it is used, what it depends on]

### Error handling

- [What can fail, and what the user sees]

### Testing

| What                                       | How                                              |
| ------------------------------------------ | ------------------------------------------------ |
| [Acceptance scenarios, edge cases, SC-00x] | [Integration test, table-driven test, benchmark] |

## Assumptions

- [The points settled in the clarifications, then what the agent settled while writing the spec.]

## Decisions

- [Topic](../decisions/decision-topic.md): new, changed, or relied on

## Constitution check

| Principle or decision | Complies | Notes |
| --------------------- | -------- | ----- |
| I. [Principle]        | yes      |       |

## Risk tier

**[Tier]**: [one-line reason]
