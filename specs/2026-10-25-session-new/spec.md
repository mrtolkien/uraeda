---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Session and New in the terminal look

> [!NOTE]
>
> Approved on 2026-10-25.
>
> - You approve a session page where the chat keeps one recap line per stretch of tool calls, beside
>   a column split in two: the calls by run above, the changed files below, and a progress bar at
>   the very bottom. You also approve a New page of three cards.
> - The column's split is a second shape of right column, beside the documents' tabs: the feature
>   page will reuse its parts, the activity, the changes, and the progress.
> - Changes show no diff, as you chose: the files this session edited, with their number of edits,
>   then the branch's committed files with their line counts, as today.
> - A thought is stored in the runner's cache as a row with its length, and its text only when a
>   harness gives one. Claude Code gives none today, so the rows read "Thought · 8 s".
> - The "Sub-agents" tab you asked for shows only while a sub-agent of the session runs.
> - Risk tier medium: the cache gains a kind of item. Nothing durable changes, and the plan does not
>   wait for your review.

The session page and the New page are the last two pages in the old look beside the
[terminal shell](../done/2026-10-20-layout-look.md). This feature redraws both in it. A session
reads chat first: what the agent did folds into recap lines, and the column beside the chat shows
the calls, the changed files, and the plan's progress. The New page tells Session, Change, and
Feature apart at a glance, so a new user picks the right one the first time. From the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## Decisions

No decision is created, changed, or removed.

Relied on:

| Decision                                       | What it means for this spec                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [UI layout](../decisions/ui-layout.md)         | Mockups at the three widths; the column folds and resizes; its open tab and sheet live in the address |
| [UI coherence](../decisions/ui-coherence.md)   | The activity, the changes, and the progress are each one shared component, reused by the feature page |
| [UI behaviour](../decisions/ui-behaviour.md)   | The activity mounts a bounded number of rows, and folded groups are not mounted                       |
| [UI look](../decisions/ui-look.md)             | Square corners, monospace, the chat's prose in the reading font                                       |
| [UI components](../decisions/ui-components.md) | Astryx's tabs, lists, and chat components, styled through the theme                                   |
| [Preview](../decisions/preview.md)             | The mockups are HTML pages, as the decision allows for a page's layout                                |

## User stories

### US1: Read the chat, with what the agent did beside it (P1)

A human follows a session. The chat holds their messages and the agent's words, with one recap line
for each stretch of tool calls and thoughts between them. The column beside it lists every call and
thought, grouped by run, and a recap line opens the column at its stretch.

[Session, wide](mockups/session.html?w=1600)

[Session, semi-wide](mockups/session.html?w=1000)

[Session, phone](mockups/session.html?w=390)

