---
status: active
approved-by: mrtolkien
icon: eye
preview-folder: packages/web
preview-command: pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}
---

# Preview

Uraeda's planned UI and the states of its views are Storybook stories. They are written with the
real components, so a mockup is the code that ships. Uraeda embeds them live in specs, questions,
and sessions, fed by its real server, so a story shows what the app shows.

## Rules

- Uraeda's preview MUST be the Storybook of `packages/web`, run by the command this decision's
  `preview-folder` and `preview-command` fields hold. Checked by `ura check`.
- Mockups and named states of views MUST be stories in a `<Component>.stories.tsx` file next to the
  component, one export per state or variant, following the [UI components](ui-components.md)
  decision. Checked by review and lint.
- Storybook MUST run Uraeda's server over a fresh copy of [`fixtures/repo`](/fixtures/repo/), with
  the fake agent and fixed dates, and stories MUST NOT fake the server's responses. Checked by
  review.
- Storybook's `main.ts` MUST be wrapped by the skill's `uraeda-preview.js`, and its preview MUST
  load `uraeda-pick.js` and wrap every story in Uraeda's theme, in the embedding page's colour mode.
  Checked by the validation script, and by review.
- Stories MUST NOT run as tests, and Storybook's automatic story tests MUST stay off: UI tests are
  Vitest tests, per the [UI checks](ui-checks.md) decision. Checked by review.
- `vp run ready` MUST build Storybook, so a story that does not compile fails. Checked by the
  `storybook:build` task.
- Storybook's packages MUST be pinned to exact versions and upgraded together, and its telemetry
  MUST be off. Checked by review.

## Why

The human asked for real, interactive mockups inside the spec, and chose Storybook to run them
([what the feature covers](../done/2026-10-15-ui-iteration.md#q1-what-does-the-feature-cover-and-in-what-shape),
[Uraeda's preview environment](../done/2026-10-15-ui-iteration.md#q6-what-preview-environment-does-uraeda-itself-use)).
A mockup written with the real components removes the drift between mockups and code. Storybook runs
on this repository's Vite+, React Compiler, StyleX, and WebKit, and Astryx develops its own
components in it. Running the real server keeps the [stack](stack.md) decision's data only from the
server, through fate.

## Alternatives considered

- A `vp run preview` task serving the whole app over fixtures: no new dependency, but pages only,
  and no place for variants.
- Stories fed by fate caches from snapshots: works in a static build, but needs a snapshot per
  state.

## Consequences

- Planned UI starts as real code: the picked variant is the first commit of its view.
- Storybook adds about 100 MB of development dependencies, with its own Babel, and frequent minor
  releases to follow.
- Each worktree pays Storybook's cold start, a few seconds, at its first embedded story.
- Running one story from Storybook's own screen is broken with Vitest 5 until Storybook 11, which
  does not affect embeds.

## Applies to

- [`packages/web/`](/packages/web/), its Storybook configuration, and every feature with UI work
