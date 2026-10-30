---
kind: feature
finished: 2026-10-26
pull-request: https://github.com/mrtolkien/uraeda/pull/58
superseded-by: [2026-10-30-panes-size]
---

# Record: Session and New in the terminal look

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-25, finished on
> 2026-10-26, in [its pull request](https://github.com/mrtolkien/uraeda/pull/58). Its full files are
> in git: `git log -- specs/2026-10-25-session-new/`.
>
> Superseded in part by [2026-10-30-panes-size](2026-10-30-panes-size.md).

## What and why

The session page and the New page were the last pages in the old look, inside the terminal shell of
[layout and look](2026-10-20-layout-look.md), the third feature of its split. The human asked for
the standard chat look: messages first, and what the agent did, its sources, and its changes second.
They took Pi's split of chat, tool calls, and thinking as the model, and asked for a vertically
split right column. For New, they asked for three clearly different choices, so a new user picks
Session, Change, or Feature right the first time.

## Behaviour

- **Recap lines in the chat (US1).** The chat holds the human's messages and the agent's texts, and
  one recap line per stretch: the main agent's tool calls and thoughts between two other lines of a
  turn. No call has a row of its own in the chat.
  - A recap line reads its time, the sum of its calls' and thoughts' lengths, then its counts in a
    fixed order: "2 min · read 3 files · searched once · fetched 1 page · thought twice".
  - Reads, edits, deletes, and moves count distinct files. Searches count times; fetches, commands,
    sub-agents, and other tools count calls. Thoughts come last, whatever came first.
  - A stretch of one call reads the call, thoughts around it kept: "7 s · edited src/a.ts · thought
    once". A single sub-agent reads "ran a sub-agent", another tool "used TodoWrite".
  - A sub-agent's own calls and thoughts never join or end a stretch, nor show in the chat.
  - A stretch cut by a turn's pages of 100 items is still one line, under its first page's key. A
    stretch ending exactly at a page's end draws its line before the next page's first item.
  - A running turn ends with the live line, which stands for its open stretch: "12 s · reading
    src/tasks/undo.ts · 2 sub-agents running", its time shown from the first second. Each call of
    the main agent restarts that time.
  - A recap line links `?tab=activity&stretch=<turn>:<seq>`, in place of the history entry, so Back
    leaves the page. On the session's page it ends with "Activity" and a chevron.
  - Denied actions, offers, and "Jump to latest" stay in the chat, as before. The chat's tail still
    draws the latest 20 messages.
- **The session column (US1, US2).** Every session's page has it, a main-checkout chat included: the
  documents' column, whose one tab is a split, the Activity above and the Changes below. The plan's
  progress sits at its foot.
  - Wide, it takes a third of the window, 400 to 600 px: 480 px at 1440 px, the chat then 704 px.
    Semi-wide, it takes 30%, 300 to 360 px; dragged, 300 to 720 px.
  - The chat stays at least 1.4 times as wide as the column, at 1440 px and at 1205 px.
  - Its fold and dragged width are the documents' column's, under `uraeda.documentColumn`. A
    session's 320 px drag draws the documents' column at its least 400 px, and survives its fold.
  - Narrower than 400 px, the column's tabs drop their icons and draw closer, so "Sub-agents" reads
    whole at 300 px. The folded rail keeps the icons.
  - A recap line's address unfolds a folded column, on wide and semi-wide screens only.
  - The stretch leaves the address once a turn after the one the page opened on starts running. A
    turn queued behind the running one keeps it until then.
  - On the phone, the status line holds "Activity", "Changes N", and the progress as "3 / 7". The
    first two open one sheet named "Activity", at the latest calls.
  - The sheet holds the split, and the column's tabs at its top while more than one panel shows. A
    tab replaces the sheet's `?tab=`, so Back closes the sheet.
- **The Activity (US1).** A session's runs, each titled "Run 1 · 2 min", its turn's start to end. A
  run reads "live" while running or queued, "failed" in the error colour, or "stopped".
  - A row is a call's target, or its tool's name, then its word: "read", "edit", "delete", "move",
    "search", "fetch", "run", "sub-agent", or the tool's name. No call shows its length.
  - A failed or cancelled call reads "failed"; a call its ended turn left going, "not finished". A
    call's output unfolds under it, mounted only while open.
  - A thought reads "Thought · 8 s", its length shown from 1 s, and unfolds its text when a harness
    gave one. Claude Code gives none today.
  - A sub-agent is a folded group, "sub-agent · 6 calls", holding its own calls and nested
    sub-agents. An open group mounts its latest 200 calls; "Show earlier calls" adds 200.
  - The Activity mounts the latest 200 rows, counting rows and not messages; "Show earlier runs"
    adds 200. It opens at its latest call, and follows new calls while the human is at the end.
  - At a stretch, it draws 200 rows from the page of 100 items the stretch begins on, with "Show
    earlier runs" above and "Show later runs" below. The stretch's rows are marked.
  - Each arrival of a stretch's address scrolls to its run's title, or to its first row when it is
    not the run's first: a reload, Back, a tab switch, or the same recap line followed again.
  - A walk reads at most 4 pages of items for each 200 rows. When that budget stops it, "Show
    earlier runs" shows even with no row left.
  - Paths break after their slashes first, as the Changes' files do.
- **Changes and progress (US2).** No diff anywhere: the human chose to keep it simple.
  - "This session · 2 files" lists the files the session's completed edit calls named, of every turn
    and sub-agent, with "2 edits" and "1 edit". A failed, cancelled, or running edit does not count.
  - "On the branch · 14 files · +312 -41", for a feature's or a change's session, lists the first 2
    committed files, then a "12 more files" button. It unfolds up to 50, then "and N more files".
  - "No file changed yet." when nothing changed; "The changes could not be read." when git fails.
  - The Changes part takes at most 40% of the column's height, and scrolls past it.
  - The progress bar shows only while the implementation has a current task: "Implementation · task
    3 of 7", the task's title, a bar 3/7 full, linking to the plan at that task.
  - When `plan.md` cannot be read, the bar still shows, linking to the plan's top. A change, which
    has no plan, has no bar.
  - In a column narrower than 400 px, the task's title goes under the label, and "task 7 of 11"
    never breaks.
- **Sub-agents (US3).** A Sub-agents tab joins Activity while the main agent runs sub-agents, or
  while `?tab=subagents` asks for it. It splits over the same Changes, its tab counting the running.
  - Each row has the sub-agent's description, "2 calls · reading src/tasks/undo.ts" or "no call
    yet", and how long it has run, ticking each second.
  - The server lists running sub-agents only. The page keeps the rows it drew while the tab is open,
    marking the ended ones "Done", their time frozen; a reload loses them.
  - A sub-agent's own sub-agents are rows of its group in the Activity, never in this tab.
- **The embedded session (US4).** Asking the agent from a round, a spec, or a plan opens the
  feature's session in the document's Session tab: the chat with its recap lines and its composer,
  no column of its own. A recap line there ends with an arrow and opens the session's page at its
  stretch.
- **New's cards (US5).** Three cards side by side, Session, Change, and Feature: a radio group named
  "What to start", each card a titled pane with its icon.
  - Each card has its sentence, an example, and two facts, an icon and a label beside their value.
  - Session: "Talk to the agent in the main checkout, like plain Claude Code.", "Why is CI slow?";
    ends with "the chat", waits on you for "nothing".
  - Change: "A bug fix or a small change, on its own branch.", "Fix the due-date typo"; "a pull
    request", "the pull request".
  - Feature: "A larger piece of work, designed with the agent before any code.", "Add recurring
    tasks"; "a spec, then a pull request", "questions, then the spec".
  - The picked card is tinted in the accent, and its kind's form, unchanged, sits under the cards.
    No round radio is drawn.
  - The pick is `?kind=`, Session without one, so a reload keeps it. The arrow keys, Home, and End
    move it; an arrow with a modifier is the browser's.
  - On the phone, the cards stack without their examples, and the form follows them.

## Design

The runner records one new cache item, the thought, and the server reads a session's edited files
and its sub-agents' work in SQL. In the web, one pure module owns what a stretch is and every word
said of one. Each part of the column is one component of `session/`, for the feature page to reuse.
The documents' column gained panels: a panel shows as a tab, and a split is a panel of two panels.

- **The thought**: [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts) turns
  Claude Code's whole thinking block into a `thought` event, its text when not empty.
  [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts) times the main agent's from
  its block's start, gives a sub-agent's 0, and cuts its text to 4,000 characters. A text or a call
  ends a block's start.
- **The session record**: [`runner/cache-work.ts`](/packages/server/src/runner/cache-work.ts)'s
  `editedFiles` and `subagentsOf`, behind the session record's `edited` and `subagents`.
- **The stretches**: [`session/stretches.ts`](/packages/web/src/session/stretches.ts), with its
  table of each kind's words, `slotsOf`, `pageEnd`, and `joinStretches`.
- **The chat**: [`session/RecapLine.tsx`](/packages/web/src/session/RecapLine.tsx), drawn by
  [`TranscriptMessages.tsx`](/packages/web/src/TranscriptMessages.tsx) and
  [`tailPieces.tsx`](/packages/web/src/tailPieces.tsx), in place of the old tool groups.
- **The column**: [`session/SessionColumn.tsx`](/packages/web/src/session/SessionColumn.tsx) over
  [`layout/DocumentColumn.tsx`](/packages/web/src/layout/DocumentColumn.tsx)'s `ColumnPanel` and
  [`layout/SplitPanel.tsx`](/packages/web/src/layout/SplitPanel.tsx). Its widths are
  [`layout/documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts)'s
  `useSessionColumnWidth`, over
  [`layout/followedWidth.ts`](/packages/web/src/layout/followedWidth.ts). It replaces
  `SessionAside.tsx`, `ChangeAside.tsx`, and `ProgressLine.tsx`.
- **The Activity**: [`session/ActivityPanel.tsx`](/packages/web/src/session/ActivityPanel.tsx), its
  walks in [`session/ActivityWalk.tsx`](/packages/web/src/session/ActivityWalk.tsx), its runs in
  [`session/activityRuns.ts`](/packages/web/src/session/activityRuns.ts), its rows in
  [`session/ActivityRows.tsx`](/packages/web/src/session/ActivityRows.tsx).
- **The other parts**: [`session/ChangesPanel.tsx`](/packages/web/src/session/ChangesPanel.tsx),
  [`session/PlanProgress.tsx`](/packages/web/src/session/PlanProgress.tsx),
  [`session/SubagentsPanel.tsx`](/packages/web/src/session/SubagentsPanel.tsx),
  [`session/Path.tsx`](/packages/web/src/session/Path.tsx), and
  [`session/Section.tsx`](/packages/web/src/session/Section.tsx), which leaves out a part whose read
  fails.
- **New**: [`KindCards.tsx`](/packages/web/src/KindCards.tsx), drawn by
  [`NewPage.tsx`](/packages/web/src/NewPage.tsx). The group is drawn by the page, an Astryx gap:
  `SelectableCard` is a checkbox, and `RadioList` draws round radios.
- **Screenshots**: [`scripts/session-new-shots.ts`](/packages/web/scripts/session-new-shots.ts).

## Questions

### Round 01

#### Q1: Which layout should the session page take?

**Answer:** B's layout with A's list: "I want to re-take the list view of view A (tool calls per
run/turn), but the layout of B", lighter, "tool calls on the top, and changes on the bottom. Maybe a
small progress bar at the very bottom."

#### Q2: Where should the diff of the last edit come from?

**Answer:** C, no diff, the Changes list files and counts only: "Let's keep it simple".

#### Q3: What should the transcript show for the model's thinking?

**Answer:** A, a row per thought with its length, and its text only when a harness gives it.

#### Q4: Should a session without a workflow get the right column too?

**Answer:** A, every session gets the column, the progress only when a workflow exists.

#### Q5: How should the New page tell its three kinds apart?

**Answer:** A, three cards side by side with the picked kind's form under them, though the cards
"look too busy and don't have clear enough hierarchy in their inside content".

#### Notes

- **The session beside a document**: name it, "embedded session"?, and use the session's "compact"
  main view; the lighter chat makes it easier to embed.
- **Sub-agents**: "I want a 'sub-agents' tab if any of them are running."

## Decisions

None created or changed. The spec relied on [UI layout](../decisions/ui-layout.md),
[UI coherence, now in UI components](../decisions/ui-components.md),
[UI behaviour](../decisions/ui-behaviour.md), [UI look](../decisions/ui-look.md),
[UI components](../decisions/ui-components.md), and [Preview](../decisions/preview.md).

## Changes after approval

- The column's tabs became panels, a split being a panel of two panels, as the approval's comment
  asked, so the feature page reuses the same behaviour.
- The session column is narrower at semi-wide, 30% of the window between 300 and 360 px. The
  approval's comment asked that the chat clearly weigh more; the documents' column keeps its 400 px.
- At 1440 px the column takes the documents' 480 px, which leaves the chat 704 px. The old check of
  a chat at least 760 px became one of at least 1.4 times the column.
- New's cards follow the discovery's three-card prototype, as the approval's comment asked: each a
  titled pane, facts as icon, label, then value on one line, no round radio.
- The picked New card is tinted in the accent, not only bordered.
- Tool call rows show no length per call, only their word; only thoughts show a length.
- The old column's list of tasks, the feature's links, a change's round and pull request rows, and
  its running sub-agents went. So did the phone's progress line. The split, the Sub-agents tab, and
  the status line's chip replace them.
- The phone's sheet is in `?tab=`, with no `?sheet=` parameter as the spec assumed. The stretch is
  `?stretch=<turn>:<seq>`.
- The phone has one sheet named "Activity", holding the split and the column's tabs, where the
  documents' status lines draw a sheet per tab.
- The live line shows its time from the first second, no longer waiting 10 s. It stands for the
  running stretch, which draws no recap line of its own.
- A thought's length runs from its block's start to the whole block; a sub-agent's thought, which
  has no start, lasts 0 and shows no length.
- A thought's text is cut to 4,000 characters, as a tool call's output is.
- A run's length is its turn's, start to end, not the sum of its stretches.
- A stretch's Activity is a window of 200 rows from the stretch's page, with "Show later runs". The
  first version drew every run back to the stretch's, about 5,000 rows deep in a long session.
- The Activity opens at its latest call and follows new ones, where the first version opened at its
  first rows.
- A new running turn, and the phone's Activity button, leave the stretch behind; a queued turn does
  not.
- The Sub-agents tab remembers ended sub-agents for the page only, since the server lists running
  ones alone.
- A plan whose file cannot be read keeps the progress bar, linking to the plan's top.
- Narrower than 400 px, the column's tabs drop their icons; the progress stacks its task's title.
- Main widened every pane's inset to `--spacing-3` while this branch was open. The shell's sidebar
  column keeps the narrow inset, through `--pane-inset`, so "Priorities" is no longer cut.

## Follow-ups

- The embedded session's header scrolls away with the chat, in a document's Session tab.
- Pane titles sit 8 px off their content since main's wider pane inset.
- The external-review tool's command changed.
- Claude Code's order of a thinking block's start and its whole block is not checked against a
  recorded stream.
- Some browser tests are flaky under load.
