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

## R6: The markdown-parser test allows the moved message components and the mockups

- **Decision**: `stack.test.ts` lets `TranscriptMessages.tsx` and `SessionMockups.stories.tsx`
  import Astryx's `Markdown`, as `Transcript.tsx` may.
- **Rationale**: the stack decision allows an agent's messages to render with `Markdown`. The
  mockups (already on the branch) fail the test, and task 4 moves the agent's message there.
- **Alternatives considered**: a mockup without `Markdown`, which would not show the real text.
- **If wrong**: narrow the list again once the mockups are removed.
- **Where**: the test, before task 4.

## R7: The tests that drew a whole turn or a long session now stay inside the tail

- **Decision**: four existing tests changed with the tail. `session-cost.test.tsx` still opens 30
  messages, and reads that at least `TAIL_MESSAGES` (20) drew, not 30: its subject is that typing
  redraws none. `session-turns.test.tsx` "250 items of a turn show in order" opens the session at
  `#turn-<id>` of that turn, which draws it whole (the tail alone draws only its latest 20
  messages). The WebKit test `session.test.tsx` "Back from a session view" writes 9 lines, the link,
  and 9 more, not 20, 1, and 20, and "a paragraph read across the line a third down" 3 lines, the
  paragraph, and 12 more, not 10, 1, and 30: the link and the paragraph must be among the latest 20
  messages to be drawn, and the scroll is their subject, not the count. The new tail test links a
  turn of 90 messages back, not 80, as its turns hold 15 messages, so that no count of 20 falls on a
  turn's start.
- **Rationale**: both tests asserted what a session draws, and the spec changes it: the latest 20
  messages, and an older turn when the address names it. What each guards is unchanged.
- **Alternatives considered**: loosening the assertions, which would drop the order of 250 items and
  the link's position.
- **If wrong**: restore the old seeds, and the tests fail on the count.
- **Where**: task 4 of the plan.

## R8: The tail keeps its start while the page is open, and grows as messages arrive

