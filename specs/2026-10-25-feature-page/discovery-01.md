# Discovery, round 01: Feature page in the terminal look

## Summary

A feature's page in tools of this kind is a hub: a header with the current state, a home view of
what happened, and tabs or links to the artifacts and the agent's logs. GitHub's pull request page
keeps its merge state outside its tabs, and Jules, Devin, and Copilot show an agent's progress,
time, and tokens beside its log. Editors such as VS Code and Zed open files as closable tabs, with a
preview tab that the next click replaces.

The proposal asks for the page redrawn in the terminal look: the timeline, the state, the sessions,
the metrics, and better access to the files, without the Storybook link. Its idea is a tab line in
the centre column, with a "Feature Home" tab first, holding its own right sidebar.

Today the page is the last one of a feature still in the old look: Astryx cards, a `Stepper`, and a
grid, inside the new shell ([`FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx)). Each
file and the session already have their own address under `/f/<folder>/`, and the questions, spec,
and plan pages have their own right column of tabs. A tab line can therefore be navigation over
existing pages, with no new state. The proposal, discovery, rulings, and record pages are still in
the old look too. The session page is being redrawn by the
[session and New feature](/specs/2026-10-25-session-new/proposal.md), in flight.

## How other products do it

### GitHub pull request page

- Tabs for Conversation (the timeline), Commits, Checks, and Files changed; the merge state sits in
  the header and the merge box, outside the tabs
  ([about pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests)).
- Files changed has a file tree, a "Viewed" box per file, and a progress bar of files viewed
  ([reviewing proposed changes](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)).
- The right sidebar holds reviewers, linked issues, projects, and milestones (same page).

### GitHub Copilot coding agent

- A session view holds the log, the agent's reasoning and tools, and an overview of "the agent's
  progress, token usage, and session length", with follow-up prompts and Stop
  ([track Copilot sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/track-copilot-sessions)).
- Sessions are reached from a panel on every page, and from the pull request: "Each commit message
  includes a link to the session logs" (same page).

### Linear agents

- An agent session has six states set from its last activity, and five kinds of activity: thought,
  elicitation (a question to the human), action, response, and error. A plan is a checklist of steps
  ([agent interaction](https://linear.app/developers/agent-interaction)).
- Work is delegated by assigning the issue to the agent
  ([agents in Linear](https://linear.app/docs/agents-in-linear)).

### Jules

- A task shows a live activity feed of steps, outputs, errors, and requests for input, with small
  diffs inline. A diff editor sits in the right pane, and a summary lists files changed, total
  runtime, lines changed, and the branch ([Jules code docs](https://jules.google/docs/code/)).
- A plan is shown for approval before any code changes ([Jules docs](https://jules.google/docs/)).

### Devin

- A Progress tab is "one unified view" of shell commands, edits, and browsing; a command jumps the
  session to that point in time. Side chats open "in a panel next to the worklog"
  ([session tools](https://docs.devin.ai/work-with-devin/devin-session-tools)).

### Kiro

- A spec is three files, requirements, design, and tasks, run in phases with approval gates;
  `tasks.md` shows each task's live status, and a floating Review button comments on a document for
  the agent ([Kiro specs](https://kiro.dev/docs/specs/)). It is the closest to Uraeda's workflow.

### Editors: VS Code, Zed, Neovim

- VS Code: a single click opens an italic preview tab that the next one reuses; pinned tabs stay in
  view; overflow scrolls or wraps; `Ctrl+Tab` goes to the previous editor; open tabs are restored at
  launch ([user interface](https://code.visualstudio.com/docs/getstarted/userinterface)).
- Zed: one preview tab per pane, `max_tabs`, and `activate_on_close` choosing the tab opened after a
  close ([configuring Zed](https://zed.dev/docs/configuring-zed)).
- edgy.nvim pins side views to the window's edges, with titles and keys to move between them
  ([edgy.nvim](https://github.com/folke/edgy.nvim)); bufferline.nvim draws buffers as tabs, with
  pinning and groups ([bufferline.nvim](https://github.com/akinsho/bufferline.nvim)).

### Pipelines

- GitHub Actions draws a run's jobs as a graph with a status per job, each opening its log
  ([visualization graph](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-the-visualization-graph)).
  GitLab groups jobs by stage, with a mini graph of each stage's result
  ([pipelines](https://docs.gitlab.com/ci/pipelines/)).

### What they have in common

- **The state above the tabs**: what waits, and on whom, readable without switching (GitHub's merge
  box, Linear's session state, Jules' summary).
- **A chronological home view**: a timeline or activity feed whose events link to their detail.
- **The agent's sessions reachable from the work**, with status, time, and tokens, and a way to
  steer or stop.
- **Plans as checklists with live status**, and phases with approval gates (Kiro, Jules, Linear).
- **Metrics**: runtime, files and lines changed, tokens.
- **Diffs in their own view**, with a file tree.
- **Documents commented for the agent** (Kiro's Markdown Review), which Uraeda's rounds and spec
  review already do.

## Standards and libraries

### WAI-ARIA tabs and navigation

- The tabs pattern is for panels in one page: `tablist`, `tab`, and `tabpanel`, one Tab stop, arrows
  between tabs, and Delete closing a closable tab
  ([APG tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/),
  [manual activation](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-manual/)).
- A stepper is an ordered list with `aria-current="step"` on the current step, and its status in
  text, never in colour alone
  ([Pluma stepper](https://pluma.customer.io/components/stepper/accessibility)).

### Tabs and their pitfalls

- Nielsen Norman Group: content in tabs other than the first is often missed; navigation and in-page
  tabs should not share one control; overflowing tabs hide some and break spatial memory
  ([tabs, used right](https://www.nngroup.com/articles/tabs-used-right/)).
- Without a preview tab, every click adds a tab (VS Code and Zed above). Users expect open tabs to
  survive a reload, and a predictable tab after a close (same sources).

### Astryx 0.7.3

- The page today uses `Stepper`, `Card`, `Grid`, `List`, and `Collapsible`
  ([`Stages.tsx`](/packages/web/src/feature/Stages.tsx),
  [`Figures.tsx`](/packages/web/src/feature/Figures.tsx)). The terminal look's pane is ours,
  [`Pane.tsx`](/packages/web/src/layout/Pane.tsx), and the right column is
  [`SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx) under
  [`DocumentColumn.tsx`](/packages/web/src/layout/DocumentColumn.tsx).

## The code

### Important reads

- [`FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx) (207 lines): crumbs, title, header
  line, [`Stages`](/packages/web/src/feature/Stages.tsx), the blocking banner, the left-worktree
  banner, [`NextCard`](/packages/web/src/feature/NextCard.tsx) beside
  [`SessionsCard`](/packages/web/src/feature/SessionsCard.tsx), then "What it produced" with
  [`Figures`](/packages/web/src/feature/Figures.tsx),
  [`FileList`](/packages/web/src/feature/FileList.tsx), and, once done,
  [`Record`](/packages/web/src/feature/Record.tsx), then the folded notes. Old look: Astryx cards in
  a plain `Page`, no pane, no column. No file of the folder is over 300 lines.
- [`next.ts`](/packages/web/src/feature/next.ts): who acts and the one button, for each step. An
  agent's step has no button: Next says to open the session.
- [`SessionsCard.tsx`](/packages/web/src/feature/SessionsCard.tsx): each session's status, name,
  start, running sub-agents, and for the latest one "Task n of m" and its last run, with Stop and
  "New session". The latest links to `/f/<folder>/session`, earlier ones to `/sessions/<id>`.
- [`FileList.tsx`](/packages/web/src/feature/FileList.tsx): the files in workflow order with their
  status badge, "not yet" rows for a missing spec and plan, and links: Storybook, the pull request,
  mockups.
- [`routeTable.ts`](/packages/web/src/routeTable.ts): `/f/<folder>`, `/f/<folder>/session`,
  `/f/<folder>/storybook`, `/f/<folder>/<file>`, `/f/<folder>/mockups/<name>`,
  `/f/<folder>/decisions/<name>`. Every file and the session already have an address.
- [`FilePage.tsx`](/packages/web/src/FilePage.tsx): a round opens
  [`RoundPage`](/packages/web/src/RoundPage.tsx), a spec
  [`SpecPage`](/packages/web/src/spec/SpecPage.tsx), a plan
  [`PlanPage`](/packages/web/src/PlanPage.tsx), each with its right column of tabs; the proposal,
  discovery, rulings, and record open [`DocumentPage`](/packages/web/src/DocumentPage.tsx), the old
  look with no column; the data model opens
  [`DataModelPage`](/packages/web/src/spec/DataModelPage.tsx), panes without a column.
- [`DocumentColumn.tsx`](/packages/web/src/layout/DocumentColumn.tsx): the right column's tabs, the
  open one in `?tab=`, its width shared under `uraeda.documentColumn`, folded with `]`. The
  questions page uses Outline, Notes, Session; the spec and plan pages Contents, Review, Session.
- [`SessionView.tsx`](/packages/web/src/SessionView.tsx) (340 lines, over the limit) and
  [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx) (381 lines, over the limit): the session
  page and its "Progress" column, which holds a "Feature page" link and a Storybook row. The session
  already embeds in a column (`isBoxed`), through
  [`ColumnSession.tsx`](/packages/web/src/ColumnSession.tsx).
- [`App.tsx`](/packages/web/src/App.tsx): `StartsStorybook` starts the checkout's Storybook on every
  `/f/` page, for the live stories that rounds and specs embed.
- History: stages and figures come from the core, [`history.rs`](/crates/core/src/history.rs) and
  [`figures.rs`](/crates/core/src/history/figures.rs); tokens from the server,
  [`fate/tokens.ts`](/packages/server/src/fate/tokens.ts). A stage has only its start; its end is
  the next stage's start.
- The runner cache's `turns` table keeps each turn's `step`, `started_at`, `ended_at`, and
  `cost_usd` ([`migrations.ts`](/packages/server/src/runner/migrations.ts)). The cost comes from
  Claude Code's `total_cost_usd`
  ([`claude-events.ts`](/packages/server/src/runner/claude-events.ts)). No page shows the turns'
  times summed, or the cost.
- Screenshots of today's page, taken in the sandbox at 1600 px: a live feature shows the stepper,
  Next beside an empty "Sessions" card, two figure tiles, and the file list beside a "Storybook"
  link, with half the page's height empty.

### The proposal's path and existing actions

- **Opening a feature**: from the shell's In progress or Needs you, today's page. With a tab line,
  the same address opens the Home tab.
- **Opening a file**: today a row of the file list, leaving the page; Back returns. With a tab line,
  the file's page draws under the same line, and Back works the same, since each tab is an address.
- **Opening the session**: "Open the session" was replaced by the Sessions card's rows; the latest
  session is `/f/<folder>/session`. Its page has its own column, which the session and New feature
  is redrawing.
- **Asking the agent from a document**: the document's column has a Session tab, unchanged by a tab
  line above the page.
- **Starting the next agent step**: today, Next says to open the session, where the composer offers
  the recommended message ("Insert: Continue, write the plan"). The page has no button for it.
- **Renaming and dropping**: rename is in the shell card's "…", drop in the session composer's "…";
  the page has neither.
- **A done feature**: its folder is gone; the page draws the record in place, its figures, and its
  stages. Only the record file remains.
- **A change**: the same page, with its stages (Proposal, Questions when it had a round, Fix, Pull
  request, Merged).
- **A blocked feature**: a banner "This feature cannot go on" with a button to the file; its notes
  folded at the bottom.

### Rules and their owners

- **The step and who acts**: the core's `StepView`; the page's words in
  [`next.ts`](/packages/web/src/feature/next.ts) only.
- **Stage times and figures**: the core's history; tokens in the server's `featureTokens`.
- **The open tab of a column**: `?tab=` through `useColumnTab` in
  [`DocumentColumn.tsx`](/packages/web/src/layout/DocumentColumn.tsx).
- **The recommended message**: `recommendedMessage` in
  [`runner/message.ts`](/packages/server/src/runner/message.ts), read by the composer.
- **The column's width and fold**:
  [`documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts), shared by every
  document's column.

