# Rulings: Questions page in the terminal look

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The mockup's README stays with the mockup

- **Decision**: the approval kept `mockups/README.md` beside `questions.html`, though no link of the
  spec names it.
- **Rationale**: the spec step rewrote it to describe the spec's own mockup, not the investigation's
  prototypes, which were already gone from the folder; it tells a reader how to look at the mockup
  the spec links.
- **Alternatives considered**: deleting it, as the approval step's rule reads literally; the mockup
  then loses its only description.
- **If wrong**: delete the file; no link points to it.
- **Where**: the approval step.

## R2: The session's page keeps scrolling the window

- **Decision**: the session's view scrolls a box only in the column; the session's page keeps the
  window, as today.
- **Rationale**: the spec asks for a view "used by the session's page and the column" that owns how
  a session follows its end; one view acting on the box its element is in, the window without one,
  meets that without moving the page's Back, reading place, and `#turn-` links, which their tests
  guard.
- **Alternatives considered**: the session's page in a box too, which rewrites its reading place and
  Back for no change the human sees.
- **If wrong**: give the session's page a box; the view already acts on one.
- **Where**: Task 1.

## R3: Round panes open on the phone through a prop

- **Decision**: `Pane` takes `isOpenOnPhone`, which the round's panes set, rather than every pane of
  the app losing its sides on the phone.
- **Rationale**: the approved answer, open sides "so text keeps the screen's width", was about the
  round; home, decisions, and settings panes were reviewed with their sides.
- **Alternatives considered**: every pane open on the phone, a change to pages no spec reviewed.
- **If wrong**: make it the default and drop the prop.
- **Where**: Task 3.

## R4: One comment form per part of the settled points

- **Decision**: the Check these pane and the settled panes at the round's end each keep their own
  comment form, restored under its own point.
- **Rationale**: the two parts sit far apart on the page; one form state across both would need the
  page to hold it, for no behaviour the spec asks.
- **Alternatives considered**: one form for the page, lifted into `RoundPage`.
- **If wrong**: lift the state into the page; the forms' unsaved text is keyed by point already.
- **Where**: Task 6.

## R5: Test rounds from the rounds the spec names

- **Decision**: the tests read two new fixtures, the merge-chats round 01 and the layout-look round
  01's Q4 and Q5, copied from git history into the new format.
- **Rationale**: the spec's scenarios name these rounds and their exact text; the existing fixtures
  have no "Example:" line nor a verdict "with changes".
- **Alternatives considered**: rewriting the scenarios over the existing web-ui fixture, which loses
  their exact values.
- **If wrong**: the fixtures are test data only; replace them.
- **Where**: Task 2.

## R6: The trimmed layout-look round fails only its numbering

- **Decision**: `fixtures/round-layout-look/clarifications-01.md` keeps Q4 and Q5 under their own
  numbers, so `ura check` reports its count and its numbering; a test pins those as its only
  problems, and `every_fixture_round_passes` leaves it out.
- **Rationale**: the spec's scenarios and the later tasks' tests name "Q4" and its example; the
  round is trimmed to the parts they read, as R5 says.
- **Alternatives considered**: renumbering to Q1 and Q2, which loses the names the scenarios use;
  copying the whole round, ten questions no test reads.
- **If wrong**: copy the whole round from `6ed4502b` in the new format and add it to the passing
  fixtures.
- **Where**: Task 2.

## R7: A level-2 item orders the fixed sections after it

- **Decision**: `sections.order` takes a level-2 item, like `## Q1` or `## Task 1`, as a mark: a
  fixed section the template puts before it, found after it, is reported. Items themselves are never
  out of order, and deeper items, like `### Q1.B`, are no mark.
- **Rationale**: `## Check these` after `## Q1` must fail, and the rule stays the template's,
  without a round-only case. Checked over `specs/`, `fixtures/`, and the example: no file gained a
  report.
- **Alternatives considered**: a check for rounds only, naming `## Check these`, which a later
  template change would miss.
- **If wrong**: limit the mark to rounds in `check_order`.
- **Where**: Task 2.

