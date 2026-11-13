---
icon: workflow
---

# Diagrams

> "A round could ask to pick between multiple flows"

Workflow files, such as rounds of questions, specs, and plans, may hold diagrams. What a diagram is
for, a flow, a sequence, or states that a list would bury, is in the skill's
[writing rules](/skills/uraeda/references/writing.md).

## Rules

- A diagram in a workflow file is a fenced `mermaid` code block, never another diagram language, an
  image, or an ASCII drawing. _So:_ a new renderer for the app is picked among those that read
  Mermaid, and no file changes with it.
- A diagram never runs a script in the app, even when its text holds one. _So:_ a renderer that
  needs a frame, or returns markup that can hold a script, is not used: the app draws shapes and
  text.

## Why

Mermaid's source reads as text in any editor, and renders on GitHub and GitLab, so a diagram stays
plain text in git, as the constitution asks. The app commits and starts agents, so nothing a file
holds may run code there, and Mermaid's own renderer has had script-injection flaws. History:
[Diagram frames](../done/2026-10-18-diagram-frames.md).

## Alternatives considered

- Mermaid's own renderer in a sandboxed frame: the frame is made with the app's origin, so a script
  in it reaches the app.

## Applies to

- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
- [`crates/app/`](/crates/app/), and every page that draws a workflow file
