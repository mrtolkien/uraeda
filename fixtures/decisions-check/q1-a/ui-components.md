---
status: proposed
approved-by:
icon: component
---

# UI components

The web UI looks and behaves as one product because it is built from one design system, Astryx, and
styled only through its theme. The same information looks the same wherever the UI shows it.

## Rules

- A kind of information MUST be drawn by one shared component on every page that shows it. Checked
  by review.
- Views MUST use Astryx components wherever one fits the job, and be styled only through its theme.
  Checked by lint.
- A change to how information is drawn MUST be made in its shared component, so every page follows.
  Checked by review.
- A raw element MAY stand in for a missing Astryx component, with a reason. Checked by lint and
  review.

## Why

Pages built one at a time drift, and a rule written in two decisions drifts with them. One decision
holds both the design system and the shared components.

## Alternatives considered

- Keeping UI coherence as a second decision: the shared-component rule then lives in two files.

## Consequences

- A new page reuses what exists before it draws anything.
- A size or a colour changes in one place, the theme, and reaches every view.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
