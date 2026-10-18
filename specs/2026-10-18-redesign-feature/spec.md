---
status: changes-requested
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Redesign feature and change pages

> [!NOTE]
>
> Changes requested on 2026-10-18: 11 comments in spec-review.md.
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

A feature's page shows where it is, what's next, and what it produced, from proposal to merge, and a
change gets the same page. A done feature keeps its stages, figures, and record on that page,
instead of a link to a file. The session opens from one button, with the step's message one pick
away. The agent can be sent to a pull request's comments, and Home stops calling drift a problem.
See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

- **New: [Problems](../decisions/problems.md)**. A check result is a feature's problem only when it
  stops the workflow; every other one is a note, shown only on the item's page.

Relied on:

| Decision                                       | What it means for this spec                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| [UI layout](../decisions/ui-layout.md)         | the page is a page of its own at both widths, its stages fold on the phone  |
| [UI behaviour](../decisions/ui-behaviour.md)   | the core decides the stage and what's next; the page never guesses them     |
| [Agents](../decisions/agents.md)               | a picked message runs as a workflow run carrying its step and trigger       |
| [Git](../decisions/git.md)                     | stages and lines changed are read through the core's git module             |
| [Compatibility](../decisions/compatibility.md) | no workflow file changes format: no file to rewrite, no branch made to fail |
| [Preview](../decisions/preview.md)             | the mockups are stories, one per state                                      |

## User stories

### US1: See where a feature is and what's next (P1)

Opening a feature shows its stages, with the current one marked and each passed one dated. Under
them, "Next" says who acts and what, with its one button. Then the agent's card, what the feature
produced so far, and its notes, folded.

