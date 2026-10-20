# Rulings: Stable dev environment for UI review

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The sandbox's page loads the skill's pick script

- **Decision**: the sandbox loads `uraeda-pick.js` at the top of its page, and talks to it with
  messages to the page itself, whose parent it is.
- **Rationale**: the script already owns which element a click means, and its role and name; a
  second copy would drift ([one home per rule](/skills/uraeda/references/code-quality.md)).
- **Alternatives considered**: a picker written for the sandbox: a second copy of the same rules.
- **If wrong**: the bar's module swaps the script for its own, in task 6 alone.
- **Where**: tasks 4 and 6.

## R2: Sessions are seeded through the session manager

- **Decision**: the sample sessions are made by sending scripted turns through `createSessions` on
  the sandbox's `runner.sqlite`, not by writing rows.
- **Rationale**: the stored shape stays the runner's alone, as the agents decision asks.
- **Alternatives considered**: rows written with the cache's API, as `recordRun` does: a copy of the
  item formats.
- **If wrong**: a slower seed, by the time the turns take on an injected zero wait.
- **Where**: task 7.

## R3: The sandbox restarts with `vp run dev`'s script

- **Decision**: `packages/server/scripts/dev.ts` takes an optional Vite config, which the sandbox
  gives.
- **Rationale**: one restart logic for the native binding and the server's code.
- **Alternatives considered**: Vite's own restart: it cannot unload the native binding.
- **If wrong**: the sandbox gets its own script, in task 8.
- **Where**: task 8.

## R4: The sample builders live in `packages/web/samples/`

- **Decision**: one folder of the web package, beside `.storybook/` and `scripts/`, all three of
  whose users are in the web package.
- **Rationale**: `uraeda-binding/test-utils` stays the tests' generic helpers; the samples are the
  web UI's content.
- **Alternatives considered**: `test-utils.ts`, which fix testing is reshaping as templates.
- **If wrong**: a move of one folder.
- **Where**: task 2.

## R5: Built on fix testing's local branch, before it merges

- **Decision**: fix testing's local branch is merged into this one, and the tasks are built on it,
  instead of waiting for it to merge into `main`.
- **Rationale**: the human asked for it: "Don't wait for the merge, start working from the branch
  that's here locally DIRECTLY". The two features are mostly orthogonal.
- **Alternatives considered**: waiting for the merge, as the spec's block said.
- **If wrong**: fix testing's later commits conflict with this branch's; its branch is merged in
  again before the final review, and the conflicts resolved there.
- **Where**: before task 1.

## R6: Source locations from code-inspector's core transform, in a plugin of our own

- **Decision**: `sourceLocations()` is a small Vite plugin of ours that calls `transformCode` from
  `@code-inspector/core`, pinned at 2.0.9, instead of code-inspector's Vite plugin,
  `code-inspector-plugin`.
- **Rationale**: the Vite plugin always injects its client, about 595 KB holding its overlay and its
  chat, into the first module it transforms: `skipSnippets`, `hotKeys: false`, and `server: "close"`
  only blank its settings. The spec's "without its own overlay or server" holds only without the
  wrapper. The wrapper also writes a record file into its own `dist/` in `node_modules`
  (`resetFileRecord`); the core's transform does not. The core's relative paths come from
  `git rev-parse --show-toplevel` run in the process's working folder as it is imported, so the
  plugin asks for absolute paths and makes them relative to the root of the checkout holding Vite's
  root, found as the config resolves. The core's optional `node-pty`, for its terminal, is never
  used: its build script is refused with `node-pty: false` in `pnpm-workspace.yaml`'s `allowBuilds`.
- **Alternatives considered**: the Vite plugin with its client in the sandbox's page, against the
  spec; stripping the client from its output, which depends on its internals; no source locations,
  which drops the pick's "Source" line.
- **If wrong**: a newer code-inspector plugin that can leave its client out replaces the module's
  body, in `packages/web/sandbox/sourceLocations.ts` alone.
