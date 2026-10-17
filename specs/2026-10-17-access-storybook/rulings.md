# Rulings: Storybook's full interface in Uraeda

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The helper returns `security` as a preset function

- **Decision**: under `URAEDA_PREVIEW_BASE`, `uraedaPreview` returns `security` as a function of the
  earlier presets' value, resolving to the project's own `security` with
  `insecureIframeMessaging: true` written last, rather than a plain object.
- **Rationale**: Storybook reads `security` with `presets.apply("security")`, and its `applyPresets`
  calls a function preset with the accumulated value, but lets any other value replace it
  (`storybook/dist/_node-chunks/chunk-XYQ3GU6K.js`, line 13307). A function keeps the earlier
  presets' keys and a project's own preset function, the same way the helper already wraps
  `managerHead` and `previewHead`. Writing the key last keeps it on even if a project turned it off,
  since the page renders nothing without it.
- **Alternatives considered**: a plain object merged with the project's object: simpler to read, but
  it drops what earlier presets set, and cannot merge a project's preset function, which only
  Storybook can call.
- **If wrong**: a project's `security` loses a key under Uraeda only; the helper's test rows show
  which.
- **Where**: task 2, `skills/uraeda/assets/storybook/uraeda-preview.js`.

## R2: The spec's link to the applied decision change points at the rules

- **Decision**: the approval step applied the stack decision's proposed change and removed its
  section, so the spec's link to `stack.md#proposed-change-2026-10-17-access-storybook` was
  repointed to `stack.md#rules`, in the plan's commit.
- **Rationale**: `ura check` reported the dead anchor; the approved spec's meaning is unchanged.
  [Approval](/skills/uraeda/references/approval.md) does not say what happens to such a link: noted
  in the inbox.
- **Alternatives considered**: leaving the dead link: `ura check` would fail on the folder until the
  finish step replaces it with its record.
- **If wrong**: a one-link edit to undo.
- **Where**: `spec.md`, **Decisions**.

## R3: The helper sets the key whatever the Storybook version

- **Decision**: `uraedaPreview` sets `security.insecureIframeMessaging` on every Storybook it
  serves, without reading Storybook's version.
- **Rationale**: the spec left unverified that an older Storybook ignores the key. Checked on
  2026-10-17, in an empty folder outside the repository: `storybook@10.6.1` and
  `@storybook/react-vite@10.6.1`, with Vite 7, one story, and
  `security: { insecureIframeMessaging: true }` in `.storybook/main.ts`.
  `storybook dev --ci --smoke-test` printed "Smoke tests passed, exiting.", and `storybook dev`
  served the story in `index.json` with no error or warning in its log. Neither `storybook` nor
  `@storybook/builder-vite` 10.6.1 mentions the key in its `dist/`: it is ignored.
- **Alternatives considered**: setting it only on 10.6.2 and later, the spec's fallback: it needs
  the helper to read Storybook's version, for no gain.
- **If wrong**: an older Storybook would fail to start under Uraeda only, with Storybook's own error
  naming the key.
- **Where**: task 1.
