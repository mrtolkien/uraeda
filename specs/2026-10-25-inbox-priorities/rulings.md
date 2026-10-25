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
