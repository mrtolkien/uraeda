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
- An agent chat composer, the field that sends a message to an agent or starts a change, MUST send
  with Ctrl+Enter or Cmd+Enter, never with Enter, which adds a line, and its send button MUST show
  that key on wide screens. One-line fields, like the inbox's, are not composers. Checked by test.

## Why

Pages built one at a time drift: the decisions page drew a rule as plain text while the spec page
drew it with its strength and its check. The human dislikes this more than a missing feature. The
rule is short on purpose: the intent is the decision, and the components are the code.

## Consequences

- A new page reuses what exists before it draws anything, and finds gaps in the shared components.
- A shared component gets harder to change, since every page shows the change at once.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
