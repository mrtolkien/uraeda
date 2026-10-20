# Rulings: Inbox quick fixes

The low-impact choices made while making [the proposal](proposal.md)'s items, inside the limits of
the decisions. None binds future work: those are decisions.

## R1: Untraced figures read "No figures: its commits could not be traced"

- **Decision**: a done item with no typed pull-request commit on the default branch reads "No
  figures: its commits could not be traced", in place of "Not found on the default branch".
- **Rationale**: the words cover both causes the core cannot tell apart, a squash merge and a record
  from before typed commits ([`history.rs`](/crates/core/src/history.rs)), and say what the reader
  misses: the figures. The [redesign-feature record](/specs/done/2026-10-18-redesign-feature.md)
  named the old words; the proposal asked to change them.
- **Alternatives considered**: two messages, one per cause: the core would need to tell a squash
  merge from untyped history, a new rule for a line of text.
- **If wrong**: one string in [`Figures.tsx`](/packages/web/src/feature/Figures.tsx) and its test.
- **Where**: item 3

## R2: The sidebar items 5 and 6 were already fixed on the default branch

- **Decision**: no commit for the uncoloured "+N −N" or the overflowing chat row.
- **Rationale**: `fix: nicer sidebar` (61c4b1f2) gave the counts the theme's `--color-success` and
  `--color-error`, defined in `src/theme/built/uraeda.css`, and
  `fix: cut a chat's title in the sidebar with an ellipsis` (70426943) ended the overflow. Both
  landed after their notes. The browser test "the sidebar with sessions, searched for “”" passes on
  the desktop in both themes.
- **Alternatives considered**: a new test of the counts' colour: the
  [UI checks](/specs/decisions/ui-checks.md) decision forbids asserting pixels or styles.
- **If wrong**: the screenshots' review of the sidebar catches it.
- **Where**: items 5 and 6

## R3: The old-format rule moves to Conventions, word for word

- **Decision**: SKILL.md keeps one line linking
  [a file in an old format](/skills/uraeda/references/conventions.md#a-file-in-an-old-format), whose
  text moved unchanged.
- **Rationale**: it applies only when a file drifted, the case the size test's message names: "move
  what most steps do not need to a reference". It frees about 300 characters.
- **Alternatives considered**: rewording SKILL.md's prose to save the same room: it changes rules
  every step reads.
- **If wrong**: move the paragraph back, and find the room elsewhere.
- **Where**: item 1
