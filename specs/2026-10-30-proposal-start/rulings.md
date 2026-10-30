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
- **Catching up**: the final review merges `main` in rather than rebasing on it, so Feature state's
  commits are not replayed as this branch's own.
- **Where**: the branch's merge commits, before the plan and at the final review.

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
  the composer, and the notes and lines it was filled from still in their files, until they open
  that session page again in the same tab: the plan is kept in the page's memory, so a reload before
  the commit lands forgets it, and the text and its sources then stay until the human empties the
  composer. Nothing is lost; a second start of it as a feature is refused as its slug is taken, but
  started as a change it would be a second one. Keeping the plan with the draft would add a stored
  field the data model does not have. The landing runs once: a note taken out twice would take out
  the one that moved into its place.
- **Where**: task 4, `useStart.ts` and `session/StartingSession.tsx`.

## R4: The research effort's levels come with the slug's proposal

- **Decision**: `SlugProposal` gains `discoveryLevels`, read from the core, which the start dialog
  already asks for its slug.
- **Rationale**: the levels are the core's rule, as the editor reads them from the proposal file's
  view; a typed feature has no file yet, and the dialog reads no other record.
- **Where**: task 2, `views-proposal-file.ts`.

## R5: The start dialog's refusal reads as a sentence

- **Decision**: the dialog adds a period to a refusal that ends without one, so a taken slug reads
  "A feature named dark-mode exists already.", as the spec and its story write it.
- **Rationale**: the core's refusals end without a period, and the server's tests match them as they
  are; the dialog is where the text is read as a sentence. The change's dialog reads the same.
- **Where**: task 4, `packages/web/src/StartDialog.tsx`.

## R6: The keys test of the New page's composers stays as it was

- **Decision**: "US3 5: on the New page, `i` focuses the composer of the kind picked" is kept
  unchanged, rather than rewritten.
- **Rationale**: the Feature card's box keeps its "Write Proposal" name, as the spec settled, so the
  test still finds it, and still guards what it did: `i` focuses the picked card's composer.
- **Where**: task 4, `packages/web/src/__tests__/keys-pages.test.tsx`.

## R7: A refused typed start's session says where the text is

- **Decision**: the session page of a refused typed feature start blocks its composer with "Nothing
  started: your text is still on the New page.", where a proposal file's start says to start it
  again from its file.
- **Rationale**: a typed feature has no file, and the New page's composer keeps its text until the
  start lands.
- **Where**: task 4, `packages/web/src/session/StartingSession.tsx`.

## R8: An inbox note's move to a proposal file stays

- **Decision**: `inbox.toProposalFile`, the binding's `noteToProposalFile`, and the core's
  `note_to_proposal_file` stay, though the New page, their only caller in the web UI, no longer
  writes a proposal file.
- **Rationale**: the core's tests of that move guard stored formats, a note file's images included,
  and the spec's replaced behaviour does not list them: removing them is the human's to approve.
- **If wrong**: an unused path stays until a later change drops it with its tests.
- **Where**: `crates/core/src/api/inbox_edits.rs`, `packages/server/src/fate/inbox-mutations.ts`.

## R9: A feature's record says it is not missing

- **Decision**: the server's feature record sends `missing: false`, where it left the field out.
- **Rationale**: the browser merges a record into the one it read before, so a session page that
  read the folder missing before its start landed kept `missing: true`, and never saw the feature
  land. Found by the test of a start whose commit is held.
- **Where**: `packages/server/src/fate/sessions.ts` (`featureRecord`).
