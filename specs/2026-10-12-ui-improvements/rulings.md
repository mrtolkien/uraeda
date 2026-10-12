# Rulings: UI improvements

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A proposal hint is its placeholder without the brackets, on one line

- **Decision**: `proposal_hints()` gives each placeholder of the proposal template without its
  brackets, its lines joined with a space, and the "Optional: " prefix kept. The binding returns
  them as `ProposalHint { heading, hint }` objects, declared in the core's `view.rs`, through
  `api::proposal_hints()`, like every other type the binding returns.
- **Rationale**: the plan's interface said "brackets kept as written", but its own examples, and the
  spec's US5 scenario 3 ("a dimmed "The problem it solves, and for whom.""), have no brackets.
- **Alternatives considered**: keeping the brackets, which the editor would then strip, a second
  copy of the template's format.
- **If wrong**: the editor shows the hint with or without brackets; one function to change.
- **Where**: task 1, `crates/core/src/embedded.rs`

## R2: The UI's refused-start test becomes a start that succeeds

- **Decision**: `editor.test.tsx`'s "starting a draft with the template's placeholders is refused"
  now checks that Start starts that draft, and lands on the new feature.
- **Rationale**: the review's C2 removes the refusal for the UI's Start as well as for `ura start`;
  the plan named only the Rust tests to remove. A test that no longer matches the spec is changed
  with it, per the UI checks decision.
- **Alternatives considered**: deleting the test, which would leave C2 unguarded in the UI.
- **If wrong**: one test to remove.
- **Where**: task 1, `packages/web/src/__tests__/editor.test.tsx`

## R3: A priority key is counted over the whole file, and a draft's name is slugged

- **Decision**: `priorities::keys` numbers repeated keys over every section of `PRIORITIES.md`, in
  the file's order, so a "Slack" in Now and one in Later are `slack` and `slack-2`. A linked draft's
  key is `slug::from_text` of its file name without `.md`, and falls back to the line's text when
  that slug is empty. `FeatureView.mockups` is read with the feature's files, so it follows the same
  source: the working tree when the branch is checked out, otherwise its tip.
- **Rationale**: the spec says "a key already taken by an earlier entry of the file", and the task
  view's address `/priorities/<key>` names no section. The spec also says "the slug of the linked
  draft's file name", which a stem alone would not guarantee.
- **Alternatives considered**: numbering per section, which gives two lines the same address; the
  raw stem, which could hold characters an address must escape.
- **If wrong**: one function, `keys`, in `crates/core/src/files/priorities.rs`.
- **Where**: task 3, `crates/core/src/files/priorities.rs`, `crates/core/src/workspace.rs`

## R4: The coarse pointer's adaptation comes after the wide one

- **Decision**: the theme's adaptations are, in order, from `lg` (sizes × 1.2), then under a coarse
  pointer (element heights 44 px). The plan listed them the other way round.
- **Rationale**: Astryx applies matching rules in order, the later one winning. With the coarse rule
  first, a wide touch screen, like a tablet in landscape, would get 38.4 px controls, against the
  layout decision's 44 px under a coarse pointer. Every grown height (33.6, 38.4, 43.2 px) is below
  44 px, so the coarse rule last only ever raises them.
- **Alternatives considered**: the plan's order, which breaks the 44 px rule on wide touch screens.
- **If wrong**: two rules to swap in `packages/web/src/theme/theme.ts`, and a rebuild.
- **Where**: task 4, `packages/web/src/theme/theme.ts`, guarded by
  `packages/server/src/__tests__/stack.test.ts`

## R5: How the theme source states its values

- **Decision**: the app's own tokens (`--text-reading-*`, `--size-reading-measure`,
  `--color-selection*`) are Astryx `localTokens`, the field for names outside Astryx's set. The
  selection colours point at Astryx's `--color-background-yellow` and `--color-border-yellow`, which
  already hold a light and a dark value. The neutral theme's sizes that the wide rule multiplies
  (base font 14 px, the spacing steps, the element heights) are listed in the source. The wide type
  scale's base, 16.8 px, comes out as Astryx's rounded `1.0625rem` (17 px).
- **Rationale**: `astryx theme build` refuses a source that passes the neutral theme to anything but
  `extends`, so the values cannot be read from it at build time. Astryx's yellow tokens give the
  amber tint and bar in both modes without new colour values to maintain.
- **Alternatives considered**: reading the sizes with `resolveThemeTokens(neutralTheme)`, which the
  build rejects; hand-written `[light, dark]` amber values.
- **If wrong**: the listed sizes drift from Astryx's after an upgrade; the source says to recheck
  them, and one file changes.
- **Where**: task 4, `packages/web/src/theme/theme.ts`

## R6: StyleX in tests, its CSS targets, and the theme's check

