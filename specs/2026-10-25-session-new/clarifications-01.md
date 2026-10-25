---
status: answered
---

# Clarifications, round 01: Session and New in the terminal look

> [!NOTE]
>
> Answered on 2026-10-25. 5 questions, about 15 minutes.
>
> - Verdict: worth building, with changes. The split of chat and activity is cheap, but Claude Code
>   gives no thinking text today, and the server keeps no content of an edit.
> - Thinking recaps: you asked whether Claude Code gives them. Not yet, and the UI will not promise
>   them.
> - Session layout, with three mockups to open: it decides how every later feature page uses the
>   right column.
> - Last edit's diff: needs the server to keep each edit's content in its cache, bounded.
> - Settled points to check: what the Changes list holds, and how big the cache of edits grows.

## Context

### Goal

Redraw the session page and the New page in the terminal look and the three-column shell of the
questions and spec pages. A session reads chat first, with what the agent did, its sources, and its
changes second. New tells its three kinds apart, so a new user picks the right one the first time.

### Today

| Part                    | What exists                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session page            | One column: [header, transcript, composer](/packages/web/src/SessionView.tsx). Tool calls are Astryx groups between messages, folded behind their count.            |
| Session's right column  | Only for a feature or a change: [step and tasks, sub-agents, committed changed files, pages](/packages/web/src/SessionAside.tsx). Not the tabs column of documents. |
| Documents' right column | [Tabs](/packages/web/src/layout/DocumentColumn.tsx): Outline, Notes, Session. A third of the window, 400 to 600 px.                                                 |
| Thinking                | A live "Thinking" line only. The model's thinking text is empty in Claude Code's stream.                                                                            |
| Content of an edit      | Not kept: the cache holds a call's name, target, and output cut to 4,000 characters ([`Item`](/packages/server/src/runner/events.ts)).                              |
| New page                | A [segmented control](/packages/web/src/NewPage.tsx) picks Session, Change, or Feature, each with a sentence and its steps as icons.                                |

### Scope

This feature covers the session page, its right column, what the transcript shows of tool calls and
thinking, and the New page. It leaves out the feature page, the inbox and priorities pages, and the
Pi-style per-pane keys. The session beside a document is only touched to stay coherent.

### Sources

