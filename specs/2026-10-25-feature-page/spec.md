---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Feature page in the terminal look

> [!IMPORTANT]
>
> Spec to review, about 20 minutes.
>
> - You approve a feature's Home in titled panes: Next, then a timeline of stages holding their
>   files, and a column of sessions, figures, and links. No tab line, as you chose.
> - Next always offers one action: "Continue, write the plan" opens the session with that message,
>   unsent. The name's "…" holds Rename and Drop.
> - Figures gain the agent's working time and the elapsed time. No cost in dollars.
> - The Storybook page goes, as you chose. A story linked inside a sentence then opens on a page of
>   its own, in the live window, instead of in Storybook's interface: my reading, check it.
> - The proposal, discovery, rulings, data model, and record pages get the documents' column,
>   Contents and Session, their sections in panes.
> - Risk tier `medium`: Drop moves to a page you visit often, and two routes go.

A feature's page is the hub the shell's cards open, and the last page of a feature still in the old
look. This feature redraws it in the terminal look: what comes next first, then a timeline of the
stages that made it, each with its files, and a column with its sessions, figures, and links. It
also brings the old-look document pages in line, and removes the Storybook page. See the
[proposal](proposal.md), the [discovery](discovery-01.md), and the
[clarifications](clarifications-01.md).

## Decisions

No decision is created, changed, or removed.

Relied on:

| Decision                                     | What it means for this spec                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| [UI look](../decisions/ui-look.md)           | every part is a titled pane in the theme's colours                                |
| [UI layout](../decisions/ui-layout.md)       | a foldable, resizable column; the session stays a page; mockups at three widths   |
| [UI coherence](../decisions/ui-coherence.md) | the column, the panes, and the session tab are the spec page's own components     |
| [UI behaviour](../decisions/ui-behaviour.md) | Drop asks first; Continue never sends by itself; every action by tap and keyboard |
| [Problems](../decisions/problems.md)         | only what stops the workflow is a banner; other notes stay folded                 |
| [Preview](../decisions/preview.md)           | the mockup is an HTML layout mockup; the plan's stories hold the real components  |

## User stories

### US1: A Home of what comes next and how it got there (P1)

You open a feature from the shell and read what comes next first, then its timeline: each stage with
its times and the files it made, the current one marked. The column beside it holds the sessions,
the figures, and the links; on the phone, they follow the timeline in one column.

[Building, wide](mockups/feature.html?state=building&w=1440)

[Waiting on you, at 1205 px](mockups/feature.html?state=gate&w=1205)

[Building, on the phone](mockups/feature.html?state=building&w=390)

[A change, its column folded](mockups/feature.html?state=change&fold=1&w=1440)

Key scenarios:

1. **Given** Recurring tasks building task 5 of 9, **When** its page opens at 1440 px, **Then** the
   "Next" pane reads "The agent is building" and "Task 5 of 9: Undo restores the previous due date",
   with "Open the session".
2. **Given** that feature, **When** the timeline draws, **Then** Questions shows "09:32 · 3 h 10 min
   · 1 round" and links Discovery 01 and Questions 01, and Build is marked current with its tasks.
3. **Given** its spec waiting for review, **When** the page opens, **Then** "Next" is a peach pane
   reading "You review the spec", and Spec's file reads "to review".

More scenarios:

1. **Given** the page at 390 px, **When** it draws, **Then** Next, the timeline, Sessions, "Produced
   so far", and Links follow in one column.
2. **Given** the column, **When** you press `]`, **Then** it folds to a rail and the timeline takes
   the room; the width and fold are the documents' column's.
3. **Given** a change at its fix, **When** its page opens, **Then** its stages are Proposal,
   Questions, Fix, Pull request, and Merged, and Rulings sits under Fix.

### US2: Continue, rename, and drop from the Home (P1)

When the agent is idle at its step, "Next" offers one button with the step's recommended message. It
opens the feature's session with that message in the composer, unsent. The "…" beside the name
renames or drops the feature.

[The agent idle, at 1205 px](mockups/feature.html?state=idle&w=1205)