- **Decision**: StyleX's plugin injects each module's CSS at run time under Vitest
  (`runtimeInjection` when `VITEST` is set), as neither the happy-dom tests nor the WebKit tests
  load `index.html`, where `vp dev` gets its CSS; the build appends it to the app's stylesheet. Its
  CSS targets browsers with `light-dark()`, which Astryx's tokens use, so it is not lowered.
  `vp run ready` runs `astryx theme build --check`, so the committed theme cannot drift from its
  source.
- **Rationale**: checked with a throwaway component: its StyleX rules applied in WebKit at both
  sizes (16 px and 19.2 px for `--spacing-4`), in `vp dev`'s `/virtual:stylex.css`, and in the built
  stylesheet. The toolchain decision requires a new tool's checks in `vp run ready`.
- **Alternatives considered**: importing `virtual:stylex:runtime` from the test helpers, which
  fetches the CSS once and relies on HMR events for the rest.
- **If wrong**: one option in `packages/web/vite.config.ts`.
- **Where**: task 4, `packages/web/vite.config.ts`, `package.json`

## R7: The left-inset check runs on the phone only

- **Decision**: `checkInsets`, the browser helper that checks text starts within 50 px of the
  screen's left edge, applies under 768 px wide only: on wide screens it checks nothing.
- **Rationale**: it guards SC-007 of the web UI, a phone criterion. At 1440 px the reading column is
  centred, and its text starts far from the edge by design.
- **Alternatives considered**: a desktop threshold, which no spec or decision gives.
- **If wrong**: one condition in `packages/web/src/__browser__/helpers.tsx`.
- **Where**: task 4, `packages/web/src/__browser__/helpers.tsx`

## R8: The list pane scrolls with the page, the detail pane on its own

- **Decision**: on wide screens, `Panes` lets the list scroll with the window, and makes the detail
  sticky, as tall as the window at most, scrolling on its own. Its two sizes are theme tokens,
  `--size-pane-min` (400 px) and `--size-viewport-height` (`100dvh`).
- **Rationale**: the plan asked for each pane to scroll on its own. Two inner scrollers would take
  the list's position out of the window, where `navigate` and `useRestoreScroll` (task 6) save and
  restore it; a sticky detail scrolls apart from the list all the same. The components decision puts
  sizes the theme lacks in the theme.
- **Alternatives considered**: two scroll containers of the window's height, with the router saving
  each one's position.
- **If wrong**: one style in `packages/web/src/layout/Panes.tsx`.
- **Where**: task 5, `packages/web/src/layout/Panes.tsx`, `packages/web/src/theme/theme.ts`

## R9: An Undo gives its own error

- **Decision**: `useUndoToast`'s `undo` resolves with nothing once the change is reverted, or with
  the error text to show, instead of a boolean. ＋'s Undo removes the line by its id over the hash
  read from disk at that moment, so a line edited since is removed as edited.
- **Rationale**: the plan's `Promise<boolean>` gave the toast no text for its error. Each caller
  knows its own: the core's refusal for ＋, "Could not restore …" for a deletion.
- **Alternatives considered**: a third argument with a fixed error text, which hides the core's
  refusal from ＋'s Undo.
- **If wrong**: one signature, in `packages/web/src/layout/useUndoToast.ts`, and its two callers.
- **Where**: task 7, `packages/web/src/layout/useUndoToast.ts`, `packages/web/src/QuickAdd.tsx`

## R10: Blocks draw their review selection in StyleX from task 8

- **Decision**: rebuilding `Blocks` on Astryx, a block a review can select is a `role="button"` with
  `aria-pressed`, no longer `aria-selected` and the `.block` class, and its tint and bar come from
  `--color-selection` and `--color-selection-edge` in StyleX. A list item's selectable part is its
  text inside the Astryx `ListItem`; a table row is the Astryx `TableRow` itself. Document lists
  take back the page's inset through `List`'s `edgeCompensation`, so their text starts where
  paragraphs do. `review.test.tsx` finds selectable blocks by role.
- **Rationale**: the `.block` rules of `styles.css` targeted `li` and `tr` elements that Astryx now
  draws; `aria-selected` is not allowed on a button (axe), and `aria-pressed` is the state of a
  toggle. Task 13 planned the tint; drawing it now avoids a page with no selection style between the
  two tasks.
- **Alternatives considered**: keeping raw `ul`, `li`, and `tr` elements for the review only, two
  ways to draw one document.
- **If wrong**: the selection's look is two styles in `packages/web/src/Blocks.tsx`, which task 13
  refines with the review's layout.
- **Where**: task 8, `packages/web/src/Blocks.tsx`, `packages/web/src/__tests__/review.test.tsx`

## R11: A deletion's Undo writes over the file as it is now