[Session, phone, the column open](mockups/session.html?w=390#sheet)

Key scenarios:

1. **Given** a run where the agent thought for 8 s, read `src/tasks/complete.ts`,
   `src/tasks/repeat.ts`, and `src/tasks/repeat.test.ts`, searched once, fetched one page, and
   thought for 5 s, before writing its answer, **When** the human reads the chat, **Then** one recap
   line reads "2 min · read 3 files · searched once · fetched 1 page · thought twice", above the
   answer, and no call has a row of its own in the chat.
2. **Given** that session at 1600 px, **When** the human clicks the recap line, **Then** the
   column's Activity tab scrolls to "Run 1 · 2 min", its first row "Thought · 8 s", and marks the
   stretch.
3. **Given** a running turn reading `src/tasks/undo.ts` for 12 s, **When** the human looks at the
   chat's end, **Then** its live recap line reads "12 s · reading src/tasks/undo.ts", and the
   Activity's last row "src/tasks/undo.ts · read" is marked live.

More scenarios:

1. **Given** a session in the main checkout, with no feature or change, **When** it opens at 1600
   px, **Then** it has the same column, without the branch's files and without the progress bar.
   [Main checkout](mockups/session.html?w=1000#plain)
2. **Given** the phone, **When** the human taps "Activity" in the status line, **Then** the column
   opens as a sheet over the chat, and Back closes it.
3. **Given** a thought for which the harness gave text, **When** the human opens its row, **Then**
   the text unfolds under it; a thought without text has no fold.
4. **Given** a turn that failed, **When** the Activity shows its run, **Then** its title reads "Run
   2 · failed", in the error colour.

### US2: See what changed, and how far the plan is (P1)

Under the calls, the column lists the files changed: those this session edited, then the branch's
committed files. A feature's or a change's session ends the column with its plan's progress.

[Session, wide](mockups/session.html?w=1600)

Key scenarios:

1. **Given** a session that edited `src/tasks/complete.ts` twice and `src/tasks/complete.test.ts`
   once, **When** the human reads Changes, **Then** "This session · 2 files" lists them with "2
   edits" and "1 edit", and no diff.
2. **Given** a feature's branch with 14 committed files, 312 lines added and 41 removed, **When**
   the human reads Changes, **Then** "On the branch · 14 files · +312 -41" lists the first files
   with their counts, then "12 more files".
3. **Given** the implementation at task 3 of 7, "Complete a repeating task", **When** the human
   looks at the column's bottom, **Then** a bar 3/7 full reads "Implementation · task 3 of 7", and
   clicking it opens the plan at that task.

### US3: Follow sub-agents while they run (P2)

When the agent starts sub-agents, the column gains a Sub-agents tab beside Activity, with each
running sub-agent, its number of calls, and what it does now.

[Sub-agents running](mockups/session.html?w=1600#subagents)

Key scenarios:

1. **Given** a run with no sub-agent, **When** the human looks at the column, **Then** it has the
   Activity tab alone.
2. **Given** two sub-agents running, "Research rrule's undo of an occurrence" with 6 calls and "Find
   every caller of complete()" with 3, **When** the human opens Sub-agents, **Then** both are
   listed, each with its calls, what it does now, and how long it has run.
3. **Given** the Sub-agents tab open, **When** the last sub-agent ends, **Then** the tab marks each
   one done and stays until the human leaves it; the Activity keeps their calls, grouped under each
   sub-agent's row.

### US4: Ask from a document, in an embedded session (P2)

Asking the agent from a question, a spec, or a plan opens the feature's session in the document's
column as an embedded session: the session page's chat alone, compact, with a link to the session's
page.

[Embedded session](mockups/embedded.html?w=1600)

Key scenarios:

1. **Given** the spec page with its Session tab open, **When** the agent works, **Then** the
   embedded session shows the chat with its recap lines and the composer, and no column of its own.
2. **Given** the embedded session, **When** the human clicks a recap line, **Then** the session's
   page opens with its Activity at that stretch.

### US5: Pick the right kind on New (P2)

A human opens New and sees three cards side by side, Session, Change, and Feature. Each has its
name, one sentence, what it ends with, what waits on them, and an example. The picked card's form
sits under the cards.

[New, Feature picked](mockups/new.html?w=1600#feature)

[New, Session picked, semi-wide](mockups/new.html?w=1000#session)

[New, Change picked, phone](mockups/new.html?w=390#change)

Key scenarios:

1. **Given** New opened with no kind in the address, **When** it loads, **Then** the Session card is
   picked and the composer is under the cards.
2. **Given** New, **When** the human picks Feature, **Then** its card is marked, the address reads
   `?kind=feature`, and the title field, "Write the proposal", and the notes and priorities to start
   from show under the cards.
3. **Given** the cards, **When** the human reads them, **Then** each shows "Ends with" and "Waits on
   you": the chat and nothing; a pull request and the pull request; a spec then a pull request, and
   questions then the spec.

More scenarios:

1. **Given** the phone, **When** New opens, **Then** the cards stack, without their examples, and
   the form follows them.
2. **Given** the keyboard, **When** the focus is on the cards, **Then** the arrow keys move the
   pick, as in a group of radio buttons.

## Architecture

The page keeps today's data: the runner's items and turns, and the core's branch changes. It adds
one item, the thought, to the cache, and draws the session's parts as shared components, so the
feature page reuses them ([UI coherence](../decisions/ui-coherence.md)). See
[the code](discovery-01.md#the-code).

- **The stretches** cut a turn's items into stretches of tool calls and thoughts between texts, and
  count each one by kind. They own what a recap line says, and which rows the Activity marks.
- **The recap line** draws a stretch in the chat, live while it runs, and opens the Activity at it.
  It replaces Astryx's tool groups between messages.
- **The activity** lists a session's runs, each with its calls and thoughts, sub-agents as folded
  groups. It owns the bound on mounted rows, and the session page and the feature page draw it.
- **The sub-agents list** draws the running sub-agents of the latest run, and owns when its tab
  shows.
- **The changes** list the files the session's completed edit calls name, and the branch's committed
  files from the core. They own the counts, and replace "Changed on the branch" of the current
  column.
- **The progress bar** draws the plan's current task, and replaces the step and tasks of the current
  column.
- **The session column** splits the column in two, the tabs of the activity and the sub-agents
  above, the changes below, the progress bar last. It uses the documents' column's width and fold,
  and opens as a sheet on the phone.
- **The thought** is a new cache item: the runner records each thinking block as one, with its
  length, and its text when the harness gives one. See the [data model](data-model.md).
- **The New page's cards** replace its segmented control, and keep each kind's form as it is today.

Tradeoffs:

- Two shapes of right column, tabs for documents and a split for a session: each is simpler than one
  shape that bends for both.
- Files changed by a command, like a code generator, appear only once they are committed.
- Thought rows say little for Claude Code until it gives thinking text.

## Edge cases

| Importance | Situation                                                   | What happens                                                                                        |
| ---------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| High       | A session of thousands of calls                             | The Activity mounts the latest 200 rows, and "Show earlier runs" adds 200 more; typing stays smooth |
| High       | A denied action, an offer, or "Jump to latest" in a session | They stay in the chat, where they are today                                                         |
| Normal     | The column folded with `]`                                  | A recap line unfolds it, at its stretch                                                             |
| Normal     | An edit call that failed                                    | It shows in the Activity, failed, and does not count in "This session"                              |
| Normal     | A session that changed no file yet                          | Changes reads "No file changed yet."                                                                |
| Normal     | A feature's session before its plan exists                  | No progress bar                                                                                     |
| Normal     | A stretch of a single call                                  | Its recap line reads the call, "read src/tasks/undo.ts", not a count                                |
| Niche      | A sub-agent that starts its own sub-agents                  | They show as rows of their parent's group, not in the Sub-agents tab                                |
| Niche      | A session cached before thoughts were stored                | Its stretches count no thought; nothing is rebuilt                                                  |

## Success criteria

- **SC-001** (no call rows in the chat): A session of 3 runs and 30 calls draws 3 to 6 recap lines
  in the chat, and no row per call.
- **SC-002** (bounded rows): A session of 5,000 calls mounts at most 200 activity rows, by a count
  of what draws.
- **SC-003** (one component each): The activity, the changes, and the progress bar are each drawn by
  one component, imported by the session page and nowhere redrawn.
- **SC-004** (one click to a stretch): From any recap line, the Activity shows that stretch in one
  click at the wide and semi-wide widths, and one tap on the phone.
- **SC-005** (kind in the address): Reloading New keeps the picked kind.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, except
these, changed by your notes:

- **The session beside a document** is called an embedded session, and draws the session page's
  compact chat, as you asked.
- **Sub-agents** get a tab while one runs, and stay groups in the Activity, as you asked.

Settled while writing this spec:

- A stretch is the calls and thoughts between two texts of a turn; a run is a turn, as the chat's
  "Run:" divider already names it.
- A recap line's time is the sum of its calls' and thoughts' lengths.
- A thought's length runs from its block's start to the agent's next event, as the runner sees them.
- The column's tab and the open sheet are in the address, `?tab=` and `?sheet=`, as the
  [UI layout](../decisions/ui-layout.md) decision asks.
- The Changes pane takes at most 40% of the column's height, and scrolls past it.
- The New page's form under each card is today's form for that kind, unchanged.
- The old prototypes in `mockups/` stay until the approval deletes them.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: the runner's cache gains a kind of item, and two pages are redrawn; no workflow file
changes.
