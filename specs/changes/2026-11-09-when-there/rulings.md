# Rulings: When there's table in a message, they look small

The low-impact choices made while making [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: The message grows in its padding, so its prose keeps the measure

- **Decision**: A message holding a table wider than it grows to the right by adding the growth to
  its width and to its padding at the end. Its content box, where its prose wraps, keeps its width,
  and the table overflows into that padding, the border around it.
- **Rationale**: The session's guide keeps the agent's text at the reading measure
  ([surfaces](/specs/ui/surfaces.md#a-session)). Widening the content box would have widened every
  paragraph with the table, and capping each kind of block instead would have capped a story's live
  window, which grows on its own (`useOutgrow`).
- **Alternatives considered**: Sizing the message by its content (`width: max-content`): a code
  block's long line would have widened it too.
- **Where**: `packages/web/src/session/messageTables.ts`, `packages/web/src/TranscriptMessages.tsx`

## R2: A table is as wide as its text on one line, up to the room

- **Decision**: In a message, a table's width is its text's on one line (`max-content`), up to the
  room right of the session. A table of long cells takes the whole room.
- **Rationale**: "They should spread to the right": the room is there to read the table with fewer
  wrapped lines. A document's table caps each column at 60 characters (`BlockTable.tsx`), from its
  parsed cells; a message's markdown is drawn by Astryx, whose cells the browser sizes.
- **If wrong**: A cap per column would need the cells' text, read from the drawn table.
- **Where**: the theme's `markdown-table` rule, `packages/web/src/theme/theme.ts`

## R3: The room is the one a document's table grows into

- **Decision**: The room on each side is measured as a document's table and a live window measure it
  (`room` in `embedLayout.ts`): up to the page's container, less its inset, stopped by the side
  column and by any box that clips, and a side with less room than 16 px is not reached into. At
  1,500 px with the side column open, the message grows only to the column's own edge, about 90 px,
  and a wider table scrolls inside it.
- **Rationale**: One rule of where wide content may grow, shared with the reading pages, which also
  share the observer of the boxes that resize it (`observeUpTo`).
- **Where**: `packages/web/src/embedLayout.ts`

## R4: A table scrolled past the reply's side keeps the reply's surface

- **Decision**: A reply's tables are drawn on the reply's surface, so that scrolled past its left
  side, a table passes over its border rather than showing the border through its cells.
- **Rationale**: Seen in the sandbox: the border's line ran through the table's first columns.
- **Where**: the theme's `markdown-table` rule, `packages/web/src/TranscriptMessages.tsx`

## R5: A scrolled table passes the message's left side, not its right

- **Decision**: Scrolled, a table passes over the message's left border into the room there, while
  on the right it stays inside the border, which has already grown as far as the room allows.
- **Rationale**: The proposal asks for the border to grow around the table on the right, and for the
  left side to move out of the pane as it scrolls. The empty room left of a table that is not
  scrolled stays part of its scroll region, invisible: a click there lands on the table's region.
- **Where**: the theme's `markdown-table` rule, `packages/web/src/theme/theme.ts`
