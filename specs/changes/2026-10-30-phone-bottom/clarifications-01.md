---
status: answered
---

# Clarifications, round 01: Phone bottom bars on more pages

> [!NOTE]
>
> Answered on 2026-10-30.
>
> - Verdict: worth building as proposed: every page named has a clear bar. The bar's code already
>   draws tiles and sheets; only the one- and two-entry shapes are new.
> - The feature page: whether its sessions get a tile, and whether Next's button leaves its pane for
>   the bar.
> - The commit page: Discard on the glass, beside Commit, is a destructive action in thumb's reach,
>   though it still asks first.
> - Your one- and two-entry shapes also change two bars of today: the constitution's reader becomes
>   one button, and a plan with no review two.

## Context

### Goal

The [proposal](proposal.md) brings the phone's bottom bar, where the thumb is, to more pages: the
feature page, and the pages with one main action. A bar of one entry is a single glass button at the
bottom right. Two entries are a button in each corner, and three or more the full bar.

### Today

The pages with a side column, a round, a spec, a plan, and a session, draw the bar through
[`ColumnStatusLine`](/packages/web/src/layout/ColumnStatusLine.tsx). The decisions' reader draws it
through [`TopBarSlot`](/packages/web/src/layout/TopBarSlot.tsx) alone. Both put tiles
([`NavTile`](/packages/web/src/layout/NavBar.tsx)) into the
[status line](/packages/web/src/shell/StatusLine.tsx), which on the phone is the glass bar, sliding
away as the page scrolls down. It always takes the screen's whole width, whatever its count.

The pages the proposal names:

- **The feature page** ([`FeaturePage`](/packages/web/src/feature/FeaturePage.tsx)): Next, a pane
  with its one button, at the top. Then come Sessions and the Timeline. On the phone only, the wide
  column's Produced and Links panes follow the timeline
  ([`FeatureColumn`](/packages/web/src/feature/FeatureColumn.tsx)).
- **The draft editor** ([`EditorPage`](/packages/web/src/EditorPage.tsx)): on the phone, the
  [Start pane](/packages/web/src/ProposalStart.tsx), with the kind, the slug, and Start, comes after
  the whole proposal's text.
- **The inbox and the priorities** ([`InboxPage`](/packages/web/src/InboxPage.tsx),
  [`PrioritiesPage`](/packages/web/src/PrioritiesPage.tsx)): their add forms open from the
  sidebar's ＋ ([`SidebarAdd`](/packages/web/src/SidebarAdd.tsx)), behind the sidebar's toggle on
  the phone, or from the New tab's page.
- **The commit page** ([`CommitPage`](/packages/web/src/CommitPage.tsx)): Commit and Discard come
  after the list of changes, off screen once it holds about 15.

The mockups draw every option at a 360 px phone's width: [bottom bars](mockups/bottom-bars.html).

### Scope

The four pages above, and the bar's one- and two-entry shapes on every page. Home, the sessions
page, the New page, and the decisions' list keep no bar: the proposal does not name them.

### Sources

