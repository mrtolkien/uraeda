# Rulings: Decision review fixes

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
active decisions. None binds future work: those are decisions.

## R1: A decision's name in a review heading

- **Decision**: a name is valid when it is not empty, has no space, comma, slash, or backslash, and
  does not start with a dot. The writer and the parser share `is_decision_name`.
- **Rationale**: the writer refused a space and a comma, the parser a space only, and a path never.
  No review file in the repository holds a name the new rule refuses.
- **Alternatives considered**: refusing every character outside `[a-z0-9-]`: decision files may use
  others, and the writer never did.
- **If wrong**: a decision file named with a leading dot or a slash cannot be commented on.
- **Where**: `crates/core/src/files/review.rs`.

## R2: A link's text counts as reviewed words

- **Decision**: the reviewed part counts a link's text. Code spans and images still count for
  nothing. A round's sentence limit still leaves links out.
- **Rationale**: a decision's title is a link in the spec's list of decisions: a reviewer reads it.
- **Alternatives considered**: counting code spans too: left for a later change, as nothing reported
  it.
- **If wrong**: `spec.length` warns slightly sooner. The example spec stays under 2,000 words.
- **Where**: `crates/core/src/check/spec.rs`.

## R3: Title and frontmatter changes are fields, not parts

- **Decision**: `DecisionChange.fields` lists the title and each scalar frontmatter field whose
  value differs. An unlisted decision with a field difference shows a card, saying "No part changed"
  when no part did.
- **Rationale**: a title or a status has no part to mark, and the card would otherwise say "No
  change" over a changed status.
- **Alternatives considered**: an all-kept card with a "Changed" pill and nothing marked: it hides
  what changed.
- **If wrong**: a list-valued frontmatter field changing is not shown: the frontmatter reader keeps
  scalar values only.
- **Where**: `crates/core/src/decisions/change.rs`, `packages/web/src/spec/DecisionCard.tsx`.

## R4: The plan's complexity row is left alone

- **Decision**: no change for the row saying the editor and the web see `decision.unapproved`.
- **Rationale**: that plan was replaced by its record, which says nothing of it, and the skill's
  documents say `ura check` shows it. Nothing current is wrong.
- **Alternatives considered**: showing it in the editor and the web: a new feature.
- **If wrong**: a reader of the old plan in git history is misled.
- **Where**: none.

## R5: The two decision orders are fixed by moving a rule

- **Decision**: `compatibility.md` and `diagrams.md` keep every rule, with the MAY rule and the
  SHOULD rule moved to the end. A rule ranks by its first keyword, as before.
- **Rationale**: approved in
  [Q1](clarifications-01.md#q1-reorder-two-decisions-so-ura-check-stops-warning).
- **Alternatives considered**: ranking by the strongest keyword: it changes the check's rule.
- **If wrong**: move the rules back, and the warning returns.
- **Where**: `specs/decisions/compatibility.md`, `specs/decisions/diagrams.md`.

## R6: A decision file checked alone checks its folder

- **Decision**: `check` on a file of `specs/decisions/` runs `decision.unapproved` for the features
  of its `specs/` folder, and keeps only that file's problems.
- **Rationale**: the warning belongs to a decision, and the folder's check reports it already.
- **Alternatives considered**: a new per-file entry point: the same work, more code.
- **If wrong**: a single-file check is slower on a repository with many features.
- **Where**: `crates/core/src/check/mod.rs`.
