---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Round fixes

## What

- The settled fold reads "Show the 1 points" for a single point under the hood
- block.count warns on a round sent back for blank answers, whose first line names the blank
  questions ("2 questions still need an answer: Q3 and Q5")
- A comment saved with no letter picked but starting like "A: ..." or "B, ..." reads back as that
  letter picked, and opens its follow-ups: the web UI could warn
- On the phone, the round page draws its band before the settled points even when there are none, as
  on the triage
- A #### heading in a round Context is dropped from the page, and ura check says nothing
- section() in items.rs stops at a quoted ## heading, cutting the settled points after it
- Old-format rounds remain as inline test inputs (crates/core/tests/actions.rs, crates/lsp/tests
  reads.rs and editing.rs, web change.test.tsx, nvim test_jumps.lua and test_waiting.lua): new tests
  will copy them
- SettledGroup.kind is a string rather than the spec SettledKind enum, so the web gets no
  exhaustiveness check
- ura check parses a waiting round twice (markdown and document trees), on every keystroke through
  ura lsp
- settled_points still reads the settled section on its own, beside the groups: two readings of one
  section
- The round cards accent lines use --spacing-1, which scales to about 4.8 px from 1024 px where the
  spec says 4 px; the split threshold is read once on mount
- Round card tests leave the 5 to 6 ratio, the follow-up joint and indent, the phone follow-up
  accent, and the option focus ring untested, and some find elements by Astryx class names
- On a phone, the round's in-page Questions index has no test that it is hidden on an answered
  round, nor that it sits after the block (round.test.tsx)
- The round's in-page index is announced as Questions three times, nav, heading, and list: label the
  nav by its heading and drop the list's label there (RoundNav.tsx RoundIndex)
- RoundPage's comment on navigates names the column and the top bar, not the phone's in-page index
  (RoundPage.tsx)

## Why

## Notes