- **Decision**: the tail keeps the first piece it drew as its start, in memory, never in the history
  entry, which keeps `shown` alone: a message arriving draws after the pieces, so the count drawn
  grows past `shown` while the page stays open. A press of "Show earlier messages" releases the
  start and counts from what is drawn. A reload or Back draws the latest `shown` again.
  [R2](#r2-the-window-slides-by-one-when-a-message-arrives)'s slide is dropped.
- **Rationale**: the slide takes the oldest message from above the reader as one arrives. The
  existing WebKit test US4.2 ("scrolled up, the page keeps its position as lines arrive") failed
  with `expected 230 to be 510`, and the one that sends from the end ("idle at the end, send") lost
  its end: the browser's scroll anchoring, as the top shrank, read as a scroll away from it. Keeping
  the start moves nothing, at the end or above it, and drops the scroll tracking the first attempt
  needed.
- **Alternatives considered**: sliding at the end only, scrolling to the end after each slide: a
  correction per message that the follow logic would have to share.
- **If wrong**: a session left open for hours draws thousands of messages: slide again, and keep the
  end in view after each slide.
- **Where**: task 4 of the plan.

## R9: The list takes back its own 12 px, and the agent's bubble is 100% wide always

- **Decision**: `Transcript`'s list takes its inset back with a margin of minus `--spacing-3`, the
  12 px the compact `ChatMessageList` pads its messages with, not with `--page-bleed`. The agent's
  message is a `ghost` bubble with `width="100%"` and no padding whatever a story shows, so the
  "width switch" and `MessageStories.shown` are removed.
- **Rationale**: the mockup's `--page-bleed` is 8 px with `Page isSnug`, and 16 px without it, and
  the list's padding is 12 px either way: only a margin of that padding puts the reply at the page's
  inset, whichever page holds the list, and it does not wait for task 6. A bubble that is always as
  wide as the page leaves the switch no work: the story's two widths already have the room.
- **Alternatives considered**: `--page-bleed`, which leaves the reply 4 px in from the inset on a
  snug page and 4 px out on the default one. Keeping the switch as dead state.
- **If wrong**: restore `shown` in `AgentStories.tsx` and the switch in `AgentMessage`, and set the
  list's margin from `--page-bleed` once the padding and the inset agree.
- **Where**: task 5 of the plan.

## R10: One WebKit test seeds taller messages, as the agent's text is flat now

- **Decision**: `session.test.tsx` "opening the line moves the place read, which the next width
  keeps" seeds each of its 60 lines as two paragraphs, `Line N.` then `More.`, not as one.
- **Rationale**: the agent's text lost its bubble's padding, so the 20 messages of the tail made a
  page of 1317 px, not 1893: at 1440 px the page was too short to keep the line read where it was
  (it was 173 px off, the scroll clamped at the page's end). The test's subject is the place kept
  across the widths, not the page's height. Three paragraphs, the next size tried, were 6 px off.
- **Alternatives considered**: loosening the 2 px, which drops what the test guards.
- **If wrong**: restore the one-line seed, and the test fails on the short page.
- **Where**: task 5 of the plan.

## R11: The chat composer's WebKit test reads the field's rows by width class

- **Decision**: `fields.test.tsx`'s "the chat composer is 7 rows, grows upward to 20, and scrolls
  past them" expects 3 rows empty and 9 at most on the phone, and 7 and 20 on wide screens, as it
  did for both.
- **Rationale**: SC-005 and US2.3 give the phone a 3-row field that grows to 9 rows: the test failed
  with `expected 3 to be close to 7` at 402 px, as it should. What it guards is unchanged: the field
  grows upward, holds its text inside its edge, and scrolls past its last row. The new
  `session-look.test.tsx` measures the heights in pixels.
- **Alternatives considered**: leaving the phone at 7 rows, which breaks SC-005.
- **If wrong**: restore the single count, and the test fails on the phone.
- **Where**: task 6 of the plan.

## R12: The list reaches the screen's edges, and the senders give back the list's padding

- **Decision**: `Transcript`'s list takes the page's inset back with `--page-bleed`, not R9's margin
  of `--spacing-3`. The agent's bubble, and the human's right side, give back the difference between
  the list's own padding (`--spacing-3`) and the snug page's inset (`--spacing-2`).
- **Rationale**: R9's margin made the list 4 px wider than the screen on the 8 px page, which broke
  eleven WebKit layout tests (`expected 406 to be less than or equal to 403`). The padding sits on
  the list's inner box, which no `xstyle` reaches.
- **Alternatives considered**: removing the padding through the list's styles, which Astryx does not
  allow; a 12 px page inset, which is not what the spec says.
- **If wrong**: the two margins are tokens in `TranscriptMessages.tsx`: change them with the inset.
- **Where**: tasks 5 and 6, after the merge.

## R13: A markdown list's items are not rows a finger taps

- **Decision**: the theme gives the `markdown` component's `li` no minimum height under a coarse
  pointer, where the `item` rule gives every Astryx row 44 px.
- **Rationale**: Astryx draws a markdown list item as an `Item`, so on the phone each bullet sat in
  a 44 px row, its dot at the top and its text centred, 8 px apart (seen in the screenshots of task
  7). Nothing taps a list item, and the controls' 44 px is for what is pressed. The new
  `session-look.test.tsx` test failed with `expected 44 to be less than 36` before the rule.
- **Alternatives considered**: restricting the `item` rule to interactive rows, which Astryx's theme
  cannot select.
- **If wrong**: remove the `markdown` entry from `theme.ts` and rebuild the theme.
- **Where**: task 7 of the plan.

## R14: The rewritten decisions may hold 9,500 words, not 9,400

- **Decision**: `every_decision_of_the_repository_holds_at_most_10_rules` allows the 18 rewritten
  decisions 9,500 words together.
- **Rationale**: this feature's approved change to the notifications decision (a chat blocked by
  auto mode notifies, one rule and a reason) added 66 words, which took the total from the specs
  redesign's 9,400 to 9,466, and the test failed with `9466 words`. The 10-rule limit, which the
  test also checks, is untouched.
- **Alternatives considered**: cutting words from the human's approved decision, which only the
  human amends.
- **If wrong**: restore 9,400 and shorten the decisions the specs redesign rewrote.
- **Where**: task 7 of the plan.
