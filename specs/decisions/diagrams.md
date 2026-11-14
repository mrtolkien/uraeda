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
  image, or an ASCII drawing. _So:_ `ura serve` draws Mermaid, and so do GitHub and Obsidian, and no
  file changes with the tool that shows it.
- A diagram never runs a script in `ura serve`'s pages, even when its text holds one. _So:_ the
  pages draw a diagram in Rust, as an inline SVG of shapes and text, and never load Mermaid's own
  renderer.

## Why

Mermaid's source reads as text in any editor, and renders on GitHub, GitLab, and in Obsidian, so a
diagram stays plain text in git, as the constitution asks. The pages write the human's answers and
verdicts, with a token in their address, so nothing a file holds may run code there, and Mermaid's
own renderer has had script-injection flaws. History:
[Diagram frames](../done/2026-10-18-diagram-frames.md).

## Alternatives considered

- Mermaid's own renderer in a sandboxed frame: the frame is made with the page's origin, so a script
  in it reaches the page.

## Applies to

- Workflow files: rounds of questions, specs, plans, data models, and the skill's templates and
  examples
- [`crates/serve/`](/crates/serve/), and every page that draws a workflow file
