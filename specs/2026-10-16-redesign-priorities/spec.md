---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Redesign home, inbox, and priorities

> [!IMPORTANT]
>
> Spec to review, about 35 minutes.
>
> - One changed decision,
>   [UI behaviour](../decisions/ui-behaviour.md#proposed-change-2026-10-16-redesign-priorities):
>   opening an item never puts the cursor in a field, and every list with a pane moves with ↑ ↓ or j
>   k.
> - Your Q4 answer read: the pane opens to read, with Edit and "Open draft" at its top. "Open draft"
>   opens the draft's full page; an entry without a draft has no such button. Say if you meant a
>   full-page view of the pane itself.
> - Your Q5 answer: the question was about editing an existing entry's child bullets from its pane.
>   With B, only the first line is edited; children stay editable in the file only.
> - Started entries go to the top of Now, then a blank line, as you asked in Q7: `ura start`, the
>   web UI's Start, and the skill change. Entries started before stay where they are until their
>   features finish.
> - The core changes in five places, none of a file's format: entries say which draft and feature
>   they have, a draft takes its line's children, notes get children and an order, an add can commit
>   alone, and a new reader serves the constitution and decisions with each file's last change date.
> - Risk tier `medium`, for the core changes and the new start position; the plan does not wait for
>   your review.
> - This branch starts from before basic security: the plan's first task merges the default branch.
>   Your local `main` and `origin/main` have diverged, so settle which one is the default first.

Home becomes a control hub, the priorities and inbox pages become one list with handles, colours,
and keyboard navigation, editing starts from a pane that opens to read, a ＋ can add and commit at
once, a draft takes its line's children, and a new page shows the constitution and decisions. It is
for the human organizing the work, every few days, from a desktop or a phone. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Open and edit an entry from its pane (P1)

A click on a priority or a note opens its pane on wide screens, or its page on a phone, to read: the
entry rendered, nothing focused. An Edit button at the pane's top edits the line in place; "Open
draft" opens the entry's draft on its own page.

[A priority's pane, reading](/packages/web/src/pane/EntryPane.stories.tsx#Reading)

[A priority's pane, editing](/packages/web/src/pane/EntryPane.stories.tsx#Editing)

Why this priority: it is the path the human uses most, and it was four clicks with its commit.

Acceptance scenarios:

1. **Given** the priorities page at 1440 px, **When** the human clicks the Next entry "Git listener
   process", **Then** its pane opens beside the list with "Next · 2 of 2", the entry's text, its
   draft drawn, and the buttons "Edit" and "Open draft", and no text field has the focus.
2. **Given** that pane, **When** the human clicks "Edit", **Then** the line becomes a one-line field
   holding `[Git listener process](drafts/git-listener.md)`, with the cursor in it, "Save",
   "Cancel", and "Enter saves · Escape cancels".
3. **Given** the field with its text changed to "Git listener", **When** the human presses Enter,
   **Then** the entry reads "Git listener" in the list and the pane, the field closes, and the
   commit bar says "1 change to commit".
4. **Given** that pane, **When** the human clicks "Open draft", **Then** the draft
   `specs/drafts/git-listener.md` opens on its own page, in its editor.
5. **Given** the inbox at 1440 px, **When** the human clicks the note "We need a home icon",
   **Then** its pane opens with "Note, in No category", the note rendered with its children, and
   "Edit", and no text field has the focus.
6. **Given** a phone at 402 px, **When** the human taps the entry "Git listener process", **Then**
   its page opens to read, with "Edit" at its top, and the keyboard does not open.
7. **Given** a Now entry whose feature is started, **When** the human opens it, **Then** its pane
   shows "Running", the feature's step, and "Open the feature", and no section picker.

[A running entry's pane](/packages/web/src/pane/EntryPane.stories.tsx#Running)

[A note's pane](/packages/web/src/pane/EntryPane.stories.tsx#Note)

### US2: Move through a list with the keyboard (P1)

On the priorities, the inbox, and the decisions page, ↑ ↓ or j k move the selection and the pane
follows; Enter edits; Escape closes the field, then the pane. A hint shows the keys once.

[The priorities, a row selected](/packages/web/src/lists/WorkList.stories.tsx#Selected)

Why this priority: the human asked for it to go through a list of thirty priorities quickly.

Acceptance scenarios:

1. **Given** the priorities page at 1440 px with the pane of Now's first entry open and the focus on
   its row, **When** the human presses ↓, **Then** the second Now entry is selected, its row
   highlighted and focused, and the pane shows it, at the address `/priorities/<its key>`.
2. **Given** the last Now entry selected, **When** the human presses j, **Then** the first Next
   entry is selected: the keys cross sections.
3. **Given** a selected entry, **When** the human presses Enter, **Then** the pane's field opens,
   with the cursor in it; ↓ then moves the cursor, not the selection.
4. **Given** that field with its text unchanged, **When** the human presses Escape, **Then** the
   field closes and the focus goes back to the row; a second Escape closes the pane.
5. **Given** a selected entry, **When** the human presses End, **Then** the last entry of Blocked is
   selected; Home selects Now's first.
6. **Given** a first visit to the priorities page, **When** it opens, **Then** the hint "↑ ↓ or j k
   to move · Enter to edit · Esc to close" shows above the list until the human uses a key or closes
   it, and never again in that browser.
7. **Given** the inbox, **When** the human presses k on its second note, **Then** its first note is
   selected and its pane follows.

### US3: Add and commit from ＋ (P1)

The ＋ forms next to Priorities and Inbox in the sidebar have "Add and commit", the default on
Enter, beside "Add". "Add and commit" commits that file alone.

[New priority](/packages/web/src/QuickAdd.stories.tsx#Priority)

[New note](/packages/web/src/QuickAdd.stories.tsx#Note)

Why this priority: adding a priority from the phone's home took six taps to commit.

Acceptance scenarios:

1. **Given** a clean `PRIORITIES.md` and the "New priority" form with "Sort done features" and Next,
   **When** the human presses Enter, **Then** the entry is the last of Next, committed alone as
   `chore: add "Sort done features" to Next`, and a toast says "Added to Next and committed" with
   Undo.
2. **Given** the same form, **When** the human taps "Add", **Then** the entry is written, not
   committed, and the toast says "Added to Next, not committed", as today.
3. **Given** `PRIORITIES.md` with an uncommitted edit, **When** the human uses "Add and commit",
   **Then** the entry is written, nothing is committed, and the form's place shows "Added to Next.
   Not committed: PRIORITIES.md has other changes to commit or discard."
4. **Given** a clean `INBOX.md`, **When** the human adds the note "Icons are blurry" with "Add and
   commit", **Then** it is committed alone as `chore: add "Icons are blurry" to the inbox`.
5. **Given** a phone on home, **When** the human opens the navigation, taps ＋ next to Priorities,
   types a line, and taps "Add and commit", **Then** the entry is committed: four taps and the
   typing.
6. **Given** a committed add, **When** the human taps Undo within 5 seconds, **Then** the entry is
   removed and that removal is committed with `chore: remove "Sort done features"`.

[Added, not committed](/packages/web/src/QuickAdd.stories.tsx#NotCommitted)

### US4: See what is running and drafted in the priorities (P2)

Sections show in their colour with a separator: Now blue, Next neutral, Later grey, Blocked orange.
In Now, started entries come first in the file, then a blank line, then the rest. A started entry
shows "Running" in green and its feature's step, without a handle. An entry linking a draft shows
"Draft", one linking a backlog file "Backlog".

[The priorities](/packages/web/src/lists/WorkList.stories.tsx#Priorities)

Why this priority: looking at the priorities should help organize the remaining work.

Acceptance scenarios:

1. **Given** the fixture's Now, four entries linking started features, **When** the priorities page
   opens, **Then** each shows "Running" and its step, like "Plan" for "CLI TUIs", and no handle.
2. **Given** the Next entry "Git listener process" linking `drafts/git-listener.md`, **When** the
   page opens, **Then** it shows "Draft".
3. **Given** an entry linking `drafts/missing.md`, a file that does not exist, **When** the page
   opens, **Then** it shows no "Draft" mark.
4. **Given** a Now of "A", then a blank line, then "B", with "A" started, **When** the human starts
   the draft of "B" as `2026-10-17-b`, **Then** Now reads "A",
   `[B](/specs/2026-10-17-b/proposal.md)`, a blank line, then the rest.
5. **Given** a Now with no started entry, **When** the human starts a Next draft, **Then** its entry
   is the first of Now, followed by a blank line before the other entries.
6. **Given** a Now with started entries on top, **When** the human drops a Now entry above them,
   **Then** it lands right after the last started entry.

### US5: Organize the inbox like the priorities (P2)

The inbox uses the priorities' list: category headings with counts and separators, the same handles,
a note's children under it. Notes drag within and across categories, by the handle, a 500 ms press
on touch, or the keyboard.

[The inbox](/packages/web/src/lists/WorkList.stories.tsx#Inbox)

Why this priority: the human asked for the two pages to look and behave alike.

Acceptance scenarios:

1. **Given** the inbox with "UI · 5", **When** the human drags its third note above its first,
   **Then** `INBOX.md` holds it first in UI, and the commit bar's message is
   `chore: move "<note>" within UI in the inbox`.
2. **Given** a note in UI, **When** the human drags it to the end of CLI, **Then** it is the last
   note of CLI, as "move to CLI" does today.
3. **Given** a note with two children, **When** the inbox opens, **Then** both show under it as grey
   lines, and they move with it.
4. **Given** a note's handle focused, **When** the human presses Space, ↓, Space, **Then** the note
   moves one place down, as the priorities' keyboard drag does.

### US6: A draft takes its line's children (P2)

Draft, on a priority with children, writes them into the draft's What, after the line, and leaves
the entry as the link alone.

Why this priority: the children are the first notes of the feature, and belong in its draft
([Q10](clarifications-01.md#q10-what-happens-to-a-prioritys-children-when-it-becomes-a-draft)).

Acceptance scenarios:

1. **Given** the Later entry "Nix + Docker based execution environments" with the child "with a
   cache", **When** the human drafts it, **Then**
   `specs/drafts/nix-docker-based-execution-environments.md` has the title "Nix + Docker based
   execution environments", and its What holds the line, a blank line, then "- with a cache"; the
   entry is
   `[Nix + Docker based execution environments](drafts/nix-docker-based-execution-environments.md)`,
   with no child.
2. **Given** a child linking `/specs/decisions/git.md`, **When** the entry is drafted, **Then** the
   link still resolves from the draft.
3. **Given** a drafted entry, nothing committed, **When** the human discards on the commit bar,
   **Then** the draft is deleted and the entry has its children back.

### US7: Home as a control hub (P2)

Home shows four counts, then two columns of cards on wide screens, one column on the phone: what
needs you and the agents at work, then the priorities, the inbox, the latest done features, and a
way to the constitution and decisions.

[Home](/packages/web/src/Home.stories.tsx#Hub)

Why this priority: home is the first page of every visit, and the human found it "a list of grey
bullet points".

Acceptance scenarios:

1. **Given** the fixture, **When** home opens at 1440 px, **Then** it shows the counts "Needs you
   4", "Agents 4", "Now 4", and a grey "Inbox 10", then "Needs you" and "Agents at work" on the
   left, "Priorities", "Inbox", "Recently done", and "Constitution and decisions" on the right.
2. **Given** home, **When** the human looks at "Priorities", **Then** it lists Now's entries,
   started ones with their step, and "Now" is picked in its "Now | Next" control.
3. **Given** home, **When** the human picks "Next", **Then** the card lists Next's entries, drafted
   ones marked "Draft", and home opens on "Next" after a reload.
4. **Given** home, **When** the human clicks the "Priorities" title, **Then** the priorities page
   opens; the "Inbox" title opens the inbox.
5. **Given** the inbox card, **When** home opens, **Then** it shows the categories with their counts
   and the three latest notes, and no "Organize" link.
6. **Given** seven done features, **When** home opens, **Then** "Recently done" lists the five
   latest and "Show all (7)", which lists all seven in place.
7. **Given** nothing waits on the human, **When** home opens, **Then** "Needs you" says "Nothing
   waits on you."
8. **Given** a phone at 402 px, **When** home opens, **Then** the counts are two by two, and the
   cards follow in one column in the same order.

### US8: Read the constitution and decisions (P3)

A new page, opened from home, starts with the constitution's principles as compact cards, then lists
the decisions, each by its title and first sentence, sorted by latest change first. A click opens
the principle or decision to read in a pane, or its page on a phone; the arrows move through the
items.

[The decisions](/packages/web/src/decisions/DecisionsPage.stories.tsx#List)

[A decision open](/packages/web/src/decisions/DecisionsPage.stories.tsx#Decision)

[A principle open](/packages/web/src/decisions/DecisionsPage.stories.tsx#Principle)

Why this priority: it is new, and the human reads the rules less often than the work.

Acceptance scenarios:

1. **Given** this repository, **When** the human opens "Constitution and decisions", **Then** the
   page shows "Constitution", "Version 1.3.1 · Ratified 2026-10-07 · Last amended 2026-10-14", six
   principle cards from "I. Humans stay in control" to "VI. Code is checked and stays maintainable",
   then "Decisions · 15", the latest changed first.
2. **Given** the list, **When** the human picks "A to Z" in the sort control, **Then** the decisions
   are in alphabetical order of their titles, from "Agents", and the choice stays after a reload.
3. **Given** the list at 1440 px, **When** the human clicks "UI behaviour", **Then** its pane shows
   its title, "Active", "Approved by mrtolkien", its summary, and its sections, read-only, at
   `/decisions/ui-behaviour`.
4. **Given** the list, **When** the human clicks "IV. Review effort matches impact", **Then** its
   pane shows its rules, its rationale, and the version line, at `/decisions/constitution/iv`.
5. **Given** the pane of principle VI, **When** the human presses ↓, **Then** the first decision is
   selected and shown: the keys go from the principles to the decisions.
6. **Given** a spec linking `../decisions/git.md`, **When** the human clicks the link, **Then** the
   decision opens on this page, not as raw text.
7. **Given** a decision with `status: proposed`, **When** the list opens, **Then** its row shows
   "Proposed".

[Sorted A to Z](/packages/web/src/decisions/DecisionsPage.stories.tsx#SortedAToZ)

## Edge cases

- **An empty inbox**: home's inbox card says "The inbox is empty."; the Inbox count shows 0 in grey.
- **An empty section** of the priorities: home's card says "Nothing in Now." or "Nothing in Next.";
  on the priorities page its heading shows "Later · 0" with its "＋ Add to Later" row; the keys skip
  it.
- **Now holding only started entries**: no blank line is written after them.
- **A started entry whose feature is done**, before its branch removed it: it is no longer
  "Running", and gets its handle back.
- **A change, not a feature**, started: it is "Running" too, with its step.
- **Unsaved text in a pane's field when ↓ is pressed**: the keys do not act, since a field has the
  focus; after Escape, the "Discard" or "Keep editing" question comes first, as the UI behaviour
  decision asks.
- **Clicking another row while a field holds unsaved text**: the new pane opens; the text stays in
  the browser and comes back with its notice when that entry opens again.
- **Dragging while a live update arrives**: the update waits until the drop, as today, on both
  pages.
- **"Add and commit" with other files staged** in the checkout: only `PRIORITIES.md` or `INBOX.md`
  is committed; the staged files stay staged.
- **"Add and commit" when the commit's hooks fail**: the entry stays written, uncommitted, and the
  form shows the hook's error, with "Commit failed: <first line of the error>".
- **Undo of a committed add when the file changed since**: the core refuses with its conflict
  message, and the toast's error stays on screen, as today's Undo does.
- **A decisions folder with no decision**, or no `CONSTITUTION.md`: the page says "No decisions
  yet." or "No constitution yet." in place of the region.
- **A decision without an H1** or a summary: its file name, `git`, stands as the title, and the row
  has no subtitle.
- **A decision edited while open**: the pane updates live, keeping its scroll.
- **A priority without children drafted**: the draft is as today.
- **Discard after a draft from a note and one from a priority**: both drafts are deleted, both
  sources restored.
- **The keyboard hint closed with its ×**: it never shows again in that browser, on any list.

## Success criteria

- **SC-001**: Editing a priority's text and saving it takes three actions from the list: click the
  row, click Edit, press Enter after typing.
- **SC-002**: Adding a priority and committing it takes four taps from the phone's home, typing
  aside.
- **SC-003**: Going from the first to the tenth priority with the pane following takes nine key
  presses.
- **SC-004**: Home, the priorities, the inbox, and the decisions pass `vp run ready`'s layout and
  accessibility checks at 402 × 874 and 1440 × 900, in light and dark.
- **SC-005**: Opening any entry, note, principle, or decision leaves the focus outside every text
  field.

## Architecture

The pages stay views of the core's data, as the [stack](../decisions/stack.md) decision asks: every
rule about files, links, and the workflow lives in Rust, and the web UI draws what it gets. The
changes split into three layers, built in this order: the core and its binding, the shared list and
pane, then the pages that use them.

- **The core says what each entry is.** The priorities record's entries gain the draft or backlog
  file they link, when it exists, and the feature they run, with its step, from the workspace's
  matching that already exists ([rules and their owners](discovery-01.md#rules-and-their-owners)).
  Notes gain their children. The UI never joins two records to guess.
- **New core actions**: a note moved to a place; an add that commits its file alone, with the same
  rule as `ura note`; a draft that takes its line's children; a start that writes its entry at the
  top of Now. The constitution and decisions get a reader, with each file's last change date read
  through the core's git module, as the [git](../decisions/git.md) decision asks.
- **One list for every list with a pane** (`WorkList`): headings with counts and colours, rows with
  handles and marks, children, dragging through `@dnd-kit/react`, and the keyboard of the changed
  [UI behaviour](../decisions/ui-behaviour.md#proposed-change-2026-10-16-redesign-priorities)
  decision. The priorities and the inbox use it with their own sections; the decisions page uses its
  keyboard and selection without handles.
- **One pane for an entry or a note** (`EntryPane`): a top bar with the place, Edit, "Open draft",
  and Close; a body to read; the line's field in place when editing. `TaskView` and `NoteView`
  become its two bodies.
- **Home** is rebuilt from cards, each a small component reading the workspace and inbox records.
- **Files near their limit** are split first, each in a commit that only restructures it: the
  router, the data hooks, the priorities page, and the task view's long function
  ([likely changes](discovery-01.md#likely-changes)).

Tradeoffs: the priorities record now depends on the workspace, so it is re-read when features
change, not only when `PRIORITIES.md` does; one shared list costs a refactor of both pages, against
two pages that drift apart again.

## Mockups

Storybook stories, as the [preview](../decisions/preview.md) decision asks. Those of home, the
lists, and the panes run on the fixture repository's real data; the decisions page's take its data
as arguments, from this repository's files, since no server reads them yet.

- [Home](/packages/web/src/Home.stories.tsx#Hub): the control hub, the counts and the two columns.
- [The priorities](/packages/web/src/lists/WorkList.stories.tsx#Priorities): sections in colour,
  running entries first, drafts marked.
- [A row selected](/packages/web/src/lists/WorkList.stories.tsx#Selected): selection, focus, and the
  keyboard hint.
- [The inbox](/packages/web/src/lists/WorkList.stories.tsx#Inbox): the same list for notes, with
  their children.
- [Pane, reading](/packages/web/src/pane/EntryPane.stories.tsx#Reading): a drafted entry, Edit and
  "Open draft".
- [Pane, editing](/packages/web/src/pane/EntryPane.stories.tsx#Editing): the line in place, unsaved.
- [Pane, running](/packages/web/src/pane/EntryPane.stories.tsx#Running): a started entry.
- [Pane, note](/packages/web/src/pane/EntryPane.stories.tsx#Note): a note with its children.
- [New priority](/packages/web/src/QuickAdd.stories.tsx#Priority) and
  [new note](/packages/web/src/QuickAdd.stories.tsx#Note): "Add and commit" and "Add".
- [Added, not committed](/packages/web/src/QuickAdd.stories.tsx#NotCommitted): the file had other
  changes.
- [Decisions](/packages/web/src/decisions/DecisionsPage.stories.tsx#List),
  [a decision](/packages/web/src/decisions/DecisionsPage.stories.tsx#Decision),
  [a principle](/packages/web/src/decisions/DecisionsPage.stories.tsx#Principle), and
  [sorted A to Z](/packages/web/src/decisions/DecisionsPage.stories.tsx#SortedAToZ).

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The inbox's count counts notes, in grey, hidden at zero; home's "N notes to organize" row becomes
  the inbox card. With B in Q2, the count goes in the sidebar with the interface redesign, and a
  note in the inbox's UI category holds the review of both, as you asked.
- Home's "Recently done" shows the five latest, with "Show all (N)" in place.
- On the phone, a tap opens an entry's page to read; with C in Q4, this is now the rule on every
  width.
- Drafted and backlog entries are marked only when their file exists, from the core.
- Section colours come from Astryx's tokens, with their words always there; the look and feel pass
  may refine them.
- The selected row is highlighted, the focused one has the focus ring.
- The pane keeps its section picker, draft area, Delete with Undo, and ‹ Previous / Next ›.
- The decisions page lives at `/r/<repository>/decisions`, and links to decisions and to the
  constitution open there instead of the raw file.
- Live updates follow a change to a child line, and to a decision or the constitution.
- Files near their limit are split first.
- Mockups are stories, the picked home variant becoming its first commit.
- The keys act only outside text fields; a switch to turn them off can come with the settings page.

Settled while writing this spec:

- **"Open draft"** is the reading of your "Fullscreen / Draft view" button: it opens the draft's own
  editor page, as Edit on a draft does today. An entry without a draft has "Draft" in its body
  instead ([Q4](clarifications-01.md#q4-what-does-a-click-on-a-priority-or-a-note-open)).
- **Single-line editing**: with B in Q5, Edit changes an entry's or a note's first line only; its
  children are shown, not edited.
- **Started entries on top**: `ura start`, the web UI's Start, and a change's start write the entry
  after the last started entry at the top of Now, or as Now's first followed by a blank line. A
  started entry is one linking `/specs/<dated folder>/proposal.md` or
  `/specs/changes/<dated folder>/proposal.md`, the link start writes. Entries started before this
  feature are not moved: they leave Now as their features finish
  ([Q7](clarifications-01.md#q7-how-does-running-work-stand-apart-in-the-priorities)).
- **No handle on running entries**, since moving the line does not move the branch, and a drop above
  them lands after them.
- **Home's priorities card** lists Now or Next, from a "Now | Next" control kept in the browser; its
  title opens the priorities page, the inbox card's title the inbox, and "All priorities" and
  "Organize" rows are gone ([Q3](clarifications-01.md#q3-how-should-home-look)).
- **Home reaches the decisions page** through a "Constitution and decisions" card, until the sidebar
  gets its row with the interface redesign.
- **The decisions' sort** offers "Latest change first", the default, "Latest change last", and "A to
  Z", kept in the browser; a decision's first sentence is its summary's first sentence
  ([Q11](clarifications-01.md#q11-how-do-the-constitution-and-decisions-show)).
- **Latest change** is the date of the last commit touching the file on the default branch.
- **The decisions page shows the default branch only**: a branch's proposed changes stay for the
  specs redesign.
- **The focus ring is fixed at its source**: today no list row shows a keyboard focus ring, since
  [`Selection.tsx`](/packages/web/src/Selection.tsx)'s `outlineStyle: "none"` compiles to the class
  Astryx uses, outside Astryx's CSS layer, and wins over its ring; a similar override keeps a
  divider under every list's last row. US2 needs the ring, so the feature fixes both where they come
  from, not around them in each list.
- **A running entry's step** reads as the workflow names it for the human when it waits on them,
  "Answer questions", "Review the spec", or "Review the plan", and as the step's label otherwise,
  like "Plan".
- **Committed adds have Undo** too, which commits the removal, so the toast's promise holds.
- **The skill follows**: [projects](/skills/uraeda/references/projects.md) says a draft takes its
  line's children and start writes at the top of Now; [inbox](/skills/uraeda/references/inbox.md)
  says the web UI's ＋ can commit alone, a note can move within its category, with its commit
  message, and a triage's change is linked from the top of Now. The template and the example
  `PRIORITIES.md` show a started entry on top. The
  [conventions](/skills/uraeda/references/conventions.md) list the new message,
  `move "<note>" within <Category> in the inbox`.

## Decisions

Changed, applied when this spec is approved:

- [UI behaviour](../decisions/ui-behaviour.md#proposed-change-2026-10-16-redesign-priorities):
  opening an item never puts the focus in a text field, and a list with a pane moves its selection
  with ↑ ↓ or j k, Home and End, Enter, and Escape.

Relied on:

- [Stack](../decisions/stack.md): the core owns links, drafts, running features, and the reading of
  decisions; the UI draws the core's document tree for decisions and principles.
- [Git](../decisions/git.md): `PRIORITIES.md` and `INBOX.md` are written on the default branch; file
  dates are read with gix through the core's git module; commits go through `git` with the hooks.
- [UI components](../decisions/ui-components.md): Astryx components, StyleX with tokens, dragging
  with `@dnd-kit/react`.
- [UI layout](../decisions/ui-layout.md): panes beside lists on wide screens and pages on the phone;
  each view at both widths, its layout justified below.
- [UI checks](../decisions/ui-checks.md): tests guard this spec's scenarios; screenshots at both
  sizes and themes before handing over.
- [Preview](../decisions/preview.md): the mockups are stories.
- [Code quality](../decisions/code-quality.md): files and functions within limits, split first.

Why each layout reads best, as the UI layout decision asks: home is glanced at, so its counts come
first and its cards let the eye jump to what changed; the lists are worked through, so the pane sits
beside them and the keyboard drives both; the decisions are read, so the pane holds the text and the
list keeps the whole ledger in view.

## Constitution check

| Principle                                  | Complies | Notes                                                                                        |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | Every add, move, and draft is the human's; commits only on their button.                     |
| II. Git and plain text first               | yes      | No format change; the blank line in Now is plain markdown.                                   |
| III. Asynchronous by default               | yes      | Nothing new held in memory; choices kept in the browser are display preferences.             |
| IV. Review effort matches impact           | yes      | The decisions page makes the rules readable.                                                 |
| V. Tools are optional                      | yes      | The skill states each new rule, so a human or agent follows them without the UI.             |
| VI. Code is checked and stays maintainable | yes      | One list and one pane instead of two; files near their limits split first; scenarios tested. |

## Risk tier

**Medium**: core actions change where start writes and what a draft holds, and a new reader is
added, without any change to a file's format.

## Details

### Data

Core, through the binding's generated types:

- `EntryItem` gains `draft: Option<LinkedFile>` and `running: Option<RunningFeature>`.
  - `LinkedFile { path: String, backlog: bool }`: the linked file under `specs/drafts/` or
    `specs/backlog/`, set only when it exists on the default branch; a folder's `proposal.md`
    counts.
  - `RunningFeature { folder: String, change: bool, step: StepView }`: the feature or change the
    entry's link matches, set while its step is not `done`.
  - The priorities record is read with the workspace; it is pushed again when either changes.
- `InboxNote` gains `nested: Vec<String>` and `nested_spans: Vec<Vec<Span>>`, as `EntryItem` has.
- New actions, each taking the file's hash and refusing a stale one, as today:
  - `inbox::place(id, category, position)`: moves a note to a place in a category. Its change reads
    `move "<note>" within <Category> in the inbox` in the same category, and the existing
    `move "<note>" to <Category> in the inbox` across.
  - `add_priority(section, text, commit: bool)` and `add_note(text, category, commit: bool)`: with
    `commit`, they commit the file alone, by its path, when it had no other uncommitted change, with
    `chore: add "<short>" to <Section>` or `chore: add "<note>" to the inbox`. They answer
    `{ committed: bool, reason?: "other-changes" | "hook-failed", message?: string }`.
  - The removal of a committed add, for Undo, commits with `chore: remove "<short>"` or
    `chore: remove "<note>" from the inbox`.
- `draft_entry` passes the entry's children, dedented, links rebased from `specs/` to the draft's
  folder, as a note's draft does; `priorities::link` drops them from the entry. Discard recognizes
  such a draft as never committed, and writes the entry back with its children.
- `priorities::add_started(text, link_text, target)` replaces `add_to_now` for start: after the last
  started entry of Now's first block, or first with a blank line after it when other entries follow.
- New reader, `read_ledger(repo)`, on the default branch:
  - `Constitution { title, version, ratified, amended, principles: Vec<Principle>, document }`,
    `Principle { number: "IV", slug: "iv", title, blocks: Vec<BlockId> }`, from
    `specs/CONSTITUTION.md`'s `### <number>. <title>` headings and its `**Version**` line.
  - `Decision { name: "ui-behaviour", title, status, approved_by, summary, changed: "2026-10-16", document }`:
    `title` from the H1, `summary` the first sentence of the first paragraph, `changed` the date of
    the last commit touching the file.
- Watch: a `decisions` flag for `specs/decisions/` and `specs/CONSTITUTION.md`; the priorities and
  inbox hashes cover child lines.

Browser, kept in `localStorage`: `uraeda:home:priorities` (`now` or `next`), `uraeda:decisions:sort`
(`changed-desc`, `changed-asc`, `title`), `uraeda:hint:lists` (seen).

### Components

- **WorkList** (`packages/web/src/lists/`): sections of rows, each heading "<Title> · <count>" with
  its colour and a separator; rows as links, with the handle "⠿", labelled "Move <text>", the text,
  children as grey lines, and marks ("Running" and its step, "Draft", "Backlog", the inbox's "agent"
  and slug); the keyboard of US2 through Astryx's `useListFocus`; dragging through `@dnd-kit/react`,
  as the priorities page does today; the one-time hint with "↑ ↓ or j k to move · Enter to edit ·
  Esc to close" and a close button. Used by the priorities, the inbox, and, without handles, the
  decisions.
- **EntryPane** (`packages/web/src/pane/`): a top bar, "Now · 2 of 4" or "Note, in UI", then "Edit",
  "Open draft" when a draft exists, and "Close" on wide screens; a body to read; the line's field in
  place, from `EditableLine`'s `LineField`. Its bodies: `TaskView`'s (draft, section picker, Delete,
  Previous and Next; or "Running", the step, and "Open the feature") and `NoteView`'s (category,
  Organize, Delete).
- **PrioritiesPage** and **InboxPage**: their titles, the commit bar, and a `WorkList`.
- **QuickAdd** and **SidebarAdd**: "Add and commit" (primary, Enter) and "Add"; the toasts "Added to
  <Section> and committed", "Added to the inbox and committed", or the line "Added to <Section>. Not
  committed: PRIORITIES.md has other changes to commit or discard." (`INBOX.md` for a note).
- **Home** (`packages/web/src/home/`): the counts, then the cards "Needs you", "Agents at work",
  "Priorities" with "Now | Next", "Inbox", "Recently done" with "Show all (N)", and "Constitution
  and decisions", with "The project's principles and the choices agents follow".
- **DecisionsPage** (`packages/web/src/decisions/`): "Constitution and decisions"; "Constitution"
  with its version line and principle cards; "Decisions · N" with the sort control, "Latest change
  first", "Latest change last", "A to Z"; rows with the title, the summary, the date, and "Proposed"
  when so; the pane drawing the document with `Blocks`, read-only. Routes `/decisions`,
  `/decisions/<name>`, `/decisions/constitution/<slug>`.
- **Links**: `pathLink` sends `specs/decisions/*.md` and `specs/CONSTITUTION.md` to the decisions
  page.
- **Core, binding, server**: the actions and reader above, their napi exports, fate sources and
  mutations (`priorities.add` and `inbox.add` with `commit`, `inbox.place`, the `ledger` record).

### Error handling

- **A stale file** on a move, an add, or a draft: the existing conflict message, "PRIORITIES.md
  changed since this page loaded. Reload to see it.", kept on screen.
- **"Add and commit" refused** by other changes: the line of US3's third scenario, in the form,
  until it closes.
- **A hook failure** on "Add and commit": "Commit failed: <first line of the hook's output>", in the
  form; the entry stays written.
- **A decision that cannot be parsed**: its row shows its file name and "Can't read this file", and
  its pane the core's first problem.
- **The ledger unreadable**, like a repository without `specs/`: the page's banner, as home's today.

### Testing

Integration tests run as today: happy-dom tests render the app with `renderPage` over a fresh copy
of the fixture repository and the real server, and browser tests drive WebKit for the keyboard,
dragging, and layout; core tests run each action on fixture text and on a temporary repository.

| What                              | Test                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| US1 scenarios 1–7, SC-001, SC-005 | happy-dom: `pane.test.tsx`                                          |
| US2 scenarios 1–7, SC-003         | browser: `lists.test.tsx`                                           |
| US3 scenarios 1–6, SC-002         | happy-dom: `quick-add.test.tsx`; core: `add` with `commit`          |
| US4 scenarios 1–3                 | happy-dom: `priorities.test.tsx`; core: entry `draft` and `running` |
| US4 scenarios 4–6                 | core table test: `add_started`; browser: drop above running entries |
| US5 scenarios 1–4                 | browser: `inbox.test.tsx`; core: `inbox::place`                     |
| US6 scenarios 1–3                 | core: `draft_entry` with children, links, Discard                   |
| US7 scenarios 1–8                 | happy-dom: `home.test.tsx`; browser layout at both sizes            |
| US8 scenarios 1–7                 | happy-dom: `decisions.test.tsx`; core: `read_ledger`                |
| Edge cases                        | the test of the story each one belongs to                           |
| SC-004                            | `vp run ready`'s layout and axe checks, the four pages added        |
