---
status: active
approved-by: mrtolkien
preview-folder: packages/web
preview-command: pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}
---

# Preview

Uraeda's UI states and the mockups of its planned UI are Storybook stories, written with its real
components next to them in `packages/web/src`. Uraeda's own web UI runs this Storybook for a
feature's worktree, serves it under its own address, and embeds its stories, live, in specs,
questions, and sessions. The stories get their data from Uraeda's real server, run inside Storybook
over a fresh copy of the fixture repository with the fake agent, so a story shows what the app
shows.

## Rules

- Uraeda's preview MUST be the Storybook of `packages/web`, run there by
  `pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}`. This
  decision's frontmatter MUST hold them as `preview-folder: packages/web` and that
  `preview-command`. Checked by `ura check`.
- Mockups of Uraeda's planned UI and named states of its views MUST be Storybook stories, in a
  `<Component>.stories.tsx` file next to the component in `packages/web/src`, one export per state
  or variant. Checked by review.
- Storybook's dev server MUST run Uraeda's server over a fresh copy of
  [`fixtures/repo`](/fixtures/repo/), on the fake agent, with `URA_TODAY` set to `2026-10-16` and
  fixed commit dates, so stories get their data only from the server, through fate. Stories MUST NOT
  fake the server's responses. Checked by review.
- Storybook's `main.ts` MUST be wrapped by the skill's `uraeda-preview.js`, imported from
  [`skills/uraeda/assets/storybook/`](/skills/uraeda/assets/storybook/), so Uraeda can serve it
  under its own address. Checked by the validation script.
- Storybook's preview MUST wrap every story in Uraeda's theme, with its colour mode from the
  embedding page, and MUST load the skill's pick script, `uraeda-pick.js`. Checked by review.
- Stories MUST follow the [UI components](ui-components.md) decision: its lint rules cover
  `*.stories.tsx` files. Checked by lint.
- Storybook's automatic test of each story MUST be off, and no story MAY run as a test: UI tests are
  Vitest tests, as the [UI checks](ui-checks.md) decision requires. Checked by review.
- `vp run ready` MUST build Storybook, so a story that does not compile fails the check. Checked by
  the `storybook:build` task.
- Storybook's packages MUST be pinned to exact versions, upgraded deliberately and together, and its
  telemetry MUST be off. Checked by review.

## Why

You asked for "REAL, INTERACTIVE MOCKUPS that PROPERLY show how the feature will BEHAVE", inside the
spec, and chose Storybook for Uraeda ([Q1, Q1.A, Q6](../done/2026-10-15-ui-iteration.md),
[round 02](../done/2026-10-15-ui-iteration.md)). A mockup written with the real components is the
code that ships, which removes the drift between mockups and code that every product studied suffers
from ([pitfalls](../done/2026-10-15-ui-iteration.md)). Storybook 10.6 runs on this repository's
Vite+, React Compiler, StyleX, and WebKit, and Astryx develops its own components in it
([Storybook 10](../done/2026-10-15-ui-iteration.md)). Running the real server inside Storybook keeps
the [stack](stack.md) decision's "data only from the server, through fate" true, where faked
responses would hand-write the server's output.

## Alternatives considered

- A `vp run preview` task serving the whole app over fixtures, without a workbench: no new
  dependency, but pages only, and no place for variants (round 01's Q6 option A).
- Stories fed by fate caches dehydrated from snapshots: works in a static build, but needs a
  snapshot step for every state.

## Consequences

- Planned UI starts as real code: the picked variant is the implementation's first commit of that
  view.
- Storybook adds about 170 packages and 100 MB of development dependencies, with its own Babel 7,
  and a minor release every six to eight weeks to follow.
- Each worktree pays Storybook's cold start, a few seconds, the first time one of its stories is
  embedded.
- Running one story from Storybook's own screen is broken with Vitest 5 until Storybook 11, which
  does not affect embeds.
- UI tests stay in Vitest: the [UI checks](ui-checks.md) decision dropped moving them to Storybook's
  test format.

## Applies to

- [`packages/web/`](/packages/web/), its Storybook configuration, and every feature with UI work
