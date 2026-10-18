---
status: answered
---

# Clarifications, round 01: Redesign feature and change pages

> [!NOTE]
>
> Answered on 2026-10-18.
>
> - Verdict: worth building, with changes. "Changes requested" never fires on your own pull
>   requests, and most "problems" come from version drift, not from the features.
> - Pull request comments decide how the agent picks up feedback after the pull request, a step of
>   the workflow itself.
> - What counts as a problem changes Home's "Needs you", and what the check reports on features in
>   progress.
> - The done page, its figures, and tokens work together: where the figures live decides what past
>   features can show.
> - "Tokens used" needs a number: a feature's tokens are 98% cache reads.
> - Settled without you: checking a branch with its own templates is left out, and the agent never
>   replies on GitHub.

## Context

### Goal

The [proposal](proposal.md) asks for a feature page that shows where a feature is, what's next, and
what it produced. A done feature gets a real summary: milestone times, tokens, lines changed. The
page offers one way to open the session, with the step's message to pick. It can send the agent to
the pull request's comments. Features stop showing "problems" they do not have. It is for you,
following features from proposal to merge.

### Today

- The [feature page](/packages/web/src/FeaturePage.tsx) shows, from the top:
  - the title, and a banner when a step waits on you;
  - an "Agent" panel with "Open the session" and "Review and start the agent";
  - the branch, with its pull request link;
  - the file list, with "problem" badges;
  - the mockups, and a "Problems" list.
- Its layout dates from 2026-10-12, with parts added since. It was never designed as a whole.
- A done feature shows one row: its record file.
- A change has no page: it opens its session. A done change opens a composer that cannot send.
- "Review and start the agent" fills the step's message. When the step waits on you, the server
  refuses it, and nothing can be sent from that address.
- With an open pull request, the banner's "Pull request ready" button links to the page itself.

| Product            | Status shown                          | End summary                       | Pull request comments             |
| ------------------ | ------------------------------------- | --------------------------------- | --------------------------------- |
| Copilot agent      | progress, token usage, session length | the pull request                  | `@copilot`, or "Fix with Copilot" |
| Jules              | activity feed                         | files, lines, runtime             | reads them by itself              |
| Devin              | working, waiting for you, finished    | compute used, a coloured timeline | reads them by itself, bots off    |
| Claude Code on web | session list                          | `+42 -18`                         | auto-fix toggle per pull request  |

### Scope

The feature page, ongoing and done, and the change's page. The session's entry point and its
pre-filled messages. A pull request comments pass in the workflow. What the UI reports as a problem.
The session page itself is left to the [redesign-session draft](/specs/drafts/redesign-session.md),
and restarting stopped agents to [worker-lifecycle](/specs/drafts/worker-lifecycle.md). The slow
"Commit and start the agent", in the proposal's earlier draft, is left out, as you removed it.

### Sources

- The feature page, the agent panel, the session's hand-over, the runner, the core's steps, pull
  requests, and check.
- `ura check` run on every feature folder of the last day's commits, 72 snapshots.
- This repository's 32 pull requests, through `gh`.
- Copilot, Jules, Devin, Claude Code on the web, Codex, Cursor, Linear, and GitLab's docs.
- The LSP, ESLint, Vale, and SARIF severities, Claude Code's cost tracking, and GitHub's reviews.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Should the five parts ship as one feature?

The proposal has five parts:

- the ongoing page;
- the done page;
- the session's entry point;
- pull request comments;
- what counts as a problem.

