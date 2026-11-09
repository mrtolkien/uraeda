---
kind: change
finished: 2026-11-09
pull-request: https://github.com/mrtolkien/uraeda/pull/118
---

# Record: When there's table in a message, they look small

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-09, finished on
> 2026-11-09, in [its pull request](https://github.com/mrtolkien/uraeda/pull/118). Its full files
> are in git: `git log -- specs/changes/2026-11-09-when-there/`.

## What and why

A table in an agent's message was held to the message's width, at the reading measure, and cut at
its border, scrolling inside it, while a wide screen had empty room beside the session. The human
asked for tables to spread to the right, the message's border growing around them, and for scrolling
to move a table's left side out of the pane too, so a widescreen shows the whole table while it
still starts left-aligned with the text.

## Behaviour

- On semi-wide and wide screens, an agent's message holding a table wider than it grows to the right
  into the empty room beside the session, as far as its widest table needs, its border around it.
  Its prose keeps the reading measure.
- A table in a message is as wide as its text on one line, up to that room: a table of long cells
  takes the whole room.
- A table wider than the room scrolls, starting at the text's edge. Its scroll region reaches into
  the room on the left, so scrolling moves its left side past the message's, out of the column. A
  reply's tables are drawn on its surface, so a scrolled one passes over its border. On the right, a
  table stays inside the grown border.
- The room stops at the side column and the page's edge, and a side with less than 16 px of room is
  not reached into. Folding or unfolding a column, or resizing the window, measures it again.
- On the phone, a table scrolls inside the message, as before. Markdown tables outside a session's
  messages, and messages without a table, are unchanged.

## Design

[`useMessageTables`](/packages/web/src/session/messageTables.ts) measures, for each agent message
holding a table, the room beside it with the same `room` a document's table and a live window grow
into, and the boxes that resize it with `observeUpTo`, both in
[`embedLayout.ts`](/packages/web/src/embedLayout.ts). It sets three vars on the message's markdown
element, which the theme's `markdown-table` rule ([`theme.ts`](/packages/web/src/theme/theme.ts))
reads: the tables' width (`max-content`), their widest, and how far their scroll region reaches
left, through Astryx's own `--container-padding-inline-start` bleed and a padding of the same size.
It returns how far the widest table passes the message, which
[`AgentMessage`](/packages/web/src/TranscriptMessages.tsx) adds to the message's width and to its
padding at the end, so its content box, where the prose wraps, keeps its width. Elsewhere the rule
falls back to Astryx's own sizes. The [reading guide](/specs/ui/reading.md#tables) says so. The
sandbox's sample project has a chat, "Compare our personas with the book's", whose reply holds two
wide tables. The UI gets no test at this stage (the testing decision).

## Gotchas

- **The growth goes into the message's padding, not its content box**: widening the content box
  would have widened every paragraph with the table, and capping each kind of block would have
  capped a story's live window, which grows on its own
  ([`TranscriptMessages.tsx`](/packages/web/src/TranscriptMessages.tsx)).
- **The table's width comes from the browser, not from its cells' text**: a document's table caps
  each column at 60 characters from its parsed cells, but a message's markdown is drawn by Astryx,
  which offers no table component to replace, so the theme reaches its block by its class
  ([`theme.ts`](/packages/web/src/theme/theme.ts)).
- **The room left of a table that is not scrolled is part of its scroll region**, invisible: a click
  there lands on the table's region.
