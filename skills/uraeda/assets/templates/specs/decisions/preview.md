---
status: proposed
approved-by:
preview-folder: [the folder Storybook runs in, from the repository's top level, or .]
preview-command: [the command that starts it, with {port} and --host 127.0.0.1]
---

# Preview

[Mockups of planned UI, and the named states of the project's views, are Storybook stories. Uraeda
runs this Storybook for a feature's worktree, under its own address, and shows a story live where a
spec, a question, or an agent's message links it alone in its paragraph. For a project that declines
a preview: say it has none, leave out both preview fields, and give a date in Revisit when. Its
mockups stay HTML.]

## Rules

- The preview MUST be [the project's Storybook, in `<folder>`, or a mockups Storybook in
  `storybook/`], run by `[command]`. This decision's frontmatter MUST hold them as `preview-folder`
  and `preview-command`. Checked by `ura check`.
- Storybook MUST use its Vite builder. Checked by `uraeda-preview.js`, which stops a webpack
  Storybook with "uraeda-preview.js needs Storybook's Vite builder."
- [Mockups and named states MUST be stories, in `<Component>.stories.<ext>` files next to their
  component, one export per state or variant. For a mockups Storybook: in the feature's or the
  change's `mockups/*.stories.tsx`, read through `specs/*/mockups/*.stories.tsx` and
  `specs/changes/*/mockups/*.stories.tsx`, written in React with Astryx.] Checked by review.
- Storybook's `main.ts` MUST be wrapped by `uraeda-preview.js`, and its preview MUST load
  `uraeda-pick.js`, both copied unchanged from the Uraeda skill's `assets/storybook/`. Checked by
  review.
- Storybook's packages MUST be pinned to exact versions, upgraded together, and its telemetry MUST
  be off. Checked by review.
- [Optional: where stories get their data, and how a story reads it through Uraeda, which forwards
  only GET and HEAD requests and WebSocket upgrades.]

## Why

[Why the human wants planned UI live in the spec, and why this Storybook: the stack's own, or a
mockups Storybook when Storybook does not support the stack.]

## Alternatives considered

- [Optional: HTML mockups in each feature's `mockups/` folder, when declining was a close call]

## Consequences

- Storybook adds development dependencies, and a release to follow every few months.
- Each worktree pays Storybook's cold start, a few seconds, the first time one of its stories is
  shown.
- Until Uraeda has basic security, any website open in the browser can read a running preview.

## Applies to

- [The UI's folder, `.storybook/`, and any feature with UI work]

## Revisit when

[Optional: for a project that declines a preview, the date to ask again.]