The problems part touches the core's check and Home, and could ship alone in hours. It is the only
one that does not depend on the new page. The others share the page and its actions. Every question
below assumes one feature, but each answer holds either way. More in
[discovery](discovery-01.md#scope).

Why it matters: a split fixes the false "Fix" badges sooner, for one more round of review.

- **A (recommended). Build all five as one feature, with one spec and one review.**
  - [pro] one page, designed once; one spec to review.
  - [con] the false problems stay until the whole feature ships.
  - Why recommended: the page's problem list is redesigned here anyway, and one review costs you
    less than two.
- **B. Ship what counts as a problem as a change now, and the four other parts as this feature.**
  - [pro] Home stops crying wolf within a day.
  - [con] a second review, and the problems list is touched twice.

**Answer:** A

## Q2: How should the ongoing feature page read, from the top?

Today the page is a stack of sections added over a week. What's next is a banner, only when it waits
on you. The agent's state is a line in a panel. What the feature produced is a file list. Products
lead with a status and an action: Devin says "waiting for you", Linear derives its state from the
agent's last activity. Jules and Claude Code show what changed as `+42 -18`. A "stage" is one of the
workflow's steps grouped for reading: proposal, questions, spec, plan, build, pull request, merged.
The look itself comes as Storybook mockups in the spec, at both widths. More in
[discovery](discovery-01.md#the-ongoing-page).

Why it matters: this order is what you see every time you open a feature, and the done page builds
on it.

- **A (recommended). A strip of stages with the current one marked, then "Next", with who acts and
  the one button. Then the agent's card, with status, task, and progress. Then what the feature
  produced: files, mockups, lines changed, pull request. Then the notes.**
  - [pro] where it is and what's next, before scrolling.
  - [con] the most new layout to build and test.
  - Why recommended: it answers the proposal's "where the feature is, what's next, and what it
    produced", in that order.
- **B. Two columns on wide screens: "Next" and the files on the left; the stages, the agent, and the
  figures in a column on the right. One column on the phone.**
  - [pro] everything in view on a desktop.
  - [con] the stages fall below the files on the phone; a second layout to keep in sync.
- **C. Keep today's sections, restyled, with the banner always shown.**
  - [pro] small.
  - [con] the stage and the agent stay buried under the title.

**Answer:** A

## Q3: What should a done feature's page show?

Today it shows one row, the record file. The record holds what and why, the behaviour, the design,
every question with its answer, the decisions, and the follow-ups. The figures Uraeda can compute
from git, for all but 5 of the 30 done features:

- the date of each stage, from the commits typed by step;
- the time at each gate waiting on you, against the agent's working time;
- the lines and files changed;
- how many questions were asked and how many decisions were made.

For example, the clarifications redesign took 11 hours. Its questions came in 26 minutes, your
answers 43 minutes later. The spec was approved 3 hours later, after one revision. Building took 7
hours. Tokens are Q5. With the stages strip of Q2's option A, the done page is the same page with
every stage passed. More in [discovery](discovery-01.md#the-done-page).

Why it matters: this is what a feature leaves behind. The figures are also the first measure of the
workflow's speed, which your priorities name as too slow.

- **A (recommended). The same page: every stage with its date and duration, a row of figures, then
  the record drawn in place. Its questions are folded.**
  - [pro] what it produced and what it decided, on one page.
  - [con] the record's sections need their own drawing.
  - Why recommended: it replaces the "dirty link" with the record itself, and adds the figures you
    asked for.
- **B. The stages and the figures, with the record one click away.**
  - [pro] less to draw.
  - [con] the record stays a file to open.
- **C. The record drawn in place, without figures.**
  - [pro] the smallest.
  - [con] no timings, no lines changed: half of what the proposal asks.

**Answer:** A: No need to add the human waiting time, it’s noise

## Q4: Where should a done feature's figures come from?

The dates, durations, and lines changed can be computed each time from git. Every step already
writes commits scoped by the feature's slug. Or the finishing agent can write them into the record's
frontmatter. A new record format means rewriting the 30 existing records, as the
[compatibility decision](/specs/decisions/compatibility.md) asks. Tokens are not in git either way:
see Q5. A squash merge loses the feature's commits, which is why the finish step advises a rebase.
More in [discovery](discovery-01.md#where-the-summarys-figures-live).

Why it matters: it decides whether past features get figures, and whether a record changes format.

- **A (recommended). The core computes the figures from git when the page opens, and tokens come
  from Uraeda's local records.**
  - [pro] 25 of the 30 done features get their figures; no format change.
  - [con] a squash-merged feature has none; tokens are lost with the machine's data folder.
  - Why recommended: git already holds the facts, and keeping one copy of them follows
    [git first](/specs/CONSTITUTION.md#ii-git-and-plain-text-first).
- **B. The finishing agent writes the figures into the record's frontmatter.**
  - [pro] durable, and readable without Uraeda.
  - [con] past records have none; the figures are copied by an agent, and can be wrong.

**Answer:** A

## Q5: What should "tokens used" count?

Uraeda drops token counts today. Claude Code reports them at the end of each run, sub-agents
included, split into four kinds: fresh input, cache writes, cache reads, and output. One feature,
the clarifications redesign, read 147 M tokens from cache, wrote 5.2 M to it, and took 2,700 fresh
and 113 k output. A single "tokens" figure is either that 152 M, or leaves out 98% of the work. You
removed the cost in dollars on 2026-10-14, because it is Claude Code's estimate. Counts start from
this feature's release: Claude's own transcripts hold placeholders for output, so past features show
none. More in [discovery](discovery-01.md#tokens).

Why it matters: the number shapes how you compare features, and the next benchmarks will read it.

- **A (recommended). Total tokens, with output tokens beside it, like "152 M tokens · 113 k
  written".**
  - [pro] both are measured; output shows what the agent wrote.
  - [con] the total is dominated by cache reads, the cheapest kind.
  - Why recommended: measured numbers, no estimate, and the split is honest about the cache.
- **B. Claude Code's estimated cost in dollars, by model.**
  - [pro] one figure that weighs the four kinds and the models.
  - [con] an estimate, which you removed once already.
- **C. No tokens: the times and lines are enough.**
  - [pro] nothing to capture or store.
  - [con] one of the proposal's figures is gone.

**Answer:** A: Can we remove cache reads? So the input tokens would only count fresh input

## Q6: Should a change get the same page as a feature?

A change opens its session today: its column shows its step, its round, and its pull request. A done
change opens a composer that cannot send, with its record in the column. The proposal asks for "the
change pages". A change's stages are fewer: proposal, questions when there are any, fix, pull
request, merged. More in [discovery](discovery-01.md#a-page-for-changes).

Why it matters: it decides whether the sidebar's cards all lead to the same kind of page.

- **A (recommended). A change opens the same page as a feature, with its own stages, and its session
  one click away.**
  - [pro] one page to learn; a done change gets its summary.
  - [con] following a change's agent takes one more click.
  - Why recommended: changes are short, and their page is mostly read when done or waiting.
- **B. A change keeps its session as its page, and a done change shows its record instead.**
  - [pro] one click less while it works.
  - [con] two patterns for the same sidebar cards.

**Answer:** A

## Q7: How should the session open with the step's message?

Today "Open the session" opens an empty composer, and "Review and start the agent" fills the step's
message. When the step waits on you, that message is refused, and nothing can be sent at all.
Products fill a message without sending it, and offer a few that fit the moment. Claude Code's links
fill the prompt "not sent until you press Enter". Shape of AI advises 3 to 6 suggestions at most.
The messages that could apply are the step's, the pull request comments of Q8, and a retry after a
failed run. More in [discovery](discovery-01.md#opening-the-session).

Why it matters: it decides the one action you use most on a feature, and where it lives.

- **A (recommended). One "Open the session" button. The composer offers the messages that apply now,
  in a menu, and picking one fills it, unsent. Anything can always be sent.**
  - [pro] one button; the messages are also there when you are already in the session.
  - [con] one click more than today's "Review and start the agent".
  - Why recommended: it is the proposal's "simpler, clearer, more polyvalent", and nothing is ever
    refused.
- **B. One button with a menu on the feature page: "Open the session", or open it with one of the
  messages.**
  - [pro] the choice is made before leaving the page.
  - [con] in the session, the messages are out of reach.
- **C. One button that always fills the step's message, which you clear to write your own.**
  - [pro] no menu.
  - [con] clearing text to chat, and no choice of message.

**Answer:** A

## Q8: How should the agent pick up comments on the pull request?

The workflow sends the agent to pull request feedback only on a formal "Request changes" review. On
this repository's 32 pull requests, none ever got one. Every review is a "Comment", from the Codex
reviewer or from you. GitHub's docs do not say whether an author can request changes on their own
pull request. So the agent's only path to feedback has never fired.

Products differ:

- Copilot takes a mention or a button per comment.
- Jules and Devin read comments by themselves. Devin ignores bots by default, "to prevent feedback
  loops".
- Claude Code has an auto-fix toggle per pull request.

Where this message appears is Q7. More in [discovery](discovery-01.md#pull-request-comments).

Why it matters: this adds a step to the workflow after the pull request, and decides whether the
agent ever starts without you.

- **A (recommended). While a pull request is open, the session offers "Address the pull request's
  comments", and the open pull request's banner gives it as its button. The agent reads every
  unresolved comment, fixes each in a commit, and the pull request waits for you again.**
  - [pro] you choose when, and which bots' comments count is yours to say in the message.
  - [con] you start it each time.
  - Why recommended: it keeps you in control, needs no polling, and works today.
- **B. The core reads the pull request's unresolved comments, and a comment newer than the last
  commit sends the agent by itself.**
  - [pro] no click: feedback is picked up while you are away.
  - [con] the agent starts without you; a reviewer bot and the agent can loop.
- **C. Keep only "Request changes", and explain it.**
  - [pro] nothing to build.
  - [con] the path that never fired stays the only one.

**Answer:** A

### Q8.B: Whose comments send the agent by itself?

Only if you picked B in Q8. The Codex connector reviews every pull request here. Its comments are
the most frequent, and the agent's own push could trigger its next review. Devin and the Claude Code
GitHub Action ignore bots unless they are listed.

Why it matters: it decides whether the agent and a reviewer bot can wake each other.

- **A (recommended). Only people's comments; bots' comments wait for you to send the agent.**
  - [pro] no loop possible.
  - [con] the Codex review's findings need your click.
  - Why recommended: a loop between two agents spends tokens without you.
- **B. People's comments, and bots you list in the settings.**
  - [pro] the Codex findings are picked up too.
  - [con] a loop is possible, so it needs a cap per pull request.

**Answer:**

## Q9: What should count as a feature's problem?

Home moves any feature with a check error into "Needs you", with a red "Fix" badge. Right now the
specs redesign shows 14 errors while its agent builds. Its branch rewrote the templates, and the
server's build checks with the old ones. Checked with its own build, it has none. Over the last
day's 72 commits on feature folders, 63 had errors under today's build. Almost all are missing,
unknown, or misplaced sections, from such drift or from files still being written. Only an invalid
status or frontmatter stops the workflow, and that is rare.

Linters show only errors as blocking: ESLint and Vale exit 1 on errors alone. Google's analysis team
found that false positives give developers "a justification for inaction". More in
[discovery](discovery-01.md#what-counts-as-a-problem).

Why it matters: it decides whether "Needs you" can be trusted, and what `ura check` means for a
feature in progress.

- **A (recommended). A problem is what stops the workflow: an invalid status or frontmatter, a blank
  answer in an answered round. Only those show on Home and the cards. Every other error is a note on
  the feature page, in a folded list, and `ura check` stays as it is.**
  - [pro] "Needs you" means you; drift and unfinished files stay visible, quietly.
  - [con] a real format slip in a finished file is only a note.
  - Why recommended: it matches what the workflow already treats as blocking, with no change to the
    check.
- **B. Problems show only for the file waiting for you at a gate, and blocking errors.**
  - [pro] what you are about to read is checked.
  - [con] a drifted round still reads as a problem on Home.
- **C. The core turns format rules into warnings: `ura check` then passes with them.**
  - [pro] one meaning everywhere.
  - [con] agents and editors stop seeing format slips as errors.

**Answer:** A

## Settled without the human

### Check these

- **Template drift at the source** is not fixed: the core keeps checking with its own templates, not
  a branch's. Option A of what counts as a problem already quiets it, and the skill has agents
  rewrite old formats. See [discovery](discovery-01.md#template-drift-at-the-source).
- **The agent on GitHub** never replies to comments or resolves threads. It says in the session and
  its commits how it handled each comment, as the changes step does today. See
  [discovery](discovery-01.md#pull-request-comments).
- **Past features' tokens** are not read from Claude's transcripts: their output counts are
  placeholders, and their format is internal. See
  [discovery](discovery-01.md#past-features-have-no-tokens).
- **The look** comes as Storybook mockups in the spec, at both widths, not in this round. See
  [discovery](discovery-01.md#the-ongoing-page).
- **The specs redesign merges first**: this spec cites its rewritten decisions, and reuses its git
  reads. See [discovery](discovery-01.md#overlap-with-features-in-flight).

### Behaviour

- **A picked message** fills the composer, unsent and editable, like today's hand-over. It runs as a
  workflow run of its step. See [discovery](discovery-01.md#pre-filled-messages).
- **The gate buttons**, "Commit and start the agent", "Approve and start the agent", and the others,
  keep filling the composer with their step's message. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The open pull request's banner** gets a real button: the pull request's link, or the comments
  pass. Today's button links back to the page. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **A stage in progress** shows its start and "in progress", never a duration. See
  [discovery](discovery-01.md#dashboards-of-a-single-item).
- **A feature with problems that do not block** stays under "Agents at work" on Home. See
  [discovery](discovery-01.md#problems-found-on-features-in-progress).
- **A merged feature's left worktree** still shows "Run `ura clean`". See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

### Under the hood

- **Milestones** come from the commits scoped by the slug, typed by step, read through the core's
  git module. See [discovery](discovery-01.md#data-a-summary-needs-and-where-it-is).
- **Tokens** come from each run's final `modelUsage`, mapped to a neutral usage event by the Claude
  adapter, and stored per turn in the runner's cache. The cache's file is over its size limit, so
  its migrations move out first. See [discovery](discovery-01.md#claude-codes-token-usage).
- **The messages on offer** come from the server, which owns their texts, from the core's step. The
  trigger joins the message, as the agents decision already requires. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **Whether an error blocks** is decided once, in the core, and sent with each problem. See
  [discovery](discovery-01.md#rules-and-their-owners).

**Notes:**
