# Rulings: Redesign session

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Archived chats do not notify

- **Decision**: a chat blocked by auto mode, and archived, has no row in the list of what needs you.
- **Rationale**: archiving puts a chat away, and the sidebar hides it under "Archived". The spec
  says a blocked chat notifies and is silent on archived ones.
- **Alternatives considered**: listing them too, so the status alone decides. A chat the human put
  away would then alert them.
- **If wrong**: drop the archived filter in `chatStatuses`: one line.
- **Where**: task 3 of the plan.

## R2: The window slides by one when a message arrives

- **Decision**: the tail is the latest `shown` messages. A new message at the end moves the window
  by one, and a reply growing changes nothing.
- **Rationale**: the count is what the history entry keeps, so Back and a reload draw the same
  number. A window pinned to its first message would need a second value in the entry.
- **Alternatives considered**: pinning the start while the page is open. It keeps every message in
  place when one arrives, at the cost of a start position to restore.
- **If wrong**: keep the first shown message's turn and sequence beside the count in the entry.
- **Where**: task 4 of the plan.

## R3: The CLI's several rules were checked by hand, not in a test

- **Decision**: that `claude --allowedTools` takes several rules as separate arguments was checked
  on 2026-10-19 by running it, as the spec says. The tests assert the arguments the server builds,
  not the CLI's behaviour.
- **Rationale**: the tests must not need the user's installed `claude` and its account.
- **Alternatives considered**: a test through the real binary, skipped without it.
- **If wrong**: `validate:claude` (`packages/server/scripts/validate-claude.ts`) is the script that
  runs the real binary: a later version that refuses several rules shows there, and the work stops
  for a new round, as the spec says.
- **Where**: task 2 of the plan.
