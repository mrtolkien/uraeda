# Rulings: Proposal start flow

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Built on Feature state's branch before its merge

- **Decision**: the branch merges the Feature state branch as it was at `287a1b9c`, and is built on
  it, rather than waiting for its merge into `main`.
- **Rationale**: the spec builds on Feature state's line replacement for a typed change, which that
  branch had finished (its task 3 and the fixes after it); its tasks left to build touch progress,
  the Push step, and the views' status, not the start. The human asked for this feature's pull
  request now.
- **If wrong**: this pull request carries Feature state's commits until that branch merges, and must
  merge after it. A later change to the start on that branch is merged in again. Until then,
  `ura check` warns `decision.unapproved` on Feature state's own decisions, `feature-status.md` and
  `git.md`, which that branch's approval covers, not this one's.
- **Where**: the branch's merge commit, before the plan.

## R2: The draft's sources keep their section

- **Decision**: a stored source keeps the `section` of a line, beside the data model's `kind`, `id`,
  `linked`, `text`, and `inserted`.
- **Rationale**: the change's start, from Feature state, replaces only a line of **Now**, and reads
  it from the source's `section`. Without it, a reload would make a line of **Next** look like one
  of **Now**, and leave it in the priorities.
- **Where**: task 3, `packages/web/src/newDraft.ts`.

## R3: A feature's text is cleared once its session reads it started

- **Decision**: the New page's text, and its other sources, wait for the feature to be readable,
  which the session page of the start checks as it draws from the plan, then go.
- **Rationale**: the server answers once the start is planned, before its commit lands, and the spec
  keeps the text until a start lands. The session page already reads when the start landed
  (`useLanded`), and the human is on it once the start is planned.
- **If wrong**: a human who leaves the session page before the commit lands finds the text still in
  the composer. Nothing is lost; a second start of it is refused as its slug is taken.
- **Where**: task 4, `useStart.ts` and `session/StartingSession.tsx`.

## R4: The research effort's levels come with the slug's proposal

- **Decision**: `SlugProposal` gains `discoveryLevels`, read from the core, which the start dialog
  already asks for its slug.
- **Rationale**: the levels are the core's rule, as the editor reads them from the proposal file's
  view; a typed feature has no file yet, and the dialog reads no other record.
- **Where**: task 2, `views-proposal-file.ts`.
