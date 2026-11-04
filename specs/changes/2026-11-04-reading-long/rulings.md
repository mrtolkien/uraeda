# Rulings: The composer after the messages

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: Every session's composer, at every width

- **Decision**: the composer comes after the transcript on the session's page at every width, the
  phone included, and in a round's Session column.
- **Rationale**: the proposal says "always". The phone has the least room of all, and its composer
  floated over the transcript there too.
- **If wrong**: the phone or the column could keep the floating composer with one style each in
  [`SessionView.tsx`](/packages/web/src/SessionView.tsx).
- **Where**: [`SessionView.tsx`](/packages/web/src/SessionView.tsx)

## R2: A short session keeps its composer at the window's foot

- **Decision**: while the messages do not fill the window, the composer stays at the window's foot,
  as before, rather than right under the last message.
- **Rationale**: [Space and motion](/specs/ui/space-and-motion.md) asks that the buttons that send
  stay put. Under the last message, Send would move down with every message until the window fills.
  Once the messages fill the window, the composer is after them, as the proposal asks.
- **Where**: [`SessionView.tsx`](/packages/web/src/SessionView.tsx)

## R3: "Jump to the latest" stays at the window's foot

- **Decision**: the arrow keeps floating at the window's foot while the human reads above the end,
  in an anchor of its own that takes no room. At the end, it sits over the composer's top, as
  before.
- **Rationale**: it was drawn over the composer, which no longer shows while the human reads above
  the end.
- **Where**: [`SessionView.tsx`](/packages/web/src/SessionView.tsx),
  [`JumpToLatest.tsx`](/packages/web/src/JumpToLatest.tsx)

## R4: The page keeps its end as the composer draws

- **Decision**: when the composer grows, as its editor loads after the page opened at its end, or as
  it unfolds on the phone, the page moves to its end again if it was at the end before.
- **Rationale**: the composer's editor draws after the page moves to its end, about 190 px later on
  a wide screen. The page then opened 190 px short of its end, which the sticky composer hid, and
  which now cut the composer in half.
- **Where**: `useKeepsEndAsItGrows` in [`following.ts`](/packages/web/src/following.ts)

## R5: Writing a message brings the composer into view

- **Decision**: `i`, and asking the agent from a round's page, bring the composer into view, above
  the status line, as they focus it. "Jump to the latest" still goes to the start of the agent's
  last reply.
- **Rationale**: without it, `i` focused a composer out of view, and the human typed in a field they
  could not see.
- **Where**: [`Composer.tsx`](/packages/web/src/Composer.tsx),
  [`ColumnSession.tsx`](/packages/web/src/ColumnSession.tsx)

## R6: No new test

- **Decision**: the change adds no test.
- **Rationale**: the [testing](/specs/decisions/testing.md) decision, at the `early` stage, tests
  the web UI only for what using it would not show. Where the composer sits shows at once, and jsdom
  lays nothing out, so a test could only read the markup. It was reviewed in the sandbox, at a
  phone's and a desktop's width, in both themes.
