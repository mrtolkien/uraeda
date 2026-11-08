---
status: approved
revision: 2
clarifications: 3
risk-tier: high
plan-review: false
---

# Spec: Extensions system

> [!NOTE]
>
> Approved on 2026-11-08.
>
> - You approve extensions of the server and the web UI, written by you or a session, which Uraeda
>   builds, installs from git, and reloads on save, for every repository or some. Uraeda's own
>   places and Claude Code become built-in extensions you can turn off.
> - Since your review: extensions can be on per repository, sessions know the extension API and can
>   write extensions, usage is part of every runtime, and extensions add no instructions to runs.
> - "Per-repo" is read as your config folder's extensions turned on for some repositories, with
>   settings for each, since round 03 said "nothing in the repo". Say so if you meant code in it.
> - A relaxed guard: any session, one reading a hostile web page included, can now write an
>   extension that runs as you at once. An extension can commit, run agents, and read every
>   repository.
> - Decisions: a new one on extensions; the agents decision now asks for the installed agent only
>   where its terms do; the compatibility decision drops "before 1.0".
> - Unverified: fate built again at each reload, and StyleX compiled at run time matching Astryx's
>   classes. The plan's first tasks check both.
> - Risk tier `high`: a new loader of your code, and every built-in place moves onto it.

Extensions let you, and the people you share Uraeda with, add to or replace any part of Uraeda's
server and web UI from a folder outside its source. Write a TypeScript file, or ask a session to,
and it runs. Agent runtimes, places with their keys, server data, events, and agent skills are all
extensions, Uraeda's own included. See the [proposal](proposal.md), the discoveries
([01](discovery-01.md), [02](discovery-02.md), [03](discovery-03.md)), and the clarifications
([01](clarifications-01.md), [02](clarifications-02.md), [03](clarifications-03.md)).

## Your review

- **C1** (no instructions from extensions): done. Extensions add nothing to agent runs, and the
  extensions decision says so; events stay.
- **C2** (the installed-agent rule): done. It is now a SHOULD, for agents whose terms ask for it, as
  Claude Code's and Codex's do. A bundled pi-durable harness fits it.
- **C3** (extensions per repository): done. Each extension is on for every repository or some, with
  settings for each, and `ura extension add` asks which. See US1 and US5.
- **C4** (sessions able to change Uraeda): done. A session's instructions name the extension API's
  documentation and your extensions folder, which it may write to. See US2.
- **C5** (usage for any provider, no extension tied to another): done. The usage window leaves the
  built-ins: every runtime reports its usage in one shape, which Uraeda draws the same way.
  Extensions use only the contracts Uraeda owns, never each other.

## Decisions

- **New: [Extensions](../decisions/extensions.md)**. Extensions are your own code, loaded only from
  your config folder, for every repository or some, built and reloaded by Uraeda. Uraeda's own
  places are extensions too, and extensions never depend on each other.
- **Changed: [Agents](../decisions/agents.md)**. A runtime should run your installed agent where the
  agent's terms ask for it, as Claude Code's and Codex's do; a bundled harness is allowed otherwise.
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
| [Repositories](../decisions/repositories.md)   | An extension's per-repository settings follow the repository's name      |
| [Sandbox](../decisions/sandbox.md)             | The sandbox never loads your extensions                                  |
| [Run lifecycle](../decisions/run-lifecycle.md) | A runtime reports restarts, limits, and usage for runs to continue       |

## User stories

### US1: Write an extension and see it on save (P1)

You write `page.tsx`, `server.ts`, and `extension.toml` in a folder, and run
`ura extension add ~/code/uraeda-wiki`. `ura` asks whether it is for every repository or this one.
Uraeda compiles the folder, and the Wiki place appears in the navigation and the leader menu. Each
save reloads it.