- **Where**: task 1.

## R7: The source locations' plugin goes before the UI's transforms

- **Decision**: the sandbox's config lists `sourceLocations()` first, before `uiTransforms()`.
- **Rationale**: both run as `pre` plugins, in their listed order; after StyleX, which adds lines to
  a file, every location is off (`SandboxBar.tsx:180:10` in a file of 90 lines). First, it marks the
  file as written, and the compiler and StyleX still compile it.
- **Alternatives considered**: after the transforms, as the plan first wrote: wrong lines.
- **If wrong**: the source-locations test's exact line and column fail.
- **Where**: tasks 1 and 8.

## R8: The browser tests run the pick script with the test's window as its parent

- **Decision**: `pickScriptOnPage()` runs `uraeda-pick.js` with `globalThis` a proxy of the test's
  window, whose `parent` is that window, methods bound to it.
- **Rationale**: Vitest runs each test in a frame of its own page, so the test's `window.parent` is
  Vitest's: the script posted its picks there and ignored the test's messages. The proxy makes the
  test's window what the sandbox's page is, the top, without changing the script.
- **Alternatives considered**: a parameter of the script for its parent: a test-only change to a
  file every Storybook loads.
- **If wrong**: a test of the sandbox's own page, at the top, replaces the helper, in task 6.
- **Where**: tasks 1, 4, and 6.

## R9: The sample features' folder names move with their builders

- **Decision**: `FEATURE_PAGES`, `ROUND_MOCKUPS`, and `SPEC_PAGES` move from
  `.storybook/checkouts.ts` to `samples/features.ts`, exported by `samples/index.ts`; `checkouts.ts`
  keeps the story embeds' `CHECKOUTS` and re-exports the others for the stories. The round page's
  and spec page's screenshot scripts read the folders from there too.
- **Rationale**: the builders name the folders they build: left in `.storybook/`, the samples, which
  the sandbox also builds, would depend on Storybook's files.
- **Alternatives considered**: the builders importing the names from `.storybook/checkouts.ts`: the
  dependency backwards. Every story importing from `samples/`: eight files changed for no behaviour.
- **If wrong**: the stories import the names from `samples/index.ts`, and the re-export goes.
- **Where**: task 2.

## R10: The fake adapter's tests read its events, not the session manager's items

- **Decision**: task 3's tests open a `FakeAdapter` process and read its events, as `fake.test.ts`'s
  existing tests do, instead of sending through the session manager.
- **Rationale**: the abilities are the adapter's own; the plan's sketch named session helpers
  (`settle`, `agentTexts`) that do not exist, and the session manager adds nothing to what is
  checked. Task 7 checks them through the session manager.
- **Alternatives considered**: new session helpers in `fake.test.ts`: code for one test.
- **If wrong**: the tests move to `sessions.test.ts`, on `testSessions()`.
- **Where**: task 3.

## R11: The pick script's new cases are in the sandbox's pick tests

- **Decision**: task 4's cases are in `sandbox-pick.test.tsx`, on `pickScriptOnPage()`, not in
  `story-embed.test.tsx`.
- **Rationale**: they test the script at the top of a page, as the sandbox loads it, which that
  helper gives; a story embed's tests go through the fake Storybook and the server, which these
  cases do not need. The embed's tests still check that a story's pick posts `role`, `name`, and
  `text`.
- **Alternatives considered**: the plan's `story-embed.test.tsx`: a frame and a server for a script
  test.
- **If wrong**: the cases move into the story embed's file, unchanged but for their setup.
- **Where**: tasks 4 and 6.

## R12: The sample's steps are built from the core's rules, and keyed by label

