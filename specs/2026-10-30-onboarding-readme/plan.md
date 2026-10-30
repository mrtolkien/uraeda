---
status: auto-approved
spec-revision: 2
---

# Plan: Onboarding + README pass

**Goal:** a short README with screenshots, the reference moved to `INSTALL.md`, `docs/`, and
`CONTRIBUTING.md`, and a setup check in the core that Home's Setup pane and `ura status` both show.

**Architecture:** the core owns what "set up" means: a new `api/setup.rs` reads the default branch's
constitution and decisions, as the ledger does, and returns the setup's items while a required one
is not written, and none once the project is set up. `read_workspace` carries them in a new `setup`
field of `WorkspaceView`, with or without `specs/`; `ura status` reads them through
`api::read_setup`. The server passes the field through its `Workspace` record, which every watched
change already sends again, so Home follows files as they land. The setup message lives with the
other default-branch messages in `round-messages.ts`, read by the pane and by the New page. The
screenshots' command reuses the screenshot scripts' server and contexts, over a freshly built
realistic project. See the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A constitution whose rule holds a markdown link**, like `- Follow [the guide](docs/x.md).`, is
   written, not the template: only a bracketed span that is not a link, an image, or a callout is a
   placeholder. Task 1, a row of the setup test.
2. **A constitution written except its dates**, `**Ratified**: [YYYY-MM-DD]`, is still the template,
   as the spec's rule names dates. Task 1, a row of the setup test.
3. **A project whose default branch is checked out in another worktree**, with `ura status` run in a
   feature's worktree: both read the default branch's files, so both list the same items. Task 1
   reads through the ledger's `source`; no test of its own, since the ledger's tests own that
   source.
4. **The New page opened by "Set up with the agent", then reloaded**: the reload empties the
   session's composer, whose draft is kept in memory only, and the history entry fills it with the
   message again; a composer holding text keeps it. Task 4, reviewed in the sandbox.

## Global constraints

Existing behaviour to preserve:

- `ura status` in a repository without `specs/` still fails with
  `ura: no specs/ folder at <path>: run ura init`, as `crates/cli/tests/status.rs` `no_specs_folder`
  asserts.
- The workspace still says a repository has no `specs/`: `noSpecs` keeps its value, as the server's
  test "starting in a repository without specs/ adds it, given: %s" asserts.
- `ura status --json` keeps `"version": 1` and every field it has: the new `setup` field is added
  beside them.
- `ura init` and the skill's setup never overwrite a file: unchanged.

From [stack](../decisions/stack.md):

- Workflow logic, parsing, validation, and states MUST live in the Rust core. Checked by review.
- TypeScript MUST reach the core only through the binding, never reimplementing it. Checked by
  review.
- The server MUST be TypeScript on Node, and the web UI React with Astryx, the UI's design system,
  fed only by the server through fate, its data library. Checked by review.

From [CLI](../decisions/cli.md):

- Every rule the CLI enforces or checks MUST be written in the skill, in
  [`skills/uraeda/`](/skills/uraeda/). Checked by review.
- A change to a rule MUST update the skill and the CLI in the same change. Checked by review.
- What commands print MUST be stable for tools to read, with versioned JSON on every read command.
  Checked by the CLI's tests.

From [problems](../decisions/problems.md):

- Home and the sidebar's cards MUST show problems only. Checked by review. The Setup pane is not a
  card, and holds no check result.

From [UI components](../decisions/ui-components.md):

- Views MUST use Astryx components wherever one fits the job. Checked by lint.
- Views MUST be styled only through Astryx's theme, never with a global stylesheet or inline styles.
  Checked by lint.
- A kind of information MUST be drawn by one shared component on every page that shows it. Checked
  by review. The pane is the shared `Pane`, and its fallback the shared `MessageToCopy`.

From [preview](../decisions/preview.md):

- A spec's mockups, and the named states of views, MUST be stories written with the real components,
  next to them. Checked by review and lint.
- The full check, `vp run ready`, MUST build Storybook, so a story that does not compile fails it.
  Checked by the `storybook:build` task.

From [testing](../decisions/testing.md):

- At the `early` stage, a feature MUST test little beyond stored formats, git, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed.
  Checked by review.
- A UI change MUST be easy to try in the running app, through the sandbox. Checked by review.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width. Checked by review.
- A pull request that adds a view MUST show one screenshot of it, never committed to the repository.
  Checked by review. The README's screenshots are documentation, as the spec's assumptions say.

From [sandbox](../decisions/sandbox.md):

- The sandbox MUST serve the whole web UI from the checkout it runs in, with hot reload, over sample
  projects only. Checked by review.