[Leader menu with your places](/packages/web/src/ExtensionsMockups.stories.tsx#LeaderMenuWithYourPlaces)

Key scenarios:

1. **Given** a folder whose `page.tsx` registers a place "Wiki" with key `w`, **When** you run
   `ura extension add` on it in the `uraeda` repository and answer "this repository", **Then**
   within 1 second, `Space w` opens Wiki in `uraeda`, and nowhere else.
2. **Given** Wiki open, **When** you save a change to its `page.tsx`, **Then** the place redraws
   with the change within 1 second, without reloading the browser page.
3. **Given** a `server.ts` that registers a data record "pages", **When** the page reads it,
   **Then** it gets the record through Uraeda's data channel, live updates included.

More scenarios:

1. **Given** a linked extension, **When** you save a file with a syntax error, **Then** the last
   working version keeps running, and the settings page shows the error with its file and line.
2. **Given** the manifest declares a setting `folder`, default `docs`, **When** you set it to `wiki`
   for `uraeda` on the settings page, **Then** `config.toml` saves it for `uraeda` only, and the
   server code gets the new value in that repository.
3. **Given** a manifest with `scope = "repository"`, **When** you add it, **Then** `ura` suggests
   "this repository" first.

### US2: Ask a session to write or change an extension (P1)

In a session, you ask the agent for a Deploy tab. The agent knows where the extension API's
documentation and your extensions folder are, writes the extension there, and links it. You see the
tab appear as it works.

Key scenarios:

1. **Given** a session in `uraeda`, **When** you ask "add a Deploy tab listing my deployments",
   **Then** the agent reads the extension API's documentation, writes the folder in your extensions
   folder, and runs `ura extension add` on it.
2. **Given** the Wiki extension, **When** you ask a session "show the last edit date on each page",
   **Then** the agent edits the Wiki's files, and the place reloads with the change.
3. **Given** a session asked to change a built-in, like the Inbox, **When** it works, **Then** it
   writes an extension that replaces the built-in, which stays as shipped.

### US3: Run another agent through a runtime extension (P1)

Claude Code becomes Uraeda's built-in runtime extension. A runtime of yours, like pi-durable, works
the same way: you pick it when starting a session. Each runtime reports its usage, which Uraeda
draws in one usage window.

Key scenarios:

1. **Given** a fresh install, **When** you start a session, **Then** it runs Claude Code, and the
   usage window shows its five-hour and weekly windows, as today.
2. **Given** a pi-durable runtime extension installed, **When** you start a session and pick
   "pi-durable", **Then** the session runs it, its row shows its mark, and the usage window shows
   the windows pi-durable reports, or none.
3. **Given** a running session on Claude Code, **When** you save a change to the Claude Code
   extension's settings, **Then** it reloads once the session's turn ends.

More scenarios:

1. **Given** pi-durable turned off, **When** you open one of its sessions, **Then** its transcript
   shows, and the composer says "pi-durable is off: turn it on to continue this session".

### US4: Install a shared extension from git (P2)

Someone shares a repository's address. `ura` clones it into your config folder, pinned to its
commit, asks where it is on, and only moves it when you update.

[Settings, Extensions](/packages/web/src/ExtensionsMockups.stories.tsx#Settings)

Key scenarios:

1. **Given** `ura extension add github.com/gary/uraeda-deploy`, **When** it finishes, **Then** the
   folder is in `<config>/extensions/deploy`, pinned to the default branch's commit, and Deploy is
   on where you answered.
2. **Given** that extension with two new upstream commits, **When** you run
   `ura extension update deploy`, **Then** `ura` shows the diff and the new commit, and moves only
   after you confirm.
3. **Given** `ura extension remove deploy`, **When** it finishes, **Then** its place, keys, and data
   are gone, and its settings stay in `config.toml`.

### US5: Turn off a part of Uraeda (P2)

The settings page lists Uraeda's own parts as built-in extensions, on for every repository or some.
Turning one off removes it from the UI at once; the files it reads stay, and `ura check` still
checks them.

Key scenarios:

1. **Given** the Inbox on, **When** you switch it off for every repository, **Then** the Inbox
   place, its keys, its home pane, its phone tab, and its New-page section disappear at once.
2. **Given** the Inbox off in `uraeda` only, **When** you open another repository, **Then** its
   Inbox shows.
3. **Given** the Inbox off, **When** you run `ura check`, **Then** it still checks `INBOX.md`.

### US6: React to Uraeda's events (P2)

A server extension runs code when something happens in a repository it is on in.

Key scenarios:

1. **Given** an extension that listens to "a step was reached", **When** a spec's status becomes
   `awaiting-human`, **Then** it receives the repository, the feature, the step "spec", and the
   time.
2. **Given** an extension on in `uraeda` only, **When** a step is reached in another repository,
   **Then** it receives nothing.

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

### US9: Ship agent skills with an extension (P3)

An extension's `skills/` folder reaches the agent beside the Uraeda skill, in the repositories it is
on in.

Key scenarios:

1. **Given** an extension with `skills/astryx-docs/SKILL.md`, on in `uraeda`, **When** a Claude Code
   session starts there, **Then** the agent lists the skill `astryx-docs`.

## Replaced behaviour

- **The server always runs Claude Code**, built in at start. Guarded by the tests of
  `packages/server/src/runner/__tests__/claude.test.ts`, which move with the adapter.
- **A run fails when the `uraeda` plugin did not load**, checked in the runner's transcript. The
  check moves into the Claude Code extension. Guarded by `sessions.test.ts`: "a plugin that does not
  load fails the turn…" and "a process whose plugins leave out uraeda…".
- **Usage arrives as Claude's five-hour and weekly fields**, in the runner's events. It becomes a
  list of windows each runtime fills. Guarded by the usage tests of `claude.test.ts`.

## Architecture

Extensions run in the server's process and in the page, trusted like Uraeda's own code, as the
[extensions decision](../decisions/extensions.md) says. Uraeda compiles them itself, and loads each
version as fresh functions in a fresh scope, so a reload frees the old one
([reloading server modules](discovery-02.md#reloading-server-modules)). Uraeda's own places move
onto the same API, which proves it. Extensions talk only through contracts Uraeda owns, never to
each other.

- **The manifest reader**, in the core, reads `extension.toml` files and the extensions' settings.
  It owns the manifest's format, each extension's repositories, and its settings' validation.
- **The compiler**, in the binding, turns TypeScript and TSX into JavaScript with oxc. It owns
  rewriting `react`, Astryx, and the extension API's imports to the app's shared copies.
- **The page compiler**, in the server, runs Babel with StyleX and React Compiler on page code. It
  owns making an extension's classes match the app's.
- **The loader**, in the server, watches the extensions folder and evaluates each extension in its
  own scope. It owns load order, reload, undoing registrations, isolating failures, and the API
  version check.
- **The server API** gives extensions: runtimes, data records, routes under `/x/<name>/`, events,
  skills, and settings, each scoped to the repositories the extension is on in. It owns refusing
  calls from a scope already unloaded.
- **The runtime contract** is what every runtime provides: open, send, stop, resume, capabilities,
  limits, and usage as a list of windows with a label, a share used, and a reset time.
- **The page API** gives extensions: places with their keys, home panes, New-page sections,
  status-line items, renderers of session items, and settings sections. It owns remounting a place
  when its extension reloads.
- **The registries** in the web replace the fixed lists of places, keys, home panes, phone tabs,
  New-page sections, pickers, and settings categories. Each built-in fills them like an extension.
- **The data channel** is one fate record kind, an extension's named record, with live updates. It
  owns keeping pages fed only through fate.
- **The events** turn the watcher's changes into named events, comparing each feature's step before
  and after. It owns "a step was reached", "a turn ended", "a commit landed", "a session started".
- **The usage window** stays Uraeda's own component, drawing the active runtime's windows the same
  way for every provider.
- **The session instructions**, the web UI's text added to every session, name the extension API's
  documentation and your extensions folder. Sessions get write access to that folder.
- **The built-in extensions**: Claude Code, the fake agent for tests and the sandbox, the inbox,
  priorities and proposals, decisions, git, previews, and notifications. Each owns its part's server
  and page code, moved from where it is today.
- **`ura extension`** adds, updates, removes, and lists extensions, and asks where a new one is on.
  It owns cloning and pinning, and never runs an extension's code.

Tradeoffs:

- An extension acts as you, and so does a session that writes one; a bug in one can slow or crash
  the server, as Uraeda's own code can.
- Each extension API change turns your extensions off until an agent updates them.
- Extension pages lose their unsaved state at each reload: production React cannot refresh in place.
- About fifteen web files and the runner's start change shape, to become registries.

## Edge cases

| Importance | Situation                                               | What happens                                                                                        |
| ---------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| High       | A runtime extension reloads while its session works     | The reload waits until the turn ends; the settings page says "reloads when the turn of … ends"      |
| High       | Two extensions claim the same key in the same place     | The first loaded keeps it; the second's command shows "`y` is taken by Deploy" on the settings page |
| High       | An extension's name is a built-in's name                | `ura extension add` refuses: "deploy is taken by a built-in extension"                              |
| High       | Every runtime is off in a repository                    | Starting a session says "No agent runtime is on here: turn one on in Settings, Extensions"          |
| Normal     | A repository an extension is on in leaves Uraeda's list | The extension stays installed, and its settings for that name stay, unused until it returns         |
| Normal     | A linked folder is deleted                              | The extension unloads, and the settings page shows "folder not found"                               |
| Normal     | An extension's settings fail their schema               | The extension runs on its defaults, and the page names the setting and the problem                  |
| Normal     | A built-in place is off and a link points to it         | The link opens a page saying "Inbox is off here" with a button to turn it on                        |
| Niche      | A runtime reports no usage                              | The usage window shows nothing for it                                                               |
| Niche      | An extension registers a route outside `/x/<name>/`     | The call is refused, and the error names the extension                                              |

## Success criteria

- **SC-001** (reload): A saved change reaches the page or the server within 1 second, for an
  extension of 50 files.
- **SC-002** (memory): 100 reloads of one extension grow the server's memory by less than 10 MB.
- **SC-003** (isolation): An extension that throws, loops on load, or fails to compile leaves every
  other extension and Uraeda running.
- **SC-004** (size): The web UI's package and the binding grow by no more than the plan measured,
  and the release notes say how much.
- **SC-005** (proof): Claude Code, the inbox, the git page, and the usage window work as before,
  Claude Code and the inbox as built-in extensions.

## Assumptions

The points settled in the clarifications hold as written there:
[round 01's Check these](clarifications-01.md#check-these) and
[settled points](clarifications-01.md#settled-without-the-human),
[round 02's](clarifications-02.md#check-these) and
[settled points](clarifications-02.md#settled-without-the-human), and
[round 03's](clarifications-03.md#check-these). Your notes and review changed these:

- Hot reload replaces "changes apply when the server restarts".
- Extension pages use StyleX and React Compiler, as your note on styling asked.
- Workflow extensions, and the workflow points of round 03, are dropped: the workflow stays
  Uraeda's.
- Extensions add no instructions to runs, and the usage window is no longer a built-in extension.

Settled while writing this spec:

- Extension code imports only its own files and what Uraeda shares; a library is copied into its
  folder.
- `ura extension add` on a folder links it, and on a URL clones it; only a linked folder reloads on
  save.
- An installed extension's update shows its diff before moving, since reviewed code must not change
  silently.
- Built-ins' order in the navigation stays as today; your places follow them, in name order.
- A session changes a built-in by writing an extension that replaces it: built-ins ship inside the
  package, which an update overwrites.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

`high`: a loader that runs your code in the server and the page, and every built-in place moving
onto it.

## History

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
