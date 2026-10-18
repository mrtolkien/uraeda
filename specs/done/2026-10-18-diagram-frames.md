---
kind: change
finished: 2026-10-18
pull-request: https://github.com/mrtolkien/uraeda/pull/39
---

# Record: Diagram frames

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-18, in [its pull request](https://github.com/mrtolkien/uraeda/pull/39). Its full files are
> in git: `git log -- specs/changes/2026-10-18-diagram-frames/`.

## What and why

The diagrams of the web UI were drawn by Mermaid at its `sandbox` level, which was meant to keep a
crafted diagram out of the app. It did not: a sanitizer bug would have run in a temporary frame with
the app's origin. The proposal also listed small defects of the diagram's frames. The change removes
the cause, and the defects with it.

## Behaviour

- A `mermaid` block draws in the page with Pele, a library that reads Mermaid's syntax and returns
  an SVG with no script, HTML label, or `foreignObject`. The block's syntax in files is unchanged.
- A diagram is named for its type and its place among the document's diagrams, as "Flowchart
  diagram, 2 of 3", and shows "Drawing the diagram…" until drawn.
- A diagram wider than its card scrolls inside it, as a keyboard region named "…, scrolls sideways",
  also after a failed draw is fixed by a live edit.
- A diagram larger than 4,000 by 3,000 pixels is scaled down.
- A link in a diagram opens in a new tab and never replaces the app's page.
- A source that does not parse shows as code under "This diagram could not be drawn.", as before.
- The diagram follows the colour mode through the theme's colours, with no redraw.

## Design

Mermaid's `sandbox` level appends a temporary frame to the app's page, then sets its `sandbox`
attribute. The attribute does not apply to a frame already created: in Chromium, Firefox, and
WebKit, scripts in that frame read `top.document`. Pele needs no frame, so the draw happens in the
page's own module, and its output is inserted as is.

- [`Diagram.tsx`](/packages/web/src/Diagram.tsx): imports `pele/lazy` on demand, draws with a unique
  `idPrefix`, keeps one element for the diagram's life so its width is followed, scales a large
  diagram, maps Pele's colour variables to the theme's tokens, and opens links in a new tab.
- [`Blocks.tsx`](/packages/web/src/Blocks.tsx): gives each diagram its place in its document.
- [`diagram-hostile.test.tsx`](/packages/web/src/__tests__/diagram-hostile.test.tsx) draws hostile
  sources and checks for scripts, handlers, and `javascript:` links;
  [`diagrams-repo.test.ts`](/packages/web/src/__tests__/diagrams-repo.test.ts) draws every `mermaid`
  block the repository tracks.
- `pele` is at `^1.5.2`: the repository's release-age guard holds back 1.6.0, and no exclusion was
  added.

## Questions

### Round 01

#### Q1: Should the web UI draw diagrams with Pele instead of Mermaid?

**Answer:** A: draw with Pele. "We don't need to pin it that hard. I trust the dev. I know him."

#### Q1.A: Should the SVG Pele returns still be shown in a sandboxed frame?

**Answer:** B: insert it in the page. "It's ok".

#### Q1.B: Should the decision also stay on Mermaid's `sandbox` level, as it is?

No answer: it applied only to B in Q1.

## Decisions

- [Diagrams](../decisions/diagrams.md): the library is `pele` and the SVG goes in the page, with a
  rule that hostile diagrams draw without a script, handler, or `javascript:` link.

## Changes after approval

- Links in a diagram open in a new tab through a click handler, after the review found that Pele's
  plain links would replace the app's page.

## Follow-ups

- A redraw after a source change keeps the old picture without a loading line.
- The diagram's group name and the SVG's own role may be announced twice by a screen reader: not
  verified.
- Pele is days old: version 1.0 to 1.6.0 came out in three days. Watch its releases and advisories.
