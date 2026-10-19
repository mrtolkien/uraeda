# Rulings: right bar resizable

The low-impact choices made while making [the change](proposal.md), inside the limits of the active
decisions. None binds future work: those are decisions.

## R1: Folding the right column leaves a rail, and `]` folds to it

- **Decision**: the column no longer unmounts when hidden: it folds to a 48 px rail, as wide as the
  left sidebar's, with its button at the same spot, and `]` folds and unfolds it.
- **Rationale**: the human asked for a small band with key information, a slide, and a click on the
  rail to open it. The column staying mounted is what lets its width ease.
- **Alternatives considered**: keeping a hidden state next to the rail: two states for one button.
- **If wrong**: the rail's content is one `rail` prop of
  [`SideColumn`](/packages/web/src/layout/SideColumn.tsx); drop it for an empty rail.
- **Where**: `SideColumn.tsx`.

## R2: What the rail shows

- **Decision**: Progress shows the step's icon, named by the step, and the plan's task count,
  "7/11", while the implementation goes on. Contents shows the total of its comments, when there are
  any.
- **Rationale**: those are what the column is looked at for, at a glance.
- **Alternatives considered**: an icon per part of Contents: the page's parts have no icons.
- **If wrong**: both are small components, `SessionRail` and `ContentsRail`.
- **Where**: [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx),
  [`SpecContents.tsx`](/packages/web/src/spec/SpecContents.tsx).

## R3: The resize bar is drawn along the column's edge, like the sidebar's

- **Decision**: the column's handle was 0 px tall, as Astryx's `ResizeHandle` takes `100%` of a
  parent of automatic height. It is now drawn over the column's start edge, which is as tall as the
  window, with its grip shown on hover as the sidebar's is, and a line along the edge.
- **Rationale**: it matches the left sidebar, and the old tests only used the keyboard, so none saw
  the bar was missing: a test drags it now.
- **Alternatives considered**: a grip always visible: the sidebar's is not.
- **If wrong**: `isAlwaysVisible` on the handle.
- **Where**: `SideColumn.tsx`.
