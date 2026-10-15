# Discovery, round 02: UI iteration flow

## Why this round

The answers to [round 01](clarifications-01.md) moved the feature from screenshots to live mockups:

- **Mockups in the spec.** Q1's answer asks to "show UI mocks AS PART OF THE SPECS", to validate
  behaviour and UX before it is built, with or without a question.
- **Live, not still.** Q1.A's answer: "I AM NOT LOOKING FOR SCREENSHOTS. I want REAL, INTERACTIVE
  MOCKUPS that PROPERLY show how the feature will BEHAVE."
- **Astryx when the project's own code is too hard.** Q2's and Q5's answers ask whether Uraeda could
  render mockups built from Astryx components itself, instead of HTML.
- **Uraeda runs and embeds.** Q5's answer is B: Uraeda's server runs the project's preview command
  and embeds it.
- **Storybook.** Q6's answer is B, Storybook for Uraeda. In the chat that followed, you wrote: "if
  we can integrate it _inside_ uraeda, or at least run it together and easily switch between the
  two, that would be godlike".
- **A preview decision only where it applies.** Q3's answer: an optional decision, only for projects
  with a UI, and a workbench like Storybook is fine if it is better.

This round researches what those answers need: Storybook in this repository, embedding a live story
in Uraeda's pages, rendering Astryx mockups inside Uraeda, and commenting on a live UI.

## Summary

- **Storybook works here.** Storybook 10.6.2 builds and runs on Vite+ 1.0.0 with rolldown, React
  19.3, the React Compiler, StyleX, and Vitest 5 in WebKit at both of Uraeda's sizes, with two
  workarounds. Astryx develops its own components in Storybook.
- **A story embeds by URL.** Each story has an id and an `iframe.html?id=…` address. Storybook
  writes `index.json`, which maps each story to its file and its export.
- **Embedding a Storybook on another port is clean.** Its own origin keeps it away from Uraeda's
  API. Serving a static build from Uraeda's server instead needs an exception to the `Origin` rule
  of the [stack](/specs/decisions/stack.md) decision.
- **An Astryx runtime is feasible but a project of its own.** Agent-written TSX can run against
  Astryx inside Uraeda, but it needs a prebuilt runtime bundle (about 450 KB gzip), a transpiler,
  and a sandboxed origin.
- **Comments.** A comment can be precise to an element only with code running inside the preview:
  Uraeda cannot see into a frame from another origin.

## How other products do it

### Running untrusted UI next to a host

Every product that runs generated UI puts it in a frame on an origin other than the host's, and
brokers anything it may do through `postMessage`:

