---
status: auto-approved
spec-revision: 3
---

# Plan: UI iteration flow

**Goal:** a story link alone in its paragraph, in any workflow file or agent message, shows the
story live from the checkout's Storybook, which Uraeda runs and forwards under its own address, with
pick mode and comments; and Uraeda gets a Storybook of its own.

**Architecture:** as in the [spec's architecture](spec.md#architecture), with these owners:

- **The core** owns what a file says. `files/stories.rs` decides which links are story links
  (`story_link`, `story_target`) and which paragraphs embed one (`story_links`). Every `SpanLink`
  carries its `story`, so the UI knows an inline story link without a rule of its own, and every
  file's version and every draft carries its `stories`. `files/preview.rs` owns the preview
  decision's two fields: `ura check` and `api::preview(checkout)` both call it, so the rule has one
  home.
- **The server** owns processes and traffic. `preview/runner.ts`'s `Previews` is the only code that
  starts, watches, and stops Storybook processes, one per checkout's base path,
  `/r/<name>/preview/<folder>/`. Its state lives in memory only; the server creates it in
  `startServer`, and `stop` stops every process. `preview/index.ts` reads a ready Storybook's
  `index.json` and matches a story link to an entry. `preview/proxy.ts` forwards HTTP reads and
  WebSocket upgrades to the process `Previews` names, and nothing else. `guard.ts`'s one check runs
  for every request and every upgrade.
- **fate** reads three records: `Story` (one story link of one checkout: reading it is a view),
  `Preview` (one checkout's Storybook, for its page: a view too), and `StoryHref` (whether an
  agent's link is a story link, through the binding's `storyLink`: not a view). Feature and
  workspace records say whether their checkout has an active preview decision, so rows and embeds
  show without starting anything. When a checkout's state changes, its `Preview` record and every
  `Story` record read for it get a live update on their repository's bus.
- **The web UI**: `StoryEmbed.tsx` owns the frames, widths, colour mode, pick mode, and the comment.
  `stories.tsx` holds `StoryContext`, which each page that draws a workflow file or a transcript
  fills: the checkout's folder, the version's stories, and where a comment goes. `Blocks`, `Spans`,
  `Question`, and the transcript read it, so no caller of `Blocks` changes. `StorybookPage.tsx`
  frames Storybook's own interface.
- **The skill** ships `uraeda-preview.js` and `uraeda-pick.js`, used unchanged by Uraeda's own
  Storybook, and the preview decision's template.

The tests share one fake preview, `fixtures/preview/serve.mjs`, and one test feature,
`2026-10-20-sidebar-resize`, the spec's own example, built by `addStoryFeature` in the binding's
test utilities.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **Uraeda's own stories read their data through fate's POST requests, which the proxy refuses.**
   Embedded in Uraeda, a story of `packages/web` still shows the fixture's data: its fate client
   sends each request as a GET to its own Storybook, which turns it back into the POST the server
   expects. Task 12, and [R4](rulings.md#r4-uraedas-storybook-sends-fates-requests-as-gets).
2. **A frame that Storybook reloads** sends `ready` again: it gets the colour mode, and pick mode
   when on, again, and its old height is kept until its next `size`. Task 7, and task 9 for pick
   mode.
3. **Two embeds of one checkout read at once** start one process, not two. Task 4.
4. **The Storybook page stays open past 30 minutes** without its Storybook stopping: it asks again
   every 5 minutes, as an embed does. Task 8.
5. **A forwarded response streams**, as fate's live updates and Storybook's own event streams need:
   its first bytes arrive before it ends. Task 5.
6. **A `size` message whose height is not a finite number above 0** is ignored, as any malformed
   message: the frame keeps its height. Task 7.
7. **A Storybook that exits after it was ready** turns `failed` with its last line, and the proxy
   answers 503 at once, never forwarding to a port another program may take next. Tasks 4 and 5.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these.

Existing guarantees to preserve:

- The guard's existing table, [`guard.test.ts`](/packages/server/src/__tests__/guard.test.ts), keeps
  passing unchanged: every route but `/r/<repository>/preview/` keeps the `Origin` rule. Task 5 adds
  rows, removes none.
- HTML mockups keep working as today, through [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx)
  and `/mockups/`: [`mockup.test.tsx`](/packages/web/src/__tests__/mockup.test.tsx) and
  [`review.test.tsx`](/packages/web/src/__tests__/review.test.tsx) keep passing.
- Workflow files are drawn from the core's document tree: the UI never decides by itself which link
  is a story link, nor which paragraph embeds one.

From [stack](../decisions/stack.md), word for word:

- Workflow logic, parsing, validation, and workflow states MUST live in the Rust core,
  [`crates/core`](/crates/core/). Checked by review.
- TypeScript code MUST reach the core only through the binding,
  [`packages/binding`](/packages/binding/), and MUST NOT reimplement its parsing, validation, or
  states. Checked by review.
- The TypeScript types of core data MUST come from the declarations napi-rs generates for the
  binding. They MUST NOT be redeclared by hand in TypeScript. Checked by review.
- The web UI MUST use React and Astryx components, live in [`packages/web`](/packages/web/), and get
  its data only from the server, through fate. Checked by review.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  their markdown, with a library or by hand. It MAY render an agent's messages, which are not
  workflow files, with Astryx's `Markdown` component. Checked by review.
- The server MUST listen on 127.0.0.1 only. It MUST reject requests whose `Host` is not `127.0.0.1`
  or `localhost` on its port, or a host name listed in `URAEDA_ALLOWED_HOSTS`. It MUST reject
  requests whose `Origin`, when present, is not the server's own, `https://` and a listed host name,
  or an allowed origin, except GET and HEAD requests and WebSocket upgrades under
  `/r/<repository>/preview/`, which MAY carry `Origin: null`. Checked by the guard's tests.
- The server MAY start the command of a project's active [preview](../decisions/preview.md)
  decision, read from a checkout, in that checkout, bound to 127.0.0.1 on a free port. It MUST
  forward only that process's GET and HEAD requests and WebSocket upgrades, under
  `/r/<repository>/preview/<folder>/`, with `Access-Control-Allow-Origin: *` and a
  `Content-Security-Policy` of `sandbox allow-scripts allow-popups` on every response. It MUST stop
  the process when the server stops. Checked by the preview proxy's and runner's tests.
- The web UI MAY show a preview's pages only in frames sandboxed without `allow-same-origin`. It
  MUST accept messages only from those frames' windows, and MUST NOT give a frame any data beyond
  the story to show, its colour mode, and whether pick mode is on. Checked by the embed's tests.

From [preview](../decisions/preview.md), word for word:

- Uraeda's preview MUST be the Storybook of `packages/web`, run there by
  `pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}`. This
  decision's frontmatter MUST hold them as `preview-folder: packages/web` and that
  `preview-command`. Checked by `ura check`.
- Mockups of Uraeda's planned UI and named states of its views MUST be Storybook stories, in a
  `<Component>.stories.tsx` file next to the component in `packages/web/src`, one export per state
  or variant. Checked by review.
- Storybook's dev server MUST run Uraeda's server over a fresh copy of
  [`fixtures/repo`](/fixtures/repo/), on the fake agent, with `URA_TODAY` set to `2026-10-16` and
  fixed commit dates, so stories get their data only from the server, through fate. Stories MUST NOT
  fake the server's responses. Checked by review.
- Storybook's `main.ts` MUST be wrapped by the skill's `uraeda-preview.js`, imported from
  [`skills/uraeda/assets/storybook/`](/skills/uraeda/assets/storybook/), so Uraeda can serve it
  under its own address. Checked by the validation script.
- Storybook's preview MUST wrap every story in Uraeda's theme, with its colour mode from the
  embedding page, and MUST load the skill's pick script, `uraeda-pick.js`. Checked by review.
- Stories MUST follow the [UI components](../decisions/ui-components.md) decision: its lint rules
  cover `*.stories.tsx` files. Checked by lint.
- Storybook's automatic test of each story MUST be off. A story MAY run as a test only when it
  guards a spec's acceptance scenario, edge case, or success criterion, as the
  [UI checks](../decisions/ui-checks.md) decision requires of every UI test. Checked by review.
- `vp run ready` MUST build Storybook, so a story that does not compile fails the check. Checked by
  the `storybook:build` task.
- Storybook's packages MUST be pinned to exact versions, upgraded deliberately and together, and its
  telemetry MUST be off. Checked by review.

From [UI components](../decisions/ui-components.md), word for word:

- Raw `button`, `input`, `textarea`, `select`, and `dialog` elements MUST NOT be written in
  `packages/web/src`. Lint (`react/forbid-elements`) names the Astryx component to use instead.
- Components MUST NOT take a `style` prop, and Astryx components MUST NOT take a `className`. Their
  own styles go through `xstyle`.
- The app's own styles MUST be written with `stylex.create`, in the file of the component that uses
  them, and MUST use Astryx's tokens for colours, spacing, sizes, radii, borders, and type. Raw
  values are allowed only for `0`, percentages, `auto`, and layout keywords. StyleX's lint plugin
  (`valid-styles`) enforces it.
- No stylesheet MAY be imported besides Astryx's reset, core, and theme stylesheets.
- Sizes MUST come from the theme. A size the theme lacks is added to the theme, not written in a
  component.

From [UI layout](../decisions/ui-layout.md), word for word:

- The UI MUST have two width classes: narrow, under 768 px, and wide, from 768 px, taken from the
  theme's `md` breakpoint. A layout MUST be chosen by width, never by device type, user agent, or
  pointer.
- Components MUST NOT write their own media queries with sizes. They read the width class from one
  shared hook, or the theme's adaptations.
- On wide screens, menus MUST be popovers and short forms dialogs. On narrow screens, both MUST be
  bottom sheets. Astryx's `presentation="adaptive"` SHOULD be used where a component offers it.
- Under a coarse pointer, every control MUST be at least 44 px tall, through the theme's
  adaptations.

From [UI behaviour](../decisions/ui-behaviour.md), word for word:

- A text field MUST save only when the human presses its Save button, its own key (Enter in a
  one-line field, Ctrl+Enter or Cmd+Enter in a multi-line one), or a button that uses its text, like
  Add comment, Submit, Commit, Start, or a verdict. It MUST NOT save as it is typed, after a pause,
  or when it loses the focus.
- The unsaved text of every field MUST be kept in the browser until it is saved or discarded, and
  restored when the field shows again, with a notice saying so and a Discard button.
- Every sheet and dialog MUST have a visible close button, and Back MUST close it.
- Errors MUST stay on screen until the human deals with them, or the action is retried.

From [UI checks](../decisions/ui-checks.md), word for word:

- Every UI test MUST guard a spec's acceptance scenario, edge case, or success criterion, or a rule
  of a UI decision. A test that guards neither MUST NOT be added.
- UI tests MUST drive the UI as a user does, through roles, labels, and visible text, and assert
  what the user sees or what is written to the repository. They MUST NOT assert markup structure,
  class names, or snapshots of rendered output.
- `vp run ready` MUST run, in WebKit, at 402 × 874 and at 1440 × 900, on every page a UI decision
  governs: no text cut, no sideways scroll, the text sizes and control heights of the
  [UI layout](../decisions/ui-layout.md) decision, and axe-core's WCAG 2.1 A and AA rules in light
  and dark.

From [code quality](../decisions/code-quality.md), word for word:

- Rust and TypeScript functions MUST NOT be longer than 100 lines. Checked by clippy's
  `too_many_lines` and Oxlint's `max-lines-per-function`.
- Rust and TypeScript functions MUST NOT take more than 7 parameters. Checked by clippy's
  `too_many_arguments` and Oxlint's `max-params`.
- Code MUST NOT nest blocks more than 4 levels deep inside a function. Checked by clippy's
  `excessive_nesting` and Oxlint's `max-depth`.
- Rust and TypeScript source files MUST NOT be longer than 500 lines. Tests and generated files are
  exempt. Checked by Oxlint's `max-lines`, and for Rust by a structural test of the workspace.
- A new marker MUST NOT be added unless a human approves it as a constitution exception in the
  plan's complexity tracking. Checked by review.
- Unit tests MUST NOT sleep for a fixed time, or assert how long something took. Benchmarks of a
  spec's success criteria are exempt. Checked by review.

From [toolchain](../decisions/toolchain.md), word for word:

- Each check of `ready` MUST be a task of `vite.tasks.ts`, cached by Vite Task, with its inputs
  listed in `cache.input`: a check MUST NOT rely on automatic input tracking. Checked by the test of
  the toolchain's configuration.
- Files generated by napi-rs MUST be committed, and MUST NOT be edited by hand. Checked by CI's
  clean working tree.
- New web UI code MUST follow the Rules of React that the compiler relies on: no reading or writing
  a ref's `current` during render, and no mutation of props, state, or values a render captured.

From [agents](../decisions/agents.md): "The tests that `vp run ready` runs MUST use a fake adapter,
and MUST NOT run a real agent."

From [the spec](spec.md), word for word:

- Paths: a story's frame is at `/r/<repository>/preview/<folder>/iframe.html?id=<id>&viewMode=story`
  and its Storybook page at `/f/<folder>/storybook?path=/story/<id>`; the main checkout's path is
  `/r/<repository>/preview/main/`, its page `/storybook`.
- Texts: "Starting Storybook for this branch…"; "Storybook did not start: <its last line of
  output>", with "Try again"; "Storybook did not start within 2 minutes."; "No story “Dragging” in
  packages/web/src/SidebarHandle.stories.tsx on this branch.", with "Open in Storybook"; "This
  variant was removed after your answer."; "This feature has no worktree, so its stories cannot run
  here."; "uraeda-preview.js needs Storybook's Vite builder."; "No free port for Storybook.";
  "Storybook's index could not be read."; "Storybook is not running for this branch." (503); "Click
  an element to comment on it. Escape to stop.", and "Tap an element to comment on it." under a
  coarse pointer.
- The toolbar: the label, an Astryx segmented control "Both", "Phone", and "Desktop" on wide
  screens, then "Pick an element", "Comment", and "Open in Storybook". Narrow screens show the three
  buttons as named icon buttons.
- The frames: `title` set to "<label>, phone" and "<label>, desktop", and sandbox
  `allow-scripts allow-popups`. "Both" shows the 402 px frame unscaled, next to the 1440 px frame
  scaled to the space left. "Phone" and "Desktop" show one, the desktop scaled to the column. Their
  height comes from the `size` message, or is 560 px.
- Comment text: `Story <file name>#<export>`. When an element is picked,
  `, <phone or desktop>, <role> “<name>”` follows, the width only while both show. Then `: ` and the
  text. The form's anchor: "Comment on <label>", followed by the width and the element when one is
  picked.
- Messages, all objects with a `uraeda` field: from a frame `{ uraeda: "ready" }`,
  `{ uraeda: "size", height }`, `{ uraeda: "picked", role, name, text }`,
  `{ uraeda: "pick-stopped" }`; to a frame `{ uraeda: "pick", on }`,
  `{ uraeda: "mode", mode: "light" | "dark" }`.
- The runner polls `index.json` every 500 ms, for up to 2 minutes; keeps the last 50 lines of
  output, retries once on a taken port, and restarts on demand; stops a process group after 30
  minutes without a view, when the worktree is removed, and at exit. An embed on screen asks again
  every 5 minutes.
- The proxy replaces Storybook's `Content-Security-Policy` with `sandbox allow-scripts allow-popups`
  (the spec adds `; frame-ancestors 'self'`, dropped by
  [R29](rulings.md#r29-the-proxy-sets-no-frame-ancestors)), keeps the full path for Vite's
  `vite-hmr` protocol and removes the path otherwise, and removes the `Origin` header of upgrades.
- A paragraph is an embed when it holds exactly one link, and nothing but whitespace around it. The
  link's path must end in `.stories.` and one of `js`, `jsx`, `ts`, `tsx`, `mjs`, or `svelte`, and
  its fragment must be a JavaScript identifier.
- The packages `storybook` and `@storybook/react-vite`, pinned at 10.6.2; the `storybook:build`
  task's inputs are `packages/web/src/**`, `packages/web/.storybook/**`, the two skill files, and
  the lockfile, without the Storybook cache folder.

## Code read

- [`crates/core/src/files/document.rs`](/crates/core/src/files/document.rs) (664 lines, listed at
  686 in [`structure.rs`](/crates/cli/tests/structure.rs)): `Span` and `SpanLink`, built by
  [`document/inline.rs`](/crates/core/src/files/document/inline.rs)'s `link()`, which resolves a
  link's `path` from the repository's root with
  [`workspace/links.rs`](/crates/core/src/workspace/links.rs)'s `resolve`. A paragraph holding only
  a link is a `Paragraph` block whose spans all carry that link; in a list it is an `Item`.
- [`crates/core/src/files/spec.rs`](/crates/core/src/files/spec.rs): `mockups()` reads `## Mockups`
  links whose target starts with `mockups/`, into `MockupLink`
  ([`items.rs`](/crates/core/src/files/items.rs)). Its tests read the example's spec
  ([`tests/items.rs`](/crates/core/tests/items.rs), `a_spec_has_its_mockups`, and the folds' line
  numbers at line 179).
- [`crates/core/src/api.rs`](/crates/core/src/api.rs) (859 lines, its baseline): `version()` builds
  `VersionView` for `file_view`; `text_view` builds `DraftView`. Its modules live in `api/`.
- [`crates/core/src/view.rs`](/crates/core/src/view.rs) (499 lines): `VersionView`, `DraftView`,
  `FeatureView`; every type the binding returns.
- [`crates/core/src/check/values.rs`](/crates/core/src/check/values.rs) and
  [`check/mod.rs`](/crates/core/src/check/mod.rs): `fields(kind)` lists each kind's fields,
  `kind_of` makes every `decisions/*.md` a `Checked::Decision`, unknown fields report
  `unknown field "<key>"`. [`check/links.rs`](/crates/core/src/check/links.rs) checks links only to
  markdown files and into `specs/`, so a link to a stories file outside `specs/` is never a problem.
  [`tests/check.rs`](/crates/core/tests/check.rs) breaks a copy of the example, one row per rule.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): each function wraps an `api::` function
  in a `job`; `version()` is the synchronous pattern. Its declarations are generated into
  [`packages/binding/index.d.ts`](/packages/binding/index.d.ts) by `vp run binding:build`.
- [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts): `fixtureRepo()`,
  `commitOnBranch()`, `temporaryFolder()`, shared by the server's and the UI's tests.
- [`packages/server/src/app.ts`](/packages/server/src/app.ts): `createApp` (78 lines) mounts the
  guard, the repositories' routes behind `hosted`, the fate endpoints, and the files.
  [`guard.ts`](/packages/server/src/guard.ts) checks `Host`, then `Origin`, then `Sec-Fetch-Site`
  for writes. [`server.ts`](/packages/server/src/server.ts)'s `startServer` builds sessions, hosts,
  and the app, and `stop` closes them. [`main.ts`](/packages/server/src/main.ts) owns the Node HTTP
  server; nothing listens for `upgrade` today. [`dev.ts`](/packages/server/src/dev.ts)'s
  `SERVER_PATHS` picks what `vp dev` sends to Hono; the Vite plugin `uraedaServer` in
  [`packages/web/vite.config.ts`](/packages/web/vite.config.ts) mounts `devHandler`.
- [`packages/server/src/fate/`](/packages/server/src/fate/): records are read by id through
  `fileSource` ([`sources.ts`](/packages/server/src/fate/sources.ts)), typed in
  [`views.ts`](/packages/server/src/fate/views.ts); `featureRecord` is in
  [`sessions.ts`](/packages/server/src/fate/sessions.ts); live updates go through each host's bus
  ([`live.ts`](/packages/server/src/live.ts)'s `publish`). Server tests use
  [`__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts) (`testApp`, `byId`, `mutate`),
  whose `afterEach` closes what each test opened.
- [`packages/web/src/Blocks.tsx`](/packages/web/src/Blocks.tsx): `BlockNode` (92 lines) draws each
  kind; `override` skips the `Selectable` wrap. [`Spans.tsx`](/packages/web/src/Spans.tsx)'s
  `SpanLink` sends a link through `pathLink` ([`routes.tsx`](/packages/web/src/routes.tsx)), raw
  files to `/raw/`. Every caller of `Blocks`: `DocumentPage`, `ReviewPage`, `RoundPage`, `Question`,
  `SettledPoints`, `EditorPage`, `TaskView`.
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) (`ReviewPage`, 99 lines) comments through
  `fate.mutations.review.comment` with `startLine`, `endLine`, and `text`, as
  [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx) does; pending comments show under their block
  through `selection.after`. [`ReviewMockups.tsx`](/packages/web/src/ReviewMockups.tsx) navigates to
  a mockup's page.
- [`Question.tsx`](/packages/web/src/Question.tsx) (`Question`, 90 lines): `Option` draws
  `choice.other` inside its raw `button`. [`useAnswer.ts`](/packages/web/src/useAnswer.ts) saves
  letters and comment through `answer.save`.
- [`Transcript.tsx`](/packages/web/src/Transcript.tsx): `TranscriptItems` renders an agent's text
  with Astryx `Markdown`, whose `components.paragraph` and `components.link` overrides exist
  (`@astryxdesign/core` 0.6.8, `Markdown.d.ts`).
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) (486 lines) holds the composer's `draft`,
  with `setText`, and passes it to `SessionLog`.
- [`FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx): `FeaturePage` is marked
  `max-lines-per-function`. [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx)'s `Pages` lists
  the feature's rows. [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx) is the shared comment
  form; [`layout/Overlay.tsx`](/packages/web/src/layout/Overlay.tsx) is the phone's sheet;
  [`layout/useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts) the width class;
  [`theme.tsx`](/packages/web/src/theme.tsx) the colour mode;
  [`theme/theme.ts`](/packages/web/src/theme/theme.ts) the theme's sizes (`--size-*`).
- The browser tests: [`vite.browser.config.ts`](/packages/web/vite.browser.config.ts) runs WebKit at
  402 × 874 (touch) and 1440 × 900, the server in Vite's process on a fake agent, each test on a
  fresh copy of the fixture (`takeRepo`), with Playwright commands for what the page cannot do;
  [`__browser__/helpers.tsx`](/packages/web/src/__browser__/helpers.tsx) gives `show`, `atRepo`,
  `atSize`, `checkLayout`; [`layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx) runs
  the UI checks decision's checks per page.
- [`vite.tasks.ts`](/vite.tasks.ts): `ready`'s tasks and their inputs, which
  [`toolchain.test.ts`](/packages/server/src/__tests__/toolchain.test.ts) checks, and CI runs by
  group. [`vite.config.ts`](/vite.config.ts): the lint rules and limits; lint and format cover every
  file but the listed generated ones.
- [`packages/web/scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts) copies the example's
  `mockups/repeat.html` into its fixture.
- [`packages/uraeda/scripts/build.ts`](/packages/uraeda/scripts/build.ts) copies the whole skill
  through the plugin's symlink, and the core embeds it for `ura init` and `ura install`: new files
  under `skills/uraeda/assets/` ship with no change.
- The spike's working files, `/tmp/sbspike/main.ts.working` and `/tmp/sbspike/proxy.mjs`, outside
  the repository and not needed to build, showed the changes the helper and the proxy need, as
  listed in the [spec's architecture](spec.md#architecture): the two tags, the WebSocket constructor
  patch in `previewHead` and `managerHead`, StyleX's `'/virtual:stylex.css'`, the full path for
  `vite-hmr`, `Origin` removed on upgrades, `Host` rewritten. Its static build's `index.json`
  (Storybook 10.6.2) records each entry's `importPath`, relative to where Storybook runs, and its
  `exportName`.
- `skills/uraeda/references/change.md` is not on `main`: it is on the `2026-10-15-add-bugfixing`
  branch only.
- Validation: `cargo nextest run`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `vp run binding:build`, `vp check`, `vp test --project '!phone' --project '!desktop'`,
  `vp test --project desktop`, `vp test --project phone`, and `vp run ready` for all of them.

## Constitution check

| Principle                                  | Complies | Notes                                                                                                                        |
| ------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | The runner starts only the command of an active decision, read from the checkout. Every comment and pick is the human's.     |
| II. Git and plain text first               | yes      | Story links are plain markdown; comments go to review files, answers, or the composer. The runner's state is a cache.        |
| III. Asynchronous by default               | yes      | Nothing durable lives in the runner: a Storybook starts again from the repository on the next view.                          |
| IV. Review effort matches impact           | yes      | Stories embed where the spec links them, at both widths, and a comment names the element.                                    |
| V. Tools are optional                      | yes      | Links read on GitHub, the decision's command runs by hand, and the skill describes every rule `ura check` follows (task 13). |
| VI. Code is checked and stays maintainable | yes      | A test per scenario; every unit at a limit is split first; no marker is added, and `FeaturePage`'s goes.                     |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Preview](../decisions/preview.md): its frontmatter fields (task 2); Uraeda's Storybook, its
  wrapping, fixture server, theme, pick script, pins, telemetry, and build (task 12).
- [Stack](../decisions/stack.md): the rules live in the core (tasks 1, 2); the runner and the proxy
  (tasks 4, 5); the guard's exception (task 5); sandboxed frames and their messages (tasks 7, 9).
- [UI components](../decisions/ui-components.md): the embed, its toolbar, the Storybook page, and
  stories use Astryx components and theme sizes (tasks 7 to 12).
- [UI layout](../decisions/ui-layout.md): both widths on wide screens, the phone's on narrow ones,
  the comment sheet on the phone, the Storybook page a page of its own (tasks 7 to 9).
- [UI behaviour](../decisions/ui-behaviour.md): the comment saves by its button or Ctrl+Enter, its
  unsaved text kept (tasks 9 to 11).
- [UI checks](../decisions/ui-checks.md): every browser test names its scenario; the layout checks
  gain an embed and the Storybook page (tasks 7, 8).
- [Agents](../decisions/agents.md): the chat tests use the fake agent (task 11).
- [Git](../decisions/git.md): the runner never creates nor switches a checkout; it runs in the
  worktree the core names (task 6).
- [Code quality](../decisions/code-quality.md): splits come first in their own commits, no marker is
  added (tasks 1, 5, 7, 8, 9, 10).
- [Toolchain](../decisions/toolchain.md): `storybook:build` is a cached task with its inputs, in
  `ready:typescript` (task 12); the binding's generated files are committed (tasks 1, 2).

## Complexity tracking

| Abstraction or exception                                                                   | Why it is needed                                                                                                         | Simpler alternative rejected because                                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `files/stories.rs`: `StoryTarget`, `StoryLink`, and `SpanLink.story`                       | The [spec's data](spec.md#data): one home for the story link rule, read by views, mockups, and the binding               | A rule in TypeScript would copy the core's, against the stack decision                                  |
| `files/preview.rs`: `Preview` and its field check                                          | `ura check` and `api::preview` share the fields' rule                                                                    | Two checks would drift: a decision `ura check` accepts and the server refuses                           |
| `view/version.rs`, `document/inline.rs` holding `SpanLink`                                 | `api.rs` is at its baseline, `view.rs` at 499 lines, `document.rs` may only shrink                                       | Growing them breaks the structural test                                                                 |
| `Previews` (`preview/runner.ts`), `preview/index.ts`, `preview/proxy.ts`                   | The spec's units: processes, matching, and traffic each have one owner                                                   | One module would mix process lifetimes with HTTP forwarding                                             |
| `guardCheck`, shared by the guard middleware and the upgrade handler                       | Upgrades bypass Hono: one rule for both, or the exception drifts                                                         | A second check in the upgrade handler would copy the `Origin` rule                                      |
| fate records `Story`, `Preview`, and `StoryHref`                                           | A story's state, a checkout's state, and an agent link's check are read separately, and only the first two are views     | One record would start Storybook for every link in a message                                            |
| `StoryContext` (`stories.tsx`), filled by six pages                                        | `Blocks` has seven callers; the context reaches every one without a new prop, and a question overrides where comments go | A prop through every `Blocks` caller grows `SettledPoints` (100 lines) and `Question` past their limits |
| `StoryEmbed`, `StorybookPage`                                                              | The spec's components                                                                                                    | None                                                                                                    |
| `fixtures/preview/serve.mjs`, `addPreview` and `addStoryFeature`, and the browser commands | One fake preview and one feature shared by the server's and the browser's tests                                          | Each test writing its own repository would bury what it checks                                          |
| The fate GET transport of Uraeda's Storybook (`.storybook/fateOverGet.ts`)                 | Review focus 1: the proxy forwards only reads, and fate queries are POSTs                                                | Forwarding POSTs breaks the stack decision; stories without data break the preview decision             |
| The test forwarding proxy for SC-006, and `devHandler`'s `allowOrigins`                    | WebKit cannot map a host name; the page must run under `uraeda.test`                                                     | A Chromium-only test leaves WebKit, the UI checks decision's browser, unchecked                         |
| Splits: `BlockNode`, `ReviewPage`, `Question`, `FeaturePage` (marker removed), `createApp` | Each grows in this feature and is at or over 100 lines                                                                   | Growing them breaks the limits                                                                          |

No constitution exception, and no new marker.

---

## Task 1: Story links in the core

**Files:**

- Create: `crates/core/src/files/stories.rs`, `crates/core/src/view/version.rs`
- Modify: `crates/core/src/files/document.rs` (`Span`, `SpanLink`, `SpanImage` move out),
  `crates/core/src/files/document/inline.rs` (`link()`), `crates/core/src/files/mod.rs`,
  `crates/core/src/files/spec.rs` (`mockups()`), `crates/core/src/files/items.rs` (`MockupLink`),
  `crates/core/src/view.rs` (`DraftView`), `crates/core/src/api.rs` (`version`, `text_view`)
- Modify: `packages/binding/index.d.ts`, generated; `packages/server/src/fate/sources.ts`
  (`missingFile`'s empty version gains `stories: []`,
  [R13](rulings.md#r13-a-missing-files-empty-version-has-no-stories))
- Test: `crates/core/tests/stories.rs`, `crates/core/tests/items.rs`, `crates/core/tests/check.rs`,
  `crates/core/tests/api.rs`

**Interfaces:**

- Produces, in `files/stories.rs`, napi objects: `StoryTarget { path: String, export: String }`,
  `path` from the repository's root;
  `StoryLink { path: String, export: String, label: String, block: u32 }`.
- Produces: `story_target(dir: &str, target: &str) -> Option<StoryTarget>`, a link's story as
  written in a file of `dir`; `story_link(href: &str) -> Option<StoryTarget>`, the same from the
  root (`dir` empty), for agent messages; `story_links(doc: &Document) -> Vec<StoryLink>`, the
  paragraphs that embed one, in order.
- Produces: `SpanLink.story: Option<StoryTarget>`; `VersionView.stories: Vec<StoryLink>`;
  `DraftView.stories: Vec<StoryLink>`; `MockupLink.story: Option<StoryTarget>`, with `path` then the
  stories file from the root.
- Changes: `mockups()` also takes a list item linking a story, and an HTML link written from the
  root whose path ends in `mockups/<file>.html`, as `path: "mockups/<file>.html"`
  ([R8](rulings.md#r8-an-html-mockup-from-the-root-is-read-by-its-last-two-parts)).

- [x] **Step 1: Move `Span`, `SpanLink`, and `SpanImage` into `document/inline.rs`, and
      `VersionView` with `version()` into `view/version.rs`, before they change**

`document.rs` re-exports the three types, so their paths stay `files::document::*`. `view.rs`
re-exports `VersionView`; `api.rs` calls `VersionView::new(name, text, dir)` in place of its
`version()`. Nothing else changes.

- Run: `cargo nextest run && cargo clippy --workspace --all-targets -- -D warnings`, before and
  after
- Expected: PASS both times; `structure.rs` passes with `api.rs`, `document.rs`, and `view.rs`
  shorter

```bash
git add crates/core/src
git commit -m "refactor(ui-iteration): spans in inline.rs, versions in view/version.rs"
```

- [x] **Step 2: Write the failing tests**

```rust
// crates/core/tests/stories.rs: one row per paragraph, link, path, and fragment
#[test]
fn which_paragraphs_embed_a_story() {
    let rows: &[(&str, &str, Option<(&str, &str, &str)>)] = &[
        ("from the root", "[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)",
            Some(("packages/web/src/SidebarHandle.stories.tsx", "Dragging", "Dragging the handle"))),
        ("relative to the file", "[Invoice list](mockups/InvoiceList.stories.tsx#Empty)",
            Some(("specs/2026-11-02-invoices/mockups/InvoiceList.stories.tsx", "Empty", "Invoice list"))),
        ("spaces around", "  [A](/a.stories.ts#A)  ", Some(("a.stories.ts", "A", "A"))),
        ("a marked label", "[**Thin** line](/a.stories.jsx#ThinLine)", Some(("a.stories.jsx", "ThinLine", "Thin line"))),
        ("mjs", "[A](/a.stories.mjs#A)", Some(("a.stories.mjs", "A", "A"))),
        ("svelte", "[A](/a.stories.svelte#A)", Some(("a.stories.svelte", "A", "A"))),
        ("js", "[A](/a.stories.js#$a_1)", Some(("a.stories.js", "$a_1", "A"))),
        ("vue", "[A](/a.stories.vue#A)", None),
        ("not a stories file", "[A](/src/Button.tsx#A)", None),
        ("no export", "[A](/a.stories.tsx)", None),
        ("an export that is no identifier", "[A](/a.stories.tsx#1st)", None),
        ("a dash", "[A](/a.stories.tsx#Drag-ging)", None),
        ("text around", "See [A](/a.stories.tsx#A).", None),
        ("two links", "[A](/a.stories.tsx#A) [B](/a.stories.tsx#B)", None),
        ("a web link", "[A](https://x.dev/a.stories.tsx#A)", None),
        ("an image", "![A](/a.stories.tsx#A)", None),
    ];
    for (case, markdown, expected) in rows {
        let doc = parse(markdown, "specs/2026-11-02-invoices");
        let found = story_links(&doc).first().map(|s| (s.path.clone(), s.export.clone(), s.label.clone()));
        assert_eq!(found.as_ref().map(|(p, e, l)| (p.as_str(), e.as_str(), l.as_str())), *expected, "{case}");
    }
}
```

Also in `stories.rs`:

- `a_story_link_in_a_list_item_is_inline`: `- [A](/a.stories.tsx#A)` gives no `StoryLink`, and the
  item's span has `link.story == Some(StoryTarget { path: "a.stories.tsx", export: "A" })`.
- `an_agent_link_is_read_from_the_root`:
  `story_link("/packages/web/src/SidebarHandle.stories.tsx#Dragging")` and
  `story_link("packages/web/src/SidebarHandle.stories.tsx#Dragging")` both give that path and
  `Dragging`; `story_link("https://x.dev/a.stories.tsx#A")` and `story_link("#A")` give `None`.
- `an_embed_names_its_paragraph`: in `"# T\n\nText.\n\n[A](/a.stories.tsx#A)\n"`, the link's `block`
  is the second paragraph's id.

In `tests/items.rs`, `the_mockups_section_takes_story_links_and_links_from_the_root`: a spec whose
`## Mockups` lists `- [Dragging](/packages/web/src/SidebarHandle.stories.tsx#Dragging): …` and
`- [Old](/specs/2026-10-20-sidebar-resize/mockups/old.html): …` gives two `MockupLink`s: the first
with `story` set and `path` `packages/web/src/SidebarHandle.stories.tsx`, the second with
`path == "mockups/old.html"` and no `story`.

In `tests/check.rs`, `a_spec_with_a_story_link_has_no_problem` (SC-003): the example's spec with
`\n[Repeat menu, open](/src/tasks/RepeatMenu.stories.tsx#Open)\n` added under US1 checks with no
problem.

In `tests/api.rs`, `a_file_and_a_draft_carry_their_stories`: a spec on the feature's branch holding
the embed, read with `read_file`, has `current.stories` with that story and the block of its
paragraph; a draft holding it, read with `read_draft`, has it too.

The break each test catches:

- The table: a suffix test on `.stories` alone, a fragment taken as any text, a link with words
  around it embedded, or a relative path left unresolved.
- In a list item: an item embedded, which the spec makes a link to the Storybook page.
- Agent links: a root path not stripped of its `/`, or a web link read as a file.
- The block: the label's block, or the first paragraph, taken for the embed's.
- Mockups: story links dropped from the review's buttons, or a link from the root ignored.
- SC-003: a check that requires stories files to exist under `specs/`, or reads `#Open` as a missing
  heading.
- Views: `stories` read on one version only.

- [x] **Step 3: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test stories`
- Expected: FAIL to compile, `unresolved import uraeda_core::files::stories`.

- [x] **Step 4: Implement**

- `story_target`: the target's `#` fragment is a JavaScript identifier (a letter, `$`, or `_`, then
  letters, digits, `$`, or `_`); its path, resolved with `resolve(dir, …)`, has a file name ending
  in `.stories.` and one of the six extensions, as the spec's data says. Web links, URIs, and
  anchors give `None`.
- `link()` in `inline.rs` sets `story` for every non-wiki link.
- `story_links`: a `Paragraph` block whose spans all carry the same link (several marks give several
  spans) with a `story`, except spans of whitespace only, and no image span. The label is the link's
  spans' text.
- `VersionView::new` and `text_view` fill `stories` from their document.
- `mockups()`: a span whose link has a `story`, or whose resolved path's last two parts are
  `mockups/<file>.html`, is a mockup, its block the holder as today.
- Build the binding, so `index.d.ts` declares the new fields.

- [x] **Step 5: Run all tests**

- Run:
  `vp run binding:build && cargo nextest run && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add crates/core packages/binding/index.d.ts packages/server/src/fate/sources.ts
git commit -m "feat(ui-iteration): story links in the core"
```

## Task 2: The preview decision in the core and the binding

**Files:**

- Create: `crates/core/src/files/preview.rs`, `crates/core/src/api/preview.rs`
- Modify: `crates/core/src/check/values.rs` (`fields`, `allowed`, `check_frontmatter`),
  `crates/core/src/check/mod.rs` (`Checked::PreviewDecision`, `kind_of`),
  `crates/core/src/check/sections.rs` (template of the new kind), `crates/core/src/api.rs`
  (`mod preview;` and its `pub use`)
- Modify: `crates/binding/src/lib.rs` (`preview`, `story_link`), `packages/binding/index.d.ts`,
  `packages/binding/index.js`, generated
- Modify: `specs/decisions/preview.md` (frontmatter)
- Test: `crates/core/tests/check.rs`, `crates/core/tests/preview.rs`,
  `packages/binding/stories.test.ts`

**Interfaces:**

- Consumes: `StoryTarget`, `story_link` from task 1.
- Produces, in `files/preview.rs`: napi object `Preview { folder: String, command: String }`;
  `preview_of(text: &str) -> Option<Preview>`: `Some` when the frontmatter's `status` is `active`
  and both fields are valid; `field_problems(front: &Frontmatter) -> Vec<(&'static str, String)>`,
  each problem's rule and message, the one rule `check` reports.
- Produces: `api::preview(checkout: &Path) -> Result<Option<Preview>>`, reading
  `<checkout>/specs/decisions/preview.md` from disk; a missing file is `Ok(None)`.
- Produces, in the binding: `preview(checkout: string): Promise<Preview | null>`;
  `storyLink(href: string): StoryTarget | null`, synchronous, like `version()`.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/check.rs: one row per field value, on the example's decisions folder
#[test]
fn the_preview_decisions_fields() {
    const PREVIEW: &str = "specs/decisions/preview.md";
    let decision = |fields: &str| format!("---\nstatus: active\napproved-by: me\n{fields}---\n\n# Preview\n\n## Rules\n\n- A rule.\n\n## Why\n\nWhy.\n\n## Alternatives considered\n\n- None.\n\n## Consequences\n\n- None.\n\n## Applies to\n\n- `src/`\n");
    let rows: &[(&str, String, Option<String>)] = &[
        ("both fields", decision("preview-folder: packages/web\npreview-command: pnpm exec storybook dev --port {port}\n"), None),
        ("neither field", decision(""), None),
        ("the root", decision("preview-folder: .\npreview-command: npx storybook dev -p {port}\n"), None),
        ("no {port}", decision("preview-folder: packages/web\npreview-command: npx storybook dev\n"),
            Some(format!("{PREVIEW}: \"preview-command\" has no {{port}}"))),
        ("no command", decision("preview-folder: packages/web\n"),
            Some(format!("{PREVIEW}: no \"preview-command\" field"))),
        ("no folder", decision("preview-command: x --port {port}\n"),
            Some(format!("{PREVIEW}: no \"preview-folder\" field"))),
        ("a folder outside", decision("preview-folder: ../web\npreview-command: x {port}\n"),
            Some(format!("{PREVIEW}: \"preview-folder\" \"../web\" is not a folder of the repository"))),
        ("an absolute folder", decision("preview-folder: /web\npreview-command: x {port}\n"),
            Some(format!("{PREVIEW}: \"preview-folder\" \"/web\" is not a folder of the repository"))),
    ];
    for (case, text, expected) in rows {
        let example = Example::new();
        example.write(PREVIEW, text);

        let problems: Vec<String> = summary(&example.problems()).into_iter().filter(|p| p.starts_with(PREVIEW)).collect();

        assert_eq!(problems, expected.iter().cloned().collect::<Vec<_>>(), "{case}");
    }
}
```

Also in `tests/check.rs`, `preview_fields_belong_to_the_preview_decision`: the example's
`decisions/due-dates.md` given `preview-folder: web` reports
`specs/decisions/due-dates.md:4: unknown field "preview-folder"` (its line in the frontmatter).

```rust
// crates/core/tests/preview.rs
#[test]
fn a_checkout_has_a_preview_only_from_its_active_decision() { /* one row per case */ }
```

Rows, each writing `specs/decisions/preview.md` in a `TestRepo`, then `api::preview(repo.path())`:
active with both fields gives `Some(Preview { folder: "packages/web", command: "… {port}" })`;
`status: proposed` gives `None`; a command without `{port}` gives `None`; no file gives `None`. And
`a_worktree_reads_its_own_copy`: the decision committed on a feature's branch only, checked out in
`.worktrees/<folder>`, gives `Some` for the worktree and `None` for the main checkout.

```ts
// packages/binding/stories.test.ts
test("a story link is read through the binding", () => {
  expect(storyLink("/packages/web/src/SidebarHandle.stories.tsx#Dragging")).toEqual({
    export: "Dragging",
    path: "packages/web/src/SidebarHandle.stories.tsx",
  });
  expect(storyLink("https://example.com/a.stories.tsx#A")).toBeNull();
});

test("a checkout's preview comes from its decision", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/decisions/preview.md"), ACTIVE_PREVIEW);
  expect(await preview(repo)).toEqual({ command: "node serve.mjs --port {port}", folder: "." });
});
```

The break each test catches:

- The table: `{port}` not checked (US6.4), one field accepted alone, a path escaping the repository,
  or `.` refused, though the example's project runs at its root.
- Other decisions: the fields accepted on every decision, which the spec reports.
- `preview`: a proposed or invalid decision run, or the main checkout's copy read for a worktree.
- The binding: a function missing from `index.d.ts`, or `storyLink` made asynchronous.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test check the_preview_decisions_fields`
- Expected: FAIL on its first row, `both fields`: the fields are still unknown,
  `["specs/decisions/preview.md:4: unknown field \"preview-folder\"", "specs/decisions/preview.md:5: unknown field \"preview-command\""]`
  in place of `[]`.

- [x] **Step 3: Implement**

- `kind_of`: `decisions/preview.md` is `Checked::PreviewDecision`, with the decision's sections and
  statuses, and `preview-folder` and `preview-command` as optional fields; every other decision
  keeps reporting them as unknown.
- `field_problems`: both or neither field; `preview-command` text holding `{port}`; `preview-folder`
  text that is `.` or a relative path without `..` parts. Messages as in the table, with the rules
  `frontmatter.preview-command` and `frontmatter.preview-folder`, and no line
  ([R6](rulings.md#r6-the-preview-fields-problems-have-no-line)).
- `preview_of` and `api::preview` use `field_problems`: any problem gives `None`.
- The binding: `preview` as a `job`, `story_link` synchronous.
- `specs/decisions/preview.md` gets `preview-folder: packages/web` and
  `preview-command: pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}`.

- [x] **Step 4: Run all tests**

- Run:
  `vp run binding:build && cargo nextest run && vp test --project uraeda-binding && cargo run -q -p uraeda-cli -- check specs`
- Expected: PASS, and `specs/: no problems` apart from problems already there.

- [x] **Step 5: Commit**

```bash
git add crates packages/binding specs/decisions/preview.md
git commit -m "feat(ui-iteration): the preview decision's fields"
```

## Task 3: The skill's Storybook helper and pick script

**Files:**

- Create: `skills/uraeda/assets/storybook/uraeda-preview.js`,
  `skills/uraeda/assets/storybook/uraeda-pick.js`
- Modify: `packages/web/tsconfig.json` (`allowJs`, so the tests type the helper from its JSDoc,
  [R14](rulings.md#r14-the-helper-moves-only-storybooks-two-live-sockets))
- Test: `packages/web/src/__tests__/storybook-preview.test.ts`,
  `packages/web/src/__tests__/storybook-pick.test.ts`

**Interfaces:**

- Produces: `uraedaPreview(config, env = process.env)`, the default export of `uraeda-preview.js`,
  typed with JSDoc so `vp check` types it from `main.ts`: returns `config` itself when
  `env.URAEDA_PREVIEW_BASE` is unset; else a copy whose `viteFinal` sets `base`, adds a `post`
  `transformIndexHtml` giving the base to root-absolute `src` and `href` values, and whose
  `previewHead` and `managerHead`, both async, start with the WebSocket patch, each calling the
  config's own function first. On a webpack framework (`@storybook/nextjs`, `@storybook/angular`,
  `@storybook/ember`, or any `*-webpack5`), or a `core.builder` other than
  `@storybook/builder-vite`, it throws `uraeda-preview.js needs Storybook's Vite builder.`, and its
  `webpackFinal` throws it too; any other framework, such as `@storybook/sveltekit`, is served
  ([R18](rulings.md#r18-the-helper-refuses-only-webpack)). Names are matched with `\` made `/`.
- Produces: `uraeda-pick.js`, a classic script with no import, its names in a block, for the
  preview: it posts `{ uraeda: "ready" }` to `window.parent` on load and
  `{ uraeda: "size", height }` on each change of the story's height (`#storybook-root` with the
  body's margins and padding, else the body); on `{ uraeda: "pick", on: true }` from
  `window.parent`, it outlines the element under the pointer or pressed, swallows pointer, touch,
  and context menu events, and posts `{ uraeda: "picked", role, name, text }` for a click, then
  leaves pick mode. A click picks the control it is in, an element of an interactive role or a
  native control, a label standing for its control; else the element clicked, never a `dialog` or
  `region` around it, and never `presentation` or `none`; on Escape, or
  `{ uraeda: "pick", on: false }`, it leaves pick mode, posting `{ uraeda: "pick-stopped" }` for
  Escape.

- [x] **Step 1: Write the failing tests**

```ts
// packages/web/src/__tests__/storybook-preview.test.ts: one row per config and variable
const BASE = "/r/uraeda/preview/2026-10-20-sidebar-resize/";
const vite = { framework: "@storybook/react-vite", stories: ["../src/**/*.stories.tsx"] };

test("without the variable, the config is left as it is", () => {
  expect(uraedaPreview(vite, {})).toBe(vite);
});

test.each([
  ["the webpack framework", { framework: "@storybook/react-webpack5" }],
  ["a webpack builder", { ...vite, core: { builder: "@storybook/builder-webpack5" } }],
])("%s stops Storybook", (_, config) => {
  expect(() => uraedaPreview(config, { URAEDA_PREVIEW_BASE: BASE })).toThrow(
    "uraeda-preview.js needs Storybook's Vite builder.",
  );
});

test("Vite's base, and the two tags that ignore it, take the path", async () => {
  const wrapped = uraedaPreview(vite, { URAEDA_PREVIEW_BASE: BASE });
  const final = await wrapped.viteFinal({ plugins: [] });
  const html = await transformIndexHtml(
    final,
    '<script src="/vite-inject-mocker-entry.js"></script><script src="/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"></script><a href="//cdn.dev/x"></a>',
  );
  expect(final.base).toBe(BASE);
  expect(html).toContain(`src="${BASE}vite-inject-mocker-entry.js"`);
  expect(html).toContain(`src="${BASE}@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"`);
  expect(html).toContain('href="//cdn.dev/x"');
});

test("both live sockets follow the page's own address, the channel under the path", () => {
  const head = await uraedaPreview(vite, { URAEDA_PREVIEW_BASE: BASE }).previewHead("<meta>", {});
  const opened = await socketsOpenedBy(
    head,
    "https://mac.tail1234.ts.net/r/uraeda/preview/x/iframe.html",
    [
      ["ws://127.0.0.1:6123/storybook-server-channel"],
      ["ws://127.0.0.1:6123/r/uraeda/preview/2026-10-20-sidebar-resize/", "vite-hmr"],
      ["wss://api.example.com/feed"],
    ],
  );
  expect(opened).toEqual([
    `wss://mac.tail1234.ts.net${BASE}storybook-server-channel`,
    `wss://mac.tail1234.ts.net${BASE}`,
    "wss://api.example.com/feed",
  ]);
});
```

Also: `the manager's channel socket moves under the path too`;
`the config's own heads and viteFinal still run`: a config whose `previewHead` returns `"<own>"` and
whose `viteFinal` adds a plugin keeps both. `socketsOpenedBy(head, url, calls)` runs the head's
script in a happy-dom window at `url` whose `WebSocket` records the URLs it is constructed with;
`transformIndexHtml(final, html)` calls the plugin's `post` handler.

```ts
// packages/web/src/__tests__/storybook-pick.test.ts: the pick script in a frame of its own
test("pick mode reports the clicked element's role and name, and ends", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Clicked 0 times</p>");
  frame.send({ on: true, uraeda: "pick" });
  frame.click("button");
  expect(frame.posted()).toContainEqual({
    name: "Hide the sidebar",
    role: "button",
    text: "Hide the sidebar",
    uraeda: "picked",
  });
  expect(frame.text()).toContain("Clicked 0 times");
});
```

Also: `a click inside a link picks the link`; `a separator has its role and no name`
(`<div role="separator">`, `name: ""`); `pick mode turned off from the page ends without a word`;
`Escape ends pick mode and says so` (`{ uraeda: "pick-stopped" }`, then a click acts);
`it says it is ready, and its height`; `a message from another window than its parent is ignored`.
`pickFrame(html)` loads `uraeda-pick.js` into an `iframe` of a happy-dom `Window` of its own, with
JavaScript enabled, and records what it posts to its parent.

The break each test catches:

- Unchanged config: a wrap that changes `storybook dev` run by hand.
- Other builders: a webpack Storybook started, then failing obscurely in the frame.
- Base and tags: the two injected tags left at the root, so the frame loads nothing through Uraeda;
  a protocol-relative URL taken for a path.
- Sockets: the HMR socket left on Storybook's port, which a phone cannot reach; `ws:` kept under
  `https:`.
- Pick: clicks reaching the story in pick mode, an implicit role missed, Escape ignored, or a
  stranger's `pick` obeyed.

- [x] **Step 2: Run them to check they fail**

- Run:
  `vp test --project uraeda-web src/__tests__/storybook-preview.test.ts src/__tests__/storybook-pick.test.ts`
- Expected: FAIL,
  `Failed to resolve import "../../../../skills/uraeda/assets/storybook/uraeda-preview.js"`, and
  `ENOENT` for `uraeda-pick.js`.

- [x] **Step 3: Implement**

The two files, plain JavaScript with JSDoc. The WebSocket patch replaces `window.WebSocket` with a
subclass: a socket to `/storybook-server-channel` gets the base before its path; it and a socket
with the `vite-hmr` protocol get the page's host and port, and `wss:` when the page is `https:`.
Other sockets are left as they are
([R14](rulings.md#r14-the-helper-moves-only-storybooks-two-live-sockets)). The pick script's role is
the `role` attribute, else the implicit role of the common elements (`button`, `a[href]` link,
`input` by type, `textarea` textbox, `select` combobox, `h1`–`h6` heading, `img` img, `hr`
separator, `li` listitem, …), else `element`; its name is `aria-label`, the text of
`aria-labelledby`, `alt`, `title`, or, for roles named by their content, its trimmed text; `text` is
the trimmed text, cut at 200 characters.

- [x] **Step 4: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add skills/uraeda/assets/storybook packages/web/src/__tests__/storybook-*.test.ts
git commit -m "feat(ui-iteration): the skill's Storybook helper and pick script"
```

## Task 4: The preview runner

**Files:**

- Create: `packages/server/src/preview/runner.ts`, `packages/server/src/preview/index.ts`,
  `fixtures/preview/serve.mjs`, `fixtures/preview/feature/` (the test feature's files)
- Modify: `packages/binding/test-utils.ts` (`addPreview`, `addStoryFeature`, `previewStarts`),
  `packages/server/src/server.ts` (`startServer`, `Server`)
- Test: `packages/server/src/preview/__tests__/runner.test.ts`,
  `packages/server/src/preview/__tests__/index.test.ts`, their helpers in
  `packages/server/src/preview/__tests__/helpers.ts` (`previews`, `fakeClock`, `storyCheckout`,
  `checkoutOf`, `ready`, `alive`, `WAIT`), and `packages/server/src/__tests__/server.test.ts`

**Interfaces:**

- Consumes: `preview(checkout)` from task 2, through the caller.
- Produces, in `preview/runner.ts`:
  - `type PreviewState = { state: "starting" } | { state: "ready"; port: number } | { state: "failed"; error: string }`,
    where `error` is the sentence the embed shows: `Storybook did not start: <last line>` for a
    process that exits, or the runner's own `Storybook did not start within 2 minutes.`,
    `No free port for Storybook.`, or `Storybook's index could not be read.`; a `preview-folder`
    missing from the checkout is
    `Storybook did not start: <folder> is not a folder of this checkout.`, and a process that
    printed nothing ends with `The command exited with code <code>.` or
    `The command was stopped by <signal>.`
    ([R15](rulings.md#r15-the-runner-writes-the-last-line-when-the-command-cannot));
  - `type Checkout = { base: string; dir: string; folder: string; command: string }`, where `dir` is
    the checkout, `folder` the decision's `preview-folder`, and `base` the path
    `/r/<name>/preview/<folder>/`;
  - `class Previews`, constructed with
    `{ now?: () => number; freePort?: () => Promise<number>; onChange?: (base: string) => void }`:
    `view(checkout: Checkout): PreviewState`, which starts the checkout's Storybook when none runs
    and records the view; `state(base: string): PreviewState | undefined`;
    `restart(checkout: Checkout): PreviewState`;
    `index(base: string): Promise<StoryIndex | undefined>`; `sweep(): void`;
    `stopAll(): Promise<void>`. A view leaves a failed Storybook failed: only `restart` starts it
    again. Also `freePort(): Promise<number>`, and the constants `POLL_MS`, `START_MS`, `IDLE_MS`,
    `KILL_MS`, `TIMED_OUT`, and `NO_PORT`.
- Produces, in `preview/index.ts`: `type StoryIndex` (the entries of `index.json` v5) and
  `type IndexEntry`; `readIndex(port: number, signal?: AbortSignal): Promise<StoryIndex>`, which
  rejects with `Storybook's index could not be read.` (`UNREADABLE_INDEX`) on a 200 that is not
  JSON, and with the request's own error while nothing answers, or not with a 200
  ([R16](rulings.md#r16-a-starting-storybook-is-read-every-500-ms-whatever-its-reads-do));
  `matchStory(index: StoryIndex, folder: string, story: { path: string; export: string }): string | undefined`,
  the entry's id ([R1](rulings.md#r1-a-story-is-matched-by-its-import-path-and-export-name)).
- Produces: `Server.previews: Previews`; `startServer` sweeps every 60 seconds (`SWEEP_EVERY_MS`),
  and `stop` awaits `previews.stopAll()`, with the sessions' stop.
- Produces, in `test-utils.ts`:
  `addPreview(repo: string, options?: { folder?: string; mode?: FakeMode; delay?: number }): string`,
  which commits `specs/decisions/preview.md`, active, running the fake preview, on `main` and every
  branch, and returns the fake's log file;
  `type FakeMode = "ok" | "fail" | "hang" | "bad-index" | "no-pick"`;
  `addStoryFeature(repo: string, options?: { preview?: false | { mode?: FakeMode; delay?: number }; specStatus?: string; round?: "awaiting-human" | "answered"; worktree?: boolean }): { log?: string }`,
  which commits `packages/web/src/SidebarHandle.stories.tsx` (exports `Dragging`, `ThinLine`,
  `Grip`) on `main`, then the branch `2026-10-20-sidebar-resize` with the files of
  `fixtures/preview/feature/`, and checks it out in `.worktrees/2026-10-20-sidebar-resize` unless
  `worktree` is false;
  `previewStarts(log: string): Array<{ base: string; cwd: string; pid: number; port: number }>`; and
  the constants `STORY_FEATURE` (`2026-10-20-sidebar-resize`) and `STORIES_FILE`
  (`packages/web/src/SidebarHandle.stories.tsx`). The fake's command ends in `&& true`
  ([R17](rulings.md#r17-the-runners-test-helpers-read-the-decision-through-the-binding)).
- Produces, `fixtures/preview/feature/specs/2026-10-20-sidebar-resize/`: `proposal.md`, holding the
  `Dragging` embed; `spec.md`, `awaiting-human` with its `> [!IMPORTANT]` block, whose
  `### US1: Resize the sidebar (P1)` holds the paragraph
  `[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)`, whose `## Mockups`
  lists that link as an item, and which links the stories file without an export in a sentence;
  `clarifications-01.md`, `awaiting-human`, whose Q2's option A holds
  `[Thin line](/packages/web/src/SidebarHandle.stories.tsx#ThinLine)` alone in a paragraph and
  option B `[Grip](/packages/web/src/SidebarHandle.stories.tsx#Grip)`. The options `specStatus` and
  `round: "answered"` rewrite their status; `answered` also answers Q2 "A" and deletes `Grip` from
  the stories file.
- Produces,
  `fixtures/preview/serve.mjs --port <port> [--mode <mode>] [--delay <ms>] [--log <file>]`: logs its
  start, then serves, from its working folder: `index.json`, one story entry per `export const X` of
  each `*.stories.*` file (id `<title>--<export>` in lowercase, `importPath` `./<relative path>`,
  `exportName`); `iframe.html?id=<id>`, a page holding the export's name, a button "Hide the
  sidebar" counting its clicks ("Clicked 1 time"), an unnamed `role="separator"`, the colour mode a
  `mode` message sent it, as `data-mode` on its root and the text "Mode: <mode>", a module script
  `story.js`, and the skill's `uraeda-pick.js` but in `no-pick`; a WebSocket at
  `/storybook-server-channel`, refused with 403 when its `Origin` is `null`, and one under its
  `URAEDA_PREVIEW_BASE` for the `vite-hmr` protocol, each sending one text message, the path,
  `Host`, and `Origin` it got, as JSON; `/__echo` (the same JSON), `/__index-reads` (how many
  requests for the index it got), and `/__events` (a first chunk, then held open). Once listening,
  it prints `Storybook ready on http://127.0.0.1:<port>/`. `fail` prints
  `Error: Cannot find module 'storybook'` and exits 1; `hang` holds every request for the index
  open; `bad-index` serves `not json`; `--delay` waits before listening; a taken port prints
  `Port <port> is not available` and exits 1.

- [x] **Step 1: Write the failing tests, and the helpers they use**

```ts
// packages/server/src/preview/__tests__/runner.test.ts
// The runner on the fake preview, with a clock the test moves: `previews()` stops what it started
// after each test.
test("a view starts the command in the checkout's folder, on a free port, under its path (US1.1)", async () => {
  const { checkout, log } = await storyCheckout();
  const runner = previews();

  runner.view(checkout);

  await expect.poll(() => runner.state(checkout.base)?.state).toBe("ready");
  const [start] = previewStarts(log);
  expect(start.cwd).toBe(join(checkout.dir, "packages/web"));
  expect(start.base).toBe("/r/repo/preview/2026-10-20-sidebar-resize/");
  expect(runner.state(checkout.base)).toEqual({ port: start.port, state: "ready" });
});

test("two views at once start one Storybook", async () => {
  /* view twice, then previewStarts(log).length === 1 */
});

test.each([
  [
    "a command that fails",
    "fail",
    "Storybook did not start: Error: Cannot find module 'storybook'",
  ],
  ["an index that is not JSON", "bad-index", "Storybook's index could not be read."],
])("%s is failed, with why", async (_, mode, error) => {
  const { checkout } = await storyCheckout({ mode });
  const runner = previews();
  runner.view(checkout);
  await expect.poll(() => runner.state(checkout.base)).toEqual({ error, state: "failed" });
});

test("a Storybook not ready after 2 minutes is failed", async () => {
  const { checkout } = await storyCheckout({ mode: "hang" });
  const clock = fakeClock();
  const runner = previews({ now: clock.now });
  runner.view(checkout);

  clock.advance(120_001);

  await expect
    .poll(() => runner.state(checkout.base))
    .toEqual({
      error: "Storybook did not start within 2 minutes.",
      state: "failed",
    });
});

test("30 minutes without a view stops its process group (SC-005)", async () => {
  const { checkout, log } = await storyCheckout();
  const clock = fakeClock();
  const runner = previews({ now: clock.now });
  runner.view(checkout);
  await ready(runner, checkout);

  clock.advance(29 * 60_000);
  runner.view(checkout);
  clock.advance(29 * 60_000);
  runner.sweep();
  expect(runner.state(checkout.base)?.state).toBe("ready");
  clock.advance(60_001);
  runner.sweep();

  expect(runner.state(checkout.base)).toBeUndefined();
  await expect.poll(() => alive(previewStarts(log)[0].pid)).toBe(false);
});
```

Also in `runner.test.ts`:

- `a process that exits after it was ready is failed, with its last line`: kill the fake's process
  from the test; state `failed`, `error` `Storybook did not start: ` and its last line.
- `a taken port is tried once more`: `freePort` gives a port the test holds, then a free one; the
  state turns `ready` on the second, with two starts logged.
- `no free port after one retry is failed`: `freePort` gives held ports twice;
  `{ error: "No free port for Storybook.", state: "failed" }`.
- `a removed worktree stops its Storybook (ura clean)`: remove the checkout's folder with
  `git worktree remove --force`, `sweep()`, then no state and the process gone.
- `stopping the server stops every Storybook`: two checkouts ready, `stopAll()`, both processes
  gone.
- `restart starts a failed Storybook again`: `fail` mode, rewrite the decision's command to `ok`,
  `restart`, then `ready` with two starts logged.
- `each checkout has its own Storybook`: the main checkout and the feature's worktree, two ports,
  two starts.
- `a state change is told`: `onChange` gets the base on `starting`, `ready`, and when stopped.
- `a preview folder missing from the checkout is failed, with why`: no start logged
  ([R15](rulings.md#r15-the-runner-writes-the-last-line-when-the-command-cannot)).
- `a view keeps a failed Storybook failed until it is restarted`, and
  `a ready Storybook's index is read`.
- In `server.test.ts`: `stopping stops every Storybook`, and
  `the server sweeps its Storybooks every minute`.

```ts
// packages/server/src/preview/__tests__/index.test.ts: one row per entry and link
test.each([
  [
    "the file and export",
    "packages/web",
    "packages/web/src/SidebarHandle.stories.tsx",
    "Dragging",
    "sidebarhandle--dragging",
  ],
  [
    "a renamed title",
    "packages/web",
    "packages/web/src/SidebarHandle.stories.tsx",
    "Grip",
    "layout-handle--grip",
  ],
  [
    "a mockups Storybook",
    "storybook",
    "specs/2026-11-02-invoices/mockups/InvoiceList.stories.tsx",
    "Empty",
    "invoicelist--empty",
  ],
  ["the root", ".", "src/tasks/RepeatMenu.stories.tsx", "Open", "repeatmenu--open"],
  [
    "an export not in the index",
    "packages/web",
    "packages/web/src/SidebarHandle.stories.tsx",
    "Missing",
    undefined,
  ],
  [
    "another file's export",
    "packages/web",
    "packages/web/src/Other.stories.tsx",
    "Dragging",
    undefined,
  ],
])("%s", (_, folder, path, name, id) => {
  expect(matchStory(INDEX, folder, { export: name, path })).toBe(id);
});
```

`INDEX` holds entries with `importPath` `./src/SidebarHandle.stories.tsx`,
`../specs/2026-11-02-invoices/mockups/InvoiceList.stories.tsx`, and
`./src/tasks/RepeatMenu.stories.tsx`.

The break each test catches:

- US1.1: the command run at the checkout's root, `{port}` left in it, or the base missing.
- Two views: a second process racing the first for the checkout.
- Failures: a crash left `starting`, the index's error lost, a hang waiting forever, or a 2-minute
  timeout counted from the last poll.
- SC-005: a view not resetting the idle time, the shell killed but Storybook left running (no
  process group), or an idle process kept.
- Ports: a taken port failing at once, or retried forever.
- `ura clean`: a process left holding a removed folder.
- Matching: ids rebuilt from titles, which a renamed title breaks, or `importPath` compared without
  the preview folder.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-server src/preview`
- Expected: FAIL, `Cannot find module '../runner.ts'`.

- [x] **Step 3: Implement**

- `view`: one entry per base; a new entry takes `freePort()` (bind `127.0.0.1:0`, read the port,
  close), replaces every `{port}`, and spawns the command with `sh -c` in `<dir>/<folder>`,
  `detached` so it leads a process group, with `URAEDA_PREVIEW_BASE` set to the base. Output, both
  streams, goes to a ring of 50 lines, without colour codes.
- Readiness: every 500 ms, `readIndex(port)`, unless a read is still pending; ready on its first
  JSON answer; failed on its `UNREADABLE_INDEX` rejection; failed with "Storybook did not start
  within 2 minutes." when, at any tick, `now()` passed 120 000 ms since the first view, even while a
  read hangs.
- An exit before ready: when its port is taken now, start once more on a new port, else failed,
  `Storybook did not start: <last line>`; after one retry, "No free port for Storybook.". An exit
  after ready: failed the same way, and its port forgotten.
- `sweep`: stops an entry whose last view is older than 30 minutes by `now()`, or whose `dir` no
  longer exists. Stopping sends `SIGTERM` to the group, then `SIGKILL` after 5 seconds, and forgets
  the entry. `stopAll` stops each; a `process.once("exit")` kills what is left.
- `startServer` builds `Previews`, runs `sweep` every 60 seconds (unref'd), and `stop` awaits
  `stopAll()`.

- [x] **Step 4: Run all tests**

- Run: `vp test --project uraeda-server && vp check`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server/src fixtures/preview packages/binding/test-utils.ts
git commit -m "feat(ui-iteration): the preview runner"
```

## Task 5: The preview proxy and the guard

**Files:**

- Create: `packages/server/src/preview/proxy.ts`
- Modify: `packages/server/src/guard.ts`, `packages/server/src/app.ts` (`createApp`),
  `packages/server/src/server.ts` (`Server.upgrade`), `packages/server/src/main.ts`,
  `packages/server/src/dev.ts` (`SERVER_PATHS`, `devUpgrade`, `devHandler`'s `allowOrigins`),
  `packages/web/vite.config.ts` (`uraedaServer`), `packages/server/src/fate/context.ts`
  (`previews`), `packages/server/src/__tests__/helpers.ts`
- Test: `packages/server/src/__tests__/guard.test.ts`,
  `packages/server/src/preview/__tests__/proxy.test.ts`, `packages/server/src/__tests__/dev.test.ts`

**Interfaces:**

- Consumes: `Previews`, `Checkout`, `addStoryFeature` from task 4.
- Produces, in `guard.ts`:
  `guardCheck(options): (request: { host: string; method: string; origin?: string; path: string; site?: string; upgrade: boolean }) => string | undefined`,
  the refusal's text, used by `guard(options)` and by upgrades.
- Produces, in `preview/proxy.ts`: `previewRoutes(): Hono`, mounted at `/r/:name`, answering
  `/preview/:folder` and `/preview/:folder/*`;
  `previewUpgrade(options: { check: ReturnType<typeof guardCheck>; previews: Previews }): (request: IncomingMessage, socket: Duplex, head: Buffer) => void`.
- Produces: `createApp` takes `previews: Previews`, and puts it in fate's context
  (`Context.previews`); `Server.upgrade` is `previewUpgrade` for the server's options;
  `devUpgrade(): (request, socket, head) => void` sends an upgrade to the server of its port;
  `devHandler`'s options take `allowOrigins?: (port: number) => Array<string>`, for task 7's SC-006
  test; `devPreviews(port): Promise<Previews | undefined>` gives the tests the runner of the server
  started on Vite's port
  ([R21](rulings.md#r21-the-proxys-tests-reach-the-runner-and-sockets-directly)).
- Produces, in `guard.ts`: `PREVIEW_PATH`, the regular expression of `/r/<name>/preview/` paths,
  shared by the guard and `devUpgrade`. In `preview/proxy.ts`: `SANDBOX`, the forwarded
  `Content-Security-Policy`. In `preview/runner.ts`: `NOT_RUNNING`, the 503's sentence.
  `uraeda-server` (`app.ts`) exports `Previews`, for the UI's tests.
- Changes: `testApp` and `testServer` create a `Previews`, stopped after each test, through
  `testPreviews()` of the server's test helpers; the UI's `helpers.tsx` stops its own.
- Bases: the runner's base and the proxy's are the request's path as the browser sends it,
  percent-encoded: task 6 builds `/r/<name>/preview/<folder>/` with each part through
  `encodeURIComponent`
  ([R20](rulings.md#r20-the-proxy-forwards-what-a-browser-sends-and-closes-the-rest)).

- [x] **Step 1: Split `createApp` before it grows**

Move the repositories' routes (`hosted` and its paths) and the fate endpoints into two functions of
`app.ts`, without changing what they do.

- Run: `vp test --project uraeda-server && vp check`, before and after
- Expected: PASS both times

```bash
git add packages/server/src/app.ts
git commit -m "refactor(ui-iteration): split createApp by route group"
```

- [x] **Step 2: Write the failing tests, and the helpers they use**

```ts
// guard.test.ts, a second table (SC-004): one row per method, path, and Origin
const preview = "/r/repo/preview/2026-10-20-sidebar-resize/iframe.html";
const previewCases: Array<[string, string, string, Record<string, string>, string | undefined]> = [
  ["a frame's read", "GET", preview, { origin: "null" }, undefined],
  ["a frame's HEAD", "HEAD", preview, { origin: "null" }, undefined],
  ["a frame's write", "POST", preview, { origin: "null" }, "Forbidden origin"],
  ["a frame reading the API", "POST", "/r/repo/fate", { origin: "null" }, "Forbidden origin"],
  [
    "a frame reading a file",
    "GET",
    "/r/repo/raw/specs/README.md",
    { origin: "null" },
    "Forbidden origin",
  ],
  ["a frame reading the global API", "GET", "/fate/live", { origin: "null" }, "Forbidden origin"],
  ["another site on a preview", "GET", preview, { origin: "https://evil.com" }, "Forbidden origin"],
];
test.each(previewCases)("%s", (_, method, path, headers, refusal) => {
  expect(
    check({ host: `127.0.0.1:${port}`, method, origin: headers.origin, path, upgrade: false }),
  ).toBe(refusal);
});
test.each([
  ["a frame's socket on a preview", preview, undefined],
  ["a frame's socket elsewhere", "/r/repo/fate/live", "Forbidden origin"],
])("an upgrade: %s", (_, path, refusal) => {
  expect(
    check({ host: `127.0.0.1:${port}`, method: "GET", origin: "null", path, upgrade: true }),
  ).toBe(refusal);
});
```

```ts
// packages/server/src/preview/__tests__/proxy.test.ts: the server on a port, the fake preview behind it
test("a read reaches Storybook without the path, with its own Host", async () => {
  const { base, origin } = await runningPreview();
  const echo = await (
    await fetch(`${origin}${base}__echo`, { headers: { origin: "null" } })
  ).json();
  expect(echo.path).toBe("/__echo");
  expect(echo.host).toMatch(/^127\.0\.0\.1:\d+$/);
});

test("every response allows any origin, and is sandboxed", async () => {
  const { base, origin } = await runningPreview();
  const response = await fetch(
    `${origin}${base}iframe.html?id=sidebarhandle--dragging&viewMode=story`,
  );
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("content-security-policy")).toBe(
    "sandbox allow-scripts allow-popups",
  );
});

test("Storybook's channel goes without the path or Origin; Vite's socket keeps its path", async () => {
  const { base, origin } = await runningPreview();
  expect(await socketOpens(`${origin}${base}storybook-server-channel`, { origin: "null" })).toBe(
    true,
  );
  expect(await socketOpens(`${origin}${base}`, { origin: "null", protocol: "vite-hmr" })).toBe(
    true,
  );
});
```

Also in `proxy.test.ts`:

- `a write is refused`: `POST` and `PUT` under the path answer 405.
- `nothing running answers 503`: a base with no process answers 503,
  `Storybook is not running for this branch.`; and once the fake is killed, the same.
- `a response streams`: the first chunk of `/__events` arrives while it stays open.
- `the path alone is sent to its slash`: `/r/repo/preview/<folder>` redirects to `…/<folder>/`.
- `an upgrade outside a preview path is closed`: `/r/repo/fate/live` upgrades get no `101`.

- `an upgrade from another site is refused`: the channel with `Origin: https://evil.com` gets no
  `101`.

`runningPreview()` starts `startServer`'s app and its `upgrade` on a free port with
`addStoryFeature`, views the checkout through `server.previews`, waits until ready, and closes
everything after the test. `socketOpens(url, { origin, protocol })`, in the preview tests' helpers,
sends an HTTP upgrade with those headers and resolves true on `101`, false on any other answer or a
closed socket (R21).

In `dev.test.ts`, `vp dev sends preview paths and their sockets to the server`: through `devHandler`
and `devUpgrade` on a Node server, a read of `…/preview/<folder>/__echo` answers the fake's JSON,
and the channel socket opens.

The break each test catches:

- The guard: the exception widened to writes, to other routes, or to any origin; upgrades not
  checked at all.
- Path and Host: the prefix forwarded, or Uraeda's `Host`, which Storybook's dev server refuses.
- Headers: a frame's module scripts blocked by CORS; Storybook's CSP kept, which forbids framing.
- Sockets: the channel's `Origin: null` refused by Storybook; Vite's socket stripped, which it does
  not answer.
- 503 and writes: a dead port forwarded to, or a POST reaching the process.
- Streams: a buffered response, which never reaches a live view.

- [x] **Step 3: Run them to check they fail**

- Run: `vp test --project uraeda-server src/__tests__/guard.test.ts src/preview`
- Expected: FAIL, `TypeError: guardCheck is not a function` (Vitest's module runner names a missing
  export this way), and the proxy's tests on `server.upgrade`, undefined.

- [x] **Step 4: Implement**

- `guardCheck`: the existing checks, in order; an `Origin` of `null` passes only on GET, HEAD, and
  upgrades whose path starts with `/r/<name>/preview/`. `guard` calls it.
- `previewRoutes`: the base is `/r/<name>/preview/<folder>/`; without a running port in
  `previews.state(base)`, 503. GET and HEAD go to `http://127.0.0.1:<port>/<rest>?<query>`, with
  `Host` set to the upstream and the request's other headers; the response streams back with
  `Access-Control-Allow-Origin: *` and the spec's `Content-Security-Policy`, replacing Storybook's.
  Other methods: 405. A failed connection: 503.
- `previewUpgrade`: refuses with `guardCheck`, then connects to the port, writing the request line
  with the full path when `Sec-WebSocket-Protocol` is `vite-hmr` and the rest only otherwise, with
  `Host` set to the upstream and no `Origin`, then pipes both ways, and closes both when either
  ends; a preview path with nothing ready is closed with `HTTP/1.1 503`, anything else with
  `HTTP/1.1 404` (R20).
- `main.ts` listens for `upgrade` and calls `server.upgrade`; `SERVER_PATHS` takes
  `r/<name>/preview`; `uraedaServer` adds `httpServer.on("upgrade", devUpgrade())`, which leaves
  Vite's own HMR socket alone.

- [x] **Step 5: Run all tests**

- Run: `vp test --project uraeda-server && vp check`
- Expected: PASS, the guard's first table unchanged.

- [x] **Step 6: Commit**

```bash
git add packages/server packages/web/vite.config.ts
git commit -m "feat(ui-iteration): the preview proxy, and the guard's exception"
```

### The proxy's narrower edges (spec revision 3)

Settled in [round 03](clarifications-03.md#settled-without-the-human), and in the spec's details of
`preview/proxy.ts`, `guard.ts`, and `preview/runner.ts`.

- [x] **Step 7: Write the failing tests**

In `guard.test.ts`'s table and the proxy's and runner's tests:

- `an upgrade is a read only as a WebSocket GET`: a POST with `Upgrade: foo` and `Origin: null`
  under a preview path is refused with 403, and nothing reaches the fake preview; without `Origin`,
  the proxy forwards it neither.
- `the guard needs a folder`: `/r/repo/preview/` and `/r/repo/preview//a` with `Origin: null` are
  refused; the pattern is one export, used by the guard and the proxy.
- `storybook's cookies and site data stay out`: a forwarded answer with `Set-Cookie` and
  `Clear-Site-Data` reaches the browser without either.
- `headers named in Connection are removed`: `Connection: x-custom` with `x-custom: 1`, both ways,
  reaches the other side without `x-custom`.
- `the proxy's own answers are sandboxed`: the 503, 301, and 405 carry
  `Access-Control-Allow-Origin: *` and the sandbox policy.
- `a storybook that exits is failed at once`: a fake whose child keeps the output open, the fake's
  `child` mode, killed after ready, is `failed` from its `exit`, which kills its group, and the
  proxy answers 503
  ([R24](rulings.md#r24-a-storybooks-exit-stops-its-group-and-its-outputs-close-fails-it)).

The break each catches: an upgrade counted as a read whatever its method; a guard pattern without a
folder; the response headers copied as they are; `Connection` tokens kept; headers set only on
forwarded answers; failure noticed only on `close`.

- [x] **Step 8: Run them to check they fail**

- Run: `vp test --project uraeda-server src/__tests__/guard.test.ts src/preview`
- Expected: FAIL, first on `an upgrade is a read only as a WebSocket GET`, answered 101.

- [x] **Step 9: Implement them, then run all tests**

- Run: `vp test --project uraeda-server && vp check`
- Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add packages/server
git commit -m "fix(ui-iteration): the proxy forwards only what embeds need"
```

## Task 6: Stories and previews in fate

**Files:**

- Create: `packages/server/src/fate/preview.ts` (`StoryRecord`, `PreviewRecord`, `StoryHrefRecord`,
  and their reads)
- Modify: `packages/server/src/fate/views.ts` (their data views and roots; `FeatureRecord.preview`,
  `WorkspaceRecord.preview`), `packages/server/src/fate/sources.ts`,
  `packages/server/src/fate/sessions.ts` (`featureRecord`), `packages/server/src/fate/mutations.ts`
  (`preview.restart`), `packages/server/src/fate.ts` (exports), `packages/server/src/live.ts`
  (`livePreviews`: the runner whose `onChange` reaches the buses), `packages/server/src/server.ts`
  and `packages/server/src/app.ts` (`livePreviews`)
- Modify: `packages/web/.fate/client.generated.ts`, generated
- Modify: `packages/server/src/__tests__/helpers.ts` (`testApp` and `testServer` give `previews`,
  from `livePreviews`), `packages/web/src/__tests__/helpers.tsx` (`livePreviews`)
- Test: `packages/server/src/__tests__/preview.test.ts`

**Interfaces:**

- Consumes: `Previews`, `matchStory`, `readIndex` from task 4; `preview`, `storyLink` from task 2.
- Produces, records read by id:
  - `Story`, id `<folder>:<path>#<export>`, `folder` a feature's or `main`:
    `{ id; state: "none" | "starting" | "ready" | "missing" | "failed"; frame: string | null; storybook: string | null; error: string | null }`,
    `frame` `/r/<name>/preview/<folder>/iframe.html?id=<id>&viewMode=story` and `storybook`
    `/f/<folder>/storybook?path=/story/<id>` (`/storybook?path=…` for `main`) when ready. Reading it
    is a view.
  - `Preview`, id `<folder>`:
    `{ id; state: "none" | "starting" | "ready" | "failed"; base: string | null; error: string | null }`,
    `base` `/r/<name>/preview/<folder>/` when ready. Reading it is a view.
  - `StoryHref`, id an href as written: `{ id; path: string | null; export: string | null }`, from
    `binding.storyLink`. Not a view, not live.
- Produces: `FeatureRecord.preview: boolean` and `WorkspaceRecord.preview: boolean`, whether the
  checkout, or the main checkout for a feature without a worktree, has an active preview decision
  ([R7](rulings.md#r7-a-feature-without-a-worktree-follows-the-main-checkouts-decision)).
- Produces: mutation `preview.restart`, input `{ folder: string }`, answering the `Preview` record.
- Produces: `checkoutOf(ctx, folder): Promise<{ dir: string } | null>`: the main checkout for
  `main`, else the feature's worktree resolved from the main checkout, `null` without one.
- Produces: `livePreviews(options?)`, exported by `live.ts` and `uraeda-server`: the runner every
  server and test app uses, whose changes send the live updates
  ([R22](rulings.md#r22-a-live-update-of-a-story-never-starts-its-storybook)).

- [x] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/preview.test.ts
const STORY = "2026-10-20-sidebar-resize:packages/web/src/SidebarHandle.stories.tsx#Dragging";
const FIELDS = ["state", "frame", "storybook", "error"];

test("a story's first read starts its Storybook, and turns ready live (US1.1)", async () => {
  const repo = fixtureRepo();
  addStoryFeature(repo);
  const { app, name } = await testApp(repo);
  const updates = await liveUpdates(app, "Story", STORY);

  const [first] = await byId(app, "Story", [STORY], FIELDS);

  expect(first.state).toBe("starting");
  expect(await updates.arrival('"state":"ready"'), "no live update to ready").toBeDefined();
  const [ready] = await byId(app, "Story", [STORY], FIELDS);
  expect(ready).toMatchObject({
    frame: `/r/${name}/preview/2026-10-20-sidebar-resize/iframe.html?id=sidebarhandle--dragging&viewMode=story`,
    state: "ready",
    storybook: "/f/2026-10-20-sidebar-resize/storybook?path=/story/sidebarhandle--dragging",
  });
});
```

Also in `preview.test.ts`:

- `an export not in the index is missing`: `…#Missing` turns `missing` once ready.
- `a feature without a worktree has no story to run`: `addStoryFeature(repo, { worktree: false })`;
  the record's `state` is `none`, and no process starts.
- `a Storybook that fails gives its last line`: `preview: { mode: "fail" }`; `failed`, `error`
  `Storybook did not start: Error: Cannot find module 'storybook'`.
- `preview.restart starts it again`: failed, restart, then `starting`, two starts logged.
- `the main checkout's stories run at main`:
  `main:packages/web/src/SidebarHandle.stories.tsx#Dragging` turns ready with `frame` under
  `/r/<name>/preview/main/` and `storybook` `/storybook?path=…`.
- `a feature and the workspace say whether they have a preview`: `preview` is `true` with
  `addStoryFeature`, `false` with `preview: false`, and the workspace's follows `main`'s decision.
- `an agent's link is checked through the core`: `StoryHref` for
  `/packages/web/src/SidebarHandle.stories.tsx#Dragging` gives its path and export; for
  `https://example.com/x` both are `null`, and no process starts.

The break each test catches:

- Ready: a frame path without the repository or the folder, or a record never updated live.
- Missing and none: a missing story shown as ready, or a worktree created to run one, which the git
  decision forbids.
- Main: the main checkout's path named after a feature.
- Flags: a "Storybook" row on a project without the decision.
- `StoryHref`: a link check that starts Storybook, or a rule copied into TypeScript.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-server src/__tests__/preview.test.ts`
- Expected: FAIL on the first read: fate refuses the type `Story`, which no source reads.

- [x] **Step 3: Implement**

- `checkoutOf`: `main` gives `binding.mainRoot(repo)`; a feature gives its `worktree` from
  `readFeature`, resolved against the main root, or `null`.
- Reading `Story`: no checkout, `none`; a checkout without `preview(dir)`, `none` too; else
  `previews.view(…)` with the base `/r/<encoded name>/preview/<folder>/`; when ready,
  `matchStory(await previews.index(base), …)` gives `ready` or `missing`, and an index that cannot
  be read `failed`
  ([R23](rulings.md#r23-a-ready-storybook-whose-index-cannot-be-read-fails-its-stories)). `Preview`
  the same, without matching. Each read adds the id to the ones its base updates.
- `onChange(base)`, in `livePreviews`: the bus of the repository that read the base updates its
  `Preview` and every `Story` read for it.
- `featureRecord` and the workspace record fill `preview` with `binding.preview(dir) !== null`.
- Regenerate fate's client with the web package's build.

- [x] **Step 4: Run all tests**

- Run: `vp test --project uraeda-server && vp run --filter uraeda-web build && vp check`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server/src packages/web/.fate
git commit -m "feat(ui-iteration): stories and previews in fate"
```

## Task 7: Story embeds in workflow files

**Files:**

- Create: `packages/web/src/StoryEmbed.tsx`, `packages/web/src/stories.tsx`
- Modify: `packages/web/src/Blocks.tsx` (`BlockNode` split first), `packages/web/src/ReviewPage.tsx`
  (split first), `packages/web/src/Spans.tsx` (`SpanLink`), `packages/web/src/routes.tsx` (`inApp`),
  `packages/web/src/FilePage.tsx` (around `DocumentPage` and `RoundPage`),
  `packages/web/src/EditorPage.tsx`, `packages/web/src/TaskView.tsx` (`DraftPart` only),
  `packages/web/src/views.ts` (`stories`, `story` on links, `preview`), `packages/web/src/data.ts`
  (`useStory`, `useStillViewed`), `packages/web/src/theme/theme.ts` and its built files
  (`--size-story-phone` 402px, `--size-story-desktop` 1440px, `--size-story-height` 560px)
- Modify: `packages/web/vite.browser.config.ts` (commands),
  `packages/web/src/__browser__/helpers.tsx`, `fixtures/preview/serve.mjs` (Storybook's channel) and
  `fixtures/preview/feature/` (the Mockups item's description,
  [R27](rulings.md#r27-the-fake-preview-opens-storybooks-channel-and-the-tests-post-to-its-frames)),
  `packages/server/src/fate/views.ts` (the draft's `stories`,
  [R26](rulings.md#r26-a-drafts-record-carries-its-stories))
- Test: `packages/web/src/__browser__/story-embed.test.tsx`,
  `packages/web/src/__browser__/layout.test.tsx`, `packages/web/src/__tests__/stories.test.tsx`

**Interfaces:**

- Consumes: the `Story` record, `FeatureRecord.preview`, `WorkspaceRecord.preview` from task 6;
  `StoryLink`, `SpanLink.story` from task 1.
- Produces, in `stories.tsx`: `StoryContext`, holding
  `{ folder: string; stories: ReadonlyArray<StoryLink>; comment?: (story: StoryLink, text: string, block?: Block) => Promise<string | undefined>; removed?: boolean; preview: boolean }`;
  `StoriesProvider(props: { folder: string; stories: ReadonlyArray<StoryLink>; comment?: …; removed?: boolean; children: ReactNode })`;
  in `data.ts`, `usePreviewOn(folder: string): boolean`, from the feature's or the workspace's
  `preview`, and `MAIN_CHECKOUT`
  ([R28](rulings.md#r28-whether-a-checkout-has-a-preview-is-read-once-per-provider));
  `useStoryAt(block: Block): StoryLink | undefined`, the embed of a paragraph when the checkout has
  a preview; `storybookHref(folder: string, story?: StoryTarget): string`, `/f/<folder>/storybook`
  or `/storybook`, with `?story=<path>%23<export>`
  ([R2](rulings.md#r2-an-inline-story-link-names-its-story-and-the-page-finds-its-id)).
- Produces, in `StoryEmbed.tsx`:
  `StoryEmbed(props: { folder: string; story: StoryTarget & { label: string }; comment?: (text: string) => Promise<string | undefined>; removed?: boolean })`,
  a `figure` named by its label. Task 9 adds pick mode and the comment form to it.
- Produces, in `data.ts`: `useStory(folder: string, story: StoryTarget)`, the live `Story` record;
  `useStillViewed(request)`, which asks for a request again, `network-only`, every 5 minutes while
  its component is drawn, used by `useStory` and by task 8's `usePreview`.
- Produces, browser commands: `addStoryFeature(options)`, `previewStarts()`, `frameText(title)`,
  `frameClick(title, role, name)`, `frameAttribute(title, selector, name)`,
  `frameRun(title, script)`, `frameReload(title)`, `openThroughHost(path, title, text)`; `commands`,
  exported by the browser helpers.

- [x] **Step 1: Split `BlockNode` before it grows**

Move its `switch` into a `blockElement(block, context)` function returning the node, so `BlockNode`
keeps the override and the `Selectable` wrap.

- Run: `vp test --project uraeda-web && vp check`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/Blocks.tsx
git commit -m "refactor(ui-iteration): BlockNode draws a block's element apart"
```

- [x] **Step 2: Split `ReviewPage` before it grows**

`ReviewPage` is at 99 lines, and this task and task 9 add to it. Move its `Blocks` selection (the
`after`, `isSelected`, and `onTap` functions) into a `useReviewSelection` hook of `ReviewPage.tsx`,
without changing what it does.

- Run: `vp test --project uraeda-web src/__tests__/review.test.tsx && vp check`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/ReviewPage.tsx
git commit -m "refactor(ui-iteration): ReviewPage's selection in a hook"
```

- [x] **Step 3: Write the failing tests, and the commands they use**

```tsx
// packages/web/src/__browser__/story-embed.test.tsx
const SPEC = "/f/2026-10-20-sidebar-resize/spec.md";
const FRAME = (name: string) =>
  `/r/${encodeURIComponent(name)}/preview/2026-10-20-sidebar-resize/iframe.html?id=sidebarhandle--dragging&viewMode=story`;

describe("on a desktop", () => {
  atSize("desktop");

  test("a story link alone starts the branch's Storybook, and shows the story at both widths (US1.1)", async () => {
    await commands.addStoryFeature({ preview: { delay: 1500 } });
    await show(SPEC, "Resize the sidebar");

    const embed = screen.getByRole("figure", { name: "Dragging the handle" });
    expect(await within(embed).findByText("Starting Storybook for this branch…")).toBeTruthy();
    const phone = await within(embed).findByTitle("Dragging the handle, phone");
    const desktop = within(embed).getByTitle("Dragging the handle, desktop");
    expect([phone.getAttribute("src"), desktop.getAttribute("src")]).toEqual([
      FRAME(repository()),
      FRAME(repository()),
    ]);
    expect(phone.getAttribute("sandbox")).toBe("allow-scripts allow-popups");
    await expect
      .poll(() => commands.frameText("Dragging the handle, desktop"))
      .toContain("Dragging");
    expect(phone.getBoundingClientRect().width).toBe(402);
    expect(desktop.getBoundingClientRect().width).toBeLessThan(1440);
    const [start] = await commands.previewStarts();
    expect(start.cwd).toMatch(/\.worktrees\/2026-10-20-sidebar-resize\/packages\/web$/);
    expect(start.base).toBe(
      `/r/${encodeURIComponent(repository())}/preview/2026-10-20-sidebar-resize/`,
    );
  });

  test("Desktop, Phone, and Both choose the widths, and the story runs in each (US1.2)", async () => {
    // "Desktop": one frame, scaled; "Phone": one frame, 402 px; "Both": two.
    // frameClick("Dragging the handle, phone", "button", "Hide the sidebar") → frameText has "Clicked 1 time".
  });

  test("a second page uses the running Storybook, ready within 2 seconds (US1.7, SC-001)", async () => {
    await commands.addStoryFeature();
    await show(SPEC, "Resize the sidebar");
    await expect
      .poll(() => commands.frameText("Dragging the handle, desktop"))
      .toContain("Dragging");

    await show("/f/2026-10-20-sidebar-resize/proposal.md", "Resize the sidebar");

    await expect
      .poll(() => commands.frameText("Dragging the handle, desktop"), { timeout: 2000 })
      .toContain("Dragging");
    await expect
      .poll(() => commands.frameText("Dragging the handle, phone"), { timeout: 2000 })
      .toContain("Dragging");
    expect(await commands.previewStarts()).toHaveLength(1);
  });
});
```

Also in `story-embed.test.tsx`, each naming its scenario:

- `the story is drawn in Uraeda's colour mode, and follows it (US1.4)`: dark stored, then
  `frameAttribute(…, "html", "data-mode")` is `dark`; "Light" pressed in the "Theme" control, it is
  `light`.
- `on the phone, the embed is as wide as the page, at the phone width, with named icons (US1.5)`:
  `atSize("phone")`; one frame, titled "Dragging the handle, phone", as wide as `window.innerWidth`;
  no "Both", "Phone", or "Desktop"; an icon link named "Open in Storybook" (task 9 checks the other
  two icons).
- `an approved spec and a proposal embed their stories (US1.6, other workflow files)`:
  `specStatus: "approved"`; frames on the spec and on `proposal.md`.
- `each state says why the story does not show`, one row each: `fail` mode, "Storybook did not
  start: Error: Cannot find module 'storybook'" and "Try again", which starts it again
  (`previewStarts()` has two); a link to `#Missing`, "No story “Missing” in
  packages/web/src/SidebarHandle.stories.tsx on this branch." and "Open in Storybook";
  `worktree: false`, "This feature has no worktree, so its stories cannot run here.".
- `a story that never reports its height is 560 px tall`: `no-pick` mode; the phone frame is 560 px
  tall.
- `after Storybook reloads a frame, it gets the colour mode again` (review focus 2): reload the
  frame through Playwright; `data-mode` is the page's again.
- `a size that is not a number above 0 is ignored` (review focus 6): a frame posting
  `{ uraeda: "size", height: -1 }`, and other malformed heights, then `ready`, keeps its height once
  the mode comes back.
- `without a preview decision, a story link is a plain link` (edge case): `preview: false`; a link
  "Dragging the handle" to `/r/<name>/raw/packages/web/src/SidebarHandle.stories.tsx`, no figure.
- `a story link in a list item, or without an export, is a link` (edge case): the fixture's
  `## Mockups` item links to `storybookHref` with `?story=`; its link without an export links to
  `/raw/`.
- `through a listed host name, the embed works as through 127.0.0.1 (SC-006)`:
  `openThroughHost(SPEC, "Dragging the handle, desktop", "Channel open")`, under `uraeda.test`,
  returns the desktop frame's text with "Dragging" and "Channel open".

`layout.test.tsx` gains the spec with its embed, ready, at both sizes, in light and dark.

In `__tests__/stories.test.tsx` (happy-dom, fake timers),
`a story on screen is asked for again every 5 minutes, so its Storybook is not left idle`: a
component using `useStillViewed` on the fixture's server; after 5 minutes, the server got the
record's request twice; once unmounted, no more.

The commands: `frameText`, `frameClick`, and `frameAttribute` find the frame whose element's `title`
matches, through Playwright, which reaches a sandboxed frame. `openThroughHost` starts a forwarding
proxy on a free port (absolute-form requests and `CONNECT`, to the test server's port), opens a new
WebKit context with that proxy, and loads `http://uraeda.test:<port>/r/<name>…`; the browser
config's server lists `uraeda.test` in `allowedHosts` and `URAEDA_ALLOWED_HOSTS`, and gives
`devHandler` `allowOrigins: (port) => [\`http://uraeda.test:${port}\`]`
([R12](rulings.md#r12-sc-006-runs-webkit-through-a-forwarding-proxy)).

The break each test catches:

- US1.1: frames without the sandbox, a desktop frame unscaled, the start text never shown, or the
  command run elsewhere.
- US1.2 and US1.5: a width choice that hides nothing, a phone frame cut by the page's insets, or
  text buttons on the phone.
- SC-001 and US1.7: a second process per page, or an embed waiting for a poll it no longer needs.
- US1.4 and review focus 2: the mode sent once at load, never on change or reload.
- States: a failed start with no reason or no retry, a missing story taken for a slow one.
- Edge cases: an embed without a decision, a list item embedded, a link without export sent to the
  Storybook page; SC-006: a socket pointed at 127.0.0.1, or a guard that knows only loopback.
- Every 5 minutes: an embed left on screen whose Storybook stops after 30 minutes.

- [x] **Step 4: Run them to check they fail**

- Run: `vp test --project desktop src/__browser__/story-embed.test.tsx`
- Expected: FAIL, `Unable to find role="figure" and name "Dragging the handle"`.

- [x] **Step 5: Implement**

- `BlockNode`: a paragraph with `useStoryAt(block)` draws `StoryEmbed`, then
  `selection?.after?.(block)` under it. `Spans`' `SpanLink`: a link with `story`, where the checkout
  has a preview, links to `storybookHref` in the app; without, as today.
- `StoryEmbed`: `useStory`; the states' texts, "Try again" calling `preview.restart`, and "Open in
  Storybook" linking to `storybook`; when ready, the frames with the spec's titles, sandbox, and
  sizes. Wide screens: the toolbar's segmented control, "Both" by default, not kept; the desktop
  frame scaled with a StyleX dynamic transform to the width left, measured with a `ResizeObserver`.
  Narrow screens: the phone frame alone, the page's width. Messages: only from its frames'
  `contentWindow`s, only well-formed ones; on `ready` from a frame, it sends that frame
  `{ uraeda: "mode", mode }`, the resolved light or dark, and sends it to every frame when it
  changes; `size` sets that frame's height.
- Pages fill `StoriesProvider`: `FilePage` around `DocumentPage` and `RoundPage`, with `file.folder`
  and `file.current.stories`, so `RoundPage` (97 lines) does not grow; `ReviewPage` with the version
  it shows, `file.committed ?? file.current`; `EditorPage` and `DraftPart` with `main` and the
  draft's.

- [x] **Step 6: Run all tests**

- Run:
  `vp test --project desktop && vp test --project phone && vp test --project uraeda-web && vp check`
- Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add packages/web
git commit -m "feat(ui-iteration): story embeds in workflow files"
```

## Task 8: The Storybook page and its rows

**Files:**

- Create: `packages/web/src/StorybookPage.tsx`
- Modify: `packages/web/src/routes.tsx` (`Route`, `parseRoute`), `packages/web/src/App.tsx`
  (`Page`), `packages/web/src/FeaturePage.tsx` (split first), `packages/web/src/SessionAside.tsx`
  (`Pages`), `packages/web/src/data.ts` (`usePreview`), `packages/web/scripts/screenshots.ts`
  (views), `packages/web/src/Crumbs.tsx` (no feature, for `/storybook`),
  `packages/web/src/StoryEmbed.tsx` (`State`, `TryAgain`, and `NoSuchStory` exported)
- Modify: `fixtures/preview/serve.mjs` (Storybook's interface at `/`),
  `packages/web/vite.browser.config.ts` (`innerFrameText`),
  [R30](rulings.md#r30-the-fake-preview-draws-storybooks-interface);
  `packages/server/src/preview/proxy.ts` (`SANDBOX`) and its test,
  [R29](rulings.md#r29-the-proxy-sets-no-frame-ancestors)
- Test: `packages/web/src/__browser__/storybook-page.test.tsx`,
  `packages/web/src/__tests__/routes.test.ts`, `packages/web/src/__browser__/layout.test.tsx`

**Interfaces:**

- Consumes: `Preview`, `Story`, `preview.restart` from task 6; `storybookHref`, `usePreviewOn` from
  task 7.
- Produces: routes `{ folder: string; page: "storybook" }` for `/f/<folder>/storybook`, and
  `{ folder: "main"; page: "storybook" }` for `/storybook`.
- Produces: `StorybookPage({ folder }: { folder: string })`: crumbs ending "Storybook", Storybook's
  interface in one frame titled "Storybook", sandboxed `allow-scripts allow-popups`, as tall as the
  window under the top bar; its `src` the base, with `?path=` from the page's own query, or resolved
  from `?story=`; the runner's states as in the embed; asking again every 5 minutes.
- Produces: `usePreview(folder: string)`, the live `Preview` record.

- [x] **Step 1: Split `FeaturePage`, and remove its marker**

Move the branch line, the "left" banner, and the lists of files, mockups, and problems into
components of `FeaturePage.tsx`, without changing what it shows, and remove its
`oxlint-disable-next-line max-lines-per-function` line.

- Run: `vp test --project uraeda-web src/__tests__/feature.test.tsx && vp check`, before and after
- Expected: PASS both times, with no unused disable directive

```bash
git add packages/web/src/FeaturePage.tsx
git commit -m "refactor(ui-iteration): split FeaturePage, and remove its marker"
```

- [x] **Step 2: Write the failing tests**

```tsx
// packages/web/src/__browser__/storybook-page.test.tsx
test("Open in Storybook opens Uraeda's Storybook page at the story (US1.3, US5.1, US5.2)", async () => {
  await commands.addStoryFeature();
  await show("/f/2026-10-20-sidebar-resize/spec.md", "Resize the sidebar");

  await userEvent.click(await screen.findByRole("link", { name: "Open in Storybook" }));

  const frame = await screen.findByTitle("Storybook");
  expect(window.location.pathname + window.location.search).toBe(
    atRepo("/f/2026-10-20-sidebar-resize/storybook?path=/story/sidebarhandle--dragging"),
  );
  const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumbs" }));
  expect(crumbs.getByRole("link", { name: "Sidebar resize" })).toBeTruthy();
  expect(within(crumbs.getAllByRole("listitem").at(-1)!).getByText("Storybook")).toBeTruthy();
  expect(frame.getAttribute("src")).toBe(
    `/r/${encodeURIComponent(repository())}/preview/2026-10-20-sidebar-resize/?path=/story/sidebarhandle--dragging`,
  );
  expect(frame.getBoundingClientRect().bottom).toBe(window.innerHeight);
  // US5.2: Storybook's interface frames the story itself (R29).
  await expect
    .poll(() => commands.innerFrameText("Storybook", "storybook-preview-iframe"))
    .toContain("Dragging");
});
```

Also:

- `the feature's page and the session's column list "Storybook" (US4.5, US5.3)`: desktop; on
  `/f/2026-10-20-sidebar-resize` and its session at 1440 × 900, a link "Storybook" to
  `/f/2026-10-20-sidebar-resize/storybook`; with `preview: false`, none.
- `on the phone, the page is Storybook's own, the window's width (US5.4)`: `atSize("phone")`; the
  frame is as wide as `window.innerWidth`.
- `an inline link's story opens at its id` (edge case):
  `?story=packages/web/src/SidebarHandle.stories.tsx%23Dragging` ends on
  `?path=/story/sidebarhandle--dragging`.
- `a failed Storybook says so, with Try again` (edge case): `fail` mode; the page reads "Storybook
  did not start: Error: Cannot find module 'storybook'".
- `an inline link's story not in the index says so, with Open in Storybook` (edge case), and the
  page reads "Nothing here." without a preview decision
  ([R31](rulings.md#r31-the-storybook-page-says-why-it-cannot-show-a-story)).
- In `__tests__/stories.test.tsx`, `the Storybook page is asked for again every 5 minutes` (review
  focus 4), as task 7's test does for a story.
- In `routes.test.ts`: `/f/x/storybook` and `/storybook` parse to the page; `/f/x/storybook.md`
  stays a file.
- `layout.test.tsx` gains the Storybook page at both sizes.

The break each test catches:

- US1.3 and US5: the story's id dropped from the link, or the frame given Uraeda's own path.
- Rows: shown without a preview decision, or missing from one of the two places.
- US5.4: a frame with a fixed width.
- Inline links: `?story=` passed to Storybook as is, which it does not know.

- [x] **Step 3: Run them to check they fail**

- Run: `vp test --project desktop src/__browser__/storybook-page.test.tsx`
- Expected: FAIL, `Unable to find an element with the title: Storybook.`: the address is read as a
  file named `storybook`.

- [x] **Step 4: Implement**

The routes, before the file route; the page; the rows, "Storybook" in `SessionAside`'s `Pages` and
in `FeaturePage`'s mockups list, when the feature's record says `preview`
([R31](rulings.md#r31-the-storybook-page-says-why-it-cannot-show-a-story)). Add the views
`story-embed` and `storybook-page` to `screenshots.ts`, on `addStoryFeature`, for the final review;
task 9 adds `story-pick`, once pick mode exists.

- [x] **Step 5: Run all tests**

- Run:
  `vp test --project desktop && vp test --project phone && vp test --project uraeda-web && vp check`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(ui-iteration): the Storybook page and its rows"
```

## Task 9: Pick mode and comments in reviews

**Files:**

- Modify: `packages/web/src/StoryEmbed.tsx` (split first; toolbar, pick mode, comment form),
  `packages/web/src/StoryFrames.tsx` (created by the split; pick mode in `useFrames`),
  `packages/web/src/ReviewPage.tsx` (the review's `comment`, in `StoriesProvider`),
  `packages/web/src/ReviewMockups.tsx`, `packages/web/vite.browser.config.ts` (`frameOutlined`,
  `framePress`, `frameReload`), `packages/web/scripts/screenshots.ts` (the `story-pick` view,
  [R31](rulings.md#r31-the-storybook-page-says-why-it-cannot-show-a-story))
- Create: `packages/web/src/storyComment.ts`
- Test: `packages/web/src/__browser__/story-comments.test.tsx`

**Interfaces:**

- Consumes: `StoryEmbed`, `StoriesProvider` from task 7.
- Produces, in `storyComment.ts`:
  `storyComment(story: StoryTarget, picked: { width?: "phone" | "desktop"; role: string; name: string } | undefined, text: string): string`
  and `storyAnchor(label: string, picked): string`, the spec's formats.
- Changes: `StoryEmbed` shows "Pick an element" once a frame says `ready`, and "Pick an element" and
  "Comment" only with a `comment`
  ([R10](rulings.md#r10-pick-and-comment-show-only-where-a-comment-can-go)); the form is
  `CommentForm`, in place under the embed on wide screens and in an `Overlay` sheet on narrow ones,
  its field `<path>#story:<folder>:<path>#<export>`.
- Changes: `ReviewMockups`' button for a story scrolls to its embed.

- [x] **Step 1: Split `StoryEmbed` before it grows**

`StoryEmbed.tsx` is at 442 lines, and this task adds the pick buttons, the hint, and the form. Move
the frames, `useFrames`, `DesktopFrame`, `StoryFrames`, and their styles, into `StoryFrames.tsx`,
without changing what they do.

- Run: `vp test --project desktop src/__browser__/story-embed.test.tsx`,
  `vp test --project uraeda-web src/__tests__/stories.test.tsx`, and `vp check`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/StoryEmbed.tsx packages/web/src/StoryFrames.tsx
git commit -m "refactor(ui-iteration): a story's frames in a file of their own"
```

- [ ] **Step 2: Write the failing tests**

```tsx
// packages/web/src/__browser__/story-comments.test.tsx
describe("on a desktop", () => {
  atSize("desktop");

  test("a comment on a picked element takes four actions, and names the story and element (US2.1–US2.3, SC-002)", async () => {
    await readyEmbed();

    await userEvent.click(screen.getByRole("button", { name: "Pick an element" })); // 1
    expect(screen.getByText("Click an element to comment on it. Escape to stop.")).toBeTruthy();
    expect(
      await commands.frameOutlined("Dragging the handle, desktop", "button", "Hide the sidebar"),
    ).toBe(true);
    await commands.frameClick("Dragging the handle, phone", "button", "Hide the sidebar"); // 2
    expect(
      await screen.findByText("Comment on Dragging the handle, phone, button “Hide the sidebar”"),
    ).toBeTruthy();
    expect(await commands.frameText("Dragging the handle, phone")).toContain("Clicked 0 times");
    await userEvent.keyboard("This should be an icon button."); // 3
    await userEvent.keyboard("{Control>}{Enter}{/Control}"); // 4

    await expect
      .poll(() => commands.readRepo(REVIEW))
      .toContain(
        "Story SidebarHandle.stories.tsx#Dragging, phone, button “Hide the sidebar”: This should be an icon button.",
      );
    expect(await commands.readRepo(REVIEW)).toMatch(
      /## C1: Line \d+, under "US1: Resize the sidebar \(P1\)"/,
    );
  });
});
```

`REVIEW` is `.worktrees/2026-10-20-sidebar-resize/specs/2026-10-20-sidebar-resize/spec-review.md`;
`readyEmbed()` adds the feature, shows the spec, and waits for the frames' text and for "Pick an
element". Also:

- `Comment without picking names the story alone (US2.4)`: "Too slow to start dragging." gives
  `Story SidebarHandle.stories.tsx#Dragging: Too slow to start dragging.`
- `Escape inside the story ends pick mode (US2.5)`: `framePress(…, "Escape")`; the hint is gone, no
  form opens, and a click then reads "Clicked 1 time".
- `a Storybook without the pick script offers Comment only (US2.6)`: `no-pick` mode; no "Pick an
  element", a "Comment".
- `with Desktop alone, a picked element's comment names no width` (the spec's format): "Desktop",
  pick, then the anchor is "Comment on Dragging the handle, separator".
- `a message from another window is ignored` (edge case): an `iframe` the test adds posts
  `{ uraeda: "picked", role: "button", name: "Evil" }` to the page; no form opens.
- `a frame reloaded during pick mode is in pick mode again` (review focus 2): `frameReload`, then a
  click in that frame opens the form.
- `a pending comment on the embed shows under it`: after US2.3's comment, the comment's text shows
  under the figure, with its edit and remove buttons.
- `the Mockups button scrolls to its story's embed` (edge case): the button "Open the mockup:
  Dragging the handle" brings the figure into view.
- `on the phone, the toolbar is three named icons, picking asks for a tap, and the form is a sheet (US1.5)`:
  `atSize("phone")`; icon buttons named "Pick an element" and "Comment", and the icon link "Open in
  Storybook", none showing its name as text; the hint "Tap an element to comment on it."; the form
  in a dialog named "Comment".

The break each test catches:

- SC-002 and US2.1–2.3: a confirmation step added, clicks reaching the story, the width missing,
  quotes other than “”, or the comment anchored to no line.
- US2.4 and the width rule: a stray ", phone" without a pick, or a width shown when one frame shows.
- US2.5 and US2.6: pick mode stuck on, or a button that can never work.
- Strangers: a message accepted by its shape alone, against the stack decision.
- Pending comments: the override dropping `selection.after`, so a comment on the embed vanishes.
- Reload: a frame that came back from a reload ignoring the human's clicks no more.

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test --project desktop src/__browser__/story-comments.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "Pick an element"`.

- [ ] **Step 4: Implement**

- `StoryEmbed`: "Pick an element" sends `{ uraeda: "pick", on: true }` to each frame and shows the
  hint, "Tap an element to comment on it." under `(pointer: coarse)`; `picked` from a frame ends
  pick mode in every frame, and opens the form with that frame's width while both show;
  `pick-stopped`, or Escape in the page, ends it without a form. "Comment" opens the form with no
  element. The form submits `storyComment(...)` through `comment`, and keeps its text with the
  review's error when it fails, as comments do today.
- `ReviewPage` provides `comment`: `review.comment` on the file, with the embed's block's
  `startLine` and `endLine`.
- `screenshots.ts`: the view `story-pick`, beside task 8's `story-embed` and `storybook-page`, in
  `takeStories`: the embed in pick mode.

- [ ] **Step 5: Run all tests**

- Run:
  `vp test --project desktop && vp test --project phone && vp test --project uraeda-web && vp check`
- Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(ui-iteration): pick mode, and comments on stories in reviews"
```

## Task 10: Variants in a round of questions

**Files:**

- Modify: `packages/web/src/Question.tsx` (split first), `packages/web/src/useAnswer.ts`
  (`appendLine`), `packages/web/src/FilePage.tsx` (`removed`)
- Test: `packages/web/src/__browser__/story-variants.test.tsx`

**Interfaces:**

- Consumes: `StoriesProvider`, `useStoryAt`, `StoryEmbed` from tasks 7 and 9.
- Produces: `useAnswer(...).appendLine(line: string): Promise<string | undefined>`, which saves the
  answer with `line` after the saved comment, on a line of its own, and the letters as picked; the
  field's unsaved text stays unsaved
  ([R9](rulings.md#r9-a-comment-on-a-variant-joins-the-answers-comment)).
- Changes: an option draws its `other` blocks that embed a story after its button, never inside it;
  `FilePage` gives a round's `StoriesProvider` `removed` when the round is `answered`.

- [ ] **Step 1: Split `Question` before it grows**

Move its options' list and the "Does not apply" button into an `Options` component of
`Question.tsx`, without changing what it draws.

- Run: `vp test --project uraeda-web src/__tests__/round.test.tsx && vp check`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/Question.tsx
git commit -m "refactor(ui-iteration): a question's options in a component"
```

- [ ] **Step 2: Write the failing tests**

```tsx
// packages/web/src/__browser__/story-variants.test.tsx
atSize("desktop");
const ROUND = "/f/2026-10-20-sidebar-resize/clarifications-01.md";

test("each variant shows under its option's button, which still picks it (US3.1)", async () => {
  await commands.addStoryFeature();
  await show(ROUND, "Q2");

  const a = screen.getByRole("button", { name: /^A / });
  const thin = await screen.findByRole("figure", { name: "Thin line" });
  expect(a.contains(thin)).toBe(false);
  expect(a.compareDocumentPosition(thin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await userEvent.click(a);
  expect(a.getAttribute("aria-pressed")).toBe("true");
});

test("a comment on a variant joins the question's answer (US3.2)", async () => {
  // Pick in "Grip, desktop", on the separator; type "Thicker grip."; Ctrl+Enter.
  await expect
    .poll(() => commands.readRepo(ROUND_FILE))
    .toContain("Story SidebarHandle.stories.tsx#Grip, desktop, separator: Thicker grip.");
});

test("a variant removed after the answer says so (US3.4)", async () => {
  await commands.addStoryFeature({ round: "answered" });
  await show(ROUND, "Q2");
  expect(await screen.findByText("This variant was removed after your answer.")).toBeTruthy();
});
```

The break each test catches:

- US3.1: a frame inside a `button`, which the browser makes inert, or an option no longer picked by
  its button.
- US3.2: the comment sent to the spec's review, or replacing the answer's comment.
- US3.4: a removed variant shown as an unexplained missing story.

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test --project desktop src/__browser__/story-variants.test.tsx`
- Expected: FAIL, `expected true to be false`: the variant's figure is inside its button.

- [ ] **Step 4: Implement**

`Option` filters `useStoryAt` out of `choice.other`, and the question draws those embeds after the
option's button. `Question` provides `comment` through `appendLine`. `StoryEmbed`, with `removed`,
reads "This variant was removed after your answer." in place of the missing text.

- [ ] **Step 5: Run all tests**

- Run:
  `vp test --project desktop && vp test --project phone && vp test --project uraeda-web && vp check`
- Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(ui-iteration): variants as stories in a round"
```

## Task 11: Stories in the chat

**Files:**

- Create: `packages/web/src/AgentMarkdown.tsx`
- Modify: `packages/web/src/Transcript.tsx` (`TranscriptItems`, `Transcript`'s props),
  `packages/web/src/SessionPage.tsx` (`SessionLog`), `packages/web/src/data.ts` (`useStoryHref`)
- Test: `packages/web/src/__browser__/story-chat.test.tsx`

**Interfaces:**

- Consumes: `StoryHref` from task 6; `StoryEmbed`, `StoriesProvider`, `storybookHref` from tasks 7
  and 9.
- Produces: `AgentMarkdown({ text }: { text: string })`, Astryx `Markdown` with `components.link`,
  which looks its `href` up through `useStoryHref` without suspending, a plain link meanwhile, and
  links a story to `storybookHref`; and `components.paragraph`, which draws `StoryEmbed` for a
  paragraph whose only child, whitespace aside, is a link to a story
  ([R3](rulings.md#r3-an-agents-link-is-checked-through-a-storyhref-record)).
- Changes: `Transcript` takes `folder: string` (a feature's, or `main` for a chat) and
  `onStoryComment?: (line: string) => void`; `SessionLog` adds the line to the composer:
  `setText((now) => (now.trim() ? \`${now}\n${line}\` : line))`.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__browser__/story-chat.test.tsx
atSize("desktop");
const LINK = "[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)";

test("a story link alone in an agent's message shows the story (US4.1)", async () => {
  await commands.addStoryFeature();
  await startTurn(
    "Show me",
    [{ text: `I wrote the stories.\n\n${LINK}`, type: "text" }],
    "/f/2026-10-20-sidebar-resize/session",
  );

  const embed = await screen.findByRole("figure", { name: "Dragging the handle" });
  expect(within(embed).getByTitle("Dragging the handle, desktop").getAttribute("src")).toContain(
    "/preview/2026-10-20-sidebar-resize/iframe.html?id=sidebarhandle--dragging",
  );
});

test("a comment on a story in the chat goes to the composer, unsent (US4.3)", async () => {
  // Pick the separator in the desktop frame, type "Larger hit area.", Ctrl+Enter.
  expect(composer()).toHaveValue(
    expect.stringContaining(
      "Story SidebarHandle.stories.tsx#Dragging, desktop, separator: Larger hit area.",
    ),
  );
  expect(await commands.agentSent()).toHaveLength(1);
});
```

Also:

- `a chat on the main checkout shows its story from main (US4.2)`: in a new chat, the frame's `src`
  starts with `/r/<name>/preview/main/`.
- `a story link inside a sentence opens Uraeda's Storybook page (US4.4)`: "See
  [the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging) now." is a link to
  `/f/2026-10-20-sidebar-resize/storybook?story=packages%2Fweb%2Fsrc%2FSidebarHandle.stories.tsx%23Dragging`,
  and no figure shows.

`startTurn(text, events, path?)` gains its optional path, shown before the message is sent;
`composer()` is the composer's text field, by its label.

The break each test catches:

- US4.1: the agent's link drawn as a plain link, or embedded from the main checkout.
- US4.2: a chat's stories looked up under a feature.
- US4.3: the comment sent at once, which the human did not ask for, or replacing the composer's
  text.
- US4.4: an inline link embedded, or sent to the raw file.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test --project desktop src/__browser__/story-chat.test.tsx`
- Expected: FAIL, `Unable to find role="figure" and name "Dragging the handle"`.

- [ ] **Step 3: Implement**

`TranscriptItems` renders `<AgentMarkdown text={item.text} />` in place of its `Markdown`, so its
length does not change. `SessionLog` wraps the transcript in `StoriesProvider` with its folder and
the composer's `comment`.

- [ ] **Step 4: Run all tests**

- Run:
  `vp test --project desktop && vp test --project phone && vp test --project uraeda-web && vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(ui-iteration): stories in the chat"
```

## Task 12: Uraeda's own Storybook

**Files:**

- Create: `packages/web/.storybook/main.ts`, `packages/web/.storybook/preview.tsx`,
  `packages/web/.storybook/fixture.ts`, `packages/web/.storybook/fateOverGet.ts`,
  `packages/web/src/StoryEmbed.stories.tsx`, `packages/web/scripts/validate-storybook.ts`
- Modify: `packages/web/package.json` (`storybook` and `@storybook/react-vite` at `10.6.2`, script
  `storybook`), `pnpm-lock.yaml`, `vite.tasks.ts` (`storybook:build` in `ready:typescript`),
  `vite.config.ts` (ignore `packages/web/storybook-static/**` in lint and format), `.gitignore`
  (`packages/web/storybook-static/`)
- Test: `packages/server/src/__tests__/toolchain.test.ts` (unchanged, must pass), the
  `storybook:build` task, the validation script

**Interfaces:**

- Consumes: `uraedaPreview`, `uraeda-pick.js` from task 3; `uraedaServer`, `devHandler` from task 5;
  `addPreview`, `addStoryFeature` from task 4; `StoryEmbed` from tasks 7 and 9.
- Produces: `storybookFixture(): { dataDir: string; repo: string }`, in `.storybook/fixture.ts`: a
  fresh copy of `fixtures/repo` at `<temporary folder>/fixture` (listed as `fixture`), committed
  with fixed dates (`GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` `2026-10-16T09:00:00Z`), with
  `addStoryFeature` and one checkout per state of `StoryEmbed.stories.tsx`.
- Produces: `fateOverGet()`, a Vite plugin of Uraeda's Storybook only, whose middleware turns
  `GET …/fate?request=<JSON>` and `GET …/fate/live?request=<JSON>` back into the POST the server
  expects, without `Origin` and `Sec-Fetch-Site`; and the preview's fate client, whose `fetch` sends
  every POST that way ([R4](rulings.md#r4-uraedas-storybook-sends-fates-requests-as-gets)).

- [ ] **Step 1: Write the failing check: the `storybook:build` task**

Add `storybook:build` to `vite.tasks.ts`:
`vp exec storybook build --quiet --output-dir storybook-static` in `packages/web`, with
`cache.input` `packages/web/src/**`, `packages/web/.storybook/**`, the two skill files,
`pnpm-lock.yaml`, and `!packages/web/node_modules/.cache/storybook/**`, and output
`packages/web/storybook-static/**`; depends on `binding:build`; listed in `ready:typescript`.

- [ ] **Step 2: Run it to check it fails**

- Run: `vp run storybook:build`
- Expected: FAIL: `vp exec` finds no `storybook` binary in `packages/web`.

- [ ] **Step 3: Implement**

- Install `storybook` and `@storybook/react-vite`, exactly `10.6.2`, as development dependencies of
  `packages/web`; no `@storybook/addon-vitest`.
- `main.ts`:
  `uraedaPreview({ framework: "@storybook/react-vite", stories: ["../src/**/*.stories.tsx"], core: { disableTelemetry: true }, viteFinal })`.
  Its `viteFinal` sets `URA_TODAY=2026-10-16`, `URAEDA_REPO` and `URAEDA_DATA_DIR` from
  `storybookFixture()`, replaces the base config's `uraeda-server` plugin with
  `uraedaServer({ adapter: new FakeAdapter(), file: false })` and `fateOverGet()`, and, under
  `URAEDA_PREVIEW_BASE`, rewrites `'/virtual:stylex.css'` in `virtual:stylex:runtime` to the base,
  as the spike did.
- `preview.tsx`: Astryx's reset, core, and theme stylesheets; `tags: ["!test"]`; a decorator with
  `Theme`, its mode from `{ uraeda: "mode" }` messages of `window.parent`, `LinkProvider`, the
  repository's contexts for `fixture`, and a fate client at
  `${import.meta.env.BASE_URL}r/fixture/fate` with the GET `fetch`;
  `import "../../../skills/uraeda/assets/storybook/uraeda-pick.js"`.
- `StoryEmbed.stories.tsx`: `Ready`, `Starting`, `Failed`, `Missing`, `Removed`, and `NoWorktree`,
  each a `StoryEmbed` of a checkout of the fixture in that state.
- `scripts/validate-storybook.ts`, run by hand, like the agent's
  (`node packages/web/scripts/validate-storybook.ts`): it serves the checkout's own repository with
  the server on the fake agent, opens a story of `StoryEmbed.stories.tsx` through
  `/r/<name>/preview/main/iframe.html?id=storyembed--ready&viewMode=story` in WebKit, checks it
  renders with the fixture's data, edits the stories file, checks the frame shows the edit without a
  reload, and restores the file. It prints each check and exits 1 on the first failure.

- [ ] **Step 4: Run all checks**

- Run:
  `vp install && vp run storybook:build && vp test --project uraeda-server src/__tests__/toolchain.test.ts && vp check`
- Expected: PASS: the build lists every `*.stories.tsx` of `packages/web/src`; a story with a type
  error in a scratch copy fails the build, naming its file (US7.2), then is removed.
- Run by hand:
  `cd packages/web && pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port 6006`,
  then `http://127.0.0.1:6006/` lists `StoryEmbed`'s six stories, each showing its state (US7.1,
  US7.3); then `node scripts/validate-storybook.ts` passes (US7.1, review focus 1).

- [ ] **Step 5: Commit**

```bash
git add packages/web/.storybook packages/web/src/StoryEmbed.stories.tsx packages/web/scripts/validate-storybook.ts packages/web/package.json pnpm-lock.yaml vite.tasks.ts vite.config.ts .gitignore
git commit -m "feat(ui-iteration): Uraeda's own Storybook"
```

## Task 13: The skill, its templates, and the example

**Files:**

- Create: `skills/uraeda/assets/templates/specs/decisions/preview.md`,
  `skills/uraeda/assets/example/specs/decisions/preview.md`, `fixtures/mockups/repeat.html` (moved
  from the example)
- Modify: `skills/uraeda/references/spec.md` (Mockups), `discovery.md`, `plan.md`,
  `implementation.md`, `projects.md`, `conventions.md`, `skills/uraeda/SKILL.md` (layout),
  `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md` (Mockups),
  `skills/uraeda/assets/templates/specs/README.md` (`mockups/`),
  `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md`, and the example's files
  that name the HTML mockup
- Delete: `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/mockups/repeat.html`
- Modify: `packages/web/scripts/screenshots.ts` (the fixture mockup), `crates/core/tests/items.rs`
  (`a_spec_has_its_mockups`, the folds' lines)
- Test: `crates/core/tests/check.rs` (`the_example_has_no_problems`), `crates/core/tests/items.rs`

**Interfaces:**

- Consumes: the field names and messages of task 2, the comment format of task 9, the helper and
  pick script of task 3.

- [ ] **Step 1: Update the tests that read the example**

`a_spec_has_its_mockups` reads the example's `## Mockups`: the `RepeatMenu.stories.tsx` exports as
list items, each with `story` set and its `path` `src/tasks/RepeatMenu.stories.tsx`. The folds'
lines follow the new spec. `screenshots.ts` copies `fixtures/mockups/repeat.html`.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test items a_spec_has_its_mockups`
- Expected: FAIL, `assertion left == right failed`: the path is still `mockups/repeat.html`.

- [ ] **Step 3: Write the skill's changes**

Each rule once, where its step is read:

- `spec.md`'s Mockups: with an active preview decision, mockups are stories, one export per state,
  each embedded by a link alone in its paragraph where it illustrates, and listed in `## Mockups`;
  without one, HTML as today; after a visual question, the spec's commit keeps the picked export and
  deletes the others. Story links need the Vite builder.
- `discovery.md`: when a question is visual (seeing helps more than reading); two to four distinct
  variants, each a story linked alone in its option, too alike when two could swap their text
  unnoticed, each with a one-line tradeoff, the recommended first; one session makes them; and, for
  a project with a UI and no preview decision, asking once whether to adopt one, a "no" recorded as
  that decision with a date in its **Revisit when**.
- `plan.md`: a picked variant's component is the starting point; the first task of that view adds
  the tests of the view's scenarios, then wires the component into the app.
- `implementation.md`: link each story written or changed, alone on a line, in the messages that
  report it ([R11](rulings.md#r11-the-change-flows-reference-gets-the-line-when-it-merges)).
- `projects.md`: after the code-quality decision, propose `specs/decisions/preview.md` from the
  template for a project with a UI: the stack's own Storybook on its Vite builder, in the folder
  that holds the UI, with `uraeda-preview.js` in its `main.ts` and `uraeda-pick.js` in its preview,
  copied from `assets/storybook/`; or, for a stack Storybook does not support, a mockups Storybook
  in `storybook/` at the root, React with Astryx, reading `specs/*/mockups/*.stories.tsx`, set up in
  a commit of its own once approved. Its stories leave with the feature's folder.
- `conventions.md`: story links (a path from the root or relative, `#` and the export's name), the
  text of a comment on a story, and the preview decision's two fields in `ura check`'s list.
- `SKILL.md`: `mockups/  # agent: HTML mockups, or the stories of a mockups Storybook`.
- The decision's template: the fields, the rules a project fills in (command, folder, helper, pick
  script, pinned versions, telemetry off), and the Vite builder.
- The example: its spec links `/src/tasks/RepeatMenu.stories.tsx#Open`, `#Custom`, and `#Completed`
  where US1 to US3 illustrate them, and lists them in `## Mockups`; its decision `preview.md`,
  `active`, `preview-folder: .`; `mockups/repeat.html` moves to `fixtures/mockups/repeat.html` with
  `git mv`. The README names no mockup format, and stays.

- [ ] **Step 4: Run all tests**

- Run:
  `cargo nextest run && cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs && cargo run -q -p uraeda-cli -- check specs && vp check`
- Expected: PASS, both folders without problems.

- [ ] **Step 5: Run `vp run ready`**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add skills fixtures/mockups packages/web/scripts/screenshots.ts crates/core/tests/items.rs
git commit -m "feat(ui-iteration): stories in the skill, its templates, and the example"
```
