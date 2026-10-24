# Mockup: the questions page in the terminal look

The [spec](../spec.md)'s layout mockup, as the [preview decision](/specs/decisions/preview.md)
allows: a clickable HTML page of the design round 01 picked. [`questions.html`](questions.html)
loads its styles, script, data, and icons from [`questions/`](questions/). The round's throwaway
prototype, with every option of each question, is in git history, at the commit of round 01.

## What it draws

- **Two real rounds**, picked in the bar: the merge-chats round 01 in full, and the layout-look
  round 01's block, context, Q4 and Q5, and settled points. Q4 and Q5 hold the repository's only
  "Example:" lines. Their text is the rounds' own, from git history. Both are drawn in the new
  format, with "Check these" before the questions.
- **The shell** as shipped: the column on wide screens, the rail on half screens, the tabs on the
  phone, and the status line.
- **The session** is a made-up exchange in the shape of a real one. Sending a message adds a canned
  answer.

## How to look at it

The bar on top picks the round, the scheme, and the frame's width: 1440 (wide), 1205 (your half
screen), 960, or 390 (the phone). Everything under it is the page.

- The right column's tabs, Outline, Notes, and Session, keep one width; its left edge can be
  dragged.
- "Ask the agent" on a card, or "Ask" on a settled point, opens the Session tab with it quoted. On
  the phone it opens the session's page.
- The Today pane opens from its title. Under the hood opens from its summary.
- On the phone, the status line opens the outline and the notes as sheets.
- `n` and `p` jump between unanswered questions.

## What it is not

- Not built with Astryx, and not shipping code.
- It loads JetBrains Mono and Inter from Google Fonts; the app bundles them.
- Checked in Chromium only, at 1440, 1205, and 390 px, in Mocha and Latte.