## R8: Task 3's tests in files of their own

- **Decision**: the hanging lists are tested in `__browser__/document-lists.test.tsx` and the
  folding pane in `__tests__/titled-pane.test.tsx`, new files, rather than in `lists.test.tsx` and
  `pane.test.tsx` as the plan named them.
- **Rationale**: those two files already exist and test the priorities' keyboard list and detail
  pane; `lists.test.tsx` runs on the desktop only, so phone tests in it would mean re-wrapping it.
- **Alternatives considered**: adding to the existing files, under `describe` blocks.
- **If wrong**: move the tests into the existing files.
- **Where**: Task 3.

## R9: On the phone, each row draws its own marker

- **Decision**: on narrow screens, a document's list draws every row's marker itself, a dash for a
  plain bullet, its sign for a typed one, its number for an ordered one, in a box 14.4 px wide
  (`--spacing-3`), the list moved left by as much. An ordered list is then a `ul` with its numbers
  as text, not an `ol`.
- **Rationale**: Astryx's marker is 19.2 px wide before a 9.6 px gap, which the list cannot restyle;
  a hang that wide leaves the screen on the spec page, whose inset is 14.4 px. The approved settled
  point asks for a dash.
- **Alternatives considered**: Astryx's markers and a 28.8 px hang, cut at the screen's edge on
  tight pages; Astryx's numbers in an `ol`, the same.
- **If wrong**: hang Astryx's own markers, once Astryx lets a list size them.
- **Where**: Task 3.

## R10: The column keeps no reading place across the narrow breakpoint

- **Decision**: `useKeepPlace` keeps the window's reading place only; content in a box that scrolls
  on its own, as the round's Session column, keeps none.
- **Rationale**: the place is kept only as the window crosses the narrow breakpoint, and the column
  is drawn only above it, so it leaves as the window crosses: a place kept in its box is never put
  back where anyone reads it. Each media query's listener commits on its own, so the column may
  still draw for a moment at narrow: its place, read against the window, would then move the round.
- **Alternatives considered**: keeping the place in the box, as Task 1 first built, which only moves
  a column about to leave.
- **If wrong**: keep the place in the box, once the column draws on narrow screens.
- **Where**: Task 1.

## R11: A hanging marker's room is its list's widest marker

- **Decision**: on narrow screens, each list sizes its markers' room to its widest marker, its gap
  included: 14.4 px for dashes (`--spacing-3`), one em for typed signs and task boxes, and its
  longest number and dot for an ordered list. It hangs by that room, at most by the page's inset
  (`--page-inset`): a list of dashes keeps its text on the paragraphs' edge, and a wider marker's
  list sets its text in by what the inset lacks. An ordered row's typed sign or task box follows its
  number, as on wider screens. Each marker sits on its row's first line, on one line.
- **Rationale**: R9's 14.4 px room cut "8." and "☐" at the screen's edge, about 17 px wide at 19 px
  text, and wrapped "10."; no inset holds them, as the spec page's is 14.4 px. Text set in a few
  pixels keeps every marker whole on the screen.
- **Alternatives considered**: smaller markers, unlike the text's; one room for every list, wide
  enough for "10.", which would set every list of dashes in too.
- **If wrong**: give the page a wider inset on the phone, or let lists of numbers keep Astryx's
  `ol`.
- **Where**: Task 3, fixed in its review.

## R12: The document's column keeps its own width, beside `SideColumn`'s

- **Decision**: `SideColumn` takes either a `storageKey`, Astryx keeping its width as before, or a
  `width` its caller keeps; the document's column passes one from `useDocumentColumnWidth`, which
  follows the window until dragged and keeps the width and the fold under `uraeda.documentColumn`,
  as the shell's column does, both through `useFollowedWidth` in `layout/followedWidth.ts`.
  `SideColumn` also takes a `header`, the tabs, in place of its name.
- **Rationale**: Astryx's kept width cannot follow the window until dragged, as the spec asks: it
  saves every resize, the window's too. The session's Progress column, the spec's Contents, and the
  round's temporary Session column keep their stored widths and keys unchanged.
