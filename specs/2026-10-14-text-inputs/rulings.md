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

## R4: The workflow file's mutations and binding functions move out before they grow

- **Decision**: before task 2 adds its three functions, the mutations that change a workflow file,
  answers, notes, and reviews, move from `mutations.ts` into `fate/file-mutations.ts`, with the
  `Resolver` type moving into `fate/context.ts`, and the same functions of the binding move from
  `lib.rs` into `file_writes.rs`, each in a commit that only restructures.
- **Rationale**: `mutations.ts` had 499 lines and the binding's `lib.rs` 484: the three new
  functions push both past the 500 lines of the code quality decision.
- **Alternatives considered**: a module for the settled comments alone, which splits the round's
  writes over two files.
- **If wrong**: the functions move back once the limit allows.
- **Where**: task 2.

## R5: `save_notes` compares `previous` with the free notes

- **Decision**: `save_notes` refuses when the file's free notes, not its whole notes, differ from
  `previous`, and writes through `set_notes`, which keeps the comments.
- **Rationale**: the spec's Data says `previous` is the free notes last read, and since task 1 the
  UI reads the free notes only: comparing with the whole notes refused every save of a round with a
  comment.
- **Alternatives considered**: none; the plan did not name the change.
- **If wrong**: one comparison in `answer.rs`.
- **Where**: task 2.

## R6: A session's composer stays as its first message creates the session

- **Decision**: a feature's session page and a new chat draw one `SessionPane`, whose composer stays
  mounted when the first message creates the session: only the header and transcript above it
  change. The pane reads the session's status for the composer through `useView` on a reference to
  the session, `undefined` before it exists.
- **Rationale**: the page drew `NoSession` until the session existed, then `Session`, two trees, so
  the composer was replaced as the session landed: a key typed at that moment was lost, and the
  field lost the focus. React Compiler, task 3, made the tests type faster than the session lands,
  which turned the race into a failure of about half the web test runs; it failed without the
  compiler too.
- **Alternatives considered**: waiting in the tests for the session before typing, which hides a bug
  a human meets; the session's view sending its status up to the page in an effect, which draws
  twice for each change.
- **If wrong**: `SessionPane` splits back into its two branches.
- **Where**: [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx), before task 3's commit.
