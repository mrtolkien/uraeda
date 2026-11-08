---
status: changes-requested
revision: 1
clarifications: 3
risk-tier: high
plan-review: false
---

# Spec: Extensions system

> [!NOTE]
>
> Changes requested on 2026-11-08: 5 comments in spec-review.md.
>
> - You approve extensions of the server and the web UI, written by you or your agent, which Uraeda
>   builds, installs from git, and reloads on save. Uraeda's own places and Claude Code become
>   built-in extensions you can turn off.
> - A relaxed guard: an extension you install can do anything you can in Uraeda, as you: commit, run
>   agents, read every registered repository. Only you install one, never a cloned repository.
> - A new decision on extensions, and two changed ones: the agents decision lets your runtimes use
>   any SDK, and the compatibility decision drops "before 1.0".
> - Workflow extensions moved to "Later" in the priorities, as you asked. Your round 02 choices on
>   hooks and built-ins are kept, read within "server and client only".
> - Unverified: fate built again at each reload, and StyleX compiled at run time matching Astryx's
>   classes. The plan's first tasks check both.
> - The web UI's package grows by Babel and its StyleX and React Compiler plugins, about 5 MB, and
>   the binding by oxc. The plan measures both.
> - Risk tier `high`: a new loader of your code, and every built-in place moves.

Extensions let you, and the people you share Uraeda with, add to or replace any part of Uraeda's
server and web UI from a folder outside its source. Write a TypeScript file, link it, and it runs.
Agent runtimes, places with their keys, server data, events, and agent skills are all extensions,
Uraeda's own included. See the [proposal](proposal.md), the discoveries ([01](discovery-01.md),
[02](discovery-02.md), [03](discovery-03.md)), and the clarifications ([01](clarifications-01.md),
[02](clarifications-02.md), [03](clarifications-03.md)).

## Decisions

- **New: [Extensions](../decisions/extensions.md)**. Extensions are your own code, loaded only from
  your config folder, built and reloaded by Uraeda, and Uraeda's own places are extensions too.
- **Changed: [Agents](../decisions/agents.md)**. Only Uraeda's shipped runtimes must run your
  installed agent; a runtime of yours may use any SDK.
- **Changed: [Compatibility](../decisions/compatibility.md)**. The rule holds past 1.0, each format
  change is named in the changelog, and an extension built for another API version is turned off.

Relied on:

| Decision                                       | What it means for this spec                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| [Settings](../decisions/settings.md)           | Extension settings are tables of the one settings file, read by the core |
| [Stack](../decisions/stack.md)                 | Extension pages get their data through fate, never their own fetches     |
| [Distribution](../decisions/distribution.md)   | The server never downloads an extension; `ura` installs them             |
| [Sign-in](../decisions/sign-in.md)             | Every route an extension adds needs a signed-in session                  |
| [Keyboard](../decisions/keyboard.md)           | An extension's keys go through the key registry                          |
| [Colour themes](../decisions/colour-themes.md) | Extension pages ask for colours by role                                  |
| [Sandbox](../decisions/sandbox.md)             | The sandbox never loads your extensions                                  |
| [Run lifecycle](../decisions/run-lifecycle.md) | A runtime reports restarts and limits for runs to continue               |

## User stories

### US1: Write an extension and see it on save (P1)

You write `page.tsx`, `server.ts`, and `extension.toml` in a folder, and run
`ura extension add ~/code/uraeda-wiki`. Uraeda compiles the folder, and the Wiki place appears in
the navigation and the leader menu. Each save reloads it.

