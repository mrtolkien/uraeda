---
status: proposed
approved-by:
icon: workflow
---

# Diagrams

Workflow files may hold diagrams written in Mermaid, in a fenced code block, which reads as text in
any editor and renders on GitHub and GitLab. The web UI draws them with the `mermaid` library,
loaded only when a page has a diagram, inside a sandboxed frame, so a diagram cannot run code in the
app.

## Rules

- A diagram in a workflow file MUST be a fenced code block whose language is `mermaid`. Other
  diagram languages, images of diagrams, and ASCII drawings MUST NOT be used for what a Mermaid
  flowchart, sequence, or state diagram shows. Checked by review.
- The web UI MUST draw a `mermaid` code block from the document tree the core sends, with the
  `mermaid` package pinned to an exact version in [`packages/web`](/packages/web/package.json).
  Checked by review.
- The web UI MUST render diagrams at Mermaid's `sandbox` security level, so each diagram is drawn in
  a sandboxed frame without scripts or the app's origin. Checked by the diagram's tests.
- The web UI MUST load `mermaid` only when a page holds a diagram, in a chunk of its own. Checked by
  the build's chunks, in review.
- A diagram that fails to render MUST show its source as a code block, with the line "This diagram
  could not be drawn." Checked by the diagram's tests.
- The `mermaid` package MUST be upgraded when one of its security advisories affects the pinned
  version. Checked by review.
- A diagram SHOULD show a flow, a sequence, or states that a list or a table would make hard to
  follow, and MUST NOT repeat what the text around it already says as a list. Checked by review.

## Why

You chose diagrams for rounds of questions, since "a round could ask to pick between multiple flows"
([Q10](../done/2026-10-17-redesign-clarifications.md#q10-can-a-round-hold-a-diagram)). Mermaid's
source stays readable as plain text, which the
[constitution's principle II](../CONSTITUTION.md#ii-git-and-plain-text-first) requires, and GitHub
and GitLab render it in Markdown files
([Markdown rendering](../done/2026-10-17-redesign-clarifications.md)). The library has had a
critical XSS advisory and several HTML injection advisories, and the web UI can commit and start
agents: drawing each diagram in a sandboxed frame keeps a crafted diagram from reaching the app,
whatever the library's next bug. The sandbox level was checked to render in WebKit, in the spec's
mockups.

## Alternatives considered

- Mermaid at its `strict` level, drawn in the page: simpler sizing and theming, but a sanitizer bug
  would run code with the app's rights.
- No diagrams until the specs redesign: no dependency, but no way to compare flows in a round.

## Consequences

- Rounds, specs, and plans can show flows and states that a list would bury.
- `mermaid` adds about 114 packages to the web UI's dependencies, and a chunk of about 500 KB that
  only pages with a diagram load.
- A diagram's frame has its own height and theme: the UI sets its colour mode, and a diagram does
  not follow the page's fonts exactly.
- Advisories on `mermaid` become upgrades to follow.

## Applies to

- [`packages/web/`](/packages/web/): the block renderer, and every page that draws a workflow file
- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
