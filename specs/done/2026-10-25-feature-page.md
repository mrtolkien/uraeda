---
kind: feature
finished: 2026-10-26
pull-request: https://github.com/mrtolkien/uraeda/pull/59
superseded-by: [2026-10-30-phone-bottom]
---

# Record: Feature page in the terminal look

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-25, finished on
> 2026-10-26, in [its pull request](https://github.com/mrtolkien/uraeda/pull/59). Its full files are
> in git: `git log -- specs/2026-10-25-feature-page/`.
>
> Superseded in part by [2026-10-30-phone-bottom](2026-10-30-phone-bottom.md).

## What and why

A feature's or a change's page was the last page of a feature still in the old look: Astryx cards
and a stepper in the new shell, half its height empty, its files in a plain list beside a Storybook
link. It is redrawn in the terminal look of [layout and look](./2026-10-20-layout-look.md): what
comes next first, a timeline of the stages that made the feature with their files, and a column of
sessions, figures, and links. The old-look document pages join it, and the Storybook page goes.

## Behaviour

- The Home is titled panes: head with a "…" menu, the blocking banner and the left-worktree banner,
  **Next**, a **Timeline**, a done feature's record in place, and the folded format notes. Beside
  them, a foldable, resizable column (the documents' width and `]`) holds **Sessions**, **Produced
  so far** (**What it produced** once done), and **Links** (branch, worktree, pull request); on the
  phone it follows the timeline, and for a done feature the record.
- Next always offers one action. A human gate keeps its button and a peach pane. While the agent
  works the button is "Open the session". While it is idle at an agent's step the button is the
  recommended message's own name, "Continue, write the plan": it opens the feature's session with
  that message in the composer, before anything typed, unsent, Send reading "Start the agent". An
  agent not available on the machine leaves no button and says so. Merged reads "Merged" and "On Oct
  6, in pull request #31.".
- The timeline lists each stage with its time and duration ("09:32 · 3 h 10 min · 1 round"), the
  current one marked, and every file of the folder once, in its stage: proposal; discovery and
  rounds in Questions; spec, its review, data model, and mockups in Spec; plan, its review, and
  rulings in Plan (Fix for a change); the record in Merged. A file waiting on you reads "to review";
  a file whose stage the history lacks falls to the nearest earlier one; a stage not reached shows
  its name only. Build lists its tasks, done ones grouped, the current one by number and title.
- The figures add the agent's working time, the sum of the feature's ended turns plus a running turn
  counted to now, "Not recorded" with none, and the elapsed time from the proposal's start to now.
  Minutes are padded after an hour: "6 h 02 min". No cost in dollars. A done feature reads total
  time, lines, tokens, agent time, and questions and decisions leading to the record's parts.
- The "…" beside the name holds Rename (the shell card's own dialog) and "Drop the feature…" or
  "Drop the change…", which asks first. A dropped item opens Home with "Dropped the feature <slug>:
  its branch <branch> stays."; a drop that fails, or whose priorities commit was refused, keeps the
  page and shows the refusal under the name until dismissed. A done feature has no menu.
- The proposal, discovery, rulings, data model, and a record's file draw each `##` section as a pane
  whose id is its heading's anchor, with the documents' column of Contents and Session (no Session
  for a done feature, or without the agent). Selecting blocks and "Ask the agent" opens Session with
  "About <path>, lines A–B:" and the quote. On the phone the status line holds "Contents" and
  "Session".
- The Storybook page is gone from every column and link. A story linked inside a sentence opens at
  its old address, `/f/<folder>/storybook?story=<path>#<export>`, on a page of its own showing the
  story in the live window with Phone and Desktop; the address without a story, and `/storybook`,
  open Home. A story that no longer exists reads as such, without "Open in Storybook". Storybook
  still starts for live stories.

## Design

The Home composes parts the questions and spec pages built: `Pane`, the documents' column and its
width, and `SpecColumn`'s Contents and Session. Each rule has one owner: what comes next and its
action, which file sits in which stage, what agent time counts, the confirm-and-drop flow, and the
document page's section panes. The server sums the feature's turns where it sums tokens; the browser
adds the running turn and the elapsed time to its own clock.

- Next: [`feature/next.ts`](/packages/web/src/feature/next.ts) and
  [`NextPane.tsx`](/packages/web/src/feature/NextPane.tsx); Continue is the existing hand-over in
  [`sessions.ts`](/packages/web/src/sessions.ts).
- Timeline: [`stageFiles.ts`](/packages/web/src/feature/stageFiles.ts),
  [`Timeline.tsx`](/packages/web/src/feature/Timeline.tsx), and `timeline.ts` (stage lines).
- Column: [`FeatureColumn.tsx`](/packages/web/src/feature/FeatureColumn.tsx),
  [`ProducedPane.tsx`](/packages/web/src/feature/ProducedPane.tsx) with
  [`figureRows.ts`](/packages/web/src/feature/figureRows.ts),
  [`SessionsPane.tsx`](/packages/web/src/feature/SessionsPane.tsx), and `LinksPane.tsx`.
- Page and record: [`FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx) and
  [`Record.tsx`](/packages/web/src/feature/Record.tsx).
- Menu and drop: [`FeatureMenu.tsx`](/packages/web/src/feature/FeatureMenu.tsx) and the flow shared
  with the session's "…", [`dropItem.ts`](/packages/web/src/dropItem.ts); Home's notes in
  [`offers.ts`](/packages/web/src/offers.ts).
- Agent time: [`agentTime.ts`](/packages/server/src/fate/agentTime.ts), beside `tokens.ts`.
- Documents: [`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx),
  [`document/SectionPane.tsx`](/packages/web/src/document/SectionPane.tsx) (shared with the plan
  page), [`useAskSelection.tsx`](/packages/web/src/document/useAskSelection.tsx), and the data model
  page.
- Story page: [`StoryPage.tsx`](/packages/web/src/StoryPage.tsx) and the `storybook` route in
  [`App.tsx`](/packages/web/src/App.tsx).

## Questions

### Round 01

#### Q1: How should the feature's files and sessions sit together?

**Answer:** C: no tabs. "Actually let's not add tabs": Home is a page, its files in the timeline,
its sessions in its column.

#### Q2: What should the Home show, and in what order?

**Answer:** A: Next, then a vertical timeline, each stage with its times, its files, and for the
build its tasks.

#### Q3: Which figures should the page show?

**Answer:** A: today's figures plus the agent's working time and the elapsed time, no cost.

#### Q4: Should the Home start the agent's next step?

**Answer:** A: Next always has one button, "Continue" opening the session with the message inserted,
unsent, and a "…" on the name holding Rename and Drop.

#### Q5: How far should the Storybook link's removal go?

**Answer:** A: every link and the Storybook page go; Storybook still starts for live stories.

#### Q6: Should the old-look document pages join the tab line's look?

**Answer:** A: the proposal, discovery, rulings, data model, and record get Contents and Session.

#### Notes

- **On the phone**: no tab line on mobile for the moment.

## Decisions

No decision was created, changed, or removed.

## Changes after approval

- A story linked in a sentence keeps its old Storybook address, which now draws the story's page, so
  links already written in documents and transcripts still open.
- Elapsed and agent time read minutes padded after an hour, "6 h 02 min", as the spec has them.
- A drop whose priorities commit was refused keeps the page and shows the warning under the name, as
  the spec says, rather than opening Home.
- A story's embed in a document now fills its pane and stays inside it, instead of growing past the
  text's measure: a document's sections are panes.
- Build lists its tasks by number, without waves or durations, which the core does not read.
- The stage row's fit test went with the stepper; Questions reads "1 round" for one round.

## Follow-ups

- Six desktop and one phone browser test already failed before this branch (the sidebar's
  "Priorities" width, `usage`, `scroll-target`, `story-embed` resize and phone width), and
  `specs:check` fails on three broken links of the layout-and-look record, which stops
  `vp run ready` before the browser runs.
