# Rulings: Spec page fixes

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
active decisions. None binds future work: those are decisions.

## R1: An unreadable item is an error, and the page draws it as written

- **Decision**: an item of `## Your review` or `## Decisions` that the core does not read is a
  `review.answer` or `decisions.item` error in `ura check`, and the page draws it as the spec's own
  block, after the answers or the cards.
- **Rationale**: the page cannot show the item as an answer or a card, and dropping it hides text
  the human may need to read. An error, like `edges.importance`, makes the author fix the format.
- **Alternatives considered**: a warning, which a waiting spec could still ship with; and drawing
  nothing, as before.
- **If wrong**: a spec with a free-form item fails `ura check`. Make the rules warnings.
- **Where**: [`check/spec.rs`](/crates/core/src/check/spec.rs),
  [`ReviewAnswers.tsx`](/packages/web/src/spec/ReviewAnswers.tsx),
  [`DecisionCards.tsx`](/packages/web/src/spec/DecisionCards.tsx).

## R2: A missing decision file is the links rule's, not a new one

- **Decision**: a `New:` or `Changed:` item whose link points to a decision file that does not exist
  is reported by `links.*`, as any link is. `decisions.item` only covers an item the core cannot
  name a decision from.
- **Rationale**: the links check already resolves the link from the spec's folder. A second rule for
  the same fact would report the line twice.
- **Alternatives considered**: a `decisions.missing` rule, for a removed decision's file name in
  code, which is deleted on the branch by definition.
- **If wrong**: a removed item naming a file that never existed passes. Add the rule then.
- **Where**: [`check/links.rs`](/crates/core/src/check/links.rs).

## R3: A link counts as this repository's decision by its exact path

- **Decision**: `decisions_pending` counts a listed decision only when its item links
  `specs/decisions/<name>.md` from the root. The listed decisions the page draws keep
  `decision_name`'s looser rule, which names any `.../specs/decisions/<name>.md`.
- **Rationale**: only the approval step reads the repository's own decision files, so only it needed
  the exact path. Changing what the page lists is beyond the proposal.
- **Alternatives considered**: tightening `decision_name`, which would stop the skill's example from
  showing its decisions where it is read in this repository.
- **If wrong**: a spec linking a decision of another tree shows its card but never waits for its
  approval. That is the intended reading.
- **Where**: [`workspace/read.rs`](/crates/core/src/workspace/read.rs) `decisions_pending`.

## R4: A scenario's steps come from the core, and `trimmed()` is single again

- **Decision**: `Scenario.steps` carries each scenario's Given, When, and Then spans, cut by the
  rule the story card used, the card's own copy deleted. The built parts keep their own `trimmed()`,
  which trims blanks only: it is no longer a duplicate, since the card's version also dropped a
  comma.
- **Rationale**: the proposal says the core could send the steps. The binding is internal, so a new
  field changes no public interface.
- **Alternatives considered**: sharing one `trimmed()` with an option for the comma, which would
  keep the cut in the web.
- **If wrong**: a consumer of the binding that ignores `steps` is unaffected.
- **Where**: [`files/spec.rs`](/crates/core/src/files/spec.rs) `steps`,
  [`StoryCard.tsx`](/packages/web/src/spec/StoryCard.tsx).

## R5: The niche fold stays open while something in it is shown

- **Decision**: the fold is open when opened by hand or while a comment or the selection is in it,
  like the decision cards' folds. Folding it by hand while a comment is in it does nothing.
- **Rationale**: the proposal asks that a later comment not be overridden by an earlier choice. The
  decision cards already behave so.
- **Alternatives considered**: forgetting the choice when a comment arrives, which needs a
  transition effect for the same result.
- **If wrong**: a reader cannot fold the niche cases while one is commented. Remove `|| held`.
- **Where**: [`BuiltParts.tsx`](/packages/web/src/spec/BuiltParts.tsx) `EdgeList`.

## R6: A section the page does not know is a group after the built parts

