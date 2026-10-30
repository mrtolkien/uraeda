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
- The web UI MUST draw diagrams with the Pele library. Checked by review.
- A diagram MUST NOT run a script in the page, even when its text holds one. Checked by the
  diagram's tests.
- A diagram that fails to draw MUST show its source instead. Checked by the diagram's tests.
- A diagram MUST NOT repeat what the text around it says. Checked by review.
- A diagram SHOULD show a flow, a sequence, or states that a list or a table would make hard to
  follow. Checked by review.
- The web UI SHOULD load the diagram library only on a page that holds a diagram. Checked by review.

## Why

Diagrams let a round of questions compare flows, and Mermaid's source stays readable as plain text,
as the constitution's principle II asks. The web UI can commit and start agents, so a diagram must
not run code there. Mermaid had critical script-injection advisories, and its sandbox level did not
hold. Pele returns plain SVG, with no HTML inside. History:
[Diagram frames](../done/2026-10-18-diagram-frames.md).

## Alternatives considered

- Mermaid at its `sandbox` level: its temporary frame runs scripts with the app's origin.
- Mermaid at its `strict` level, in a frame of its own: its full syntax, but the server must serve
  the frame.
- Pele's SVG in a frame without scripts: safer, but it needs its own sizing, theming, and measuring.

## Consequences

- Rounds, specs, and plans can show flows and states that a list would bury.
- A diagram may not look as it does on GitHub, and a newer Mermaid feature may not draw.
- Pele is a young project: its advisories and releases are ours to follow.
- A bug in Pele's output would run with the app's rights, which the hostile-diagram tests guard.

## Applies to

- [`packages/web/`](/packages/web/), and every page that draws a workflow file
- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
