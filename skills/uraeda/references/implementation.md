# Implementation

Builds the plan, one step per commit, and delivers it as a pull request.

- **Runs when**: `plan.md` is `approved` or `auto-approved`, with unchecked steps
- **Writes**: code, tests, and the step checkboxes in `plan.md`
- **Ends at**: a pull request, reviewed by a human

> [!NOTE]
>
> Draft: this step will be refined once the earlier steps work.

## Branch

Code is always delivered through a pull request. If you are on the default branch, create a branch
named after the spec folder, `001-recurring-tasks`. If a branch or pull request already exists for
it, continue there.

## For each unchecked step, in order

Before starting, read the active decisions that apply to the code you will touch, as they are now. A
human may have changed one since the plan was written: if it now conflicts with the spec or the
plan, stop and go back to [discovery](discovery.md).

1. Break the step down into small tasks, in your own session. They are not written to `plan.md`.
2. Write the tests for the acceptance scenarios the step covers, and check that they fail.
3. Implement the step, keeping the code explicit and simple.
4. Run the project's validation: formatter, linter, type checker, tests.
5. Check the step's box in `plan.md`, and commit it with the code, following the project's commit
   conventions.

Settle implementation details yourself. If a step needs something the spec, plan, and decisions do
not allow, stop: write the reason in a new `discovery.md` session and go back to
[discovery](discovery.md). Do not work around it.

## Pull request

Once every step is checked, open a pull request, or mark it ready for review:

- Link to `spec.md` and `plan.md`
- List each acceptance scenario with the test that covers it
- List any assumption you made during the implementation

In the commit that checks the last step, also remove the feature's entry from `PRIORITIES.md`: the
entry disappears when the pull request is merged, not before. Leave other entries unchanged.
