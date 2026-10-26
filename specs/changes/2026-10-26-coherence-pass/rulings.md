# Rulings: Coherence pass

The low-impact choices made while building [the change](proposal.md), inside the limits of the
[UI look](/specs/decisions/ui-look.md), [UI coherence](/specs/decisions/ui-coherence.md), and
[UI components](/specs/decisions/ui-components.md) decisions. None binds future work: those are
decisions.

## R1: The story page's column test reads the session's column

- **Decision**: the test "the session's column does not link Storybook" waits for the column's
  Activity tab, where it waited for a "Progress" column with a `proposal.md` link.
- **Rationale**: the feature page's work moved the files out of the session's column, which is now
  "The session's column", with Activity, Changes, and Sub-agents. The test failed on main before
  this change. What it guards, no Storybook link in the column, is unchanged.
- **Alternatives considered**: removing it, since the feature page's own test checks its page links
  no Storybook; but that test does not render the session's column.
- **If wrong**: the column could gain a Storybook link no test sees; one line in
  [`story-page.test.tsx`](/packages/web/src/__tests__/story-page.test.tsx).
- **Where**: [`story-page.test.tsx`](/packages/web/src/__tests__/story-page.test.tsx)

## R2: Menus open by the width, never by the pointer

- **Decision**: every menu and selector opens as `useMenuPresentation()` says: a bottom sheet on
  narrow screens, a popover from semi-wide. The decisions' sort and a sidebar card's `…` menu, which
  took Astryx's `adaptive`, follow it too.
- **Rationale**: the [UI layout](/specs/decisions/ui-layout.md) decision asks for sheets on narrow
  screens, by the width. Astryx's `adaptive` opens a sheet only on a narrow screen with a coarse
  pointer, so a narrow window with a mouse got a popover there and a sheet in the six other menus.
- **Alternatives considered**: `adaptive` everywhere, which breaks the decision's rule for a narrow
  window with a mouse.
- **If wrong**: one function in [`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts).
- **Where**: [`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts)

## R3: Every fold's toggle is the same, and mounts its content only while open

- **Decision**: `Foldable` draws every fold's toggle: its chevron first, its label at the reading
  size, and its content mounted only while open. The three banners' toggles ("Organize with an
  agent", "Check decisions", "Hook output") move their chevron to the start and their label to the
  reading size, and a document's folds stop mounting their closed content.
- **Rationale**: four folds already looked this way, and the
  [UI behaviour](/specs/decisions/ui-behaviour.md) decision asks that folded content is not mounted,
  through one shared component.
- **Alternatives considered**: keeping Astryx's default toggle in banners, as a lighter look in a
  small box; but it would be the one toggle drawn its own way.
- **If wrong**: closed content no longer shows to the browser's find-in-page; a jump to an anchor
  inside a fold opens the fold first, as `useHashFold` already did. Undo by passing `children`
  unguarded in [`Foldable.tsx`](/packages/web/src/layout/Foldable.tsx).
- **Where**: [`layout/Foldable.tsx`](/packages/web/src/layout/Foldable.tsx)

## R4: An empty line is secondary text at the body size

- **Decision**: `Empty` draws every "nothing yet" line in secondary text at the body size, the
  session panels' look. Home's panes, which used supporting text, now use the body size, and keep
  the inset of their rows.
- **Rationale**: five looks for one message; the session panels' was the most used, and the body
  size reads better than supporting text in a pane of body-size rows.
- **Alternatives considered**: supporting text everywhere, smaller than the rows it stands for.
- **If wrong**: one style in [`layout/Empty.tsx`](/packages/web/src/layout/Empty.tsx).
- **Where**: [`layout/Empty.tsx`](/packages/web/src/layout/Empty.tsx)

## R5: A page that cannot find its subject shows the error banner

- **Decision**: a feature's page, a draft's editor, and an unknown address show `Missing`, the error
  banner with a link out that a missing file and a missing session already showed, where they showed
  a plain paragraph.
- **Rationale**: one kind of information, drawn one way, as the UI coherence decision asks.
- **Alternatives considered**: the paragraph everywhere, which offers no way out.
- **If wrong**: [`layout/Missing.tsx`](/packages/web/src/layout/Missing.tsx).
- **Where**: [`layout/Missing.tsx`](/packages/web/src/layout/Missing.tsx)

## R6: A count beside a title is `· n`; at a row's end or on a tab, a badge

- **Decision**: no `Count` component. A count beside a title is the pane's `· n`, which titles
  outside a pane take too; a count at a row's end, or over a tab's icon, stays an Astryx badge,
  whose colour says what it counts.
- **Rationale**: `Pane` already draws the title's count, and the badges sit where a title's text
  would not fit. Two forms, each with one home, follow the UI coherence decision without a wrapper
  around `Badge`.
- **Alternatives considered**: badges everywhere, which a pane's title in its border cannot hold.
- **If wrong**: a `Count` wrapper can replace the badges later.
- **Where**: [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx)

## R7: Round marks stay round

- **Decision**: the status marks, the progress ring, and the sidebar's dot stay round.
- **Rationale**: the theme keeps `--radius-full` round on purpose, "for dots and avatars"
  ([`theme.ts`](/packages/web/src/theme/theme.ts)): square corners are the UI look's rule for boxes
  and panes, not for glyphs.
- **Alternatives considered**: square marks, which read as checkboxes.
- **If wrong**: `--radius-full` in the theme.
- **Where**: [`theme.ts`](/packages/web/src/theme/theme.ts)

## R8: Lucide's glyph files stay apart

- **Decision**: `lucide.ts`, `lucideParts.ts`, `sessionIcons.ts`, `activityIcons.ts`, and
  `windowIcons.ts` stay separate files.
- **Rationale**: they hold different glyphs, split only because `lucide.ts` is near the 500-line
  limit; no glyph is drawn twice. The audit also named a repeated `kindIcon`, which the code does
  not hold.
- **Alternatives considered**: one file, over the size limit.
- **If wrong**: nothing draws differently.
- **Where**: [`theme/`](/packages/web/src/theme/)
