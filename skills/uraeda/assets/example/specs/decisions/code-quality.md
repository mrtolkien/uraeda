---
icon: ruler
---

# Code quality

> "I don't read the code, so the checks have to hold it."

Size and nesting limits live in ESLint's configuration, which `npm run lint` runs.

## Rules

- Functions and files stay within the limits the linter holds. _So:_ a task that would push a
  function past its limit splits it first, in a commit of its own.
- An exception is marked where the code stands, with its reason, and a new one needs the human's
  approval in the plan. _So:_ no `eslint-disable` is added to get a task through.
- The numbers only go down. _So:_ a marker left on code that was fixed fails the lint.

## Why

Agents extend the code they find, and only a check that fails stops functions and files from growing
feature after feature. The limits are where today's code mostly fits: only `updateTask`, in
[the task store](/src/store/tasks.ts), was over them.

## Applies to

- [`src/`](/src/), [`eslint.config.js`](/eslint.config.js), and every feature that adds or changes
  code
