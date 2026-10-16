---
kind: feature
finished: 2026-10-17
pull-request: https://github.com/mrtolkien/uraeda/pull/26
---

# Record: Redesign home, inbox, and priorities

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-16, finished on
> 2026-10-17, in [its pull request](https://github.com/mrtolkien/uraeda/pull/26). Its full files are
> in git: `git log -- specs/2026-10-16-redesign-priorities/`.

## What and why

A functional pass on the pages every piece of work starts from: home, the inbox, and the priorities.
The most standard paths had to be the fastest, and looking at them had to help the human organize
the remaining work: editing a priority took four clicks with its commit, a priority added from the
phone's home took six taps to commit, running and drafted entries looked like the rest, the inbox
and the priorities looked and behaved differently, and home was "a list of grey bullet points". The
human also asked for a readable view of the constitution and decisions, and for the whole to be one
coherent UI, obvious to newcomers.

## Behaviour

- **Open, then edit**: a click on a priority or a note opens its pane on wide screens, its page on a
  phone, to read: the entry rendered, no text field focused, the keyboard closed. The pane's top bar
  says where the entry is, "Next · 2 of 2" or "Note, in No category", then Edit, "Open draft" when
  the entry links a draft, and Close. Edit opens the line as a one-line field in place, Enter saves
  and Escape cancels; on a drafted entry it also opens the draft's whole text in the pane, under the
  line, in the editor of drafts with its Save and Commit, sharing unsaved text with the draft's
  editor page. "Open draft" opens the draft's own page. Children are shown, not edited. A started
  entry's pane shows "Running", its feature's step, and "Open the feature", with no section picker.
  The pane keeps its section picker, draft area, Delete with Undo, and ‹ Previous / Next ›. Opening
  another row while a field holds unsaved text opens it at once, without "Leave page?": the text
  stays in the browser and comes back, with its notice, when its entry opens again.
- **The keyboard**: on the priorities, the inbox, and the decisions page, ↑ ↓ or j k move the
  selection across sections, the pane following when one is open; Home and End go to the first and
  last row; Enter edits the selected item, or opens it when it has nothing to edit; Escape closes
  the field, then the pane. The keys act only with the focus on a row's link or on the page: never
  in a text field, on a drag handle, in an open menu, Selector, or dialog, or in the pane's
  controls. The selected row is highlighted and the focused one has the focus ring. No keyboard hint
  shows.
- **Add and commit**: the ＋ forms of Priorities and Inbox have "Add and commit", the default on
  Enter, showing ↵ on desktop, beside "Add". It commits that file alone, with `git commit --only`,
  so other staged files stay staged: `chore: add "<short>" to <Section>` or
  `chore: add "<note>" to the inbox`, and the toast "Added to Next and committed" or "Added to the
  inbox and committed" with Undo, which commits the removal, `chore: remove "<short>"` or
  `chore: remove "<note>" from the inbox`. When the file had other uncommitted changes, it only
  adds, and the form says "Added to Next. Not committed: PRIORITIES.md has other changes to commit
  or discard."; a hook's failure leaves the line written and shows "Commit failed: <first line>".
  "Add and commit" and the committed add's Undo join the shared record of git writes: "Committing…"
  or "Undoing…" with a spinner at once, blocked while another write runs. "Add" stays free and
  leaves the line for the commit bar.
- **The priorities page**: sections in their colour with a heading "<Title> · <count>" and a
  separator, Now blue, Next neutral, Later grey, Blocked orange, an empty one as "Later · 0" with
  its add row. Every entry whose feature or change runs, from any section, shows above them in
  "Ongoing", green, only when one runs, with "Running", its step, or what its human gate asks,
  "Answer questions", "Review the spec", or "Review the plan", and no handle; the sections' counts
  leave them out, and a drop maps to the file among the other entries, never between started ones.
  An entry whose feature is done gets its handle back without a reload. An entry linking an existing
  draft shows "Draft", one linking a backlog file "Backlog"; a link to a missing file gets no mark.
  Rows are compact on every width, and on narrow screens only the heading carries the colour, with
  no side edge.
- **Started entries on top of Now**: `ura start`, the web UI's Start, and a change's start write the
  entry after the last started entry at the top of Now, or first followed by a blank line, and no
  blank line when Now holds only started entries. A started entry is one linking a dated folder's
  `proposal.md`, a feature's or a change's. Entries started lower in Now stay where they are. A
  draft brought back by a change, or a triage's new draft, goes first after the started entries and
  their blank line.
- **The inbox like the priorities**: the same list, with category headings, counts, and separators,
  the same handles, compact rows, and a note's children as grey lines under it. Notes drag within
  and across categories, by the handle, a 500 ms press on touch, or the keyboard (Space, ↓, Space),
  their children moving with them: `chore: move "<note>" within <Category> in the inbox` within one,
  `move "<note>" to <Category> in the inbox` across. The page's heading shows the count without
  text, aligned with "Inbox", and "Organize with an agent" on its right, apart.
- **A draft takes its line's children**: Draft on a priority with children writes them into the
  draft's What, after the line and a blank line, dedented, their relative links rewritten for the
  draft's folder, and leaves the entry as the link alone. Discard on the commit bar deletes such a
  draft and writes the entry back with its children.
- **Home as a control hub**: four counts, "Needs you", "Agents", "Now", and a grey "Inbox", two by
  two on the phone; then two columns of cards on wide screens, one on the phone in the same order:
  "Needs you" ("Nothing waits on you." when empty) and "Agents at work" on the left; "Priorities",
  with a "Now | Next" control kept in the browser, "Inbox", with its categories, their counts, and
  the three latest notes, "Recently done", with the five latest and "Show all (N)" in place, and
  "Constitution and decisions" on the right. The Priorities and Inbox titles open their pages. Each
  card is a region named by its heading. The sidebar's "All done features and changes" opens home at
  `#done`, where the card lists every done feature.
- **Constitution and decisions**: a page, at `/r/<repository>/decisions`, reached from home's card,
  read-only, from the default branch. It starts with "Constitution", its version line, and its
  principles as compact cards, then "Decisions · N", each row with its icon, its title (the H1, or
  the file name), its summary's first sentence, its last change date, and "Proposed" when so; sorted
  "Latest change first" by default, "Latest change last", or "A to Z", kept in the browser. A click
  opens a principle or a decision in a pane, or its page on a phone, at `/decisions/<name>` or
  `/decisions/constitution/<slug>`, and the keys go from the principles to the decisions. A decision
  the core cannot parse shows "Can't read this file" in its row and the core's first problem in its
  pane. Links to `specs/decisions/*.md` and `specs/CONSTITUTION.md` open on this page, not as text.
  A decision is drawn live when its file changes.
- **Decision icons**: a decision's frontmatter may hold `icon`, a Lucide icon name like
  `git-branch`, drawn beside its title, with a default icon for a name the web UI does not register.
  The skill's conventions and spec references document the field, and every decision of this
  repository, of the template, and of the example has one.

## Design

The core says what each entry is, and the web UI draws it, as the [stack](../decisions/stack.md)
decision asks: the priorities record carries each entry's draft or backlog file and its running
feature with its step, notes carry their children, and the decisions come as a parsed ledger. The
web UI gains one shared list and one shared pane, which the priorities, the inbox, and the decisions
use.

- One join of an entry's link to the workspace, its feature and its draft or backlog file, for the
  web, the workspace, and the language server: `Workspace::link` in
  [`crates/core/src/workspace/links.rs`](/crates/core/src/workspace/links.rs). The watch's
  priorities hash covers the joined record, so a feature's step change reaches the page
  ([`watch.rs`](/crates/core/src/watch.rs)).
- Where started entries go, `add_started`, and the link that drops a drafted line's children, in
  [`crates/core/src/files/priorities/edits.rs`](/crates/core/src/files/priorities/edits.rs); the
  draft with children in [`actions/draft.rs`](/crates/core/src/actions/draft.rs), and its discard in
  [`actions/changes/drafts.rs`](/crates/core/src/actions/changes/drafts.rs).
- An add committed alone, `add_alone` and `is_clean`, in
  [`crates/core/src/actions/commit.rs`](/crates/core/src/actions/commit.rs), over `Git::commit_only`
  in [`git/commit.rs`](/crates/core/src/git/commit.rs); notes' children and places in
  [`actions/inbox.rs`](/crates/core/src/actions/inbox.rs) and
  [`files/inbox/read.rs`](/crates/core/src/files/inbox/read.rs).
- The constitution and decisions, read from the default branch, in
  [`crates/core/src/api/ledger.rs`](/crates/core/src/api/ledger.rs), each file's date from
  `Git::last_change` in [`git/log.rs`](/crates/core/src/git/log.rs); the `icon` field allowed in
  [`check/values.rs`](/crates/core/src/check/values.rs). The server's `ledger` record,
  [`packages/server/src/fate/views-ledger.ts`](/packages/server/src/fate/views-ledger.ts), and the
  new mutations in [`mutations.ts`](/packages/server/src/fate/mutations.ts) and
  [`inbox-mutations.ts`](/packages/server/src/fate/inbox-mutations.ts).
- The shared list, [`packages/web/src/lists/`](/packages/web/src/lists/): `WorkList.tsx`,
  `PrioritiesList.tsx` ("Ongoing" and the drop's mapping to the file), `useDragOrder.ts`,
  `useListKeys.ts`, and `listPane.ts`, through which a list reaches its open pane.
- The shared pane, [`packages/web/src/pane/`](/packages/web/src/pane/): `EntryPane.tsx`, its bodies
  `PriorityPane.tsx` and `NotePane.tsx`, and `DraftEditor.tsx`, the editor of drafts extracted from
  the editor page.
- Home's cards, [`packages/web/src/home/`](/packages/web/src/home/), `HomeHub.tsx`; the decisions
  page, [`packages/web/src/decisions/`](/packages/web/src/decisions/); the links that open it,
  [`packages/web/src/links.tsx`](/packages/web/src/links.tsx).
- "Add and commit", `AddButtons` and `useAddAndCommit`, in
  [`packages/web/src/QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx), used by
  [`SidebarAdd.tsx`](/packages/web/src/SidebarAdd.tsx) and
  [`AddNote.tsx`](/packages/web/src/AddNote.tsx), on the shared record of writes,
  [`writes/useOwnWrite.ts`](/packages/web/src/writes/useOwnWrite.ts).
- The focus ring and the dividers fixed at their source: no app style repeats an Astryx atomic value
  that an Astryx state overrides, in [`Selection.tsx`](/packages/web/src/Selection.tsx) and the bars
  drawing Astryx's `Divider`.

## Questions

### Round 01

#### Q1: May this feature change the core?

**Answer:** A: small core changes that keep every file's format, the core telling the UI which
priority is drafted or running.

#### Q2: Which feature changes the sidebar?

**Answer:** B: both left to the interface redesign; "Make a small note in the inbox in the UI
category, I'll review it once both branches are merged".

#### Q3: How should home look?

**Answer:** A, the control hub, with "Priorities" showing "only Now by default", its title opening
the priorities page, and no "Organize 10 notes" link.

#### Q4: What does a click on a priority or a note open?

**Answer:** C, shortened: "one click to open the pane, one click to edit", with Edit at the top,
editing in place, a separate "Draft view" button, and a pane that "shows markdown and does not steal
focus".

#### Q5: Does the editor change an entry's children too?

**Answer:** B: the first line only, "single line is ok".

#### Q6: Which keys move through the list?

**Answer:** A: ↑/↓ and j/k move the selection with the pane following, Enter edits, Escape closes,
Home and End; the hint was dropped by the spec's review.

#### Q7: How does running work stand apart in the priorities?

**Answer:** B, running entries in Now, "BUT make sure they are moved at the TOP of `now` in the
file, with an empty line before the other lines"; the spec's review then set them apart on screen.

#### Q8: How does "Add and commit" work?

**Answer:** A: "Add and commit", the default on Enter, beside "Add", commits the file alone, and
only adds when the file had other changes.

#### Q9: Can notes be dragged like priorities?

**Answer:** A: notes drag within and across categories with the priorities' handle, and show their
children.

#### Q10: What happens to a priority's children when it becomes a draft?

**Answer:** A: the children move into the draft's What and leave `PRIORITIES.md`.

#### Q11: How do the constitution and decisions show?

**Answer:** A, "differently": a compact list starting with the constitution, then each decision by
its title and first phrase, with sort settings, a click opening it "in the right sidebar",
read-only, and arrows to move.

## Decisions

- [UI behaviour](../decisions/ui-behaviour.md): changed; opening an item never puts the focus in a
  text field, and every list with a pane moves its selection with ↑ ↓ or j k, Home, End, Enter, and
  Escape.

## Changes after approval

- C1: the branch was rebased on the default branch before the plan, and caught up again in the final
  review.
- C2: Edit on a drafted entry also opens the draft's whole text in the pane, with its Save and
  Commit (R1).
- C3: the inbox's heading shows its count without text, aligned with "Inbox", and "Organize with an
  agent" on the right, apart.
- C4: "Add and commit" shows ↵ on desktop.
- C5: no keyboard hint; an entry for keyboard navigation and its discoverability went into Next.
- C6: running entries show in their own section on screen, "Ongoing" (R4), the file keeping them on
  top of Now; rows are more compact, and narrow screens lose the sections' side edge.
- C7: the inbox's rows are as compact as the priorities'.
- C8: decisions gain an optional `icon` frontmatter field, a Lucide name, with a default icon (R2);
  every decision was given one, the two merged meanwhile too (R20).
- R3: "Add and commit" commits with `git commit --only`, leaving other staged files staged.
- R10: "Ongoing" gathers the running entries of every section, not only Now's, and a gate's step
  reads what the gate asks.
- R13: a step carries its file's kind, so the priorities and home name what a gate asks without
  reading file names.
- R14: opening another row of the same list never asks "Leave page?".
- R15: home's tests count the tests' fixture, "Needs you 3" and "Agents 1"; the Hub story shows the
  spec's numbers.
- R17: "Add and commit", the committed add's Undo, and the pane's Commit and "Start the feature"
  join the shared record of git writes merged from the interface redesign.
- R18: the sidebar gets no Decisions row; home's card stays the way to the decisions page.
- R19: the sidebar's "All done features and changes" opens home's done card with every done feature.
- R23: one join of an entry's link for every reader: a missing draft names no draft, and a postponed
  feature's entry names its backlog file, in the web and in the language server alike.
- R25: tests find rows and cards by role, home's cards are regions named by their headings, and a
  decision's icon is checked by its registered name.

## Follow-ups

- Decisions page: when the default branch is checked out nowhere, a decision's links are checked
  against the current checkout, not the default branch's tree, so a valid link can read as broken.
- Finishing the last started entry, or moving the last other entry out of Now, leaves two blank
  lines under `## Now` in `PRIORITIES.md`.
- In a numbered Now, a newly started entry repeats the next number (2. C, blank line, 2. B).
- Home's Now count includes started entries, while the priorities page's "Now · N" leaves them out.
- `ura note` still refuses when other files are staged, while the web UI's "Add and commit" commits
  the file alone.
- Discard keeps a priority's draft on disk when the line's children changed since the last commit.
- The decisions page runs one `git log` per decision, and the watch reads every decision on each
  pass.
- The editor's hint says draft for an entry linking a backlog file.
- List keys under an open menu or dialog are handled but untested: only an open Selector is tested.
- Under the full browser run, story-variants' comment test sometimes fails: `userEvent.click` turns
  the found element back into a locator by its label, which matches both variants' Pick buttons.
- Home's inbox card says "Not sorted 3" for notes without a category, while the rest of the UI says
  "No category".
- The New priority sheet's height on the phone.
- "Add as a draft" has no ↵, unlike "Add and commit".
- "Organize with an agent" is enabled on an empty inbox.
- The sidebar's grey inbox count and a Decisions row, left to the interface redesign (Q2), are to be
  reviewed now that both redesigns are merged, as the inbox's UI note says.
