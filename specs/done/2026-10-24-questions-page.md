---
kind: feature
finished: 2026-10-25
pull-request: https://github.com/mrtolkien/uraeda/pull/56
superseded-by: [2026-10-30-panes-size]
---

# Record: Questions page in the terminal look

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-24, finished on
> 2026-10-25, in [its pull request](https://github.com/mrtolkien/uraeda/pull/56). Its full files are
> in git: `git log -- specs/2026-10-24-questions-page/`.
>
> Superseded in part by [2026-10-30-panes-size](2026-10-30-panes-size.md).

## What and why

The round of questions is the page the human spends most time on, and it was the old look inside the
new shell: a callout and plain headings for its opening, the question's title scrolling away while
its options were read, three equal headings for the settled points, and "Ask the agent" leaving the
round for the session's page. The human asked for the terminal look of
[layout and look](2026-10-20-layout-look.md) there: a distinct look for the round's opening, the
question always in view, "Example", "Why it matters", and "Check these" drawn with weight, the
navigation second, and the session beside the round in the right column, as tabs. They also asked
for lists that waste less width on the phone. Approving the spec, they asked for the layout
decision's **Why** to read as current reasons only.

## Behaviour

- **A round in titled panes (US1).** Every part of a round is a pane of the UI look.
  - The block is a pane titled by its first line, "7 questions and 1 follow-up, about 20 minutes.",
    holding the verdict's badge, "As proposed", "With changes", or "Not as proposed", before the
    verdict's sentence, which starts with a capital, then the block's other items. Its text holds to
    the round's measure.
  - Goal, Today, Scope, and Sources are panes with their icons, ids `goal`, `today`, `scope`,
    `sources`. Today is folded to its title until tapped or linked to by `#today`, then open for the
    page's life. Scope and Sources sit side by side when the round is at least `--size-round-pair`
    (820 px) wide. A triage's free context is one pane, "Context", id `context`.
  - A question's "Example:" paragraph is a teal pane titled "Example", before its context; its "Why
    it matters" a peach pane. The core gives both texts without their lead.
  - An option is one border with its letter, "★ Recommended", and, once picked, "picked" in it. A
    picked option's border is mauve and twice as thick, its letter filled, its text unmoved; its
    checkbox and name are unchanged. On the phone, its border runs at the screen's edges and its
    text sits 10.6 px from the edge; each pro, con, and why is a box with `+`, `−`, or `★` in its
    border. Wider screens keep the signs beside the text.
  - A follow-up on the phone has a 2 px mauve top border, no line on its side.
  - On the phone, the round's panes keep only their titled top border and take the background under
    them. A pane's long title wraps inside the pane, its first line on the border, and leaves a run
    of border after it. A folding pane's chevron comes before its title, and its button is a full
    touch target without moving the title off the border.
- **The question in view, and the whole round in the outline (US2).** A card's header, its id, "Ask
  the agent", and its title, sticks at the top at every width while its card is on screen, and
  leaves with it. The outline lists "Verdict and summary" (or "Summary" without a verdict), the
  context's parts, "Check these · N", every question with ✓ or ○ and its follow-ups under it,
  "Behaviour · N", "Under the hood · N", and "Notes and submit"; a row's name says "(answered)" or
  "(unanswered)" in words. The part at the top is marked. `n` and `p` jump between blank questions
  on wide screens whatever tab is open. The counts are the core's: only points starting in bold
  count, and a group without any draws no pane and no row. On the phone, the questions still list
  under the block, and the status line's "N/M" (named "N/M answered, outline") opens the outline as
  a sheet.
- **The session beside the round (US3).** On wide and semi-wide screens, a round waiting for answers
  has a right column of tabs: Outline, Notes, and, for a feature whose agent is available, Session.
  - The column is a third of the window, 400 to 600 px, until dragged, then 400 to 720 px, kept for
    every document under `uraeda.documentColumn`; its tabs never change its width, so opening the
    session, switching tabs, or asking moves no card. `]` folds it; asking, Edit notes, or an image
    dropped for the notes unfold it. The open tab is `?tab=` in the address.
  - "Ask the agent" on a question, or "Ask" (named `Ask about "<subject>"`) on a settled point,
    opens Session with "About Q2 of <path>:" or "About the settled point of <path>:" then ">
    <title or subject>" in the composer, and focuses it. Asking again replaces only the quote asking
    wrote; typed text stays. Asking while the agent works sends nothing.
  - The column's session scrolls in its own box: it opens at its end, follows it while the human is
    there, offers "Jump to the latest" once they scroll up, and "Show earlier messages" keeps the
    reader's place in the box. The round never scrolls for it, and Back restores the round's place.
    "Open the session's page" links to the session's page; the column's composer and the feature's
    session page share one draft for the document's life.
  - On the phone, asking opens the session's page with the quote, and Back returns to the question.
    `?tab=session` on the phone shows the round, the tab kept for the way back.
  - The triage, the decisions check, and a feature whose agent is unavailable have Outline and Notes
    only, without "Ask". An answered round has no column.
- **"Check these" before the questions (US4).** A round's points to check are `## Check these`, a
  list of bold-subject points after `## Context` and before Q1, drawn as a peach pane "Check these ·
  N" after Sources, with "Settled without you. Object here before answering, if one is wrong." Each
  point has its comment button and "Ask". Behaviour is a pane and Under the hood folded to "N
  choices in the code only", under "Settled without you" at the round's end.
- **A note from anywhere (US5).** The notes' field, "Anything else", is in the Notes tab, or a sheet
  from the status line's "Notes" on the phone; the round's end, a region "Notes" with id `notes`,
  shows them read-only, marked unsaved while unsaved, with "Edit notes" or "Write a note", and the
  restore notice with Discard when unsaved notes come back. Submit saves them with the answers,
  whatever tab is open. On the phone, `?tab=notes` and `?tab=outline` open the sheets, Back closes
  them, and a width change carries the Notes tab to the sheet and back.
- **The round's format.** `ura check` reports `## Check these` after a question (`sections.order`),
  a `### Check these` under the settled section or any heading under `## Check these`
  (`sections.unknown`), and a settled point without its bold subject (`settled.subject`).
  `## Settled without the human` holds `### Behaviour` and `### Under the hood` only, and is left
  out when both are empty. The old format has no reader.
- **Every document.** On the phone, a list's first-level text starts at the paragraphs' edge, its
  marker hanging in the margin on its first line: a dash, a typed sign, or its number, whole on the
  screen; a list of wider markers sets its text in by what the margin lacks, and an ordered list is
  a list with its numbers as text. Paragraphs draw in the reading font, as list items do. On the
  phone, a selected block's bar takes no room.

## Design

The core owns the format; the session's view owns how a transcript follows its end; the document's
column owns the tabs and the width, for the spec page to reuse; the round's parts own its look; the
round page holds the notes' field and the session's draft above the column, so they survive tab
switches and width changes.

- **The core**: [`items/round.rs`](/crates/core/src/files/items/round.rs) reads `## Check these` as
  the first settled group, each group's point count, the block's `RoundVerdict`, and a question's
  `example`, `exampleText`, and `whyText`, exported in
  [`items.rs`](/crates/core/src/files/items.rs). The checks are in
  [`check/sections.rs`](/crates/core/src/check/sections.rs) and
  [`check/writing.rs`](/crates/core/src/check/writing.rs); the format in the
  [template](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md),
  [writing](/skills/uraeda/references/writing.md), and
  [discovery](/skills/uraeda/references/discovery.md).
- **The session's view**: [`SessionView.tsx`](/packages/web/src/SessionView.tsx), lifted out of
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx), drawn boxed by
  [`ColumnSession.tsx`](/packages/web/src/ColumnSession.tsx); one rule for the window's place in
  [`following.ts`](/packages/web/src/following.ts) (`windowPlace`), the box's place in
  [`keepPlace.ts`](/packages/web/src/keepPlace.ts); the shared draft in
  [`useDraft.ts`](/packages/web/src/useDraft.ts), quotes by `withQuote` in
  [`sessions.ts`](/packages/web/src/sessions.ts).
