---
status: awaiting-human
---

# Decisions check

> [!IMPORTANT]
>
> 2 questions on 12 decisions, about 4 minutes.
>
> - UI components and UI coherence both say that views share components: one may absorb the other

## Context

I read the constitution and the 12 decisions of `specs/decisions/`. One pair says the same thing
twice, and the rest hold no finding.

## Q1: UI components and UI coherence both require shared components

[UI components](/specs/decisions/ui-components.md) asks for Astryx components in every view, and
UI coherence asks for one shared component per kind of information. A change to the shared-component rule must be made in both files.

Why it matters: a rule that lives in two files drifts, and an agent reading one misses the other.

- **A (recommended). Merge the coherence rule into UI components, and delete UI coherence.**
  - [pro] the rule lives in one place.
  - [con] UI components grows to four rules.
  - Why recommended: the constitution asks each rule to live in one place.
- **B. Keep both decisions as they are.**
  - [pro] each decision keeps its own history.
  - [con] the rule stays in two files.

**Answer:**

## Q2: Do the other decisions need a change

The other 10 decisions each state an intent with checks, name no flag or timeout, and do not
conflict with the constitution.

Why it matters: a check that finds nothing should still say what it read.

- **A (recommended). Keep them as they are.**
  - [pro] no review effort.
  - [con] none found.
  - Why recommended: no finding.
- **B. Ask for another check after the next feature.**
  - [pro] the ledger stays watched.
  - [con] one more run to review.

**Answer:**

**Notes:**