- **Decision**: `FEATURE_STEPS` and `SAMPLE_FOLDERS.features` are keyed by the step's name, a human
  gate by the file it waits on (`round-waiting`, `spec-waiting`, `plan-waiting`) and `none` by
  `blocked`; `SAMPLE_FOLDERS.changes` by the step's name. `pull-request-changes` and `finish` are
  features past their last task with `gh` listing a changes-requested and a draft pull request, not
  finished ones with a record, since `steps.rs` reads both the same. The sample's `gh` is
  `samplePullRequests()`, listing four pull requests through a new `fakeGh(rows)`, which
  `listPullRequest()` now calls. `fixtureRepo` and a new `initRepository` take the folder to build
  in, so each project is in a folder named after it. `spec-waiting` is the stories feature, whose
  spec embeds stories; `round-waiting` is the fixture's `2026-10-11-web-ui`.
- **Rationale**: a step's sample must be what its step reads, and a test that compares sets must not
  hide a missing step behind another feature of the same step name (the stories feature is a spec
  gate, not a round gate).
- **Alternatives considered**: finished features with records for the pull request steps: more files
  for the same step.
- **If wrong**: a sample is rebuilt in `steps.ts`, with its folder in `FEATURE_FOLDERS`.
- **Where**: tasks 5 and 7.

## R13: The sandbox's agent queues messages, and the usage limit is a failed turn

- **Decision**: `SandboxAgent`, a `FakeAdapter` of `packages/web/sandbox/agent.ts`, declares no
  steering, so a message sent during a turn queues behind it. The session stopped by the usage limit
  is a chat whose turn the agent ends with a full five-hour `usage` event and a failed result naming
  the usage limit, as Claude Code ends one. The sample sessions other than the turn at work are
  chats of the sample project. `fakeSessions` takes the adapter and the cache's file, so the seed
  writes `runner.sqlite` through `createSessions`; it also exports the `Sessions` type.
- **Rationale**: a steered message would join the turn at work and end it with the canned reply's
  result (review focus 5). The runner has no "limited" turn state: a turn ended by the usage limit
  fails, with its reason. Chats need no worktree and no step to seed.
- **Alternatives considered**: a fake that steers without ending the turn: the fake would hold two
  replies in one turn, which no agent does. Rows written for a "limited" state: against R2.
- **If wrong**: the failed and stopped sessions move to features waiting on the agent, in
  `sessions.ts` alone.
- **Where**: task 7.

## R14: Pick mode also toggles by Alt+Shift+P, and the bar follows modal dialogs

- **Decision**: `Alt+Shift+P`, matched by its physical key (`event.code` `KeyP`, so Option+Shift+P
  on a Mac and every layout), toggles pick mode from anywhere on the page. The bar's window takes it
  in the capture phase, before the page's listeners, and the toggle names it in `aria-keyshortcuts`
  and its tooltip; the hint line stays the spec's. The bar's host is a manual popover that moves
  into the topmost open modal dialog (`dialog:modal`, the last in the document) while one is open,
  and back to the body when it closes, shown again after each move.
- **Rationale**: a modal dialog makes the rest of the page inert and covers it, and a click outside
  a popover menu closes it, so the corner button alone cannot start a pick inside either: the spec's
  clarifications settled on "a corner button or a keyboard shortcut", and the edge case "a picked
  element inside an open dialog or popover" needs one. Alt+Shift with a letter collides with none of
  the app's shortcuts (`[`, `]`, `n`, `p`, without modifiers) and types nothing outside a Mac's
  Option characters, which it takes. Inside the dialog, the bar stays focusable, and its fallback
  text selectable; as a popover in the top layer, the dialog's own box neither clips nor covers it.
- **Alternatives considered**: a shortcut without a modifier: it would type into text fields. The
  bar left in the body above the dialog by `z-index`: still inert under a modal dialog. A popover on
  the body: a modal dialog makes it inert too.
- **If wrong**: the shortcut is `PICK_SHORTCUT` and `isPickShortcut` in `mountSandboxBar.tsx` alone;
  the dialog's following is `followModals` there.
- **Where**: task 6.
