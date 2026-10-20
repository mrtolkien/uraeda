---
kind: change
finished: 2026-10-20
---

# Record: Session transcript speed and coherence

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-20, finished on
> 2026-10-20, merged locally by the human, with no pull request. Its full files are in git:
> `git log -- specs/changes/2026-10-20-session-transcript/`.

## What and why

A session's page lagged when typing and never folded old messages, with a 12-hour turn open: the
turn held 1,800 items, 97% of them tool calls, and about 500 drew. The agent's text was also tight,
and its lists wrapped about 150 px before its paragraphs, since agent markdown was drawn its own
way. The change makes the session fast, its column about 115 characters wide, and reading text drawn
by one shared component.

## Behaviour

- The tail draws the latest 20 messages, the human's and the agent's, as before; the tool calls
  between them are folded behind their count, in Astryx's own header, and open on a click.
- A session's column on wide screens is 95ch, about 115 characters a line.
- The agent's text is at the reading size and Astryx's default markdown spacing, and its lists,
  headings and quotes are as wide as its paragraphs.
- Spec documents look as before, except that the list items of the document view wrap pretty.

## Design

Root cause: Astryx's `ChatToolCalls` maps every call of a group into a hidden `inert` row, even
collapsed, and `Markdown` caps its prose at 680 px by default, which our own paragraph skipped.

- [`ToolGroups.tsx`](/packages/web/src/ToolGroups.tsx): a folded group hands `ChatToolCalls` a
  sparse array of its length with only its last call set, so its header, which reads the count and
  the latest call, stays Astryx's, and one row mounts. The group is memoized on its calls, by
  reference.
- [`Prose.tsx`](/packages/web/src/Prose.tsx): the reading styles and `ProseMarkdown`, with
  `contentWidth="100%"`, used by the agent's messages, the document view and
  [`Paragraph.tsx`](/packages/web/src/layout/Paragraph.tsx).
- [`Page.tsx`](/packages/web/src/layout/Page.tsx): `isSession`, a named column of
  `--size-session-max`, in place of a width hung off `isSnug`.
- Checks: `no-restricted-imports` in [`vite.config.ts`](/vite.config.ts) refuses Astryx's `Markdown`
  outside `Prose.tsx`, and [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts) refuses the
  reading tokens outside it, bar seven files on a list that only shrinks.
- Tests changed: the tail test of a cut sub-agent opens its folded group; the stack test lets
  `Prose.tsx` import `Markdown`; the ledger test reads a fixed constitution, not the real one, which
  an amendment broke.

## Decisions

- [UI coherence](../decisions/ui-coherence.md): reading text through `Prose`, and a column width as
  a named `Page` property.
- [UI behaviour](../decisions/ui-behaviour.md): a growing view mounts a bounded number of rows, and
  folded content is not mounted.
- [UI components](../decisions/ui-components.md): the known Astryx gap of rows mounted while
  collapsed.

## Changes after approval

- Agent markdown lost `density="compact"`, for the default spacing, as the human found its text too
  tight.
- A review found the memo comparator missed an earlier call changing, and the import ban missed
  `Markdown` subpaths: both fixed.

## Follow-ups

- Seven files still set the reading size by hand: `Folds`, `Question`, `RoundPage`, `BuiltParts`,
  `DecisionCard`, `SpecOpening`, `StoryCard`. Each moves to `Prose.tsx`'s styles.
- Changed views were not screenshot at both sizes and in both themes, and the browser tests did not
  look at the new column.
- A folded group's `onOpenChange` can be a render stale in `useOpenKeys`, rarely dropping another
  group's open state.
- The sparse array depends on Astryx's header reading only `calls.length` and the last call: report
  the mounted collapsed rows upstream.
