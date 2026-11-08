---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Markdown extensions

## What

Extensions can extend how Uraeda reads and draws Markdown, more generally than code blocks.

- **Rendering**: an extension draws any block it claims (a code block by its language, a callout by
  its kind, an HTML block, a table), and any inline pattern of the text (`@mentions`,
  `==highlight==`, `$x^2$`, `TODO(date)`) with its own component.
- **The mermaid renderer becomes a built-in extension**, `diagrams`, which can be turned off or
  replaced: PlantUML, D2, KaTeX, or another mermaid engine as extensions.
- **The grammar itself, maybe**: new syntax the parser understands, like `:::` containers, math that
  survives `*`, or footnotes. Today the Rust core parses every file with pulldown-cmark, and
  `ura check`, the LSP, and the web UI all read its tree, so this level means extending the core.

## Why

The Extensions system ([#113](https://github.com/mrtolkien/uraeda/pull/113)) lets extensions replace
any part of the server and the web UI, but the Markdown renderer is hard-wired: the mermaid renderer
is a branch in `Blocks.tsx`, and no contribution lets an extension draw a block or an inline
pattern. Specs, rounds, and notes are what the human reads most, so how they are drawn should be
extensible too.

## Notes

- Builds on the Extensions system, not merged yet: its page API gains the new contributions.
- Two levels, which the discovery should weigh: rendering only, on the page, over the core's tree;
  or the grammar too, which needs core extensions (WASM, postponed to Later with workflow
  extensions). Rendering can't reclaim what CommonMark already parsed: `$a*b*c$` is emphasis by the
  time an extension sees it.
- Display-only rules are invisible to `ura check` and to agents reading the raw files: fine, since
  agents read the files anyway (constitution V).
- The [diagrams](/specs/decisions/diagrams.md) decision (no script in a diagram's SVG) binds the
  built-in `diagrams` extension.