[The name's menu open](mockups/feature.html?state=gate&menu=1&w=1440)

Key scenarios:

1. **Given** Recurring tasks with its spec approved and its agent idle, **When** its page opens,
   **Then** "Next" reads "The agent writes the plan" with the button "Continue, write the plan".
2. **Given** that page, **When** you click "Continue, write the plan", **Then** the feature's
   session opens with that message in its composer, unsent, and Send reads "Start the agent".
3. **Given** the "…" beside the name, **When** you pick "Drop the feature…" and confirm, **Then**
   the feature is dropped as from the session, and Home opens with "Dropped the feature
   recurring-tasks: its branch 2026-10-06-recurring-tasks stays."

More scenarios:

1. **Given** the agent working, **When** the page draws, **Then** Next's one button is "Open the
   session".
2. **Given** "Rename" picked, **When** you rename the feature to "Repeating tasks", **Then** the
   shell's card reads "Repeating tasks", and the page keeps its proposal's title, as today.
3. **Given** "Drop the feature…" picked, **When** you cancel, **Then** nothing changes.

### US3: What a feature produced (P2)

The column's figures add how long the agent worked and how long the feature has taken. A done
feature keeps one page: its timeline, its record drawn in place, and what it produced.

[Merged](mockups/feature.html?state=done&w=1440)

Why this priority: the figures exist today; the new ones add to them.

Key scenarios:

1. **Given** Recurring tasks, started at 09:12, building at 15:14, with turns of 52 min and 1 h 59
   min, **When** its page draws, **Then** "Produced so far" reads "agent time 2 h 51 min" and
   "elapsed 6 h 02 min".
2. **Given** the feature merged, **When** its page opens, **Then** "Next" reads "Merged" and "On Oct
   6, in pull request #31.", Merged links Record, and the record's parts follow the timeline.
3. **Given** that merged feature, **When** "What it produced" draws, **Then** it reads total time,
   lines, tokens, agent time, questions, and decisions, the last two leading to the record's parts.

More scenarios:

1. **Given** a turn running for 4 min, **When** the page draws, **Then** agent time counts it to
   now, and grows while it runs.
2. **Given** a feature with no turn recorded, **When** the page draws, **Then** agent time reads
   "Not recorded", as tokens do.

### US4: Document pages in the terminal look (P2)

The proposal, a discovery, the rulings, the data model, and a record's file read as the spec does:
each `##` section a titled pane, and beside them the documents' column, Contents and Session.

[The proposal, wide](mockups/feature.html?page=proposal&w=1440)

[The proposal, on the phone](mockups/feature.html?page=proposal&w=390)

Key scenarios:

1. **Given** Recurring tasks' proposal, **When** it opens at 1440 px, **Then** What, Why, and Notes
   are panes, with Edit beside the title, and the column holds Contents and Session.
2. **Given** that page, **When** you select a paragraph and pick "Ask the agent", **Then** the
   Session tab opens with "About specs/2026-10-06-recurring-tasks/proposal.md, lines 9–10:" and the
   paragraph quoted in its composer, as on the spec.
3. **Given** the proposal at 390 px, **When** it draws, **Then** no column shows, and the status
   line holds "Contents" and "Session".

More scenarios:

1. **Given** the data model opened alone, **When** it draws, **Then** its panes stay as today, with
   the column beside them.
2. **Given** a done feature's record file, **When** it opens, **Then** it draws in panes with
   Contents only: its feature has no session to ask in.

### US5: No more Storybook page (P3)

The Storybook page, Storybook's own interface in a frame, goes from everywhere. Live stories in
documents and sessions stay, and a story linked inside a sentence opens on a page of its own.

Key scenarios:

1. **Given** the feature page, a session's column, and a change's column, **When** each draws,
   **Then** none links "Storybook".
2. **Given** "the open menu" linked to `RepeatMenu.stories.tsx#Open` inside a sentence, **When** you
   click it, **Then** a page shows that story alone in the live window, with Phone and Desktop.
3. **Given** a bookmark to `/f/2026-10-06-recurring-tasks/storybook`, **When** it opens, **Then**
   the feature's Home opens in its place.

More scenarios:

1. **Given** a live story that no longer exists, **When** it draws, **Then** it reads as today,
   without "Open in Storybook".
2. **Given** any page of the feature, **When** it opens, **Then** its Storybook still starts for the
   live stories, as today.

## Architecture

The Home is drawn from the parts the questions and spec pages built: the titled pane, the documents'
column, and the session tab. Its timeline replaces both the stepper and the file list, so each file
has one place. The figures' new sums come from the runner cache's turns, beside the tokens. See
[discovery](discovery-01.md#approaches).

- **The Home** draws the head, the blocking banner, Next, the timeline, and a done feature's record,
  with the column beside them. It owns the page's order; it replaces `FeaturePage`'s cards.
- **The timeline** draws each stage with its times, its files, and the build's tasks. It owns which
  file sits in which stage, from its kind: a proposal in Proposal, a discovery and a round in
  Questions, the spec, its review, the data model, and mockups in Spec, the plan, its review, and
  the rulings in Plan or Fix, the record in Merged.
- **Next** keeps today's words per step, and adds the step's recommended message as its button while
  the agent is idle at an agent's step. It owns the one action.
- **The feature's menu** holds Rename, today's dialog, and Drop, today's confirmation, moved out of
  the session's actions so both pages share them.
- **The Home's column** stacks Sessions, the figures, and Links in the documents' column. It owns
  nothing new: its width and fold are the documents' column's.
- **The figures** add agent time, summed from the feature's turns, and elapsed time, from the
  proposal's stage to now. The server sums them where it sums tokens, and owns what they count.
- **The document page** draws a file's `##` sections as panes, with the column of Contents and
  Session. It replaces `DocumentPage`, and the data model gains the column.
- **The story's page** draws one story in the live window, from an inline link. It replaces the
  Storybook page, whose routes redirect.

Tradeoffs:

- A file is one click from the Home, in its stage, not one tab from every page.
- A long feature's timeline runs past the screen's height, its current stage below the fold on the
  phone.
- Drop sits on the Home behind its confirmation, a page you visit often.

## Edge cases

| Importance | Situation                                                    | What happens                                                                          |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| High       | Continue clicked with text already in the session's composer | the message goes before your text, unsent, as the composer's Insert does              |
| High       | Drop fails, or a hook refuses its commit                     | the page stays, and the refusal shows under the name until dismissed                  |
| High       | The step changes while the page is open                      | Next and its button follow the live update; a stale Continue runs as a chat, as today |
| Normal     | The agent is unavailable on this machine                     | Next has no button, and reads "<agent> is not available on this machine"              |
| Normal     | A blocked feature                                            | "This feature cannot go on" comes before Next, with its file's button                 |
| Normal     | A done feature whose commits were not traced                 | the timeline shows Merged alone, and the figures read as today                        |
| Normal     | A worktree or branch left after the merge                    | the left-worktree banner shows before Next, as today                                  |
| Niche      | A turn left without an end, after a crash                    | agent time leaves it out                                                              |
| Niche      | A document without `##` sections                             | its text draws in one pane titled by the file's name                                  |

## Success criteria

- **SC-001** (one place): Every file of the feature's folder shows once on its Home, in one stage.
- **SC-002** (one click): From the Home, any agent step starts in one click and one Send.
- **SC-003** (contrast): Every new pane's text reaches 4.5:1, and its border 3:1, in Mocha and
  Latte.
- **SC-004** (three widths): At 1440, 1205, and 390 px, the Home and the document pages scroll only
  vertically, and nothing hides under the status line.
- **SC-005** (no Storybook): No page of the app links Storybook's interface.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, except
where your answers changed them. With no tab line, the Session tab, the phone's tab line, and a
change's tabs no longer apply. Settled while writing this spec:

- **The Storybook page's inline links**: removing the page leaves story links inside sentences, in
  documents and sessions, with nowhere to go. They open a page of their own with the live window,
  the spec page's, instead of breaking. See
  [Removing Storybook](discovery-01.md#removing-storybook).
- **Continue's label** is the recommended message's own name, so the button and the composer's
  Insert say the same thing.
- **No "not yet" rows**: a stage not reached yet shows its name only, dimmed.
- **A done feature has no "…"**: its branch is merged or gone, so neither Rename nor Drop applies.
- **Elapsed** counts from the proposal's stage to now, or to the merge once done, where it reads
  "total time" as today.
- **The document pages' Session tab** shows only for a live feature whose agent is available, as on
  the spec page.
- **The mockup** is an HTML layout mockup; the round's prototypes stay in git history once deleted.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: Drop moves to the Home, the Storybook routes go, and the server sums new figures; no
stored data changes.
