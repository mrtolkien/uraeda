---
status: proposed
approved-by:
icon: eye
preview-folder: packages/web
preview-command: pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}
---

# Preview

Uraeda's planned UI and the states of its views are Storybook stories. They are written with the
real components, so a mockup is the code that ships. Uraeda embeds them live in specs, questions,
and sessions, fed by its real server, so a story shows what the app shows. A layout or freeform
mockup may be an HTML page instead.

## Rules

- Uraeda's preview MUST be the Storybook of `packages/web`, run by the command this decision's
  `preview-folder` and `preview-command` fields hold. Checked by `ura check`.
- A spec's mockups and named states of views MUST be stories written with the real components, next
  to them. Checked by review and lint.
- Storybook MUST run Uraeda's real server over fixture data, and stories MUST NOT fake its
  responses. Checked by review.
- Stories MUST NOT run as tests: the rare UI tests are not run through Storybook, per the
  [testing](testing.md) decision. Checked by review.
- `vp run ready` MUST build Storybook, so a story that does not compile fails. Checked by the
  `storybook:build` task.
- Storybook's packages MUST be pinned to exact versions. Checked by review.
- A layout or freeform mockup MAY be an HTML page in the feature's or the change's `mockups/` folder
  instead, linked from its story: a page's layout, or a sketch no component holds yet. Checked by
  review.
- An investigation MAY compare throwaway prototypes in any format, in its feature's `mockups`
  folder, and the approval of its spec deletes them. Checked by review.

## Why

The human asked for real, interactive mockups inside the spec, and chose Storybook to run them
([what the feature covers](../done/2026-10-15-ui-iteration.md#q1-what-does-the-feature-cover-and-in-what-shape),
[Uraeda's preview environment](../done/2026-10-15-ui-iteration.md#q6-what-preview-environment-does-uraeda-itself-use)).
A mockup written with the real components removes the drift between mockups and code. Storybook runs
on this repository's Vite+, React Compiler, StyleX, and WebKit, and Astryx develops its own
components in it. Comparing several looks with the real components was too slow, so the human
allowed throwaway prototypes in an investigation
([prototypes in the workflow](../done/2026-10-20-layout-look.md#q6-should-prototypes-like-these-be-part-of-the-workflow)).
Running the real server keeps the [stack](stack.md) decision's data only from the server, through
fate.

## Alternatives considered

- A `vp run preview` task serving the whole app over fixtures: no new dependency, but pages only,
  and no place for variants.
- Stories fed by fate caches from snapshots: works in a static build, but needs a snapshot per
  state.

## Consequences

- Planned UI starts as real code: the picked variant is the first commit of its view.
- An investigation can compare several looks cheaply, and git keeps its prototypes once deleted.
- Storybook adds many development dependencies and frequent releases to follow.

## Applies to

- [`packages/web/`](/packages/web/), its Storybook configuration, and every feature with UI work
