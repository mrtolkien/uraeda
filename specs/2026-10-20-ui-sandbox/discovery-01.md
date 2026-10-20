# Discovery, round 01: Stable dev environment for UI review

## Summary

The proposal asks for a sandbox: the whole web UI, running from a checkout's code with hot reload,
over a frozen seed. The seed holds features at every workflow step, changes, and sessions, and
behaves normally once clicked. Inside it, the human picks an element and sends it to an agent, which
changes the code while the page reloads.

Established tools split this into two halves. Seeded environments (Rails, Laravel, Supabase, demo
modes) give one command that resets to a known, deterministic state. Mock layers (MSW, Mirage) fake
the backend instead, and drift from it. Element pickers (react-grab, Agentation, code-inspector,
Cursor's Design Mode, VS Code's browser) capture an element's identity, and hand it to an agent
through the clipboard, a local queue the agent waits on, or a built-in agent.

Uraeda already has most parts, apart. Its own Storybook builds a seeded repository and runs the real
server over it on a fake agent. The screenshot scripts serve the whole app with Vite over the same
seed. A pick script exists, but only inside story frames, and its pick ends as a comment. Missing: a
navigable whole-app sandbox, seeds for several steps and for changes and sessions, a picker over the
app's own pages, and a channel from a pick to an agent. Two active decisions stand in the way: the
preview decision rejected a whole-app task over fixtures, and the sign-in decision names only tests
and Storybook as code-built apps without sign-in.

## How other products do it

### Rails