### Overlaps with features in flight

- **Session and New** ([its proposal](/specs/2026-10-25-session-new/proposal.md); its round waits
  for answers on its branch): it redraws the session page and its column, Activity, Changes, and
  Progress, and plans that "changed files and tasks are drawn by components the feature page can
  reuse". A Session tab here would draw that page. Both touch the session routes and
  `SessionAside.tsx`.
- **Inbox and priorities** ([its proposal](/specs/2026-10-25-inbox-priorities/proposal.md); its
  round, on its branch): proposes vim-like keys and a key map, possibly a global leader key. No
  shared files with this page.

### Likely changes

- [`packages/web/src/feature/`](/packages/web/src/feature/): the Home redrawn in panes, under every
  option; `Stages.tsx` rewritten as the timeline the answer picks; `Figures.tsx` and `FileList.tsx`
  moved into the column or the timeline.
- A tab line component in [`packages/web/src/layout/`](/packages/web/src/layout/), with fixed or
  editor tabs; drawn by `FilePage`, the session routes, and the Home.
- [`FilePage.tsx`](/packages/web/src/FilePage.tsx) and
  [`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx): with the document pages in scope, a
  document column of Contents and Session.
- [`fate/tokens.ts`](/packages/server/src/fate/tokens.ts) or a sibling: with agent time or cost,
  sums of the feature's turns.
- [`App.tsx`](/packages/web/src/App.tsx), [`routeTable.ts`](/packages/web/src/routeTable.ts),
  [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx), `ChangeAside.tsx`, `StorybookPage`: with
  the Storybook page removed.
- Tests: [`feature-page.test.tsx`](/packages/web/src/__tests__/feature-page.test.tsx),
  [`feature-done.test.tsx`](/packages/web/src/__tests__/feature-done.test.tsx), the browser test
  [`feature.test.tsx`](/packages/web/src/__browser__/feature.test.tsx), and the stories in
  [`FeaturePage.stories.tsx`](/packages/web/src/feature/FeaturePage.stories.tsx).

## The proposal

### Tabs in the centre column

The proposal does not say whether tabs are opened and closed by the human, like an editor's, or are
the feature's pages, always there. The first needs a stored set of open tabs per feature; the second
is navigation over existing addresses. NN/g warns against mixing the two in one control.

### "Sessions and files as tabs"

A feature holds up to about ten files (proposal, a discovery and a round per round, spec, review
files, data model, plan, rulings) and one or more sessions. As tabs, they overflow a centre column
of about 750 px at a half screen of 1205 px, where the shell is a 52 px rail and the column 400 px.

### The Feature Home's own sidebar

The proposal names a sidebar for Home without its content. The other pages' column holds tabs
(Contents, Review, Session); Home's content is glanced at, not read.

### Metrics

"Metrics" is open. The page shows lines changed and tokens, and once done the total time, the
questions, and the decisions. The cache also holds each turn's times and cost, never shown.

### The Storybook link

The proposal removes the link; the same Storybook page is linked from the session's column and the
change's column, and a route serves it. Live stories in rounds and specs rely on the Storybook
started by every `/f/` page, not on the link.

### Old-look document pages

The proposal, discovery, rulings, and record pages are not named, but they would be tabs of the
feature, in the old look beside the redrawn ones.

## Worth it and feasibility

- **Gain**: the last page of a feature in the old look, the hub the shell's cards open, and a page
  that today leaves half its height empty while its files sit in a plain list.
- **Cost**: mostly UI. A tab line over existing addresses adds no server state; editor tabs add a
  stored set per feature. Agent time and cost add sums over the runner cache. The document column on
  the document pages reuses what the spec page built.
- **Outside behaviour relied on**: Claude Code's `total_cost_usd` is reported per run; whether it
  means anything for a subscription, rather than an API key, is not documented in what was read, and
  is unverified.
- **No guard is relaxed.**

## Approaches

Criteria: the proposal; the [UI layout](/specs/decisions/ui-layout.md) decision (an open detail or
tab in the URL; a view the human follows on a page of its own; a column foldable and resizable;
mockups at three widths); [UI coherence](/specs/decisions/ui-coherence.md) (one component per kind
of information); [UI look](/specs/decisions/ui-look.md) (titled panes); WAI-ARIA and NN/g above.

### The tab line

How the feature's files and sessions sit together. Relies on
[tabs in the centre column](#tabs-in-the-centre-column) and
[tabs and their pitfalls](#tabs-and-their-pitfalls).

| Option                                            | State to keep                        | Overflow                    | Back and reload | Coherence                         |
| ------------------------------------------------- | ------------------------------------ | --------------------------- | --------------- | --------------------------------- |
| A. Fixed tabs: the feature's pages, always there  | None: addresses                      | Secondary files in "More"   | As today        | Each page keeps its own column    |
| B. Editor tabs, opened and closed, with a preview | Open set per feature, in the browser | Grows with use, needs a cap | Needs restoring | Same, plus a close model to learn |
| C. No tabs: Home with its files in its column     | None                                 | None                        | As today        | As today                          |

Prototypes: [A on Home](mockups/home-a-timeline.html), [A on the spec](mockups/home-a-spec.html),
[B](mockups/tabs-b-editor.html), [C](mockups/tabs-c-none.html).

### The Home's layout

What the Home tab shows and in what order. Relies on
[what they have in common](#what-they-have-in-common) and
[the Feature Home's own sidebar](#the-feature-homes-own-sidebar).

| Option                                                                | Files reached  | State first | New data         |
| --------------------------------------------------------------------- | -------------- | ----------- | ---------------- |
| A. A vertical timeline, each stage with its files and times           | In their stage | Next pane   | None             |
| B. A horizontal process plan with your gates, then files and activity | A files pane   | Next pane   | An activity feed |
| C. Today's parts in panes: stages row, Next and agent, tiles, files   | A files pane   | Next pane   | None             |

Prototypes: [A](mockups/home-a-timeline.html), [B](mockups/home-b-process.html),
[C](mockups/home-c-panes.html). The blueprint direction's process plan, which
[layout and look](/specs/done/2026-10-20-layout-look.md#q3-should-any-part-come-from-a-direction-other-than-your-pick)
said may come back, is B's.

### Figures

Which figures show. Relies on [metrics](#metrics).

| Option                                  | Source            | Reliable                      |
| --------------------------------------- | ----------------- | ----------------------------- |
| A. Today's, plus agent time and elapsed | Turns' times      | Yes                           |
| B. Also the cost in dollars             | Turns' `cost_usd` | Unverified for a subscription |
| C. Today's only                         | As today          | Yes                           |

### The page's actions

What the Home lets the human do. Relies on
[the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                               | New controls | Destructive action moved |
| -------------------------------------------------------------------- | ------------ | ------------------------ |
| A. Next's button for every step, "Continue" included, and a "…" menu | 2            | Drop, into the menu      |
| B. Next's button for the human's gates only, as today                | 0            | No                       |

### Removing Storybook

How far the removal goes. Relies on [the Storybook link](#the-storybook-link).

| Option                                                          | Places changed           | Live stories |
| --------------------------------------------------------------- | ------------------------ | ------------ |
| A. Every link and the Storybook page go; Storybook still starts | Page, two columns, route | Unchanged    |
| B. The feature page's link only                                 | One                      | Unchanged    |

### The document pages

Whether the old-look document pages join. Relies on
[old-look document pages](#old-look-document-pages).

| Option                                                                           | Work                       | Coherence under the tab line |
| -------------------------------------------------------------------------------- | -------------------------- | ---------------------------- |
| A. Proposal, discovery, rulings, data model, and record get Contents and Session | Reuse of the spec's column | One look                     |
| B. Left as they are                                                              | None                       | Two looks side by side       |

### Needs no choice

- **The state above the tabs**: Next is the Home's first pane under every option, and the shell's
  card already shows the step on every page.
- **A chronological home view**: the timeline of the Home's layout, under every option.
- **Sessions reachable from the work**: the Home's sessions pane, with Stop and New session, as
  today.
- **Plans as checklists**: the plan page and the Build stage's tasks, as today.
- **Diffs in their own view**: the session and New feature's Changes tab; the pull request has its
  own on GitHub. Out of this page.
- **Documents commented for the agent**: the round and spec pages do it already.
- **A done feature and a change**: the same page, as
  [redesign feature](/specs/done/2026-10-18-redesign-feature.md) settled; a done feature has only
  its record, drawn on Home.
- **Keys**: tab keys wait for the keyboard features in Now; the tab line names none.

## Not checked

- Linear's issue page sidebar: [editing issues](https://linear.app/docs/editing-issues) and
  [issue details](https://linear.app/docs/issue-details) returned 404.
- Cursor's and Codex cloud's task page layout: their docs
  ([Cursor agents window](https://cursor.com/docs/agent/agents-window),
  [Codex cloud](https://learn.chatgpt.com/docs/cloud)) describe features, not the layout.
- Whether Claude Code's `total_cost_usd` is meaningful on a subscription: no source found.
