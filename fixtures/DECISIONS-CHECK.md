---
status: awaiting-human
---

# Decisions check

> [!IMPORTANT]
>
> 1 question on 5 decisions, about 5 minutes.
>
> - UI components and UI coherence both say that views share components: one may absorb the other

## Context

I read the constitution and the 5 decisions of `specs/decisions/`. One pair says the same thing
twice, and the rest hold no finding.

## Q1: Do UI components and UI coherence both require shared components?

[UI components](/specs/decisions/ui-components.md) asks for Astryx components in every view, and
UI coherence asks for one shared component per kind of information. A change to the shared-component
rule must be made in both files.

Why it matters: a rule that lives in two files drifts, and an agent reading one misses the other.

- **A (recommended). Merge the coherence rule into UI components, and delete UI coherence.**
  - [pro] the rule lives in one place.
  - [con] UI components grows to four rules.
  - Why recommended: the constitution asks each rule to live in one place.
- **B. Keep both decisions as they are.**
  - [pro] each decision keeps its own history.
  - [con] the rule stays in two files.

**Answer:**

**Notes:**