- **Decision**: the Undo of a deletion reads the priorities' hash when it is tapped, as ＋'s Undo
  does ([R9](#r9-an-undo-gives-its-own-error)), and inserts the line at its index over it. It shows
  "Could not restore …" when the core refuses the insert, or the request fails. The test of a
  refused Undo changes the file after that read, before the insert reaches the server, through a
  fetch wrapper; the plan said to change it between Delete and Undo, which the spec's edge case
  answers with a restored line, now tested too.
- **Rationale**: the spec's edge case says the line goes back "at its position in the file as it is
  now"; inserting over the hash seen at the deletion would refuse every Undo after any other change.
- **Alternatives considered**: the hash returned by the deletion, which refuses the Undo the edge
  case asks to succeed.
- **If wrong**: one call in `packages/web/src/TaskView.tsx` `remove`.
- **Where**: task 9, `packages/web/src/TaskView.tsx`, `packages/web/src/__tests__/task.test.tsx`

## R12: Every link of the UI says where it was followed from

- **Decision**: `RouterAnchor`, the anchor of every Astryx link, navigates with `from`, the path it
  was followed from, and `navigate` records `opener`, the scroll position it leaves. The task route
  shows home beside the task view when `from` is `/`, the priorities page otherwise, and puts the
  list back at `opener` on wide screens. Renaming a line or deleting it replaces the history entry
  (`redirect`) instead of adding one. The tests that find the line's button by name anchor it,
  `/^Claude Code runner/`, as the priorities page beside it still holds "Actions for Claude Code
  runner …" until task 11.
- **Rationale**: home's rows are Astryx `ListItem` links, whose anchor only the link provider draws:
  there is no per-row `navigate` call to pass `from` to. `navigate` scrolls to the top for a new
  page, which on wide screens would move the list away from the tapped row.
- **Alternatives considered**: rows as buttons calling `navigate`, which the plan's tests and the
  behaviour decision (a row that leads somewhere is a link) rule out.
- **If wrong**: `RouterAnchor` and `TaskRoute`, in `routes.tsx` and `App.tsx`.
- **Where**: task 9, `packages/web/src/routes.tsx`, `packages/web/src/App.tsx`

## R13: The editor lists the hints of empty sections under the text area

- **Decision**: the editor shows the hint of each empty `##` section dimmed, under the text area,
  after "To write in the empty sections:", one line per heading ("Why · The problem it solves, and
  for whom."), instead of an overlay drawn on the section's line inside the text area. A proposal
  opens drawn when it holds text outside its title and What, like a freeform proposal without
  sections; the editor's Preview and Edit button switches between the two.
- **Rationale**: an overlay has to copy Astryx's `TextArea` padding, border, font, its iOS 16 px
  floor, and its scroll, none of which its API exposes: a slip puts the hint on the wrong line. The
  plan allowed this fallback. The hints still show while the text area is in view, and are never in
  the file.
- **Alternatives considered**: a mirror layer over the text area, with the text transparent and the
  hints on the empty sections' blank lines; the text area's placeholder, which shows only when the
  whole text is empty.
- **If wrong**: one block of `packages/web/src/EditorPage.tsx` to replace by an overlay.
- **Where**: task 10, `packages/web/src/EditorPage.tsx`

## R14: How dnd-kit's drop reaches the core, and how the drags are tested

- **Decision**: the page keeps each section's order of keys while a line is dragged, reordered by
  `@dnd-kit/helpers`' `move` on each `dragover`; on the drop, `dropMove` finds the line now right
  after the dropped one, takes its place in the order before the drag as the target of `dropIndex`,
  and calls `priorities.move` over the hash the drag started from; dropped last in a section, the
  line ends it. `@dnd-kit/dom` 0.5.0, the package `@dnd-kit/react` is built on, is added at an exact
  version for `PointerActivationConstraints` and `Accessibility`, which `@dnd-kit/react` does not
  re-export. The browser tests that write the repository take it in turn, each on a fresh copy of
  the fixture, through commands in `vite.browser.config.ts`; the mouse drags use the browser's real
  mouse; a touch drag dispatches touch pointer events with the primary pointer's id, as the WebKit
  of the tests has no touch screen; "committing closes the page's toasts" runs in the browser, as
  happy-dom never ends the toast's exit transition, and clicks with `userEvent`, as `act` in the
  browser held the task view's Delete from leaving the page.
- **Rationale**: the plan named `dropIndex` with dnd-kit's indices, and the docs' pattern for lists
  across groups reorders on `dragover`; the core counts an index among the lines once the dragged
  one is out, which the line dropped above gives through `dropIndex` unchanged. The phone and the
  desktop run the browser tests at once on one server, which reads one repository: two drags at once
  would refuse each other's moves.
- **Alternatives considered**: dnd-kit's own final index, which is already the core's index, with
  `dropIndex` left for its test alone; a repository per browser instance, which the server's one
  `URAEDA_REPO` cannot tell apart; finding the Accessibility plugin among dnd-kit's defaults by its
  class name.
- **If wrong**: `dropMove` in `packages/web/src/PrioritiesPage.tsx`, and the commands in
  `packages/web/vite.browser.config.ts`.
- **Where**: task 11, `packages/web/src/PrioritiesPage.tsx`, `packages/web/vite.browser.config.ts`,
  `packages/web/src/__browser__/priorities.test.tsx`

## R15: The round's index is an Astryx List, its titles wrapping

- **Decision**: the round's index, in the sheet and in the wide column alike, is an Astryx `List` of
  rows, each a button labelled "✓ Q1 <title>" or "○ Q2 <title>", its text wrapping, follow-ups
  indented, the question at the top selected. The wide column is labelled "Questions", 240 px wide
  through the theme's `--size-round-index`.
- **Rationale**: Astryx's `Outline` cuts each label to one line with an ellipsis, and its labels are
  strings: the questions' titles run to 60 characters and more, and the UI checks decision forbids
  cut text, which `checkPage` checks at 1440 px. The index's job, a jump to any question with its
  state, is the same.
- **Alternatives considered**: `Outline` with the ids alone ("✓ Q1"), which hides what each question
  is about; a theme override reaching the label inside `Outline`'s link, which Astryx's component
  overrides do not target.
- **If wrong**: `Index` in `packages/web/src/RoundNav.tsx` becomes an `Outline`.
- **Where**: task 12, `packages/web/src/RoundNav.tsx`, `packages/web/src/theme/theme.ts`

## R16: A tap on the top bar's controls stays theirs

- **Decision**: the shell wraps what a page puts in the top bar in `SlotControls`, which stops a
  click from reaching the heading's link home, and keeps the browser from following that link when
  the tap lands between the controls.
- **Rationale**: Astryx draws `SideNavHeading` with `headingHref` as one link around its
  `headerEndContent`: a tap on the round's Next, or on ＋ on the priorities page, or on a button of
  the sheet ＋ opened (React passes a portal's events up its tree), also went home. Task 7 could not
  see it from home, where going home changes nothing.
- **Alternatives considered**: the controls outside the heading, which no slot of Astryx's top bar
  offers; each control stopping its own clicks, a rule every page would have to remember.
- **If wrong**: `SlotControls` in `packages/web/src/Shell.tsx`. The controls stay inside a link,
  which axe's `nested-interactive` rule may report in task 14.
- **Where**: task 12, `packages/web/src/Shell.tsx`

## R17: The comment sheet is capped and leaves the page usable

- **Decision**: on the phone, the review's comment sheet is Astryx's `capped` height, about 62% of
  the screen, and non-modal: the page above it stays tappable, so a second block extends the
  selection. It opens through `Overlay`, with its Close and Back. Once the sheet stops moving, the
  page scrolls the last tapped block's bottom just above it, or its top under the bar when it is
  taller than that space, and while it is open the page ends with room the height of the screen, so
  the last blocks can rise above it.
- **Rationale**: Astryx's `tall` sheet is 92% of the screen: above it, under the 48 px top bar,
  there is no room for the block US2 scenario 1 asks to show above the sheet. `capped` is the
  mockup's height. A non-modal sheet also keeps the page scrollable, which a modal sheet's scroll
  lock prevents.
- **Alternatives considered**: `tall`, as the plan and the spec's design said, which only Astryx
  makes keyboard-aware: the block would always be hidden, and only the quote would show it; a `tall`
  sheet with a lower snap point, which Astryx opens at its full height.
- **If wrong**: under iOS's keyboard, the browser's own reveal scrolls the page to the field, as
  Astryx documents for every height but `tall`; the quote in the sheet keeps the context. One prop
  in `packages/web/src/ReviewPage.tsx`.
- **Where**: task 13, `packages/web/src/ReviewPage.tsx`, `packages/web/src/layout/Overlay.tsx`

## R18: On wide screens, every comment field of the review is in the page

- **Decision**: on wide screens, editing a pending comment opens the field in place of the comment,
  and a general comment opens it under "Add a general comment", as a comment on lines opens it under
  its block. On the phone, all three open in the sheet.
- **Rationale**: the spec puts the comment field in the page on wide screens, with no overlay, and
  the behaviour decision keeps modals for confirmations and short forms; one place per width for
  every comment keeps one rule.
- **Alternatives considered**: a dialog for edits and general comments on wide screens, a second way
  to write a comment on the same page.
- **If wrong**: `inPage` in `packages/web/src/ReviewPage.tsx`.
- **Where**: task 13, `packages/web/src/ReviewPage.tsx`
