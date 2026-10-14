---
status: answered
---

# Clarifications, round 01: Dedicated session view

> [!NOTE]
>
> Answered on 2026-10-14.
>
> - **A choice that lasts.** Giving the session a page of its own on a desktop changes the
>   [UI layout](../decisions/ui-layout.md) decision. That decision opens every detail in a pane
>   beside its list.
> - **Two questions work together.** What sits beside the transcript decides where the plan's
>   progress shows inside the session, and the sidebar question decides where it shows outside it.
> - **A gap in the proposal.** For an agent started outside the UI, the plan's progress already
>   updates from its worktree. Whether the UI should also show that agent as working is yours to
>   say.
> - **A workflow change.** Progress inside a task would mean agents check each step's box as they
>   go, which changes the skill.
> - **Points settled without you.** Nine are listed at the end: what "Task 7/11" counts, the phone,
>   chats, and the addresses.

## Context

The [proposal](proposal.md) asks for two things:

- a session view of its own on a desktop, since following the agent is one of the main things the UI
  is for;
- the plan's current task, "Task 7/11", in the sidebar, taken from the plan's checkboxes, so it
  shows whoever runs the agent.

Today, on screens from 768 px, a feature's session opens in a pane 40% wide beside the feature page,
about 480 px of a 1440 px window ([`App.tsx`](/packages/web/src/App.tsx),
[`Panes.tsx`](/packages/web/src/layout/Panes.tsx)). The pane came from the old run view, and no
feature asked about it since. On the phone, and for chats, the session is already a page.

The core already knows the current task: the first one with an unchecked step, "Task 3: The repeat
menu". Home shows it, but the sidebar does not, and no total is computed. The core watches every
worktree's `specs/` folder and reads it from disk, so a plan's checkboxes reach the UI within a
second, even when an agent started in a terminal checks them.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Where does a feature's session open on a desktop?

