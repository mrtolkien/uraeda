---
status: answered
---

# Clarifications, round 01: Questions page in the terminal look

> [!NOTE]
>
> Answered on 2026-10-24.
>
> - Verdict: worth building as proposed: every part exists, and the work is the look, the right
>   column, and the session's scroll moved into it.
> - Open the [prototype](mockups/questions.html) before the questions. It draws two real rounds, and
>   its bar switches each question's options, at 1440, 1205, and 390 px.
> - Two answers last beyond this feature: where the session opens, and how the layout decision
>   changes to allow it. The spec and plan pages will reuse both.
> - Three questions work together: where the session opens, the half screen, and the layout
>   decision.
> - A gap in the proposal: what else than a question the session can be asked about.
> - Two settled points to check: tighter lists on the phone, and the session staying a page there.
> - Not verified: the prototype was checked in Chromium only, and the session's transcript has not
>   yet been run inside a column.

## Context

### Goal

The [proposal](proposal.md) asks for the round of questions, the page you spend most time on, in the
terminal look of [layout and look](/specs/done/2026-10-20-layout-look.md). The opening gets a look
that shows what each part holds, the question stays in view while you answer, and "Check these" gets
weight. The session takes the right column beside the navigation, like edgy.nvim, instead of a
cramped panel.

### Today

The page is the old look inside the new shell, measured in the sandbox:

- **The opening** is a callout with a bar, then Goal, Today, Scope, and Sources as plain headings
  ([`RoundOpening.tsx`](/packages/web/src/RoundOpening.tsx)).
