---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Spec and plan pages in the terminal look

> [!NOTE]
>
> Approved on 2026-10-24.
>
> - You approve the spec and plan pages in titled panes, with decision changes as a ledger, live
>   mockups in a "live" window, and a right column of Contents, Review, and Session.
> - The ledger changes how every page shows a decision's change, the decisions page included, since
>   one shared card draws them all.
> - A revision marks what changed since your review: the core compares the spec at the commit you
>   reviewed with the new one, word by word, as it does decisions.
> - HTML mockups draw live in the spec, in the same window as a story, instead of a link to their
>   page.
> - The plan page is the least work, as you asked: the file's order, each section a pane.
> - This feature builds on the questions page's column and merges after it.
> - Risk tier `medium`: the shared decision card and the review page change for every spec.

The spec is the workflow's main review. This feature redraws it, its plan, and its data model in the
terminal look: decision changes first and readable at a glance, live mockups that say they are
embeds, and your comments, the verdict, and the session beside the page. See the
[proposal](proposal.md), the [discovery](discovery-01.md), and the
[clarifications](clarifications-01.md).

## Decisions

No decision is created, changed, or removed.

Relied on:

| Decision                                     | What it means for this spec                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| [UI look](../decisions/ui-look.md)           | every part is a titled pane in the theme's colours                                   |
| [UI layout](../decisions/ui-layout.md)       | the session opens in the right column, beside the spec or the plan                   |
| [UI coherence](../decisions/ui-coherence.md) | one card draws a decision's change on every page; the column is the questions page's |
| [UI behaviour](../decisions/ui-behaviour.md) | typed comments survive tab switches; every action works by tap and keyboard          |
| [Stack](../decisions/stack.md)               | the core compares revisions and reads the data model; the web never parses           |
| [Preview](../decisions/preview.md)           | the mockup is an HTML layout mockup; the plan's stories hold the real components     |

## User stories

### US1: The spec in titled panes (P1)

You open a spec and read what you approve first, then each part in a titled pane with its icon: the
decisions right after the block, the stories, the data, and how it is built. The page keeps one
column, with the right column beside it, so it reads the same at 1440 and 1205 px; the phone drops
the column for sheets.

[The spec, wide](mockups/spec.html?doc=layout-look&w=1440)

[The spec, at 1205 px](mockups/spec.html?doc=layout-look&w=1205)

[The spec, on the phone](mockups/spec.html?doc=layout-look&w=390)

Key scenarios:

1. **Given** the recurring-tasks spec waiting for review, **When** it opens at 1440 px, **Then** its
   block is a pane titled "Spec to review, revision 2, about 10 minutes.", "You approve" first.
2. **Given** that spec, **When** it draws, **Then** "Decisions · 1 new, 1 changed, 1 removed" comes
   right after "Your review, answered", each decision a pane: green when new, mauve when changed,
   red when removed.
3. **Given** that spec at 390 px, **When** it draws, **Then** no column shows, and the status line
   holds "Contents", the comment count, and "Verdict".

More scenarios:

1. **Given** that spec, **When** its data model draws, **Then** "Data" comes after the stories, one
   pane per section, its "Change" column as badges.
2. **Given** the data model opened alone, **When** it draws, **Then** it shows the same panes.
3. **Given** an approved spec, **When** it opens, **Then** it draws the same panes, without the
   Review tab or the verdict.

### US2: Decision changes as a ledger (P1)

Each decision's change reads as a ledger: changed rules first, each with a sign, its changed words
marked inside, the rest folded with its count. You see what changes before anything else.

