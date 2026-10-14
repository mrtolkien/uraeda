# Rulings: Text inputs and comments

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The approved spec follows main's new spec template

- **Decision**: the spec's sections move to the template that main adopted while the spec was
  reviewed: "Design" becomes "Architecture", from its "Approach", then "Mockups", and "Data",
  "Components", "Error handling", and "Testing" go under "Details", after "Risk tier". No sentence
  changes.
- **Rationale**: `vp run ready` runs `ura check` on `specs/`, which refuses the old sections since
  the code quality feature merged
  ([template](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md)).
- **Alternatives considered**: leaving the spec as approved, which fails the validation of every
  task.
- **If wrong**: the move is mechanical; git shows the spec as approved in its approval commit.
- **Where**: [spec.md](spec.md), in the plan's commit.

## R2: The discard confirmation of fields that are not comments

- **Decision**: Cancel or Escape on a changed line, quick add, or slug asks "Discard your changes?",
  with "The text you typed is deleted.", "Keep editing", and "Discard". The notes and the editor
  have no Cancel: Escape does nothing there, and their unsaved text is discarded with the restore
  notice's Discard, or kept.
- **Rationale**: the spec names "Discard your comment?" for comment forms only; the decision asks
  every changed field's Cancel or Escape to confirm with "Discard" and "Keep editing".
- **Alternatives considered**: "Discard your comment?" everywhere, wrong for a priority line; Escape
  clearing the notes, which would discard a long text with one key.
- **If wrong**: one title in `fields/Confirm.tsx`'s callers.
- **Where**: tasks 4 and 9.

## R3: `section` stays in `items.rs`, and `choices` moves with the round

- **Decision**: task 1's split moves `round()`, `named_section`, `leading_strong`, and `choices`
  into `files/items/round.rs`, and `round_name` with the answer functions into `api/answers.rs`;
  `section` stays in `items.rs`.
- **Rationale**: `section` is also used by the spec's and the rulings' items, while `choices` and
  `round_name` serve the round alone.
- **Alternatives considered**: moving `section` as the plan said, and re-exporting it for its other
  callers, which puts a shared helper in the round's module.
- **If wrong**: a function moves between two files of the same module.
- **Where**: task 1, step 1.
