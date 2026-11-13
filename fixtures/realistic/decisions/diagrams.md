---
icon: workflow
---

# Diagrams

> "A diagram never runs code in the app."

Workflow files may hold diagrams in Mermaid, which reads as text in any editor and renders on GitHub
and GitLab.

## Rules

- A diagram in a workflow file is a fenced `mermaid` code block. _So:_ never an image or an ASCII
  drawing.
- The web UI draws diagrams with the [Pele](https://pele.run/) library, and a diagram never runs a
  script in the page. _So:_ a diagram whose text holds a script draws without running it.
- A diagram that fails to draw shows its source instead. _So:_ a typo never hides the diagram.
- A diagram shows what a list or a table would make hard to follow. _So:_ it never repeats the text
  around it.

## Why

Mermaid's source stays readable as plain text, as the constitution's principle II asks. The web UI
can commit and start agents, so a diagram must not run code there, and Mermaid's own sandbox did not
hold. History: [Diagram frames](../done/2026-10-18-diagram-frames.md).

## Alternatives considered

- Mermaid at its `sandbox` level: its temporary frame runs scripts with the app's origin.
- Pele's SVG in a frame without scripts: safer, but it needs its own sizing, theming, and measuring.

## Applies to

- [`packages/web/`](/packages/web/), and every page that draws a workflow file
- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