- **Decision**: a level-2 section outside the known titles is drawn as written, in its own group
  with its title, after "How it is built", before "History", and listed in "Contents".
- **Rationale**: nothing the human reads should go missing. A group is the page's unit for a
  section, and the spec's order puts such a section near its end.
- **Alternatives considered**: drawing it where it stands in the file, which the page's fixed order
  of groups does not allow without reordering every group.
- **If wrong**: a section meant for the top reads low. Reorder `Groups`.
- **Where**: [`SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx) `Groups`.

## R7: The answers get the phone's band, the data model's intro its own part

- **Decision**: on the phone, a band sits between "What you approve" and the answers, as before
  every group. The data model's intro is a "Data model" part under "Data".
- **Rationale**: the proposal names both gaps without a design. The band is the page's own
  separator; a part of its own keeps the intro in a card on a wide screen.
- **Alternatives considered**: a bolder band, or no title on the intro's card.
- **If wrong**: a different look. Restyle `Band` or the part's title.
- **Where**: [`SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx),
  [`DataPart.tsx`](/packages/web/src/spec/DataPart.tsx).

## R8: "Contents" starts hidden under 1100 px

- **Decision**: with no stored choice, "Contents" shows from a window of 1100 px, and starts hidden
  under it. A stored choice wins at any width.
- **Rationale**: at 768 px, 420 px of "Contents" leaves 350 px for the page. 1100 px leaves the page
  680 px, its reading measure. Keeping the column's 420 px floor keeps the verdict's longest button
  uncut. The UI layout decision sets the wide class at 768 px, which this does not change.
- **Alternatives considered**: a narrower column at tablet widths, which cuts the verdict's buttons;
  hiding it under 1100 px always, which takes the choice from the reader.
- **If wrong**: a reader on a tablet shows it with its button once. Change `SHOWN_FROM`.
- **Where**: [`SpecContents.tsx`](/packages/web/src/spec/SpecContents.tsx).

## R9: A squash merge loses the answered review's quotes

- **Decision**: a revision's answered review is read from the history, which a merge commit keeps
  and a revision not committed yet reads at the tip. A squash merge is left as it is: the page shows
  the answers without their quotes.
- **Rationale**: a squash keeps none of the branch's commits, so no commit of the default branch
  holds the review that requested the changes. Keeping it would change the finish step, which is a
  workflow change.
- **Alternatives considered**: the finish step copying the review into the record, which the
  proposal does not ask for.
- **If wrong**: the quotes of a squash-merged spec are never shown. Add the copy to the finish step
  in a feature.
- **Where**: [`api/answered.rs`](/crates/core/src/api/answered.rs).

## R10: The saving test runs on the phone, the keeps are tested directly

- **Decision**: "saving a comment keeps the heading you read in place" runs on the phone only. The
  keep `leave()` makes has a hook test, and the reader's own scroll a unit test.
- **Rationale**: on a desktop the form opens under the block, and what is above never moves, so the
  test rejected nothing there.
- **Alternatives considered**: reading a block below the tapped one, which the page does not keep by
  design.
- **If wrong**: none; the phone test stays.
- **Where**: [`reading-place.test.tsx`](/packages/web/src/__browser__/reading-place.test.tsx),
  [`comment-draft-place.test.tsx`](/packages/web/src/__tests__/comment-draft-place.test.tsx).

## R11: A stored text is a frontmatter only when its lines are fields

- **Decision**: `storedBody` strips the lines between two `---` only when each is a field, a list
  item, a comment, or blank. A frontmatter-only file's head ends its line.
- **Rationale**: an entry stored before the box hid the frontmatter holds the whole file, but a new
  entry may open with a thematic break. Telling them apart exactly needs a marker in the stored
  entry, which touches every field's store.
- **Alternatives considered**: a marker in the store, which is larger than the proposal.
- **If wrong**: a body opening with a break around lines that look like fields is cut. Add the
  marker.
- **Where**: [`draftText.ts`](/packages/web/src/pane/draftText.ts).
