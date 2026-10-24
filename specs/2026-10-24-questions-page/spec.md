---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Questions page in the terminal look

> [!NOTE]
>
> Approved on 2026-10-24.
>
> - You approve the round redrawn in titled panes with the question always in view. A right column
>   holds Outline, Notes, and Session tabs. "Check these" moves before the questions, in the page
>   and in the file format.
> - Your question on the jarring column: the column keeps one width for its three tabs, a third of
>   the window, so opening the session or switching tabs never moves the round.
> - One changed decision, UI layout: a feature's session may open beside its documents, at least 400
>   px wide.
> - The round's file format changes: "Check these" becomes its own section before Q1. The skill, the
>   template, the examples, the fixtures, `ura check`, and this feature's own round follow.
> - Your mobile note on options: an option is one border with its letter in it; on the phone, each
>   pro, con, and "why" is a small box with its sign in its border, with no indent.
> - Not verified: the session's transcript has not yet scrolled inside a column. The plan's first
>   task checks it; if it fails, the column links to the session's page instead.
> - Risk tier `medium`: a file format changes, and the session's scrolling moves.

The round of questions is where you spend most of your time. This feature redraws it in the terminal
look: panes that show what each part holds, the question in view while you answer, and the session
beside the round instead of on another page. See the [proposal](proposal.md), the
[discovery](discovery-01.md), and the [clarifications](clarifications-01.md).

## Decisions

- **Changed: [UI layout](../decisions/ui-layout.md)**. A feature's session may open beside any of
  the feature's documents, in the right column, at least 400 px wide.

Relied on:

| Decision                                       | What it means for this spec                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| [UI look](../decisions/ui-look.md)             | every part of the round is a titled pane, in the theme's colours                  |
| [UI coherence](../decisions/ui-coherence.md)   | the round-only parts are named in the plan; lists change for every document       |
| [UI behaviour](../decisions/ui-behaviour.md)   | typed comments and notes survive tab switches; every action works by keyboard     |
| [Stack](../decisions/stack.md)                 | the core finds a question's example and the round's verdict; the web never parses |
| [Compatibility](../decisions/compatibility.md) | the old round format is not read: every round on this branch is rewritten         |
| [Preview](../decisions/preview.md)             | the mockup is an HTML layout mockup; the plan's stories hold the real components  |

## User stories

### US1: A round that shows what each part holds (P1)

You open a round and see at once its verdict, its goal, and what to check, each in a titled pane.
Each question's example and "Why it matters" stand apart from its context. Options read as cards,
and the phone keeps the screen's width for text.

[The round, wide](mockups/questions.html?w=1440)

Key scenarios:

1. **Given** the merge-chats round, whose verdict reads "worth building, with changes", **When** it
   opens at 1440 px, **Then** its block is a pane titled "7 questions and 1 follow-up, about 20
   minutes.", with a "With changes" badge before the verdict's sentence.
2. **Given** the layout-look round's Q4, **When** it draws, **Then** its "Example:" line is a teal
   pane titled "Example", and its "Why it matters" a peach pane titled "Why it matters".
3. **Given** the merge-chats round at 390 px, **When** Q1's option A draws, **Then** its letter and
   "★ Recommended" sit in its border, and each of its pro, con, and why is a box with `+`, `−`, or
   `★` in its border, its text starting at the box's inner edge.

More scenarios:

1. **Given** a round, **When** it opens, **Then** its Goal, Scope, and Sources are panes with their
   icons, and Today is folded to its title; a tap on the title unfolds it, for the page's life.
2. **Given** a link to `#today` in the round, **When** it is followed, **Then** Today unfolds and
   the page lands on it.
3. **Given** a list in the block at 390 px, **When** it draws, **Then** its text starts at the
   paragraphs' left edge, its dash hanging in the page's margin. The same holds for every document.
4. **Given** Q2.A at 390 px, **When** it draws, **Then** it has no line on its side, and a mauve top
   border under "Q2.A · follows Q2, because you picked A".
5. **Given** option B is picked, **When** it draws, **Then** its border is mauve and twice as thick,
   its letter filled, and "picked" sits beside it.

### US2: The question in view, and the whole round in the outline (P1)

While you read a question's options, its number and text stay at the top of the screen, at every
width. The outline beside the round lists every part of it, and marks where you are.

[The question at the top, at 1205 px](mockups/questions.html?w=1205&round=layout-look)

Key scenarios:

1. **Given** the layout-look round at 1205 px, **When** you scroll to Q4's option C, **Then** "Q4"
   and "Where should the session open on the questions page?" stay at the top of the round.
2. **Given** you scroll past Q4's card, **When** Q5's card reaches the top, **Then** Q4's header
   leaves with its card, and Q5's takes its place.
3. **Given** the merge-chats round, **When** the Outline tab draws, **Then** it lists "Verdict and
   summary", Goal, Today, Scope, Sources, "Check these · 2", Q1 to Q7 with Q2.A under Q2, "Behaviour
   · 3", "Under the hood · 3", and "Notes and submit".

