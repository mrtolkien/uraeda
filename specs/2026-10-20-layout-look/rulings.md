# Rulings: Layout and look and feel

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The palette's preview reads the highlight from the palette's context

- **Decision**: Task 13 keeps Astryx's `CommandPalette` and draws the preview in one of its slots,
  `footer` or `input`, from `useCommandPaletteContext()`: the item under the cursor is
  `selectableItems[highlightedIndex]`. The same slot highlights the first result when nothing is
  highlighted, through the context's `setHighlightedIndex`, so "noti" then Enter opens
  Notifications.
- **Rationale**: the plan's check failed as written: `renderItem(item, isSelected)` passes
  `item.id === value`, the picker's chosen value, never the highlight (`CommandPalette.js`, Astryx
  0.7.3), so a preview fed by it never moves. The context is public
  (`@astryxdesign/core/CommandPalette` exports `useCommandPaletteContext`) and follows ↑↓. Astryx
  clears the highlight on every keystroke and Enter then picks nothing, which the spec's "noti",
  Enter would hit. Both behaviours are checked in
  [`palette-check.test.tsx`](/packages/web/src/__browser__/palette-check.test.tsx).
- **Alternatives considered**: the plan's fallback, a palette built on `Dialog`, `TextInput`, and
  `List`: more of our own code for the keyboard, the listbox's roles, and the announcements Astryx
  already has. Reading `aria-activedescendant` from the input: the DOM, not an API.
- **If wrong**: the slots sit below or above the list, not beside it, so a preview beside the list
  needs a layout the palette does not offer; if Task 13 needs it beside, or a later Astryx changes
  the context, it moves to the fallback, contained in `JumpPalette.tsx`. The check fails first on an
  upgrade that breaks it.
- **Where**: task 1, `packages/web/src/__browser__/palette-check.test.tsx`; task 13.

## R2: The upgrade keeps Astryx 0.7's touch type, and documents' lists stay inside their column

- **Decision**: the neutral theme's new rule for touch screens under 1024 px, body text at 16 px
  rather than 14 and the scale re-derived, is kept. The two places it cut text on the phone are
  fixed: the round's "Show the 2 points" no longer shrinks beside its heading, which wraps instead
  (`SettledGroups.tsx`), and the repository's name under "Uraeda" wraps rather than be cut
  (`RepositoryMenu.tsx`). A document's list takes `edge="flush"`, not the codemod's `"outset"`.
- **Rationale**: the larger text goes the way of the UI look's "readability first" and of Task 2's
  120% at every width, which replaces these sizes anyway. `astryx upgrade` turned
  `edgeCompensation="inline"` into `edge="outset"`, which in 0.7 widens the list by the padding of
  the nearest container: a spec's lists then reached 4 px past the phone's screen. `"flush"` puts
  the rows' text on the list's edge, the heading's line, which the alignment checks pass.
- **Alternatives considered**: overriding the neutral theme's touch rule to keep 14 px until Task 2:
  a rule written only to be removed in the next wave. Keeping `"outset"` and resetting the container
  padding around each list: styles reaching into Astryx's internals.
- **If wrong**: the touch rule can be cancelled in `theme.ts`'s adaptations; a list's edge is one
  prop in `Blocks.tsx`.
- **Where**: task 1, `packages/web/src/Blocks.tsx`, `SettledGroups.tsx`, `RepositoryMenu.tsx`.

## R3: A message's code block wraps its long lines, as Astryx 0.7 draws it

- **Decision**: the session look's browser test of a code block wider than the phone now checks that
  its line wraps whole inside the block and the page never scrolls sideways, instead of the block
  scrolling sideways.
- **Rationale**: Astryx 0.7's `Markdown` wraps fenced code blocks' long lines (its changelog,
  #7564), so a reader sees whole lines. The guarantee the test held, nothing past the screen's edge,
  still holds; no spec asks for sideways scrolling. Readability first, in the UI look, favours the
  wrap.
- **Alternatives considered**: a `components.code` renderer with a non-wrapping `CodeBlock`, in
  `Prose.tsx`, to keep the old scroll: our own code to undo a library's readability choice.
- **If wrong**: the renderer above restores the scroll, in one place, and the test's first version
  comes back from git.
- **Where**: task 1, `packages/web/src/__browser__/session-look.test.tsx`.
