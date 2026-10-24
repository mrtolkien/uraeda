# Prototype: the questions page in the terminal look

A throwaway, clickable HTML prototype for [round 01](../clarifications-01.md), deleted when the spec
is approved. [`questions.html`](questions.html) loads its styles, script, data, and icons from
[`questions/`](questions/).

## What it draws

- **Two real rounds**, picked in the bar: the merge-chats round 01 in full, and the layout-look
  round 01's block, context, Q4 and Q5, and settled points. Q4 and Q5 are the only questions of this
  repository's rounds with an "Example:" line. Their text is the rounds' own, from git history.
- **The shell** as shipped: the column on wide screens, the rail on half screens, the tabs on the
  phone, and the status line.
- **The session** is a made-up exchange in the shape of a real one. Sending a message adds a canned
  answer.

## The bar

The bar on top is the prototype's, not the design's. Each choice stays in the address, so a link can
open one variant.

| Control     | Values                                                | Question |
| ----------- | ----------------------------------------------------- | -------- |
| Width       | auto, 1440, 1205 (your half screen), 960, 390 (phone) | all      |
| Session     | A tabs, B stacked, C bottom split                     | Q1       |
| Half screen | push the page, cover the page                         | Q1.A     |
| Look        | A panes, B sign column, C today                       | Q3       |
| Question    | A sticky header, B sticky left column, C today        | Q4       |
| Check these | A strong pane, B before the questions, C today        | Q5       |
| Phone lists | tight, today                                          | settled  |

"Ask the agent" on a card, the Session tab, or `s` opens the session; Escape or × closes it. The `s`
key is the prototype's only, not a proposal. `n` and `p` jump between unanswered questions. The
column's left edge can be dragged.

## What it is not

- Not built with Astryx, and not shipping code: the spec's mockups will be stories.
- It loads JetBrains Mono and Inter from Google Fonts; the app bundles them.
- Checked in Chromium only, at 1440, 1205, and 390 px, in Mocha and Latte.
