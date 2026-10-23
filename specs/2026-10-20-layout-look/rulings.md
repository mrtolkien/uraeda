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
- **Superseded by task 2** for the sizes: the theme's own rule for coarse pointers, last of the
  adaptations, sets the type scale back to 16.8 px on every screen, so the neutral theme's 16 px
  touch text no longer applies (R4). The wrapping fixes stay.

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

## R4: The theme's Catppuccin roles, exact 120% sizes, and what the contrast test measures

- **Decision**: Astryx's neutral token names take Catppuccin roles: body and card the base, surface
  and popover the mantle, muted Latte's mantle and Mocha's crust, borders surface1, the 3:1 border
  of controls overlay0 (Mocha) and overlay2 (Latte), accent mauve, Astryx's hues the matching
  Catppuccin accents (orange peach, cyan sky, purple mauve), and their backgrounds a tint of each
  over the base, 12% in both schemes. Latte's accents as text are the mockup's darker steps,
  darkened by up to 5% more, so each reads 4.5:1 on its own tint too (blue `#1957d5`); its pink and
  sky, missing from the mockup, take darker steps, `#a72592` and `#0a688e`. Latte's grey background
  is its crust, lighter than surface0, so secondary text reads 4.5:1 on it; muted is Latte's mantle
  and Mocha's crust, apart from grey, as a story's stage and its phone frame need. The type scale is
  written as exact `--font-size-*` tokens, Astryx's 14 px scale × 1.2, at the root and again in the
  coarse-pointer rule, which also undoes the neutral theme's touch text (R2). `--radius-full` stays
  round, so dots, radios, and avatars stay round; badges and switches set it to 0 inside themselves.
  Shadows are `none`. `theme-tokens.test.ts` reads the built stylesheet, and checks, beside the
  plan's pairs, the pairs components draw: primary and secondary text on muted, popover, and a
  selected row; text on each filled status colour; each hue's text on its own background, and a
  banner's; syntax colours on the code background. Disabled text is held to 4.5:1 too, as the
  decision says "every text colour".
- **Rationale**: Astryx rounds each size of its type scale to a whole pixel, so a 16.8 px base drew
  17 px; explicit tokens win over the generated ones. The plain `--color-border` is a pane's or a
  divider's line, which the plan holds out of the 3:1 rule (only `--color-border-emphasized` and
  controls), as the mockup's quiet surface lines; at 3:1 every pane would read as a control. The
  tints are light, since a tinted card holds its hue's text and secondary text (axe found Mocha's
  20% tints at 4.2:1 under secondary text), and the human's message bubble must still read blue.
- **Alternatives considered**: Astryx's generated `color` palette from one accent: not Catppuccin.
  `--radius-full: 0px` everywhere: square status dots and radio buttons. Holding `--color-border` to
  3:1: heavy lines everywhere, unlike the mockup. Exempting disabled text, as WCAG does: the
  decision names no exemption.
- **If wrong**: each role is one line of `theme.ts`'s `tokens`; the test names the pair that fails.
- **Where**: task 2, `packages/web/src/theme/theme.ts`, `src/__tests__/theme-tokens.test.ts`.

## R5: What the wider monospace text moved, and the checks that follow the 120% scale

- **Decision**: JetBrains Mono at 16.8 px runs wider than the old system font, and spacing grows by
  120% on the phone too. So: the verdict's button "Request changes and start the agent" reads
  "Request changes, start the agent", which fits the phone's width; a priority's "Draft" and "Start
  a change based on this line" wrap onto two lines rather than cut their labels; the sidebar opens
  290 px wide, not 280, so a feature's name fits beside its mark and menu, and the round's index
  gives the 10 px back, 230 px rather than 240, so the questions keep their 600 px at 1200 px and
  their options beside their titles at 1440; a change's round row in its session's column wraps its
  name rather than cut it (a label Astryx is given as a string, it cuts); inline code is 0.9em of
  the text around it; the reading measure is 86ch, about 110 characters of Inter, where 90ch
  held 116. The spec page's phone test checks the page's inset at 14.4 px, US5 3's 12 px at 120%,
  rather than 12.
- **Rationale**: each was a layout check that failed after the theme changed, for text cut or a line
  past the measure or the screen. The plan moves every spacing step's growth into the base, and the
  spec's "Text is 120% at every width, the phone included" makes the inset 14.4 px. WebKit placed
  `src/components/EditPanel.tsx` at the reading size on one phone line without its code padding, 2
  px past the column; a smaller code size fits it and matches the usual weight of code in prose.
- **Alternatives considered**: letting every button's label wrap, in the theme: Astryx's buttons
  have a fixed height. Keeping a 12 px inset on the phone: a size rule against the plan's one scale.
  Leaving the sidebar's width to Task 8: the checks fail until then.
- **If wrong**: each is one line: the label in `ReviewVerdict.tsx`, the width in `Shell.tsx` (Task 8
  replaces the sidebar, and can give the round's index its 240 px back), the code size, index, and
  measure in `theme.ts`, the inset in `spec.test.tsx`.
- **Where**: task 2, `packages/web/src/ReviewVerdict.tsx`, `pane/PriorityPane.tsx`, `Shell.tsx`,
  `ChangeAside.tsx`, `theme/theme.ts`, `__browser__/spec.test.tsx`.
