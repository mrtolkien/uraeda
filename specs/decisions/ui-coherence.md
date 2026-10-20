---
status: active
approved-by: mrtolkien
icon: layout-template
---

# UI coherence

The same information looks the same wherever the UI shows it. A rule, a status, a diff, or a
question is drawn by one shared component on every page, so a person who learns it once reads it
everywhere.

## Rules

- A kind of information MUST be drawn by one shared component on every page that shows it. Checked
  by review.
- A page MUST NOT present information its own way, unless the plan names an extremely good reason
  and the human approves it. Checked by review.
- A change to how information is drawn MUST be made in its shared component, so every page follows.
  Checked by review.
- A text input MUST behave as its class does everywhere: a single-line input, a multi-line markdown
  input, or a composer. Its keys, its hints, and its buttons are the class's, not the page's.
  Checked by review.
- Reading text MUST be drawn through `Prose` (`packages/web/src/Prose.tsx`): its size, line,
  measure, and the markdown that holds prose. A page MUST NOT import Astryx's `Markdown`, or set the
  reading size or measure, itself. Checked by lint and a test, which hold the files that still set
  it by hand to a list that only shrinks.
- A page's column width MUST be a named property of `Page`, backed by a token, not derived from
  another flag. Checked by review.

## Why

Pages built one at a time drift: the decisions page drew a rule as plain text while the spec page
drew it with its strength and its check. The human dislikes this more than a missing feature. The
rule is short on purpose: the intent is the decision, and the components are the code.

The agent's messages drew markdown on their own, with a replaced paragraph, Astryx's default 680 px
cap on lists, and a width set on the page by a padding flag, so the same text looked different from
the spec's. A rule checked by review caught none of it, so the rule for reading text is checked by a
tool.

## Consequences

- A new page reuses what exists before it draws anything, and finds gaps in the shared components.
- A shared component gets harder to change, since every page shows the change at once.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
