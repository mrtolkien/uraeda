# Rulings: UI improvements

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A proposal hint is its placeholder without the brackets, on one line

- **Decision**: `proposal_hints()` gives each placeholder of the proposal template without its
  brackets, its lines joined with a space, and the "Optional: " prefix kept. The binding returns
  them as `ProposalHint { heading, hint }` objects, declared in the core's `view.rs`, through
  `api::proposal_hints()`, like every other type the binding returns.
- **Rationale**: the plan's interface said "brackets kept as written", but its own examples, and the
  spec's US5 scenario 3 ("a dimmed "The problem it solves, and for whom.""), have no brackets.
- **Alternatives considered**: keeping the brackets, which the editor would then strip, a second
  copy of the template's format.
- **If wrong**: the editor shows the hint with or without brackets; one function to change.
- **Where**: task 1, `crates/core/src/embedded.rs`

## R2: The UI's refused-start test becomes a start that succeeds

- **Decision**: `editor.test.tsx`'s "starting a draft with the template's placeholders is refused"
  now checks that Start starts that draft, and lands on the new feature.
- **Rationale**: the review's C2 removes the refusal for the UI's Start as well as for `ura start`;
  the plan named only the Rust tests to remove. A test that no longer matches the spec is changed
  with it, per the UI checks decision.
- **Alternatives considered**: deleting the test, which would leave C2 unguarded in the UI.
- **If wrong**: one test to remove.
- **Where**: task 1, `packages/web/src/__tests__/editor.test.tsx`

## R3: A priority key is counted over the whole file, and a draft's name is slugged

- **Decision**: `priorities::keys` numbers repeated keys over every section of `PRIORITIES.md`, in
  the file's order, so a "Slack" in Now and one in Later are `slack` and `slack-2`. A linked draft's
  key is `slug::from_text` of its file name without `.md`, and falls back to the line's text when
  that slug is empty. `FeatureView.mockups` is read with the feature's files, so it follows the same
  source: the working tree when the branch is checked out, otherwise its tip.
- **Rationale**: the spec says "a key already taken by an earlier entry of the file", and the task
  view's address `/priorities/<key>` names no section. The spec also says "the slug of the linked
  draft's file name", which a stem alone would not guarantee.
- **Alternatives considered**: numbering per section, which gives two lines the same address; the
  raw stem, which could hold characters an address must escape.
- **If wrong**: one function, `keys`, in `crates/core/src/files/priorities.rs`.
- **Where**: task 3, `crates/core/src/files/priorities.rs`, `crates/core/src/workspace.rs`
