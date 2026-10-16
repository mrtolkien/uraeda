---
status: active
approved-by: mrtolkien
icon: eye
preview-folder: .
preview-command: npx storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}
---

# Preview

Mockups of planned UI, and the named states of the app's views, are Storybook stories, written with
the real components. Uraeda runs this Storybook for a feature's worktree, and shows its stories live
where a spec, a question, or a session links them. The picked mockup is the code that ships.

## Rules

- The preview MUST be the app's Storybook, at the repository's top level, run by
  `npx storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}`. This decision's
  frontmatter MUST hold them as `preview-folder: .` and that `preview-command`. Checked by
  `ura check`.
- Storybook MUST use its Vite builder, through `@storybook/react-vite`. Checked by Uraeda's helper,
  which stops a webpack Storybook.
- Mockups and named states MUST be stories, in `*.stories.tsx` files under `src/`, one export per
  state or variant. Checked by review.
- Stories MUST get their tasks from the app's own store, on an in-memory IndexedDB the story fills,
  as the integration tests do. Checked by review.
- Storybook's `main.ts` MUST be wrapped by `.storybook/uraeda-preview.js`, and its preview MUST load
  `.storybook/uraeda-pick.js`, both copied unchanged from the Uraeda skill's `assets/storybook/`.
  Checked by review.
- Storybook's packages MUST be pinned to exact versions, upgraded together, and its telemetry MUST
  be off. Checked by review of `package.json` and `main.ts`.

## Why

Set up with the project, as Uraeda proposes for a project with a UI: the human checks a planned view
by using it, at a phone's width and a desktop's, and comments on what is wrong. A mockup written
with the real components is the code that ships, so the spec's mockups and the app cannot drift
apart. The app already builds with Vite, Storybook's default builder for React.

## Alternatives considered

- HTML mockups in the feature's `mockups/` folder: no dependency, but a second copy of the UI, which
  drifts from the code.

## Consequences

- A view's first task starts from its picked story, and its stories stay as the view's states.
- Storybook adds about 100 MB of development dependencies, and a release to follow every few months.
- Each worktree pays Storybook's cold start, a few seconds, the first time one of its stories is
  shown.
- Until Uraeda has basic security, any website open in the browser can read a running preview.

## Applies to

- [Components](/src/components/), [the task screens](/src/tasks/), `.storybook/`, and any feature
  with UI work
