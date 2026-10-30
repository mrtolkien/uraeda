---
status: awaiting-human
---

# Clarifications, round 02: Proposal start flow

> [!IMPORTANT]
>
> 1 question, about 5 minutes.
>
> - Verdict: worth building, with changes: replacing a draft with Undo conflicts with an active
>   decision.
> - Your answer on a draft already in the composer conflicts with UI behaviour's rule against
>   dropping unsaved text without asking.
> - The recommended way out changes that decision for one case, which outlives this feature.
> - Your other answers hold: the spec follows them once this one is settled.

## Context

### Since the last round

You answered [round 01](clarifications-01.md) with all four recommended options. Writing the spec, I
found that one of them breaks an active decision, which round 01 did not name. A conflict with a
decision is yours to resolve, so this round asks only that.

### Goal

A line's Start fills the New page's composer with the line, without adding to the text already
there.

### Today

You chose to have the line replace the composer's text (A in Q4 of round 01). A toast's Undo brings
the old text back. The active [UI behaviour](/specs/decisions/ui-behaviour.md) decision says:

> Unsaved text MUST NOT be dropped without asking.

The composer's draft is unsaved text: it lives in the browser's unsaved store, as every field of
several lines does ([`fields/unsaved.ts`](/packages/web/src/fields/unsaved.ts)). The undo toast
stays 5 seconds ([`useUndoToast`](/packages/web/src/layout/useUndoToast.ts)). Today it only undoes
deletes of saved rows, like an inbox note's.

### Scope

A line's Start when the composer already holds text. An empty composer is filled with nothing to
ask, under either option.

### Sources

- The [UI behaviour](/specs/decisions/ui-behaviour.md) decision, the [flows](/specs/ui/flows.md) and
  [surfaces](/specs/ui/surfaces.md) guides, and the undo toast's code.
- The full investigation is in [discovery](discovery-02.md).

## Q1: How should the draft replaced by a line's Start be protected?

Example: the composer holds "Widen the sidebar", a draft from yesterday. You press Start on the line
"Proposal start flow" of the priorities.

The decision protects typed text because the UI saves only on a button. Elsewhere, discarding text
asks first, through the shared confirmation answered by `y` or `n`
([flows](/specs/ui/flows.md#committing)). More in
[discovery](discovery-02.md#resolving-the-conflict).

Why it matters: option A changes a decision every view follows; option B keeps it, at one more key
on a Start with a draft.

- **A (recommended). Keep your answer, and narrow the rule. It becomes: "Unsaved text MUST NOT be
  dropped without asking, except a composer's draft replaced by a human's Start, with an Undo."**
  - Example: the composer reads "Proposal start flow"; "Draft replaced · Undo" shows 5 seconds, and
    `u` brings "Widen the sidebar" back.
  - [pro] the Start stays one action, as you chose.
  - [con] the draft is gone once the toast is, and the decision gains an exception.
  - Why recommended: you picked it knowing the Undo's limit; the exception stays narrow, one action
    the human starts.
- **B. Keep the rule, and ask first: when the composer holds text, a Start opens the shared
  confirmation, "Replace your draft?", answered by `y` or `n`.**
  - Example: "Replace your draft?" opens; `y` fills the composer with "Proposal start flow", `n`
    keeps "Widen the sidebar".
  - [pro] no draft is ever lost by surprise, and no decision changes.
  - [con] one more key on every Start made with a draft in the composer.

**Answer:**

**Notes:**
