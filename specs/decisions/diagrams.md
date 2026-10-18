---
status: proposed
approved-by:
icon: workflow
---

# Diagrams

Workflow files may hold diagrams written in Mermaid, in a fenced code block, which reads as text in
any editor and renders on GitHub and GitLab. The web UI draws them with the
[Pele](https://pele.run/) library, which reads Mermaid's syntax and returns an SVG, loaded only when
a page has a diagram, and shows the SVG in a sandboxed frame, so a diagram cannot run code in the
app.

## Rules

- A diagram in a workflow file MUST be a fenced code block whose language is `mermaid`. Other
  diagram languages, images of diagrams, and ASCII drawings MUST NOT be used for what a Mermaid
  flowchart, sequence, or state diagram shows. Checked by review.
- The web UI MUST draw a `mermaid` code block from the document tree the core sends, with the `pele`
  package pinned to an exact version in [`packages/web`](/packages/web/package.json). Checked by
  review.
- The web UI MUST show each diagram's SVG in a frame whose sandbox has no scripts, no
  `allow-same-origin`, and no top navigation, so the SVG cannot reach the app. Checked by the
  diagram's tests.
- The web UI MUST load `pele` only when a page holds a diagram, in a chunk of its own. Checked by
  the build's chunks, in review.
- A diagram that fails to render MUST show its source as a code block, with the line "This diagram
  could not be drawn." Checked by the diagram's tests.
- The `pele` package MUST be upgraded when one of its security advisories affects the pinned
  version. Checked by review.
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
diagram must not reach the app, whatever the library's next bug.

The first version drew with Mermaid's `sandbox` level, which did not keep that promise. Mermaid
appends a temporary frame to the app's page, then sets its `sandbox` attribute, which does not apply
to a frame already created: the frame runs scripts that read the app's page, in Chromium, Firefox,
and WebKit. Pele returns an SVG string without a frame, and its output has no HTML labels or
`foreignObject`, where Mermaid's advisories were. It rendered every diagram of the repository, and
none of five hostile diagrams produced a script or an event handler. See
[the round that proposed it](../changes/2026-10-18-diagram-frames/clarifications-01.md).

## Alternatives considered

- Mermaid at its `sandbox` level, as before: its temporary frame is created with the app's origin
  and scripts, whatever attribute follows.
- Mermaid at its `strict` level in a frame of its own with scripts and an opaque origin: keeps
  Mermaid's full syntax, but needs the server to answer such a frame's reads of `/assets/*`.
- Pele's SVG inserted into the page: simpler sizing and theming, but a bug in a young library would
  run code with the app's rights.
- No diagrams until the specs redesign: no dependency, but no way to compare flows in a round.

## Consequences

- Rounds, specs, and plans can show flows and states that a list would bury.
- `pele` has no dependencies, against about 114 packages for `mermaid`, and a chunk of about 680 KB,
  250 KB compressed, that only pages with a diagram load.
- Pele supports Mermaid's syntax as of version 12.1.0, with its own look and layout: a diagram may
  not look as it does on GitHub, and a newer Mermaid feature may not draw.
- Pele is a young project: its advisories and releases are ours to follow.
- A diagram's frame has its own height and theme: the UI sets its colours, and a diagram does not
  follow the page's fonts exactly.

## Applies to

- [`packages/web/`](/packages/web/): the block renderer, and every page that draws a workflow file
- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