- **A question** is a card, in two columns from 840 px. Its header sticks on the phone only, so on a
  desktop the question scrolls away while you read the options
  ([`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx)). "Why it matters" is a muted box, and
  an "Example:" line a plain paragraph.
- **The navigation** is a 240 px index beside the page, with the count, Next, and `n` and `p`
  ([`RoundNav.tsx`](/packages/web/src/RoundNav.tsx)).
- **"Ask the agent"** leaves the round for the session's page, with the question quoted in its
  composer; Back returns to the round at its place.
- **Settled points** are three equal headings with bullets.
- **On the phone**, a list's text starts 29 px right of a paragraph's, and 47 px inside the block,
  out of 352 px.

The [layout decision](/specs/decisions/ui-layout.md) says "a view the human follows SHOULD be a page
of its own". It was written after a session squeezed into a 320 px aside was too narrow to follow.

### Scope

The round's page at the three widths: its opening, its cards, its settled points, its navigation,
and the session beside it. The two rounds on the default branch, the inbox triage and the decisions
check, take the same look, without a session. The spec and plan pages are their own feature, which
reuses the session's place. What a round asks, and how answers save, stay as they are.

### Sources

- The page's code, linked above, and the sandbox at 1440, 1205, and 390 px.
- edgy.nvim, LazyVim, and aerial.nvim; VS Code's Secondary Side Bar, Zed's agent panel, and
  JetBrains' tool windows; GitHub alerts, Obsidian callouts, MkDocs Material.
- MDN and the HTML standard on sticky positioning and lists; WAI-ARIA's tabs and splitter patterns.
- The [prototype](mockups/questions.html), over the merge-chats round and two questions of the
  layout-look round, described in [its README](mockups/README.md).
- The full investigation is in [discovery](discovery-01.md). Each question links its topic.

## Check these

- **Lists on the phone** take a hanging indent of about one character, with a dash, instead of 29
  px. A line gains about 3 characters, and 5 inside the block. The prototype's "Phone lists" switch
  compares both. See [discovery](discovery-01.md#lists-on-the-phone).
- **The session on the phone** stays its own page, as the layout decision asks of views on narrow
  screens. It opens with the question quoted, and Back returns to the round at its place. See
  [discovery](discovery-01.md#needs-no-choice).

## Q1: Where should the session open beside the round?

Example: you are on "Where does a new chat work?" in the merge-chats round, at 1440 px. You ask the
agent why a worktree per chat costs that much, and read its answer while the question stays on
screen.

Editors that dock a chat beside a document put it in a resizable column opposite the navigation. It
can grow to a full tab. edgy.nvim, which you named, has no tabs: it stacks titled views on an edge,
each foldable to its title. Your "tabs beside the navigation" and "like edgy" are therefore two
shapes, both drawn. More in [discovery](discovery-01.md#where-the-session-opens).

The session's column takes about 38% of the window, 400 to 640 px, and can be dragged. At 1440 px
that is about 550 px, beside about 640 px of round. What happens at half a screen is the follow-up.

Why it matters: it is how you will talk to the agent from every document page. The spec and plan
pages will take the same shape.

- **A (recommended). The right column holds two tabs, Outline and Session. The column widens when
  Session is open, and Outline is one click away.**

  [Tabs](mockups/questions.html?session=tabs&open=1&tab=session&about=Q2)

  - [pro] the session gets the column's whole height, the most room for its answers.
  - [con] the outline and its Next hide while the session is open; the status line and `n` still
    work.
  - Why recommended: it is your "tabs beside the navigation", with the most room to read.

- **B. The right column stacks two titled views, like edgy: the outline folded to its title, with
  its count and Next, and the session under it. Clicking the outline's title unfolds it above the
  session.**

  [Stacked](mockups/questions.html?session=stack&open=1&about=Q2)

  - [pro] progress and Next stay in view with the session.
  - [con] two title bars take height from the transcript, and the outline unfolded squeezes it.

- **C. A split under the round and the outline, across the window, about 44% of its height.**

  [Bottom split](mockups/questions.html?session=split&open=1&about=Q2)

  - [pro] the round keeps its full width above.
  - [con] the session shows four or five lines of answer at a time.

- **D. The session's own page, as today.**
  - [pro] nothing to build, and the session has the whole screen.
  - [con] you leave the question to read the answer, which the proposal asks to avoid.

**Answer:** A: I like the tabs on the right BUT it's very jarring right now how it makes the center
content jump AND the right size expands. What do you suggest?

### Q1.A: At half a screen, does the session's column push the round or cover it?

Only if you picked tabs, A in Q1. At 1205 px, your half screen, the shell is a 52 px rail. A 460 px
session column beside the round leaves the round about 690 px: one column, options under the text,
about 60 characters a line. Covering keeps the round at about 900 px, under the session. More in
[discovery](discovery-01.md#the-half-screen).

Why it matters: it is the width you use most, so it decides how the round reads with the session
open.

- **A (recommended). The column pushes the round, as on wide screens.**

  [Push at 1205 px](mockups/questions.html?w=1205&semi=push&open=1&tab=session&about=Q2)

  - [pro] nothing is hidden: the sticky question and its options stay readable beside the answer.
  - [con] the round narrows to one column of options.
  - Why recommended: you read the question and the answer together, which covering prevents.

- **B. The session covers the round's right part, as the rail opens over the page.**

  [Cover at 1205 px](mockups/questions.html?w=1205&semi=cover&open=1&tab=session&about=Q2)

  - [pro] the round keeps its width, and closing the session shows it unchanged.
  - [con] the options' right part sits under the session while it is open.

**Answer:** A

## Q2: How should the layout decision change for a session beside a document?

The [layout decision](/specs/decisions/ui-layout.md) says "a view the human follows SHOULD be a page
of its own". It was written after a session in a 320 px aside was too narrow to follow; the column
in Q1 is 400 to 640 px. The [spec page draft](/specs/drafts/spec-page.md) wants "the session beside
the page as on the questions page", and the
[chat's right column draft](/specs/drafts/chat-right-column.md) wants it on every step. More in
[discovery](discovery-01.md#the-layout-decision).

With the session's own page (D in Q1), the decision needs no change: answer C.

Why it matters: the decision binds every later view. A narrow change makes each later page ask
again.

- **A (recommended). Add that a feature's session MAY open beside any of its documents, in the right
  column, at least 400 px wide. Everywhere else it stays a page of its own.**
  - [pro] the spec and plan pages reuse it without another round.
  - [con] the decision gets an eighth rule.
  - Why recommended: the spec page already asks for the same, and the width answers the rule's
    reason.
- **B. Add the same, for a round of questions only.**
  - [pro] the smallest change to the decision.
  - [con] the spec page's feature asks this question again.
- **C. No change: the session stays a page of its own.**
  - [pro] the decision stays as it is.
  - [con] only today's page is possible in Q1.

**Answer:** A

## Q3: Which visual language should the round take?

Example: the merge-chats round opens with its count and verdict, then Goal, Today, Scope, and
Sources. Its question cards hold an "Example:" line and a "Why it matters" paragraph.

Documentation sites tell kinds of text apart with a titled, coloured block and an icon: GitHub's
alerts, Obsidian's callouts, MkDocs' admonitions. The [UI look](/specs/decisions/ui-look.md)
decision groups content in bordered panes with their title in the border. The choice draws the
opening, "Example", and "Why it matters" alike. More in
[discovery](discovery-01.md#the-rounds-visual-language).

Why it matters: it is the agent's first feedback on every feature, and the look later documents
follow.

- **A (recommended). Titled panes. The block becomes a pane whose title is the count and time, with
  the verdict as a coloured badge. Each context part is a pane with its icon; Goal is the largest,
  Sources dashed and smaller. "Example" is a teal pane, and "Why it matters" a peach one. On the
  phone, panes keep only their titled top border, so text keeps the screen's width.**

  [Panes](mockups/questions.html?look=panes)

  - [pro] each part's kind shows at a glance, in the look the rest of the app has.
  - [con] the round gets its own parts, which the coherence decision asks the plan to justify.
  - Why recommended: it is the terminal look's own way to group content, and the clearest.

- **B. A sign column: a glyph per kind of paragraph in a gutter on the left, as Neovim marks lines.
  No boxes; headings in colour.**

  [Sign column](mockups/questions.html?look=gutter)

  - [pro] the lightest look, with the most width for text.
  - [con] the kinds are told apart by small glyphs only.

- **C. Today's callout and headings, in the new colours.**

  [Today](mockups/questions.html?look=plain)

  - [pro] nothing round-only: every document's callout stays the same.
  - [con] the opening stays as flat as today, which the proposal asks to change.

**Answer:** A: Btw the "Today" pane should be folded by default. I don't always need a recap of the
current state of things.

## Q4: How should the question stay in view while you answer?

Example: Q4 of the layout-look round has a four-line context, a "Why it matters", and four options.
On a desktop today, its title scrolls away before the third option.

A sticky element stays on screen until the end of its container, so a header sticky in its card
leaves with the card. More in [discovery](discovery-01.md#keeping-the-question-in-view).

Why it matters: you always want the question in sight, the proposal says, and the session in Q1
narrows the round.

- **A (recommended). The card's header, its number and question, sticks at the top while its card is
  on screen, at every width. The card is one column whenever the session is open.**

  [Sticky header](mockups/questions.html?sticky=bar&round=layout-look)

  - [pro] the question is always in view, the same way at every width.
  - [con] the header takes two or three lines of the screen.
  - Why recommended: it works at every width and with the session open.

- **B. On a wide card of two columns, the left column, the question and its context, sticks beside
  the options. Narrower cards fall back to A.**

  [Sticky left column](mockups/questions.html?sticky=split&round=layout-look)

  - [pro] the question and its context both stay in view.
  - [con] a context taller than the screen hides its end, and it never applies with the session
    open.

- **C. As today: the header sticks on the phone only.**
  - [pro] nothing changes.
  - [con] on a desktop the question scrolls away.

**Answer:** A: Btw on mobile the answers feel cramped and hard to read because there is:

- Left border before the card
- Then spacing before the bullet point/ABC letter

I feel like it would be better to have a single border around the text, and the border could convey
the info, through its color and a top-left glyph (the letter of the answer or a +/-/*)

## Q5: How much weight should "Check these" get?

"Check these" holds the points the agent settled without you that you would want to object to: a
scope cut, a choice beyond the proposal. Today the three groups of settled points are equal
headings, after the last question. More in [discovery](discovery-01.md#the-weight-of-check-these).

Why it matters: an objection there changes the spec, and a missed one is found at the review.

- **A (recommended). A strong peach pane, "Check these", after the last question, each point with
  its comment button. Behaviour is a plain pane, and Under the hood is folded.**

  [Strong pane](mockups/questions.html?check=pane)

  - [pro] it stands out, and the page keeps the file's order.
  - [con] it is still read last, after the questions.
  - Why recommended: it gives the weight you asked for, without reordering the round.

- **B. The same pane before the first question, after the context; the other groups stay at the
  end.**

  [Before the questions](mockups/questions.html?check=first)

  - [pro] you check the points before answering anything.
  - [con] the page's order differs from the file's.

- **C. As today: three equal headings.**
  - [pro] nothing changes.
  - [con] "Check these" weighs no more than "Under the hood".

**Answer:** B: Change the file's order in the template and examples to fit the new order we show it
in.

You are right it makes more sense to be at the top.

## Q6: What can you ask the agent about from the round?

Example: you doubt the settled point "The light flow stays." in the merge-chats round, and want to
ask why before objecting.

Today only a question has "Ask the agent". The spec page already asks about any selected lines. Zed
adds a selection to its chat, and VS Code attaches context explicitly. More in
[discovery](discovery-01.md#what-the-session-can-be-asked-about).

Why it matters: it sets what the session's quote can hold, and how many buttons the page shows.

- **A (recommended). Each question, and each settled point, has a button that opens the session with
  it quoted.**
  - [pro] the two things you decide on can be asked about in one click.
  - [con] one more button on each settled point.
  - Why recommended: settled points are where objections start.
- **B. Each question only, as today.**
  - [pro] nothing new.
  - [con] a settled point is quoted by hand.
- **C. Any selection of the round, as on the spec page.**
  - [pro] any sentence of the context can be asked about.
  - [con] selecting on a page of tappable options is fiddly, the phone most of all.

**Answer:** A

## Settled without the human

### Behaviour

- **The outline** moves into the right column as a pane. It holds the count, Next or Submit,
  Context, every question with ✓ or ○, the settled points, and the notes. The question at the top is
  marked, and `n` and `p` work as today. See [discovery](discovery-01.md#important-reads).
- **The column's width** is kept in the browser, apart from the session page's column. `]` folds it,
  as on the session's page. See [discovery](discovery-01.md#important-reads).
- **The open tab is in the address**, so a reload or Back keeps the session open, as the layout
  decision asks. See [discovery](discovery-01.md#needs-no-choice).
- **Asking about another question** while the session is open adds its quote to the composer, and
  keeps what you typed. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The session's column** links to the session's page, for the whole screen. See
  [discovery](discovery-01.md#needs-no-choice).
- **The inbox triage, the decisions check, and a feature whose agent is unavailable** show the
  outline alone, with no session. See [discovery](discovery-01.md#needs-no-choice).
- **An answered round** keeps the new look, read-only, without the outline, as today. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Keys** stay those of today, plus `]`: keyboard navigation is its own item in the priorities. See
  [discovery](discovery-01.md#rules-and-their-owners).

### Under the hood

- **The session's transcript** scrolls its own box in the column: `following.ts` already supports a
  box, and the two files that scroll the window change. See
  [discovery](discovery-01.md#important-reads).
- **The outline** leaves `RoundNav.tsx`, near the file limit, for a file of its own. See
  [discovery](discovery-01.md#important-reads).
- **Round-only parts**, such as the verdict badge and the "Example" block, are listed in the plan,
  as the coherence decision asks. See [discovery](discovery-01.md#rules-and-their-owners).
- **The prototype** is deleted when the spec is approved, as the
  [preview decision](/specs/decisions/preview.md) says.

**Notes:** Btw:

- Outline should show the intro and "settled without you", the whole content, ofc
- We should be able to comment from anywhere: sometimes looking at a question I want to write a note
  that's not directly linked to the question, it should be easy.
- "Tight" for phone lists is better, but we could be even more tight imo
- The Astryx 0.7.0 release says it "keeps Markdown transforms composable" -> do we use that? What
  does it mean? Should we change how we render markdown?

- **The session on the phone**: Good
