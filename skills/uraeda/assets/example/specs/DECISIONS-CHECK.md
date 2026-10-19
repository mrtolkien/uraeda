---
status: awaiting-human
---

# Decisions check

> [!IMPORTANT]
>
> 1 question on 6 decisions, about 5 minutes.
>
> - Code quality names an ESLint directive and option that the lint's own configuration holds

## Context

I read the constitution and the 6 decisions of `specs/decisions/`. Only Code quality holds a
finding: the other 5 compete with no decision and name no value the code owns.

## Q1: Should Code quality keep the ESLint directive and option in its rules?

[Code quality](/specs/decisions/code-quality.md) marks old code that breaks a limit with an
`// eslint-disable-next-line <rule> -- <reason>` comment, and fails the lint on a marker left behind
through ESLint's `reportUnusedDisableDirectives: "error"`. Both are mechanism: the lint's
configuration holds them, and a change of ESLint's syntax changes them without you.

Why it matters: a rule that names the directive needs your approval when the lint's syntax changes,
though the intent, markers that only disappear, stays.

- **A (recommended). Say that marked code needs a reason and that a stale marker fails the lint,
  without the directive's syntax or the option's name.**
  - [pro] the rule survives a change of ESLint's syntax.
  - [con] a reader must open `eslint.config.js` to see the exact option.
  - Why recommended: a decision states intent, and the configuration holds the option.
- **B. Keep the rule as it is.**
  - [pro] the rule says exactly what the lint is set to.
  - [con] a lint upgrade can make the decision wrong.

The edited decision is in `specs/decisions-check/q1-a/code-quality.md`.

**Answer:**

**Notes:**
