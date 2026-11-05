---
kind: change
finished: 2026-11-05
pull-request: https://github.com/mrtolkien/uraeda/pull/98
---

# Record: Code in the editor uses the code font, prose the UI font

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-05, finished on
> 2026-11-05, in [its pull request](https://github.com/mrtolkien/uraeda/pull/98). Its full files are
> in git: `git log -- specs/changes/2026-11-05-code-editor/`.

## What and why

The web UI's editor drew all of a field's markdown in the code font, so code did not stand apart
from prose. Code now takes the code font and headings the heading font, the rest a font of its own,
"Markdown prose", which the "Your messages" font role became. It covers markdown shown as its source
as the human writes it: the text typed in every field, and the human's messages in a session. The
agent's replies stay in the reading font, the prose of long documents. The font roles are now: the
interface, prose in long documents, markdown prose, headings, and code.

## Behaviour

- In every field, code, an inline span or a fenced or indented block, is in the code font, its
  backticks and fence too; a heading, ATX or Setext, is in the heading font, its marks too; the rest
  is in markdown prose's font. The highlighting's colours are unchanged.
- A buffer or a conflict of a file whose name does not end in `.md` or `.markdown` is all in the
  code font, without markdown's heading and code fonts: a `#` there starts no heading.
- The human's sent messages show their markdown source with the same fonts as the editor drew it, in
  their one text colour.
- The agent's text in a session stays in the reading font, at its measure, as documents' prose.
- The "Your messages" role is "Markdown prose" in Settings, Fonts, and under `Space u f m`, where it
  was `Space u f u`. Its default stays Monaspace Neon. A font picked for the old role stays picked.

## Design

- **Fonts in the editor**: [`markdown.ts`](/packages/web/src/fields/editor/markdown.ts) adds a font
  tag to the markdown parser's code and heading nodes, with Lezer's `/...` so each part inside, a
  backtick or a `#` with a tag of its own, keeps it. A second highlight style sets the fonts apart
  from the colours. The field's base family is markdown prose's, or the code font when the
  [`Editor`](/packages/web/src/fields/editor/Editor.tsx)'s `isCode` is set, which
  [`BufferPage`](/packages/web/src/buffer/BufferPage.tsx) and
  [`ConflictEditor`](/packages/web/src/git/ConflictEditor.tsx) set from the file's name.
- **Sent messages**: [`MessageBody`](/packages/web/src/MessageBody.tsx) cuts the text into runs with
  the same parser and tags (`fontRuns`), each code or heading run a span in its font.
- **The role**: [`fonts.ts`](/packages/web/src/theme/fonts.ts) names it `markdown`, reads a font
  stored under the old `human` name, and sets `--font-family-markdown`, which the human's bubble in
  [`TranscriptMessages`](/packages/web/src/TranscriptMessages.tsx) points its fonts at.
- The guides [reading](/specs/ui/reading.md) and [surfaces](/specs/ui/surfaces.md) name the three
  prose fonts and where each is used.

## Gotchas

- **The fonts' tags inherit**: Lezer gives a node's tag only to the text no child covers, so without
  `/...` a code span's backticks and a heading's `#` would fall back to prose's font.
- **The fonts' rules replace markdown's own** for code and headings, as an added rule comes first:
  they list the colour tags again, `tags.monospace` and each `tags.headingN`, and a test checks the
  colours stay.
- **One extension for every field**: [`markdown()`](/packages/web/src/fields/editor/markdown.ts)
  gives the same object each time. A new language makes CodeMirror reparse the whole text, and a new
  `EditorView.theme` adds CSS rules that stay.
- **The font spans' line height is 1**: at the line's 1.5, another font's ascent and descent made a
  line holding code 1 px taller than prose's.

## Changes after approval

- The agent's replies stay in the reading font, asked on the pull request: "agents love sending long
  messages". They had moved to markdown prose's font, as the human first listed them there.
- A font picked under the old role's name is kept, and its key is `m`, after its new label.
