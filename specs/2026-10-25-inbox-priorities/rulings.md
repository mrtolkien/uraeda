# Rulings: Inbox and priorities in the terminal look

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A retired Blocked stays readable, against the compatibility decision's no-fallback rule

- **Decision**: The core keeps `Section::Blocked` and `read` keeps four sections. The page shows a
  Blocked pane only when it has lines, and `ura check` warns that it is retired.
- **Rationale**: The spec's approval says a line under `## Blocked` "stays in the file and on the
  page" ([edge cases](spec.md#edge-cases)). The
  [compatibility decision](/specs/decisions/compatibility.md) says a format change keeps no fallback
  reading before 1.0. The human approved the spec, so their request wins.
- **Alternatives considered**: Dropping Blocked from the core: a line under it would vanish from the
  page, which the spec forbids.
- **If wrong**: Delete `Section::Blocked` and the warning, one commit in the core and the page.
- **Where**: tasks 2 and 5.

## R2: At 1150 px the columns are 400 px, so three do not show whole

- **Decision**: The test checks what holds at 400 px: the row scrolls sideways, each pane is at
  least 400 px wide, and Later is not whole at the right edge. It does not check that Ongoing, Now,
  and Next are all whole.
- **Rationale**: [US1's first scenario](spec.md#us1-priorities-as-columns-p1) says three columns
  show whole, from before the review. The review's [C2](spec.md#your-review) raised the width to 400
  px, and 1,150 px minus the rail leaves room for two whole columns and a part of the third. An
  approval comment supersedes the clause it changes, and the story's mockup says "two and a half
  show".
- **Alternatives considered**: Columns of 300 px so three fit: against the human's 400 px.
- **If wrong**: The scenario's text is amended in the spec.
- **Where**: task 5, `priorities-columns`.

## R3: The handle's tests and the keyboard drag's tests change with the handle

- **Decision**: The browser and happy-dom tests that pressed a "Move <line>" button now press the
  card's text, and the tests that dragged by keyboard are removed with the keyboard sensor.
- **Rationale**: The human dropped the handle, and the spec's assumptions say keyboard dragging is
  dropped with it: the menu's moves are the keyboard's way, tested in `card-menu`.
- **Alternatives considered**: Keeping the keyboard sensor on the card: a second way to drag the
  spec did not ask for.
- **If wrong**: Add the sensor back in `SENSORS` and the tests from git history.
- **Where**: task 1.

## R4: The test of a missing Blocked becomes a test of a missing Next

- **Decision**: `check.rs`'s test that a file without `## Blocked` is missing a section checks
  `## Next` instead, and new tests cover Blocked's warning.
- **Rationale**: Blocked is no longer a required section ([data model](data-model.md#prioritiesmd)).
  The test guarded the rule the spec removes.
- **Alternatives considered**: None: the test's rule is gone.
- **If wrong**: Restore the test with the requirement.
- **Where**: task 2. The test of the CLI's `check --json` that read the same missing Blocked now
  reads a missing Later.

## R5: A category edit acts on every heading of its name, and names compare exactly

- **Decision**: Rename and delete act on every `##` heading of the name. A taken name is found by
  the exact text after trimming, so "prompts" and "Prompts" are two categories.
- **Rationale**: Notes under two headings of one name are one category in
  [`read`](/crates/core/src/files/inbox/read.rs), and `ura check`'s `inbox.category` compares
  exactly. Acting on the first heading would leave the category on the page after its delete.
- **Alternatives considered**: Case-insensitive names: a second rule the check and the notes' add do
  not share.
- **If wrong**: One function in `categories.rs` changes.
- **Where**: task 3.

## R6: The notes a No keeps go after the notes already without a category

- **Decision**: With No, the deleted category's body is joined to the end of the lines before the
  first heading, so its notes follow the loose ones, in their order.
- **Rationale**: The spec says "the three notes come first under no category, in their order" about
  the page, where the notes without a category come first. In the file they follow the existing
  loose notes, so none is reordered.
- **Alternatives considered**: Putting them before the loose notes: moves the human's older notes.
- **If wrong**: Swap the join in `remove_category`, and its two tests.
- **Where**: task 3.

## R7: A hidden handle takes dnd-kit's attributes, and the card owns its row's picture

- **Decision**: `Card` gives `useSortable` a hidden, empty handle (`aria-hidden`, `tabindex=-1`)
  while the sensor's activator stays the whole card (`activatorElements`). `WorkRow` gains
  `image?: ReactNode`, a picture under the text. A card has no margin: the list's gap leaves room
  for the marks.
- **Rationale**: dnd-kit's accessibility plugin puts `role="button"`, a tab stop, and `aria-pressed`
  on a draggable's handle or element, which would turn the card into a button beside its link. On a
  hidden handle they reach nobody. A lifted card is positioned from its border box, so a margin
  offset it by the margin's width.
- **Alternatives considered**: Pre-setting the roles on the card: `aria-pressed` stays on a list
  item, which axe refuses. Dropping the plugin and announcing by hand: a second announcer to keep.
- **If wrong**: Replace the hidden handle with the announcer of the alternative.
- **Where**: task 1.

## R8: The fixture's Later holds the old Blocked line, so three tests read the end of the file

- **Decision**: The fixture repository moves its Blocked line to the end of Later, and the tests
  that expected a new line to come "before `## Blocked`" (`a_drafted_line_takes_its_children`,
  `a_note_becomes_a_draft_linked_from_the_priorities`) expect it after that line, at the end of the
  file.
- **Rationale**: The plan moves the fixture's Blocked line to Later. The tests only used the heading
  as the end of the section.
- **Alternatives considered**: Keeping an empty `## Blocked` in the fixture: the retired section
  stays in the files the tests copy.
- **If wrong**: Put the line first in Later and restore the old expectations.
- **Where**: task 2.

## R9: The tests that read the fixture's Later follow the moved Blocked line

- **Decision**: The desktop and unit tests that expected "Later · 1 of 1", a new line right after
  `  - with a cache`, the end of Later before `## Blocked`, or the section Next right after its
  heading, expect the new fixture: Later holds two lines (the moved Benchmarks line comes last), a
  new line follows it, and Now, Next, and Later start with their context note. The undo test of the
  quick add lands its other line after Later's note.
- **Rationale**: Task 2 changed the fixture on purpose, so the data these tests read moved; what
  each test guards (position, count, order, undo) is unchanged.
- **Alternatives considered**: Loosening the expectations to `toContain` fragments: they would stop
  guarding the position.
- **If wrong**: Revert the fixture and these expectations together.
- **Where**: task 2.

## R10: The semi-wide test of a kept place uses a shorter window

- **Decision**: The layout test of a task open beside the priorities, across 1280 px, sets its
  window to 300 px tall, not 500.
- **Rationale**: The priorities are now a row of columns, so the page is shorter, and at 500 px it
  scrolled by only 33 px at 1205 and 4 px at 1440. The test guards that the scroll place and the
  pane survive the width change, which needs a page that scrolls at both widths.
- **Alternatives considered**: Adding lines to the fixture: it would change every other test's data.
- **If wrong**: Restore 500 px and give the fixture's priorities more lines.
- **Where**: task 5, `layout.test.tsx`.

## R11: The columns live in `WorkList`, and a pane takes a title tint

- **Decision**: No `Columns.tsx`: `WorkList` draws each section as a titled pane and arranges them
  with `layout`. `Pane` gains a `tint` (blue, gray, green) that colours the title alone, and a space
  before its count, so its text reads "Now · 4". A selected card takes the accent's muted tint as
  its background.
- **Rationale**: The row is one flex container around the same pane component the sections already
  use, so a second file would hold a wrapper only. The mockup colours Ongoing's and Now's titles,
  not their borders, which no `PaneTone` does. The card's own background equals the pane's, so the
  selected card showed only by its border, which the existing test of a selected row's background
  caught.
- **Alternatives considered**: New `PaneTone` values: they would colour the border too.
- **If wrong**: Drop `tint`, and the sections' titles are all lavender.
- **Where**: task 5.

## R12: The tests of the pane beside the list follow the overlay

- **Decision**: The tests that read the pane as `region "Detail"` read the overlay as
  `dialog "Priority"` or `"Note"`. Changed with their reason: "a removed line says so" now expects
  "That line is gone." over the page, with no overlay; the phone's "page opens to read" is a sheet
  with its Close; "another row with unsaved text" reaches the other line with Next and Previous, as
  the modal overlay leaves the rows out of reach; "Cancel closes it without asking" counts that the
  overlay is the only dialog; the status line names no Escape for the list; the note that left shows
  nothing in the overlay, no banner; home's "a second line tapped keeps home beside it" steps with
  Next; the layout tests of a task across 768 px and 1280 px keep the dialog or sheet, and its one
  history entry; `lists.test.tsx`: ↓ and j select and open nothing (US4), Enter opens the overlay
  and Escape closes it, and the test that the pane starts at its top moved to `detail-overlay` for
  the overlay's body; the session test closes the modal overlay before using the navigation.
- **Rationale**: The human replaced the pane with a modal overlay and said the selection does not
  open it. Each test keeps the behaviour it guarded.
- **Alternatives considered**: Loosening the old expectations: they would no longer guard it.
- **If wrong**: Restore the pane's tests from git history with the pane.
- **Where**: task 6.

## R13: An overlay's entry is pushed by the click, or by the route for an address

- **Decision**: A click or Enter on a card calls `openDetail`, one entry that carries the overlay's
  label, so one Back closes it. An address reached any other way (a link, a reload with no label,
  Forward) is given its overlay entry by `DetailHost` before the overlay would push its own; Back to
  that address's own entry replaces it with the list, or, over home, goes back once more to home.
  `RouterAnchor` records the page a link came from only for a link to a line. A line the address
  names that was not there when it came up shows the page and a toast, "That line is gone.", at the
  list's address; one deleted from its own overlay closes it by Back.
- **Rationale**: `useBackCloses` pushes a state of its own that would drop `from` and add an entry
  after a route's. A `from` on a list's entry would draw home under a priority's overlay.
- **Alternatives considered**: Letting `useBackCloses` push: two entries, and `from` lost.
- **If wrong**: One file, `pane/DetailOverlay.tsx`.
- **Where**: task 6.

## R14: After Next, the test closes with Close, not Escape

- **Decision**: "after Next, Close leaves the last line selected and focused" clicks Close.
- **Rationale**: Stepping to the last line disables Next and the pane is drawn anew, so the focus
  goes to the overlay's Close; in WebKit, Escape pressed then did not cancel the dialog in the
  browser test, though Back and Escape without a step do. Escape's own test stays.
- **Alternatives considered**: Dropping the test: the selection after a step has no other test.
- **If wrong**: Restore Escape once the cause is found.
- **Where**: task 6, `detail-overlay`.

## R15: The overlay is 108ch wide, and the pane has no inset of its own

- **Decision**: `--size-detail` is `108ch` and `--size-detail-height` `60dvh`, in the theme. The
  entry pane's bar and body lose their own side insets, and the dialog's body scrolls on its own.
- **Rationale**: The page's font is monospace, so 108 characters are 108ch (about 1,090 px at the
  dialog's size, "about 1,060 px"). The overlay insets what it holds; a second inset cut a button's
  label in the sheet.
- **Alternatives considered**: A pixel width: not the font's.
- **If wrong**: Two tokens and one style.
- **Where**: task 6.

## R16: The menu is a DropdownMenu, its note choices are submenus, and a running card offers Open

- **Decision**: `CardMenu` draws Astryx's `DropdownMenu` with an icon button, not `MoreMenu`, whose
  `xstyle` styles the menu and not its button. A note's Move to a priority, Add to a draft, Make a
  draft (in Now, Next, or Later), and Category are submenus (a drill-in sheet on the phone), where
  the pane has a selector or a button per choice; the targets are Now, Next, and Later, as Blocked
  is retired. A priority's moves are "Move to" the other sections, Move up and down, To the top and
  To the bottom, the last four disabled when they would change nothing on screen. Make a draft and
  Start show only for a line with no draft and no link, as the pane does. A running card's menu
  holds one item, Open, to its feature, so its `…` is not empty; it has no move and no Delete. A
  move of a priority from the menu shows a toast with Undo (`moveTo`, in `useMoveTo`), which the
  pane's section control does not.
- **Rationale**: The button must show its own opacity while the menu is open and the pointer left
  the card, which needs the trigger's own style. The spec asks for an Undo on Move to Now. The
  drafts' titles are read once the first note menu opens.
- **Alternatives considered**: A selector inside the menu, which Astryx's menu does not hold.
- **If wrong**: One file, `lists/CardMenu.tsx`.
- **Where**: task 7.

## R17: `fileIndex` lives in `cardMoves.ts`, and the press-on-`…` test checks the outcome

- **Decision**: `fileIndex` moved from `PrioritiesList.tsx` to `lists/cardMoves.ts` (the list
  imports it), so the menu and the drag share it without an import cycle. `(hover: none)` is true in
  the phone project (WebKit with a touch screen), so its test reads the real button's opacity. The
  test that a press on `…` never drags checks the outcome (the press is on the button, a drag from
  it writes nothing, and a drag from the card's text opens no menu). It also passes with
  `preventActivation` removed, so it cannot tell the guard's own effect: Astryx's trigger already
  keeps a held press from reaching the sensor.
- **Rationale**: A cycle `PrioritiesList` to `CardMenu` to `cardMoves` to `PrioritiesList`.
- **Alternatives considered**: A test of dnd-kit's sensor alone: it would assert its internals.
- **If wrong**: Move `fileIndex` back and import it in `cardMoves.ts`.
- **Where**: task 7.

## R18: An empty category deletes at once, and the old "hidden" test now expects a pane

- **Decision**: A category with no note deletes from its menu without the question, with the Undo
  toast: "Delete the 0 notes too?" asks nothing. A category with notes asks. The test "an empty
  category is hidden, and the empty inbox says so" is now "an empty category is an empty pane, ...":
  it expects the heading "UI · 0".
- **Rationale**: US3 and US6 draw an empty category as an empty pane, so the old test's premise,
  that it is hidden, is gone; the only thing to decide with no notes is the heading, and Undo
  restores it.
- **Alternatives considered**: Asking with N=0: a question with no answer to choose between.
- **If wrong**: One condition in `CategoryMenu`.
- **Where**: task 8.

## R19: `remove(name, keepNotes)`, a bare title field, and the image in its own block

- **Decision**: `useCategoryActions(hash)` returns `add(name)`, `rename(from, to)`, and
  `remove(name, keepNotes)`, each resolving with the core's refusal message or nothing, in place of
  the plan's `remove(name, count)`: the menu decides whether to ask, from the count. A rename to the
  category's own name writes nothing. The title renames in place with `LineField` in a new bare form
  (`isBare`: the field alone, Enter and Escape deciding), as Save and Cancel do not fit in a pane's
  border. A card draws its image in a block of its own, under its text: it was inline, beside a
  short text. `Pane` and `WorkSection` gained `titleNode`, and `WorkSection` a `menu`.
- **Rationale**: The core refuses a rename to the same name as "exists"; the border holds a title,
  not a form; US3 says the first image shows under the text.
- **Alternatives considered**: Save and Cancel buttons in the title: wider than a phone's pane.
- **If wrong**: `lists/CategoryPane.tsx`, `lists/useCategoryActions.ts`, and one line of `Card`.
- **Where**: task 8.