[Feature page, the agent building](/packages/web/src/mockups/FeaturePage.stories.tsx#Working)

[Feature page, waiting on you](/packages/web/src/mockups/FeaturePage.stories.tsx#WaitingOnYou)

Key scenarios:

1. **Given** a feature whose plan is approved, with task 7 of 11 running, **When** you open it,
   **Then** the stages mark Build, and "Next" says "The agent is building: task 7 of 11, Session
   column", with no button.
2. **Given** a feature whose spec waits for your review, **When** you open it, **Then** "Next" says
   "You review the spec", with a "Review the spec" button opening it.
3. **Given** a feature whose spec was first committed on Oct 17 at 12:11 and approved at 15:01,
   **When** you open it, **Then** the Spec stage reads "Oct 17 · 2 h 50 min".

More scenarios:

1. **Given** a feature with two rounds of questions, **When** you open it, **Then** its Questions
   stage reads "2 rounds", dated from the first.
2. **Given** a feature at implementation with 1,204 lines added and 310 removed over 23 files,
   **When** you open it, **Then** "Lines changed" reads "+1,204 −310" and "23 files".

### US2: See what a done feature produced (P1)

A merged feature keeps the same page, with every stage passed and dated. "Next" becomes the merge
and its pull request. A row of figures follows: total time, lines changed, tokens, questions, and
decisions. Then the record, drawn in place, with its questions folded.

[Feature page, done](/packages/web/src/mockups/FeaturePage.stories.tsx#Done)

Key scenarios:

1. **Given** the clarifications redesign, started Oct 17 at 10:52 and finished at 22:03, **When**
   you open it, **Then** "Total time" reads "11 h 11 min", and its stages are dated from its
   commits.
2. **Given** a done feature whose turns recorded 2,712 fresh input, 5,174,704 cache writes,
   146,726,052 cache reads, and 113,407 output tokens, **When** you open it, **Then** "Tokens" reads
   "5.2 M in · 113 k out".
3. **Given** a done feature, **When** you open it, **Then** its record's What and why, Behaviour,
   Decisions, and Follow-ups show in place, and "Questions · 10 in 1 round" is folded.

More scenarios:

1. **Given** a feature finished before token counts were recorded, **When** you open it, **Then**
   "Tokens" reads "Not recorded".
2. **Given** a done feature whose worktree is left, **When** you open it, **Then** it still says to
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

### US4: Open the session, with the message that applies (P1)

The page has one "Open the session" button, on the agent's card. In the session, a "Messages" menu
beside the send button offers the workflow messages that apply now. Picking one fills the composer,
unsent. Anything typed can always be sent.

[Messages menu, open](/packages/web/src/mockups/ComposerMessages.stories.tsx#Open)

[Composer, filled](/packages/web/src/mockups/ComposerMessages.stories.tsx#Filled)

[Messages menu, nothing applies](/packages/web/src/mockups/ComposerMessages.stories.tsx#Nothing)

Key scenarios:

1. **Given** a feature whose plan waits on the agent, **When** you open the Messages menu, **Then**
   it offers "Continue: write the plan", and picking it fills the composer with the step's message.
2. **Given** a feature whose spec waits on you, **When** you open the Messages menu, **Then** it
   reads "No workflow message now: the feature waits on you", and a typed message still sends.

More scenarios:

1. **Given** a message picked while the plan waited on the agent, **When** you send it after the
   step moved to your review, **Then** it is sent as a chat, and the session says "Sent as a chat:
   the feature now waits on you."
2. **Given** a round of questions, **When** you press "Commit and start the agent", **Then** the
   session opens with the step's message filled, as today.

### US5: Send the agent to the pull request's comments (P2)

While a feature's pull request is open, "Next" shows it with two buttons: open it on GitHub, or
"Address the comments". The second opens the session with that message filled. The agent reads the
comments, fixes each in a commit, and the pull request waits for you again.

[Feature page, pull request open](/packages/web/src/mockups/FeaturePage.stories.tsx#PullRequest)

Key scenarios:

1. **Given** pull request #31 open, **When** you open the feature, **Then** "Next" reads "Your
   review on pull request #31", with "Open pull request #31" and "Address the comments".
2. **Given** two unresolved review threads and one comment posted after the last push, **When** the
   agent runs the comments message, **Then** it handles all three, one commit per change, and lists
   each with what it did in its last message.
3. **Given** a comment that asks for a choice the spec does not settle, **When** the agent reads it,
   **Then** it starts a new round of questions instead of guessing.

More scenarios:

1. **Given** a pull request in draft, **When** you open the Messages menu, **Then** it offers
   "Address the pull request's comments" too.

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
- **The problems' kind**, in the core, marks each check result as blocking or a note. It owns the
  [Problems](../decisions/problems.md) decision's list of blocking rules.
- **The token counts**, in the Claude adapter, turn each run's final usage into a neutral usage
  event, stored on its turn. The adapter owns the mapping from Claude's fields.
- **The messages**, in the server, list the workflow messages that apply to a feature now, and their
  texts. They own each message's text and when it applies.
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
| High       | A picked message no longer applies when it is sent  | it is sent as a chat, with "Sent as a chat: the feature now waits on you."             |
| Normal     | A done feature was squash-merged                    | its stages show Merged only, and its figures read "Not found on the default branch"    |
| Normal     | A feature started before token counts were recorded | "Tokens" counts the recorded turns, captioned with the first one's date                |
| Normal     | Claude Code is not installed                        | the agent's card says so; the Messages menu does not show                              |
| Normal     | The pull request's state is unknown, `gh` missing   | "Next" says "Pull request state unknown", and the comments message is not offered      |
| Normal     | A record has no commits typed by step               | its stages show Merged, dated from the record's `finished`                             |
| Niche      | A feature has two rounds of questions               | Questions reads "2 rounds", dated from the first round                                 |
| Niche      | A comment comes from a reviewer bot                 | the agent handles it like a person's: you chose when to send it                        |

## Success criteria

- **SC-001** (no false "Fix"): with the 72 snapshots of feature folders from 2026-10-17, Home shows
  "Fix" only for those with an invalid status or frontmatter.
- **SC-002** (fast history): a feature of 80 commits gets its stages and figures in under 100 ms.
- **SC-003** (one button): every feature and change page has exactly one "Open the session" button.
- **SC-004** (past features): 25 of the 30 records in `specs/done/` show dated stages.

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
- **"Review and start the agent"** leaves the feature page: the Messages menu replaces it.
- **No agent working time**: you found the waiting time noise, and the stages' durations already
  show where time went.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| :------------------: | :------------: | :--------: | :---------------: | :---------------: | :--------------: |
|          ✅          |       ✅       |     ✅     |        ✅         |        ✅         |        ✅        |

## Risk tier

**Medium**: a new column set in the runner's cache, and a new pass in the workflow; no workflow file
changes format.