- **Alternatives considered**: every `SideColumn` following the window, which loses the widths kept
  under the other columns' keys; a column of its own for documents, a copy of the fold, the rail,
  and the resize bar.
- **If wrong**: move the following into `SideColumn` behind a prop; the document's column already
  gives it its limits.
- **Where**: Task 4.

## R13: The core gives the Example and Why panes their text without the lead

- **Decision**: the core gives the "Example:" and "Why it matters" paragraphs as blocks, found by
  their lead, and their spans without it, `exampleText` and `whyText`: the lead, the white space and
  the one ":", "." or "—" after it dropped, the first letter capitalised. The question card draws
  those spans in the paragraph's place, under the pane's title that says the lead.
- **Rationale**: the stack decision keeps parsing workflow text in the core; the page first trimmed
  the lead itself, by a rule of its own that differed from the core's, so "Why it matters. It
  decides" drew as ". It decides".
- **Alternatives considered**: the page trimming the lead, as Task 5 first built, a second reading
  of the format; a `lead` length from the core, which leaves the page to cut and capitalise.
- **If wrong**: drop the two fields and draw the paragraphs whole, their lead included.
- **Where**: Task 5, fixed in its review.

## R14: On the phone, an option's text sits 10.6 px from the screen's edge

- **Decision**: on narrow screens, an option's border runs at the screen's edges and its text is
  inset by `--spacing-2` (9.6 px) plus its 1 px border; a picked option's 2 px border takes 1 px of
  that inset, so its text does not move. Each pro, con, and why box starts at that same edge.
- **Rationale**: SC-004, kept by approval comment C2, asks for at most 11 px; the mockup's 21 px
  does not meet it, and the existing test keeps the options as wide as the screen.
- **Alternatives considered**: the mockup's border 10 px in from the edge, which leaves the text 21
  px in.
- **If wrong**: change `optionPhone`'s `--option-inset` in `QuestionOption.tsx`.
- **Where**: Task 5.

## R15: The tests of the old look follow the round's panes

- **Decision**: Task 6 rewrites the assertions that read the old look, in `round.test.tsx` (UI and
  browser), `fields.test.tsx`, `layout.test.tsx`, and `blocks.test.tsx`: the context's parts as
  regions, not `###` headings, the block found by its pane, and Under the hood opened by its title
  or its line "N choices in the code only", not "Show the N points" and "Fold". `blocks.test.tsx`
  opens Today, which holds its tables, and its wide table has 12 columns, as 8 now fit a desktop's
  pane. `document-lists.test.tsx` measures the block's second item and the Sources' list against the
  Scope's paragraph, as the block's first paragraph is now its pane's title, its verdict a badge,
  and Today folded.
- **Rationale**: the page draws through the parts Task 6 changes, so these tests failed on the look
  the spec replaces, not on a behaviour; each keeps what it checked.
- **Alternatives considered**: leaving them to Task 8, which leaves the branch failing between the
  tasks.
- **If wrong**: Task 8 rewrites them again with the page.
- **Where**: Task 6.

## R16: The outline's tests draw it beside the page until Task 8

- **Decision**: `round-outline.test.tsx` renders `RoundOutline` and `OutlineSheet` next to the round
  page, on the phone, from the round the core reads in the same repository; the page draws the parts
  they jump to. The browser test "the part at the top is marked" moves to Task 8, with the outline
  in the page's column.
- **Rationale**: Task 7 runs beside Tasks 4 to 6 and must not edit `RoundPage.tsx`, which draws
  `RoundNav` until Task 8. On the phone the page's own navigation has no `n` and `p`, so only the
  outline answers them, before and after Task 8.
- **Alternatives considered**: drawing the outline in `RoundPage.tsx` for now, a file Task 8 owns; a
  test of the rows from hand-made items, which the core would no longer check.
- **If wrong**: Task 8 renders the page's own outline in these tests and drops the extra root.
- **Where**: Task 7.

## R17: Today opens through the address, and the outline is Astryx's List

