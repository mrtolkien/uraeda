# Rulings: Vim mode's selection, font, and status line

The low-impact choices made while building [the change](proposal.md), inside the limits of its
proposal and the decisions. None binds future work: those are decisions.

## R1: The code font's default changes, not the editor's own font

- **Decision**: "Code and keys", the font role every text field writes in, defaults to JetBrains
  Mono instead of Monaspace Krypton. Keys, paths, and code change with it.
- **Rationale**: the [UI look](../../decisions/ui-look.md) decision sets text "in the font picked
  for its role", so the editor keeps a role rather than a font of its own. JetBrains Mono is the
  theme's own monospace font, bundled already. The role's help now says it covers the text typed.
- **Alternatives considered**: a new "Text fields" role, defaulting to JetBrains Mono: one more
  setting for one font, beyond the proposal. The interface's role, Neon: another Monaspace face, and
  a proportional font there would break the proposal editor's 100 columns.
- **If wrong**: one line in [`fonts.ts`](/packages/web/src/theme/fonts.ts). A browser where fonts
  were picked before keeps its picks: `Space u f d` restores the defaults.
- **Where**: [`fonts.ts`](/packages/web/src/theme/fonts.ts)

## R2: The drawn selection is the accent at 25%

- **Decision**: Vim's selection, drawn by CodeMirror's layer, takes the accent, Catppuccin's mauve
  as Visual mode's colour, mixed at 25% over the field's ground, and 12% in a field without the
  focus. The browser's selection, with Vim off, keeps its grey.
- **Rationale**: once drawn, the selection in `--color-background-gray` hardly showed on the field's
  ground in Latte. Mixed from a token, it follows the light and dark schemes, and the text reads on
  it in both, reviewed in the sandbox.
- **Where**: [`theme.ts`](/packages/web/src/fields/editor/theme.ts)

## R3: The status line is 24 px tall

- **Decision**: `--size-status-line` is `--spacing-5`, 24 px, down from 38.4 px; the phone's bar
  keeps its height.
- **Rationale**: one row of the line's supporting text is about 20.6 px, so 24 px holds it with a
  little room, as a terminal's status line does.
- **Where**: [`Shell.tsx`](/packages/web/src/Shell.tsx)

## R4: The human's messages in Neon, asked during the change

- **Decision**: the "Your messages" role defaults to Monaspace Neon, the interface's font, instead
  of Radon. The role stays its own.
- **Rationale**: the human asked it while the change was built: "the default for user messages in
  sessions should also be the normal monaspace font and not the weird handwriting one".
- **Where**: [`fonts.ts`](/packages/web/src/theme/fonts.ts)
