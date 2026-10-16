---
status: awaiting-human
---

# Clarifications, round 01: Redesign sidebars and global interface

> [!IMPORTANT]
>
> 15 questions on the sidebars, statuses, notifications, and feedback, about 50 minutes.
>
> - Two choices change active decisions: what holds a run's "Working" (background commands), and
>   whether the client may guess a status, which the stack decision forbids today.
> - The theme's new home contradicts a point the settings page's round settled: it keeps the theme
>   in the sidebar. Whatever you pick here, comment there too.
> - Four requests cannot work as written: asking for notifications on the first visit (browsers
>   ignore it), notifications on the iPhone (only a Home Screen app can get them), graying out every
>   button, and optimistic statuses that guess the next step.
> - How the sidebar is organised, what hiding it does, and what a rename changes shape every page
>   redesign that follows.
> - The two requests you added in the chat, rename and colour, and optimistic statuses, are in this
>   round.
> - 13 points are settled without you, at the end, including two root causes of wrong statuses.

## Context

The [proposal](proposal.md) asks for a functional pass on the shell every page sits in: a sidebar
that shows Uraeda's hierarchy (Inbox > Priorities > Draft > Change > Feature) and each feature's
step; both sidebars hidden and resized easily; a home button on the phone; the last five done
features; accurate statuses, with the pull request's address; notifications when you are needed;
clear feedback on every button that works in the background; Enter picking the single suggestion
when adding a repository; and the theme leaving the sidebar. In the chat that started this round,
you added renaming or colouring a feature from a "…" on its row, and optimistic statuses in the
sidebar.

Today, the sidebar ([`Shell.tsx`](/packages/web/src/Shell.tsx),
[`SessionNav.tsx`](/packages/web/src/SessionNav.tsx)) is Astryx's `SideNav`: it already resizes from
its edge, 200 to 360 px, with a handle shown on hover, and folds to an icon rail from the chevron at
its bottom. It lists Home, Priorities, Inbox, New change, "Waiting on you", "Agents at work", Chats,
and every done feature. A feature's step shows only during implementation. The session's right
column, "Progress", is 320 px and does not resize.

The wrong statuses have three causes in the code: every view reads a feature's step with an unknown
pull request, so a feature reads "Pull request" from its last task to its merge; a branch in a
worktree counts as a feature without its folder, which is how `review-findings` showed; and a
background shell, like a long review, does not hold a run open, so the status reads "Needs you"
while it runs.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Is this one feature, or several?

