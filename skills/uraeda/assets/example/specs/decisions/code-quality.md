---
status: active
approved-by: mrtolkien
---

# Code quality

Size and nesting limits hold the app's TypeScript code, in ESLint, which `npm run lint` runs. Code
that already broke a limit when the project was set up is marked in place, with its reason. The lint
fails on a new violation, and on a marker left behind once its code is fixed, so the numbers can
only go down.

## Rules

- Functions MUST NOT be longer than 80 lines. Checked by ESLint's `max-lines-per-function`.
- Functions MUST NOT take more than 4 parameters. Checked by ESLint's `max-params`.
- Code MUST NOT nest blocks more than 3 levels deep inside a function. Checked by ESLint's
  `max-depth`.
- Source files MUST NOT be longer than 400 lines. Tests are exempt. Checked by ESLint's `max-lines`.
- Code that broke a limit when this decision was approved MUST be marked where it stands, with an
  `// eslint-disable-next-line <rule> -- <reason>` comment. A marker on code that no longer breaks
  its limit MUST fail the lint. Checked by ESLint's `reportUnusedDisableDirectives: "error"`.
- A new marker MUST NOT be added unless a human approves it as a constitution exception in the
  plan's complexity tracking. Checked by review.

## Why

Set up with the project, as Uraeda proposes: agents extend the code they find, and only a check that
fails stops functions and files from growing feature after feature. The limits are where today's
code mostly fits: only `updateTask`, in [the task store](/src/store/tasks.ts), was over them.

## Consequences

- A feature touching a marked function splits it first, in a commit that only restructures it, then
  removes its marker.
- Duplication is checked by review only.

## Applies to

- [`src/`](/src/), [`eslint.config.js`](/eslint.config.js), and every feature that adds or changes
  code