- **Decision**: the Today row pushes `#today` as a link to it does (`openAnchor` in
  `routeHistory.ts`, a new history entry with its own id), so the page opens Today as it does for
  any link to it, then jumps there. The rows are Astryx `List` rows, as the index was, not Astryx's
  `Outline`. A triage's free context part has the row "Context", jumping to the id `context`.
- **Rationale**: the round's parts are drawn by Task 6, which unfolds Today from the address; the
  outline reaches it only through that contract. Astryx's `Outline` takes plain string labels and
  pushes a history entry without state on every click, which the page's Back and reading place read.
- **Alternatives considered**: the outline opening Today through a shared state with the page, which
  Task 6's files would have to export; setting `location.hash`, whose entries share no id, so a
  second tap after a reload would be taken for the same visit.
- **If wrong**: give Today an open state the page holds, and let the outline set it.
- **Where**: Task 7.

## R18: The core counts a settled group's points, and a group without any draws nothing

- **Decision**: `SettledGroup.points` gives how many items of a group's lists start in bold, by the
  rule that finds `settledPoints`; the outline's rows and the panes' counts read it. A Behaviour or
  Under the hood group without points draws no pane and has no row, as Check these already had none;
  "Settled without you" shows only over a group that draws.
- **Rationale**: the page and the outline each counted every item, while only items starting in bold
  are points that take comments; a count kept in the core is one rule, not a second reading of the
  lists. A group drawn by the page and missing from the outline, or the other way, left a part the
  outline could not reach.
- **Alternatives considered**: a web helper grouping `settledPoints` by the list each lies in, which
  rebuilds in the page what the core already knows.
- **If wrong**: draw empty groups again, and give them their row with a count of 0.
- **Where**: Tasks 6 and 7, fixed in their review.

## R19: An outline row's name says its state in words

- **Decision**: a question's row shows ✓ or ○ before its id, hidden from its name, which ends with
  "(answered)" or "(unanswered)", hidden from the eye.
- **Rationale**: a name starting with a glyph reads as "check mark Q2" or "white circle Q3" and
  sorts every row under two letters a screen reader's row search cannot type.
- **Alternatives considered**: the state as the row's description, which Astryx's `ListItem` has no
  prop for.
- **If wrong**: drop the hidden words and let the glyph be read.
- **Where**: Task 7, fixed in its review.

## R20: The phone keeps its list of questions under the block

- **Decision**: on narrow screens, a round waiting for answers still lists its questions under its
  block, before its context, as the questions-first change asked; `RoundIndex` moves from the
  deleted `RoundNav.tsx` into `RoundOutline.tsx` and draws the outline's question rows, with their
  names of R19. The status line's count opens the whole outline in a sheet.
- **Rationale**: the spec does not remove that list, and the
  [questions-first change](/specs/done/2026-10-17-questions-first.md) was the human's request: a
  phone shows every question before the first is answered. Deleting `RoundNav.tsx` would have
  dropped it silently.
- **Alternatives considered**: the outline's sheet alone, as the mockup draws the phone, which
  undoes a merged request no spec revisited.
- **If wrong**: drop `RoundIndex` and its three tests in `round.test.tsx`.
- **Where**: Task 8.

## R21: `n` and `p` are the page's, whatever the column's tab

- **Decision**: the round page's column registers `n` and `p` on wide screens (`useBlankKeys` in
  `RoundOutline.tsx`), not the outline: they work with Notes or Session open. `RoundOutline`'s
  `isActive` now only makes it follow the page's scroll, and Next or Submit is `NextOrSubmit`,
  shared by the outline and the phone's status line.
- **Rationale**: the clarifications' answer A says "the status line and `n` still work" with the
  session open, and the settled point keeps the keys "as today"; the Outline tab's panel is not
  mounted while another tab shows.
- **Alternatives considered**: the keys in the outline, lost whenever another tab opens.
- **If wrong**: register the keys in `RoundOutline` again, with `isActive`.
- **Where**: Task 8.

## R22: The notes' field is drawn in the Notes tab or sheet only

