---
status: awaiting-human
revision: 2
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Redesign feature and change pages

> [!IMPORTANT]
>
> Spec to review, about 25 minutes.
>
> - You approve one page for every feature and change: its stages with their times, what's next
>   beside the agent, and what it produced. A done one adds its figures, its decisions as changes,
>   and its record.
> - New decision: a problem is only what stops the workflow; every other check error is a note on
>   the item's page.
> - Tokens: "in" counts every token the model read for the first time, tool results included, 5.2 M
>   for a whole feature. Re-reads from the cache, 147 M, are left out.
> - One "Open the session" button, and one "Insert the recommended message" button in the composer.
>   The pull request comments come through that message only.
> - Since your review: times instead of repeated dates, a calmer agent card beside "Next", coloured
>   lines, two-line tokens, a compact file list, clickable figures, and no second session button.
> - Risk tier `medium`: a new column set in the runner's cache, and a new pass in the workflow.

A feature's page shows where it is, what's next, and what it produced, from proposal to merge, and a
change gets the same page. A done feature keeps its stages, figures, and record on that page,
instead of a link to a file. The session opens from one button, with the recommended message one
click away. The agent can be sent to a pull request's comments, and Home stops calling drift a
problem. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Your review

- **C1** (times, not repeated dates): done. The page's header gives the day. Each stage shows its
  start time and duration, "12:11 · 2 h 50 min", and a date only when the day changes.