- The code: the session and New pages, the shared column, the runner's items and events.
- Pi's [README](https://app.unpkg.com/@mariozechner/pi-coding-agent@0.68.0/files/README.md), Zed's
  [agent panel](https://zed.dev/docs/ai/agent-panel), and Codex's
  [review pane](https://learn.chatgpt.com/docs/code-review?surface=app).
- Anthropic's
  [thinking documentation](https://platform.claude.com/docs/en/build-with-claude/thinking) and
  Claude Code's [settings](https://code.claude.com/docs/en/settings-reference.md), and three
  throwaway runs of Claude Code.
- The full investigation is in [discovery](discovery-01.md).

## Check these

- **Thinking recaps** are not promised. Claude Code 2.1.310 returns an empty thinking block, with or
  without its summaries setting, in three runs. The transcript shows a thought as a row with its
  length, and the text only if a harness gives it. See
  [discovery](discovery-01.md#thinking-and-progress-updates).
- **The Changes list** stays the branch's committed files, as today. The last edit's diff, if you
  want it, is the only place uncommitted work shows. See [discovery](discovery-01.md#the-last-edit).
- **The cache grows by the content of edits**, kept to a bound, only for edit tools. The cache is
  not workflow state, and a reset loses nothing durable. See [discovery](discovery-01.md#the-code).

## Q1: Which layout should the session page take?

Three prototypes, in Catppuccin Mocha, with the left navigation, the chat, and the right column at a
wide window. The same session in each: an agent reads three files, searches, fetches a library page,
thinks twice, edits two files, and runs the tests.

- [Session A](mockups/session-a.html): the chat holds one recap line per run of calls, such as
  "Worked 2 min · read 3 files · searched 1". The right column is tabs, like the documents'.
- [Session B](mockups/session-b.html): the same chat, and your idea of a vertically split sidebar:
  the live activity above, the last edit's diff and the changes below.
- [Session C](mockups/session-c.html): one typed line per call stays in the chat, between the
  messages, and the column's tabs hold the sources, the changes, and the progress.

Pi folds tools and thinking apart, Zed and Codex give the changes a panel of their own. Nobody keeps
every call in the reading flow. More in [discovery](discovery-01.md#session-layout).

Why it matters: the right column is shared with the questions, spec, and plan pages. The layout
decides what the feature page and later pages reuse.

- **A (recommended). The chat holds one recap line per run of tool calls and thinking, and the right
  column is tabs: Activity, Changes, Progress.**
  - [pro] The column is the documents' own tabs component, so the pages stay coherent.
  - [pro] A long activity log gets the column's full height, and a recap line opens it at that run.
  - [con] Watching live activity needs the Activity tab open, and the diff is one click away.
  - Why recommended: it follows the questions and spec pages' decision and keeps the chat first.
- **B. The chat holds a recap line, and the right column is split in two. Live activity sits above,
  and the last edit's diff and the changed files below, with the step as a small pane.**
  - [pro] Activity and the last diff are always in view, with no click.
  - [con] Each pane gets half the window's height in a column 400 px wide, so both read cramped.
  - [con] It is a new kind of column, and the document pages' column keeps tabs.
- **C. Each tool call stays in the chat as a typed line, and the column's tabs are Sources, Changes,
  Progress.**
  - [pro] The chat shows what happened where it happened.
  - [con] Rows between messages break the chat-first reading you asked for.

**Answer:** B: I want to re-take the list view of view A (tool calls per run/turn), but the layout
of B.

I also feel like there's a bit too many panes going on in B, we can keep it a bit lighter. The idea
is to split the column in two with tool calls on the top, and changes on the bottom. Maybe a small
progress bar at the very bottom.

## Q2: Where should the diff of the last edit come from?

Example: the agent changes `complete.ts` and `complete.test.ts`, then runs `pnpm test`, which writes
a file. Which of these shows as "the last edit"?

Codex's review pane has a "Last turn" scope, and Zed lists the files changed with their counts. The
server does not keep an edit's content today, and the branch changes it lists are committed ones
only. More in [discovery](discovery-01.md#the-last-edit).

Why it matters: the first option adds content to the cache, the second adds a Git read, and the
third adds neither.

- **A (recommended). Keep each edit tool call's own input in the cache, cut to a bound, and show the
  last one's diff.**
  - Example: the diff of `complete.test.ts`, the last edit, shows the lines the agent wrote.
  - [pro] It shows uncommitted work exactly as the agent wrote it, with no Git read.
  - [con] An edit made by a command, like a code generator, does not show.
  - [con] The cache grows by the size of each edit, up to the bound.
  - Why recommended: it is the diff you asked for, and the cache is rebuildable.
- **B. Read Git's diff of the session's checkout.**
  - Example: the diff shows `complete.ts` and the file the test run wrote, as Git sees them.
  - [pro] It shows every change, commands included.
  - [con] It is not "the last edit", and the main checkout may hold changes the session never made.
- **C. No diff: the Changes tab lists files and counts only.**
  - [pro] Nothing new to build or store.
  - [con] You cannot see what changed without opening the file.

**Answer:** C: Let's keep it simple

## Q3: What should the transcript show for the model's thinking?

Claude Code returns the thinking block empty. Anthropic's API has "progress updates", a note on what
the model just found and what it will do next, one before a tool call. They need a beta header, or
Sonnet 5.5's `between_tools` setting. No Claude Code flag for them was found, and the runs I made
returned empty blocks. More in [discovery](discovery-01.md#thinking-and-progress-updates).

Why it matters: option B can cost a setting that may not exist, and the layout in Q1 holds either
answer.

- **A (recommended). Show a row per thought with its duration, and its text only if a harness gives
  it.**
  - Example: "thought · 8 s", unfolding to nothing today.
  - [pro] Honest about what the agent gave, and no work to chase a setting.
  - [con] The rows say little for Claude Code today.
  - Why recommended: it shows a quiet agent from a stuck one, and fills in without a redesign.
- **B. Also make the plan's first task find a way to get progress updates from Claude Code, and show
  them as the recaps.**
  - [pro] You get the short notes you hoped for, if it works.
  - [con] It may need a beta header Claude Code cannot send, and the task may end in nothing.
- **C. Leave thinking out of the transcript, and keep only the live "Thinking" line.**
  - [pro] Fewer rows.
  - [con] A finished turn shows nothing of the thinking it spent time on.

**Answer:** A

## Q4: Should a session without a workflow get the right column too?

A session in the main checkout, with no feature or change, has activity and changes like any other.
Today only a feature's or a change's session has a column.

Why it matters: it decides whether the session page has one layout or two.

- **A (recommended). Every session gets the column, and Progress shows only when a workflow
  exists.**
  - [pro] One layout, and the Activity and Changes tabs help a plain chat too.
  - [con] A plain chat shows a column whose Progress tab is empty or absent.
  - Why recommended: it is the one layout the shared column was made for.
- **B. Only a feature's or a change's session has the column, as today.**
  - [pro] A plain chat stays as simple as plain Claude Code.
  - [con] Two layouts to keep and test.

**Answer:** A

## Q5: How should the New page tell its three kinds apart?

Example: you want to "add recurring tasks" and you open New. Which page makes you pick Feature, not
Session?

The page names Session, Change, and Feature in a segmented control today, with one sentence each.
Three prototypes, each with the same three kinds:

- [New A](mockups/new-a.html): three cards side by side, each with a sentence, an example prompt,
  its steps, and what waits on you. The picked card's form is under them.
- [New B](mockups/new-b.html): stacked choices, then a table of use, ending, what waits on you, and
  length.
- [New C](mockups/new-c.html): one composer first, the kind chosen under it, with a live sentence.

More in [discovery](discovery-01.md#new-page-layout).

Why it matters: a wrong first pick costs a session you then convert. Change and feature also need a
title or a note, which a single composer does not hold.

- **A (recommended). Three cards side by side, each with its use, an example, its steps, and what
  waits on you, and the picked kind's form under them.**
  - [pro] All three read at once, with the same facts in the same places.
  - [con] On a phone, the cards stack and the form moves down.
  - Why recommended: it compares the kinds without a table and keeps each kind's own form.
- **B. Stacked choices, then a table comparing the kinds.**
  - [pro] The table puts the differences on one row each.
  - [con] It is longer, and the choice and the table repeat each other.
- **C. One composer first, with the kind chosen under it.**
  - [pro] The shortest path for a session, the most common start.
  - [con] The kinds are told apart by one line of text, and change and feature need other fields.

**Answer:** A: Pretty good but the cards at the moment look too busy and don't have clear enough
hierarchy in their inside content

## Settled without the human

### Behaviour

- **The session beside a document** stays the chat only, with a link to the session's own page. A
  session column inside the documents' column would nest two columns. See
  [discovery](discovery-01.md#needs-no-choice).
- **Narrow screens** show the chat as the page. The column's content opens as a sheet from the
  status line, as the questions page's outline does. See
  [discovery](discovery-01.md#needs-no-choice).
- **Sources** are the files the agent read, the searches it ran, and the pages it fetched, from the
  tool calls of those kinds. See [discovery](discovery-01.md#needs-no-choice).
- **Sub-agents** stay groups in the activity, as the transcript draws them now. See
  [discovery](discovery-01.md#needs-no-choice).
- **The three kinds' names** stay Session, Change, and Feature, as the UI uses them. See
  [discovery](discovery-01.md#the-new-pages-three-choices).

### Under the hood

- **The activity log** mounts a bounded number of rows and none of the folded content, as the UI
  behaviour decision asks. See [discovery](discovery-01.md#rules-and-their-owners).
- **Changed files and tasks** are drawn by components the feature page can reuse, as the UI
  coherence decision asks. See [discovery](discovery-01.md#rules-and-their-owners).
- **The columns' width and fold** are the documents' column's, kept in the browser for every page.
  See [discovery](discovery-01.md#needs-no-choice).

**Notes:**

- **The session beside a document**: Yes, we need a name for that ("embedded session"?). Use the
  "compact" main session view (the center column).

  Our approach actually fits even better: since the main column becomes lighter, it's easier to
  embed it.

- **Sub-agents**: I want a "sub-agents" tab if any of them are running.
