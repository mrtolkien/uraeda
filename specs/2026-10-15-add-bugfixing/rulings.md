# Rulings: Add a bugfixing/low impact change flow

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The slug proposed for "Centre the x in failure circles" is `centre-x`

- **Decision**: the composer's slug is proposed by the core's existing rule, `slug::short` of
  `slug::from_text`, which gives `centre-x` for that title. The spec's US1.1 names the slug
  `centred-x`: its tests type `centred-x` into the slug field where the scenario needs that folder,
  and the proposal's tests expect `centre-x`.
- **Rationale**: the spec says the core proposes the slug "as `ura start` does from a draft's name",
  so one rule serves both ([`slug.rs`](/crates/core/src/slug.rs)). `centred-x` was the scenario's
  example, not a rule.
- **Alternatives considered**: a new proposal rule for typed text, which would make two rules for
  one slug.
- **If wrong**: the human edits the slug field before starting, as the spec allows.
- **Where**: tasks 5, 7, and 9.

## R2: "New change" keeps its text in the unsaved store

- **Decision**: the composer's text on "New change" is kept with `useTextField("new-change", "")`,
  so it comes back after leaving the page; images stay in memory, as a chat's do.
- **Rationale**: the spec's edge case says the text "comes back when New change opens again", while
  saying "as a new chat's is". A new chat keeps its text in memory only today
  ([`useDraft.ts`](/packages/web/src/useDraft.ts)), so the concrete behaviour wins.
- **Alternatives considered**: memory only, like a new chat, which loses the request on a misclick.
- **If wrong**: drop the key, and the page forgets like a new chat.
- **Where**: task 9.

## R3: A change's first run is sent from the server's `change.start`

- **Decision**: `change.start` starts the change and sends its first run in one mutation, with the
  workflow message the server builds for the trigger `start`.
- **Rationale**: one press of "Start the change" starts both, and the server already owns the
  workflow message (`readWorkflowMessage`); the client needs no second round trip that could fail
  between the two.
- **Alternatives considered**: the client calling `session.send` after `change.start`, which leaves
  a started change without its run when the second call fails.
- **If wrong**: split the mutation, and send from the client.
- **Where**: task 7.

## R4: read_feature's helpers live in a module of workspace

- **Decision**: splitting `read_feature` under 80 lines moves its new helpers, `read_texts`,
  `read_record`, `folder_uncommitted`, and `source_of`, into
  [`workspace/read.rs`](/crates/core/src/workspace/read.rs); `read_feature` stays in `workspace.rs`.
- **Rationale**: kept in `workspace.rs`, the helpers' signatures and doc comments grow it from 1061
  to 1097 lines, past its `LARGE` entry of 1080, which may only shrink. Moved, it is 1011 lines.
- **Alternatives considered**: all of `read_feature` in the new module, which moves more code than
  the split needs; trimming unrelated code of `workspace.rs` to make room.
- **If wrong**: move the helpers back once `workspace.rs` has room.
- **Where**: task 1, and task 2's record kind check.
