---
kind: change
finished: 2026-10-19
pull-request: https://github.com/mrtolkien/uraeda/pull/41
---

# Record: Spec page fixes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-19, in [its pull request](https://github.com/mrtolkien/uraeda/pull/41). Its full files are
> in git: `git log -- specs/changes/2026-10-18-spec-page-fixes/`.

## What and why

The review of the redesigned spec page left about twenty-five loose ends: spec items the core and
the page dropped without a word, spec-page behaviour tested loosely or not at all, an answered
review that disappeared after landing, and a reading place and an editor that undid or garbled what
the reader did. The change closes each.

## Behaviour

- An item of `## Your review` or `## Decisions` that the core cannot read is a `review.answer` or
  `decisions.item` error in `ura check`, and the page draws it as the spec's own line, which takes a
  comment. A review section of only such items is still drawn.
- A decision counts as pending for the approval step only when its item links this repository's
  `specs/decisions/<name>.md`; a link into another tree, like the skill's example, does not.
- The spec template marks "More scenarios:" optional.
- Each scenario carries its Given, When, and Then steps from the core (`Scenario.steps`); the story
  card draws them.
- The page draws a level-2 section it does not know, in a group after the built parts, with its
  entry in "Contents". A comment on the stories' intro counts for the stories' entry. On the phone,
  a band separates the answers from "What you approve". The data model's intro is a "Data model"
  part, and a waiting spec shows the data model's committed version, as it does its own.
- The niche cases' fold stays open while a comment or the selection is in it. "Contents" starts
  hidden in a window under 1100 px, and shows from it, a stored choice winning at any width.
- A revision's answered review, quotes included, survives a merge commit, and shows for a revision
  edited and not committed yet. After a squash merge the quotes cannot be recovered: no commit keeps
  the review that requested the changes.
- Keeping the reading place no longer undoes the reader's own scroll, nor the browser's scroll
  anchoring a second time. A frontmatter-only draft ends its line before typed text, and a stored
  body opening with a thematic break keeps its lines.
- The tests now pin the Given, When, and Then rows, the criteria's sentence, the "N unchanged" and
  "N removed" folds, a rule's own pill, the unlisted decisions' order, the strength colours, the
  keep a closing comment makes, and the frontmatter through an image that moves a draft.

## Design

Core: [`parts.rs`](/crates/core/src/files/spec/parts.rs) reads the answers and the listed decisions,
and `unread_items` in [`spec.rs`](/crates/core/src/files/spec.rs) names the items it does not read,
which [`check/spec.rs`](/crates/core/src/check/spec.rs) reports, parsing the spec from its own
folder. `steps` in the same file cuts the scenarios.
[`api/answered.rs`](/crates/core/src/api/answered.rs) reads the review at the first commit of the
revision in the history (`Git::path_changes`), else at the tip.
[`workspace/read.rs`](/crates/core/src/workspace/read.rs) compares the item's link with the exact
decision path.

Web: [`SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx) draws the other parts and the band,
[`UnreadItems.tsx`](/packages/web/src/spec/UnreadItems.tsx) the unread items,
[`SpecContents.tsx`](/packages/web/src/spec/SpecContents.tsx) the entries and the width default.
[`keepPlace.ts`](/packages/web/src/keepPlace.ts) tells the reader's scrolls from the page's by the
input that came shortly before them. [`draftText.ts`](/packages/web/src/pane/draftText.ts) cuts the
draft's text.

## Follow-ups

- `storedBody` reads a Markdown heading as a frontmatter comment, and the web recomputes which items
  the core read, where `ura check` has the core's list (inbox, Deferred fixes).
- `answered.rs` can pick the wrong commit after a conflict-resolving merge of two branches that both
  change the spec (inbox, Deferred fixes).
- `useCommentDraft` is one line under its limit, two fixtures list decisions without links, and one
  hook test cannot tell a double correction from a single one (inbox, Deferred fixes).
- Input made inside a story's frame is not counted as the reader's scroll.
- Two sidebar browser tests fail on the repository's own priorities text, outside this change.