- **C2** (fresh input too low): done, reworded. The 2,700 was only the uncached tail of each
  request. Tool results are written to the cache the first time the model reads them, so "in" counts
  them: 5.2 M for the clarifications redesign. Only re-reads of the cache, 147 M, are left out
  ([Anthropic's usage fields](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).
- **C3** (a stage's line wraps): done. Every stage's line fits on one line on a desktop.
- **C4** (lines changed in green and red): done. The page colours "+1,204" green and "−310" red,
  like the sidebar's cards already do.
- **C5** (tokens split badly): done. The tile shows "5.2 M in" and "113 k out" on two lines.
- **C6** (files list): done. Each file is a compact row: its step's icon, its name in words, and its
  status beside it. Every done status is green, a file waiting on you is amber, changes requested
  red. No monospace.
- **C7** (agent louder than the next step): done. The agent's card is neutral: a sleep icon and
  "Idle" when it waits, an accent dot and its task only while it works. "Next" carries the heading
  and the primary button.
- **C8** (next and agent on one line): done. On a desktop, "Next" and the agent's card share one
  row, "Next" twice as wide. On the phone, "Next" comes first.
- **C9** (decisions clickable, as diffs): done. Each figure opens its detail: the stages, the pull
  request's files, the questions, the decisions. A done feature's decisions are drawn as the spec
  page draws them, each change marked in place.
- **C10** (a single recommended message): done. The composer has one "Insert the recommended
  message" button, naming the message, in place of the menu.
- **C11** (two buttons opening the session): done. "Address the comments" is gone: an open pull
  request's "Next" only opens it on GitHub, and the comments message is the recommended one.

## Decisions

- **New: [Problems](../decisions/problems.md)**. A check result is a feature's problem only when it
  stops the workflow; every other one is a note, shown only on the item's page.

Relied on:

| Decision                                       | What it means for this spec                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| [UI layout](../decisions/ui-layout.md)         | the page is a page of its own at both widths, its stages fold on the phone  |
| [UI behaviour](../decisions/ui-behaviour.md)   | the core decides the stage and what's next; the page never guesses them     |
| [Agents](../decisions/agents.md)               | an inserted message runs as a workflow run carrying its step and trigger    |
| [Git](../decisions/git.md)                     | stages and lines changed are read through the core's git module             |
| [Compatibility](../decisions/compatibility.md) | no workflow file changes format: no file to rewrite, no branch made to fail |
| [Preview](../decisions/preview.md)             | the mockups are stories, one per state                                      |

## User stories

### US1: See where a feature is and what's next (P1)

Opening a feature shows its day, then its stages, with the current one marked and each passed one
timed. Under them, "Next" says who acts and what, with its one button, beside the agent's card. Then
what the feature produced so far, and its notes, folded.

[Feature page, the agent building](/packages/web/src/mockups/FeaturePage.stories.tsx#Working)

[Feature page, waiting on you](/packages/web/src/mockups/FeaturePage.stories.tsx#WaitingOnYou)

Key scenarios:

1. **Given** a feature whose plan is approved, with task 7 of 11 running, **When** you open it,
   **Then** the stages mark Build, and "Next" says "The agent is building: task 7 of 11, Session
   column", with no button.
2. **Given** a feature whose spec waits for your review, **When** you open it, **Then** "Next" says
   "You review the spec", with a "Review the spec" button opening it.
3. **Given** a feature whose spec was first committed on Oct 17 at 12:11 and approved at 15:01,
   **When** you open it, **Then** the Spec stage reads "12:11 · 2 h 50 min".

More scenarios:

1. **Given** a feature with two rounds of questions, **When** you open it, **Then** its Questions
   stage reads "2 rounds", timed from the first.
2. **Given** a plan committed Oct 17 at 15:08 and a build started Oct 18 at 09:10, **When** you open
   the feature, **Then** Build reads "Oct 18, 09:10".
3. **Given** a feature whose agent is idle while the spec waits on you, **When** you open it,
   **Then** the agent's card reads "Idle", muted, with a sleep icon.
4. **Given** a feature at implementation with 1,204 lines added and 310 removed over 23 files,
   **When** you open it, **Then** "Lines changed" reads "+1,204", green, "−310", red, and "23
   files".

### US2: See what a done feature produced (P1)

A merged feature keeps the same page, with every stage passed and timed. "Next" becomes the merge
and its pull request. A row of figures follows, each opening its detail: total time, lines changed,
tokens, questions, and decisions. Then the record, drawn in place: its decisions as changes, like
the spec page, and its questions folded.

[Feature page, done](/packages/web/src/mockups/FeaturePage.stories.tsx#Done)

Key scenarios:

1. **Given** the clarifications redesign, started Oct 17 at 10:52 and finished at 22:03, **When**
   you open it, **Then** "Total time" reads "11 h 11 min", and its stages are timed from its
   commits.
2. **Given** a done feature whose turns recorded 2,712 fresh input, 5,174,704 cache writes,
   146,726,052 cache reads, and 113,407 output tokens, **When** you open it, **Then** "Tokens" reads
   "5.2 M in" and "113 k out", on two lines.
3. **Given** a done feature that made the Diagrams decision, **When** you tap "Decisions", **Then**
   the page scrolls to that decision, drawn as a new decision with every rule marked added.

More scenarios:

1. **Given** a done feature, **When** you open it, **Then** its record's What and why, Behaviour,
   and Follow-ups show in place, and "Questions · 10 in 1 round" is folded.
2. **Given** a feature finished before token counts were recorded, **When** you open it, **Then**
   "Tokens" reads "Not recorded".
3. **Given** a done feature whose worktree is left, **When** you open it, **Then** it still says to
   run `ura clean`.

### US3: A change gets the same page (P2)

A change opens the same page as a feature, with its own stages: Proposal, Questions when it had a
round, Fix, Pull request, Merged. Its session is one click away.

[Change page, done](/packages/web/src/mockups/FeaturePage.stories.tsx#DoneChange)

Key scenarios:

1. **Given** a change being fixed, **When** you tap its sidebar card, **Then** its page opens, with
   Fix marked and "Open the session" on the agent's card.
2. **Given** a merged change that asked no question, **When** you open it, **Then** its stages are
   Proposal, Fix, Pull request, Merged, and its record shows in place.

### US4: Open the session, with the recommended message (P1)

The page has one "Open the session" button, on the agent's card. In the session, the composer has
one "Insert the recommended message" button, naming the message that applies now. It fills the
composer, unsent. Anything typed can always be sent.

[Recommended message](/packages/web/src/mockups/ComposerMessages.stories.tsx#Recommended)

[Composer, filled](/packages/web/src/mockups/ComposerMessages.stories.tsx#Filled)

[No recommended message](/packages/web/src/mockups/ComposerMessages.stories.tsx#Nothing)

Key scenarios:

1. **Given** a feature whose plan waits on the agent, **When** you open its session, **Then** the
   composer offers "Insert: Continue, write the plan", which fills the step's message.
2. **Given** a feature whose spec waits on you, **When** you open its session, **Then** the composer
   reads "No recommended message: the feature waits on you", and a typed message still sends.

More scenarios:

1. **Given** a message inserted while the plan waited on the agent, **When** you send it after the
   step moved to your review, **Then** it is sent as a chat, and the session says "Sent as a chat:
   the feature now waits on you."
2. **Given** a round of questions, **When** you press "Commit and start the agent", **Then** the
   session opens with the step's message filled, as today.

### US5: Send the agent to the pull request's comments (P2)

While a feature's pull request is open, "Next" shows it, with one button opening it on GitHub. The
session's recommended message is then "Address the pull request's comments". The agent reads the
comments, fixes each in a commit, and the pull request waits for you again.

[Feature page, pull request open](/packages/web/src/mockups/FeaturePage.stories.tsx#PullRequest)

Key scenarios:

1. **Given** pull request #31 open, **When** you open the feature, **Then** "Next" reads "Your
   review on pull request #31", with "Open pull request #31" alone, and the session recommends
   "Address the pull request's comments".
2. **Given** two unresolved review threads and one comment posted after the last push, **When** the
   agent runs the comments message, **Then** it handles all three, one commit per change, and lists
   each with what it did in its last message.
3. **Given** a comment that asks for a choice the spec does not settle, **When** the agent reads it,
   **Then** it starts a new round of questions instead of guessing.

More scenarios:

1. **Given** a pull request in draft, **When** you open the session, **Then** it recommends "Address
   the pull request's comments" too.

### US6: Problems are only what stops the workflow (P1)

Home and the sidebar flag a feature only when it cannot go on: its step cannot be found, or an
answered round has a blank answer. Every other check error is a note, folded at the bottom of its
page.

[Feature page, blocked](/packages/web/src/mockups/FeaturePage.stories.tsx#Blocked)

Key scenarios:

1. **Given** a feature at implementation whose plan misses "## Waves" under the server's templates,
   **When** you open Home, **Then** it shows under "Agents at work", and its page lists "1 format
   note", folded.
2. **Given** a spec whose status reads "aproved", **When** you open Home, **Then** the feature is
   under "Needs you" with "Fix", and its page opens with "This feature cannot go on".

More scenarios:

1. **Given** the same feature, **When** you run `ura check` on it, **Then** it still prints the
   missing section as an error and exits 1.

## Architecture

The core adds one view of a feature's history, read from git and the existing files, and the server
adds token counts and the list of messages. The page draws both: it decides nothing about steps,
stages, or problems ([UI behaviour](../decisions/ui-behaviour.md)). Data comes from what exists:
commits typed by step for the stages, the runner's turns for tokens
([data a summary needs](discovery-01.md#data-a-summary-needs-and-where-it-is)).

- **The stages**, in the core, map each step to a stage, and each stage to its start: the first
  commit scoped by the slug and typed by that step. They own the stage list of features and of
  changes.
- **The figures**, in the core, compute total time, lines and files changed over the feature's
  commits outside its folder, and the counts of questions and decisions. They own what "lines
  changed" counts.
- **The decisions made**, in the core, compare each decision a done feature touched before its first
  commit and at its merge, as the spec page compares a branch's. They reuse the spec page's
  comparison.
- **The problems' kind**, in the core, marks each check result as blocking or a note. It owns the
  [Problems](../decisions/problems.md) decision's list of blocking rules.
- **The token counts**, in the Claude adapter, turn each run's final usage into a neutral usage
  event, stored on its turn. The adapter owns the mapping from Claude's fields.
- **The recommended message**, in the server, picks the one workflow message that applies to a
  feature now: the step's while it waits on the agent, else the comments one while a pull request is
  open. It owns each message's text and when it applies.
- **The item page**, in the web UI, draws a feature or a change from these views, at both widths.
- **The comments pass**, in the skill, tells the agent how to read and handle a pull request's
  comments.

Tradeoffs:

- A squash-merged feature has no stages or figures: its commits did not reach the default branch.
- Tokens live in the machine's cache: another machine, or a lost data folder, shows "Not recorded".
- The page reads git each time it opens: a feature of 80 commits must stay fast, measured below.

## Edge cases

| Importance | Situation                                           | What happens                                                                           |
| ---------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| High       | A feature's status or frontmatter is invalid        | its page opens with "This feature cannot go on", the file and line, and a button to it |
| High       | An inserted message no longer applies when sent     | it is sent as a chat, with "Sent as a chat: the feature now waits on you."             |
| Normal     | A done feature was squash-merged                    | its stages show Merged only, and its figures read "Not found on the default branch"    |
| Normal     | A feature started before token counts were recorded | "Tokens" counts the recorded turns, captioned with the first one's date                |
| Normal     | Claude Code is not installed                        | the agent's card says so; the composer recommends nothing                              |
| Normal     | The pull request's state is unknown, `gh` missing   | "Next" says "Pull request state unknown", and the comments message is not recommended  |
| Normal     | A record has no commits typed by step               | its stages show Merged, on the record's `finished` date                                |
| Niche      | A feature has two rounds of questions               | Questions reads "2 rounds", timed from the first round                                 |
| Niche      | A comment comes from a reviewer bot                 | the agent handles it like a person's: you chose when to send it                        |

## Success criteria

- **SC-001** (no false "Fix"): with the 72 snapshots of feature folders from 2026-10-17, Home shows
  "Fix" only for those with an invalid status or frontmatter.
- **SC-002** (fast history): a feature of 80 commits gets its stages and figures in under 100 ms.
- **SC-003** (one button): every feature and change page has exactly one "Open the session" button.
- **SC-004** (past features): 25 of the 30 records in `specs/done/` show timed stages.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Your answers changed two of them: the done page shows no waiting time, and tokens
leave cache reads out. Settled while writing this spec:

- **Stages** start at the first commit of their step's type, so a revision does not move them. See
  [conventions](/skills/uraeda/references/conventions.md#commits).
- **Lines changed** leave out the feature's folder and its record, like the branch's changes today.
- **The comments the agent reads**: every unresolved review thread, and every review or comment
  posted after the branch's last push. Resolved and outdated threads are left out.
- **The comments message** runs from the implementation reference, with the trigger `comments`, and
  ends when the pull request is ready for review again.
- **"Review and start the agent"** leaves the feature page: the recommended message replaces it.
- **No agent working time**: you found the waiting time noise, and the stages' durations already
  show where time went.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| :------------------: | :------------: | :--------: | :---------------: | :---------------: | :--------------: |
|          ✅          |       ✅       |     ✅     |        ✅         |        ✅         |        ✅        |

## Risk tier

**Medium**: a new column set in the runner's cache, and a new pass in the workflow; no workflow file
changes format.

## History

> [!NOTE]
>
> Changes requested on 2026-10-18: times instead of dates, a calmer agent beside "Next", one session
> button, clearer figures and files.
>
> - You approve one page for every feature and change: its stages with their dates, what's next, the
>   agent, and what it produced. A done one adds its figures and its record, drawn in place.
> - New decision: a problem is only what stops the workflow; every other check error is a note on
>   the item's page.
> - Tokens: you asked to leave out cache reads and count fresh input. This spec counts cache writes
>   as input too: fresh input alone is 2,700 tokens for a whole feature. Say so if you meant it
>   alone.
> - One "Open the session" button. The session's composer offers the messages that apply, and
>   nothing is ever refused.
> - The agent addresses pull request comments when you send it, and never replies on GitHub.
> - Risk tier `medium`: a new table column in the runner's cache, and a new pass in the workflow.
