# Discovery, round 01: Session and New in the terminal look

## Summary

Agent UIs split what the agent says from what it does. The words stay in the chat. The doing, reads,
searches, web fetches, edits, and commands, folds into counts, a log, or a side panel, and the files
changed get their own review. Pi folds tool output and thinking separately, and Zed and Codex review
the changes in a panel of their own.

The proposal asks for that split in Uraeda's session, inside the shell the questions and spec pages
set: left navigation, content, and a right column. It also asks for a New page with three clearly
different choices.

Today the session page is one column. Tool calls fold into Astryx's own groups between messages, the
right column holds the step, tasks, sub-agents, changed files, and links, and thinking only shows as
a live "Thinking" line. Two things the proposal hopes for are missing from the data: the text of the
agent's thinking, which Claude Code gives empty, and the content of an edit, which the server never
keeps.

## How other products do it

### Pi

- Pi's interactive screen shows messages, tool calls and results, notifications, and errors in one
  column. Two keys toggle it: Ctrl+O "Collapse/expand tool output" and Ctrl+T "Collapse/expand
  thinking blocks"
  ([pi-coding-agent README](https://app.unpkg.com/@mariozechner/pi-coding-agent@0.68.0/files/README.md)).
  Tools and thinking fold apart, each with its own key.
- The proposal's Reddit post, a split of thoughts, tools, usage, and responses into separate panes,
  could not be read: see [Not checked](#not-checked).

### Claude Code

- In the terminal, thinking is a collapsed stub, expanded with Ctrl+O when `showThinkingSummaries`
  is on. Unset, "the Anthropic API redacts thinking blocks and Claude Code shows a collapsed stub".
  The setting's text speaks of interactive sessions
  ([settings reference](https://code.claude.com/docs/en/settings-reference.md)).
- `verbose` shows "full tool output instead of truncated summaries", the same page says. The
  terminal keeps one column and truncates.

### Zed

- Responses stream "with indicators showing which tools the model is using". Once the agent edited,
  the panel "will surface which files, how many of them, and how many lines have been edited", in an
  accordion above the message editor. "Review Changes" opens a tab with every change, accepted or
  rejected by hunk ([agent panel](https://zed.dev/docs/ai/agent-panel)).
- The page says nothing about thinking blocks.

### Codex app

- The review pane is a Git diff with scopes: Unstaged, Staged, Commit, Branch, and "Last turn (the
  most recent assistant turn)". Comments attach to a line, and stage or revert works per diff, file,
  or hunk ([code review](https://learn.chatgpt.com/docs/code-review?surface=app)).

### What they have in common

- Tools and thinking are not in the reading flow: folded behind a count or a key (Pi, Claude Code).
- The changes have a place of their own, with counts first and the diff one click away (Zed, Codex).
- A scope of "the last turn" exists, which is the proposal's "diff of the last file edited" in a
  wider form (Codex).
- Nobody shows the model's raw reasoning. See [thinking](#thinking-and-progress-updates).

## Standards and libraries

### Thinking and progress updates

- Thinking text is a summary: "No `display` setting returns the raw chain of thought".
  `display: "summarized"` returns it, and `"omitted"` returns blocks with an empty `thinking` field.
  The default is `omitted` on Opus 5.5, Sonnet 5.5, Haiku 5.5, and the other current models
  ([thinking](https://platform.claude.com/docs/en/build-with-claude/thinking)).
- The same page has a beta `display: "updates"`, for "an agent interface that keeps reasoning hidden
  and shows the user a status line at each step". A progress update is "a note on what the model
  just found and what it's about to do next, written for the person watching the agent". At most one
  comes before each tool call. It needs the beta header `thinking-display-updates-2026-08-18`.
  Sonnet 5.5's `between_tools` setting returns them too, without a header.
- Claude Code hides the choice. Experiments in a temporary folder, with Claude Code 2.1.310 in print
  mode, stream-json, and `--effort high`: the thinking block arrives with `thinking` empty and a
  signature. The same with `--settings '{"showThinkingSummaries":true}'`. See
  [verified](#worth-it-and-feasibility).
- `CLAUDE_CODE_FORWARD_SUBAGENT_TEXT=1` emits sub-agent text and thinking blocks in stream-json
  ([environment variables](https://code.claude.com/docs/en/env-vars.md)). The page was read to its
  first 100,000 characters.

### Astryx chat components

- Already in use: `ChatMessageList`, `ChatMessage`, `ChatToolCalls`, and a decision that calls out
  `ChatToolCalls`' habit of mounting every row, handled by
  [`ToolGroups.tsx`](/packages/web/src/ToolGroups.tsx)
  ([UI components](../decisions/ui-components.md)).

## The code

### Important reads

- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx), 150 lines: opens a feature's session,
  hands a feature over, asks about a quote. Draws one `SessionPane` in a `Page` with crumbs.
- [`SessionView.tsx`](/packages/web/src/SessionView.tsx), 340 lines: header, progress line,
  transcript, attention, composer, in one column. It also draws the pane in a box for the document
  column's Session tab.
- [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx), 381 lines: the session's right column,
  made with `SideColumn`. Sections: step and tasks, sub-agents, "Changed on the branch" (committed
  files, first 50), and the feature's pages. A change's column is
  [`ChangeAside.tsx`](/packages/web/src/ChangeAside.tsx). It is a different column from the document
  column's tabs.
- [`layout/DocumentColumn.tsx`](/packages/web/src/layout/DocumentColumn.tsx): the tabs column of the
  questions, spec, and plan pages. A third of the window, 400 to 600 px, tabs in the address
  (`?tab=`), `]` folds it. Reusable: it takes a list of tabs.
- [`TranscriptMessages.tsx`](/packages/web/src/TranscriptMessages.tsx), 302 lines, and
  [`ToolGroups.tsx`](/packages/web/src/ToolGroups.tsx): a turn's items become messages, text, and
  tool groups by run. Open state is kept by the page.
- [`tail.tsx`](/packages/web/src/tail.tsx), 500 lines: draws only the latest messages, as the
  [UI behaviour](../decisions/ui-behaviour.md) decision asks for logs that grow.
- [`NewPage.tsx`](/packages/web/src/NewPage.tsx), 247 lines: a segmented control picks Session,
  Change, or Feature, in the address (`?kind=`). Each has one sentence and its steps as an icon
  line, then its form. Change and feature also list notes and priority lines to start from.
- [`runner/events.ts`](/packages/server/src/runner/events.ts): the `Item` the cache keeps. A tool
  item has name, kind (read, edit, search, fetch, execute, think), target, output cut to 4,000
  characters, duration, status. It keeps no tool input and no thinking item.
- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts): thinking blocks become
  an "activity" event for the live line. Their text is never read, nor stored.
- [`crates/core/src/changes.rs`](/crates/core/src/changes.rs): the branch's changes are committed
  ones only, between two commits, with counts per file and no diff text.
- Another open feature branch does not touch these files: the questions and spec pages are merged,
  and the feature page and inbox drafts are not started.

### The proposal's path and existing actions

- Opening a session today: one column, the header, the progress line, the transcript, the composer.
  The right column shows on wide screens, and the status line and folding follow the shell.
- Asking from a document: the session opens as a tab of the document column, in a box, with a link
  to its page. A session sidebar there would sit inside another sidebar.
- A session without a workflow, in the main checkout, has no right column.
- A running turn: the tail follows its end. Tool groups and sub-agents grow while it runs, and the
  live "Thinking" line shows the activity.
- Denied actions, offers, and the "Jump to latest" button live in the transcript and must keep
  working wherever tool calls move.
- The New page: sending a session's first message opens it, and Change and Feature write a file.

### Rules and their owners

- A kind of information has one component on every page
  ([UI coherence](../decisions/ui-coherence.md)): changed files and tasks now draw in
  `SessionAside.tsx` only, but the feature page draws its own progress and sessions. The next
  feature, [feature page](../2026-10-25-feature-page/proposal.md), will want the same panes.
- Mounted rows are bounded, and folded content is not mounted
  ([UI behaviour](../decisions/ui-behaviour.md)): any activity log in a tab must follow it.
- A feature's session may sit beside documents in the right column, at least 400 px
  ([UI layout](../decisions/ui-layout.md)).

### Likely changes

- [`SessionView.tsx`](/packages/web/src/SessionView.tsx),
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx): the page takes the three-column shell. All
  options.
- [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx),
  [`ChangeAside.tsx`](/packages/web/src/ChangeAside.tsx): become tabs or split panes of the shared
  column. With option A or B of [the layout](#session-layout), the column gains an Activity part.
- [`TranscriptMessages.tsx`](/packages/web/src/TranscriptMessages.tsx),
  [`ToolGroups.tsx`](/packages/web/src/ToolGroups.tsx): one recap row per run instead of Astryx's
  group, with option A or B.
- [`runner/events.ts`](/packages/server/src/runner/events.ts),
  [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts), the cache: a stored
  tool input for edits, with option A of [the last edit](#the-last-edit).
- [`NewPage.tsx`](/packages/web/src/NewPage.tsx): redrawn, with the layout picked in
  [New](#new-page-layout).

## The proposal

### Thinking recaps

The proposal asks whether Claude Code gives "small recaps". Not today: its thinking text is empty in
the stream, with or without the summaries setting. A progress update is such a recap, but no Claude
Code flag was found that requests it. See
[thinking and progress updates](#thinking-and-progress-updates).

### "Diff of the last file edited, or the full last tool call"

Two different things: the content of an edit, which the server does not keep, or a Git diff. The
committed changes the session column lists today do not include uncommitted edits, which are what
the agent just did.

### "A vertically split sidebar"

The questions and spec pages' column is tabs, one panel at a time. A vertical split shows two panels
at once, which fits live activity above and a diff below, but each gets half of a window's height,
and the column is 400 px wide at least.

### "Sources and changes second", and what sources are

The proposal's "sources" is not defined. In the products read, the nearest things are what the agent
read and fetched. Here it is the tool items of kind read, search, and fetch.

### The New page's three choices

The existing page already names three kinds, each with a sentence and steps. The proposal asks to
make them "clearly different". No test with new users exists; the differences that can be shown are
what each is for, an example, what it ends with, and what waits on the human.

## Worth it and feasibility

Worth building, with changes. The split of chat and activity is cheap: the data of calls is already
in the cache, and the shell and the tabs column exist. Two parts are not cheap:

- **Thinking text.** Verified: Claude Code 2.1.310 in print mode, Sonnet, `--effort high`, returns
  an empty thinking block, with or without `showThinkingSummaries`, in a throwaway folder outside
  the repository. Progress updates are documented for Sonnet 5.5 and Opus 5.5 but unverified through
  Claude Code. The plan's first task would check for a flag or setting that requests them.
- **Content of an edit.** The server keeps no tool input. Keeping it grows the cache by the size of
  each edit, cut to a bound.

No guard is relaxed by any option.

## Approaches

Criteria come from [the proposal](proposal.md), the [UI layout](../decisions/ui-layout.md),
[UI coherence](../decisions/ui-coherence.md), [UI behaviour](../decisions/ui-behaviour.md), and
[UI look](../decisions/ui-look.md) decisions.

### Session layout

How the chat, the tool calls, and the right column share the page. Relies on
[how other products do it](#how-other-products-do-it) and [the code](#the-code).

| Option                                                          | Chat reads first            | Activity visible live | Changes and diff | Fits the shared column      |
| --------------------------------------------------------------- | --------------------------- | --------------------- | ---------------- | --------------------------- |
| A. Recap lines in chat, tabs Activity, Changes, Progress        | Yes                         | One tab click away    | A tab            | Yes, same tabs as documents |
| B. Chat with a recap, sidebar split: Activity above, diff below | Yes                         | Always                | Always           | New: two panes, no tabs     |
| C. Typed rows stay in chat, tabs Sources, Changes, Progress     | Less: rows between messages | In the chat           | A tab            | Yes                         |

Mockups: A (`mockups/session-a.html`, deleted), B (`mockups/session-b.html`, deleted), C
(`mockups/session-c.html`, deleted).

### The last edit

Where the diff of the last edit comes from. Every layout has a place for it: B's lower pane, or the
Changes tab of A and C.

| Option                                             | Shows uncommitted work | Needs new storage | Shows edits made by commands |
| -------------------------------------------------- | ---------------------- | ----------------- | ---------------------------- |
| A. The edit's own input, kept bounded in the cache | Yes                    | Yes               | No                           |
| B. Git's diff of the session's checkout            | Yes                    | No                | Yes                          |
| C. No diff: the files and their counts only        | n/a                    | No                | n/a                          |

### Thinking

What the UI shows for the model's thinking. Relies on
[thinking and progress updates](#thinking-and-progress-updates).

| Option                                                                 | Shows reasoning text | Cost                                 |
| ---------------------------------------------------------------------- | -------------------- | ------------------------------------ |
| A. A row per thought with its duration, text when the harness gives it | When given           | None now; text appears if enabled    |
| B. Chase progress updates now: a plan task to enable them for Claude   | Yes, short notes     | An unverified setting; a beta header |
| C. Leave thinking out of the transcript, the live line stays           | No                   | None                                 |

### A session without a workflow

The right column exists only for a feature or a change today. A plain session has activity and
changes too.

| Option                                                              | Consistency | Work   |
| ------------------------------------------------------------------- | ----------- | ------ |
| A. The same column for every session, Progress only with a workflow | One layout  | Medium |
| B. The column only for a feature or a change, as today              | Two layouts | None   |

### New page layout

How the three kinds are told apart. Relies on
[the New page's path](#the-proposals-path-and-existing-actions).

| Option                                                        | Told apart at a glance | Kinds compared | Start from a note kept |
| ------------------------------------------------------------- | ---------------------- | -------------- | ---------------------- |
| A. Three cards side by side, the picked one's form under them | Yes                    | By card        | Yes                    |
| B. Stacked choices, then a comparison table                   | Yes                    | By table       | Yes                    |
| C. One composer first, the kind chosen under it               | Less                   | By text below  | Needs a place          |

Mockups: A (`mockups/new-a.html`, deleted), B (`mockups/new-b.html`, deleted), C
(`mockups/new-c.html`, deleted).

### Needs no choice

- **Sources**: read, search, and fetch tool items, listed in the activity, no separate tab beyond
  the layout's.
- **Sub-agents**: shown as groups in the activity, as the transcript groups them now.
- **Narrow screens**: the page is the chat, and the right column's content opens as a sheet, like
  the questions page's outline.
- **A session beside a document**: stays the chat only, as the spec page does now.
- **Folding and width**: the shared column's, kept for every page.

## Not checked

- The Reddit post of the proposal
  ([r/PiCodingAgent](https://www.reddit.com/r/PiCodingAgent/comments/1x6mwd9/split_thoughtstools_usageresponses_in_separate/)):
  the fetch tool is refused on reddit.com. Its layout is read from the proposal's description only.
- Whether Claude Code can request progress updates by a flag, a setting, or an environment variable:
  the settings reference was read to 100,000 of 441,575 characters, and the environment variables
  page to 100,000 of 185,449.
- How the Codex app and Cursor fold tool calls and thinking in their threads: the official pages
  found cover the review pane only.
- New users' choices on the New page: no data.