More scenarios:

1. **Given** the page scrolled to Q3, **When** you look at the outline, **Then** Q3's row is marked.
2. **Given** Q1 and Q2 answered, **When** you press `n` on Q1, **Then** the page goes to Q2.A.
3. **Given** the outline at 390 px, **When** you tap "0/8" in the status line, **Then** it opens as
   a sheet, and a tap on a row closes it and goes there.

### US3: The session beside the round (P1)

You ask the agent about a question, or a settled point, and read its answer in the right column, the
question still beside it. The round does not move.

[The session open, at 1205 px](mockups/questions.html?w=1205&tab=session)

Why this priority: it is what the proposal asks to change most, but the round reads well without it.

Key scenarios:

1. **Given** the merge-chats round at 1440 px, **When** it opens, **Then** the right column is 480
   px wide, with the tabs Outline, Notes, and Session, Outline open.
2. **Given** that round, **When** you click "Ask the agent" on Q2, **Then** the Session tab opens
   with "About Q2 of specs/2026-10-20-merge-chats/clarifications-01.md:" and "> Where does a new
   chat work?" in its composer, and the round's cards keep their place and width.
3. **Given** the merge-chats round at 390 px, **When** you tap "Ask the agent" on Q2, **Then** the
   session's page opens with that quote, and Back returns to Q2.

More scenarios:

1. **Given** "Check these" in the merge-chats round, **When** you click "Ask" on "The light flow
   stays.", **Then** the composer holds "About the settled point of
   specs/2026-10-20-merge-chats/clarifications-01.md:" and "> The light flow stays."
2. **Given** "why would that cost more?" typed after Q2's quote, **When** you ask about Q3, **Then**
   the quote becomes Q3's and the typed text stays.
3. **Given** the Session tab open, **When** you reload, **Then** it is still open.
4. **Given** the window at 1205 px, **When** the column shows, **Then** it is 402 px wide, and
   pushes the round, which is 751 px.
5. **Given** the column dragged to 560 px, **When** you open another round, **Then** it is 560 px.
6. **Given** the inbox triage, **When** it opens, **Then** the column has Outline and Notes, and no
   Session tab or "Ask" button.

### US4: "Check these" before the questions (P2)

The points the agent settled that you would want to object to come before the first question, in a
strong pane, in the page and in the file. Behaviour and Under the hood stay at the end.

[Check these](mockups/questions.html?w=1440)

Key scenarios:

1. **Given** the merge-chats round, **When** it opens, **Then** after Sources comes a peach pane
   titled "Check these · 2", with "The change's proposal" and "The light flow stays.", each with
   "Ask" and a comment button.
2. **Given** a round written from the new template, **When** `ura check` runs, **Then** it reports
   no problem; with `## Check these` after Q1, it reports `sections.order`.
3. **Given** a round with `### Check these` under "Settled without the human", **When** `ura check`
   runs, **Then** it reports the heading as `sections.unknown`.

More scenarios:

1. **Given** a comment "- **The light flow stays.**: Say so in the PR." in the notes, **When** the
   round draws, **Then** it shows under that point in "Check these".
2. **Given** a round without points to check, **When** it draws, **Then** no "Check these" pane or
   outline row shows.
3. **Given** the Under the hood pane, **When** it draws, **Then** it is folded to "3 choices in the
   code only".

### US5: A note from anywhere (P2)

You think of something while reading Q4 that belongs to no question. You write it in the Notes tab
without leaving Q4, and it is the same note as the round's end.

[Notes, at 1440 px](mockups/questions.html?w=1440&tab=notes)

Key scenarios:

1. **Given** the page on Q4 at 1440 px, **When** you open Notes and type "Check the spec page too.",
   **Then** the round stays on Q4, and the round's end shows the same text, marked unsaved.
2. **Given** that note unsaved, **When** you click Submit, **Then** it is saved with the answers.
3. **Given** the page on Q4 at 390 px, **When** you tap "Notes" in the status line, **Then** the
   notes open as a sheet, and closing it leaves the page on Q4.

## Architecture

