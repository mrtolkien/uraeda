# Rulings: Onboarding + README pass

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The setup check reads the default branch's files

- **Decision**: the check reads the constitution and the decisions where the ledger reads them: the
  default branch's checkout, or its tip when no checkout has it.
- **Rationale**: the setup lands on the default branch, and the Decisions page already shows that
  branch's ledger. `ura status` run in a feature's worktree then lists the same items as Home.
- **Alternatives considered**: the checkout the command runs in: a feature's worktree, branched
  before the setup, would list files the project has.
- **Where**: task 1, `crates/core/src/api/setup.rs`

## R2: The core gives no item once the project is set up

- **Decision**: the check returns every item while a required one is not written, and an empty list
  once they all are.
- **Rationale**: when the pane and the Setup lines go is one rule, so it lives in the core with the
  rest; Home and `ura status` only test for an empty list.
- **If wrong**: a tool wanting the states of a set-up project gets none; returning them always and
  adding a `done` flag is a small change.
- **Where**: task 1

## R3: The Setup pane sits above Home's core, not in its columns

- **Decision**: the pane comes first on Home, full width, above the notes and the core's two
  columns.
- **Rationale**: the core's columns are cards moved through by keys; the pane holds a list and a
  button, and is first at every width this way.
- **Where**: task 4, `packages/web/src/Home.tsx`

## R4: The sample project without `specs/` is named `bare`

- **Decision**: the sandbox's fifth project is `bare`, a repository with one commit and a README.
- **Rationale**: short, and says what it lacks, beside `empty`, a project set up and empty.
- **Where**: task 2

## R5: The New page is filled through its history entry

- **Decision**: "Set up with the agent" opens `/new?kind=session` with `insert: "setup"` in the
  history entry, as a proposal's Start passes `line:<id>`.
- **Rationale**: the entry is how the New page already learns what to insert on arrival, once, and
  not again on a reload.
- **Where**: task 4, `packages/web/src/NewPage.tsx`
