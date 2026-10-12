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