- **The document's column**:
  [`layout/DocumentColumn.tsx`](/packages/web/src/layout/DocumentColumn.tsx) on
  [`layout/SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx), its width in
  [`documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts) over
  [`followedWidth.ts`](/packages/web/src/layout/followedWidth.ts), which the shell's column shares.
- **The round**: [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx) and
  [`RoundColumn.tsx`](/packages/web/src/RoundColumn.tsx) (tabs, sheets, asking);
  [`RoundParts.tsx`](/packages/web/src/RoundParts.tsx) (block, context, Check these);
  [`SettledGroups.tsx`](/packages/web/src/SettledGroups.tsx) and
  [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx);
  [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx),
  [`Question.tsx`](/packages/web/src/Question.tsx), and
  [`QuestionOption.tsx`](/packages/web/src/QuestionOption.tsx);
  [`RoundOutline.tsx`](/packages/web/src/RoundOutline.tsx) and
  [`roundJump.ts`](/packages/web/src/roundJump.ts);
  [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx); the part ids in
  [`roundPartIds.ts`](/packages/web/src/roundPartIds.ts).
- **Shared drawing**: [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx) gained `fold`, the
  `example` tone, and `isOpenOnPhone`; [`Blocks.tsx`](/packages/web/src/Blocks.tsx) hangs list
  markers on the phone and draws paragraphs through `Prose`'s reading styles;
  [`Selection.tsx`](/packages/web/src/Selection.tsx) draws a selection's bar as a shadow on the
  phone.