- **Decision**: the notes' field, "Anything else", with its Save notes, its images, and its restore
  notice, is drawn only in the column's Notes tab, or the phone's Notes sheet; the round's end, a
  region "Notes", shows the notes as typed, read-only, with "Unsaved changes" while unsaved, and
  "Edit notes" or "Write a note", which opens the tab, or the sheet, its field focused. An image
  dropped with no field focused still goes to the notes: it opens them, and the field adds it once
  drawn (`useNotesDrop`). The tests that type in the notes open `?tab=notes`.
- **Rationale**: the spec's assumption: "The round's end shows the notes read-only, with 'Edit
  notes'"; the field is one, held by the page above the column (`useRoundNotes`), so its text stays
  as the tab, the sheet, or the width changes.
- **Alternatives considered**: a second field at the round's end, two fields over one text.
- **If wrong**: draw `NotesField` in `RoundEnd` again, beside the tab's.
- **Where**: Task 8.

## R23: Asking, Edit notes, and an image for the notes unfold the column

- **Decision**: with the round's column folded, "Ask the agent", "Ask", "Edit notes", "Write a
  note", and an image dropped for the notes unfold it, then open their tab: Session with the quote
  and its composer focused, or Notes with its field focused. The fold stays kept for every round,
  unfolded from then on. The page holds the column's width and fold (`useRoundActions`' `column`),
  so the notes' drop target and field know whether their tab shows.
- **Rationale**: the fold was the human's own, but US3 is "the question still beside" the answer,
  and SC-002 measures an open column; an ask that only set `?tab=` showed nothing, its quote in a
  hidden draft, and the focus found nothing.
- **Alternatives considered**: keeping the fold and opening the session's page, as on the phone,
  which leaves the round the spec keeps beside the answer.
- **If wrong**: drop `column.setShown(true)` from `useRoundActions`' `openTab`.
- **Where**: Task 8, fixed in its review.

## R24: On the phone, a selectable block's bar takes no room

- **Decision**: on narrow screens, a block a tap selects, as a settled point or a block of a spec
  under review, has no border nor inset of its own; once selected, its bar is a shadow in the gap
  before its text, and its tint behind the text. Its text starts at the paragraphs' edge, as every
  list's does (R9, R11).
- **Rationale**: the selectable box's 4.8 px bar and 4.8 px inset set Check these, Behaviour, and
  Under the hood about 9 px in from the paragraphs on the phone, though they are the documents' own
  hanging list; the spec's assumption has lists lose no width. A border's width rounds to whole
  pixels in WebKit, so a margin cannot take it back exactly; a shadow takes no room.
- **Alternatives considered**: no tap selection on settled points, which their buttons would cover,
  but which the settled tests and the review's keyboard toggle rely on; the bar hung by a negative
  margin, 0.8 px off at WebKit's rounding.
- **If wrong**: drop `selectableNarrow` and `selectedNarrow` in `Selection.tsx`.
- **Where**: the final fix pass.

## R25: Every document's paragraphs are reading text

- **Decision**: `Blocks` draws a paragraph through `Prose`'s reading styles, as it already drew a
  list item: the reading font, size, and line. Every page that draws a document's blocks follows,
  beyond the round: a spec, a plan, a decision and the constitution, a proposal, a record, and a
  session's quoted blocks. Headings, code, badges, and controls keep the monospace font.
- **Rationale**: the UI coherence decision has reading text drawn through `Prose`, and the UI look
  decision a proportional font for long prose; the theme's base styles set every `<p>` in the UI's
  monospace font, so a pane's paragraphs read in the monospace font beside its lists in the reading
  font.
- **Alternatives considered**: the reading font on the round's paragraphs only, which leaves every
  other document mixed, against the coherence decision's one component per kind of information.
- **If wrong**: drop `proseStyles.reading` from the paragraph in `Blocks.tsx`: every document's
  paragraphs go back to the monospace font at the reading size. The spec page's own rows, a story's
  scenarios, a tradeoff's or an edge case's text, and its opening's items, which do not draw through
  `Blocks`, still read in the monospace font beside them.
- **Where**: the final fix pass, commit 49f48958; its screenshots, `documents-*`.
