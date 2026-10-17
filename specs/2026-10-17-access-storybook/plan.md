---
status: auto-approved
spec-revision: 1
---

# Plan: Storybook's full interface in Uraeda

**Goal:** Storybook's interface renders its stories through Uraeda, with
`security.insecureIframeMessaging` set by the skill's helper only when Uraeda serves the Storybook.

**Architecture:** One rule moves, in one home: which settings a Storybook served by Uraeda gets,
owned by `uraedaPreview` in
[`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js). Under
`URAEDA_PREVIEW_BASE`, it returns `security` as a preset function, as it already does for
`managerHead` and `previewHead`: Storybook reads `security` through `presets.apply("security")`, in
its manager builder and in `@storybook/builder-vite`, so a function sees the earlier presets' value
and the project's own `security` keeps working whatever form it takes. The proxy's channel rule,
`upstreamSearch` in [`proxy.ts`](/packages/server/src/preview/proxy.ts), stays its only home and
does not change. The hand validation script gains the interface's checks, in a function of its own.
See the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A project's `security` written as a preset function** is called with the earlier presets' value
   and Storybook's options, and its result keeps every key, with `insecureIframeMessaging` added. A
   wrapper that spreads the function itself, or calls it without the earlier value, loses the
   project's settings. Task 2.
2. **A project that sets `insecureIframeMessaging: false`** still gets `true` under Uraeda, since
   the page renders nothing without it: the helper's key is written last. Task 2.
3. **A project with no `security`** gets the earlier presets' value with the key added, not an
   object that drops them. Task 2.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these:

- "It MUST forward Storybook's channel, `storybook-server-channel`, only as a preview's,
  `page=preview`, whatever role the upgrade asks, so no frame can save, create, or open files
  through Storybook." ([stack](../decisions/stack.md#rules))
- "The web UI MAY show a preview's pages only in frames sandboxed without `allow-same-origin`."
  ([stack](../decisions/stack.md#rules)): `SANDBOX` in `StorybookPage.tsx` stays
  `"allow-scripts allow-popups"`.
- "Storybook's `main.ts` MUST be wrapped by the skill's `uraeda-preview.js` ... so Uraeda can serve
  it under its own address. Checked by the validation script." ([preview](../decisions/preview.md))
- The helper changes nothing without `URAEDA_PREVIEW_BASE`: it returns the config itself, `toBe`
  identical, as the existing test "without the variable, the config is left as it is" pins
  ([`storybook-preview.test.ts`](/packages/web/src/__tests__/storybook-preview.test.ts)).
- The header text, word for word: "Under Uraeda, it also turns on Storybook's
  `security.insecureIframeMessaging`: Uraeda shows Storybook's interface in a sandboxed frame, which
  has no origin of its own, and only Uraeda's pages, which hold the preview path's secret, can reach
  it." ([spec, Components](spec.md#components))
- The validation line, word for word: `PASS the Storybook page's canvas shows the Ready story`
  ([spec, Components](spec.md#components)).
- Functions stay under 100 lines and files under 500 ([code quality](../decisions/code-quality.md)).

## Code read

- [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js): returns the config
  itself without `URAEDA_PREVIEW_BASE`; otherwise wraps `managerHead`, `previewHead`, and
  `viteFinal` as preset functions, `run` calling a project's preset with the earlier value. Its
  `StorybookConfig` typedef lists only what it reads; its return type lists what it adds. 179 lines.
- [`storybook-preview.test.ts`](/packages/web/src/__tests__/storybook-preview.test.ts): Vitest,
  table-driven with `test.each`, `BASE` and `vite` constants, run by `vp test`. 162 lines.
- Storybook 10.6.2's `applyPresets` (`storybook/dist/_node-chunks/chunk-XYQ3GU6K.js`, line 13307): a
  function preset is called with the accumulated value and the combined options; any other value
  replaces it. `security` is read with `presets.apply("security")` in the manager builder
  (`builder-manager-7PMD5P2I.js`, line 1413), the core server (`core-server/index.js`, line 8542),
  and `@storybook/builder-vite` (`dist/index.js`, line 381).
- [`proxy.ts`](/packages/server/src/preview/proxy.ts) `upstreamSearch`, lines 209-221: sets
  `page=preview` on every channel upgrade; its comment cites R51 only.
  [`proxy.test.ts`](/packages/server/src/preview/__tests__/proxy.test.ts) pins it.
- [`validate-storybook.ts`](/packages/web/scripts/validate-storybook.ts): run by hand inside
  `nix develop`, after `vp install`, with `node packages/web/scripts/validate-storybook.ts`; starts
  Uraeda's dev server on the fake agent, waits for the checkout's `Preview` record, opens
  `iframe.html` of `storyembed--ready` in WebKit. `check` is about 85 lines: new checks go in a
  function of their own. [`edited.ts`](/packages/web/scripts/edited.ts) `whileEdited` edits a file
  for a check and restores it.
- [`StoryEmbed.stories.tsx`](/packages/web/src/StoryEmbed.stories.tsx): `Ready`, `Missing`,
  `Removed` (args `folder`, `removed`, `story`).
- [`.storybook/main.ts`](/packages/web/.storybook/main.ts): wrapped by the helper, no `security`.
- The worktree's binding is not built: `packages/web/debug-storybook.log` shows "Cannot find native
  binding". The validation needs the binding built first (`vp run ready` or the binding's build).

## Constitution check

| Principle                                  | Complies | Notes                                                                    |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | The setting and the kept channel rule are the human's answers, Q1 and Q2 |
| II. Git and plain text first               | yes      | No new state                                                             |
| III. Asynchronous by default               | yes      | No workflow step changes                                                 |
| IV. Review effort matches impact           | yes      | The relaxed guard is in the helper's header, said as what it allows      |
| V. Tools are optional                      | yes      | `storybook dev` without Uraeda is unchanged                              |
| VI. Code is checked and stays maintainable | yes      | Each scenario has a test or a validation check; one home per rule        |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Stack](../decisions/stack.md): the channel rule stays in `upstreamSearch`, whose comment links it
  (task 2); the page's frame keeps its sandbox (no task touches it).
- [Preview](../decisions/preview.md): Uraeda's own `main.ts` gets the setting through the helper,
  with no change (task 2), checked by the validation script (task 3).
- [Sign-in](../decisions/sign-in.md): the frame secret keeps other websites away from the interface;
  nothing changes there.
- [Code quality](../decisions/code-quality.md): the interface's checks go in a new function, so
  `check` stays under 100 lines (task 3).

## Complexity tracking

None.

---

## Task 1: A Storybook older than 10.6.2 ignores the setting

The spec marks this unverified. If an older Storybook refuses the key, or fails to start with it,
the build stops here and goes back to the human, as the spec's block says, with the fallback of
setting it only on 10.6.2 and later.

**Files:**

- Modify: `specs/2026-10-17-access-storybook/rulings.md`

- [ ] **Step 1: Start Storybook 10.6.1 with the setting, outside the repository**

In a new empty folder under the system's temporary folder, install `storybook@10.6.1`,
`@storybook/react-vite@10.6.1`, `react`, `react-dom`, and `vite`, with one story and a
`.storybook/main.ts` holding `security: { insecureIframeMessaging: true }`, and run
`storybook dev --ci --smoke-test`.

- Expected: it exits 0, with no error or warning naming `security`.

- [ ] **Step 2: Record the result in `rulings.md`**

The versions, the command, and its outcome, as a ruling on why the helper sets the key whatever the
Storybook version.

- [ ] **Step 3: Commit**

```bash
git add specs/2026-10-17-access-storybook/rulings.md specs/2026-10-17-access-storybook/plan.md
git commit -m "chore(access-storybook): an older Storybook ignores insecureIframeMessaging"
```

## Task 2: The helper turns on Storybook's iframe messaging under Uraeda

**Risky:** it turns off one of Storybook's security guards, in every project Uraeda previews.

**Files:**

- Modify: `skills/uraeda/assets/storybook/uraeda-preview.js` (`uraedaPreview`, its header, its JSDoc
  types)
- Modify: `packages/server/src/preview/proxy.ts` (`upstreamSearch`'s comment only)
- Test: `packages/web/src/__tests__/storybook-preview.test.ts`

**Interfaces:**

- Produces: under `URAEDA_PREVIEW_BASE`, `uraedaPreview(config, env)` returns a config whose
  `security` is a preset function,
  `security: (value: Security | undefined, options: unknown) => Promise<Security>`, where `Security`
  is a plain object of Storybook's security keys. It resolves to the project's own `security` with
  `insecureIframeMessaging: true` written last: the project's object, or what its preset function
  returns from `(value, options)`, or `value` when the project has none.

- [ ] **Step 1: Write the failing tests**

```ts
test.each([
  ["no security of its own", vite, undefined, { insecureIframeMessaging: true }],
  [
    "its own security, kept",
    { ...vite, security: { insecureRemoteIframeEmbed: true } },
    undefined,
    { insecureIframeMessaging: true, insecureRemoteIframeEmbed: true },
  ],
  [
    "its own security as a preset function, given the earlier value",
    { ...vite, security: (value?: object) => ({ ...value, insecureRemoteIframeEmbed: true }) },
    { earlier: true },
    { earlier: true, insecureIframeMessaging: true, insecureRemoteIframeEmbed: true },
  ],
  [
    "the earlier presets' security, without one of its own",
    vite,
    { earlier: true },
    { earlier: true, insecureIframeMessaging: true },
  ],
  [
    "its own insecureIframeMessaging turned off",
    { ...vite, security: { insecureIframeMessaging: false } },
    undefined,
    { insecureIframeMessaging: true },
  ],
])("under Uraeda, %s, iframe messaging is on", async (_, config, earlier, expected) => {
  const wrapped = uraedaPreview(config, { URAEDA_PREVIEW_BASE: BASE });

  expect(await wrapped.security(earlier, {})).toEqual(expected);
});

test("without the variable, a project's security is left as it is", () => {
  const config = { ...vite, security: { insecureRemoteIframeEmbed: true } };

  expect(uraedaPreview(config, {})).toBe(config);
  expect(config.security).toEqual({ insecureRemoteIframeEmbed: true });
});
```

The break each test catches:

- No security of its own: the key never set, or set outside `security`.
- Its own security, kept: `security` replaced by `{ insecureIframeMessaging: true }` (US2.2).
- Preset function: the function spread as an object, or called without the earlier value (review
  focus 1).
- Earlier presets' security: `value` ignored when the project has none (review focus 3).
- Turned off: the project's key spread after the helper's (review focus 2).
- Without the variable: the setting added outside Uraeda (US2.3, SC-003).

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/storybook-preview.test.ts`
- Expected: FAIL, `wrapped.security is not a function` on the five rows; the last test passes, as it
  pins preserved behaviour.

- [ ] **Step 3: Implement `security` in `uraedaPreview`**

In the object returned under `URAEDA_PREVIEW_BASE`, add `security` as described in **Produces**.
Reuse the way `run` calls a project's preset, without changing what `run` returns for the heads. Add
`security` to the `StorybookConfig` typedef, as a `Preset` of a plain object, and to the return
type. Add the header's sentence, word for word from the global constraints, after "Without it, the
config is left as it is, so `storybook dev` runs as usual." Extend `uraedaPreview`'s JSDoc with one
clause saying it turns on iframe messaging.

In `proxy.ts`, add to `upstreamSearch`'s comment a link to the rule: "the
[stack](/specs/decisions/stack.md) decision's rule". No code change.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp check` and `nix develop -c vp test`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/uraeda/assets/storybook/uraeda-preview.js packages/server/src/preview/proxy.ts \
  packages/web/src/__tests__/storybook-preview.test.ts specs/2026-10-17-access-storybook/plan.md
git commit -m "feat(access-storybook): the helper turns on Storybook's iframe messaging under Uraeda"
```

## Task 3: The validation script opens Storybook's interface

**Files:**

- Modify: `packages/web/scripts/validate-storybook.ts` (its header, `check`, a new
  `checkInterface(browser: Browser, address: string, base: string): Promise<void>`)

**Interfaces:**

- Consumes: task 2's `security` under `URAEDA_PREVIEW_BASE`, through Uraeda's own `main.ts`.

- [ ] **Step 1: Build the binding, and run the script before the change**

- Run: `nix develop -c vp run ready` (or the binding's build alone), then
  `nix develop -c node packages/web/scripts/validate-storybook.ts`
- Expected: PASS on the four existing lines, with task 2's setting in place.

- [ ] **Step 2: Add `checkInterface`, called by `check` after the edit check, on the same browser**

In WebKit at 1440 × 900, it opens `${address}${base}?path=/story/storyembed--ready`, Storybook's
interface served top-level through Uraeda, so the proxy's `sandbox` header gives it the `null`
origin the page's frame gives it. The canvas is the frame `#storybook-preview-iframe`. One `PASS`
line per check, `fail` with what the canvas or panel shows otherwise, each wait up to `SHOW_MS`:

1. The canvas shows "Dragging the handle": `PASS the Storybook page's canvas shows the Ready story`
   (US1.1, SC-001).
2. Clicking "Removed" under "StoryEmbed" in the sidebar shows "This variant was removed after your
   answer." in the canvas, and the controls panel lists `folder`, `removed`, and `story` (US1.2).
3. Turning the `removed` control off shows "No story “Resizing” in
   packages/web/src/SidebarHandle.stories.tsx on this branch." in the canvas, with a marker set on
   the interface's `window` still there, so no reload happened (US1.3).
4. With `whileEdited` adding
   `export const Added: Story = { args: { folder: CHECKOUTS.ready, story: dragging } };` to
   `StoryEmbed.stories.tsx`, the sidebar lists "Added" without a reload, and clicking it shows
   "Dragging the handle" in the canvas (US1.4).
5. At 402 × 874, a new page on the same address shows "Dragging the handle" in the canvas, and the
   script writes its screenshot to the temporary data folder and prints its path: the phone's width
   is checked by looking at it.

Update the header's first paragraph to say it also opens Storybook's interface and what it checks
there.

- [ ] **Step 3: Check that the script catches the blank canvas**

Remove the `security` key from the helper's returned config, run the script, and put it back.

- Expected: `FAIL the Storybook page's canvas shows the Ready story`, the canvas stuck on "Content
  is loading…" or empty.

- [ ] **Step 4: Run the script and the project's validation**

- Run: `nix develop -c node packages/web/scripts/validate-storybook.ts`, then
  `nix develop -c vp check`
- Expected: PASS on every line; the 402 px screenshot shows Storybook's narrow layout with the
  story. A broken narrow layout goes to the inbox as a follow-up, as the spec's assumptions say.

- [ ] **Step 5: Commit**

```bash
git add packages/web/scripts/validate-storybook.ts specs/2026-10-17-access-storybook/plan.md
git commit -m "feat(access-storybook): the validation script checks Storybook's interface"
```
