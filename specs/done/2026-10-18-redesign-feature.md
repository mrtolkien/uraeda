---
kind: feature
finished: 2026-10-19
pull-request: https://github.com/mrtolkien/uraeda/pull/42
---

# Record: Redesign feature and change pages

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-19, in [its pull request](https://github.com/mrtolkien/uraeda/pull/42). Its full files are
> in git: `git log -- specs/2026-10-18-redesign-feature/`.

## What and why

The feature page had grown by additions and showed neither where a feature was nor what it produced;
a done feature showed one link to its record, and a change had no page at all. Two buttons opened
the session and behaved differently, the only path to pull request feedback never fired, and
"problems" flagged features that were fine. The human asked for one page that shows where a feature
is, what's next, and what it produced, from proposal to merge.

## Behaviour

- **One page for features and changes.** It opens with the day and the stages: Proposal, Questions,
  Spec, Plan, Build, Pull request, Merged, or for a change Proposal, Questions when it had a round,
  Fix, Pull request, Merged. A passed stage reads its start time and duration, "12:11 · 2 h 50 min",
  with a date only when the day changes; the current one reads "since 15:08", never a duration. A
  stage starts at the first commit of its step's type, so a revision does not move it, and a live
  feature starts no stage after its current one. On a desktop the stages are a row only where every
  stage's line fits on one line; elsewhere, and on the phone, they are a column.
- **"Next" beside the agent.** "Next" says who acts and what, with at most one button: "You review
  the spec" with "Review the spec", "The agent is building" with its task and no button, "Your
  review on pull request #31" with only "Open pull request #31", "Merged" once done. The agent's
  card is neutral: a moon and "Idle", or the working mark, its task and sub-agents; it holds the
  page's one "Open the session". On a desktop, "Next" and the card share a row, "Next" twice as
  wide; on the phone "Next" comes first.
- **What it produced.** A live feature shows its lines changed, "+1,204" green and "−310" red over
  "23 files", and its tokens, "5.2 M in" and "113 k out" on two lines. A done feature adds its total
  time, from the proposal to the finish, its questions, and its decisions: all five figures, each
  leading to its detail without a new history entry. A done change shows the figures it has. Then
  the record is drawn in place: What and why, Behaviour, the decisions it changed drawn as the spec
  page draws them, its questions folded, Follow-ups, and a link to the file.
- **Tokens.** Each turn stores its own counts, its sub-agents included: "in" counts fresh input and
  cache writes, cache reads are left out, and all four counts are kept. A feature counted from a
  later turn says "since <day>"; one with none reads "Not recorded". A `/clear` in a session starts
  a new agent session, and its session shows "Started a new session: the agent cleared the turns
  above."
- **The recommended message.** The session's composer offers one "Insert: <name>" button: the step's
  message while the step waits on the agent ("Continue, write the plan"), else "Address the pull
  request's comments" while a pull request is open, in draft, or has changes requested; otherwise it
  says why nothing is recommended. Inserting fills the composer, unsent, before what was typed, and
  moves the focus there; anything typed always sends. The run after a spec's approval builds in a
  fresh session as the setting says, even when sent before the setting is read.
- **Nothing is refused.** A workflow message that no longer applies when sent, or when its queued
  turn starts, runs as a chat, with a line saying why: "Sent as a chat: the feature now waits on
  you." It opens the chat as any chat after a run does.
- **The comments pass.** The agent, sent by the message, reads every unresolved review thread and
  every review or comment posted after the branch's last push, a bot's like a person's; fixes each
  in a commit; never replies or resolves on GitHub; and lists each comment with what it did. A
  choice the spec does not settle starts a round of questions. It stops at any file waiting for the
  human; a draft otherwise ends it by running the finish step.
- **Problems.** Only what stops the workflow is a problem: an invalid status or frontmatter, a file
  that is not UTF-8, and a missing answer in an answered round, a deleted `**Answer:**` line
  included. Home and the sidebar flag those only, "Needs you" with "Fix" or "Problem to fix", and a
  blocked feature's page opens with "This feature cannot go on" and a button to its file. Every
  other check error is a note, folded at the bottom of the item's page; `ura check` still prints it
  as an error and exits 1.

## Design

The core decides everything read from git and the workflow files, the server owns tokens and
messages, and the page draws both.

- **The problems' kind**: one list, `BLOCKING`, in
  [`workspace/problem.rs`](/crates/core/src/workspace/problem.rs); `FeatureView` splits a feature's
  results into `problems` and `notes`, the workspace's own always problems.
- **A feature's history**: [`crates/core/src/history.rs`](/crates/core/src/history.rs) and its
  [`stages.rs`](/crates/core/src/history/stages.rs) and
  [`figures.rs`](/crates/core/src/history/figures.rs), reached by `read_history` and the binding's
  `readHistory`. It reads only the feature's folder, walks commits with gix down to the folder's
  date, and for a done feature starts at the commit that added its record. One parser reads a commit
  subject's type and scope. Lines changed: a live feature's three-dot diff from the merge base; a
  rebased feature's spans of commits, which go on over commits of no feature and end at another
  feature's, each span's net diff summed file by file, with the review fixes rebased within ten
  minutes of its finish; a merge commit's three-dot diff. The merge time is the finish commit's
  arrival on the default branch. A squash-merged feature, or one without typed commits, shows Merged
  alone and "Not found on the default branch".
- **Tokens**: the Claude adapter turns `modelUsage` into a neutral `tokens` event, the agent
  session's running total summed over models
  ([`claude-events.ts`](/packages/server/src/runner/claude-events.ts)); each process keeps a
  baseline, reset by a new or cleared agent session, and stores each turn's difference
  ([`processes.ts`](/packages/server/src/runner/processes.ts)). The runner cache's migrations moved
  to [`migrations.ts`](/packages/server/src/runner/migrations.ts), and a fifth adds the four
  columns.
- **The recommended message**: `recommendedMessage` in
  [`runner/message.ts`](/packages/server/src/runner/message.ts), beside every message's text, read
  by the composer through a fate view and again by the runner at send time and when a queued turn
  starts.
- **The page**: [`packages/web/src/feature/`](/packages/web/src/feature/), one component per part,
  with its stories in [`FeaturePage.stories.tsx`](/packages/web/src/feature/FeaturePage.stories.tsx)
  over typed, dated fixture features; times are formatted in the browser's zone by
  [`times.ts`](/packages/web/src/feature/times.ts).
- **The comments pass**: the section "Comments on the pull request" of the
  [implementation reference](/skills/uraeda/references/implementation.md#comments-on-the-pull-request).

## Questions

### Round 01

#### Q1: Should the five parts ship as one feature?

**Answer:** A: one feature, one page designed once.

#### Q2: How should the ongoing feature page read, from the top?

**Answer:** A: the stages, then "Next" with who acts and its one button, the agent's card, what the
feature produced, then the notes.

#### Q3: What should a done feature's page show?

**Answer:** A: the same page, with timed stages, figures, and the record in place: "No need to add
the human waiting time, it’s noise".

#### Q4: Where should a done feature's figures come from?

**Answer:** A: computed by the core from git; tokens from the runner's cache.

#### Q5: What should "tokens used" count?

**Answer:** A, with cache reads left out: "Can we remove cache reads? So the input tokens would only
count fresh input". On the spec's review, "in" came to count cache writes too, the tokens the model
read for the first time.

#### Q6: Should a change get the same page as a feature?

**Answer:** A: a change opens the same page, with its own stages.

#### Q7: How should the session open with the step's message?

**Answer:** A: one "Open the session" button; the composer offers the message that applies, and
nothing is ever refused. On the spec's review, one recommended message replaced a menu.

#### Q8: How should the agent pick up comments on the pull request?

**Answer:** A: a message the human sends while a pull request is open; the agent reads every
unresolved comment and fixes each in a commit.

#### Q9: What should count as a feature's problem?

**Answer:** A: only what stops the workflow; every other error is a note on the item's page, and
`ura check` stays as it is.

## Decisions

- [Problems](../decisions/problems.md): new. A check result is a feature's problem only when it
  stops the workflow; every other one is a note, shown only on the item's page.

## Changes after approval

- The spec's review, before approval, asked for times instead of repeated dates, a calmer agent
  beside "Next", one recommended message instead of a menu, and clearer figures and files.
- A deleted `**Answer:**` line in an answered round is now also reported as a blank answer by
  `ura check`, so it blocks.
- An unknown pull request state recommends no message, and says so, rather than the step's own.
- A stale workflow message sent as a chat opens the chat as any chat after a run does.
- A `/clear` adds a visible line to the session, the marker that starts a new agent session's
  tokens.
- The server applies the fresh-session setting to a run after a spec's approval sent without it.
- "Start the change" opens the change's session, where its agent works, since its address is now the
  change's page.
- The sidebar reads a feature with a problem as "Problem to fix" under "Needs you", whatever its
  session.
- The stages switch to a column at 1200 and 1024 px with the sidebar open, where a row cannot keep
  every line on one line; the layout check lets the stages' short captions centre under their nodes.
- A long "Insert: <name>" wraps inside its button, so the composer's Send stays in view beside the
  side column.

## Follow-ups

- Deferred fixes noted in the inbox: a renamed decision shows as new on a done page; a blank answer
  blocks only a checked-out feature; Back after a reload can land too high; a change's banner says
  "This feature cannot go on"; `workspace.rs`'s size budget is still 742 lines; a queued message on
  a feature merged before it starts fails; the fresh-session steps are listed twice; agent session
  markers are found by their line's words; a closing process's late tokens can go to the next turn;
  the stages' walk misses commits older than the folder's date; a local fast-forward merge is timed
  at the finish; a done feature read without a record walks the default branch from its tip; older
  records read "Not found on the default branch"; the stages can stay a column after a live update;
  a done feature's figures start a thread per diff and per decision; a done feature's "Next" does
  not link its pull request; no end-to-end test of a merged feature's recommendation;
  `history::read` sits at the 100-line limit; a sidebar card's "+N −N" draws uncoloured.
- A browser test of the sidebar's chat rows already fails on the default branch; it is noted in the
  inbox.