- Seeds are Ruby in `db/seeds.rb`, run by `bin/rails db:seed`, and "should be idempotent"
  ([Rails migrations guide](https://guides.rubyonrails.org/active_record_migrations.html)).
- `db:reset` drops and sets the database up again; `db:prepare` skips seeding once tables exist, and
  `db:seed:replant` reloads them (same page).
- Test fixtures are YAML, with labels standing for ids, so keys stay "consistent between runs"
  ([Rails testing guide](https://guides.rubyonrails.org/testing.html)).

### Laravel

- `php artisan migrate:fresh --seed` drops every table, migrates, then seeds; factories build many
  related rows ([Laravel seeding](https://laravel.com/docs/12.x/seeding)).
- Seeding asks for confirmation in `production` unless `--force` is passed (same page).

### Supabase

- `supabase/seed.sql` runs "the first time you run `supabase start` and every time you run
  `supabase db reset`", after migrations, holding data only
  ([Supabase seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)).
- The page calls a hand-written seed "the simplest and most reliable approach" (same page).

### Demo modes

- Rajiv Pant's demo mode keeps deterministic fixtures in the repository, chosen by a `--demo` flag,
  with a visible "DEMO" badge. "Demo mode is a config choice, not a code branch"
  ([Demo mode as a pattern](https://rajiv.com/blog/2026/04/14/demo-mode-as-a-pattern-for-software/)).
- He warns that fixtures must be maintained as the schema evolves, and that separate demo code
  drifts into a second app (same page).
- Kasava's demo mode is a sidebar toggle to a sample project, read-only, with writes "simulated and
  not persisted" ([Kasava demo mode](https://kasava.dev/docs/demo-mode)).

### lazygit, gitoxide, GitButler, jj, GitHub Desktop

- lazygit's integration tests build a repository in a `SetupRepo` step. Its "sandbox mode" runs that
  setup, then lets a human drive the UI
  ([lazygit integration tests](https://github.com/jesseduffield/lazygit/blob/master/pkg/integration/README.md)).
- gitoxide's `gix-testtools` runs a fixture script once, caches its output as an archive keyed by
  the script's hash, and pins git dates, names, and config ([docs](https://docs.rs/gix-testtools)).
  GitButler's test support builds on it.
- jj's test utilities pin a randomness seed, the user, and commit times
  ([jj testutils](https://github.com/jj-vcs/jj/blob/main/lib/testutils/src/lib.rs)).
- GitHub Desktop commits fixture repositories with `.git` renamed `_git`, and renames it back after
  copying
  ([Desktop test helpers](https://github.com/desktop/desktop/blob/development/app/test/helpers/repositories.ts)).

### MSW and Mirage

- MSW intercepts requests at the network level with "zero changes to your code"; its docs keep one
  happy-path handler set, with `worker.use()` overrides per scenario
  ([MSW structuring handlers](https://mswjs.io/docs/best-practices/structuring-handlers),
  [philosophy](https://mswjs.io/docs/philosophy)).
- Mirage is an in-memory fake backend where a write shows in later reads; its last npm release is
  from 2023 ([Mirage database](https://miragejs.com/docs/main-concepts/database/)).
- Mocks drift from the server they copy: Kent C. Dodds calls a fetch mock "a re-implementation of
  all the parts of my backend"
  ([Stop mocking fetch](https://kentcdodds.com/blog/stop-mocking-fetch)).

### Storybook, React Cosmos, Ladle

- Storybook picks a state per story, and toolbar globals add a scenario menu
  ([toolbars and globals](https://storybook.js.org/docs/essentials/toolbars-and-globals)).
- React Cosmos fixtures are named app states, in a tree built from file paths, wrapped by per-folder
  decorators; it reuses the Vite config
  ([Cosmos fixtures](https://reactcosmos.org/docs/fixtures/fixture-modules)).
- Ladle is a Vite-based Storybook alternative with built-in MSW ([Ladle](https://ladle.dev/docs/)).

### Element pickers that hand a pick to an agent

- **react-grab** (MIT): hover, then ⌘C copies the element's HTML and its component stack with
  `file:line:col`. A `pull` command waits for new grabs and prints each as JSON for an agent's loop
  ([react-grab](https://github.com/aidenybai/react-grab),
  [its skill](https://github.com/aidenybai/react-grab/blob/main/skills/react-grab/SKILL.md)). An
  open issue reports undisclosed telemetry and local paths sent to its website
  ([#632](https://github.com/aidenybai/react-grab/issues/632)).
- **Agentation**: annotations carry a selector, styles, bounding box, accessibility data, and
  source. An MCP server on port 4747 offers a blocking `watch_annotations` tool
  ([MCP README](https://github.com/benjitaylor/agentation/blob/main/mcp/README.md)). Its license
  carries a non-compete clause
  ([LICENSE](https://github.com/benjitaylor/agentation/blob/main/LICENSE)).
- **code-inspector** (MIT): a build plugin injects `data-insp-path` attributes. Its AI panel runs
  Claude Code from the browser, with `bypassPermissions` by default
  ([AI feature](https://github.com/zh-lx/code-inspector/blob/main/docs/en/guide/feature/ai.md)).
- **Cursor Design Mode**: the agent gets "the xpath, the component, attributes, computed styles, and
  props from the fiber tree", plus a screenshot; "As agents finish, the app hot reloads"
  ([Design Mode](https://cursor.com/docs/agent/design-mode.md)).
- **VS Code's integrated browser**: "Add Element to Chat" and "Comment on Elements", with optional
  CSS and screenshots
  ([integrated browser](https://code.visualstudio.com/docs/debugtest/integrated-browser)).
- **Claude Code Desktop**: `Cmd Shift S` selects an element in its Browser pane; the page does not
  say what the selection attaches ([desktop](https://code.claude.com/docs/en/desktop.md)).
- **Vercel comments**: a comment records the page path, title, and an element selector, and
  `vercel comments --format json` is meant for agents
  ([changelog](https://vercel.com/changelog/manage-vercel-toolbar-comments-from-the-cli)).

### What they have in common

1. One command that resets to a known state.
2. Determinism: fixed dates, seeds, and ids.
3. Seed data versioned with the code.
4. Named states, picked at runtime.
5. Writes that show in later reads, so the app behaves normally.
6. The real code with hot reload.
7. A clear marker that this is not real data, and no trace in production builds.
8. For pickers: a hover outline, a keyboard toggle, Escape to stop, a note per element, and a
   payload holding the element's identity and the page it is on.
9. For pickers: a channel to the agent, from the clipboard to a queue the agent waits on.
10. For pickers: watching the change hot-reload in place.

## Standards and libraries

### React 19 and source locations

- React removed `__source` and `fiber._debugSource` in
  [PR #28265](https://github.com/facebook/react/pull/28265); tools reading them broke
  ([issue #32574](https://github.com/facebook/react/issues/32574)).
- In development, elements and fibers now carry `_debugStack`, an `Error` captured at creation
  ([ReactJSXElement.js](https://github.com/facebook/react/blob/main/packages/react/src/jsx/ReactJSXElement.js)).
  Turning it into a file and line takes a source map fetch, as react-grab does through bippy
  ([bippy](https://github.com/aidenybai/bippy)).
- `captureOwnerStack()` returns `null` in a native DOM listener, where a picker's click lands
  ([reference](https://react.dev/reference/react/captureOwnerStack)).
- Build-time attributes avoid the runtime cost: code-inspector, LocatorJS, and Onlook inject them.
- Pickers report the component's line, not always the element's, and list items share one line
  ([react-grab changelog](https://github.com/aidenybai/react-grab/blob/main/packages/react-grab/CHANGELOG.md)).

### StyleX

- StyleX keeps class names hashed even in debug mode, so a class name in a pick cannot be searched
  in the source ([babel plugin](https://stylexjs.com/docs/api/configuration/babel-plugin/)).

### Vite

- `import.meta.env.DEV` is replaced at build time, so dev-only code is tree-shaken
  ([env and mode](https://vite.dev/guide/env-and-mode)).
- A plugin's `apply: 'serve'` and `configureServer` never run in a production build
  ([plugin API](https://vite.dev/guide/api-plugin)).

### Faking time

- `@sinonjs/fake-timers` can start from a fixed instant and keep moving with `shouldAdvanceTime`
  ([fake-timers](https://github.com/sinonjs/fake-timers)).
- A random seed alone does not freeze relative dates: Faker needs a reference date too
  ([Faker usage](https://fakerjs.dev/guide/usage.html)).

## The code

### Important reads

- [`packages/server/scripts/dev.ts`](/packages/server/scripts/dev.ts): `vp run dev` rebuilds the
  binding and restarts `vp dev` on a Rust or server change; the UI hot-reloads through Vite. A
  restart ends running turns (`stopDevRuns`).
- [`packages/web/vite.config.ts`](/packages/web/vite.config.ts): `uraedaServer()` mounts the real
  server in Vite's process. Its options swap the agent, lock the repository list, and turn sign-in
  off, which three configs already use: Storybook, screenshots, and browser tests.
- [`packages/server/src/env.ts`](/packages/server/src/env.ts): `URAEDA_REPO`, `URAEDA_DATA_DIR`,
  `URAEDA_CONFIG_DIR`, `URAEDA_PORT`, and `URAEDA_ALLOWED_HOSTS`, from the environment then `.env`.
  Plain `vp dev` uses the developer's real data folder, list, sessions, and sign-in key.
- [`packages/server/src/runner/fake.ts`](/packages/server/src/runner/fake.ts): `FakeAdapter` runs
  nothing. It plays scripted turns when a message is sent, and `emit()` pushes any agent event. It
  has one current process.
- [`packages/server/src/runner/cache.ts`](/packages/server/src/runner/cache.ts): sessions, turns,
  and items live in `runner.sqlite` in the data folder. At start, every running turn becomes
  "stopped", so an agent at work cannot be stored, only replayed.
- [`packages/server/src/testing.ts`](/packages/server/src/testing.ts): `recordRun` seeds a finished
  turn's tokens and times, with no transcript.
- [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts): the shared seed builders,
  `fixtureRepo`, `commitsAt` with dated commits, `addChange`, `addPlan`, `addSpecFeature`, and
  `addStoryFeature`.
- [`packages/web/.storybook/fixture.ts`](/packages/web/.storybook/fixture.ts) and
  [`featurePages.ts`](/packages/web/.storybook/featurePages.ts): Storybook's seed. It copies
  `fixtures/repo` into a temporary folder and adds features at implementation, waiting on a spec,
  blocked, with a pull request, done, and a done change. It dates every commit, sets `URA_TODAY`,
  puts a fake `gh` on `PATH`, and isolates the data and config folders.
- [`fixtures/repo/`](/fixtures/repo/): a round waiting for answers, a spec waiting for review, an
  approved spec without a plan, and a plan waiting for review.
- [`packages/web/scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts): serves the whole
  app with Vite over the same seed and the fake agent, on port 4390.
  [`sessionShots.ts`](/packages/web/scripts/sessionShots.ts) and
  [`change-shots.ts`](/packages/web/scripts/change-shots.ts) make sessions and changes live, by
  driving the UI and emitting events; they are sequences, not a stored seed.
- [`skills/uraeda/assets/storybook/uraeda-pick.js`](/skills/uraeda/assets/storybook/uraeda-pick.js):
  the pick script. In pick mode it outlines the element under the pointer, swallows clicks, and
  posts `{ role, name, text }` to its parent frame; Escape stops it. It runs only in story frames.
- [`packages/web/src/StoryPick.tsx`](/packages/web/src/StoryPick.tsx) and
  [`storyComment.ts`](/packages/web/src/storyComment.ts): a pick becomes
  `Story <file>#<export>, <width>, <role> “<name>”: <text>`, saved as a review comment, an answer
  comment, or unsent text in a session's composer.
- [`packages/web/src/sessions.ts`](/packages/web/src/sessions.ts): `sendMessage` sends text and
  images to a session, or starts a chat; `askAbout` opens a session with its composer prefilled.

### The proposal's path and existing actions

- **Start the sandbox**: no command exists. Storybook and the screenshots each build their seed in a
  temporary folder at every start.
- **Navigate a feature at each step**: the seeds cover a round waiting, a spec waiting, an approved
  spec, a plan waiting, implementation, a pull request, done, and blocked. No seed covers a proposal
  waiting on discovery, a spec or plan revision, the final review, a pull request with changes
  requested, or a change at any step ([steps](/crates/core/src/steps.rs)).
- **Open a session**: past sessions exist only as token counts. Transcripts and an agent at work
  exist only while a script emits events.
- **Click through ("behaves normally")**: answering, approving, editing the priorities or the inbox,
  and starting an agent commit to the seed or add worktrees, and reach open pages live through the
  watcher ([live.ts](/packages/server/src/live.ts)). The seed then differs from its start.
- **Send a message to an agent**: `FakeAdapter` answers only with the turns a script queued.
- **Edit the UI's code**: Vite hot-reloads it. A server or Rust edit restarts the process, which
  holds the seed's server, sessions, and fake agent.
- **Pick an element**: no picker exists over the app's pages.

### Rules and their owners

- **Workflow state comes from git through the core** ([stack decision](/specs/decisions/stack.md)):
  a seed must be a real repository with branches and worktrees; no layer injects fake workflow
  state.
- **Sessions are a cache in the data folder, never in a repository**
  ([agents decision](/specs/decisions/agents.md)): seeded sessions go into the sandbox's own
  `runner.sqlite`.
- **Sign-in is turned off only by code, for tests and Storybook's fixture**
  ([sign-in decision](/specs/decisions/sign-in.md)).
- **Storybook runs the real server over fixture data**
  ([preview decision](/specs/decisions/preview.md)); it rejected "a `vp run preview` task serving
  the whole app over fixtures" as "pages only, and no place for variants".
- **The packaged server never reads `.env`, and ships no dev tooling**
  ([distribution decision](/specs/decisions/distribution.md)).
- **The seed builders**: `test-utils.ts` owns repository building. Storybook's `featurePages.ts` and
  the screenshot scripts each add their own states on top: three copies of "a feature at a step".

### Overlaps with features in flight

- **Fix testing** (`2026-10-19-fix-testing`, implementation): rebuilds the fixture helpers in
  `test-utils.ts` as immutable templates, and moves the UI transforms out of
  `packages/web/vite.config.ts`. It keeps the tests refusing a pick from an untrusted window.
- **Merge chats** (`2026-10-20-merge-chats`, round answered): renames chats, changes, and features
  "sessions", lets a chat start on main and move, and offers upgrades as a card. Whether a chat may
  change code on main is still unanswered. It changes the sessions, routes, sidebar, and the New
  change page, which a seed of sessions follows.

### Likely changes

- A sandbox script or Vite config in `packages/web/`, beside `screenshots.ts`, under every option of
  [where the sandbox lives](#where-the-sandbox-lives).
- [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts) and
  [`packages/web/.storybook/featurePages.ts`](/packages/web/.storybook/featurePages.ts): the missing
  steps, changes, and one shared builder of "a feature at a step".
- A seeder of sessions, writing `runner.sqlite` through the cache API.
- [`packages/server/src/runner/fake.ts`](/packages/server/src/runner/fake.ts): canned replies, or
  replays of stored transcripts.
- [`uraeda-pick.js`](/skills/uraeda/assets/storybook/uraeda-pick.js), or a sibling script for the
  app's pages, with [picking](#what-a-pick-holds).
- A pick queue and a command reading it, with option A of [where a pick goes](#where-a-pick-goes).
- [`specs/decisions/sign-in.md`](/specs/decisions/sign-in.md) and
  [`specs/decisions/preview.md`](/specs/decisions/preview.md), or a new decision, with
  [sign-in](#sign-in-in-the-sandbox) and [where the sandbox lives](#where-the-sandbox-lives).
- [`package.json`](/package.json): a `sandbox` script, and `.gitignore` for its folder.

## The proposal

### Two subsystems

The proposal holds a sandbox and a picker that reaches an agent. They share nothing but the page:
the sandbox is useful without the picker, and the picker could work on `vp run dev` too.

### "Send it to you"

The human writes from a Claude Code terminal. "You" may mean that terminal, or an Uraeda session,
which merge chats is reshaping. The two need different channels.

### "Behaves normally"

Every click on the seed commits to it. A frozen seed and a seed that behaves normally pull apart:
either state survives until a reset, or every start forgets it.

### Agents in a frozen seed

A session's replies come from an agent. A real agent on the seed is normal but slow, costly, and
never the same twice; the fake agent is frozen but answers only what a script queued.

### A sandbox in a worktree

The sandbox shows the code of the checkout it runs from. An agent fixing a pick in a change's
worktree changes code the main checkout's sandbox does not run.

### A hot reload that restarts the server

An edit to the server's code restarts the process that holds the sandbox's server. A seed rebuilt at
every start loses the state the human clicked to.

## Worth it and feasibility

**Gain.** UI work is the main work in Now: the inbox screenshots, layout reviews, the look and feel
pass, and empty inbox ([priorities](/specs/PRIORITIES.md)). Each needs the app in many states. Today
these states exist only inside stories, or in screenshots taken after the fact. The record of the UI
iteration flow says the review of the built UI "was dropped"
([record](/specs/done/2026-10-15-ui-iteration.md#questions)). A sandbox fills that gap.

**Cost.** Most parts exist: the server's options, the fake agent, the seed builders, and the pick
script. The new work is the sandbox command, the missing seeds, a sessions seeder, the fake agent's
replies, the picker over pages, and the pick channel. Seeds need upkeep as the workflow evolves
(Pant, above). One builder shared with Storybook and the screenshots keeps that upkeep in one place.
**Judgement**: worth it, and medium-sized.

**Outside behaviour it relies on.**

- Checked by reading: `uraedaServer()` accepts the fake agent, a locked list, and no sign-in, as
  three configs already do.
- Checked by reading: a seeded `runner.sqlite` survives a restart, except running turns, which
  become stopped.
- Unverified: whether Vite's restart on a server change can keep the sandbox's folders, when they
  are fixed rather than temporary. The plan's first task checks it.
- Unverified: whether the pick script's outline and click capture work over the app's own popovers
  and dialogs from Astryx, which may use portals or the top layer. The plan checks it.

**Guards relaxed.**

- A sandbox without sign-in: any program running on the human's machine could read and change the
  sandbox's sample repository. Websites in the browser still could not, since the guard refuses
  other origins. The repository holds sample data only.
- A pick queue an agent acts on: any program on the machine could post a fake pick, which the agent
  would treat as the human's request to change the real code.

## Approaches

Criteria: the proposal (hot reload, every step, behaves normally, pick to an agent), the
constitution (plain text in git, tools optional, one home per rule), and the active decisions
(preview, sign-in, agents, stack, distribution, UI behaviour).

### Scope

Whether the sandbox and the picker are one feature. See [two subsystems](#two-subsystems).

| Option                                 | Time to first use | Spec size             | Risk                       |
| -------------------------------------- | ----------------- | --------------------- | -------------------------- |
| A. One feature, sandbox and picker     | longer            | about 6 stories       | one review covers both     |
| B. Sandbox now, picker as next feature | shorter           | about 4, then about 3 | picker designed separately |

### Where the sandbox lives

Whether the sandbox is a whole-app command, or more stories in Storybook. See
[rules and their owners](#rules-and-their-owners).

| Option                                     | Hot reload        | Whole app, navigable | Decision change                         |
| ------------------------------------------ | ----------------- | -------------------- | --------------------------------------- |
| A. `vp run sandbox`, whole app, own folder | yes, Vite         | yes                  | preview's rejected alternative revisits |
| B. More page stories in Storybook          | yes, Storybook    | one page per story   | none                                    |
| C. A sandbox mode inside `vp run dev`      | yes, `vp run dev` | yes                  | mixes real and sample data in one app   |

### State lifetime

Whether the sandbox keeps what the human clicked. See ["behaves normally"](#behaves-normally) and
[a hot reload that restarts the server](#a-hot-reload-that-restarts-the-server).

| Option                                      | Survives a server restart | Reset         |
| ------------------------------------------- | ------------------------- | ------------- |
| A. Kept in a git-ignored folder until reset | yes                       | a reset flag  |
| B. Rebuilt at every start, like Storybook   | no                        | every restart |

### Sign-in in the sandbox

See [guards relaxed](#worth-it-and-feasibility).

| Option                             | Friction             | Decision change             |
| ---------------------------------- | -------------------- | --------------------------- |
| A. Off, built by code              | none                 | the sign-in exception grows |
| B. On, with a key printed at start | one sign-in per seed | none                        |

### Agents in the sandbox

See [agents in a frozen seed](#agents-in-a-frozen-seed).

| Option                                           | Deterministic | Cost   | "Behaves normally"     |
| ------------------------------------------------ | ------------- | ------ | ---------------------- |
| A. Seeded transcripts, canned streamed replies   | yes           | none   | messages, no file work |
| B. A, plus scripted step outcomes (canned files) | yes           | none   | steps move on          |
| C. The real agent on the seed                    | no            | tokens | fully                  |

### Which states

What the seed holds. See [the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                           | Coverage | Upkeep  |
| ---------------------------------------------------------------- | -------- | ------- |
| A. Every step, changes, sessions, plus empty and broken projects | complete | highest |
| B. Every step, changes, and sessions, in one repository          | the flow | medium  |
| C. Storybook's seed as it is                                     | partial  | none    |

### Where a pick goes

See ["send it to you"](#send-it-to-you).

| Option                                                    | Agent-agnostic | Works from a terminal agent | New surface       |
| --------------------------------------------------------- | -------------- | --------------------------- | ----------------- |
| A. A queue a command waits on, printing each pick         | yes            | yes                         | a route, a script |
| B. A new session in the human's running Uraeda, prefilled | Uraeda only    | no                          | a link            |
| C. The clipboard                                          | yes            | by pasting                  | none              |
| D. A real agent panel inside the sandbox                  | no             | no                          | a second chat UI  |

### What a pick holds

See [React 19 and source locations](#react-19-and-source-locations) and [StyleX](#stylex).

| Option                                                              | Finds the code    | Dependency     | Fragility           |
| ------------------------------------------------------------------- | ----------------- | -------------- | ------------------- |
| A. Role, name, text, page address, width, theme, HTML snippet, note | by searching text | none           | low                 |
| B. A, plus file and line from a build plugin (code-inspector)       | directly          | a Vite plugin  | low                 |
| C. A, plus file and line read from React's debug stacks             | directly          | none, or bippy | high, React private |

### Needs no choice

- **A clear marker**: the sandbox shows that it is one, as every demo mode does; its look is settled
  in the round.
- **Determinism**: the existing seeds already pin commit dates and `URA_TODAY`; the sandbox does the
  same.
- **No trace in production**: the sandbox's script and seed are loaded only by its own config, as
  Storybook's are.
- **Hover outline, keyboard toggle, Escape**: the pick script already does them; the UI behaviour
  decision asks for a keyboard path.
- **A screenshot in the pick**: a browser cannot capture its own page without a library or a screen
  share prompt; the agent can open the sandbox's address itself.

## Not checked

- Claude Code Desktop's element selection payload: its page names only the shortcut.
- Whether Astryx's popovers and dialogs render in portals or in the top layer.
- Recording and replaying Claude Code's stream output into a server: nothing was searched beyond the
  repository's own [`fixtures/claude/`](/fixtures/claude/).
- React Cosmos's URL format for selecting a fixture, and Storybook's `?globals=` parameter.
