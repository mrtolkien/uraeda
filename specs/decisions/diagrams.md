---
status: active
approved-by: mrtolkien
icon: workflow
---

# Diagrams

Workflow files may hold diagrams written in Mermaid, in a fenced code block, which reads as text in
any editor and renders on GitHub and GitLab. The app draws them in Rust, with the
[Merman](https://github.com/Latias94/merman) library, as a picture made of shapes, so a diagram
never runs code in the app.

## Rules

- A diagram in a workflow file MUST be a fenced `mermaid` code block, not another diagram language,
  an image, or an ASCII drawing.
- The app MUST draw diagrams in Rust, with the Merman library, measured and drawn in the app's own
  fonts and colours.
- A diagram MUST NOT run a script in the app, even when its text holds one. Checked by the diagram's
  tests.
- A diagram that fails to draw, or takes more than 2 seconds, MUST show its source instead. Checked
  by the diagram's tests.
- A diagram MUST NOT repeat what the text around it says.
- A diagram SHOULD show a flow, a sequence, or states that a list or a table would make hard to
  follow.

## Why

Diagrams let a round of questions compare flows, and Mermaid's source stays readable as plain text,
as the constitution's principle II asks. The app can commit and start agents, so a diagram must not
run code there: Mermaid had critical script-injection advisories. Merman drew all 18 diagrams of the
repository where four other Rust libraries failed, and a Rust library leaves the app no npm package.
History: [Diagram frames](../done/2026-10-18-diagram-frames.md).

## Alternatives considered

- Mermaid itself, in a frame: its full syntax, but its frame runs scripts, and it needs a browser.
- Pele, in the app's JavaScript engine: it drew them too, but kept an npm package, and Node's tools,
  in a Rust app.
- `ariel-rs`, `selkie-rs`, `mermaid-rs-renderer`, `mmdflux`: lost colours, scrambled a flowchart,
  overlapped labels, or could not read entity diagrams.

## Consequences

- Rounds, specs, and plans can show flows and states that a list would bury.
- A diagram may not look as it does on GitHub, and a newer Mermaid feature may not draw.
- Merman is a young project, pinned at an exact version: its releases are ours to follow, and it
  brings about 240 crates.
- A diagram is a picture: its links cannot be followed.

## Applies to

- [`crates/app/`](/crates/app/), its document renderer, and every page that draws a workflow file
- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
