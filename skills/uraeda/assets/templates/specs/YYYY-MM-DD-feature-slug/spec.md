---
status: awaiting-human
revision: 1
clarifications: [latest round included: 1]
risk-tier: [low | medium | high]
plan-review: false
---

# Spec: [Feature name]

> [!IMPORTANT]
>
> Spec to review, about [M] minutes.
>
> - [Where your attention matters most, one line each: new and changed decisions, risky assumptions,
>   outside behaviour not verified yet, a relaxed guard as what an attacker could do, the risk tier
>   and whether the plan waits for your review, costs or migrations]

[One paragraph: what the feature does, for whom, and why. Links to the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).]

## User stories

### US1: [Title] (P1)

[The user's journey, in plain language, in one or two sentences.]

Why this priority: [reason]

Acceptance scenarios:

1. **Given** [state], **When** [action], **Then** [outcome]

## Edge cases

- [What happens when ...]

## Success criteria

- **SC-001**: [Measurable outcome]

## Architecture

[The chosen approach in a few sentences, and why it fits: the main units, where each new rule lives,
and the tradeoffs. Links to the decisions and discovery topics behind it.]

## Mockups

[Optional, UI work only: remove this section otherwise. With an active preview decision, each story
of the spec, also embedded alone in its paragraph where it illustrates.]

- [[State](/path/to/Component.stories.tsx#State) or [Screen](mockups/screen-name.html): what it
  shows]

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- [Each point settled without the human, in a sentence]

Settled while writing this spec:

- [Each point you settled yourself, in a sentence, with a link to its source]

## Decisions

New, applied when this spec is approved:

- [Topic](../decisions/decision-topic.md): [the rule, in a sentence]

Changed, applied when this spec is approved:

- [Topic](../decisions/decision-topic.md): [the proposed change, in a sentence. Link to its
  `## Proposed change (YYYY-MM-DD-feature-slug)` section]

Relied on:

- [Topic](../decisions/decision-topic.md): [how the spec follows it]

## Constitution check

| Principle      | Complies | Notes |
| -------------- | -------- | ----- |
| I. [Principle] | yes      |       |

## Risk tier

**[Tier]**: [one-line reason]

## Details

### Data

[What is stored or changes, with exact types, the rules that apply to it, and how it flows between
the components.]

### Components

- **[Unit]** ([`path`](/path)): [what it does, how it is used, what it depends on]

### Error handling

- [What can fail, and what the user sees]

### Testing

[How the integration tests run: what they render, on which store, with which clock, and how they
drive the feature like a user.]

| What                                       | Test                                             |
| ------------------------------------------ | ------------------------------------------------ |
| [Acceptance scenarios, edge cases, SC-00x] | [Integration test, table-driven test, benchmark] |
