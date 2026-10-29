---
status: proposed
approved-by:
icon: eye
preview-folder: packages/web
preview-command: pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}
---

# Preview

Uraeda's planned UI and the states of its views are Storybook stories, written with the real
components, so a mockup is the code that ships. Storybook is a tool that shows components alone, in
named states. Uraeda embeds the stories live in specs, questions, and sessions, fed by its real
server, so a story shows what the app shows.

## Rules

- Uraeda's preview MUST be the Storybook of `packages/web`, run by the command this decision's
  `preview-folder` and `preview-command` fields hold. Checked by `ura check`.
- A spec's mockups, and the named states of views, MUST be stories written with the real components,
  next to them. Checked by review and lint.
- Storybook MUST run Uraeda's real server over fixture data, never faking its responses. Checked by
  review.
- Stories MUST NOT run as tests: the rare UI tests run elsewhere, as [Testing](testing.md) says.
  Checked by review.
- The full check, `vp run ready`, MUST build Storybook, so a story that does not compile fails it.
  Checked by the `storybook:build` task.
- Storybook's packages MUST be pinned to exact versions. Checked by review.
- A page's layout, or a sketch no component holds yet, MAY be an HTML page in the feature's
  `mockups/` folder, linked from its story. Checked by review.
- An investigation MAY compare throwaway prototypes in any format, which the spec's approval
  deletes. Checked by review.

## Why

Real, interactive mockups inside the spec remove the drift between mockups and code. Storybook runs
on this repository's tools, and Astryx, the UI's design system, builds its own components in it.
Comparing several looks with the real components is slow, so an investigation may use throwaway
prototypes. Running the real server keeps [Stack](stack.md)'s rule that data comes only from the
server. History: [UI iteration](../done/2026-10-15-ui-iteration.md).

## Alternatives considered

- A task serving the whole app over fixtures: no new dependency, but pages only, and no place for
  variants.
- Stories fed by cached data from snapshots: works in a static build, but needs a snapshot per
  state.

## Consequences

- Planned UI starts as real code: the picked variant is the first commit of its view.
- An investigation can compare several looks cheaply, and git keeps its prototypes once deleted.
- Storybook adds many development dependencies, and frequent releases to follow.

## Applies to

- [`packages/web/`](/packages/web/), its Storybook configuration, and every feature with UI work
