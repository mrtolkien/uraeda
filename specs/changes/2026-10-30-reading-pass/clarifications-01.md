---
status: awaiting-human
---

# Clarifications, round 01: Reading and layout pass

> [!IMPORTANT]
>
> 2 questions, about 10 minutes.
>
> - Verdict: worth building as proposed: four of your five items are built, and the last waits on
>   where the home is centred.
> - The home's centring goes against your earlier words, "center of the whole screen". It changes
>   how every page sits, not only the home.
> - Full panes on the phone change the UI look decision, which keeps only a pane's titled top border
>   there. They are built, and the change waits for your approval.
> - Wide tables now grow past their pane into the room beside it, framed: check them in the sandbox.
> - Started as a feature, this was moved to a change, as your message asked: check the branch and
>   folder.

## Context

### Goal

The [proposal](proposal.md) asks for a reading and layout pass. On the phone: full panes with little
room around them, and slightly smaller text. Everywhere: a pane around a spec's replaced behaviour,
and a good way to show tables in reading panes. On a wide screen: the home's columns centred.

### Today

Four items are built on this branch, one commit each, and reviewed in the sandbox at a phone's and a
desktop's width, in both themes:

- **On the phone, a reading page's panes keep every border**, 2 px from the screen's edges and 3 px
  inside, your numbers. Their text starts about 6 px from the edge, near the page's own text at 7.8
  px. A question's Example is a pane of its own again.
- **Prose is 16 px on the phone**, rather than 19, as a chat app's messages.
- **A spec's replaced behaviour sits in a pane**, "Behaviours", under its heading, as Architecture
  sits under How it is built. It was the only part drawn bare, from the page's left edge.
- **A table wider than its pane grows past it** into the empty room beside it, with its own border,
  as a live window does. It scrolls only past that room. It was held to the pane, its last column
  cut off.

The fifth item, the home's centring, conflicts with the [wide screens' guide](/specs/ui/wide.md):
see the first question. The [UI look](/specs/decisions/ui-look.md) decision's change, for the full
panes, is the second.

### Scope

The five items of the proposal, on the web UI. The home's other parts, and the pages of rows, stay
as they are. On the phone, only reading pages change: a round, a spec, a plan, a document, the data
model, and a feature's record.

### Sources

- [`layout/useScreenCentre.ts`](/packages/web/src/layout/useScreenCentre.ts), which centres a page
  on the whole screen, and [`layout/Page.tsx`](/packages/web/src/layout/Page.tsx).
- [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx), and the guides
  [Reading](/specs/ui/reading.md), [The phone](/specs/ui/phone.md), and
  [Wide screens](/specs/ui/wide.md).
- The [inbox-again record](/specs/done/2026-10-30-inbox-again.md#gotchas), which left the home's
  centring to this pass.

## Check these

- **Wide tables** grow past their pane on semi-wide and wide screens, framed, as far as the room
  beside the pane allows. They scroll only past it, and on the phone inside their pane. A wider pane
  instead would end at another edge than the page's other panes, which the
  [UI layout](/specs/decisions/ui-layout.md) decision turned down.
- **The change's start** made a feature, `2026-10-30-reading-pass`, though your message continued a
  change. The folder moved to `specs/changes/`, and the branch became
  `change/2026-10-30-reading-pass`. Now links the new folder, in a commit on the default branch.
- **Two dead links** in the inbox-again record failed `ura check`: today's starts moved the
  proposals they linked. They link the new folders.

## Q1: Where should a page be centred on a wide screen?

Today every page, the home included, is centred on the whole screen when the room allows, not on the
room beside the sidebar. The [wide screens' guide](/specs/ui/wide.md#the-frame) quotes you: "They
should be center of _the whole screen_ when it's possible". It keeps a page still when the side
column opens at the right.

With the sidebar open and nothing at the right, as on the home, the page sits left of its room.
Measured in the sandbox at 2,400 px, the home's columns run from 498 to 1,902 px, centred at 1,200.
The room beside the sidebar runs from 335 to 2,400, centred at 1,367. The columns sit 167 px left of
that room's middle, as in your screenshot.

Why it matters: it decides how every page sits beside the sidebar, and whether a page moves when the
side column opens.

- **A (recommended). Centre every page on the room right of the sidebar, as if the side column were
  closed.**
  - [pro] the home, and every page, sit in the middle of the room you see beside the sidebar.
  - [pro] opening the side column still leaves the page where it is, while the room allows.
  - [con] a page is no longer in the middle of the whole screen: it moves right by half the
    sidebar's width.
  - Why recommended: it gives the home what you asked, and keeps what "the whole screen" was for.
- **B. Centre the home alone on the room right of the sidebar; other pages stay on the whole
  screen.**
  - [pro] only the home changes.
  - [con] going from the home to another page moves the content sideways.
- **C. Keep every page centred on the whole screen, as today.**
  - [pro] nothing changes.
  - [con] the home keeps looking off-centre beside the sidebar.

**Answer:**

## Q2: Should a pane keep its whole border on the phone?

The [UI look](/specs/decisions/ui-look.md) decision says: "On the phone, a pane MUST keep only its
titled top border, so its text has the screen's width." Your proposal asks for full panes on the
phone, with little room on each side. It is built that way. The decision is edited on this branch to
match, and stays proposed until you approve it:

- **The rule**: "On the phone, a pane MUST keep its whole border, with little room inside it and
  around it, so its text has nearly the screen's width."
- **The why**: a pane's whole border sets its text apart, and a few pixels of room keep the narrow
  lines wide.
- **The alternative considered**: only a pane's titled top border, the rule it replaces: a
  question's example ran into its context.

Why it matters: the decision binds every pane on the phone, in later features too.

- **A (recommended). Approve the change.**
  - [pro] the decision says what the app does, and what you asked.
  - [con] a phone line is 6 px narrower than with open panes, about one character less.
  - Why recommended: your proposal asks for it.
- **B. Keep the decision as it is, and revert the full panes.**
  - [pro] the most room for the text on a phone.
  - [con] a question's example runs into its context again.

**Answer:**

## Settled without the human

### Behaviour

- **The pane of the replaced behaviour** is titled "Behaviours", one pane for the whole list. A pane
  per behaviour would parse the items' bold leads.
- **Prose on the phone** is 16 px, as a chat app's messages; the UI font's sizes stay as they are.

### Under the hood

- **The full panes** reach past the page's 7.8 px inset to 2 px from the screen's edges. The page
  keeps its inset: otherwise its own text, as a question's heading and context, touches the edge.
- **No new test**: the testing decision tests the UI in the sandbox, at the `early` stage.

**Notes:**
