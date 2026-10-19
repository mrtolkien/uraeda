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

## R2: The fast check's SC-002 time, and where it differs from the plan

- **Decision**: `vp run fast` runs `scripts/fast-check.ts`, uncached, on the working tree's changes
  against the last commit, or the last commit's files when the tree is clean (`vp run fast main`
  takes the whole branch). Its test lives in `packages/server/src/__tests__/fast-check.test.ts`,
  where `coverage-summary.test.ts` already tests a script: no Vitest project covers `scripts/`. A
  Rust or skill change relates the TypeScript tests to `packages/binding/index.js`, so Vitest's
  module graph finds the tests loading the binding; a root config file is never related, since every
  test loads it.
- **SC-002 measured**: on the old suites, after a one-line edit of one web file, `vp run fast` took
  3 minutes 12 seconds for `Composer.tsx` and 3 minutes 11 seconds for the leaf `Crumbs.tsx`: 51 of
  the 53 related test files run, 838 tests, 180 seconds of them. `vp check` takes about 7 seconds
  and the rest of the run about 10. SC-002 is not met yet: the old web tests each build a real
  repository and reach almost every component through `App`. Task 10 measures it again on the new
  flows.
- **Rationale**: a task is one commit, so the branch's older changes were checked by their own task
  (a branch diff re-ran every test after a `vite.tasks.ts` change of an earlier task).
- **Alternatives considered**: the diff to the merge base, which grows with the branch.
- **If wrong**: pass `main` as the argument to check the whole branch.
- **Where**: [`scripts/fast-check.ts`](/scripts/fast-check.ts), task 3 of the plan.