- **Tests and states**: the round's stories in
  [`RoundPage.stories.tsx`](/packages/web/src/RoundPage.stories.tsx) and
  [`QuestionCard.stories.tsx`](/packages/web/src/QuestionCard.stories.tsx), over
  [`fixtures/round-merge-chats/`](/fixtures/round-merge-chats/) and
  [`fixtures/round-layout-look/`](/fixtures/round-layout-look/); the screenshots' views in
  [`questions-page-shots.ts`](/packages/web/scripts/questions-page-shots.ts).

## Questions

### Round 01

#### Q1: Where should the session open beside the round?

**Answer:** A, tabs in the right column, but "it's very jarring right now how it makes the center
content jump AND the right size expands": the spec gave the column one width for its three tabs.

#### Q1.A: At half a screen, does the session's column push the round or cover it?

**Answer:** A, it pushes the round.

#### Q2: How should the layout decision change for a session beside a document?

**Answer:** A, a feature's session may open beside any of its documents, in the right column, at
least 400 px wide.

#### Q3: Which visual language should the round take?

**Answer:** A, titled panes, with Today folded by default: "I don't always need a recap of the
current state of things."

#### Q4: How should the question stay in view while you answer?

**Answer:** A, the card's header sticks at every width; on the phone, options were cramped, so "a
single border around the text", its colour and a top-left glyph conveying the letter or the sign.

#### Q5: How much weight should "Check these" get?

**Answer:** B, before the first question, and the file's order changed to match: "it makes more
sense to be at the top."

#### Q6: What can you ask the agent about from the round?

**Answer:** A, each question and each settled point.

#### Notes

- The outline shows the whole round, the intro and the settled points included.
- A note can be written from anywhere, apart from any question.
- Phone lists could be even tighter than proposed.
- The Astryx 0.7.0 note on composable Markdown transforms changes nothing: rounds and specs draw the
  core's tree.
- The session on the phone stays its own page, as settled.

## Decisions

- [UI layout](../decisions/ui-layout.md): a feature's session may open beside any of the feature's
  documents, in the right column, at least 400 px wide; its **Why** rewritten as current reasons.

## Changes after approval

- The column's width rule replaced the proposed widening Session tab, as the human's answer to Q1
  asked; asking, Edit notes, and an image for the notes unfold a folded column.
- The phone keeps its list of questions under the block, beside the outline's sheet.
- The notes' field is drawn only in the Notes tab or sheet; the round's end shows the notes
  read-only, with their restore notice.
- On the phone, a list of numbers or signs sets its text in by what the margin lacks, an ordered
  list's numbers are text, and a selected block's bar takes no room.
- Every document's paragraphs draw in the reading font, not only the round's; the spec page's own
  rows (scenarios, tradeoffs, edge cases) stay monospace until the spec page's feature.
- `ura check` gained `settled.subject`; the template's optional placeholders sit above its lists.
- The column's session composer and the feature's session page share one draft, with its workflow
  run: a hand-over's or an inserted message still starts the agent from either, and an address's
  message goes in once.

## Follow-ups

The deferred fixes added to the inbox: a fixed section repeated in place passes `ura check`; a
verdict phrase closed by "." or "—" leaves the mark; no drop hint shows for the notes with Outline
or Session open; a reopened round may ring its title in browsers ignoring `focusVisible`; Ask and
Edit notes may take the focus up to two seconds later; the session's draft differs between the
feature's session address and its ID's, a refused send puts its text back over the shared draft, and
kept drafts are never dropped.
