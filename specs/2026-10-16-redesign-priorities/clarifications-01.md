---
status: awaiting-human
---

# Clarifications, round 01: Redesign home, inbox, and priorities

> [!IMPORTANT]
>
> 11 questions on the priorities, the inbox, home, and the decisions view, about 40 minutes.
>
> - The home's layout is a visual question: three live variants to try at both widths, with today's
>   home beside them.
> - Four items need the core, against the proposal's "no impact on the backend": children carried
>   into a draft, the inbox's children and order, a priority committed alone, and the decisions
>   view. No stored format changes.
> - The sidebar's inbox count and decisions row land in a sidebar the interface redesign is
>   reorganising; its round, still open, does not know about the decisions row yet.
> - Opening an entry with its editor focused and moving through rows with the arrow keys pull
>   against each other: the question on opening an entry and the one on the keyboard work together.
> - One answer changes an active decision: editing an entry's children in one field adds a field
>   kind to the UI behaviour decision.
> - Two answers change the skill: what a draft from a priority holds, and when a note or priority
>   added in the web UI is committed.
> - Your local `main` and `origin/main` have diverged: `origin/main` holds basic security and its
>   own start commit of this feature. This branch needs it merged before the spec's mockups.
> - 12 points are settled without you, at the end.

## Context

The [proposal](proposal.md) asks for a functional pass on the pages every piece of work starts from:
editing a priority in one click, drafted and running priorities set apart, child bullets carried
into a draft, "Add and commit", a quiet inbox count, inbox and priorities that look alike, arrow-key
navigation, a home that reads like a dashboard, and a view of the constitution and decisions.

Today, [home](/packages/web/src/Home.tsx) is one column of lists, with "N notes to organize" among
them. The [priorities page](/packages/web/src/PrioritiesPage.tsx) shows its sections as headings
with counts, no colours, and every line alike: drafted and running entries look like the rest.
Editing a line takes four clicks with its commit, and a priority added from the phone's home takes
six taps to commit, because the only Commit is the bar at the bottom of the priorities and inbox
pages. The [inbox](/packages/web/src/InboxPage.tsx) has categories, no order, and shows a note's
first line only. No page shows the constitution or the decisions, and nothing in the code reads
them.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: May this feature change the core?

