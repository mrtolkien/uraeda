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

## R4: A keystroke already redraws no message, so the page is left as it is

- **Decision**: the profile (`session-cost.test.tsx`) counts 0 agent messages redrawn per keystroke
  before any change: 30 messages draw once, and five keystrokes draw none. The typing lag is not the
  page's redraw of the transcript. The test stays as the guard, and `SessionPage.tsx` is not
  changed.
- **Rationale**: the plan's step 2 says to keep the test and write the finding when it passes. The
  test can fail: with `key={draft.text}` on `Transcript` it reads `expected 180 to be 30`, the 30
  messages redrawn at each of the five keystrokes.
- **Alternatives considered**: memoising `SessionLog` anyway, which would change code the profile
  does not blame.
- **If wrong**: the lag has another cause, in the composer's own field or the browser: profile
  there, in the WebKit tests.
- **Where**: task 1 of the plan.

## R5: The tests that asserted a string now assert a list, and "one after one allow" needs a re-block

- **Decision**: the assertions on `opens.at(-1)?.allowed` (both `sessions.test.ts` files, the web's
  `session-turns.test.tsx`) and on `claudeArgs`' `allowed` in `claude.test.ts` read a list now. A
  turn's stored `allowed` stays a string, and its assertions are unchanged. The `allowable` test
  reads 2, then 1, then 0 where the retry turn is blocked again on one action: an allow always
  begins a newer turn, so the earlier turn's remaining denial is not in the latest turn, and counts
  0, as the spec's "earlier turns are not covered" says. A stored rule that holds a line break,
  written by an earlier version, is not covered either.
- **Rationale**: `OpenOptions.allowed` changed type, which is the task's interface: the tests check
  what they checked, one rule, as a list of one. The plan's "1 after one `allow`" holds when that
  retry is blocked on the other action again.
- **Alternatives considered**: counting the earlier turn's denials after an allow, which widens
  "Allow all" to what the human did not just see.
- **If wrong**: `coveredDenials` is the one place that picks the covered denials.
- **Where**: task 2 of the plan.
