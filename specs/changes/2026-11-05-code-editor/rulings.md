# Rulings: Code in the editor uses the code font, prose the UI font

The low-impact choices made while building [the proposal](proposal.md), inside its limits and the
decisions. None binds future work: those are decisions.

## R1: Markdown prose keeps Monaspace Neon as its default

- **Decision**: the renamed role keeps the default of "Your messages", Monaspace Neon, so the
  editor's prose and the human's messages look as before, and the agent's replies move from Atkinson
  Hyperlegible Next to Neon.
- **Rationale**: two of its three places were monospace on purpose: the editor showed its source in
  a monospace font, and Neon was picked for the human's messages over Radon. The agent's replies
  take the role the human put them in, its measure widening the reply so a line still holds about 80
  characters ([`theme/fonts.ts`](/packages/web/src/theme/fonts.ts)).
- **Alternatives considered**: Atkinson as the default, keeping the replies as they were, but
  turning the editor and the human's messages proportional, which the human had not asked for.
- **If wrong**: the [UI look](/specs/decisions/ui-look.md) decision asks for "a proportional one
  where it reads better, such as long prose", and a long reply may read better in Atkinson. Its
  default is one line of `DEFAULT_FONTS`, and anyone can pick another font for the role meanwhile.
- **Where**: [`theme/fonts.ts`](/packages/web/src/theme/fonts.ts)

## R2: The role's key is `m`, and a font picked before the rename stays picked

- **Decision**: `Space u f m` picks markdown prose's font, where `Space u f u` picked "Your
  messages"'. A font kept in the browser under the old name, `human`, is read as markdown prose's.
- **Rationale**: each role's key is its label's first letter, but the interface's `i`. Keeping the
  stored name would have left `human` in the code for a role that is no longer only the human's.
- **Where**: [`theme/fonts.ts`](/packages/web/src/theme/fonts.ts)

## R3: A file that is not markdown is all in the code font

- **Decision**: a buffer or a conflict of a file whose name does not end in `.md` or `.markdown`
  draws all its text in the code font, without markdown's heading and code fonts. Its markdown
  colours stay, as before.
- **Rationale**: the editor used to draw every file in the code font; with markdown prose's font for
  prose, a TypeScript file would have turned to prose, and a shell comment's `#` to a heading.
- **Where**: [`fields/editor/markdown.ts`](/packages/web/src/fields/editor/markdown.ts),
  `BufferPage.tsx`, `ConflictEditor.tsx`

## R4: A sent message takes the editor's fonts, not its colours

- **Decision**: the human's sent message draws its code and headings in their fonts, and keeps its
  one text colour, without the editor's highlighting colours.
- **Rationale**: the proposal asks for the fonts. The bubble's faint blue ground is not the field's,
  and the dimmed marks' colour is only checked for contrast against the theme's own grounds.
- **Where**: [`MessageBody.tsx`](/packages/web/src/MessageBody.tsx)