From [documentation](../decisions/documentation.md):

- The README MUST hold only what a newcomer needs to understand Uraeda, see it, install it, and
  start, linking to the rest. Checked by review.
- The README MUST present Uraeda as a workflow first, then the CLI that enforces it, then the web UI
  that drives it. Checked by review.
- The README's install MUST stay a few commands, with every other way to install in `INSTALL.md`.
  Checked by review.
- Reference for users, such as settings, sign-in, and the CLI's commands, MUST live in pages under
  `docs/`. Checked by review.
- Building, testing, and releasing Uraeda MUST be explained in `CONTRIBUTING.md`. Checked by review.
- Documentation MAY repeat the skill's rules, or another page's facts, wherever that helps its
  reader. Checked by review.

From [code quality](../decisions/code-quality.md): functions at most 100 lines and 7 parameters, 4
levels of nesting, TypeScript files at most 500 lines (clippy and Oxlint); no new marker.

From [the spec](spec.md), word for word:

- The setup's items, in order: `specs/ folder` (required, listed only while `specs/` does not
  exist), `Constitution` (required, done when `specs/CONSTITUTION.md` exists and is no longer the
  template), `Code-quality decision` (required, `specs/decisions/code-quality.md` exists),
  `Testing decision` (required, `specs/decisions/testing.md` exists), `Preview decision` (optional,
  `specs/decisions/preview.md` exists; never keeps the pane open).
- A constitution is still the template while its title, a principle's name, a rule, or a date is a
  bracketed placeholder, like `[Project]` or `[YYYY-MM-DD]`.
- A decision counts as written once its file exists, whatever its status.
- The states read `missing`, `still the template`, `written`; an optional item reads `optional`.
- The pane's count is the required items left. Its title is "Setup", its tone "needs you".
- The setup message:
  `/uraeda Set this project up for Uraeda: write what is missing, ask me before writing the constitution, never overwrite a file.`
- The button reads "Set up with the agent". Without the agent: "Give this message to an agent in
  this repository:", the message, "Copy the message", and "Install Claude Code", linking
  `https://code.claude.com/docs/en/setup`.
- `ura status` after `ura init` ends with:

  ```text
  Setup: 3 files missing
    Constitution: still the template
    Code-quality decision: missing
    Testing decision: missing
  ```

- Screenshots: Home, a round of questions, and a spec of the realistic project, at 1440 × 900 and
  402 × 874, light and dark, as WebP in `docs/images/screenshots/`, taken by
  `vp run readme:screenshots`.
- SC-001: the README holds at most 1,000 words, banner to license.

## Code read

- [`crates/core/src/api.rs`](/crates/core/src/api.rs) `read_workspace`: on `NoSpecs`, returns a
  `WorkspaceView` with `no_specs` set and nothing else read; otherwise
  `WorkspaceView::new(&workspace, …)`.
- [`crates/core/src/view.rs`](/crates/core/src/view.rs) `WorkspaceView`: a `napi(object)` struct,
  camelCase for the binding; built in `WorkspaceView::new` and in `read_workspace`'s `NoSpecs` arm.
- [`crates/core/src/api/ledger.rs`](/crates/core/src/api/ledger.rs) `source`: reads the constitution
  and the decisions from the default branch's checkout, this one without a default branch, else its
  tip. `read_ledger` and `ledger_hash` use it.
- [`crates/core/src/embedded.rs`](/crates/core/src/embedded.rs) `is_placeholder`: a paragraph wholly
  in brackets.
- [`skills/uraeda/assets/templates/specs/CONSTITUTION.md`](/skills/uraeda/assets/templates/specs/CONSTITUTION.md):
  `# [Project] Constitution`, `### I. [Principle name]`, rules like `- [Rule]`, and
  `**Ratified**: [YYYY-MM-DD]`.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs) and
  [`packages/server/src/live.ts`](/packages/server/src/live.ts) `publish`: every watched change
  sends the `Workspace` record again, and the top level of each worktree is watched, so `specs/`
  appearing is seen. Nothing to change for Home to follow files as they land.
- [`crates/cli/src/status.rs`](/crates/cli/src/status.rs) `run` and `render`; JSON through
  [`output::print_json`](/crates/cli/src/output.rs), which wraps the value with `version`. Tests in
  [`crates/cli/tests/status.rs`](/crates/cli/tests/status.rs), on `TestRepo` and `specs()`, which
  writes `# Constitution` and no decision.
- [`packages/server/src/fate/sources.ts`](/packages/server/src/fate/sources.ts) `workspace`: spreads
  the binding's view into the record; [`fate/views.ts`](/packages/server/src/fate/views.ts)
  `workspaceDataView` and the web's [`views.ts`](/packages/web/src/views.ts) `WorkspaceView` select
  its fields.
