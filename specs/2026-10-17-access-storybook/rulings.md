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

## R4: The interface's first check also needs the story's controls

- **Decision**: the validation script's check that the Storybook page's canvas shows the `Ready`
  story also waits for the controls panel to list its `folder` and `story` args.
- **Rationale**: with the setting removed, the canvas check alone passed: the story frame renders
  the story named in its own address, `iframe.html?id=...`, without any message from the interface,
  and Playwright finds its text under Storybook's loading overlay. The controls panel fills only
  from the story frame's messages. With them in the check, removing the setting fails it, as task
  3's step 3 shows.
- **Alternatives considered**: checking that Storybook's loading overlay is gone: it ties the script
  to a selector of Storybook's markup, where the controls are what the human uses.
- **If wrong**: the script misses a blank canvas; step 3 of task 3 is how to see it.
- **Where**: task 3, `packages/web/scripts/validate-storybook.ts`, `listsControls`.

## R5: Storybook's narrow layout works through Uraeda

- **Decision**: no follow-up for a phone's width.
- **Rationale**: at 402 × 874 in WebKit, Storybook's interface shows its narrow layout through
  Uraeda: the toolbar on top, the story in the canvas, and the sidebar and panel behind the bottom
  bar, "StoryEmbed/Ready". The spec's assumptions asked for a follow-up only if it broke.
- **Alternatives considered**: none.
- **If wrong**: a follow-up feature on Storybook's mobile layout.
- **Where**: task 3, `checkPhone`.
