# Discovery, round 02: Proposal start flow

## Why this round

Writing the spec from [round 01](clarifications-01.md) found a conflict with an active decision. The
answer to Q4 of round 01 has a line's Start replace the composer's text, with a toast whose Undo
brings it back. The active [UI behaviour](/specs/decisions/ui-behaviour.md) decision says "Unsaved
text MUST NOT be dropped without asking." Round 01 did not name that rule, and a conflict with an
active decision is the human's to resolve
([constitution, I](/specs/CONSTITUTION.md#i-humans-stay-in-control)). The other answers raise no
conflict: see [what the other answers rely on](#what-the-other-answers-rely-on).

## Summary

The composer's draft is unsaved text in the decision's sense: the Change and Feature cards keep it
in the browser's unsaved store, as every field of several lines does. A toast's Undo lasts 5
seconds, after which the replaced draft is gone. Either the decision gives way for this one case, or
the Start asks before replacing a draft.

## How other products do it

Round 01's products prefill or start from an issue without saying what happens to a draft already in
the box: see [round 01](discovery-01.md#what-they-have-in-common). Nothing new was found for this
round.

### What they have in common

None documents protecting a draft a prefill replaces.

## Standards and libraries

### The rule and its reason

- The rule, in [UI behaviour](/specs/decisions/ui-behaviour.md): "Unsaved text MUST NOT be dropped
  without asking. Checked by review."
- Its reason, in the same file: "Saving on a button needs unsaved text protected, as GitHub does."
- Its consequence: "Unsaved text is kept on the same device only."

### How the UI asks today

- [Surfaces](/specs/ui/surfaces.md): `Escape` drops a change "asking first when there is one", and
  the shared confirmation, "answered by `y` or `n`, its focus on Cancel", guards deleting and
  discarding.
- [Flows](/specs/ui/flows.md#committing): "Discard asks first, through the shared confirmation,
  since it destroys what was typed."
- The undo toast, [`useUndoToast`](/packages/web/src/layout/useUndoToast.ts): 5 seconds, `u` or its
  button. It backs deletes of saved rows, like an inbox note's, never unsaved text.

## The code

### Important reads

- [`fields/unsaved.ts`](/packages/web/src/fields/unsaved.ts): the unsaved store, mirrored in
  `localStorage`, which holds the Change's and the Feature's texts today.
- [`NewPage.tsx`](/packages/web/src/NewPage.tsx): "Kept as a new chat's text is: leaving the page
  does not ask." Leaving the page keeps the draft; nothing drops it today but a start that sent it.

### The proposal's path and existing actions

- **A line's Start with a draft in the composer**: today the line is appended, so nothing is
  dropped. Replacing it, as answered, is the first action of the New page that drops a draft.
- **The Undo after 5 seconds**: the toast is gone, and the draft cannot come back.

### What the other answers rely on

- **The feature started for every text**: no decision governs the New page's send.
- **The discovery's message unsent**: follows [flows](/specs/ui/flows.md#starting-the-agent), a
  guide.
- **The research effort in the dialog**: "a dialog only to confirm an irreversible action or to hold
  a short form", in [UI behaviour](/specs/decisions/ui-behaviour.md): a slug and an effort are a
  short form.

### Likely changes

- [`specs/decisions/ui-behaviour.md`](/specs/decisions/ui-behaviour.md): its rule narrowed, with
  [narrowing the rule](#resolving-the-conflict).
- [`NewPage.tsx`](/packages/web/src/NewPage.tsx): the Start's replace, with the undo toast or the
  shared confirmation, under either option.

## The proposal

### Replacing a draft drops unsaved text

The answer and the rule cannot both hold as written: past the Undo's 5 seconds, a replaced draft is
dropped without having been asked.

## Approaches

Criteria: the answer to Q4 of [round 01](clarifications-01.md), the
[UI behaviour](/specs/decisions/ui-behaviour.md) rule, and the length of the Start's path, the point
of this feature.

### Resolving the conflict

| Option                                            | Decision          | Start with a draft | Draft lost        |
| ------------------------------------------------- | ----------------- | ------------------ | ----------------- |
| A. Narrow the rule: a Start with Undo may replace | changed, one case | 0 clicks, Undo 5 s | after 5 s         |
| B. Ask first when the composer holds text         | unchanged         | 1 more key         | never by surprise |

### Needs no choice

- **An empty composer**: nothing is dropped, so the Start fills it without a toast or a question,
  under either option.

## Not checked

- Nothing: this round relies on the repository only.
