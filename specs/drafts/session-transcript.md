---
discovery: low
---

# Session transcript speed and coherence

## What

A session's page was laggy to type in, and never folded old messages, with a 12-hour turn open.

- Draw the latest 20 actual messages, the agent's and the human's, and fold the tool calls between
  them behind their count, with Astryx's own header.
- The middle column of a session is about 120 characters wide (95ch), and the agent's text is easier
  to read: the reading size, the same spacing as the rest of the UI, lists as wide as paragraphs.
- Keep the UI coherent: reading text is drawn by one shared component, with checks, so a page cannot
  draw it its own way.

## Why

The session of 2026-10-19 held 1,800 items in one turn, 97% of them tool calls, and drew about 500.
Astryx mounts every row of a tool-call group even folded, and its `Markdown` caps lists at 680 px
while our own paragraph skipped the cap, so the same text looked different from the spec's.

## Notes

The human asked for the `ui-coherence`, `ui-behaviour`, and `ui-components` decisions to be amended
for this, in the chat.
