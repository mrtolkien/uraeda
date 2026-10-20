# Rulings: Merge chats and changes

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A dropped worktree says where it stays

- **Decision**: `Dropped.worktree` is an `Option<Left>`, the worktree's path with why it stays, not
  the plan's `Option<WhyLeft>`. Besides the spec's "Its worktree has uncommitted changes: it stays
  at <path>", the drop says "Its worktree is locked", "You are in its worktree", and "Its worktree
  is outside .worktrees/", each followed by ": it stays at <path>".
- **Rationale**: the spec's sentence names the path, and `WhyLeft::Changes` has none; the shared
  worktree step of `clean` already returns a `Left`. The other reasons are the ones `ura clean`
  leaves a worktree for, and the spec gives them no text.
- **Alternatives considered**: rebuilding the path as `.worktrees/<folder>` in the API: wrong for a
  worktree checked out elsewhere.
- **If wrong**: one field type and four sentences, in `actions/drop.rs` and `api/drop.rs`.
- **Where**: task 2, `crates/core/src/actions/drop.rs`, `crates/core/src/api/drop.rs`.

## R2: A drop commits the priorities only when they had no other change

- **Decision**: the drop removes the entry, then commits `PRIORITIES.md` alone, as "Add and commit"
  does: when the file had uncommitted changes before, or a hook refuses the commit, the removal
  stays written, uncommitted, for the commit bar. An item no entry links is dropped without a
  commit.
- **Rationale**: the human's uncommitted edits to the priorities are work in progress, never
  committed by a tool on its own (`add_alone`'s rule); refusing the drop for them would block it
  over an unrelated edit.
- **Alternatives considered**: refusing the drop while the priorities have changes: blocks it for an
  edit that does not touch the entry; committing the whole file: commits the human's edits.
- **If wrong**: the drop's commit step, in `remove_entry` of `actions/drop.rs`.
- **Where**: task 2, `crates/core/src/actions/drop.rs`.

## R3: An item saved with a colour and no name leaves the list on read

- **Decision**: `repositories.json` is read with an item's `color` ignored, and an item left with no
  name is dropped as the file is read, so the next write of the list removes both.
- **Rationale**: [data-model.md](data-model.md) says a colour is "ignored once read, dropped at the
  next write". An item that only held a colour holds nothing once its colour is ignored; keeping it
  would write an empty `{}` entry for it forever. Task 3,
  [`repositories.rs`](/crates/core/src/repositories.rs) `load`.
- **Alternatives considered**: keeping such items as empty entries, which `set_item` already refuses
  to write for an item without a name.
- **If wrong**: an empty entry has no meaning to any reader; undo by removing the `retain` in
  `load`.
- **Where**: task 3.

## R4: The colour cases of the item settings tests change into name-only cases

- **Decision**: the human asked for colours to go (spec, US1 more 3), so the tests that checked a
  colour change, each keeping its name case:
  - `crates/core/tests/repositories.rs`: `a_name_and_a_colour_are_kept_by_folder` becomes
    `a_name_is_kept_by_folder`, the stored JSON holding the label alone; `an_empty_name_removes_it`
    loses its step that set an empty name with a colour kept, since an empty name now always removes
    the item.
  - `packages/binding/repositories.test.ts`: "an item's name and colour are read back with its
    repository" becomes "an item's name is read back with its repository".
  - `packages/server/src/__tests__/repositories.test.ts`: `item.settings` is sent and read back with
    a label alone.
  - `packages/web/src/__tests__/feature-settings.test.tsx`: "a name and a colour rename the card"
    becomes "a name renames the card", and checks the dialog has no "Colour" radio list instead of
    picking "Purple".
- **Rationale**: no colour is left to set or read; the name and per-repository cases still hold. The
  new core test "a colour saved before is ignored and dropped" covers a colour already on disk.
- **Alternatives considered**: deleting the tests whole, which would drop the name cases they also
  check.
- **If wrong**: colours come back with their field, enum, and these tests from git history.
- **Where**: task 3.

## R5: "A feature has one session" is replaced, and the get-or-create is one transaction

- **Decision**: The cache test "a feature has one session" is replaced by "a folder holds several
  sessions, latest first", since US5 gives a change or a feature several sessions. With the unique
  index gone, `Sessions.featureSession` no longer catches a unique-index race: it reads the latest
  session and creates one when there is none in one `BEGIN IMMEDIATE` transaction.
- **Rationale**: The old test pins the index the spec removes. Without the index, two servers
  creating a feature's first session at once would make two; a write transaction taken before the
  read serializes them, as `claimSession` does.
- **Alternatives considered**: Keeping the catch: nothing throws anymore, so it would never run.
- **If wrong**: Two first sessions of one folder; `latestSession` still picks one. Undo by reverting
  `featureSession` in `runner/sessions.ts`.
- **Where**: Task 4, `packages/server/src/runner/__tests__/cache.test.ts`,
  `packages/server/src/runner/sessions.ts`.
