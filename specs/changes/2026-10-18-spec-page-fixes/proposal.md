---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Spec page fixes

## What

- Spec parsing: a ## Your review item that does not parse (Done., non-bold C3) and a ## Decisions
  item with a wikilink or a missing decision file are dropped without a ura check problem, and the
  page draws neither; read.rs reads specs/decisions/<name>.md for a link into another
  specs/decisions/ tree; the spec template does not mark "More scenarios:" optional.
- Spec page: Given/When/Then rows and the criterion's sentence are tested loosely (rows untested; "N
  unchanged", unlisted order, a rule's own Changed pill, SHOULD vs MUST colours untested); Scenario
  steps are cut in the web on bold spans (the core could send them); trimmed() is defined twice; the
  niche fold's choice overrides a later comment; the data model's intro sits outside any panel; on
  the phone no band between "What you approve" and the answers; comments on the stories' intro are
  counted nowhere; an unknown level-2 section is not drawn; data-model.md is read from disk while a
  waiting spec shows its commit; "Contents" at 420 px leaves 350 px for the page at 768–800 px.
- Answered review: once merged with a merge or squash commit, FileView.answered is empty on the
  default branch, so the quotes disappear after landing; an uncommitted revision shows no quotes
  until committed.
- Reading place and editor: keepPlace and placeAboveSheet cancel the user's own scroll during their
  two frames; the desktop "saving keeps the heading" test rejects nothing, and leave()'s keep is
  untested; a file that is only a frontmatter without a final newline joins typed text onto ---;
  R31's image-move path has no test; storedBody strips a new entry whose body opens with a ---
  break.

## Why

## Notes