- [`packages/server/src/runner/round-messages.ts`](/packages/server/src/runner/round-messages.ts):
  the default branch's messages, free of Node's modules, imported by the UI as
  `uraeda-server/round-messages`.
- [`packages/web/src/Home.tsx`](/packages/web/src/Home.tsx): `NoSpecs` alone without `specs/`, else
  the notes and `HomeHub`. [`layout/Missing.tsx`](/packages/web/src/layout/Missing.tsx) `NoSpecs`,
  also on [`decisions/DecisionsPage.tsx`](/packages/web/src/decisions/DecisionsPage.tsx).
- [`packages/web/src/home/Setup.tsx`](/packages/web/src/home/Setup.tsx) and its stories: the spec's
  mockups, `SetupPane` with its own `SetupItem` type.
- [`packages/web/src/NewPage.tsx`](/packages/web/src/NewPage.tsx): a proposal's Start navigates with
  `{ insert: "line:<id>" }` in the history entry
  ([`routeHistory.ts`](/packages/web/src/routeHistory.ts) `Entry.insert`); the page inserts it once,
  then drops `insert` from the entry with `replaceState`. `useDraft` holds the session's text.
- [`packages/web/src/data.ts`](/packages/web/src/data.ts) `useAgent`: `available` says whether
  Claude Code answers.
- [`packages/web/samples/projects.ts`](/packages/web/samples/projects.ts) `buildProjects` and
  [`sandbox/seed.ts`](/packages/web/sandbox/seed.ts) `Projects`, `paths`, `build`: four projects,
  each listed with `addRepository`. The realistic project has Uraeda's own constitution and
  decisions (`fixtures/realistic/`), so it is set up and shows no Setup pane.
  [`samples/__tests__/projects.test.ts`](/packages/web/samples/__tests__/projects.test.ts) and
  [`sandbox/__tests__/seed.test.ts`](/packages/web/sandbox/__tests__/seed.test.ts) "the sandbox
  lists its four projects, in its own data folder".
