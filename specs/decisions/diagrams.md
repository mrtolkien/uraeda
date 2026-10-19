---
status: active
approved-by: mrtolkien
icon: workflow
---

# Diagrams

Workflow files may hold diagrams written in Mermaid, in a fenced code block, which reads as text in
any editor and renders on GitHub and GitLab. The web UI draws them with the
[Pele](https://pele.run/) library, so a diagram never runs code in the app.

## Rules

- A diagram in a workflow file MUST be a fenced `mermaid` code block, not another diagram language,
  an image, or an ASCII drawing. Checked by review.
- The web UI MUST draw a diagram with the [`pele`](/packages/web/package.json) package, and a
  diagram MUST NOT run a script in the page, even when its text holds one. Checked by the diagram's
  tests.
- A diagram that fails to draw MUST show its source instead. Checked by the diagram's tests.
- The web UI SHOULD load the diagram library only when a page holds a diagram. Checked by review.
- A diagram SHOULD show a flow, a sequence, or states that a list or a table would make hard to
  follow, and MUST NOT repeat what the text around it says. Checked by review.

## Why

You chose diagrams for rounds of questions, since "a round could ask to pick between multiple flows"
([Q10](../done/2026-10-17-redesign-clarifications.md#q10-can-a-round-hold-a-diagram)). Mermaid's
source stays readable as plain text, which the
[constitution's principle II](../CONSTITUTION.md#ii-git-and-plain-text-first) requires.

Mermaid had critical XSS advisories, and the web UI can commit and start agents, so a diagram must
not run code in the app. Mermaid's `sandbox` level did not keep that promise. Pele returns an SVG
without HTML labels or `foreignObject`. You chose Pele, its SVG inserted in the page, and no exact
version pin: "I trust the dev"
([the round](../done/2026-10-18-diagram-frames.md#q1-should-the-web-ui-draw-diagrams-with-pele-instead-of-mermaid)).

## Alternatives considered

- Mermaid at its `sandbox` level, as before: its temporary frame runs scripts with the app's origin.
- Mermaid at its `strict` level in a frame of its own: keeps its full syntax, but needs server
  support for the frame.
- Pele's SVG in a frame without scripts: safer, but needs its own sizing, theming, and measuring.
- No diagrams until the specs redesign: no way to compare flows in a round.

## Consequences

- Rounds, specs, and plans can show flows and states that a list would bury.
- Pele has no dependencies, but a diagram may not look as it does on GitHub, and a newer Mermaid
  feature may not draw.
- Pele is a young project: its advisories and releases are ours to follow.
- A bug in Pele's output would run with the app's rights, which the hostile-diagram tests guard.

## Applies to

- [`packages/web/`](/packages/web/): the block renderer, and every page that draws a workflow file
- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
