# Rulings: Dismiss an inbox triage

The low-impact choices made while building [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: Dismiss commits the deletion, with no undo

- **Decision**: Dismiss deletes `specs/INBOX-TRIAGE.md` and commits the deletion alone,
  `chore: dismiss the inbox triage`, through the write queue, as Submit commits the triage's
  answers. Nothing waits on the Git page, and there is no undo.
- **Rationale**: the [undo decision](/specs/decisions/undo.md) lets committing actions run at once,
  their button naming what they do. A committed deletion leaves the default branch clean for the
  next "Organize with AI", whose agent commits its new triage alone, and the commit bar lists only
  `INBOX.md` and `PRIORITIES.md`, so an uncommitted deletion would show nowhere but the Git page.
  Git keeps the dismissed triage.
- **Alternatives considered**: an uncommitted, undoable deletion, as the inbox's own edits are: it
  needs the commit bar to learn a third file, and leaves the next triage's agent a deletion in its
  checkout.
- **If wrong**: the deletion is one commit, which `git revert` takes back.
- **Where**: `crates/core/src/actions/default_round.rs`, `packages/web/src/InboxTriage.tsx`

## R2: Dismiss asks only when answers would be lost

- **Decision**: Dismiss asks "Dismiss the inbox triage?" only when the triage holds answers saved
  but not committed, which the deletion loses for good. A triage committed as it is goes at once. A
  triage never committed is refused, "INBOX-TRIAGE.md was never committed: delete it by hand to
  dismiss it.", as git would not keep it, and could not commit its deletion.
- **Rationale**: the [undo decision](/specs/decisions/undo.md) keeps questions for what loses work
  for good, so a question still means danger. A committed triage stays in git's history.
- **Where**: `packages/web/src/InboxTriage.tsx`

## R3: The decisions check keeps no Dismiss

- **Decision**: only the inbox's triage gets Dismiss. The core refuses to dismiss the decisions
  check.
- **Rationale**: the proposal names the triage alone. The check also has candidate files in
  `specs/decisions-check/`, which its dismissal would have to delete too: its own change, if wanted.
- **Where**: `crates/core/src/actions/default_round.rs`