[The ledger](mockups/spec.html?doc=layout-look&w=1440#dec-1)

[The ledger, on the phone](mockups/spec.html?doc=layout-look&w=390#dec-1)

Key scenarios:

1. **Given** the task storage decision, changed, **When** it draws, **Then** "Data MUST be stored in
   IndexedDB" has a `~` sign and "only" underlined. "An upgrade that cannot read a saved value MUST
   clear it" has a `+` sign.
2. **Given** that decision, **When** it draws, **Then** "Components MUST NOT call IndexedDB" shows
   with a `−` sign, struck, and its Why, Alternatives, and Consequences fold under "Why,
   alternatives, consequences · 1 changed".
3. **Given** the repeating tasks decision, new, **When** it draws, **Then** each rule has a `+` sign
   and reads plain, without underlines.

More scenarios:

1. **Given** a decision whose rules all stay but one, **When** it draws, **Then** the others fold
   under "N rules unchanged", and a tap unfolds them.
2. **Given** the decisions page showing task storage's change on its branch, **When** it draws,
   **Then** it shows the same ledger.
3. **Given** a decision changed on the branch but not listed in the spec, **When** it draws,
   **Then** it shows its ledger with "Not listed in the spec", as today.

### US3: Live mockups in a live window (P1)

A story or an HTML mockup draws in a window with a double border, titled "live", with its name, its
size, and how much it is scaled. You know at once it is a live page, and whether its text is too
small to judge.

[Live windows](mockups/spec.html?doc=layout-look&w=1440#us-2)

[On the phone](mockups/spec.html?doc=layout-look&w=390#us-2)

Key scenarios:

1. **Given** the recurring-tasks spec's "Repeat menu, open" story at 1440 px, **When** it draws,
   **Then** its window is titled "live · Repeat menu, open · 1440 px", then its scale in percent.
2. **Given** US4's link to `mockups/title.html`, **When** it draws, **Then** the HTML page shows
   live in the same window, not as a link.
3. **Given** a window, **When** you press its full-screen button, **Then** the mockup shows at 100%.

More scenarios:

1. **Given** a phone story at 1440 px, **When** it draws, **Then** it shows at 402 px wide, 100%, on
   the window's hatched background.
2. **Given** a story at 390 px, **When** it draws, **Then** it is scaled to the screen's width, its
   title wrapping under its buttons.

### US4: Contents, Review, and Session beside the spec (P1)

Beside the spec, a column holds three tabs at one width: Contents, Review, and Session. You check
your comments and give the verdict from Review, and ask the agent about any block without leaving
it.

[The Review tab](mockups/spec.html?doc=layout-look&w=1440&tab=review)

[The Session tab](mockups/spec.html?doc=layout-look&w=1205&tab=session)

Key scenarios:

1. **Given** the recurring-tasks spec at 1440 px, **When** it opens, **Then** the column is 480 px
   wide, with Contents, Review, and Session, Contents open.
2. **Given** two comments, on a rule and a scenario, **When** you open Review, **Then** it lists
   both with their places, a tap jumps to each, and "Request changes" and "Approve" follow.
3. **Given** the task storage rule "Data MUST be stored in IndexedDB" selected, **When** you click
   "Ask the agent", **Then** the Session tab opens with "About specs/decisions/task-storage.md,
   lines 15–16:" and the rule quoted in its composer.

More scenarios:

1. **Given** the spec at 390 px, **When** you tap "Ask the agent" on a block, **Then** the session's
   page opens with the quote, and Back returns to the block.
2. **Given** a comment typed and unsaved, **When** you switch to Session and back, **Then** it is
   still there, marked unsaved.
3. **Given** the Review tab, **When** you approve from it, **Then** it commits as the page's end
   does, with the risk tier and plan review set there.

### US5: What changed since your review (P2)

On a revision, a "Since your review" pane at the top lists each part changed since the version you
reviewed. Each is marked Δ in the page and in Contents, its words marked as a decision's are.

[Revision 2](mockups/spec.html?doc=layout-look&w=1205&since=1#since)

Why this priority: a first review reads the whole spec; this helps the reviews after it.

Key scenarios:

1. **Given** revision 2 of the recurring-tasks spec, reviewed at revision 1, **When** it opens,
   **Then** "Since your review · 3 parts changed" lists US1's journey, US2's journey, and "Your
   review, answered".
2. **Given** US2's journey changed from "for 3 seconds" to "for 5 seconds", **When** it draws,
   **Then** it is marked Δ, "3" struck and "5" underlined.

More scenarios:

1. **Given** a first revision, with no review yet, **When** it opens, **Then** no "Since your
   review" pane or Δ shows.
2. **Given** a part removed since the review, **When** it draws, **Then** it shows struck in the
   pane's list, folded under "1 part removed".

### US6: The plan page (P3)

The plan reads in its file's order, each section a pane, each task a pane with its steps and a
`done/total` badge, whether it waits for review or runs. The session sits beside it, as on the spec.

[The plan](mockups/spec.html?doc=plan&w=1440)

[The plan, on the phone](mockups/spec.html?doc=plan&w=390)

Key scenarios:

1. **Given** the questions page's plan, auto-approved, **When** it opens, **Then** Goal,
   Architecture, Review focus, and each other section are panes, then "Task 1 · The session's view,
   scrolling in the round's column" with "5/5".
2. **Given** a plan waiting for review, **When** it opens, **Then** it draws the same page, with the
   Review tab and the verdict.

## Architecture

The look reuses the shell's titled pane, and the questions page's column of tabs, session, and
asking. The decision card becomes a ledger in place, so every page that draws a change follows. The
core gains one comparison, the spec at the reviewed commit against the new one, built on its
decision change. See [discovery](discovery-01.md#approaches).

- **The spec's parts** draw the block, "Your review, answered", decisions, stories, Data, and how it
  is built in titled panes. They own the spec's look; the spec's own `Panel` goes.
- **The decision ledger** draws a decision's change: signs, marked words, folds. It owns how a
  change reads, on every page, as the shared card does today.
- **The live window** frames a story or an HTML mockup: its title, its scale, its full screen. It
  owns how a mockup reads, in specs, rounds, and sessions.
- **The spec's column** puts Contents, Review, and Session in the questions page's column. Review
  lists the comments and holds the verdict's buttons, drawn by the same component as the page's end.
- **Asking** quotes any selection, a decision's lines included, into the session, as the questions
  page does.
- **The revision's change** is computed in the core: the spec's parts at the review's commit against
  today's, matched and diffed as decisions are. It owns what "changed since your review" means.
- **The data model's reading** moves to the core, which returns its sections and tables; the web
  stops parsing it.
- **The plan page** draws a plan's sections and tasks in panes, waiting or not, with the column. It
  replaces the review page and the generic page for plans.

Tradeoffs:

- An unchanged rule is one tap away, folded, on every page that shows a change.
- A desktop mockup in the spec's column draws at about half size; full screen shows it whole.
- Each HTML mockup now loads with the spec, lazily, as stories do.

## Edge cases

| Importance | Situation                                                                | What happens                                                                 |
| ---------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| High       | A comment is typed, then the tab switches or the width class changes     | the text stays, marked unsaved, as fields do today                           |
| High       | The reviewed commit is not in git anymore, after a rebase and a clean-up | no Δ marks; the pane reads "The version you reviewed is not in git anymore." |
| Normal     | The agent is unavailable, or the spec is on the default branch           | no Session tab and no "Ask the agent"; Contents and Review stay              |
| Normal     | An HTML mockup fails to load                                             | its window shows "This mockup could not be loaded." and a link to its page   |
| Normal     | A decision is removed by the spec                                        | its pane is red, every rule with a `−` sign, struck                          |
| Normal     | The column folded with `]`                                               | the spec takes the room; the live windows grow with it                       |
| Niche      | A spec with no decision listed or changed                                | "Decisions" shows the relied-on table only                                   |
| Niche      | A plan with no tasks yet                                                 | its sections draw, and no task pane                                          |

## Success criteria

- **SC-001** (not by colour): Every added, changed, or removed rule carries a sign, and every
  removed word a strike, in both schemes.
- **SC-002** (contrast): Every new pane's and window's text reaches 4.5:1, and its border 3:1, in
  Mocha and Latte.
- **SC-003** (revision): On the revision fixture, every part changed since the review is marked Δ,
  and no unchanged part is.
- **SC-004** (two taps): From any block, a comment or a question to the agent starts in two taps.
- **SC-005** (no jump): Switching the column's tabs moves no part of the spec by a pixel.
- **SC-006** (phone width): At 390 px, the ledger and the live windows fit the screen without
  scrolling sideways.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Your
note on the questions page changes one: this branch already builds on that branch's column, and
merges after it.

Settled while writing this spec:

- **The plan page in the file's order** follows your answer, "the least work": waves stay as
  written, and the core reads no new part of a plan. See
  [the plan page](discovery-01.md#the-plan-page).
- **Changes since your review** are for specs only: a plan is reviewed rarely, and its review stays
  as today.
- **The verdict in Review** has its two buttons only. The summary, the risk tier, and plan review
  stay at the page's end, where the Review tab sends you to set them.
- **Decision colours**: green for new, mauve for changed, red for removed, from the theme's roles.
- **The live window's colour** is the theme's sapphire, apart from the panes' lavender, and its
  border double where panes' are single, as tmux marks a pane.
- **The mockup** is the round's prototype narrowed to your picks; its other variants stay in git
  history.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: the decision card shared by every page and the review flow change for every spec, and
the core gains a comparison of revisions.
