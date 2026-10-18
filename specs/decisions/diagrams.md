---
status: active
approved-by: mrtolkien
icon: workflow
---

# Diagrams

Workflow files may hold diagrams written in Mermaid, in a fenced code block, which reads as text in
any editor and renders on GitHub and GitLab. The web UI draws them with the
[Pele](https://pele.run/) library, which reads Mermaid's syntax and returns an SVG without scripts,
loaded only when a page has a diagram, and inserts the SVG in the page.

## Rules

- A diagram in a workflow file MUST be a fenced code block whose language is `mermaid`. Other
  diagram languages, images of diagrams, and ASCII drawings MUST NOT be used for what a Mermaid
  flowchart, sequence, or state diagram shows. Checked by review.
- The web UI MUST draw a `mermaid` code block from the document tree the core sends, with the
  [`pele`](/packages/web/package.json) package. Checked by review.
- A diagram MUST draw without a script, an event handler, or a `javascript:` link in the page, even
  when its text holds them. Checked by the diagram's tests.
- The web UI MUST load `pele` only when a page holds a diagram, in a chunk of its own. Checked by
  the build's chunks, in review.
- A diagram that fails to render MUST show its source as a code block, with the line "This diagram
  could not be drawn." Checked by the diagram's tests.
- The `pele` package MUST be upgraded when one of its security advisories affects the version in
  use. Checked by review.
- A diagram SHOULD show a flow, a sequence, or states that a list or a table would make hard to
  follow, and MUST NOT repeat what the text around it already says as a list. Checked by review.

## Why

You chose diagrams for rounds of questions, since "a round could ask to pick between multiple flows"
([Q10](../done/2026-10-17-redesign-clarifications.md#q10-can-a-round-hold-a-diagram)). Mermaid's
source stays readable as plain text, which the
[constitution's principle II](../CONSTITUTION.md#ii-git-and-plain-text-first) requires, and GitHub
and GitLab render it in Markdown files
([Markdown rendering](../done/2026-10-17-redesign-clarifications.md)). Mermaid had a critical XSS
advisory and several HTML injection advisories, and the web UI can commit and start agents, so a
diagram must not run code in the app.

The first version drew with Mermaid's `sandbox` level, which did not keep that promise: Mermaid
appends a temporary frame to the app's page, then sets its `sandbox` attribute, which does not apply
to a frame already created: the frame runs scripts that read the app's page, in Chromium, Firefox,
and WebKit. Pele returns an SVG string without a frame, and its output has no HTML labels or
`foreignObject`, where Mermaid's advisories were. It rendered every diagram of the repository, and
none of five hostile diagrams produced a script or an event handler. You chose Pele, its SVG
inserted in the page without a frame, and no exact version pin: "I trust the dev"
([the round](../done/2026-10-18-diagram-frames.md#q1-should-the-web-ui-draw-diagrams-with-pele-instead-of-mermaid)).

## Alternatives considered

- Mermaid at its `sandbox` level, as before: its temporary frame is created with the app's origin
  and scripts, whatever attribute follows.
- Mermaid at its `strict` level in a frame of its own with scripts and an opaque origin: keeps
  Mermaid's full syntax, but needs the server to answer such a frame's reads of `/assets/*`.
- Pele's SVG in a frame without scripts: a bug in its output could not reach the app, but the frame
  needs its own sizing, theming, and measuring.
- No diagrams until the specs redesign: no dependency, but no way to compare flows in a round.

## Consequences

- Rounds, specs, and plans can show flows and states that a list would bury.
- `pele` has no dependencies, against about 114 packages for `mermaid`, and chunks of up to 680 KB,
  250 KB compressed, that only pages with a diagram load.
- Pele supports Mermaid's syntax as of version 12.1.0, with its own look and layout: a diagram may
  not look as it does on GitHub, and a newer Mermaid feature may not draw.
- Pele is a young project: its advisories and releases are ours to follow.
- A diagram is part of the page, with its colours and fonts. A bug in Pele's output would run with
  the app's rights, which the hostile-diagram tests guard.

## Applies to

- [`packages/web/`](/packages/web/): the block renderer, and every page that draws a workflow file
- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