Products that run agents show a session as a full page (Claude Code's desktop app, Devin, Codex), or
as a side panel that can be maximized or moved to a tab of its own (VS Code, Claude Code's VS Code
extension). Most pin the agent's progress beside the transcript. The
[UI layout](../decisions/ui-layout.md) decision says "a detail opened from a list MUST open in a
pane beside the list" on wide screens, and the session is drawn as such a detail today. More in
[discovery](discovery-01.md#session-layout-on-wide-screens).

Why it matters: it sets how much room following an agent gets, and whether the UI layout decision
changes, which only you can decide.

- **A (recommended). The session opens as a page of its own at `/f/<folder>/session`, at every
  width, with the transcript in the reading column and a narrow column beside it for the feature's
  progress. The UI layout decision gets a proposed change: a session is a page, not a detail.**
  - [pro] the transcript gets the window, and the progress stays in view while it scrolls.
  - [pro] it matches chats, which are already full pages.
  - [con] the feature page is no longer beside the session: its files are one click away.
  - Why recommended: it answers the proposal directly. The column keeps the context the pane gave,
    in a form that suits following an agent.
- **B. The session opens as a page of its own at every width, with the transcript alone. The header
  gains one line with the step and the current task. Same change to the UI layout decision.**
  - [pro] the most room for the transcript, and the least to build.
  - [con] the plan's tasks show nowhere in the session, only the current one.
- **C. The session stays a pane beside the feature page, with a resize edge and a Maximize button
  whose state is kept in the URL. The UI layout decision stays as it is.**
  - [pro] no decision changes, and the feature page stays one glance away.
  - [con] following an agent takes an extra click every time, and a maximized pane is a page in all
    but name.

**Answer:** A

### Q1.A: What sits beside the transcript?

Only if you picked A in Q1. Products put the agent's plan or todo list there, and nearly all of them
add the files changed so far, often with a diff. The chat feature left a diff view for later
([Q9 of the chat](../done/2026-10-13-chat-in-the-web-ui.md#q9-what-else-ships-with-the-chat)). The
column can fold away, like the sidebar. More in [discovery](discovery-01.md#the-side-column).

- **A (recommended). The column shows four things: the feature's step, the plan's tasks with their
  checks and the current one marked, the running sub-agents, and links to the feature page and its
  files.**
  - [pro] it answers "where is the feature, and what runs now" from the plan, without new git work.
  - [con] the column does not show what the agent changed: that stays in the transcript's tool
    calls.
  - Why recommended: it is what the proposal asks for, and the diff stays a feature of its own.
- **B. A, plus the files changed on the branch since it started, with their added and removed line
  counts, each opening the file.**
  - [pro] it shows what the agent did so far at a glance, as most products do.
  - [con] the server needs a git diff summary per feature, kept live, and the full diff view would
    still be missing.

**Answer:** B: Only add B if it’s not too hard

## Q2: How does the current task show in the sidebar?

The sidebar's rows hold one line of text. Astryx's `SideNavItem` takes a badge at its end, or nested
rows under it, which is how running sub-agents show today. Both are hidden when the sidebar is
folded. The current task is shown only while a feature is in its implementation. More in
[discovery](discovery-01.md#plan-progress-in-the-sidebar).

Why it matters: it decides whether the sidebar tells you which task, or only how far along, and
whether it leads straight to the session.

- **A (recommended). A nested row under the feature's row, "Task 7/11: The repeat menu", cut to the
  sidebar's width, opening the session. The feature's row still opens the feature page.**
  - [pro] it says what the agent works on, and gives a one-click path to follow it.
  - [con] one more row per feature in its implementation.
  - Why recommended: the proposal's problem is following what happens, and the title says more than
    a count.
- **B. A "7/11" badge at the end of the feature's row, with the task's title read by screen readers
  only.**
  - [pro] no extra rows, and a compact sidebar.
  - [con] the title shows nowhere in the sidebar, and the session stays two clicks away.
- **C. Both the badge and the nested row.**
  - [pro] the count shows even when the nested row is cut.
  - [con] the count shows twice.

**Answer:** A: Use icons to make it as short as possible, should be small and visual more than
textual

And btw do the same for the feature name, use the slug

## Q3: Should the UI show that an agent it did not start is working?

The plan's progress already updates for an agent started in a terminal, since the core reads the
worktree from disk. But that agent has no session in the UI, so its feature shows as "Idle", and its
session view is empty. More in [discovery](discovery-01.md#agents-the-server-did-not-start).

Why it matters: "Idle" next to a moving "Task 7/11" can mislead, but any fix is a guess or a parser
for one agent's private files.

- **A (recommended). Show the progress only: the status stays as it is today, and the session view
  says no session runs from the UI.**
  - [pro] nothing shown is a guess, and it works for any agent.
  - [con] a terminal agent's feature still reads "Idle".
  - Why recommended: the progress is what the proposal asks for, and it is exact.
- **B. Show a "Changed recently" mark on a feature whose worktree's files or commits changed in the
  last few minutes, from the core's watcher.**
  - [pro] a sign of life for any agent, at little cost.
  - [con] an edit by hand looks the same, and the mark lingers after the agent stops.
- **C. Read Claude Code's own transcript files for the feature's worktree, and show them read-only
  in the session view.**
  - [pro] a terminal session can be followed in the UI, like the server's own.
  - [con] Claude Code only, a parser of its private files that changes between versions, and a
    second kind of session.

**Answer:** A

## Q4: Should the progress move within a task?

Today an agent checks a task's boxes together, once the task is validated, and commits them with its
code ([implementation](/skills/uraeda/references/implementation.md)). The progress therefore moves
one task at a time, and the transcript shows the rest. More in
[discovery](discovery-01.md#granularity-of-progress).

Why it matters: progress within a task means changing the skill for every agent, and the
implementation reference, its template, and the example must change together.

- **A (recommended). Keep the boxes checked per task, as today: the progress reads "Task 7/11".**
  - [pro] no change to the workflow.
  - [con] a long task shows no progress until it ends.
  - Why recommended: the transcript already shows what happens within a task, and the proposal asks
    for the task.
- **B. Agents check each step's box as soon as it is done, in the worktree, and commit them with the
  task, as today. The progress reads "Task 7/11 · step 3/5".**
  - [pro] finer progress, from the plan alone, for any agent.
  - [con] a change to the skill, and the steps are mostly test, run, implement, run, commit.

**Answer:** A

## Q5: What else ships with the session's page?

Users of other products most often ask for a way back to the end once they scroll up, and for the
agent's own checklist pinned in view. The UI already follows the end while you are there, within 24
px. Claude Code's checklist tools are off by default on its current models, and turning them on
would go against the [agents](../decisions/agents.md) decision: "Tools MUST NOT change the agent's
... settings". More in [discovery](discovery-01.md#following-the-end) and
[the agent's own checklist](discovery-01.md#the-agents-own-checklist).

Why it matters: it sets the feature's scope. B and C need more work, and C changes a decision.

- **A (recommended). A "Jump to the latest" button while you are scrolled up, and a status line that
  screen readers announce when a turn starts or ends and when the task changes. The agent's
  checklist calls stay plain tool rows.**
  - [pro] it fixes the most common complaint, and the transcript stops announcing every word.
  - [con] no agent checklist: the plan's tasks stand in for it.
  - Why recommended: the plan is the checklist that matters in this workflow, and it works for any
    agent.
- **B. A, plus the agent's checklist pinned above the composer whenever the agent writes one.**
  - [pro] the agent's own sub-steps show when it uses them.
  - [con] it rarely shows on current models, and needs a parser for each agent's tools.
- **C. B, with Claude Code's checklist tools turned on for every session, changing the agents
  decision.**
  - [pro] the checklist always shows.
  - [con] it changes how the agent works, which the agents decision forbids.

**Answer:** A

## Settled without the human

- **"Sidebar" in the proposal** is read two ways. For the session, it is the pane beside the feature
  page, the one that is "too small". For the task, it is the left navigation. See
  [discovery](discovery-01.md#what-the-sidebar-is).
- **"Task 7/11" counts tasks, not their numbers.** It is the position of the first task with an
  unchecked step among the plan's tasks, and the number of tasks. The core computes both and sends
  them with the feature's step: `## Task N` numbers are written by hand, and the stack decision
  keeps workflow logic in the core. See [discovery](discovery-01.md#task-n-of-m).
- **The progress shows only during the implementation.** It is recomputed from the plan as it is
  now. A revised plan can therefore raise the total or move back to an unchecked task, and the
  progress goes away once every box is checked. See [discovery](discovery-01.md#task-n-of-m).
- **One parser for the plan's tasks.** The core has two today, and the older one keeps counting
  boxes under a later heading that is not a task. The step will use the one the plan's review uses,
  so each rule lives in one place (principle VI). See [discovery](discovery-01.md#important-reads).
- **On the phone, the session stays a page of its own.** With A in Q1, the column's content becomes
  one line under the header, "Implementation · Task 7/11: The repeat menu", which opens the task
  list. See [discovery](discovery-01.md#narrow-screens).
- **With A in Q1:**
  - the column folds away, and its state is kept in the browser, like the sidebar's;
  - from 768 px, with the sidebar open, there are about 528 px to share, so you may fold either;
  - chats use the same page without the column, since they have no plan.

  See [discovery](discovery-01.md#the-side-column).

- **The addresses stay the same.**
  - `/f/<folder>/session`, hand-over (`?continue=`), Ask the agent (`?ask=`), and old run links all
    keep working.
  - With A or B in Q1, the session shows its crumbs and a level-1 heading at every width, and Back
    returns to the page it came from at its position.
  - The feature page keeps its Agent section and "Open the session".

  See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

- **Left for later:**
  - notifications, already their own item in [priorities](../PRIORITIES.md#next);
  - the diff view, as the chat left it;
  - model-written activity summaries, which would cost a model call every few seconds;
  - two sessions side by side.

  See [discovery](discovery-01.md#needs-no-choice).

- **Other features in flight.**
  - **Image attachments** rework the session page and the composer: this feature builds on it once
    it is merged, or rebases on it.
  - **Code quality** caps files at 500 lines, and the transcript is already over it: new parts go in
    new files.

  See [discovery](discovery-01.md#other-features-in-flight).

**Notes:**
