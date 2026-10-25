---
status: awaiting-human
---

# Clarifications, round 01: Feature page in the terminal look

> [!IMPORTANT]
>
> 6 questions, about 15 minutes.
>
> - Verdict: worth building, with changes. Your tabs work best as the feature's own pages, always
>   there, rather than editor tabs you open and close.
> - The tab line and the Home's layout, with prototypes to open: they work together. The tab line
>   likely becomes a rule of the layout decision for every feature page.
> - Scope gaps: the old-look document pages under the tab line, and how far the Storybook removal
>   goes.
> - A cost in dollars: Claude Code reports one per run, unverified on a subscription.
> - Settled points to check: the Session tab draws the session page of the session and New feature.
>   The phone scrolls the tab line sideways.

## Context

### Goal

You want a feature's page redrawn in the terminal look, without the Storybook link. It shows its
timeline, its state, its sessions, its metrics, and easier access to its files. Your idea is a tab
line in the centre column, with a Feature Home tab first, holding its own right sidebar.

### Today

- The page is the last one of a feature in the old look: Astryx cards inside the new shell
  ([`FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx)). It shows the stages as a
  stepper, Next beside a Sessions card, and two figures, lines and tokens. A plain list of files
  sits beside a Storybook link. At 1600 px, half its height is empty.
- Every file and the session already have their own address, such as `/f/<folder>/spec.md` and
  `/f/<folder>/session`. The questions, spec, and plan pages have their own right column of tabs:
  Contents or Outline, Review or Notes, and Session.
- The proposal, discovery, rulings, and record pages are still in the old look, with no column
  ([`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx)).
- Starting an agent step happens in the session, where the composer offers "Insert: Continue, write
  the plan". Rename is in the shell card's "…", Drop in the session composer's "…".

| Product       | Centre                                   | Side                     | Files and logs                    |
| ------------- | ---------------------------------------- | ------------------------ | --------------------------------- |
| GitHub PR     | Fixed tabs: Conversation, Commits, Files | Reviewers, links         | Tabs; state above them            |
| Jules         | Activity feed                            | Diff editor              | Summary: runtime, lines, branch   |
| Copilot agent | Session log                              | Progress, tokens, length | Commits link to their session     |
| VS Code, Zed  | Editor tabs, opened and closed           | Panels                   | Preview tab replaced on next open |

### Scope

In: the Home, the tab line, the metrics, the page's actions, and the Storybook link. The old-look
document pages are in if you pick them. Out: the session page itself, redrawn by the session and New
feature. Also out: the questions, spec, and plan pages, done, and keys, which wait for the keyboard
features.

### Sources

- The code: the feature page, the routes, the document pages and their column, the session page, and
  the runner cache's turns. Screenshots of today's page, taken in the sandbox.
- GitHub's pull request and Copilot docs, Linear's agent docs, Jules, Devin, Kiro, VS Code, Zed,
  edgy.nvim, the WAI-ARIA tabs pattern, and NN/g on tabs.
- The full investigation is in [discovery](discovery-01.md).

## Check these