The proposal covers five strands: the sidebar's organisation and look, accurate statuses (core and
server work), notifications, feedback on buttons, and small fixes. Statuses feed the other three:
the sidebar's step, notifications, and optimistic statuses all show them. More in
[discovery](discovery-01.md#splitting-the-feature).

Why it matters: one feature means one long spec to review; several mean several rounds, and the
sidebar waits on the statuses.

- **A (recommended). One feature, built in order: statuses first, then the sidebar, then
  notifications and feedback.**
  - [pro] one review of the whole shell; each strand builds on the one before.
  - [con] a long spec and plan.
  - Why recommended: the strands share the statuses, and splitting them puts the same files in two
    branches at once.
- **B. Statuses and notifications become their own feature; this one keeps the sidebar and the
  feedback.**
  - [pro] two smaller specs, each reviewed with its own focus.
  - [con] the sidebar's step and the optimistic statuses wait on the other feature.
- **C. Three features: statuses, the shell, notifications.**
  - [pro] the smallest specs.
  - [con] three rounds of questions and review, and the shell twice in flight.

**Answer:**

## Q2: How does the sidebar show Uraeda's hierarchy?

Today the sidebar groups features by who they wait on, "Waiting on you" and "Agents at work", has no
drafts, and shows a change only by a "Change" badge. Linear keeps its statuses in a fixed order of
categories, with Triage as the inbox above them. Q3 and Q4 say what each row then carries. More in
[discovery](discovery-01.md#organising-the-sidebar-by-concept).

Why it matters: it is the sidebar every later page redesign builds on, and it decides where you look
for what waits on you.

- **A (recommended). A "Needs you" group at the top, then sections in the flow's order: Inbox and
  Priorities with their counts, Drafts, Changes, Features, then Chats. An item that needs you shows
  only in "Needs you", with its kind's icon.**
  - [pro] your queue stays first; everything else reads in the flow's order.
  - [con] a longer sidebar, with one more section; an item moves between sections as its status
    changes.
  - Why recommended: it adds the hierarchy without losing the queue the sidebar is mostly for.
- **B. Sections in the flow's order only: Inbox, Priorities, Drafts, Changes, Features, Chats; what
  needs you sorts first in each section, and Home's row counts it.**
  - [pro] the hierarchy at its plainest; an item never changes section.
  - [con] what needs you is spread over several sections.
- **C. Today's groups by who waits, with Inbox, Priorities, and Drafts rows and their counts above
  them, and a kind icon on each item.**
  - [pro] the smallest change.
  - [con] the hierarchy shows only in icons.

**Answer:**

### Q2.A: How do drafts show?

Only if you picked A or B in Q2. There are 11 drafts today, files on the default branch with no list
page. Opening one goes to its editor.

- **A (recommended). A Drafts section listing each draft by its name, folded by default, its fold
  kept in the browser.**
  - [pro] every draft one tap away; folded, it costs one line.
  - [con] a long list once unfolded.
  - Why recommended: drafts are where most features start, and folding keeps them quiet.
- **B. A single Drafts row with its count, opening the priorities page, where drafts are linked.**
  - [pro] one line.
  - [con] no draft reachable from the sidebar directly.

**Answer:**

## Q3: Can an item move to its next state from the sidebar?

The proposal asks that "it should be easy to go from one state to another". Starting a draft as a
feature or a change, making a note a draft or a priority, all exist on their pages today. The "…"
menu of Q14 could hold them. The [flow review](/specs/drafts/flow-review.md) is planned to review
the transitions between pages later. More in
[discovery](discovery-01.md#moving-an-item-to-its-next-state).

Why it matters: moves in the sidebar make the hierarchy usable, not only visible, at the cost of a
menu on every row.

- **A (recommended). Each row's "…" menu holds the item's next moves, from the actions that exist
  today: a draft starts as a feature or a change, an inbox note becomes a draft or a priority.**
  - [pro] the flow you described, from anywhere, with no new workflow action.
  - [con] one more place for each action, and its feedback.
  - Why recommended: it reuses what exists, and the flow review can still move things later.
- **B. The sidebar shows the hierarchy only; moves stay on their pages until the flow review.**
  - [pro] a smaller feature.
  - [con] going from one state to another stays as many taps as today.

**Answer:**

## Q4: How does a feature's step show on its row before implementation?

You chose a sidebar "small and visual more than textual"
([session view Q2](/specs/done/2026-10-14-session-view.md#q2-how-does-the-current-task-show-in-the-sidebar)).
During implementation, a progress ring and "7/11" show under the feature; before it, nothing does.
The look and feel pass will refine icons later. More in
[discovery](discovery-01.md#showing-the-step-on-a-row).

Why it matters: it is what tells you, at a glance, where each feature stands.

- **A (recommended). An icon per step at the row's end: questions, spec, plan, implementation,
  review, pull request; the progress row stays during implementation, and the step's name is in the
  row's accessible name.**
  - [pro] one glance, no extra line.
  - [con] seven icons to learn, until the look and feel pass.
  - Why recommended: it is the most compact, and matches the visual sidebar you asked for.
- **B. A short word under the slug, like the progress row: "Questions 01", "Spec", "Plan".**
  - [pro] nothing to learn.
  - [con] one more line per feature.
- **C. A ring filled to the step's position in the workflow.**
  - [pro] compact, and shows how far along a feature is.
  - [con] users of ClickUp report that filled circles imply a straight line, which waiting and
    revision steps break.

**Answer:**

## Q5: What does hiding a sidebar do?

Today the left sidebar folds to a 48 px rail of icons and status dots, from a chevron at its bottom,
without animation. Most products hide a sidebar completely, with a button near its top and a
shortcut; GitLab and claude.ai also let the pointer at the window's edge peek at it. Resizing from
the edge already works, and the session's right column, which hides with "Hide progress", will
follow the same pattern. C can come on top of A or B. More in
[discovery](discovery-01.md#hiding-and-resizing-the-sidebars).

Why it matters: it decides whether a hidden sidebar still shows statuses, and how much room the page
gets back.

- **A (recommended). Hide it completely: a hide button at the sidebar's top, shown on hover and
  always on focus and touch, a show button at the page's top left when hidden, and a slide in and
  out. Dragging the edge below its minimum hides it too.**
  - [pro] the whole width for the page; one place to hide, one to show.
  - [con] no status in view while hidden: the notifications and the tab's title tell you instead.
  - Why recommended: it is what you described, and the rail's dots without slugs are hard to read.
- **B. Keep the rail as the folded state, with the button moved to the top and a slide.**
  - [pro] statuses stay in view.
  - [con] 48 px kept, and rows reduced to dots.
- **C. Peek: a hidden sidebar slides over the page while the pointer is at the window's left edge.**
  - [pro] a glance without unhiding.
  - [con] it can open by accident.

**Answer:**

## Q6: How do the last five done features show?

Today every done feature is listed at the end of the sidebar, and on Home. No product read hides a
list by the sidebar's height: they cap it, filter it, or archive it. The proposal does not say what
`...` opens. More in [discovery](discovery-01.md#done-features).

Why it matters: it decides whether done features are reachable from the sidebar on a small window.

- **A (recommended). Pinned at the sidebar's bottom, after a separator: up to the five latest,
  losing the oldest rows as the window gets shorter, and gone when none fits. "…" opens Home's Done
  group.**
  - [pro] exactly your description; the full list has a home already.
  - [con] on a short window, done features are only on Home.
  - Why recommended: it keeps the sidebar for work in flight, with the history one tap away.
- **B. Pinned at the bottom the same way, but "…" unfolds every done feature in place, and the
  section scrolls.**
  - [pro] the whole list without leaving the page.
  - [con] the section grows over the work in flight.
- **C. Five at the end of the list, not pinned, with "…", whatever the height.**
  - [pro] simplest, always there.
  - [con] not bottom-aligned, as you asked.

**Answer:**

## Q7: Where does the theme go until the settings page exists?

You asked to remove the theme switch from the sidebar, for the settings page. That page is still in
its first round, and its settled points keep the theme in the sidebar's footer, "a choice of the
device". Its Q5 also puts a Settings entry beside the theme. More in
[discovery](discovery-01.md#where-the-theme-goes).

Why it matters: whichever feature merges first decides where the theme sits in between.

- **A (recommended). The theme leaves the sidebar now, into the repository menu, beside Sign out;
  the settings page moves it into its own page when it merges.**
  - [pro] the sidebar is final now; the theme is never unreachable.
  - [con] it moves twice.
  - Why recommended: neither feature waits on the other.
- **B. This feature leaves the theme where it is, and the settings page removes it.**
  - [pro] one move.
  - [con] the sidebar's footer stays until the settings page merges.
- **C. The theme follows the system until the settings page exists, with no switch.**
  - [pro] nothing to move.
  - [con] no way to force light or dark in between.

**Answer:**

## Q8: Does a background command keep a run "Working"?

The server already waits for background sub-agents. A background shell, like a long review or a test
run, does not hold the run: when the agent's reply ends, the status turns "Needs you" or "New
reply", and turns back when the shell reports. The [agents](/specs/decisions/agents.md) decision
says so, and Claude Code does the same, because a dev server never ends. Claude Code stops
background shells of unattended sessions after 30 minutes by default, 2 hours at most. More in
[discovery](discovery-01.md#when-a-run-is-over).

Why it matters: this is the "waiting on you" while work goes on; option A or B changes the agents
decision.

- **A (recommended). Every background task holds the run "Working", shells included, until it ends
  or Claude Code's limit stops it; the row then says "Working, background command".**
  - [pro] never "Needs you" while anything runs.
  - [con] a server the agent starts in the background holds "Working" up to that limit.
  - Why recommended: workflow runs do not start servers, Uraeda starts Storybook itself, and a false
    "Working" costs less than a false "Needs you".
- **B. Shells hold the run in workflow runs only, not in chats, where you may ask for a server.**
  - [pro] chats stay free.
  - [con] two rules to explain.
- **C. As today, with a "background command running" mark next to "Needs you".**
  - [pro] no decision changes.
  - [con] the status still says "Needs you" while work goes on.

**Answer:**

## Q9: What does a button that writes to git show while it runs?

Commits take seconds, since the hooks format files. Today only the clicked button spins, after 310
ms; its neighbours, like "Commit only", stay clickable. The server already runs one write at a time,
so a second click waits rather than fails. Design systems keep page-wide blocking for critical
processes, and avoid grayed-out buttons that keyboard users cannot reach. More in
[discovery](discovery-01.md#feedback-for-git-writes).

Why it matters: it is the feedback on every commit, start, answer, and approval.

- **A (recommended). The clicked button spins at once with what it does ("Committing…"); every other
  button that writes, in the page and the sidebar, is blocked and dimmed until the write ends,
  staying focusable; reading and navigating stay usable; a thin bar runs at the top of the page.**
  - [pro] unmistakable, and you can still read and move around.
  - [con] a shared record of writes in flight, which every writing button joins.
  - Why recommended: it is your "extremely clear" feedback, without locking reading.
- **B. Every button of the page grayed out while the write runs, as written.**
  - [pro] the strongest signal.
  - [con] links and reading controls blocked for nothing, and keyboard focus lost on disabled
    buttons.
- **C. An overlay over the page while a commit runs.**
  - [pro] nothing can be clicked.
  - [con] the page cannot be read for several seconds.

**Answer:**

## Q10: How do optimistic statuses work?

You asked for the sidebar to change at once, since the server takes a few seconds to settle. The
core alone knows a feature's next step: a client that guesses "Agents at work" after you answer
would copy the workflow's table into TypeScript, which the [stack](/specs/decisions/stack.md)
decision forbids and the constitution's principle VI ("each rule MUST live in one place") rules out.
More in [discovery](discovery-01.md#optimistic-statuses).

Why it matters: option B needs your explicit exception to an active decision and to the
constitution.

C can come on top of A: the action at once, then the step from the write's answer.

- **A (recommended). The row shows the action at once ("Committing…", "Starting the agent…"), until
  the server's status arrives or 10 seconds pass; nothing guesses the next step.**
  - [pro] instant, and never wrong.
  - [con] the next step appears only once the server has it, a second or two after the commit.
  - Why recommended: it gives the instant feedback without a second copy of the workflow; "A, with C
    on top" shortens the wait for the step too.
- **B. The client guesses the next status from the action, and the server corrects it later.**
  - [pro] the final status at once.
  - [con] a copy of the workflow's rules in the browser, against the stack decision and the
    constitution; a wrong guess flickers.
- **C. Each write answers with the new step, computed by the core right after the commit.**
  - [pro] the right step as soon as the button stops; no guess.
  - [con] nothing changes while the commit's hooks run, and a run's start still waits for the agent.

**Answer:**

## Q11: What sends a notification?

Developer tools notify on approvals and finished turns, often only when their window is not in
front. Q12 and Q13 say how you allow them and where they reach you. More in
[discovery](discovery-01.md#notification-events).

Why it matters: too many notifications get turned off; too few miss the point.

- **A (recommended). Only what needs you: a step waiting on you once its run is over, an action the
  agent was refused, a run that failed or stopped early, and a pull request ready for review.**
  - [pro] each notification asks something of you.
  - [con] a chat's reply does not notify.
  - Why recommended: it matches "ping the user when input is needed".
- **B. The same, plus every finished reply in a chat.**
  - [pro] long chat answers reach you too.
  - [con] more notifications.
- **C. Every status change.**
  - [pro] nothing missed.
  - [con] noisy.

**Answer:**

## Q12: How does Uraeda ask for permission to notify?

You asked for the browser's question on the first visit. Firefox and Safari ignore it unless it
follows a click, Chrome shrinks it to an icon that disappears, and a "Block" cannot be asked again:
only the browser's settings undo it. Every guide read advises an explanation in the page first. More
in [discovery](discovery-01.md#asking-for-permission).

Why it matters: a refused permission is hard to get back.

- **A (recommended). On the first visit, a banner says what will notify you, with "Turn on", which
  asks the browser, and "Not now", remembered in the browser; the same switch later in the settings
  page.**
  - [pro] works in every browser; asked once, in context.
  - [con] one click more than asking at once.
  - Why recommended: it is the only form browsers honour.
- **B. Ask the browser on the first visit, as written.**
  - [pro] nothing to build.
  - [con] silently ignored in Firefox and Safari.
- **C. Only from the settings page.**
  - [pro] never in the way.
  - [con] easy to never find.

**Answer:**

## Q13: Where do notifications reach you?

An open tab can notify on desktop browsers. iPhones get no notifications from Safari tabs at all:
only a web app added to the Home Screen can, through Web Push, which needs a service worker, a
manifest, a server library, and keys; the server then sends outbound requests to Apple's or Google's
push service. ntfy's app is another way to reach a phone. More in
[discovery](discovery-01.md#notifications-on-the-phone-and-with-the-tab-closed).

Why it matters: Web Push is about as much work as the rest of the notifications together.

- **A (recommended). From an open tab, on desktop browsers, with the tab's title counting what waits
  on you ("(2) Uraeda"); Web Push for the phone and closed tabs comes as its own feature.**
  - [pro] small, and useful today on the desktop.
  - [con] nothing on the iPhone yet.
  - Why recommended: it delivers the notification you described, and the phone deserves its own
    round.
- **B. Web Push now: a closed tab and an iPhone Home Screen app are notified too.**
  - [pro] notified anywhere.
  - [con] a service worker, a new dependency, keys to keep, and a Home Screen install.
- **C. A push through ntfy, posted by the server, configured in the settings page.**
  - [pro] reaches the phone without Web Push.
  - [con] another app, and a new dependency on an outside service.

**Answer:**

## Q14: What do renaming and colouring a feature change?

The sidebar shows a feature's slug; its title comes from its proposal. The slug is in the branch,
the folder, the worktree, every address, the priorities' link, and the pull request's branch. A "…"
on the row, shown on hover and always on touch, opens a small dialog with the name and a colour from
a fixed palette. More in [discovery](discovery-01.md#renaming-and-colouring-a-feature).

Why it matters: a label outside git is cheap and safe; a real rename touches everything the slug
names.

- **A (recommended). A label and a colour kept by the server in its data folder, by repository and
  feature: the sidebar shows the label instead of the slug, its accessible name keeps the title; git
  is untouched.**
  - [pro] every device sees them; nothing to commit; reversible.
  - [con] not in git: another clone of the repository shows the slugs.
  - Why recommended: it is what you asked, without moving a branch under an open pull request.
- **B. The same, kept in the browser, like the sidebar's width.**
  - [pro] nothing on the server.
  - [con] your phone and your desktop disagree.
- **C. The rename changes the proposal's title, with a commit on the branch, and the sidebar shows
  titles; the colour is kept by the server.**
  - [pro] the name is in git, for everyone.
  - [con] the sidebar shows titles instead of slugs, against the UI layout decision's "a feature by
    its slug"; a commit per rename.
- **D. The rename changes the slug: branch, folder, worktree, addresses, and priorities link.**
  - [pro] one name everywhere.
  - [con] breaks open sessions, links, and the pull request's branch.

**Answer:**

## Q15: Do the addresses change?

The proposal's first paragraph lists "the URLs" among what it redesigns, but no item asks for a
change; your draft's "Better URLs, right now it's a bit messy" did not reach the proposal. Today a
feature's address is `/r/<repository>/f/<folder>/...`, and a change uses the same `/f/`. More in
[discovery](discovery-01.md#addresses).

Why it matters: addresses are in links you have shared, in records, and in the next page redesigns.

- **A (recommended). Today's addresses stay; only new views get new ones.**
  - [pro] no link breaks.
  - [con] a change still lives under `/f/`.
  - Why recommended: nothing in the proposal needs a new address.
- **B. Addresses follow the concepts, `/features/<folder>`, `/changes/<folder>`, `/drafts/<name>`,
  with redirects from the old ones.**
  - [pro] addresses read like the hierarchy.
  - [con] the router, near its size limit, is split and rewritten, and redirects kept.

**Answer:**

## Settled without the human

- **Only real workflow items show**: a branch counts as a feature or a change only with its folder
  or record at its latest commit, whether or not it is checked out in a worktree, and a dated folder
  on the main checkout's disk without a branch counts as nothing. That worktree exception is how
  `review-findings` showed, and it still lets in any dated branch. See
  [discovery](discovery-01.md#status-detection).
- **Steps come from commits**: each worktree's step is read from its checked-out commit, as you
  asked; uncommitted files stay a flag, "uncommitted changes". A file saved but not committed by an
  agent no longer reads as a gate. Same section.
- **The pull request is read on every status**: the core asks `gh` for the pull request of each
  branch past its last task, with its number and address, on each branch move and every minute,
  remembered in between. The row then reads "Final review" (agent), "Finishing, draft pull request"
  (agent), "Pull request ready" (you, with "#N" linking to it), or "Changes requested" (agent).
  "Pull request ready" means the pull request is open and out of draft. Without `gh`, the row says
  the pull request's state is unknown. Same section.
- **A process with background work is never closed** by the 15-minute idle timer. See
  [discovery](discovery-01.md#status-detection).
- **The right column resizes and hides like the left one**, with Astryx's `LayoutPanel` and
  `ResizeHandle`, 280 to 560 px, its width and state kept in the browser. See
  [discovery](discovery-01.md#hiding-and-resizing-the-sidebars).
- **Shortcuts**: `[` hides or shows the left sidebar and `]` the right column, like Linear, never
  while a text field has the focus, as the UI behaviour decision asks. See
  [discovery](discovery-01.md#linear).
- **The slide** lasts about 200 ms, moves rather than resizes, and is off under reduced motion. See
  [discovery](discovery-01.md#window-splitter-and-accessibility).
- **The phone's top bar starts with a home icon**, before the repository menu, on every page, marked
  as the current page on home. Apple and Android put navigation at the leading edge. See
  [discovery](discovery-01.md#mobile-navigation).
- **Adding a repository**: the suggestions become a list the keyboard drives; with a single
  suggestion, Enter fills the field with it, and the next Enter adds it. In the repository menu, a
  filter that leaves one repository opens it on Enter. See
  [discovery](discovery-01.md#important-reads).
- **Notifications** show only when the Uraeda tab is not in front, one per item, replaced rather
  than stacked, from one tab among several. They cover every repository the server has; a click
  opens the item in its repository. See [discovery](discovery-01.md#browser-notifications).
- **The "…" menu and the hide button** are always visible on touch and keyboard focus; hover only
  reveals them to a mouse, as the UI behaviour decision asks. See
  [discovery](discovery-01.md#needs-no-choice).
- **Icons** are Lucide outlines registered through the theme, like the app's existing ones; the look
  and feel pass refines them. The spec's mockups are Storybook stories of the shell, as the preview
  decision asks. See [discovery](discovery-01.md#astryx-068).
- **The proposal's link** to the look and feel pass points to a missing file in this folder; the
  draft is [`specs/drafts/look-and-feel.md`](/specs/drafts/look-and-feel.md). The proposal stays as
  you wrote it. See [discovery](discovery-01.md#a-broken-link).

**Notes:**