- [`packages/web/scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts): `serve` (Vite with
  the server in process on a `FakeAdapter`, without sign-in), and the four browser contexts, WebKit,
  402 × 874 with touch and 1440 × 900, light and dark, reduced motion, UTC.
  [`shots.ts`](/packages/web/scripts/shots.ts) `shooter`, `show`, `settle`, and `save`, which names
  a file `<view>-<size>-<mode>.webp`, encoded by the core.
- [`packages/web/sandbox/sessions.ts`](/packages/web/sandbox/sessions.ts) `seedSessions`: seeds the
  realistic project's live session on `REALISTIC_FOLDERS.reviewing` with `seedLiveSession`.
- [`README.md`](/README.md): 3,515 words; sections Why, How you use it today, What it looks like,
  the `specs/` folder, Install, the `ura` CLI, Editors, Inspirations, Building the tools, Project
  status. [`packages/uraeda/README.md`](/packages/uraeda/README.md) links to the repository.
- Validation: `nix develop -c vp run fast` for a task, `nix develop -c vp run ready` before the
  push; Rust tests with `nix develop -c cargo nextest run -p <crate>`; the binding's types with
  `vp run --filter uraeda-binding build`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| Addition                                                | Why                                                                                  | Simpler alternative rejected                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `SetupItem` and `api/setup.rs` in the core              | One owner of what "set up" means, for Home and `ura status` (spec's architecture)    | Computing it in TypeScript and Rust: two copies, against the stack decision |
| The list of setup files, a copy of the skill's setup    | The spec's accepted tradeoff; the code links the skill's section                     | Parsing the skill's prose: fragile                                          |
| `serveUi` and `openShots` moved into `scripts/shots.ts` | Shared by the review screenshots and the README's                                    | Copying Vite's setup and the contexts into a second script                  |
| A fifth sample project, without `specs/`                | The spec's sandbox item; the Setup pane's no-specs state is otherwise not reviewable | None                                                                        |

## Test map

The core's test reads real git repositories made by `TestRepo`, through `api::read_workspace`. The
CLI's test runs the `ura` binary on a `TestRepo`. The server's test starts the server in process
over the binding. The UI's states are stories, and the views are reviewed in the sandbox, as the
testing decision asks at the `early` stage.

| Spec item                                                  | Task | Check                                                                                  |
| ---------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| US1 key 1–3, more 1–2 (banner, agents, Claude Code's plan) | 6    | none: documentation, checked by review, and in GitHub's preview of the branch          |
| US1 key 4 (`vp run readme:screenshots`)                    | 5    | its run, which writes the 12 files and only them                                       |
| US2 key 1–2 (web UI page, `CONTRIBUTING.md`)               | 6    | none: documentation, checked by review against the moved-facts list                    |
| US3 key 1 (after `ura init`, count 3)                      | 1, 4 | `setup.rs` "setup items", row `after_init`; the pane reviewed in the sandbox's `empty` |
| US3 key 2 (the pane leaves as files land)                  | 1, 4 | row `set_up` (no items); live update by `publish`, existing; reviewed in the sandbox   |
| US3 key 3 (without `specs/`, count 4)                      | 1, 4 | row `no_specs`; the sandbox's `bare` project                                           |
| US3 more 1 (half-written constitution)                     | 1    | row `half_written`                                                                     |
| US3 more 2 (testing decision `proposed` is written)        | 1    | row `set_up`, whose decisions are `proposed`                                           |
| US3 more 3 (no preview decision, no pane)                  | 1    | row `set_up`, which has none                                                           |
| US4 key 1 (New page, message unsent)                       | 4    | none: reviewed in the sandbox, as the testing decision asks for the UI                 |
| US4 key 2 (session runs in the main checkout)              | 4    | existing: `newChat` runs every chat there                                              |
| US4 key 3 (without Claude Code)                            | 4    | story `WithoutAgent`; reviewed in the sandbox                                          |
| US5 key 1 (`ura status` text)                              | 3    | `status.rs` "setup lists what the project lacks", row after init                       |
| US5 key 2 (`--json` field)                                 | 3    | same test, its JSON assertion                                                          |
| US5 key 3 (set up, no Setup lines)                         | 3    | same test, row set up                                                                  |
| Edge: written constitution not overwritten                 | 2    | the message's text, a global constraint; the skill's setup, unchanged                  |
| Edge: half written                                         | 1    | row `half_written`                                                                     |
| Edge: decision `proposed`                                  | 1    | row `set_up`                                                                           |
| Edge: `specs/` without `decisions/`                        | 1    | row `after_init`, whose `decisions/` is absent                                         |
| Edge: a file lands while Home is open, announced           | 4    | none: live update existing; announcement reviewed in the sandbox                       |
| Edge: signed out, edited message                           | —    | existing behaviour, unchanged                                                          |
| Edge: screenshots not taken again                          | —    | none: accepted by the spec                                                             |
| Edge: preview decision saying no preview                   | 1    | covered by "exists": row `one_left` has a preview file                                 |
| Edge: README on npm or crates.io                           | 6    | review of `packages/uraeda/README.md`'s links                                          |
| SC-001 (≤ 1,000 words)                                     | 6    | `wc -w README.md` in the task's run step                                               |
| SC-002 (nothing lost, links resolve)                       | 6    | the task's list of today's facts and where each went, and a link check in its run step |
| SC-003 (two presses)                                       | 4    | none: reviewed in the sandbox                                                          |
| SC-004 (same items, CLI and Home)                          | 1, 3 | none: both read the one core function                                                  |
| SC-005 (the check's cases)                                 | 1    | `setup.rs` "setup items", every row                                                    |
| SC-006 (one command)                                       | 5    | its run from a clean checkout                                                          |
| Review focus: a link in a rule                             | 1    | row `link_in_rule`                                                                     |
| Review focus: dates still placeholders                     | 1    | row `dates_left`                                                                       |
| Review focus: another worktree                             | 1    | none: the ledger's tests own `source`                                                  |
| Review focus: reload of the New page                       | 4    | none: reviewed in the sandbox                                                          |
| Contract: the workspace record carries `setup`             | 4    | the server's no-specs test, one added assertion                                        |

## Waves

1. Tasks 1 and 2: the core's check, and the sandbox's project without `specs/`. No shared file.
2. Tasks 3 and 4: `ura status`, and the server and the web UI, both on task 1's `read_setup` and
   `WorkspaceView.setup`. No shared file.
3. Tasks 5 and 6: the screenshots' command and its images, and the documentation, which links the
   images by the names task 5's Interfaces give. No shared file.

---

## Task 1: The setup check in the core

**Risky:** a new field of the workspace's view, which the binding, the server, the UI, and the CLI
read.

**Files:**

- Create: `crates/core/src/api/setup.rs`
- Modify: `crates/core/src/api.rs` (`read_workspace`, the module list and re-exports),
  `crates/core/src/api/ledger.rs` (`source` and `Texts` visible to `setup.rs`),
  `crates/core/src/view.rs` (`WorkspaceView`)
- Modify (generated): `packages/binding/index.d.ts`
- Test: `crates/core/tests/setup.rs`

**Interfaces:**

- Produces:
  - `uraeda_core::api::SetupItem`, a `napi(object)`, `Serialize`, camelCase struct:
    `{ key: String, name: String, state: String, required: bool }`. `key` is one of `specs`,
    `constitution`, `code-quality`, `testing`, `preview`; `name` the spec's item name; `state` one
    of `missing`, `template`, `written`.
  - `WorkspaceView.setup: Vec<SetupItem>`, `setup: Array<SetupItem>` in the binding: every item, in
    the spec's order, while a required item is not written; empty once the project is set up.
  - `uraeda_core::api::read_setup(repo: &Path) -> Result<Vec<SetupItem>>`: the same list, for a
    repository with `specs/`.

- [x] **Step 1: Write the failing test**

One table test, `setup_items`, each row a repository and the `(key, state)` pairs
`api::read_workspace(repo)?.setup` gives, or none:

| Row            | Repository                                                                                         | Expected                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `no_specs`     | one commit, no `specs/`                                                                            | specs missing, constitution missing, code-quality missing, testing missing, preview missing |
| `after_init`   | `specs/` with the template constitution (`embedded::template("CONSTITUTION.md")`), no `decisions/` | constitution template, code-quality missing, testing missing, preview missing               |
| `half_written` | principle I written, `### II. [Principle name]` left, title and dates written                      | constitution template, …                                                                    |
| `dates_left`   | everything written but `**Ratified**: [YYYY-MM-DD]`                                                | constitution template, …                                                                    |
| `link_in_rule` | a written constitution whose rule holds `[the guide](docs/x.md)`, no decision                      | constitution written, code-quality missing, …                                               |
| `one_left`     | a written constitution, `code-quality.md` and `preview.md` present                                 | constitution written, code-quality written, testing missing, preview written                |
| `set_up`       | a written constitution, `code-quality.md` and `testing.md` both `proposed`, no `preview.md`        | no item                                                                                     |

Each row asserts the pairs of its items, not their names. The `no_specs` row also asserts the item
`specs` is `required` and `preview` is not.

The break each row catches: `no_specs`, a view that skips the check without `specs/`; `after_init`,
a template read as written, or a missing `decisions/` read as an error; `half_written` and
`dates_left`, a check of the title alone; `link_in_rule`, any bracket read as a placeholder;
`one_left`, a decision read from the wrong folder; `set_up`, an optional preview or a `proposed`
status that keeps the pane.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test setup`
- Expected: FAIL to compile, `no field `setup`on type`WorkspaceView``

- [x] **Step 3: Implement the check in `crates/core/src/api/setup.rs`**

`setup_items(git: &Git, has_specs: bool) -> Vec<SetupItem>`, crate-private, reads the default
branch's constitution and decisions through the ledger's `source`, and builds the five items, the
`specs` item only when `has_specs` is false. It returns an empty list when every required item is
`written`. The module's doc links the skill's
[setting up a project](/skills/uraeda/references/projects.md#setting-up-a-project), whose list it
copies.

The template rule: the constitution is `template` when its `#` title, a `###` heading, a list item,
or the line holding `**Ratified**` has a bracketed span `[…]` that is not a link (`[…](…)` or
`[…][…]`), an image, or a callout (`[!…]`). Use the core's document tree or plain lines, whichever
is simpler.

`read_workspace` fills `setup` in both arms: `setup_items(&git, false)` without `specs/`, and
`setup_items(&git, true)` otherwise; `WorkspaceView::new` sets it empty. `read_setup` discovers the
repository and calls `setup_items(&git, true)`.

- [x] **Step 4: Rebuild the binding's types**

- Run: `nix develop -c vp run --filter uraeda-binding build`
- Expected: `packages/binding/index.d.ts` gains `SetupItem` and `setup: Array<SetupItem>` in
  `WorkspaceView`

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test setup`, then
  `nix develop -c vp run fast`
- Expected: PASS. Then break the link rule, so any bracket is a placeholder, see `link_in_rule`
  fail, and revert.

- [x] **Step 6: Commit**

```bash
git add crates/core packages/binding/index.d.ts
git commit -m "feat(onboarding-readme): the setup check in the core"
```

## Task 2: A sample project without `specs/`

**Files:**

- Modify: `packages/web/samples/projects.ts` (`buildProjects`, the header comment),
  `packages/web/sandbox/seed.ts` (`Projects`, `paths`, `build`)
- Test: `packages/web/sandbox/__tests__/seed.test.ts` ("the sandbox lists its four projects…", and
  the quick builders' counts), `packages/web/sandbox/__tests__/sandbox.test.ts` (the listed names)

**Interfaces:**

- Produces: `buildProjects(dir)` returns a fifth path, `bare`: a repository with one commit, a
  `README.md`, and no `specs/`. The sandbox lists it.

- [x] **Step 1: Update the sandbox's listing test to five projects**

Rename it "the sandbox lists its five projects, in its own data folder", and add
`built.projects.bare` to its expected list, in the order the seed adds them. The break it catches: a
project built but never listed.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test packages/web/sandbox/__tests__/seed.test.ts`
- Expected: FAIL, the listed paths lack `bare`

- [x] **Step 3: Build and list `bare`**

In `buildProjects`, `initRepository(paths.bare)`, write a one-line `README.md`, and commit it,
inside `dated`. In `seed.ts`, add `bare` to `Projects` and `paths`, and list it first in `build`'s
`addRepository` loop, so "sample" stays the most recently opened.

- [x] **Step 4: Run the task's validation**

- Run: `vp test packages/web/sandbox packages/web/samples`, then `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web/samples/projects.ts packages/web/sandbox
git commit -m "feat(onboarding-readme): a sample project without specs/"
```

## Task 3: `ura status` lists what the project lacks

**Files:**

- Modify: `crates/cli/src/status.rs` (`run`, `render`)
- Modify: `skills/uraeda/references/projects.md` (Setting up a project),
  `skills/uraeda/references/cli.md` (`ura status`)
- Test: `crates/cli/tests/status.rs`

**Interfaces:**

- Consumes: `uraeda_core::api::read_setup(repo: &Path) -> Result<Vec<SetupItem>>` (task 1).
- Produces: `ura status --json` has a top-level `setup` array of `{ key, name, state, required }`.

- [x] **Step 1: Write the failing test**

`setup_lists_what_the_project_lacks`, two rows:

- After init: `ura init` run in a `TestRepo` (or its files written: the template constitution, no
  decision), then `ura status`. Its stdout ends with the spec's four lines, exactly; and
  `ura status --json` has
  `setup[0] == { key: "constitution", name: "Constitution", state: "template", required: true }` and
  four items: the `specs/` folder's is listed only without `specs/`, where `ura status` fails.
- Set up: `specs()`, then a written constitution and `code-quality.md` and `testing.md` committed.
  Its stdout does not contain `Setup:`, and its JSON's `setup` is empty.

The break each catches: a status that never prints the check, or prints the optional preview.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-cli --test status setup_lists`
- Expected: FAIL, stdout does not end with `Setup: 3 files missing`

- [x] **Step 3: Print the items**

`run` reads `read_setup` from the current folder. The text ends, after the groups and a blank line,
with `Setup: <n> files missing` (`1 file missing` for one), then one line per required item not
written, indented two spaces, `<Name>: <missing | still the template>`, the title in bold as the
groups' titles are. Nothing when the list is empty. The JSON prints the workspace with `setup`
beside its fields (a wrapper struct with `#[serde(flatten)]`), `version` unchanged.

In the skill, `projects.md`'s setup section gains a paragraph: a project is set up once its
constitution has no placeholder left, and its code-quality and testing decisions exist, whatever
their status; the preview decision is optional; `ura status` and the web UI's Home list what is
missing. `cli.md`'s `ura status` entry says it ends with the missing setup files.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-cli`, then `nix develop -c vp run fast`
- Expected: PASS, `no_specs_folder` included

- [x] **Step 5: Commit**

```bash
git add crates/cli skills/uraeda/references/projects.md skills/uraeda/references/cli.md
git commit -m "feat(onboarding-readme): ura status lists the missing setup files"
```

## Task 4: Home's Setup pane and the setup message

**Files:**

- Start from: `packages/web/src/home/Setup.stories.tsx` (the spec's mockups) and
  `packages/web/src/home/Setup.tsx`
- Modify: `packages/server/src/runner/round-messages.ts` (`SET_UP_PROJECT`),
  `packages/server/src/fate/views.ts` (`workspaceDataView`), `packages/web/src/views.ts`
  (`WorkspaceView`), `packages/web/src/home/Setup.tsx`, `packages/web/src/home/Setup.stories.tsx`,
  `packages/web/src/Home.tsx`, `packages/web/src/layout/Missing.tsx` (`NoSpecs`),
  `packages/web/src/NewPage.tsx`, `packages/web/src/routeHistory.ts` (`Entry.insert`'s comment),
  and, for a repository without `specs/` (R8), `packages/web/src/shell/Tabs.tsx`,
  `packages/web/src/shell/ColumnPanes.tsx`, `packages/web/src/decisions/DecisionsPage.tsx`
- Test: `packages/server/src/__tests__/server.test.ts` ("starting in a repository without specs/
  adds it, given: %s")

**Interfaces:**

- Consumes: `WorkspaceView.setup: Array<SetupItem>` (task 1).
- Produces: `SET_UP_PROJECT`, the spec's message, exported from `round-messages.ts`. The New page
  reads `{ insert: "setup" }` in its history entry.

- [x] **Step 1: Assert the record carries `setup`**

In the server's no-specs test, select `setup` beside `noSpecs`, and assert the record's first
`setup` item is `{ key: "specs", state: "missing" }` (its other fields not compared). Update the
test's comment: its home now shows the Setup pane. The break: a record that drops the field.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test packages/server/src/__tests__/server.test.ts -t "without specs"`
- Expected: FAIL, the record has no `setup`

- [x] **Step 3: Pass the field through, and add the message**

Add `setup: true` to both selections, and `SET_UP_PROJECT` to `round-messages.ts`, with a comment
saying it starts the skill's setup.

- [x] **Step 4: Draw the pane from the core's items**

`SetupPane` takes the core's `SetupItem` (from `uraeda-binding` types, as other views import them),
and keeps each item's "about" line in a map by `key`, the mockups' words, `specs`: "Where Uraeda
keeps the workflow's files". `required: false` reads "optional". It announces each item that turns
`written` while shown as a polite status, "<Name> written.", as
[`AnnouncedBanner`](/packages/web/src/layout/AnnouncedBanner.tsx) announces. The stories follow the
new type, their states unchanged.

On Home, the pane comes first, above the notes and `HomeHub`, while `workspace.setup` is not empty;
without `specs/`, it is the page's only content, in place of `NoSpecs`. Its button navigates to
`here("/new?kind=session")` with `{ insert: "setup" }`; `hasAgent` is
`useAgent()?.available === true`; `message` is `SET_UP_PROJECT`.

The New page, arriving with `insert: "setup"` on the session kind, sets the session's draft to
`SET_UP_PROJECT` once, replacing what it held, and drops `insert` from the entry as a proposal's
Start does. Nothing is sent.

`NoSpecs`, on the Decisions page only, reads "No specs/ folder in <path>. Set the project up from
Home.", with a link "Open home".

Once the core gives no item, the pane closes in 200 ms rather than vanish, showing its required
items written meanwhile, and its announcements sit beside it, so the last file written is still
heard (R9). On the phone, an item's "about" line takes the full width under its icon and name.
Without `specs/`, the shell's Commit, the Decisions page, and the New page read no priorities nor
ledger, which the core cannot give there (R8).

- [x] **Step 5: Review it in the sandbox**

- Run: `vp run sandbox --reset`, then open `bare`, `empty`, and `realistic`'s Home, and "Set up with
  the agent" on `empty`, at 1440 px and 402 px, in both themes. In `empty`, write a constitution and
  `code-quality.md` and `testing.md` in its checkout, and commit.
- Expected: `bare` shows the pane alone, counting 4; `empty` shows it first, counting 3; the New
  page opens on a session with the message, unsent; the pane leaves `empty`'s Home without a reload
  once the three files are committed; `realistic` shows no pane. Save one screenshot of the pane for
  the pull request, outside the repository.

- [x] **Step 6: Run the task's validation**

- Run: `vp test packages/server/src/__tests__/server.test.ts`, then `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 7: Commit**

```bash
git add packages/server packages/web/src
git commit -m "feat(onboarding-readme): Home's Setup pane, and setting up with the agent"
```

## Task 5: The README's screenshots

**Files:**

- Create: `packages/web/scripts/readme-screenshots.ts`, `docs/images/screenshots/*.webp` (12)
- Modify: `packages/web/scripts/shots.ts` (gains `serveUi` and `openShots`),
  `packages/web/scripts/screenshots.ts` (uses them), `packages/web/samples/projects.ts` (exports the
  realistic project's builder), `packages/web/sandbox/sessions.ts` (the realistic project's live
  session, seedable alone), `package.json` (`readme:screenshots`)

**Interfaces:**

- Produces: `docs/images/screenshots/<view>-<size>-<mode>.webp`, `view` one of `home`, `questions`,
  `spec`; `size` `desktop` or `phone`; `mode` `light` or `dark`. Task 6 links them by these names.

- [x] **Step 1: Share the server and the contexts**

Move `serve` from `screenshots.ts` to `shots.ts` as
`serveUi(adapter: FakeAdapter, port: number, started?: (server) => void)`, `started` passed to the
server as the sandbox's config passes it (R13), and the creation of the four contexts as
`openShots(browser: Browser, url: string): Promise<Array<Shot>>`, the notifications banner dismissed
as today. `screenshots.ts` calls both; its output is unchanged. Export the realistic project's
builder as `buildRealistic(repo: string)`, dated as `buildProjects` dates it, and the realistic part
of `seedSessions` as `seedRealisticSession(dataDir: string, realistic: string)`, which
`seedSessions` calls.

- [x] **Step 2: Write `readme-screenshots.ts`, run by `vp run readme:screenshots`**

It builds the realistic project in a fresh temporary folder, seeds its live session in a fresh data
folder, lists it, serves the UI on the sandbox's agent with a fresh config folder, starts the
project's two turns at work with `atWorkOnRealistic` as the sandbox does (R13), and takes three
views into `docs/images/screenshots/` with `shooter`: `home` (`/`), `questions`
(`/f/2026-10-21-leader-key/clarifications-01.md`), and `spec` (`/f/2026-10-19-leader-key/spec.md`),
each waiting for its page's text. It removes its folders at the end, failed or not, as
`screenshots.ts` does. The root `package.json` gains
`"readme:screenshots": "node packages/web/scripts/readme-screenshots.ts"`.

- [x] **Step 3: Take them**

- Run: `nix develop -c vp run readme:screenshots`
- Expected: 12 files listed, none failed; `git status` shows only `docs/images/screenshots/`, and
  their size together near 650 KB. Open each: Home shows the realistic project's panes, no Setup
  pane.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add package.json packages/web/scripts packages/web/samples packages/web/sandbox docs/images/screenshots
git commit -m "feat(onboarding-readme): the README's screenshots, taken by one command"
```

## Task 6: The README and the documentation

**Files:**

- Create: `docs/images/banner-light.svg`, `docs/images/banner-dark.svg`, `INSTALL.md`,
  `docs/web-ui.md`, `docs/cli.md`, `docs/specs-folder.md`, `CONTRIBUTING.md`
- Modify: `README.md`, `AGENTS.md`, `packages/uraeda/README.md` (links only, if one breaks)

**Interfaces:**

- Consumes: the screenshots' names (task 5's Produces); the `readme:screenshots` script name.

- [x] **Step 1: Draw the banner**

From [the picked prototype](mockups/banner-a-plain.svg), two files without a media query: the light
one in Catppuccin Latte's colours, the dark one in Mocha's, each with `role="img"` and
`aria-label="Uraeda"`.

- [x] **Step 2: Move the reference**

Every fact of today's README that the new README does not keep goes, unchanged unless wrong, to the
page the spec's [US2 table](spec.md#us2-a-user-finds-the-reference-they-need-p2) names. Keep a list,
in the task's commit body, of today's sections and where each went. `CONTRIBUTING.md` adds
`vp run readme:screenshots`. `docs/web-ui.md` holds `allowed_hosts`, `--allowed-hosts`, and the
Caddy line; `CONTRIBUTING.md` lists `vp install`, the binding's build, `vp run fast`,
`vp run ready`, `vp dev`, and `vp run release`.

- [x] **Step 3: Write the README**

In the spec's [US1 order](spec.md#us1-a-visitor-understands-uraeda-from-its-readme-p1): the banner
in a `<picture>` whose dark `<source>` uses `prefers-color-scheme: dark`, alt "Uraeda"; the
screenshots' table, one row per page, the desktop's beside the phone's, each a `<picture>` the same
way; the tagline, then what Uraeda is, the workflow first, then `ura`, then the web UI. It says the
workflow works with any agent that reads Agent Skills, and that only the web UI's sessions need a
local, signed-in Claude Code, for now. Then what it looks like, as today; getting started, with a
few install commands (the skill, `ura`, Claude Code, linking its install page and naming its paid
plan, and the web UI), a link to `INSTALL.md`, then adding the repository, setting it up with the
agent, and a first proposal; learn more; inspirations, project status, and license, short.

`AGENTS.md` says the reference moved to `INSTALL.md`, `docs/`, and `CONTRIBUTING.md`, and loses its
line saying the README holds no workflow rules.

- [x] **Step 4: Check the words and the links**

- Run: `wc -w README.md`, and a check that every relative link and image of `README.md`,
  `INSTALL.md`, `CONTRIBUTING.md`, and `docs/*.md` names a file that exists, then
  `nix develop -c vp run fast`
- Expected: at most 1,000 words; no missing file; PASS

- [x] **Step 5: Commit**

```bash
git add README.md INSTALL.md CONTRIBUTING.md AGENTS.md docs packages/uraeda/README.md
git commit -m "docs(onboarding-readme): a short README, and the reference in its own pages"
```
