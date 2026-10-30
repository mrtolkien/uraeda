---
kind: change
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/71
---

# Record: Review the inbox and fix all small issues that can be fixed without extra feedback

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/71). Its full files are
> in git: `git log -- specs/changes/2026-10-30-review-inbox/`.

## What and why

The human asked for a pass over the inbox, fixing every small note that needed no more feedback from
them. Nine notes were fixed, each in its own commit, and left the inbox; five stay there, each
needing the human's call or a look at the running app on their machine.

## Behaviour

- **The inbox reads a wrapped marked note**: a note's `[agent]` and `[<slug>]` marks may end its
  first line when its text goes on under it, as a formatter wraps a long link there. The note keeps
  its marks and its note file, and `ura check` stops warning that no note links that file. A note
  that is a mark alone, `- [todo]`, stays text.
- **A started proposal's links still resolve**: starting a feature or a change rebases the relative
  links of its proposal, and of a postponed folder's files, to point at the same files from the
  dated folder, as expand already did. The words stay the human's; rooted links stay as written.
- **The priorities' `e` expands** a proposal into a file, in place of `p`; the inbox's `p` still
  promotes a note.
- **A round's Scope and Sources stack** one under the other, at the width of its other context
  parts, rather than side by side.
- **A session's recap line holds one line** on wide and semi-wide screens, cut with an ellipsis, so
  a single long command, a heredoc above all, no longer fills a dozen lines of the chat; on the
  phone it takes up to three lines, as a list's row.
- **A comment on a part of a spec holds Approve back** in the web UI, with "Approve: A comment on a
  part of the spec asks for changes" under the buttons. A general comment does not, and a plan is
  still approved with its comments. `ura review` and the core still accept a spec approved with any
  comments.
- **A spec's decision cards are a quarter wider** than a pane of prose, their text a column at the
  reading measure; a decision's intent is prose in the reading font and size, everywhere, no longer
  the UI's monospace font at a heading's size.
- **A question's header is frosted glass once stuck** over its card's text, its rim on its bottom
  edge, at every width; unstuck, it keeps its card's colour.
- **The editor gives a formatted file room**: on a wide screen its pane holds 100 columns of the
  UI's monospace font, so a file formatted at that width keeps its lines, while a paragraph typed
  without breaks still wraps. The page widens for Start beside it where the screen has the room;
  elsewhere Start goes under it.
- **A sheet shorter than the screen stays above the phone's keyboard**: the new-note sheet, and
  every sheet that is not tall, lifts by what the keyboard covers, never so far that its top leaves
  the screen. Checked in Chromium with the viewport stubbed, not on an iPhone.

## Design

Root causes and approaches, by item:

- **Wrapped marks**: a mark had to be followed by a space and text on its line, so
  `- [decisions-needs]` with the link on the next line lost its marks and its link.
  [`marks`](/crates/core/src/files/inbox.rs) takes whether the note's text continues, from every
  caller.
- **Start links**: the start moved the proposal with a plain rename. The move now runs
  [`retarget::relocated`](/crates/core/src/files/retarget.rs) on each moved markdown file, in
  [`move_proposal`](/crates/core/src/actions/start/commits.rs). The
  [projects reference](/skills/uraeda/references/projects.md) says the start changes links only.
- **`e` to expand**: [`useRowKeys`](/packages/web/src/lists/useRowKeys.ts).
- **Scope and Sources**: [`RoundContext`](/packages/web/src/RoundParts.tsx) lost its pairing and
  `--size-round-pair`.
- **Recap line**: [`RecapLine`](/packages/web/src/session/RecapLine.tsx)'s words clamp, by width
  class.
- **Approve held back**: [`ReviewVerdict`](/packages/web/src/ReviewVerdict.tsx) takes the count of
  comments that are not general, from [`YourReview`](/packages/web/src/YourReview.tsx); a comment on
  a decision counts as targeted.
- **Decision cards**: [`DecisionCard`](/packages/web/src/spec/DecisionCard.tsx)'s `wide`, set by the
  spec's [`DecisionCards`](/packages/web/src/spec/DecisionCards.tsx), and the intent's style in
  [`RuleLine`](/packages/web/src/spec/RuleLine.tsx).
- **Stuck header**: [`useStuck`](/packages/web/src/layout/useStuck.ts) compares the header's top
  with an empty box left where it would be unstuck, once a frame on any scroll; the header is
  [`QuestionCard`](/packages/web/src/QuestionCard.tsx)'s `StickyHead`, with the glass of
  [`glass.ts`](/packages/web/src/layout/glass.ts)'s new `dockedTop`.
- **Editor**: `--pane-code` is 108ch in [`pane.stylex.ts`](/packages/web/src/layout/pane.stylex.ts),
  [`Page`](/packages/web/src/layout/Page.tsx)'s writing page widens, and
  [`EditorPage`](/packages/web/src/EditorPage.tsx) lays its panes out with a wrapping flex row.
- **Keyboard**: the sheet focuses its field without scrolling, and a sheet that hugs its content is
  fixed to the layout viewport, which iOS does not shrink for the keyboard; Astryx follows the
  keyboard for tall sheets alone. [`Sheet`](/packages/web/src/layout/Sheet.tsx) lifts by `liftOf`,
  from [`useKeyboardInset`](/packages/web/src/layout/useKeyboardInset.ts), moved out of the row bar.

The guides say each UI change: [keyboard](/specs/ui/keyboard.md), [wide](/specs/ui/wide.md),
[semi-wide](/specs/ui/semi-wide.md), [flows](/specs/ui/flows.md),
[look and feel](/specs/ui/look-and-feel.md), and [reading](/specs/ui/reading.md). The
[inbox reference](/skills/uraeda/references/inbox.md) says marks may end the first line.

## Gotchas

- **The editor wraps softly**: turning wrapping off kept formatted lines but made a paragraph typed
  without breaks one line scrolling sideways; room for 100 columns does the first without the second
  ([`EditorPage`](/packages/web/src/EditorPage.tsx)).
- **A lifted sheet keeps its top**: lifting by the whole keyboard pushed a capped comment sheet's
  title and Close off an iPhone's screen ([`liftOf`](/packages/web/src/layout/Sheet.tsx)).
- **Astryx marks a held-back button `aria-disabled`**, still focusable, not `disabled`: tests read
  that attribute (`review.test.tsx`).

## Changes after approval

- The editor first turned soft wrapping off on a wide screen; the review found it broke unformatted
  paragraphs, and wrapping came back with the wider pane.
- The keyboard's lift first moved a sheet by the whole keyboard; it now stops where the sheet's top
  would leave the screen, and moves with a transition.

## Follow-ups

- Left in the inbox, needing the human: the home columns, which the wide guide centres on the whole
  screen as the human asked; the performance-pass mockups that did not work locally, whose links and
  stories are right, so the cause shows only in the running app; the replaced behaviour block, to
  review with the decisions changes; the phone's padding and text size, which names no page; Claude
  Design.
- Agents' notes added to the inbox: a promoted note whose marks end its first line leaves a `- `
  line with a trailing space; a start whose link rebase fails midway in a postponed folder does not
  name every file left.