[Leader menu with your places](/packages/web/src/ExtensionsMockups.stories.tsx#LeaderMenuWithYourPlaces)

Key scenarios:

1. **Given** a folder whose manifest names a `page.tsx` that registers a place "Wiki" with key `w`,
   **When** you run `ura extension add` on it, **Then** within 1 second, `Space w` opens Wiki.
2. **Given** Wiki open, **When** you save a change to its `page.tsx`, **Then** the place redraws
   with the change within 1 second, without reloading the browser page.
3. **Given** a `server.ts` that registers a data record "pages", **When** the page reads it,
   **Then** it gets the record through Uraeda's data channel, live updates included.

More scenarios:

1. **Given** a linked extension, **When** you save a file with a syntax error, **Then** the last
   working version keeps running, and the settings page shows the error with its file and line.
2. **Given** the manifest declares a setting `folder`, default `docs`, **When** you set it to `wiki`
   on the settings page, **Then** `[extensions.wiki] folder = "wiki"` is saved in `config.toml`, and
   the server code gets the new value.

### US2: Run another agent through a runtime extension (P1)

Claude Code becomes Uraeda's built-in runtime extension. A runtime of yours, like pi-durable, works
the same way: you pick it when starting a session.

Key scenarios:

1. **Given** a fresh install, **When** you start a session, **Then** it runs Claude Code, as today.
2. **Given** a pi-durable runtime extension installed, **When** you start a session and pick
   "pi-durable", **Then** the session runs it, and its row shows its mark.
3. **Given** a running session on Claude Code, **When** you save a change to the Claude Code
   extension's settings, **Then** it reloads once the session's turn ends.

More scenarios:

1. **Given** pi-durable turned off, **When** you open one of its sessions, **Then** its transcript
   shows, and the composer says "pi-durable is off: turn it on to continue this session".

### US3: Install a shared extension from git (P2)

Someone shares a repository's address. `ura` clones it into your config folder, pinned to its
commit, and only moves it when you update.

[Settings, Extensions](/packages/web/src/ExtensionsMockups.stories.tsx#Settings)

Key scenarios:

1. **Given** `ura extension add github.com/gary/uraeda-deploy`, **When** it finishes, **Then** the
   folder is in `<config>/extensions/deploy`, pinned to the default branch's commit, and Deploy is
   on.
2. **Given** that extension with two new upstream commits, **When** you run
   `ura extension update deploy`, **Then** `ura` shows the diff and the new commit, and moves only
   after you confirm.
3. **Given** `ura extension remove deploy`, **When** it finishes, **Then** its place, keys, and data
   are gone, and its settings table stays in `config.toml`.

### US4: Turn off a part of Uraeda (P2)

The settings page lists Uraeda's own parts as built-in extensions. Turning one off removes it from
the UI at once; the files it reads stay, and `ura check` still checks them.

Key scenarios:

1. **Given** the Inbox on, **When** you switch it off on the settings page, **Then** the Inbox
   place, its keys, its home pane, its phone tab, and its New-page section disappear at once.
2. **Given** the Inbox off, **When** you run `ura check`, **Then** it still checks `INBOX.md`.

### US5: React to Uraeda's events (P2)

A server extension runs code when something happens, and can add an instruction to a step's runs.

Key scenarios:

1. **Given** an extension that listens to "a step was reached", **When** a spec's status becomes
   `awaiting-human`, **Then** it receives the feature, the step "spec", and the time.
2. **Given** an extension that adds "Update `docs/` for what changed" to final-review runs, **When**
   a run starts for a feature at the final review, **Then** its message ends with that instruction,
   named by the extension.

More scenarios:

1. **Given** two extensions adding instructions to the same step, **When** a run starts, **Then**
   both are added, in the order of their names.

### US6: Ship agent skills with an extension (P3)

An extension's `skills/` folder reaches the agent beside the Uraeda skill.

Key scenarios:

1. **Given** an extension with `skills/astryx-docs/SKILL.md`, **When** a Claude Code session starts,
   **Then** the agent lists the skill `astryx-docs`.

### US7: A broken extension stays alone (P2)

A failing extension is turned off alone, and says why.

[Settings, extensions that need you](/packages/web/src/ExtensionsMockups.stories.tsx#NeedsYou)

Key scenarios:

1. **Given** an extension whose server code throws while loading, **When** the server starts,
   **Then** every other extension and Uraeda run, and the settings page shows the error.
2. **Given** an extension built for API 1 and Uraeda on API 2, **When** the server starts, **Then**
   it is off, saying "built for extension API 1, and Uraeda runs API 2".

### US8: An extension's page looks like Uraeda (P2)

Pages are drawn with Astryx, the theme, and StyleX, like Uraeda's own.

[Deploy page](/packages/web/src/ExtensionsMockups.stories.tsx#DeployPage)

Key scenarios:

1. **Given** the Deploy extension, **When** you open it in each theme, at a phone's and a desktop's
   width, **Then** it uses the theme's colours and the app's layout widths.

## Replaced behaviour

- **The server always runs Claude Code**, built in at start. Guarded by the tests of
  `packages/server/src/runner/__tests__/claude.test.ts`, which move with the adapter.
- **A run fails when the `uraeda` plugin did not load**, checked in the runner's transcript. The
  check moves into the Claude Code extension. Guarded by `sessions.test.ts`: "a plugin that does not
  load fails the turn…" and "a process whose plugins leave out uraeda…".

## Architecture

Extensions run in the server's process and in the page, trusted like Uraeda's own code, as the
[extensions decision](../decisions/extensions.md) says. Uraeda compiles them itself, and loads each
version as fresh functions in a fresh scope, so a reload frees the old one
([reloading server modules](discovery-02.md#reloading-server-modules)). Uraeda's own places move
onto the same API, which proves it.

- **The manifest reader**, in the core, reads `extension.toml` files and their settings tables. It
  owns the manifest's format and the extension settings' validation, as the settings decision asks.
- **The compiler**, in the binding, turns TypeScript and TSX into JavaScript with oxc. It owns
  rewriting `react`, Astryx, and the extension API's imports to the app's shared copies.
- **The page compiler**, in the server, runs Babel with StyleX and React Compiler on page code. It
  owns making an extension's classes match the app's.
- **The loader**, in the server, watches the extensions folder and evaluates each extension in its
  own scope. It owns load order, reload, undoing registrations, isolating failures, and the API
  version check.
- **The server API** gives extensions: runtimes, data records, routes under `/x/<name>/`, events,
  run instructions, skills, and settings. It owns refusing calls from a scope already unloaded.
- **The page API** gives extensions: places with their keys, home panes, New-page sections,
  status-line items, renderers of session items, and settings sections. It owns remounting a place
  when its extension reloads.
- **The registries** in the web replace the fixed lists of places, keys, home panes, phone tabs,
  New-page sections, pickers, and settings categories. Each built-in fills them like an extension.
- **The data channel** is one fate record kind, an extension's named record, with live updates. It
  owns keeping pages fed only through fate.
- **The events** turn the watcher's changes into named events, comparing each feature's step before
  and after. It owns "a step was reached", "a turn ended", "a commit landed", "a session started".
- **The built-in extensions**: Claude Code, the fake agent for tests and the sandbox, the inbox,
  priorities and proposals, decisions, git, previews, notifications, and the usage window. Each owns
  its part's server and page code, moved from where it is today.
- **`ura extension`** adds, updates, removes, and lists extensions. It owns cloning and pinning, and
  never runs an extension's code.

Tradeoffs:

- An extension acts as you; a bug in one can slow or crash the server, as Uraeda's own code can.
- Each extension API change turns your extensions off until an agent updates them.
- Extension pages lose their unsaved state at each reload: production React cannot refresh in place.
- About fifteen web files and the runner's start change shape, to become registries.

## Edge cases

| Importance | Situation                                           | What happens                                                                                        |
| ---------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| High       | A runtime extension reloads while its session works | The reload waits until the turn ends; the settings page says "reloads when the turn of … ends"      |
| High       | Two extensions claim the same key in the same place | The first loaded keeps it; the second's command shows "`y` is taken by Deploy" on the settings page |
| High       | An extension's name is a built-in's name            | `ura extension add` refuses: "deploy is taken by a built-in extension"                              |
| High       | Every runtime is off                                | Starting a session says "No agent runtime is on: turn one on in Settings, Extensions"               |
| Normal     | A linked folder is deleted                          | The extension unloads, and the settings page shows "folder not found"                               |
| Normal     | An extension's settings table fails its schema      | The extension runs on its defaults, and the page names the setting and the problem                  |
| Normal     | A built-in place is off and a link points to it     | The link opens a page saying "Inbox is off" with a button to turn it on                             |
| Niche      | An extension registers a route outside `/x/<name>/` | The call is refused, and the error names the extension                                              |

## Success criteria

- **SC-001** (reload): A saved change reaches the page or the server within 1 second, for an
  extension of 50 files.
- **SC-002** (memory): 100 reloads of one extension grow the server's memory by less than 10 MB.
- **SC-003** (isolation): An extension that throws, loops on load, or fails to compile leaves every
  other extension and Uraeda running.
- **SC-004** (size): The web UI's package and the binding grow by no more than the plan measured,
  and the release notes say how much.
- **SC-005** (proof): Claude Code, the inbox, and the git page work as before, as built-in
  extensions.

## Assumptions

The points settled in the clarifications hold as written there:
[round 01's Check these](clarifications-01.md#check-these) and
[settled points](clarifications-01.md#settled-without-the-human),
[round 02's](clarifications-02.md#check-these) and
[settled points](clarifications-02.md#settled-without-the-human), and
[round 03's](clarifications-03.md#check-these). Your notes changed these:

- Hot reload replaces "changes apply when the server restarts".
- Extension pages use StyleX and React Compiler, as your note on styling asked.
- Workflow extensions, and the workflow points of round 03, are dropped: the workflow stays
  Uraeda's.

Settled while writing this spec:

- Round 03's notes say extensions touch the server, for data and agents, and the client, for UI.
  This spec reads that as a frame for round 02's choices, keeping built-ins as extensions and both
  kinds of hooks.
- Extension code imports only its own files and what Uraeda shares; a library is copied into its
  folder.
- `ura extension add` on a folder links it, and on a URL clones it; only a linked folder reloads on
  save.
- An installed extension's update shows its diff before moving, since reviewed code must not change
  silently.
- Built-ins' order in the navigation stays as today; your places follow them, in name order.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ⚠️                |

- Tools optional: an instruction an extension adds to runs reaches only runs the web UI starts. An
  agent following the skill unaided never sees it. The workflow itself stays whole without it.

## Risk tier

`high`: a loader that runs your code in the server and the page, and every built-in place moving
onto it.
