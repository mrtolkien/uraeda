# Rulings: Recurring tasks

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Fake timers advance during user events

- **Decision**: `renderApp` creates its `user` with
  `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
- **Rationale**: with `vi.useFakeTimers`, `user-event` waits on timers that never fire, and every
  click hangs. Its documentation describes this option for fake timers
  ([user-event options](https://testing-library.com/docs/user-event/options#advancetimers)).
- **Alternatives considered**: real timers with a short confirmation delay in tests: rejected, since
  the 5-second timing is a global constraint the tests must assert.
- **If wrong**: tests stay correct but slow; remove the option and the tests show it at once.
- **Where**: task 1, `tests/helpers/app.tsx`.

## R2: The custom screen lists days from Monday

- **Decision**: the seven day toggles start on Monday, matching `weekStart`.
- **Rationale**: the plan counts weeks from Monday (task 1's `weekStart`); a screen starting on
  Sunday would show "every 2 weeks on Sunday and Monday" across two of its weeks.
- **Alternatives considered**: following the browser's locale: rejected for now, since nothing else
  in the app follows it.
- **If wrong**: a display change only, in `RepeatScreen.tsx`.
- **Where**: task 4, `src/components/RepeatScreen.tsx`.

## R3: A repeat phrase needs a space before it

- **Decision**: `parseRepeat` only reads a phrase separated from the rest of the title by a space:
  "Gymevery day" stays as typed.
- **Rationale**: the plan's table only has phrases after a space, and a title ending in "...every
  day" glued to a word is more likely a typo than a rule.
- **Alternatives considered**: a word boundary instead of a space: same result for the table's
  phrases, harder to read in the regular expression.
- **If wrong**: one character in the regular expression, with a row added to the table-driven test.
- **Where**: task 5, `src/lib/repeat.ts`.
