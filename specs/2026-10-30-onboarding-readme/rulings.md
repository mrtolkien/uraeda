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

## R6: The decisions' word limit rises to 11,100

- **Decision**: the core's test `the_ledger_reads_alone` allows 11,100 words of decisions, up from
  11,000.
- **Rationale**: the approved documentation decision brings them to 11,065. A test gives way to an
  approved decision; the limit is an older feature's success criterion, not a rule of a decision.
- **Alternatives considered**: trimming the documentation decision, or another one: it would change
  approved text, which needs the human's approval again.
- **If wrong**: trim the decisions in a decisions check, and set the limit back.
- **Where**: `crates/core/tests/check.rs`

## R7: `ura status --json` lists four setup items after `ura init`

- **Decision**: the status test expects four items in `setup` after `ura init`, not five.
- **Rationale**: `read_setup` lists the `specs/` folder's item only without `specs/`, and
  `ura status` fails there before reading it, as `no_specs_folder` asserts. The plan's five counted
  that item.
- **If wrong**: `ura status` would list the `specs/` folder as written, which the spec's states do
  not name.
- **Where**: task 3, `crates/cli/tests/status.rs`

## R8: Without `specs/`, the pages the pane leads to read no priorities nor ledger

- **Decision**: in a repository without `specs/`, the shell's Commit button and tab, the New page's
  entry lists and its proposal insertion, and the Decisions page's ledger are not read; the
  Decisions page shows its `NoSpecs` warning.
- **Rationale**: the core refuses those reads without `specs/`, and each failure replaced the whole
  page with "Could not reach the Uraeda server.", so `bare`'s Home, and the New page its button
  opens, never showed. The shell already skipped the inbox's count there the same way.
- **If wrong**: the Inbox and Priorities pages still fail without `specs/`; giving them a warning
  too is the same small change.
- **Where**: task 4, `packages/web/src/shell/`, `packages/web/src/NewPage.tsx`,
  `packages/web/src/decisions/DecisionsPage.tsx`

## R9: The Setup pane closes, its last items written

- **Decision**: once the core gives no item, Home's pane closes over 200 ms, as the column's Unfold
  does, drawing its last items with each required one written; its status announcements sit beside
  it, not in it.
- **Rationale**: the UI guides ask that moving content glide, never jump; and with R2's empty list,
  the last file written would otherwise go unannounced, the pane gone with it.
- **Where**: task 4, `packages/web/src/Home.tsx`, `packages/web/src/home/Setup.tsx`

## R10: The sandbox's sample project gets a code-quality and a testing decision

- **Decision**: `sample` commits Uraeda's own `code-quality.md` and `testing.md` on its `main`, so
  it is set up. `fixtures/repo`, which many tests share, stays as it is.
- **Rationale**: `sample` is the project the sandbox opens for every review; a Setup pane first on
  its Home would push every other pane down. `empty` and `bare` show the pane.
- **Alternatives considered**: the two decisions in `fixtures/repo`: every test reading its ledger
  would change.
- **Where**: `packages/web/samples/projects.ts`, from the review of wave 1