The look reuses the shell's titled pane, and the round's parts become small components of the round.
The right column extends the session page's resizable column with tabs and one stored width. The
session's view is lifted out of its page so that it scrolls in a box. The format change moves "Check
these" in the core's parser and checks, the skill, and every round on the branch, with no old
reader, as the [compatibility](../decisions/compatibility.md) decision asks. See
[discovery](discovery-01.md#approaches).

- **The round's parts** draw the block with its verdict badge, the context panes with Today folded,
  "Check these", the example and "Why it matters" panes, and the settled panes. They own the round's
  look.
- **The question card** draws the sticky header, the context, and the options, each one bordered
  with its letter in its border, and the phone's boxed pros and cons. It owns how a question reads.
- **The round's column** holds the Outline, Notes, and Session tabs at one width: a third of the
  window, 400 to 600 px, dragged between 400 and 720 px, kept in the browser. The open tab is in the
  address. It owns where the session sits beside a document, for the spec page to reuse.
- **The outline** lists every part of the round and marks the one at the top; it leaves
  `RoundNav.tsx`, near its limit, for a file of its own. It owns `n` and `p`.
- **The session's view** is the transcript and composer, scrolling in their own box, used by the
  session's page and the column. It owns how a session follows its end.
- **Asking** quotes a question or a settled point into the session's composer: the column's tab on
  wide screens, the session's page on the phone. It owns the quote's form.
- **The round's notes** are one field, drawn in the Notes tab or the phone's sheet, and read at the
  round's end.
- **The documents' lists** hang their marker in the margin on the phone, for every document.
- **The core** reads `## Check these` as settled points to check, a question's "Example:" paragraph,
  and the block's verdict. `ura check` owns the round's section order.
- **The skill** writes "Check these" before the questions: the questions file's order in
  [discovery](/skills/uraeda/references/discovery.md) and
  [writing](/skills/uraeda/references/writing.md), the template, the two example rounds, and the
  fixtures.

Tradeoffs:

- The column always takes a third of the window, so the round is narrower than today: at 1440 px a
  card is about 700 px, and splits in two columns only once the column is folded.
- The sticky header takes two or three lines of the screen while its card is on it.
- Rounds in flight on other branches fail `ura check` after this merges, until they are rewritten.

## Edge cases

| Importance | Situation                                                                      | What happens                                                                       |
| ---------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| High       | A comment or a note is typed, then the tab switches or the width class changes | the text stays, marked unsaved, as fields do today                                 |
| High       | Text is typed in the session's composer, then you ask about another question   | the quote is replaced, the typed text kept                                         |
| High       | The session's transcript cannot follow its end inside the column               | the plan's first task finds it; the column then shows a link to the session's page |
| Normal     | The agent is running when you ask                                              | the composer behaves as on the session's page                                      |
| Normal     | A round whose agent is unavailable, or a default-branch round                  | no Session tab and no "Ask" buttons; Outline and Notes stay                        |
| Normal     | An answered round                                                              | the new look, read-only, without the column, as today                              |
| Normal     | A round on this branch in the old format                                       | `ura check` reports it; it is rewritten in the new format, its words kept          |
| Normal     | The column folded with `]`                                                     | the round takes the room; a card of 840 px or more splits in two columns           |
| Niche      | The window crosses 768 px with the Session tab open                            | the phone shows the round; the tab stays in the address for the way back           |
| Niche      | A question taller than the screen with its header stuck                        | the header stays; the card scrolls under it                                        |

## Success criteria

- **SC-001** (question in view): At 1440, 1205, and 390 px, a question's number and title are on
  screen at every scroll position inside its card.
- **SC-002** (no jump): Opening the session, switching tabs, or asking moves no card of the round by
  a pixel, in place or in width.
- **SC-003** (one click): From any question or point to check, the session opens with its quote in
  one click or tap.
- **SC-004** (phone width): At 390 px, a list's first-level text starts at the paragraphs' left
  edge, and an option's text inside its border starts at most 11 px from the screen's edge.
- **SC-005** (contrast): Every new pane's text reaches 4.5:1, and its border 3:1, in Mocha and
  Latte.
- **SC-006** (format): The template, the examples, the fixtures, and every round on this branch pass
  `ura check` with "Check these" before Q1.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there, with your notes: the outline holds the whole round, notes are written from anywhere,
and lists are tighter than proposed. The session on the phone stays its page, as you confirmed.

Settled while writing this spec:

- **The column's one width** answers your question on the jarring column. The column is there from
  the page's load, and its tabs never change its width, so nothing moves. See
  [the half screen](discovery-01.md#the-half-screen).
- **Notes from anywhere** are a Notes tab in the column, and a sheet from the status line on the
  phone, as the layout decision asks of forms there. The round's end shows the notes read-only, with
  "Edit notes".
- **Tighter lists** hang the marker in the page's margin, so the text loses no width at all. Nested
  lists indent by one character.
- **Your note on mobile options** reads as: one border per option, its letter and "★ Recommended" in
  it, the border's colour telling picked or recommended. On the phone, each pro, con, and "why" is
  its own box with its sign in its border. Wider screens keep the signs hanging beside the text.
- **A follow-up on the phone** loses its accent line on the side, for a mauve top border.
- **"Ask" on a settled point** quotes it as "About the settled point of <path>:" and the point's
  subject.
- **The Astryx 0.7.0 note**: "keeps Markdown transforms composable" is a fix for transform plugins
  next to `markdownSourceLinesPlugin`, in lists and quotes. Rounds and specs draw the core's
  document tree, not Astryx's Markdown, as the [stack](../decisions/stack.md) decision asks. Only
  session messages use it, without that plugin. Nothing changes.
- **Benchmark runs** under `benchmarks/runs/` keep the old format: they are records of past runs,
  like `specs/done/`.
- **The prototype** becomes this spec's mockup, narrowed to the design you picked; its other
  variants stay in git history.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: the round's file format changes for every reader and writer, and the session's scrolling
moves into a box.