- **Claude artifacts** load from a separate `*.claudeusercontent.com` origin, under a strict CSP
  ([artifacts](https://code.claude.com/docs/en/artifacts)).
- **MCP Apps** require that the "Host and Sandbox must have different origins". They speak JSON-RPC
  over `postMessage`, and the frame reports its size, from a `ResizeObserver`, with `size-changed`
  ([spec](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)).
- **Sandpack** runs its previews on a wildcard preview domain
  ([static](https://sandpack.codesandbox.io/docs/advanced-usage/static)).
- **v0** runs a real dev server in a sandbox VM ([sandbox](https://v0.app/docs/sandbox)).

A frame with both `allow-scripts` and `allow-same-origin`, holding a document from the same origin
as its host, can remove its own sandbox
([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)).

### Agent-written UI formats

- **Code, run by the host.** The agent writes TSX that imports a component library, and the host
  provides the modules and transpiles it. react-runner maps `import` lines to provided modules
  ([README](https://cdn.jsdelivr.net/npm/react-runner@1.0.5/README.md)). Sucrase transpiles TSX,
  "about 20x faster than Babel", at 44 KB gzip, without checking types
  ([repository](https://github.com/alangpierce/sucrase)).
- **Declarative.** The agent writes data and the host renders it from a catalog of its own
  components, through flat lists of elements with ids, state bindings, and named actions. Examples
  are Google's A2UI ([repository](https://github.com/google/A2UI)) and Vercel's json-render
  ([repository](https://github.com/vercel-labs/json-render)). A2UI is called "painful for agents to
  author directly" (community, via search). Both need a catalog that mirrors every component.

### Commenting on a live UI

- **Element anchors combine several signals**: a stable id, a selector, the text, the component, and
  a screenshot as a fallback. The W3C annotation model says several selectors "SHOULD select the
  same content" so that one survives a change
  ([Web Annotation](https://www.w3.org/TR/annotation-model/)).
- **Lovable** gives each generated component a stable id through a Vite plugin
  ([visual edits](https://lovable.dev/en/blog/visual-edits)). **Cursor** sends the element's xpath,
  component, and props ([design mode](https://cursor.com/docs/agent/design-mode)). **Agentation**
  writes annotations as markdown, with selectors to search the code for
  ([agentation](https://www.agentation.com/)).
- **Comment mode and use conflict**: in Figma Make, "while in comment mode, you currently can't
  interact with the app"
  ([help](https://help.figma.com/hc/en-us/articles/38701587731735-Add-comments-in-Figma-Make)).
- **Selectors break** when classes or ids are generated
  ([Appcues](https://appcues.helpjuice.com/pins/troubleshooting-pins)).
- **No product documents a keyboard way to pick an element**, beyond Cursor's shortcuts.

### What they have in common

- **A separate origin** for generated or project UI, with the host brokering what it may do.
- **Size reported from inside the frame**, and the theme passed in by the host.
- **Element anchors from several signals**: role, text, a stable id, and a fallback.
- **A mode to comment, apart from a mode to use** the UI.

## Standards and libraries

### Storybook 10

- **Versions.** 10.6.2 is the latest, released on 2026-10-12, and 11.0 is in alpha. A minor comes
  every 6 to 8 weeks ([releases](https://github.com/storybookjs/storybook/releases)).
- **Vite.** `@storybook/react-vite` accepts Vite 5 to 8 (npm registry). Vite+ 1.0.0 bundles Vite
  8.3.1. Storybook's optional `vite-plus` peer range stops at 0.2, so pnpm warns.
- **It reuses the project's Vite config**, plugins included
  ([Vite builder](https://storybook.js.org/docs/builders/vite)).
- **Tested in a scratch project**, on Vite+'s core, with React 19.3, the React Compiler, the StyleX
  plugin, Vitest 5.0.1, and Playwright 1.63 WebKit:
  - the build and the dev server both work, and the compiler's output is in the stories;
  - stories ran as tests at 402 × 874 and 1440 × 900, play functions passed, and axe failed a story
    on a nameless button.
- **Workarounds.**
  - StyleX's CSS is not linked in a static build unless the preview imports a stylesheet. Uraeda's
    preview imports Astryx's anyway.
  - Running one story from Storybook's own screen is broken on Vitest 5 until 11.0
    ([issue 35752](https://github.com/storybookjs/storybook/issues/35752),
    [PR 36671](https://github.com/storybookjs/storybook/pull/36671)).
- **Astryx uses Storybook** for its own components
  ([config](https://raw.githubusercontent.com/facebook/astryx/main/apps/storybook/.storybook/main.ts)).
  - Its preview wraps stories in `Theme`, with toolbar switches for the theme and the colour mode
    ([preview](https://raw.githubusercontent.com/facebook/astryx/main/apps/storybook/.storybook/preview.tsx)).
  - It notes that StyleX "stalls on some Astryx core components", worked around in its config.
- **In worktrees**, Astryx's team found three problems
  ([investigation](https://raw.githubusercontent.com/facebook/astryx/main/apps/storybook/LOCAL_STARTUP_INVESTIGATION.md)):
  - a cold optimizer cache in each worktree;
  - a "ready" message printed before stories can load;
  - the fixed port 6006, which showed one worktree's stale Storybook in place of another's.

  Their advice: use an exact port, and check in the browser that the story rendered.

- **Mocking data.** Storybook's advice is to keep components presentational up to the screen level,
  or wrap them in mocked providers, modules, or network
  ([pages](https://storybook.js.org/docs/writing-stories/build-pages-with-storybook)).
  - fate's client restores a dehydrated cache: hydrated `cache-first` requests "resolve from the
    normalized cache without refetching" (`@nkzw/fate` 1.7.7 docs, "SSR and Hydration").
  - fate's client also takes a custom `fetch` ([`clients.ts`](/packages/web/src/clients.ts)).
- **Embedding.**
  - `iframe.html?id=<story>&viewMode=story` shows one story alone, and `args=` sets simple values
    ([embed](https://storybook.js.org/docs/sharing/embed),
    [args](https://storybook.js.org/docs/writing-stories/args)).
  - `index.json` lists each story's id, title, file, and export.
  - In the scratch test, a story in a frame with `sandbox="allow-scripts"` loaded only when its
    assets carried `Access-Control-Allow-Origin: *`: Vite's module scripts are fetched with CORS,
    under an opaque origin.
- **Agents.** The MCP addon is in preview, served by the dev server
  ([MCP](https://storybook.js.org/docs/ai/mcp/overview)). Agentic review is experimental, with no
  human comments ([agentic review](https://storybook.js.org/docs/ai/agentic-review)). `index.json`
  and `iframe.html?id=` are the stable hooks.
- **No comments without Chromatic**, which is hosted
  ([publish](https://storybook.js.org/docs/sharing/publish-storybook)).
- **Cost.**
  - The packages add 168 packages and 99 MB, with their own Babel 7 and esbuild.
  - An automigration once silently dropped play tests
    ([coder/mux](https://github.com/coder/mux/pull/473)).
  - Satisfaction keeps falling slightly (community:
    [State of JS 2025](https://2025.stateofjs.com/en-US/libraries/testing/)).
  - Telemetry is on by default ([telemetry](https://storybook.js.org/telemetry)).

### Alternatives to Storybook

- **Ladle** 5.1.1 depends on Vite 6 and Babel 7 directly, and has had no release since 2025-11
  ([repository](https://github.com/tajo/ladle)).
- **Playwright 1.62+** stories render in a gallery page the project writes itself, with no browsing
  screen ([components](https://playwright.dev/docs/test-components)).
- **React Cosmos** 7.4.1 is active, with a Vite plugin ([docs](https://reactcosmos.org/docs)).

### Astryx as a runtime

From `@astryxdesign/core` 0.6.8 in `node_modules`:

- It ships prebuilt ESM with precompiled StyleX and a prebuilt `astryx.css` of 191 KB: "No build
  plugins needed".
- Mockup code that calls `stylex.create` would still need the compiler.
- Components pass `data-*` attributes through, usable as stable anchors.
- One bundle of React, react-dom, all of Astryx, and its theme measured 1.46 MB minified, 450 KB
  gzip.
- Vite+ already ships oxc's transform (`rolldown/experimental`), so the server could strip TSX
  without a new dependency.
- Its `astryx template --cdn` page loads everything from esm.sh, which needs the network at view
  time.
- Astryx 0.7.0 is already out, so mockups written against 0.6.8 may need upgrades.

## The code

### Important reads

- **Today's mockups are HTML only**, in three places:
  - [`workspace.rs`](/crates/core/src/workspace.rs) lists `.html` files only;
  - [`routes.tsx`](/packages/web/src/routes.tsx) routes only `.html` links to `/mockups/`;
  - [`files.ts`](/packages/server/src/files.ts) serves `.tsx` as plain text.

  [`spec.rs`](/crates/core/src/files/spec.rs) reads mockup links in `## Mockups` only, never beside
  a story.

- **An embed has a hook.**
  - [`Blocks.tsx`](/packages/web/src/Blocks.tsx)'s `override` can replace any block, but skips the
    `Selectable` wrap, so a commentable embed wraps itself.
  - A paragraph holding only a link is a `Paragraph` with one linked span. In a list it is an `Item`
    instead.
- **The core resolves links** to repository paths, without checking that they exist
  ([`workspace/links.rs`](/crates/core/src/workspace/links.rs)).
- **The guard refuses every request carrying `Origin: null`, reads included**
  ([`guard.ts`](/packages/server/src/guard.ts)).
  - A sandboxed frame's module scripts, `fetch`, and `import()` send it, so a story served by
    Uraeda's own server would need an exception.
  - A Storybook on its own port is not behind this guard. Requests it sends to Uraeda's API carry
    its own origin, which the guard refuses.
- **Review comments anchor to lines only.** `Anchor` is `Lines` or `General`
  ([`files/review.rs`](/crates/core/src/files/review.rs)). A mockup comment today lands on the line
  that links the mockup, or starts its text with "Mockup <name>: "
  ([`MockupPage.tsx`](/packages/web/src/MockupPage.tsx)).
  - A comment's text lines may not start with `#`, and leading `>` lines are its quote
    ([`actions/review.rs`](/crates/core/src/actions/review.rs)).
- **A question's option is one raw `button`** ([`Question.tsx`](/packages/web/src/Question.tsx)). An
  embedded frame must sit beside it, not inside it.
- **The theme** is built by `astryx theme build` into `src/theme/built/uraeda.css`, and wrapped by
  `<Theme theme={uraedaTheme}>` in [`App.tsx`](/packages/web/src/App.tsx). A Storybook preview needs
  the same three stylesheets and the same wrapper.
- **Sizes.**
  - `ReviewPage` is at 99 of 100 lines, `BlockNode` at 92, and `Question` at 90.
  - `api.rs` is at its baseline and cannot grow, and `workspace.rs` and `document.rs` can only
    shrink.
- **Lint and format cover `specs/`**: oxlint and oxfmt have no ignore for it
  ([`vite.config.ts`](/vite.config.ts)). Mockup TSX inside a spec folder would be linted without
  resolving React or Astryx.

### The proposal's path and existing actions

- **The agent writes a mockup**: today an HTML page in `mockups/`; with Storybook, a stories file
  in the project's code, on the feature's branch.
- **You open the spec**: today a button per mockup opens it on its own page; with an embed, the
  story runs where the spec links it.
- **You comment**: today on the spec's line that links the mockup, or as a general comment; the
  same anchor holds for an embed, with the [comment precision](#comment-precision-on-a-live-story)
  on top.
- **The agent revises the story** after changes requested: a running preview shows the new version
  on the next view, since the dev server reloads.
- **The feature finishes**: the folder is removed as today. Stories stay in the code, as the
  implementation's own.

### Likely changes

The round 01 list holds ([likely changes](discovery-01.md#likely-changes)), with these differences:

- **Storybook in [`packages/web`](/packages/web/)**: its config, a preview that wraps stories in the
  theme and a fate client hydrated from fixture snapshots, and stories for the views mockups need.
  Exact pins, and `vp run ready` tasks with their inputs.
- **The server**:
  - starting and stopping a worktree's preview command on a free port;
  - reading its index;
  - giving the web UI each embed's address.
- **The core**: links from a spec, or from a question's option, to a story. Both are links to a
  stories file and an export, which the server matches to a story id.
- **The web UI**: an embed block in the spec, review, and questions views, and comments on it.
- **The skill**: mockups as stories, an optional preview decision for projects with a UI, and live
  review after the code.
- **With an Astryx runtime** (see [Astryx mockups](#astryx-mockups-in-uraeda)): a runtime bundle, a
  TSX transform, and a sandboxed origin for it.

## The proposal

### Two engines for live mockups

Q2's answer reads as: real code in the project's own components first, and Astryx mockups that
Uraeda renders when that is "too hard". With Storybook, the project's own code is the mockup for
every stack Storybook supports: React, Vue, Svelte, Angular, Web Components, and others. The Astryx
runtime would serve the projects left over:

- server-rendered stacks: Rails, Django, Phoenix;
- native apps;
- projects without a workbench.

Building both doubles the feature, which round 01 did not size.

### Comments on a live story

Q1.A's answer keeps the review at the pull request, through a review file, but on live UI, not
screenshots. A story from another origin cannot be read by Uraeda, so the precision of a comment
depends on code inside the project's Storybook.

## Approaches

Criteria come from round 01's ([approaches](discovery-01.md#approaches)), the answers above, and the
[stack](/specs/decisions/stack.md) decision's `Origin` rule.

### Astryx mockups in Uraeda

When the Astryx runtime is built. See [two engines](#two-engines-for-live-mockups) and
[Astryx as a runtime](#astryx-as-a-runtime).

| Option                                                                        | Covers                                         | Size of this feature                              | Security                          |
| ----------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- | --------------------------------- |
| A. Later, as its own feature; projects without a workbench keep HTML mockups  | Every Storybook stack now                      | As planned                                        | No change                         |
| B. Now, as the fallback for projects without a preview environment            | Every project                                  | About double                                      | A separate origin for the runtime |
| C. Now, for every project, Uraeda's own included, in place of project stories | Every project, with Astryx's look, not its own | Larger, and Q2.A's "keep the picked code" is lost | A separate origin                 |

### Comment precision on a live story

See [commenting on a live UI](#commenting-on-a-live-ui).

| Option                                                                                                                  | Precision                            | Code in the project                     | Keyboard          |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------- | ----------------- |
| A. A pick mode: a small script in the project's Storybook preview reports the clicked element, its role, name, and text | An element                           | A preview script, from a skill template | The story comment |
| B. A comment on the story, anchored to the line that embeds it, its text naming the state and element                   | A story                              | None                                    | Yes               |
| C. A spot on the frame, by coordinates                                                                                  | A point, lost when the story changes | None                                    | No                |

### Needs no choice

- **Uraeda runs the preview**: Q5's answer. A Storybook on its own port is isolated from Uraeda's
  API by its origin, so the `Origin` rule needs no exception (see
  [important reads](#important-reads)).
- **Static build or dev server**: the dev server shows changes as the agent writes them, and a
  server-rendered stack has no static build. Exact ports and a rendered check answer Astryx's
  worktree problems.
- **Uraeda's data in stories**: fate's hydration, from snapshots of the real server on the fixture
  repository, keeps "data only from the server, through fate" true. Faked network payloads would
  hand-write the server's output.
- **Variants as stories**: one stories file per planned view, one export per variant. The picked
  export stays, per Q2.A.
- **Stories are previews, not tests**: the [UI checks](/specs/decisions/ui-checks.md) decision
  forbids tests that guard nothing, so Storybook's automatic smoke tests are off.
- **Screenshots**: the variants need none; Q7's answer still holds for the screenshots the UI checks
  decision already requires.

## Not checked

- Storybook with this repository's real `vite.config.ts`: the server plugin, the theme watcher, the
  fate plugin, and `#theme-icons`. The test used a scratch project.
- Uraeda's own Storybook build time and size.
- Whether a classic script from a sandboxed frame sends an `Origin` header in WebKit today.
- Astryx's Playground internals, its MCP server, and the 0.7.0 changelog.
- The `globals=` syntax of `iframe.html`, beyond one example.
- Ladle and React Cosmos on Vite+'s core.
