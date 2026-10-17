---
kind: feature
finished: 2026-10-17
pull-request: https://github.com/mrtolkien/uraeda/pull/29
---

# Record: Storybook's full interface in Uraeda

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-17, finished on
> 2026-10-17, in [its pull request](https://github.com/mrtolkien/uraeda/pull/29). Its full files are
> in git: `git log -- specs/2026-10-17-access-storybook/`.

## What and why

Uraeda's Storybook page framed Storybook's full interface for a checkout, its sidebar, canvas,
controls, and panels, but rendered no story: since 10.6.2, Storybook pins its messages to an origin
that Uraeda's sandboxed frame lacks. The human wanted "all of storybooks features when we need to",
and asked whether basic security made it simpler. It did: basic security's frame secret removes the
threat Storybook's origin check guards against, so one Storybook setting fixes the page.

## Behaviour

- The Storybook page, reached from a feature's page, a session, or an embed's "Open in Storybook",
  renders Storybook's interface as on its own screen: picking stories, changing their controls, and
  an agent's edits arriving without a reload. A sign-out restarts it under the new frame secret.
- Every project Uraeda previews through the skill's helper gets a working page at its next Storybook
  start, with no change of its own: under `URAEDA_PREVIEW_BASE`, the helper turns on
  `security.insecureIframeMessaging`, keeping the project's other `security` keys, and turning it on
  even if the project turned it off. Without the variable, the config is returned unchanged, so
  `storybook dev` on its own port keeps Storybook's origin checks and its refusal to be framed.
- File writes stay off through Uraeda: saving a story from its controls shows "Failed to save
  story", creating a story and the "+" search find nothing, and opening a file in an editor does
  nothing, since the proxy still sends every channel connection as a preview's.
- Unchanged: embeds; stories in the interface follow the system's colour mode, as on Storybook's own
  screen; Interactions' step-by-step debugger reads "not available on composed Storybooks", its
  steps still shown; the page's starting, failed, and missing-story states; Storybook's own narrow
  layout at a phone's width.
- A story's code can make the interface show another story or change its controls, nothing more:
  only Uraeda's pages, which hold the preview path's secret, and the stories they run reach it.

## Design

The fix is one setting in the one place that adapts every project's Storybook to Uraeda, the skill's
helper. It returns `security` as a preset function, as it already did for `managerHead` and
`previewHead`, since Storybook reads `security` through `presets.apply`: a function sees the earlier
presets' value, and calls a project's own preset function, where a plain object would replace them.
Nothing else moved: the page's frame stays sandboxed without `allow-same-origin`, and the proxy
keeps its headers and its channel rule, which became a rule of the stack decision.

- [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js): `uraedaPreview`'s
  `security`, its header saying what the setting allows, and its tests,
  [`storybook-preview.test.ts`](/packages/web/src/__tests__/storybook-preview.test.ts).
- [`proxy.ts`](/packages/server/src/preview/proxy.ts): `upstreamSearch`, unchanged, now linking the
  stack decision's rule.
- [`validate-storybook.ts`](/packages/web/scripts/validate-storybook.ts), run by hand: after its
  embed checks, it opens Storybook's interface through Uraeda in WebKit, served under the proxy's
  `sandbox` header, and checks the canvas and controls, picking a story, a control, an export added
  to a stories file, and a 402 px width. The canvas alone is no proof: the story frame renders the
  story of its own address even when the interface's messages are dropped, so the check also waits
  for the controls panel, which fills only through them.

## Questions

### Round 01

#### Q1: How should the Storybook page render stories?

**Answer:** A: turn on `insecureIframeMessaging` only when Uraeda serves the Storybook, and keep
every frame sandboxed, over a second origin for previews, dropping the sandbox, or a list-only page.

#### Q1.A: Where is the setting turned on?

**Answer:** A: in the skill's helper, only when Uraeda serves the Storybook, so every project's page
works, rather than in Uraeda's own `main.ts` only.

#### Q2: Can you save stories and create them from Storybook's interface?

**Answer:** A: keep them off. The interface reads and plays stories, and file changes go through the
agent, since Uraeda cannot tell the interface's channel from a story's code, which could otherwise
write story files and open an editor on the host.

## Decisions

- [Stack](../decisions/stack.md): the proxy forwards Storybook's channel only as a preview's, so no
  frame can save, create, or open files through Storybook; its consequences say what Storybook's
  interface can and cannot do through Uraeda.

## Changes after approval

- The helper sets the key whatever the Storybook version: Storybook 10.6.1 was checked to ignore it,
  so the spec's fallback, setting it only on 10.6.2 and later, was not needed.

## Follow-ups

- The helper's tests pin neither that `security` forwards Storybook's options to a project's preset
  function, nor a head preset returning nothing.
- The validation script opens Storybook's interface top-level through the proxy, not inside Uraeda's
  `/f/<folder>/storybook` page: a regression only in the page's frame would not show.
- The validation script's failure for an added export prints `got false` whether the export was
  never listed or the page reloaded.
- The approval step removes a decision's applied proposed change, which leaves the spec's link to
  its anchor dead: the approval reference should say to repoint it.
