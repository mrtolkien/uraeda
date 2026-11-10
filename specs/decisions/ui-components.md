---
status: active
approved-by: mrtolkien
icon: component
---

# UI components

The UI looks and behaves as one product. It is built from one component library, Uraeda's own,
styled only through its tokens, and each kind of information, such as a rule, a status, or a
question, is drawn by one shared component on every page. Every surface has a height, which decides
its shadow, its glass, and its glow.

## Rules

- Views MUST use the library's components wherever one fits the job.
- Views MUST take every colour, size, blur, and glow from the library's tokens, never from a value
  of their own.
- Every surface MUST have a height: at least recessed, standard, and overlay.
- A shadow, a glass effect, or a glow MUST come from a surface's height, never from a component's
  own style.
- A kind of information MUST be drawn by one shared component on every page that shows it, where
  every change to how it is drawn is made.
- A page MUST NOT draw information its own way, unless the plan names an extremely good reason and
  the human approves it.
- A text input MUST behave as its class does everywhere: a single-line input, a multi-line markdown
  input, or a composer.
- Reading text MUST be drawn through the one shared component for prose, never sized or measured by
  a page.
- Every component MUST be shown in the gallery, the app that shows components alone, in each of its
  states.
- A component MAY use the platform's own control or material where it does the job better, such as
  the system's glass on iOS, with no caller knowing which.

## Why

Pages built one at a time drift, which the human dislikes more than a missing feature. A library of
Uraeda's own can draw glass and glow, which no ready design system for Native Shell does. Heights
give every shadow and every glass one source, so depth reads the same on every page. The gallery
shows each component on the real platform, where drift is seen. History:
[UI improvements](../done/2026-10-12-ui-improvements.md).

## Alternatives considered

- Astryx, the earlier design system: for React only.
- Written guidelines only: what produced the first pages.
- Each component setting its own shadow: depth drifts page by page.

## Consequences

- A size or a colour changes in one place, the tokens, and reaches every view.
- A shared component gets harder to change, since every page shows the change at once.
- The library is Uraeda's to build and keep: every control, with its keys and its accessibility.
- The exact look of each height comes from the UI's design language, in [`specs/ui/`](/specs/ui/).

## Applies to

- `app/`, and every feature that adds or changes a view
