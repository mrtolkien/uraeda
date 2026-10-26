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
- **If wrong**: one function in [`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts). The
  session's `…`, which took Astryx's default, now opens as a sheet on the phone too, where its
  actions are buttons in a list rather than menu items: its test reads either, and still checks that
  Archive archives and Unarchive shows.
- **Where**: [`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts),
  [`layout/ActionsMenu.tsx`](/packages/web/src/layout/ActionsMenu.tsx)

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

## R6: A count beside a pane's or a group's title is `· n`; beside a page's title, a badge

- **Decision**: no `Count` component. A pane's title and a group's title (`GroupTitle`) carry their
  count as `· n`; a page's title (`PageTitle`) carries it as a badge without words; a count at a
  row's end, or over a tab's icon, stays an Astryx badge, whose colour says what it counts.
- **Rationale**: `Pane` already draws the title's count, and the inbox's review asked for its page's
  count as a badge beside its heading, without words (C3, in
  [`inbox.test.tsx`](/packages/web/src/__tests__/inbox.test.tsx)). Each form has one home, as the UI
  coherence decision asks, without a wrapper around `Badge`.
- **Alternatives considered**: `· n` beside the page's title too, which the inbox's review ruled
  out; badges everywhere, which a pane's title in its border cannot hold.
- **If wrong**: a `Count` wrapper can replace the badges later.
- **Where**: [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx),
  [`layout/GroupTitle.tsx`](/packages/web/src/layout/GroupTitle.tsx),
  [`layout/PageTitle.tsx`](/packages/web/src/layout/PageTitle.tsx)

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

## R9: Every page's title is `PageTitle`

- **Decision**: the level-1 title of every page is `PageTitle`: a file's status badge over it, the
  title and its count, `actions` that stay beside it at every width (a feature's `…` menu, a
  proposal's Edit), an `aside` at the row's end from semi-wide and under the title on the phone (the
  inbox's "Organize with an agent", the settings' search), the subject's state on a supporting line
  under it, and what the page is for in secondary text. The round's opening keeps its own title, the
  distinct look the questions page's record approved.
- **Rationale**: the title was drawn six ways, each page placing its badge, menu, search, and lines
  itself. The inbox's description now comes right under its title, before its banners.
- **Alternatives considered**: one slot for everything beside the title, wrapping; it would move the
  feature's `…` under its title on the phone, or keep the settings' search beside it there, which
  the layout and look record placed under it.
- **If wrong**: each page's call is one element, and
  [`PageTitle.tsx`](/packages/web/src/layout/PageTitle.tsx) one file.
- **Where**: [`layout/PageTitle.tsx`](/packages/web/src/layout/PageTitle.tsx)

## R10: An agent's offer, a round's notes, and a comment's box are titled panes

- **Decision**: the offer card, the round's notes, and the comment box under a document's lines or a
  round's settled point are panes, titled "Start a change" or "Make this change a feature", "Notes",
  and "Comment". The comment box is a group, so it adds no landmark.
- **Rationale**: the UI look decision groups content in bordered panes titled in their border; the
  offer was an Astryx card, the notes a bare heading, and the comment box a border copied twice.
- **Alternatives considered**: a pane without a title for the comment box, which the look does not
  have.
- **If wrong**: each is one element in its file.
- **Where**: [`OfferCard.tsx`](/packages/web/src/OfferCard.tsx),
  [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx),
  [`layout/CommentBox.tsx`](/packages/web/src/layout/CommentBox.tsx)

## R11: An answer's comment and a review's comment stay two forms

- **Decision**: `QuestionComment` and `CommentForm` stay apart.
- **Rationale**: both already draw the shared `TextField`, `SaveStatus`, and `AttachStatus`; what
  differs is their behaviour, a comment that saves into the answer against one added to a review and
  closed.
- **Alternatives considered**: one form with a mode, which would hold both behaviours behind flags.
- **If wrong**: nothing draws differently.
- **Where**: [`QuestionComment.tsx`](/packages/web/src/QuestionComment.tsx),
  [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx)

## R12: Plain banners that show a lasting state stay plain

- **Decision**: the banners that show a state, such as a blocked action, a branch left after merge,
  a restored draft, or notifications blocked, stay Astryx's `Banner`; only the identical "No specs/
  folder" banner of Home and the decisions page is merged, as `NoSpecs`.
- **Rationale**: `AnnouncedBanner`'s rule is for errors and the outcome of an action; a banner that
  mirrors a lasting state stays plain, as its comment says.
- **Alternatives considered**: announcing every banner, which would read each state aloud on every
  page load.
- **If wrong**: one import per banner.
- **Where**: [`layout/AnnouncedBanner.tsx`](/packages/web/src/layout/AnnouncedBanner.tsx),
  [`layout/Missing.tsx`](/packages/web/src/layout/Missing.tsx)

## R13: A question stays a card, its header sticking whole

- **Decision**: a round's question keeps its card on wide screens, its header, the id, "Ask the
  agent", and the title at a heading's size, sticking at the top while the card shows. It is the one
  group of the UI not titled in its border.
- **Rationale**: the questions page's round answered that the card's header sticks at every width
  ([Q4](/specs/done/2026-10-24-questions-page.md)), and its tests hold a title of three lines shown
  whole at the top (US3.3) and the header under the phone's bar. A pane titled in its border would
  set the question at a pane title's size, the UI look's readability rule's first concern for the
  text read most, and would let the id and "Ask the agent" scroll away in its border.
- **Alternatives considered**: a pane titled "Q3 · follows Q2" with the question under it, which
  drops the id and Ask from what sticks; a pane titled by the question, as a spec's story, which
  sets the question small; a border title made to stick, which no pane does and the header's tests
  do not measure.
- **If wrong**: the card is one element in [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx),
  and `Pane` would gain a sticky title.
- **Where**: [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx)

## R14: The save hooks stay apart

- **Decision**: `useSave`, `useLineSave`, `useDraftEditor`, `useCommentDraft`, and `useReviewDraft`
  stay separate hooks.
- **Rationale**: they share their storage, the unsaved store, and `useDraftEditor` saves through
  `useSave`; each owns a different flow: a value saved in order, a line edited in place, a draft's
  editor with its frontmatter, and a review's comment and its place. None draws anything, so none is
  a kind of information drawn twice.
- **Alternatives considered**: one hook with modes, which would hold four flows behind flags.
- **If wrong**: nothing draws differently.
- **Where**: [`useSave.ts`](/packages/web/src/useSave.ts)

## R15: Keyboard hints stay as they are

- **Decision**: "Ctrl+Enter saves" stays beside the Save of a field saved in place, and a composer's
  send buttons keep their key; the other forms' main buttons, like "Add comment", show no key.
- **Rationale**: Ctrl+Enter works in every multi-line field already, the offer's proposal included
  now; which button shows its key is behaviour the proposal does not name.
- **Alternatives considered**: the key in every multi-line form's main button, as a composer's,
  which changes every form's row of buttons.
- **If wrong**: `SaveKeys` or the composer's key, beside each main button.
- **Where**: [`fields/SaveKeys.tsx`](/packages/web/src/fields/SaveKeys.tsx)