The proposal says the changes "should not have any impact on the backend". Four items cannot work
without the core: a draft carrying a priority's children, a note's children and its place in its
category, a priority committed alone, and anything reading the constitution and decisions, since the
stack decision forbids the web UI from parsing markdown. None changes a file's format. More in
[discovery](discovery-01.md#the-backend-is-touched).

Why it matters: B drops four of the proposal's items; A makes the feature larger by core functions,
their binding, and their tests.

- **A (recommended). Allow small core changes that keep every file's format: the four items above,
  plus the core telling the UI which priority is drafted or running.**
  - [pro] every item of the proposal, each rule kept in the core.
  - [con] Rust, binding, and server work in a UI feature.
  - Why recommended: the proposal's items need it, and the UI guessing a running feature would copy
    a workflow rule into TypeScript.
- **B. UI only: drop the children into drafts, the inbox's order and children, the alone commit, and
  the decisions view.**
  - [pro] the smallest feature.
  - [con] four requests left out.

**Answer:**

## Q2: Which feature changes the sidebar?

The inbox count and a decisions row go in the left sidebar, which the interface redesign, on the
branch `2026-10-16-redesign-interface`, reorganises in the flow's order, with counts for Inbox and
Priorities already among its options. Its round is open, and was written before this proposal added
the decisions row "above the Done features". More in
[discovery](discovery-01.md#overlaps-with-work-in-flight).

Why it matters: both features edit the same sidebar file; whichever merges second adapts.

- **A (recommended). This feature adds the two to today's sidebar: a grey count of notes on the
  Inbox row, and a Decisions row above Done. The interface redesign keeps both in its new layout;
  mention them in its round.**
  - [pro] nothing waits; two small changes to rebase.
  - [con] the interface's round must take them in.
  - Why recommended: it keeps both features moving, with the smallest overlap.
- **B. Leave both to the interface redesign: this feature reaches the decisions page from home.**
  - [pro] one owner for the sidebar.
  - [con] no count and no decisions row until it merges.

**Answer:**

## Q3: How should home look?

Today's home is a column of grey lists. Products put what needs the user first, then work in
progress, capped, then the way into everything else, with few numbers (GitHub, Jira, Carbon's
guidance). Each variant below runs on real data, Uraeda's test repository, at both widths, and puts
the inbox in a small, neutral card. Today's home is
[here](/packages/web/src/Home.stories.tsx#Today), to compare. More in
[discovery](discovery-01.md#homes-layout).

Why it matters: home is the first page of every visit, and its look sets the tone of the next
redesigns.

- **A (recommended). A control hub: four coloured counts on top, needs you, agents, Now, and a grey
  inbox; then two columns of cards: what needs you and the agents at work on the left, Now and Next,
  the inbox, and the latest done features on the right; one column on the phone.**

  [Hub](/packages/web/src/Home.stories.tsx#Hub)

  - [pro] the most important first, and the full width used.
  - [con] cards everywhere is a common look.
  - Why recommended: it reads at a glance, and folds into one column without a second design.

- **B. The flow: four lanes in the workflow's order, collect (inbox), choose (priorities, drafted
  lines raised), build (features by step), and your turn (needs you, the one yellow lane), so the
  page reads like Uraeda itself; stacked on the phone, what needs you first.**

  [Flow](/packages/web/src/Home.stories.tsx#Flow)

  - [pro] it teaches the workflow's hierarchy.
  - [con] what needs you sits at the end of the line on a desktop.

- **C. A cockpit: a dark strip of six status lights with counts in a code font, then three dense
  panels, what needs you, agents with their step and progress gauges, and the queue of Now and Next,
  and a ticker of done features.**

  [Cockpit](/packages/web/src/Home.stories.tsx#Cockpit)

  - [pro] the most information per screen.
  - [con] dense for a newcomer, and its style may need the look and feel pass to land.

**Answer:**

## Q4: What does a click on a priority or a note open?

You asked for a click to open the pane "with the editor open". With the cursor in the field, the
arrow keys of Q6 move the cursor, not the selection, until you leave the field. Leaving it never
saves, as the UI behaviour decision asks: unsaved text stays, and moving to another row asks or
keeps it. This applies to the priorities' and the inbox's panes. More in
[discovery](discovery-01.md#clicking-opens-the-editor-and-arrows-move-the-selection).

Why it matters: it is the most frequent path, and it decides whether the arrows work right after a
click.

- **A (recommended). A click opens the pane with the field open and the cursor in it: type, then
  Enter. Escape, with nothing changed, closes the field and puts the focus back on the row, where
  the arrows move again.**
  - [pro] one click to edit, as you asked.
  - [con] one Escape before the arrows move.
  - Why recommended: editing is the standard path; browsing with the keyboard starts from the list,
    not from a click.
- **B. A click opens the pane with the field open, the focus left on the row: Enter or a click in
  the field starts typing.**
  - [pro] the arrows move at once.
  - [con] two clicks to edit with a mouse.
- **C. A click opens the pane as today; Enter or a double click opens the field.**
  - [pro] reading a line never risks editing it.
  - [con] the path you asked to shorten stays as long.

**Answer:**

## Q5: Does the editor change an entry's children too?

An entry's text is its first line; its children, like "with a cache" under a Later line, are
separate lines the core cannot edit today. Notes have children too. More in
[discovery](discovery-01.md#editing-the-text-and-an-entrys-children).

Why it matters: without it, changing a child bullet means opening the file in an editor.

- **A (recommended). One field holds the line and its children, as markdown: 7 rows, Ctrl+Enter or
  Cmd+Enter saves, Enter makes a new line. The UI behaviour decision lists this kind of field.**
  - [pro] everything of an entry edited in one place.
  - [con] Enter no longer saves a one-line edit, and the decision gains a line.
  - Why recommended: children are part of the entry, and Ctrl+Enter is the rule of every multi-line
    field already.
- **B. The first line only, Enter saves, as today.**
  - [pro] the quickest one-line edit.
  - [con] children stay out of reach.

**Answer:**

## Q6: Which keys move through the list?

Linear, Todoist, and Gmail move a highlighted row with ↑/↓ or j/k, open it with Enter, and leave
with Escape; in Linear, the preview follows the selection. The interface redesign takes `[` and `]`,
and rounds use n and p. No key acts while a text field has the focus. The rows stay links, as the
accessibility guidance asks for rows that lead somewhere. Q4 says where the focus goes after a
click. More in [discovery](discovery-01.md#keyboard-navigation).

Why it matters: it decides how fast you go through a list of thirty priorities.

- **A (recommended). ↑/↓ and j/k move the selection, and the pane follows it on wide screens; Enter
  opens the field; Escape closes the field, then the pane; Home and End go to the first and last
  row. A one-time hint shows the keys.**
  - [pro] the whole list in a few keys, like Linear.
  - [con] the pane changes at each key press.
  - Why recommended: it is what you described, with the keys users of those products already know.
- **B. ↑/↓ move the focus only; Enter opens the row's pane.**
  - [pro] the pane changes only on Enter.
  - [con] one key more per row looked at.

**Answer:**

## Q7: How does running work stand apart in the priorities?

A started feature's entry sits at the end of Now, linked to its proposal. Running cannot be a
section of the file: `ura check` requires Now, Next, Later, and Blocked. Products show "in progress"
as a status of the item more than as a group (Linear, ProductPlan). Your proposal leaves Blocked
out; it stays, last. More in [discovery](discovery-01.md#running-work-in-the-priorities).

Why it matters: running entries are a third of Now today, and they cannot be dragged like the
others, since moving the line does not move the branch.

- **A (recommended). A Running group on top, read from the core, each entry with its feature's step
  and a link to it, and no drag handle; then Now, Next, Later, and Blocked, each with its own colour
  and a separator.**
  - [pro] the separation you asked for, without changing the file.
  - [con] a group on screen that is not a heading in the file.
  - Why recommended: it gives what you asked, and the file stays the workflow's.
- **B. Running entries stay in Now, first, with a "Running" badge and their step.**
  - [pro] the page mirrors the file.
  - [con] Now mixes two kinds of entries.

**Answer:**

## Q8: How does "Add and commit" work?

Adding a priority or a note in the web UI writes it uncommitted, and the only Commit is the bar of
the priorities and inbox pages. `ura note` commits a note alone, unless `INBOX.md` already had
changes, which are someone's work in progress. A toast may carry Undo only, by the UI behaviour
decision. More in [discovery](discovery-01.md#add-and-commit).

Why it matters: it is the quick-capture path from any page, and the phone's six taps.

- **A (recommended). Both ＋ forms, priorities and inbox, get "Add and commit", the default on
  Enter, beside "Add". It commits that file alone; when the file had other uncommitted changes, it
  only adds, and says so. The skill's inbox reference says the same.**
  - [pro] four taps from any page, and batching kept for organizing.
  - [con] two buttons in the form.
  - Why recommended: it matches `ura note`, and keeps the commit bar for the pages where you
    organize.
- **B. Every add from a ＋ form commits; the pages' Add rows still batch.**
  - [pro] one button.
  - [con] no way to jot several lines into one commit from the ＋.

**Answer:**

## Q9: Can notes be dragged like priorities?

You asked for "same ordering handles". The inbox has no order today beyond its categories, and the
core cannot move a note to a place. More in [discovery](discovery-01.md#ordering-notes).

Why it matters: A makes the two pages one component; B keeps them two.

- **A (recommended). Notes drag within and across categories, with the priorities' handle, press on
  touch, and keyboard; category headings look like sections, with counts and separators; a note
  shows its children like an entry.**
  - [pro] one list on both pages, learnt once.
  - [con] a new core move for notes.
  - Why recommended: it is the coherence the proposal asks for.
- **B. The same rows and headings, but no drag: a note's category changes from its pane, as today.**
  - [pro] no core change for order.
  - [con] the handles differ between the two pages.

**Answer:**

## Q10: What happens to a priority's children when it becomes a draft?

Draft writes the line as the draft's title and What, and leaves the children under the line. A
note's draft already takes its lines. More in [discovery](discovery-01.md#children-into-a-draft).

Why it matters: it decides where those lines live afterwards, and changes the skill's description of
Draft.

- **A (recommended). The children move into the draft's What, after the line, and leave
  `PRIORITIES.md`: the entry becomes the link alone.**
  - [pro] each line in one place, like a note's draft.
  - [con] the priorities page no longer shows them under the entry.
  - Why recommended: the draft is where the feature is written from now on.
- **B. They are copied into What, and kept under the entry too.**
  - [pro] the priorities page still shows them.
  - [con] two copies that drift.

**Answer:**

## Q11: How do the constitution and decisions show?

No page shows them today: a link opens the raw file. Decision logs list titles with a status beside
the document (log4brains, Backstage); a constitution has principles, a version, and dates. The
[redesign specs](/specs/drafts/redesign-specs.md) draft plans showing a branch's decision diffs.
More in [discovery](discovery-01.md#the-decisions-view).

Why it matters: it is a new page, and where a newcomer learns the project's rules.

- **A (recommended). A Decisions page: the list of decisions, each with its status and first
  sentence, on the left; the chosen decision in the middle; the constitution in a foldable column on
  the right, its principles in order with its version. On the phone, a list with the constitution
  first, each opening its page. Only the default branch's files, read-only.**
  - [pro] the hierarchy you suggested: decisions to read, principles in view.
  - [con] three regions on a desktop.
  - Why recommended: it is your suggested layout, and keeps branch diffs to the specs redesign.
- **B. One page: the constitution on top, then a card per decision, each opening its own page.**
  - [pro] simple, one scroll.
  - [con] the constitution pushes the decisions down every time.
- **C. A or B, with each branch's proposed decisions and changes listed under their decision.**
  - [pro] what is about to change shows too.
  - [con] a branch reader, and overlap with the specs redesign.

**Answer:**

## Settled without the human

- **The inbox count** counts notes, not uncommitted changes, in grey, with no colour at any number,
  and is hidden at zero. Home drops its "N notes to organize" row for a small card with the
  categories and their counts and the latest notes. See
  [discovery](discovery-01.md#what-they-have-in-common).
- **Home's done features** show the five latest, with "Show all" opening the full list in place, so
  the interface redesign's "…" keeps a target. See [discovery](discovery-01.md#homes-done-group).
- **On the phone**, a tap on a priority or a note opens its page with the field closed: a keyboard
  would cover half the screen at every tap. One more tap opens it. See
  [discovery](discovery-01.md#opening-an-entry).
- **Drafted entries** show a "Draft" mark with the draft's name, and backlog entries a "Backlog"
  mark; the core checks that the file exists, so a broken link gets no mark. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **Section colours** come from Astryx's tokens, never raw values: Running green, Now blue, Next
  neutral, Later grey, Blocked orange, as a coloured heading and a thin edge, with the words always
  there. The look and feel pass may refine them. See
  [discovery](discovery-01.md#now-next-later-roadmaps).
- **Selection and focus** look different: the selected row is highlighted, the focused one has the
  focus ring, as the accessibility guidance asks. See
  [discovery](discovery-01.md#wai-aria-authoring-practices).
- **The pane keeps** its section picker, draft area, Delete with Undo, and ‹ Previous / Next ›, on
  both pages. See [discovery](discovery-01.md#important-reads).
- **The decisions page** has an address of its own, `/r/<repository>/decisions/<name>`, and links to
  decisions and to the constitution open there instead of the raw file. See
  [discovery](discovery-01.md#the-decisions-view).
- **Live updates** follow a change to a child line, and, with A in Q1, to a decision. See
  [discovery](discovery-01.md#important-reads).
- **Files near their limit**, the router, the data hooks, and the priorities page, are split first,
  each in a commit that only restructures it, as the code quality decision asks. See
  [discovery](discovery-01.md#likely-changes).
- **Mockups** are Storybook stories of each changed view, the variant you pick for home becoming its
  first commit. See [discovery](discovery-01.md#likely-changes).
- **Shortcuts turned off**: the keys act only outside text fields; a switch to turn them off can
  come with the settings page. See [discovery](discovery-01.md#needs-no-choice).

**Notes:**
