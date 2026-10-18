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
> - You approve [what users get, and the choices that outlive this feature, in one sentence].
> - [Where your attention matters most, one line each, at most 7 items in all: new and changed
>   decisions, risky assumptions, outside behaviour not verified yet, a relaxed guard as what an
>   attacker could do, the risk tier, costs or migrations]

[One paragraph: what the feature does, for whom, and why. Links to the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).]

## Your review

[Optional, from revision 2 on: one item per comment of the last review, with its answer.]

- **C1** ([the comment in a few words]): [done | declined]. [What was done, or why not.]

## Decisions

- **New: [[Topic]](../decisions/decision-topic.md)**. [The rule, in a sentence.]
- **Changed: [[Topic]](../decisions/decision-topic.md)**. [What changed, in a sentence.]
- **Removed: [Topic]** (`decision-topic.md`). [Why it goes.]

Relied on:

| Decision                                  | What it means for this spec |
| ----------------------------------------- | --------------------------- |
| [[Topic]](../decisions/decision-topic.md) | [how the spec follows it]   |

## User stories

### US1: [Title] (P1)

[The user's journey, in plain language, in one or two sentences.]

[[State](/path/to/Component.stories.tsx#State) or [Screen](mockups/screen-name.html): UI work only,
the story's mockup, alone in its paragraph]

Why this priority: [only when the order is not obvious]

Key scenarios:

1. **Given** [state], **When** [action], **Then** [outcome]

[Optional: the rarer scenarios, folded in the web UI. Leave out the paragraph and its list when
there are none.]

More scenarios:

1. **Given** [state], **When** [action], **Then** [outcome]

## Architecture

[The chosen approach in a few sentences, and why it fits. Links to the decisions and discovery
topics behind it.]

- **[Unit]** [what it does, and the rules it owns].

Tradeoffs:

- [A cost the approach accepts]

## Edge cases

| Importance                | Situation       | What happens        |
| ------------------------- | --------------- | ------------------- |
| [High \| Normal \| Niche] | [The situation] | [What happens then] |

## Success criteria

- **SC-001** ([measure in a few words]): [Measurable outcome]

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- [Each point you settled yourself, in a sentence, with a link to its source]

## Constitution check

| I. [Principle] | II. [Principle] |
| -------------- | --------------- |
| ✅             | ✅              |

[A line per tension, its principle's cell reading ⚠️ instead.]

## Risk tier

**[Tier]**: [one-line reason]

## History

[Optional: the records of earlier reviews, oldest last.]

> [!NOTE]
>
> Changes requested on [YYYY-MM-DD]: [what was asked].
