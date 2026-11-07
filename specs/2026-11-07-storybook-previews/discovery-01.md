# Discovery, round 01: Faster Storybook previews

## Summary

A story link in a workflow file shows as a live frame of the checkout's Storybook, one
`storybook dev` process per checkout, started on demand by the server's preview runner. The wait the
human sees has three parts, measured in this worktree: the process start until its index answers (6
to 10 s), the first story's compile, about 600 modules through StyleX and the React Compiler (12 to
40 s on a loaded machine), then the fixture server's data. Later stories of the same Storybook show
in 1 to 4 s. The cost recurs because a Storybook restarts on every commit of its checkout, the web
UI's own included, and stops after 30 minutes without a view, while the human answers hours later.
Established tools avoid the wait by embedding static builds; Storybook's dev server has no warm-up
of its own.

## How other products do it

### Storybook's own embeds

Storybook's embed guide requires that "your Storybook must be published and publicly accessible",
and embeds `iframe.html?id=…&viewMode=story` of that published build
([embed](https://storybook.js.org/docs/sharing/embed)). Composition points at static builds too, as
a dev server refuses to be framed from another origin
([composition](https://storybook.js.org/docs/sharing/storybook-composition)).

### Chromatic

Chromatic builds and uploads a static Storybook per run, with permalinks per commit and per branch
([docs](https://www.chromatic.com/docs/storybook/),
[permalinks](https://www.chromatic.com/docs/permalinks/)). Its review shows a captured snapshot
first, and "Inspect snapshot" opens the live component beside it
([docs](https://www.chromatic.com/docs/storybook/)).

### zeroheight and Supernova

zeroheight's native embed needs a hosted Storybook exposing `index.json`
([help](https://zeroheight.com/help/article/storybook-native-embedding-vs-embedding-iframe/), search
snippet only). Supernova imports a static export
([CLI](https://developers.supernova.io/latest/supernova-cli/cli-commands/import-storybook-2PgA2h0o-2PgA2h0o),
search snippet only).

### Ladle, Histoire, React Cosmos

Ladle, a Vite-based story runner, claims "instant server starts" and code-splits every story
([docs](https://ladle.dev/docs/)). Its own benchmark, about 350 stories against Storybook 6.4: 6 s
against 58 s cold, about 3 s against 25 s cached
([blog](https://ladle.dev/blog/introducing-ladle/)). Histoire claims "instant server startup"
([guide](https://histoire.dev/guide/)). React Cosmos makes no startup claim
([docs](https://reactcosmos.org/docs)). These numbers predate Storybook 10.

### What they have in common

- Every embedding tool serves a static build, and none runs a dev server per branch.
- A precomputed image stands in for the live story where speed matters (Chromatic).
- A preview that is not ready says so, rather than showing an empty frame: Storybook shows its own
  "preparing story" loader after 100 ms
  ([`WebView.ts`](https://github.com/storybookjs/storybook/blob/next/code/core/src/preview-api/modules/preview-web/WebView.ts)).

## Standards and libraries

### Storybook 10.6.2's dev server

- The Vite builder pre-bundles dependencies only once the story index is built, crawling every story
  file as `optimizeDeps.entries`
  ([plugin](https://github.com/storybookjs/storybook/blob/next/code/builders/builder-vite/src/plugins/storybook-optimize-deps-plugin.ts)).
- Vite runs in middleware mode, without `server.warmup`, and caches pre-bundled dependencies in
  `node_modules/.cache/storybook`
  ([vite-server.ts](https://github.com/storybookjs/storybook/blob/next/code/builders/builder-vite/src/vite-server.ts)).
  The builder holds no warm-up code of its own.
- `--ci` only skips prompts and the browser. `--smoke-test` exits once started. `--preview-only`
  skips the manager ([CLI options](https://storybook.js.org/docs/api/cli-options)).
- `features.changeDetection`, on by default, "watches the git working tree and module graph"
  ([features](https://storybook.js.org/docs/api/main-config/main-config-features)).
- `typescript.reactDocgen` defaults to `react-docgen`, the fast one
  ([typescript](https://storybook.js.org/docs/api/main-config/main-config-typescript)). Uraeda sets
  nothing, so it uses the default.
- `build.test` and `--test` speed up static builds 2 to 4 times, not the dev server
  ([build](https://storybook.js.org/docs/api/main-config/main-config-build),
  [7.6 post](https://storybook.js.org/blog/optimize-storybook-7-6)).
- Known issues: stories hang on a first launch with an empty cache, a race between the optimizer and
  serving ([#33006](https://github.com/storybookjs/storybook/issues/33006)), and "optimized
  dependencies changed, reloading"
  ([#28987](https://github.com/storybookjs/storybook/issues/28987)).

### Vite

- `server.warmup.clientFiles` transforms the listed files ahead, "ready and cached to be served
  immediately when requested" ([performance](https://vite.dev/guide/performance)). Its docs do not
  say whether it runs in middleware mode.
- Vite keeps transformed modules in memory only: a restarted server compiles every module again
  ([performance](https://vite.dev/guide/performance)).
- Vite 8.1's experimental bundled dev mode claims much faster cold starts; third-party plugins "may
  not work" ([announcement](https://vite.dev/blog/announcing-vite8-1)). Nothing says it works under
  Storybook.

### Static builds

Storybook 6.4 built Carbon's 250 stories in 81.9 s with Vite
([post](https://storybook.js.org/blog/storybook-performance-from-webpack-to-vite/)). No current
benchmark was found. A static build runs no server: Uraeda's
[`main.ts`](/packages/web/.storybook/main.ts) builds no fixture for it.

## The code

### Important reads

- [`runner.ts`](/packages/server/src/preview/runner.ts): one Storybook per checkout's base path.
  "Ready" means the index answered (`#poll`), not that a story renders. It restarts a Storybook when
  the checkout's commit moved (`moved`), and stops it after 30 minutes without a view (`IDLE_MS`).
  At 447 of the project's 500 lines.
- [`fate/preview.ts`](/packages/server/src/fate/preview.ts): every `Story` and `Preview` read is a
  view; `warmPreview` starts a feature's Storybook when its agent's turn ends done, once its
  `node_modules` exist.
- [`StoryEmbed.tsx`](/packages/web/src/StoryEmbed.tsx) shows "Starting Storybook for this branch…"
  until the record is ready, then the frame. The frame's story compiles only once the frame loads:
  meanwhile it shows Storybook's loader or a blank frame.
- [`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx) loads a frame only once its box is on
  screen, since the [warm-up change](/specs/done/2026-10-16-storybook-warmup.md): twelve frames
  loading during a start had frozen the whole site.
- [`.storybook/main.ts`](/packages/web/.storybook/main.ts) first rebuilds a missing or stale native
  binding (`fresh-binding`), then builds the fixture repository in `viteFinal`
  ([`fixture.ts`](/packages/web/.storybook/fixture.ts)): dozens of git commands, about 4 to 8 s.
- [`vite.transforms.ts`](/packages/web/vite.transforms.ts): every source module goes through StyleX
  and Babel's React Compiler, which makes the first compile slow.
- [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js): the skill's helper wraps
  every project's Storybook config under Uraeda; a change there reaches every project.

### Measurements

Measured on 2026-11-07 in this worktree, with Storybook 10.6.2, on a 32-core machine whose load
average was 22 to 63, other agents running. A throwaway script outside the repository started the
preview command and loaded `iframe.html` in headless Chromium.

| Phase                                                       | Time         |
| ----------------------------------------------------------- | ------------ |
| Native binding build, a new worktree only                   | 22 s         |
| Process start until the index answers                       | 6 to 16 s    |
| …of which the fixture build, run alone                      | 8.6 s        |
| First page story (`spec-page--waiting`), about 610 requests | 22 to 41 s   |
| Another page story, same Storybook                          | 1.4 to 3.5 s |
| A small story (`storyembed--ready`)                         | 0.4 to 1.8 s |

The first story's slowest requests were the app's own modules, such as `src/spec/SpecOpening.tsx`,
each 9 s in a waterfall: the compile, not the network. An empty dependency cache changed little. One
run with `server.warmup.clientFiles` set on the stories showed no gain (38 s), but on a loaded
machine and in a single run: inconclusive.

### The proposal's path and existing actions

1. An agent commits a round with story variants; its turn ends, and `warmPreview` starts the
   Storybook. Nothing compiles the stories.
2. After 30 minutes without a view, the runner stops it.
3. The human opens the round hours later: a cold start (6 to 16 s), then the first story's compile.
4. The human submits answers: the web UI's commit moves the checkout's commit, so the next view
   restarts the Storybook, and its compile is lost.

Existing actions that meet the feature: "Try again" restarts at once; a sign-out stops every
Storybook; the commit restart exists so a changed `.storybook/` or fixture shows
([restart record](/specs/done/2026-10-17-storybook-restart.md)). No other feature branch touches
this code.

### Rules and their owners

- When a Storybook restarts: `moved` in [`runner.ts`](/packages/server/src/preview/runner.ts),
  alone.
- When it starts ahead: `warmPreview` and `StartsStorybook` in
  [`App.tsx`](/packages/web/src/App.tsx).
- When it stops: `IDLE_MS` and `sweep` in the runner.

### Likely changes

- Any option: [`runner.ts`](/packages/server/src/preview/runner.ts), split first since it is near
  500 lines; [`fate/preview.ts`](/packages/server/src/fate/preview.ts).
- Fewer restarts: the core's commit read ([`preview.rs`](/crates/core/src/api/preview.rs)) gains a
  diff of changed paths. A list of start-time paths would add a field to
  [the preview decision](/specs/decisions/preview.md), its template, and `ura check`.
- Compiling ahead: the helper,
  [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js), or a crawl from the
  runner.
- Keeping it running: the runner's idle rule, reading the feature's waiting files.
- Tests that guard what changes, in
  [`runner.test.ts`](/packages/server/src/preview/__tests__/runner.test.ts) and
  [`preview.test.ts`](/packages/server/src/__tests__/preview.test.ts): the commit restart tests, and
  the 30-minute idle tests.

## The proposal

### What "too long" means

The proposal names the symptom, up to 10 s, and no target. Measured, a cold start with a first
compile takes longer than 10 s, and a view at an unchanged commit within 30 minutes about 1 to 4 s.

### Past trouble with pre-starting

The proposal recalls issues with pre-starting. The
[warm-up change](/specs/done/2026-10-16-storybook-warmup.md) records two: twelve frames loading
during a start froze the site, fixed by loading frames once on screen; and each Storybook holds
about 1.5 GB for 30 minutes after its last view.

### Machine load

The measurements varied two-fold with the load of other agents. Any target holds only on a quiet
machine.

## Worth it and feasibility

The feature is worth it: story links are how the human reviews UI choices, and every round, spec,
and session with mockups pays this wait. Most of the wait comes from restarts and idle stops the
runner controls, which is cheap to change.

Outside behaviour relied on, not verified:

- Compiling ahead inside Storybook's Vite, by `server.warmup` or a plugin calling Vite's
  `warmupRequest`: one inconclusive run. The plan's first task checks it on a quiet machine.
- A crawl from the runner, fetching `iframe.html` and following its module imports over HTTP, would
  compile the same modules without touching Storybook: not tried.

No security guard is relaxed by any option.

## Approaches

### Overall approach

How to remove the wait. Criteria: the time to a story, the
[preview decision](/specs/decisions/preview.md)'s live stories over the real server, and the cost.

| Option                                      | Time to a story            | Preview decision | Cost                                  |
| ------------------------------------------- | -------------------------- | ---------------- | ------------------------------------- |
| Faster dev Storybook                        | about 1 s warm, cold rarer | kept             | runner rules, a compile ahead         |
| Static build per commit                     | instant once built         | changed          | a build per commit, a separate server |
| Another runner, such as Ladle               | unknown under StyleX       | changed          | every story and the helper rewritten  |
| A picture of the last render while starting | instant picture            | kept             | a headless browser in the server      |

### Which commits restart

See [the proposal's path](#the-proposals-path-and-existing-actions). Options: any commit (today);
any commit changing a file outside `specs/`; only commits changing paths the preview decision lists;
none, leaving "Try again".

### How long a Storybook stays

Options: 30 minutes without a view (today); while one of the feature's files waits for the human; a
longer idle time.

### When the frame shows

Options: at the index's answer (today); once the stories compiled, the "starting" line staying until
then.

### Needs no choice

- A static build's lack of hot reload and of a fixture server rule it out for live mockups unless
  the preview decision changes: covered by the overall approach.
- The fixture build is Uraeda's own cost, and making it cheaper changes no behaviour.

## Not checked

- Whether Vite's `server.warmup` runs in Storybook's middleware mode: no documentation found; one
  inconclusive run.
- The memory of a running Storybook today: the measurement through the process tree was unreliable;
  the 1.5 GB figure is the warm-up record's.
- Ladle's and Histoire's speed with StyleX and the React Compiler: no source found.
