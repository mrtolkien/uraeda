# Rulings: Recurring tasks

What the build settled that the human must see: a behaviour users will notice that
[the spec](spec.md) does not state, a departure from the spec, [the plan](plan.md), a mockup, or a
decision the human allowed, and a test removed outside the spec's list. Other choices are explained
in the bodies of the commits that make them. None binds future work: those are decisions.

## R1: The custom screen lists days from Monday

- **Decision**: the seven day toggles start on Monday, so "every 2 weeks on Sunday and Monday" never
  shows its two days in two different weeks.
- **Rationale**: the plan counts weeks from Monday (task 1's `weekStart`), and nothing else in the
  app follows the browser's locale yet.
- **Where**: task 4, `src/components/RepeatScreen.tsx`.

## R2: A repeat phrase needs a space before it

- **Decision**: a title ending in "every day" glued to a word, like "Gymevery day", stays as typed
  and makes no repeat.
- **Rationale**: the plan's table only has phrases after a space, and such a title is more likely a
  typo than a rule.
- **Where**: task 5, `src/lib/repeat.ts`.