- **The Session tab** draws the session page as the
  [session and New feature](/specs/2026-10-25-session-new/proposal.md) redesigns it, with its own
  right column. This feature builds after it, or on what it left, and draws no session of its own.
  See [discovery](discovery-01.md#overlaps-with-features-in-flight).
- **On the phone**, the tab line is one row under the top bar, scrolled sideways, with the open tab
  in view. The Home's column comes under its centre, in one column. See the
  [prototype](mockups/home-a-timeline.html), narrowed under 768 px.
- **A done feature** keeps one page, with its record drawn in place on Home, as today. It has no tab
  line: its folder and files are gone. See [discovery](discovery-01.md#needs-no-choice).

## Q1: How should the feature's files and sessions sit together?

Your idea: a tab line in the centre column, with Home first. A feature holds up to about ten files
and one or more sessions. At a half screen of 1205 px, the centre column is about 750 px wide.

Every file and the session already have an address. A line of fixed tabs is then navigation over
pages that exist: Back, reload, and links work as today. Editor tabs, opened and closed, need a
stored set of open tabs per feature. NN/g warns that overflowing tabs hide some and break spatial
memory. More in [discovery](discovery-01.md#the-tab-line).

Why it matters: the tab line frames every page of a feature, rounds and specs included. It would
likely become a rule of the [UI layout](/specs/decisions/ui-layout.md) decision, so later pages
follow it.

- **A (recommended). A line of fixed tabs on every page of the feature: Home, Proposal, each round
  of questions, Spec, Plan, and Session. The discovery, data model, rulings, and reviews sit under
  "More". Each tab is the page's own address.**

  [Fixed tabs, on Home](mockups/home-a-timeline.html) and [on the spec](mockups/home-a-spec.html)

  - [pro] nothing to open or close, and each page keeps its own right column.
  - [con] a file you read often, like a discovery, is one click deeper, under "More".
  - The Session tab opens the latest session; an older one, opened from Home, shows in that tab
    under its name.
  - Why recommended: it is your idea with no new state, and a tab only for each file you act on.

- **B. Editor tabs: Home stays first, and each file or session you open adds a closable tab. A
  single click opens a preview tab that the next replaces. Open tabs are kept per feature in the
  browser.**

  [Editor tabs](mockups/tabs-b-editor.html)

  - [pro] the tabs are exactly what you are working with, as in your editor.
  - [con] a close and preview model to learn, a cap to set, and tabs to restore after a reload.

- **C. No tabs: Home is a page, with the files and sessions in its column. A file or a session opens
  as its own page, and Back or the crumbs return.**

  [No tabs](mockups/tabs-c-none.html)

  - [pro] the least work, and nothing new to learn.
  - [con] moving between the spec and the session goes back through Home.

**Answer:**

## Q2: What should the Home show, and in what order?

All three put Next first, the column with the sessions, figures, and links on the right, and work
with any answer to Q1. Products share a state above everything, then a chronological view whose
events lead to their detail. The blueprint direction's process plan, with your gates marked, may
come back, as you said in layout and look. More in [discovery](discovery-01.md#the-homes-layout).

Why it matters: the Home is what the shell's cards open, so it is the page of a feature you see
most.

- **A (recommended). Next, then a vertical timeline: each stage with its times, its files, and, for
  the build, its tasks.**

  [Timeline](mockups/home-a-timeline.html)

  - [pro] each file sits in the stage that made it, so the timeline is also the file list.
  - [con] a long feature's timeline runs past the screen's height.
  - Why recommended: it merges your timeline and your files, and reads top to bottom on the phone.

- **B. A horizontal process plan with your gates marked, then Next, then the files and a feed of
  what happened, side by side.**

  [Process plan](mockups/home-b-process.html)

  - [pro] the whole process fits one line, gates included, as the blueprint drew it.
  - [con] the feed is new data to build, and the plan turns into a column on the phone.

- **C. Today's parts in panes: the stages as a row, Next beside the agent, the figures as tiles, and
  the files.**

  [Panes](mockups/home-c-panes.html)

  - [pro] the closest to today, so the least to build.
  - [con] the files stay a plain list, apart from the stages that made them.

**Answer:**

## Q3: Which figures should the page show?

Today: lines changed and tokens; once done, the total time, the questions, and the decisions. The
runner cache also keeps each turn's start, end, and cost, never shown. Claude Code reports a cost in
dollars per run. Whether it means anything on a subscription is not documented. More in
[discovery](discovery-01.md#figures).

Why it matters: a figure on every feature's Home is read as true. A wrong cost misleads, and an
empty one adds noise.

B can come on top of A.

- **A (recommended). Today's figures, plus the agent's working time and the elapsed time.**
  - Example: "agent time 2 h 51 min", "elapsed 6 h 02 min".
  - [pro] both come from times already stored, and tell a waiting feature from a working one.
  - [con] one more line per figure pane.
  - Why recommended: they are exact, and need no new data.
- **B. Also the cost in dollars, summed from Claude Code's reports.**
  - Example: "cost $14.20".
  - [pro] a familiar measure of what a feature took.
  - [con] on a subscription it is an estimate of what an API key would have paid, not what you pay.
- **C. Today's figures only.**
  - [pro] nothing new.
  - [con] the page cannot tell how long the agent worked.

**Answer:**

## Q4: Should the Home start the agent's next step?

Example: the plan is approved and the agent is idle. Today, Next says "Open the session" to start
it. In the session, the composer offers "Insert: Continue, write the plan", which you then send.

Rename is in the shell card's "…", and Drop in the session composer's "…". More in
[discovery](discovery-01.md#the-pages-actions).

Why it matters: it decides whether the Home is a page of actions or a view to read.

- **A (recommended). Next always has one button: "Continue: write the plan" opens the Session tab
  with that message inserted, unsent. A "…" on the feature's name holds Rename and Drop.**
  - Example: you click "Continue: write the plan", see the message in the composer, and press Send.
  - [pro] every step is one click from the Home, and nothing sends without you.
  - [con] Drop sits on a page you visit often, behind its confirmation.
  - Why recommended: it reuses the recommended message and keeps sending in the session.
- **B. Keep Next's button for your gates only, as today.**
  - Example: Next says "The agent is idle: open the session to write the plan".
  - [pro] nothing new.
  - [con] starting a step stays two pages away.

**Answer:**

## Q5: How far should the Storybook link's removal go?

The same "feature's stories" page is linked from the feature page, the session's column, and the
change's column, and served by its own route. The live stories in rounds and specs do not use it:
they rely on Storybook, started by every page of the feature. More in
[discovery](discovery-01.md#removing-storybook).

Why it matters: removing one link leaves two paths to a page you said does not really work.

- **A (recommended). Remove every link to the Storybook page, and the page itself; Storybook still
  starts for the live stories.**
  - [pro] one less broken path anywhere.
  - [con] the session's column changes, which the session and New feature also edits.
  - Why recommended: it is what you asked for in layout and look: "remove the storybook access".
- **B. Remove the feature page's link only.**
  - [pro] touches nothing outside this page.
  - [con] the page stays reachable from the session's column.

**Answer:**

## Q6: Should the old-look document pages join the tab line's look?

With fixed or editor tabs, the proposal, discovery, rulings, data model, and record pages would sit
under the same line as the round and spec. Those pages are in the old look, with no column. The spec
page's column, Contents and Session, can be reused. More in
[discovery](discovery-01.md#the-document-pages).

Why it matters: without it, the tabs show two looks side by side; with it, the feature grows by a
page component.

- **A (recommended). Give those pages the documents' column, Contents and Session, and their text in
  the round's reading measure.**
  - [pro] one look under the tab line, and the agent can be asked about any document.
  - [con] more pages to check at three widths.
  - Why recommended: it reuses the spec page's column, and is cheap.
- **B. Leave them as they are.**
  - [pro] a smaller feature.
  - [con] two looks under one tab line.

**Answer:**

## Settled without the human

### Behaviour

- **The Home's column** holds stacked panes, Sessions, figures, and Links, not tabs: it is glanced
  at, not read. It folds with `]` and resizes like the documents' column. See
  [discovery](discovery-01.md#the-feature-homes-own-sidebar).
- **Sessions on Home** keep today's rows, Stop, and New session. See
  [discovery](discovery-01.md#important-reads).
- **A change** gets the same page, with its own stages and tabs. See
  [discovery](discovery-01.md#needs-no-choice).
- **A blocked feature** keeps its banner first, before Next. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

### Under the hood

- **The tab line is links**, with `aria-current="page"`, not ARIA tabs: each tab is a page. NN/g and
  the WAI-ARIA pattern keep navigation and in-page tabs apart. See
  [discovery](discovery-01.md#wai-aria-tabs-and-navigation).
- **The timeline's stages** stay the core's history, with no new data. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **One component per part**: the tab line and the timeline live in the shared layout. Every page
  that shows them reuses them, as the UI coherence decision asks. See
  [discovery](discovery-01.md#likely-changes).

**Notes:**