- The guides of [the phone](/specs/ui/phone.md#the-bottom-bar),
  [surfaces](/specs/ui/surfaces.md#the-bottom-bar-on-the-phone), and
  [look and feel](/specs/ui/look-and-feel.md#glass), for what goes in the bar, the glass, and "no
  second copy".
- The [UI look](/specs/decisions/ui-look.md) decision: what floats over the page is glass, square.
- The code linked above, and the [round's](/packages/web/src/RoundColumn.tsx) and
  [spec's](/packages/web/src/spec/SpecColumn.tsx) bars, as the model of the new ones.

## Check these

- **The constitution's reader** has one tile today, its list: it becomes a single button at the
  bottom right. **A plan with no review and no session** has one, Contents, and becomes one button
  too; with its Session, two buttons, one in each corner. Your notes say so for any bar.

## Q1: What goes in the feature page's bar?

On the phone, the feature page draws its wide column, Produced and Links, as panes after the
timeline, a long scroll from the top. Its next step is a pane at the top, with its button. The
proposal suggests tiles for both panes, beside the feature's Session and its next step.

The Session tile opens the feature's latest session, as the Sessions pane's first row does. Next's
tile does what the pane's button does, as `n` does on a wide screen. It shows only while the step
has an action: a done feature's bar ends at Session. The phone's guide keeps out of the bar what the
page already shows in reach. So the pane's button leaves the pane, which keeps its title and its
line.

Why it matters: it decides what the feature page's body still holds on the phone, and whether its
step's button keeps a written label.

[Bottom bars, the feature page](mockups/bottom-bars.html#feature)

- **A (recommended). Produced, Links, Session, then Next in the accent; Produced and Links leave the
  body, and Next's button leaves its pane.**
  - [pro] the column's panes and the step are one thumb away from anywhere on the page, as on a
    round.
  - [con] the step's button loses its words ("Answer the questions"): the pane above says them.
  - Why recommended: it is the proposal's list, and the round's bar already works this way.
- **B. Produced, Links, then Next; the sessions stay in their pane only.**
  - [pro] one tile fewer, and no second way into a session.
  - [con] the feature's session stays a scroll away, unlike a round's or a spec's.
- **C. No bar, as today.**
  - [pro] nothing changes.
  - [con] the column's panes stay at the page's end.

**Answer:** A: Keep the big inline step button too. I know it's duplication, but it's clearer imo

## Q2: What does the draft editor's Start do?

The Start pane comes after the whole proposal's text on the phone. Starting needs the kind and the
slug in view, which is why no key starts a proposal without the slug field focused.

Why it matters: it decides whether the Start pane stays in the editor's body on the phone.

[Bottom bars, the draft editor](mockups/bottom-bars.html#editor)

- **A (recommended). A single Start button, which opens the Start pane as a sheet; the pane leaves
  the body.**
  - [pro] the kind, the slug, and Start, together, from anywhere in the text, as a round's Notes
    open.
  - [con] one more tap to start, and the sheet hides the text while it is open.
  - Why recommended: it treats Start as the page's companion, which the phone's sheets are for.
- **B. A single Start button, which scrolls to the Start pane at the body's end and focuses its
  slug.**
  - [pro] the body stays as it is.
  - [con] the jump passes the whole text, and the button stays drawn over the pane it jumped to.

**Answer:** A

## Q3: Do the inbox and the priorities get an Add button?

Adding a note or a proposal on the phone goes through the sidebar's ＋, or the New tab. A single Add
button, in the accent, would open the same form as the sidebar's ＋, as a sheet. The inbox also has
"Organize with AI", on its title's line, which could take the bar's other corner.

Why it matters: it decides the inbox's and the priorities' bottom corners. The selected row's
actions also float there, and cover the button while they show.

[Bottom bars, the inbox and the priorities](mockups/bottom-bars.html#lists)

- **A (recommended). Add alone, on both pages.**
  - [pro] the main action of both lists in thumb's reach, nothing else.
  - [con] a second way to the same form, beside the sidebar's ＋.
  - Why recommended: Organize is occasional, and its banner already leads to the triage.
- **B. Add, and on the inbox Organize with AI in the other corner, which leaves the title's line.**
  - [pro] both inbox actions in reach.
  - [con] a less used action takes a corner.
- **C. No button.**
  - [pro] nothing changes.
  - [con] adding stays behind the sidebar's toggle or the New tab.

**Answer:** A

## Q4: What goes in the commit page's bar?

Commit and Discard come after the list of changes. Discard asks for a confirmation before it
discards anything.

Why it matters: Discard on the glass puts a destructive action at the thumb, behind its question.
Keeping it out leaves two copies of Commit.

[Bottom bars, the commit page](mockups/bottom-bars.html#commit)

- **A (recommended). Discard in the left corner, Commit in the accent in the right one; the body's
  buttons leave it.**
  - [pro] no second copy, and both actions in reach whatever the list's length.
  - [con] Discard is a tap away, stopped only by its question.
  - Why recommended: the guides keep no second copy, and the question already guards Discard.
- **B. Commit alone; Commit and Discard also stay at the list's end.**
  - [pro] Discard stays out of the thumb's way.
  - [con] Commit is drawn twice when the list is short.
- **C. No bar, as today.**
  - [pro] nothing changes.
  - [con] Commit stays under a long list.

**Answer:** A: Not a fan of your "commit" icon though, it's not very clear. A save icon would work
better.

## Settled without the human

### Behaviour

- **The single and the two buttons** slide away as the page scrolls down and come back as it scrolls
  up, as the full bar does. The selected row's actions cover them, as they cover the bar.
- **A note file** in the draft editor has no Start, so no bar; nor does a started proposal's page.
- **The commit page's bar** shows only while changes wait, as its buttons do today.
- **The look of the single and the two buttons**: square floating glass, with its rim and shadow, as
  tall as the bar. They sit in the screen's corners with a small inset. The guides allow no rounded
  corner, and no filled block on glass.

### Under the hood

- **The shapes** are drawn by the status line from the count of its tiles. Every page's bar, today's
  and the new ones, follows them alike.

**Notes:**

- **The single and the two buttons**: Also the buttons need to appear if we scroll to the bottom of
  the page, with the full content properly visible above the bottom bar.
