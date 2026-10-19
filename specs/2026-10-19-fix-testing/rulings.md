# Rulings: Fix testing

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The record of old tests lives in the rulings

- **Decision**: each area's task adds a ruling listing its old test files, each with the flow that
  replaces its behaviour or the rule that dropped it, and the coverage before and after.
- **Rationale**: SC-005 asks for a record of every old test file, and the rulings are the plan's
  place for choices made while building: no new file kind for `ura check` to reject.
- **Alternatives considered**: a separate inventory file, which the workflow has no template for.
- **If wrong**: move the rulings' tables to the record in `specs/done/` when the feature finishes.
- **Where**: tasks 4 to 10 of the plan.
