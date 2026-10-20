---
status: auto-approved
spec-revision: 1
---

# Plan: Stable dev environment for UI review

**Goal:** `vp run sandbox` serves the whole web app from its checkout, over three sample projects
and a fake agent, kept until a reset, with a picker that copies an element and its source location.

**Architecture:** the sandbox reuses what Storybook and the screenshot script already do: the real
server in Vite's process through `uraedaServer()`, the fake agent, and dated sample repositories.
See the [spec's architecture](spec.md#architecture).

- **Sample content** has one owner, `packages/web/samples/`. It builds "a feature at a step", a
  change at a step, and the three projects. Storybook's fixture, the screenshot script, and the
  sandbox call it; `.storybook/featurePages.ts` and the screenshot script's own builders move there.
- **The sandbox's state** has one owner, `packages/web/sandbox/seed.ts`. It alone creates, stamps,
  and resets `.sandbox/` at the checkout's root. Everything else reads the paths it returns. The
  real data and config folders are never computed in the sandbox: its environment is set before the
  server reads it, and `.env` is not read (`file: false`).
- **Sessions** are written only through the session manager, `createSessions`, never by SQL, so the
  stored shape stays the runner's ([agents](../decisions/agents.md)).
- **The fake agent's sandbox behaviour** has one owner, `packages/web/sandbox/agent.ts`: the canned
  reply and the turn at work. `FakeAdapter` only gains generic abilities: awaited steps, and a turn
  played when none is scripted.
- **Picking** reuses the skill's pick script, `uraeda-pick.js`, loaded at the top of the sandbox's
  page, where its parent is the page itself. The script stays the one home of which element a click
  means, and of its role and name. The bar owns the pick's text and the clipboard.
- **Source locations** come from code-inspector's Vite plugin, added only by the sandbox's Vite
  config, with its overlay, hotkeys, and server off.
- **Restarts** reuse `vp run dev`'s script, `packages/server/scripts/dev.ts`, given the sandbox's
  Vite config. One restart logic serves both.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name. Each gets a test
in the task that owns the code.

1. **A `.env` naming another repository, data, or config folder** never reaches the sandbox: the
   real folders' files are unchanged after a run. Task 8.
2. **Two seeds at once**: a second `vp run sandbox` in the same checkout, while the first builds
   `.sandbox/`, never leaves it half built. The build writes into a temporary folder renamed into
   place. Task 8.
3. **A pick on an element inside the sandbox's own bar** is ignored, and the bar's toggle still
   works in pick mode. Tasks 4 and 6.
4. **The production build** holds none of the sandbox's code, no `data-insp-path` attribute, and no
   code-inspector client. Task 8.
5. **A canned reply sent while the turn at work runs** queues behind it, as a real agent's message
   would, and does not cut the turn short. Task 7.

## Global constraints

Before any task: fix testing (`2026-10-19-fix-testing`) must be merged into `main`, and this branch
rebased on it, as the spec's block says. That feature moves the UI's Vite plugins into
`packages/web/vite.transforms.ts` (`uiTransforms()`), and rebuilds `packages/binding/test-utils.ts`
as immutable templates, keeping `fixtureRepo(name = "repo"): string`. If its merged shape differs
from this, follow it, and note the difference in [rulings](rulings.md).

From [Sandbox](../decisions/sandbox.md), word for word:

- The sandbox MUST serve the whole web UI from the checkout it runs in, with hot reload, over sample
  projects only. Checked by review.
- The sandbox MUST NOT read or write the human's real repositories, data folder, config folder, or
  agent. Checked by a test.
- The sandbox's sessions MUST run on the fake agent, which answers from canned text and changes no
  file. Checked by a test.
- The sandbox's state MUST survive its restarts, until the human asks for a reset. Checked by a
  test.
- A pick MUST be copied to the clipboard as text that names the page, the element, and its source
  location. Checked by a test.
- The sandbox's code, sample projects, and picker MUST NOT reach the built app or the package.
  Checked by a test of the build's output.
- Mockups and variants SHOULD stay Storybook stories, as the [preview](../decisions/preview.md)
  decision says: the sandbox shows the built app, not choices to pick from. Checked by review.
- The sandbox MAY take source locations from a build plugin that only the sandbox loads. Checked by
  review.

From [Sign-in](../decisions/sign-in.md):

- Sign-in MUST NOT be turned off by a flag, an environment variable, or a setting: only code MAY
  build an app without it, for tests, Uraeda's own Storybook fixture, and the
  [sandbox](../decisions/sandbox.md). Checked by review.

From [Agents](../decisions/agents.md):

- Every agent MUST be reached through one adapter that keeps its formats inside and declares what it
  can do, and tests MUST use a fake adapter. Checked by review.
- Sessions, turns, and items MUST be stored and shown in one agent-neutral shape. Checked by the
  runner's tests.
- Sessions MUST be a cache in Uraeda's data folder, never workflow state and never in a repository.
  Checked by review.

From [Stack](../decisions/stack.md):

- The server MUST accept only requests that Uraeda's own pages, or frames it gave a secret, make,
  and MUST listen only on the loopback interface. Checked by the guard's tests.

From [Preview](../decisions/preview.md):

- Mockups and named states of views MUST be stories written with the real components, next to them.
  Checked by review and lint.
- Storybook MUST run Uraeda's real server over fixture data, and stories MUST NOT fake its
  responses. Checked by review.

From [UI behaviour](../decisions/ui-behaviour.md):

- Status MUST show next to what it concerns, and an error MUST stay there until dealt with, never
  only in a toast. Checked by the UI tests.
- Every action MUST work by tap and by keyboard, never by hover alone. Checked by the UI and browser
  tests.

From [UI checks](../decisions/ui-checks.md):

- UI tests MUST drive the UI as a user does, and MUST NOT assert markup, class names, or pixels.
  Checked by review.
- Before handing over a UI change, the agent MUST review screenshots of every changed view at both
  sizes and in both themes against the decisions, and commit them. Checked by review.

From [Code quality](../decisions/code-quality.md):

- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.
  Checked by review.

From [Toolchain](../decisions/toolchain.md):

- Every tool and runtime MUST be pinned, and Rust tests MUST run under cargo-nextest. Checked by
  review and CI.
- Tests MUST be isolated, so runs in several checkouts of one machine do not collide. Checked by the
  toolchain configuration's test.

Exact values from the spec, copied as written:

- The address line: `Sandbox: http://127.0.0.1:4410/`, the port 4410 or the next free one.
- The projects: "sample", "empty", and "broken", in a locked list.
- The builders' warning:
  `The sample projects were built by older code: run with --reset to rebuild them.`
- The canned reply, streamed over 3 seconds:
  `This is the sandbox's fake agent: it answers every message with this text, and changes no file.`
- The turn at work: tool calls streamed for 10 minutes, then done, played again at every start.
- The bar's lines: `Click an element to copy it. Escape to stop.`,
  `Copied <role> “<name>”. Paste it to your agent.`, and
  `Could not copy. Select the text below and copy it.`
- The pick's text, in this order: `Sandbox pick: <address>`, `Element: <role> “<name>”`,
  `Source: <path>:<line>:<column>` or `Source: unknown`, `Text: <text>`, `HTML: <outer HTML>`,
  `Viewport: <width> × <height>, <light|dark>`. Text is cut at 200 characters and HTML at 500, each
  ending with "…" when cut. Paths are from the repository's root.
- Commits dated 2026-10-16, and "today" fixed to that day.

Existing guarantees to preserve:

- Storybook's fixture and the screenshot script build the same states as today after the sample
  builders move: [`fixture.ts`](/packages/web/.storybook/fixture.ts),
  [`checkouts.ts`](/packages/web/.storybook/checkouts.ts), and
  [`screenshots.ts`](/packages/web/scripts/screenshots.ts). Task 2 checks it.
- A story embed's pick still posts `role`, `name`, and `text`, and a pick from another window still
  makes no comment ([`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx), the `story-embed` and
  `story-comments` browser tests). Task 4 keeps them passing.
- `FakeAdapter`'s existing scripted turns behave as before for every server test. Task 3 checks it.
- `vp run dev` restarts as before when given no config. Task 8 checks it.

## Code read

- [`packages/server/scripts/dev.ts`](/packages/server/scripts/dev.ts): spawns `vp dev` at the root,
  rebuilds the binding on Rust changes, restarts on server changes, and passes its environment on.
  It takes no arguments today.
- [`packages/server/src/dev.ts`](/packages/server/src/dev.ts): `devHandler` starts the server on the
  first request to a server path, with `adapter`, `lockedList`, `signIn`, and `file`. Nothing lets a
  caller act once the server has started: Task 8 adds it.
- [`packages/web/vite.config.ts`](/packages/web/vite.config.ts): exports `uraedaServer(options)`;
  after fix testing, the transforms come from `vite.transforms.ts`'s `uiTransforms()`.
- [`packages/web/scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts): `serve()` builds a
  Vite server programmatically on the web config, swapping the `uraeda-server` plugin. Its
  `repository()` adds its own round mockup, spec pages, and feature pages.
- [`packages/web/.storybook/fixture.ts`](/packages/web/.storybook/fixture.ts),
  [`featurePages.ts`](/packages/web/.storybook/featurePages.ts), and
  [`checkouts.ts`](/packages/web/.storybook/checkouts.ts): Storybook's seed and its folder names,
  dated with `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`, with a fake `gh` (`listPullRequest`) and
  `recordFeatureRuns`.
- [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts): `fixtureRepo`, `commitsAt`,
  `commitOnBranch`, `addChange`, `addPlan`, `addSpecFeature`, `addStoryFeature`, `previewDecision`,
  and `temporaryFolder`, which removes its folder at exit: the sandbox must not use it for
  `.sandbox/`.
- [`packages/server/src/runner/fake.ts`](/packages/server/src/runner/fake.ts): `FakeAdapter` plays
  `script()` turns on `send`, and `FakeStep` functions run synchronously. One process is current.
- [`packages/server/src/testing.ts`](/packages/server/src/testing.ts): `fakeSessions()` builds
  `createSessions` on an in-memory cache; `recordRun` writes tokens only.
- [`packages/server/src/runner/sessions.ts`](/packages/server/src/runner/sessions.ts): `newChat`,
  `featureSession`, `send(repo, session, input)`, `settled(turn)`, `stop`, `closeAll`.
- [`packages/server/src/runner/cache.ts`](/packages/server/src/runner/cache.ts): at open, running
  turns become stopped. `runner.sqlite` lives in the data folder.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): the step names a feature or change can
  have.
- [`fixtures/broken/`](/fixtures/broken/): files `ura check` refuses, used by the core's tests.
- [`skills/uraeda/assets/storybook/uraeda-pick.js`](/skills/uraeda/assets/storybook/uraeda-pick.js):
  posts `picked` with `role`, `name`, `text` to `window.parent`; obeys `pick` only from its parent.
  At the top of a page, its parent is the page itself. It has no keyboard pick, and no way to skip
  an element.
- [`packages/web/src/sandbox/SandboxBar.tsx`](/packages/web/src/sandbox/SandboxBar.tsx) and its
  stories: the approved mockups, presentational, with `PickStatus`.
- [`packages/web/src/__tests__/build.test.ts`](/packages/web/src/__tests__/build.test.ts): reads the
  build `vp run web:build` leaves in `dist/`.
- Validation: `vp run ready` runs every check; after fix testing, `vp run fast` runs the affected
  ones. Browser tests are `packages/web/src/__browser__/`, on `vite.browser.config.ts`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Complexity tracking

| Abstraction or exception                            | Why it is needed                                                             | Simpler alternative rejected because                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/web/samples/`, the shared sample builders | Storybook, the screenshots, and the sandbox each build "a feature at a step" | a third copy, which drifts from the other two                                           |
| `FakeAdapter`'s awaited steps and fallback turn     | the canned reply streams over time, and any message gets one                 | a second fake adapter, a copy of the first                                              |
| `devHandler`'s `started` option                     | the sandbox starts the turn at work once its server is up                    | a fate request from outside, which needs a session the sandbox has no other way to name |
| `dev.ts` taking a Vite config                       | the sandbox restarts as `vp run dev` does                                    | a copy of its restart logic                                                             |

## Test map

The sandbox's tests build the sample projects in a test's temporary folder, and serve them with
Vite's API on the fake agent, as the screenshot script does. Seeds and sessions are checked through
the binding's workspace view and the session manager. Time-based behaviour runs on an injected wait.
The picker's tests are browser tests, on the real pick script.

| Spec                                                                                      | Task | Test                                                                    |
| ----------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| Unverified: code-inspector with Vite+, StyleX, React Compiler                             | 1    | `packages/web/sandbox/__tests__/source-locations.test.ts`               |
| Unverified: picking over a dialog; edge "inside a dialog"                                 | 1    | `packages/web/src/__browser__/sandbox-pick.test.tsx`, a dialog open     |
| Existing: Storybook's and the screenshots' states                                         | 2    | `packages/web/samples/__tests__/storybook-states.test.ts`               |
| Existing: `FakeAdapter`'s scripted turns                                                  | 3    | `packages/server/src/runner/__tests__/fake.test.ts`                     |
| US4 more 2 (Enter picks); review focus 3                                                  | 4    | `packages/web/src/__browser__/story-embed.test.tsx`, pick script cases  |
| US1 3, more 1, 2, 3; SC-002                                                               | 5    | `packages/web/samples/__tests__/projects.test.ts`                       |
| US4 1, 2, 3, more 1, 3, 4; edge "no source"; edge cuts; SC-005                            | 6    | `packages/web/src/__browser__/sandbox-pick.test.tsx`                    |
| US3 1, 2, 3, more 1, 2; review focus 5                                                    | 7    | `packages/web/sandbox/__tests__/sessions.test.ts`                       |
| US1 1, 2, more 4, 5; US2 1, 2, 3, more 1                                                  | 8    | `packages/web/sandbox/__tests__/sandbox.test.ts`                        |
| Edges: `.env`, builders changed, two checkouts, deleted folder; SC-003; review focus 1, 2 | 8    | `packages/web/sandbox/__tests__/seed.test.ts`                           |
| Edge: sample feature embeds stories                                                       | 5    | `packages/web/samples/__tests__/projects.test.ts`, its preview decision |
| SC-004; review focus 4                                                                    | 8    | `packages/web/src/__tests__/build.test.ts`                              |
| SC-001                                                                                    | 8    | checked by hand at the final review, timed on a warm checkout           |
| Existing: `vp run dev` without a config                                                   | 8    | `packages/server/scripts/__tests__/dev.test.ts`                         |

## Waves

1. Task 1: it checks the outside behaviour the spec marks unverified, before anything relies on it.
2. Tasks 2, 3, and 4: the sample builders, the fake adapter, and the pick script, in different
   packages.
3. Tasks 5 and 6: the sample projects, in `packages/web/samples/`, and the picker, in
   `packages/web/src/sandbox/`.
4. Task 7: the sessions, which name the sample projects' folders.
5. Task 8: the command, which consumes every earlier task.

---

## Task 1: Check code-inspector and picking over a dialog

**Files:**

- Create: `packages/web/sandbox/sourceLocations.ts`
- Modify: `packages/web/package.json` (add `code-inspector-plugin`, pinned exactly, in
  `devDependencies`), `packages/web/tsconfig.json` (include `sandbox` and `samples`),
  `packages/web/src/__browser__/helpers.tsx` (`pickScriptOnPage`)
- Test: `packages/web/sandbox/__tests__/source-locations.test.ts`,
  `packages/web/src/__browser__/sandbox-pick.test.tsx`

**Interfaces:**

- Produces: `sourceLocations(): Plugin`, code-inspector's Vite plugin with its overlay, hotkeys,
  console snippets, and server off, and paths relative to the repository's root.
- Produces, for the browser tests of tasks 4 and 6:
  `pickScriptOnPage(): Promise<{ next(): Promise<PickedMessage>; start(): void; taken(): Array<PickedMessage> }>`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/web/sandbox/__tests__/source-locations.test.ts
test("a component keeps the compiler's and StyleX's output, and gains its source", async () => {
  const server = await transformServer([...uiTransforms(), sourceLocations()]);

  const code = await transformed(server, "/src/sandbox/SandboxBar.tsx");

  expect(code).toContain('data-insp-path": "packages/web/src/sandbox/SandboxBar.tsx:');
  expect(code).toContain("react/compiler-runtime");
  expect(code).not.toContain("stylex.create(");
});

test("without the plugin, no source attribute is added", async () => {
  const server = await transformServer(uiTransforms());

  expect(await transformed(server, "/src/sandbox/SandboxBar.tsx")).not.toContain("data-insp-path");
});
```

```tsx
// packages/web/src/__browser__/sandbox-pick.test.tsx
test("the pick script, at the top of a page, picks a button inside an open dialog", async () => {
  const picks = await pickScriptOnPage();
  render(
    <Overlay isOpen label="Rename" onClose={() => {}}>
      <Button label="Save" />
    </Overlay>,
  );

  picks.start();
  await userEvent.click(page.getByRole("button", { name: "Save" }));

  expect(await picks.next()).toMatchObject({ name: "Save", role: "button" });
});
```

`transformServer` and `transformed` are helpers of the first file: a Vite server in middleware mode,
closed after each test. `pickScriptOnPage()`, in the browser tests' helpers, loads `uraeda-pick.js`
into the test's page. Its `start()` posts `{ uraeda: "pick", on: true }` to the page, `next()` waits
for the next `picked` message, and `taken()` lists those received.

The break each test catches:

- Keeps the output: the plugin placed before the compiler or StyleX, which then skip the file.
- Gains its source: an absolute path, or no attribute on a compiled component.
- Without the plugin: the plugin leaking into the shared transforms.
- Inside a dialog: a dialog that blocks the pick script's listeners, or renders out of its reach.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/sandbox/__tests__/source-locations.test.ts`
- Expected: FAIL, `Cannot find module '../sourceLocations.ts'`.

- [ ] **Step 3: Implement `sourceLocations()`**

Configure the plugin with `bundler: "vite"`, its hotkeys off, its server closed, no client or
console snippet, and `pathType: "relative"` from the repository's root. If the plugin cannot run
without its client, or breaks the compiler or StyleX, stop here: the spec says picks then lose their
"Source" line, and this goes back to the human before Task 6.

- [ ] **Step 4: Run the tests, and the browser test**

- Run: `vp test packages/web/sandbox/__tests__/source-locations.test.ts`, then the browser test.
- Expected: PASS. If the dialog test fails, stop and go back to the human: the spec marks picking
  over dialogs unverified.

- [ ] **Step 5: Run the project's validation**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/sandbox packages/web/package.json packages/web/tsconfig.json pnpm-lock.yaml packages/web/src/__browser__/sandbox-pick.test.tsx
git commit -m "feat(ui-sandbox): source locations from code-inspector, checked"
```

## Task 2: One home for the sample builders

**Risky:** it moves the builders Storybook and the screenshots rely on, a rule several callers
share.

**Files:**

- Create: `packages/web/samples/features.ts`, `packages/web/samples/index.ts`
- Modify: `packages/web/.storybook/fixture.ts`, `packages/web/scripts/screenshots.ts`
- Delete: `packages/web/.storybook/featurePages.ts` (moved)
- Test: `packages/web/samples/__tests__/storybook-states.test.ts`

**Interfaces:**

- Produces, from `packages/web/samples/index.ts`: `addFeaturePages(repo)`,
  `recordFeatureRuns(dataDir, repo)`, `listPullRequest()`, `addRoundMockup(repo, folder, answer)`,
  `addSpecPages(repo)`, `DATE = "2026-10-16T09:00:00Z"`, and `dated<T>(build: () => T): T`, which
  runs `build` with the git date variables set and restores them.

- [ ] **Step 1: Write the test of today's states**

```ts
test("Storybook's fixture holds the same features at the same steps", () => {
  const { repo } = storybookFixture();

  expect(stepsOf(repo)).toEqual(STORYBOOK_STEPS);
});
```

`STORYBOOK_STEPS` is the map of folder to step read from today's fixture, before the move, written
into the test. `stepsOf` reads the binding's workspace view.

The break it catches: a builder lost or changed in the move.

- [ ] **Step 2: Run it on today's code**

- Run: `vp test packages/web/samples/__tests__/storybook-states.test.ts`
- Expected: PASS before the move.

- [ ] **Step 3: Move the builders**

Move `featurePages.ts`, and the round mockup and spec page builders of `fixture.ts` and
`screenshots.ts`, into `samples/`, merging the two variants of each into one. `fixture.ts` and
`screenshots.ts` call them, and keep their own preview-state features.

- [ ] **Step 4: Run the project's validation**

- Run: `vp run ready`, and `vp run --filter uraeda-web screenshots 2026-10-20-ui-sandbox home`
- Expected: PASS, the same steps, and the same home screenshot.

- [ ] **Step 5: Commit**

```bash
git add packages/web/samples packages/web/.storybook packages/web/scripts/screenshots.ts
git commit -m "refactor(ui-sandbox): one home for the sample builders"
```

## Task 3: Awaited steps and a fallback turn for the fake agent

**Files:**

- Modify: `packages/server/src/runner/fake.ts`
- Test: `packages/server/src/runner/__tests__/fake.test.ts`

**Interfaces:**

- Produces: `FakeStep = AgentEvent | ((cwd: string) => void | Promise<void>)`, each function step
  awaited before the next step is read; `FakeAdapter.fallback: (() => Array<FakeStep>) | undefined`,
  the turn played on `send` when no turn is scripted.

- [ ] **Step 1: Write the failing tests**

```ts
test("a message with no scripted turn plays the fallback", async () => {
  const { adapter, sessions } = fakeSessions();
  adapter.fallback = () => [{ text: "canned", type: "text" }];
  const chat = await sessions.newChat(repo);

  await settle(sessions, await sessions.send(repo, chat.id, { text: "hello" }));

  expect(agentTexts(chat)).toEqual(["canned"]);
});

test("an awaited step holds the next until it resolves", async () => {
  const gate = Promise.withResolvers<void>();
  adapter.script([() => gate.promise, { text: "after", type: "text" }]);
  const turn = await sessions.send(repo, chat.id, { text: "go" });

  expect(agentTexts(chat)).toEqual([]);
  gate.resolve();
  await settle(sessions, turn);
  expect(agentTexts(chat)).toEqual(["after"]);
});
```

The break each test catches:

- Fallback: a message with nothing scripted that hangs, as today.
- Awaited step: a promise ignored, so steps run before their wait ends.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner/__tests__/fake.test.ts`
- Expected: FAIL, `expected [] to deeply equal [ 'canned' ]`.

- [ ] **Step 3: Implement**

Await a function step's result in the process's event iterator. Play `fallback()` in `send` when
`nextScript()` is empty. Scripted turns keep priority.

- [ ] **Step 4: Run the server's tests**

- Run: `vp test packages/server`
- Expected: PASS, every existing test unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/runner/fake.ts packages/server/src/runner/__tests__/fake.test.ts
git commit -m "feat(ui-sandbox): awaited steps and a fallback turn for the fake agent"
```

## Task 4: The pick script names the source, the HTML, and picks by keyboard

**Files:**

- Modify: `skills/uraeda/assets/storybook/uraeda-pick.js`, its protocol comment
- Test: `packages/web/src/__browser__/story-embed.test.tsx` (its pick script cases)

**Interfaces:**

- Produces: `picked` messages gain `source: string | null`, the nearest `data-insp-path` of the
  element or its parents, and `html: string`, the element's outer HTML. Elements inside
  `[data-uraeda-pick-ignore]` are never outlined or picked, and clicks on them reach them. In pick
  mode, Enter or Space picks the focused element.

- [ ] **Step 1: Write the failing tests**

```ts
test("Enter in pick mode picks the focused button", async () => {
  const picks = await pickScriptOnPage();
  render(<Button label="Save" />);
  page.getByRole("button", { name: "Save" }).element().focus();

  picks.start();
  await userEvent.keyboard("{Enter}");

  expect(await picks.next()).toMatchObject({ name: "Save", role: "button" });
});

test("an ignored element is not picked, and its click reaches it", async () => {
  const picks = await pickScriptOnPage();
  const pressed = vi.fn();
  render(<div data-uraeda-pick-ignore><Button label="Stop" onClick={pressed} /></div>);

  picks.start();
  await userEvent.click(page.getByRole("button", { name: "Stop" }));

  expect(pressed).toHaveBeenCalledOnce();
  expect(picks.taken()).toEqual([]);
});

test("a pick names the nearest source and the HTML", async () => {
  render(<div data-insp-path="packages/web/src/X.tsx:3:5"><span>Hi</span></div>);
  // ...start, click "Hi"
  expect(await picks.next()).toMatchObject({ html: "<span>Hi</span>", source: "packages/web/src/X.tsx:3:5" });
});
```

The break each test catches:

- Enter: a keyboard user who cannot pick.
- Ignored: the bar's own toggle picked, or swallowed, in pick mode.
- Source: the element's own attribute only, missing its parent's.

- [ ] **Step 2: Run them to check they fail**

- Run: the browser test file.
- Expected: FAIL, the Enter case first: no `picked` message.

- [ ] **Step 3: Implement**, keeping `role`, `name`, and `text` as they are, and the parent-only
      rule for `pick` messages.

- [ ] **Step 4: Run the browser tests of story embeds and comments**

- Run: the `story-embed` and `story-comments` browser tests.
- Expected: PASS, every existing case unchanged.

- [ ] **Step 5: Commit**

```bash
git add skills/uraeda/assets/storybook/uraeda-pick.js packages/web/src/__browser__
git commit -m "feat(ui-sandbox): picks name their source and HTML, and Enter picks"
```

## Task 5: The three sample projects

**Files:**

- Create: `packages/web/samples/steps.ts`, `packages/web/samples/changes.ts`,
  `packages/web/samples/projects.ts`
- Test: `packages/web/samples/__tests__/projects.test.ts`

**Interfaces:**

- Consumes: Task 2's builders and `dated`.
- Produces: `buildProjects(dir: string): { broken: string; empty: string; sample: string }`, three
  repositories under `dir`, named by their folders; `SAMPLE_FOLDERS`, the folder of each step's
  feature and change, keyed by step, which Task 7 uses.

- [ ] **Step 1: Write the failing tests**

```ts
test("sample has a feature at every step, and a change at each of its steps", () => {
  const { sample } = buildProjects(temporaryFolder("samples"));

  expect(featureSteps(sample)).toEqual(new Set(FEATURE_STEPS));
  expect(changeStates(sample)).toEqual(new Set(["change", "human-gate", "pull-request", "done"]));
});

test("empty is a project just set up", () => {
  const { empty } = buildProjects(temporaryFolder("samples"));

  expect(featureSteps(empty).size).toBe(0);
  expect(priorityEntries(empty)).toEqual([]);
  expect(inboxNotes(empty)).toEqual([]);
});

test("broken's features carry the problems ura check reports", () => {
  const { broken } = buildProjects(temporaryFolder("samples"));

  expect(problemCount(broken)).toBeGreaterThan(0);
});
```

`FEATURE_STEPS` is every feature step of `steps.rs` the spec lists: discovery, the round waiting,
spec, the spec waiting, spec revision, approval, plan, the plan waiting, plan revision,
implementation, final review, pull request, pull request changes, finish, done, and blocked.

The break each test catches:

- Every step: a step added to the core with no sample, or a sample read at the wrong step.
- Empty: a sample feature leaking into the empty project.
- Broken: fixtures that stop failing `ura check`.

- [ ] **Step 2: Run them to check they fail**

- Expected: FAIL, `Cannot find module '../projects.ts'`.

- [ ] **Step 3: Implement**

Build each missing step from the typed commits its step reads, on top of `fixtureRepo()` for
"sample". The spec's sample feature with stories keeps the fake Storybook's preview decision. Pull
request states come from Task 2's fake `gh`, extended with the draft and changes-requested ones.
"empty" is `specs/` as setup writes it. "broken" is a repository holding
[`fixtures/broken/`](/fixtures/broken/)'s files as features. Every commit is dated with `dated`.

- [ ] **Step 4: Run the project's validation**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/samples
git commit -m "feat(ui-sandbox): the sample, empty, and broken projects"
```

## Task 6: The picker

**Files:**

- Start from: `packages/web/src/sandbox/SandboxBar.stories.tsx#Idle`
- Create: `packages/web/src/sandbox/main.tsx`, `packages/web/src/sandbox/pickText.ts`
- Modify: `packages/web/src/sandbox/SandboxBar.tsx` (mark the bar `data-uraeda-pick-ignore`)
- Test: `packages/web/src/__browser__/sandbox-pick.test.tsx`

**Interfaces:**

- Consumes: Task 4's `picked` message.
- Produces:
  `pickText(pick: Picked & { html: string; source: string | null }, page: { address: string; height: number; theme: "dark" | "light"; width: number }): string`,
  the pick's text; `main.tsx`, which mounts the bar in a root of its own, runs pick mode through the
  pick script, and copies each pick.

- [ ] **Step 1: Write the failing tests**

```ts
test("a click copies the pick, and the bar names it", async () => {
  await renderSandboxPage(<Button label="Submit answers" />);

  await userEvent.click(page.getByRole("button", { name: "Pick an element" }));
  await userEvent.click(page.getByRole("button", { name: "Submit answers" }));

  expect(await clipboardText()).toMatch(/^Sandbox pick: .+\nElement: button “Submit answers”\n/);
  await expect.element(page.getByText("Copied button “Submit answers”. Paste it to your agent.")).toBeVisible();
});

test("Escape stops pick mode, and the page gets no Escape", async () => { /* ... */ });

test("a refused clipboard shows the text to copy by hand", async () => {
  await renderSandboxPage(<Button label="Save" />, { clipboard: "refused" });
  // ...pick "Save"
  await expect.element(page.getByText("Could not copy. Select the text below and copy it.")).toBeVisible();
  await expect.element(page.getByText(/^Sandbox pick:/)).toBeVisible();
});

test("pickText cuts text at 200 and HTML at 500, and names an unknown source", () => {
  const text = pickText({ html: "<p>".padEnd(600, "a"), name: "", role: "paragraph", source: null, text: "b".repeat(250) }, PAGE);

  expect(text).toContain("Source: unknown");
  expect(text).toContain(`Text: ${"b".repeat(200)}…`);
  expect(text.split("\n").find((line) => line.startsWith("HTML: "))).toHaveLength("HTML: ".length + 501);
});
```

The break each test catches:

- Copies: a pick that names the element but never reaches the clipboard.
- Escape: an Escape that closes the page's dialog as well.
- Refused: an error only in the console, leaving nothing to paste.
- Cuts: a pick that floods the agent with a page's HTML.

- [ ] **Step 2: Run them to check they fail**

- Expected: FAIL, `Cannot find module '../sandbox/main.tsx'`.

- [ ] **Step 3: Implement**, with the exact lines and format of the global constraints. The address
      is the page's own; the theme is the app's colour mode.

- [ ] **Step 4: Run the browser tests, and review the bar's screenshots**

- Run: the browser test file.
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/sandbox packages/web/src/__browser__/sandbox-pick.test.tsx
git commit -m "feat(ui-sandbox): pick an element and copy it"
```

## Task 7: The sample sessions and the fake agent's sandbox script

**Files:**

- Create: `packages/web/sandbox/agent.ts`, `packages/web/sandbox/sessions.ts`
- Test: `packages/web/sandbox/__tests__/sessions.test.ts`

**Interfaces:**

- Consumes: Task 3's `fallback` and awaited steps; Task 5's `SAMPLE_FOLDERS`.
- Produces: `sandboxAgent({ wait }: { wait: (ms: number) => Promise<void> }): FakeAdapter`, with the
  canned reply as its fallback; `atWork(sessions, repo)`, which starts the turn at work on the
  implementation feature's session; `seedSessions(dataDir: string, sample: string): Promise<void>`,
  which writes the finished chat, and the failed, stopped, and usage-limited sessions.

- [ ] **Step 1: Write the failing tests**

```ts
test("any message gets the canned reply, streamed over 3 seconds", async () => {
  const waits: Array<number> = [];
  const { sessions } = sandboxSessions({ wait: async (ms) => void waits.push(ms) });

  await sendAndSettle(sessions, chatId, "Make the title bigger");

  expect(lastAgentText(chatId)).toBe(
    "This is the sandbox's fake agent: it answers every message with this text, and changes no file.",
  );
  expect(sum(waits)).toBe(3000);
});

test("the turn at work streams tool calls for 10 minutes, then ends done", async () => {
  /* sum(waits) === 600_000, state done */
});

test("a message sent during the turn at work waits for it", async () => {
  /* review focus 5 */
});

test("seeded sessions show every state", async () => {
  await seedSessions(dataDir, sample);

  expect(sessionStates(dataDir, sample)).toEqual(new Set(["done", "failed", "stopped", "limited"]));
});

test("Continue gets the canned reply, and the feature's step stays", async () => {
  /* US3 more 1 */
});
```

The break each test catches:

- Canned reply: a message that hangs, or a reply that changes a file.
- At work: a turn that ends at once, or never.
- During the turn: a reply that cuts the turn short.
- Seeded: a state missing from the sample sessions.
- Continue: a fake turn that commits.

- [ ] **Step 2: Run them to check they fail**

- Expected: FAIL, `Cannot find module '../agent.ts'`.

- [ ] **Step 3: Implement**, the sessions written only through `createSessions` on the data folder's
      `runner.sqlite`.

- [ ] **Step 4: Run the project's validation**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/sandbox
git commit -m "feat(ui-sandbox): sample sessions on the sandbox's fake agent"
```

## Task 8: `vp run sandbox`

**Risky:** it serves an app without sign-in, and must never reach the human's real data.

**Files:**

- Create: `packages/web/sandbox/seed.ts`, `packages/web/vite.sandbox.config.ts`,
  `packages/web/sandbox/main.ts` (the command)
- Modify: `packages/server/scripts/dev.ts` (take a Vite config), `packages/server/src/dev.ts`
  (`devHandler`'s `started`), `package.json` (`"sandbox"`), `.gitignore` (`.sandbox/`),
  `packages/web/src/__tests__/build.test.ts`, `AGENTS.md` (one line under Shell)
- Test: `packages/web/sandbox/__tests__/seed.test.ts`,
  `packages/web/sandbox/__tests__/sandbox.test.ts`, `packages/server/scripts/__tests__/dev.test.ts`

**Interfaces:**

- Consumes: Tasks 1, 5, 6, and 7.
- Produces:
  `seed(root: string, { reset }: { reset: boolean }): { configDir; dataDir; projects; stale: boolean }`,
  building `.sandbox/` into a temporary folder renamed into place, stamped with the builders'
  version; `devHandler`'s `started?: (server: StartedServer) => void`; `dev.ts [--config <file>]`.

- [ ] **Step 1: Write the failing tests**

```ts
// seed.test.ts
test("a second seed keeps the state, and a reset rebuilds it", () => {
  /* answer a round, seed again, still answered; reset, waiting */
});
test("builders changed since the seed print the reset hint, and keep the state", () => {
  /* stale: true */
});
test("the real data and config folders are untouched by a run", async () => {
  /* .env naming them; hash before and after */
});
test("a seed interrupted midway leaves no half-built .sandbox", () => {
  /* review focus 2 */
});

// sandbox.test.ts
test("the sandbox serves Home with sample, empty, and broken, locked, without sign-in", async () => {
  /* ... */
});
test("a restart keeps an answered round", async () => {
  /* US2 2 */
});

// build.test.ts
test("the build holds no sandbox code, source attribute, or code-inspector client", () => {
  /* ... */
});

// dev.test.ts
test("dev.ts passes --config on to vp dev, and runs vp dev alone without it", () => {
  /* ... */
});
```

The break each test catches:

- Keeps the state: a seed rebuilt at every start.
- Builders changed: a silent stale seed, or one wiped without asking.
- Real folders: `.env` read, or a default data folder computed.
- Interrupted: a half-built folder the next start trusts.
- Serves Home: sign-in left on, or the real list shown.
- Restart: state in a temporary folder.
- Build: the sandbox's plugin or bar reaching `dist/`.
- `dev.ts`: `vp run dev` broken by the new argument.

- [ ] **Step 2: Run them to check they fail**

- Expected: FAIL, `Cannot find module '../seed.ts'`.

- [ ] **Step 3: Implement**

The command seeds, prints the warning when `stale`, sets `URAEDA_REPO`, `URAEDA_DATA_DIR`,
`URAEDA_CONFIG_DIR`, and `URA_TODAY`, puts the fake `gh` first, then runs
`dev.ts --config packages/web/vite.sandbox.config.ts`. The config adds `uiTransforms()`,
`sourceLocations()`, the pick script and `src/sandbox/main.tsx` to the page, and
`uraedaServer({ adapter: sandboxAgent(), file: false, lockedList: true, signIn: false, started })`,
on 127.0.0.1, port 4410 or the next free one, printing `Sandbox: http://127.0.0.1:<port>/`.
`started` calls `atWork`. `--reset` reaches the seed as `vp run sandbox --reset`.

- [ ] **Step 4: Run the project's validation, and take the screenshots**

- Run: `vp run ready`. Then, in the sandbox, screenshots of the bar's four states, and of Home on
  each project, at both sizes and themes, reviewed and saved in
  `specs/2026-10-20-ui-sandbox/screenshots/`.
- Expected: PASS. Time the first and a later start for SC-001: under 60 and 15 seconds.

- [ ] **Step 5: Commit**

```bash
git add packages/web/sandbox packages/web/vite.sandbox.config.ts packages/server package.json .gitignore packages/web/src/__tests__/build.test.ts AGENTS.md specs/2026-10-20-ui-sandbox/screenshots
git commit -m "feat(ui-sandbox): vp run sandbox"
```
