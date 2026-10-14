---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: true
---

# Spec: Multi-repo server

> [!IMPORTANT]
>
> Spec to review, about 30 minutes.
>
> - One new decision, [repositories](../decisions/repositories.md): the list lives in
>   `repositories.json` in Uraeda's data folder, owned by the Rust core, and every repository's
>   pages and routes start with `/r/<name>/`.
> - Your `ura add` idea is in, since the data folder is predictable: the core owns the list, so the
>   CLI and the server read and write the same file, and a running server sees the change live.
> - Every URL of the UI changes: old ones redirect to the most recently opened repository.
> - Packaging is out, as you asked: [Run the web UI with npx](../drafts/run-the-web-ui-with-npx.md)
>   is drafted, in Now after this feature. Your Q3 answer read as "git repositories only here", with
>   `git init` and cloning from the UI added to Later.
> - The UI talks to one fate endpoint per repository, `/r/<name>/fate`, with its own live updates: a
>   small change to the server, rather than adding the repository to every ID.
> - Risk tier `high`: anyone who reaches the server can now add any repository of the machine, and
>   every URL and the server's wiring change. The plan waits for your review.

One Uraeda server serves every repository the human adds: the web UI's top left switches between
them, a short form adds any git repository of the machine, completing its path as it is typed, and
`ura add` adds the current folder from a terminal. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Switch repository from the top left (P1)

The navigation's heading, "Uraeda" over the current repository's name, opens a menu listing the
repositories, most recently opened first, the current one checked, with a filter and "Add a
repository…". Picking one opens its home page. The menu is a popover on wide screens and a bottom
sheet on narrow ones.

Why this priority: it is the proposal's first request, and every other story feeds it.

Acceptance scenarios:

1. **Given** the list holds uraeda, opened at 10:00, and todo-app, opened at 09:00, **When** the
   human opens the heading's menu on uraeda's home, **Then** it lists uraeda, checked, then
   todo-app, each with its path, `~/dev/uraeda` and `~/dev/todo-app`, then "Add a repository…".
2. **Given** that menu open, **When** the human picks todo-app, **Then** the page is `/r/todo-app/`,
   the heading shows todo-app, and the navigation lists todo-app's features and chats.
3. **Given** five repositories in the list, **When** the human types "todo" in the menu's filter,
   **Then** only the repositories whose name or path contains "todo", ignoring case, stay.
4. **Given** the human picked todo-app at 11:00, **When** they open the menu again, **Then**
   todo-app is first.

### US2: Add a repository from the UI (P1)

"Add a repository…" opens a short form with one field, Folder. Typing a path starting with `/` or
`~` lists the folders the server finds there, those in git marked "git". Adding a folder in a git
repository adds that repository's main checkout and opens it.

Why this priority: the proposal asks to add any folder of the machine, and a new install has no
other way in without a terminal.

Acceptance scenarios:

1. **Given** `~/dev` holds the folders `todo-app` (a git repository), `tools`, and `.cache`,
   **When** the human types `~/dev/to`, **Then** the suggestions are `~/dev/todo-app/`, marked
   "git", and `~/dev/tools/`, and not `.cache`.
2. **Given** that field, **When** the human picks `~/dev/todo-app/` and presses Add, **Then**
   todo-app is in the list, the form closes, and the page is `/r/todo-app/`.
3. **Given** `~/dev/tools` is outside git, **When** the human adds it, **Then** the form stays open
   with "Not a git repository: /home/me/dev/tools. Run git init there first.", and the list is
   unchanged.
4. **Given** `/home/me/dev/todo-app/src`, a folder inside todo-app, **When** the human adds it,
   **Then** the list gets `/home/me/dev/todo-app`, named todo-app.
5. **Given** todo-app is in the list, **When** the human adds `~/dev/todo-app` again, **Then** the
   list is unchanged, and the page is `/r/todo-app/`.
6. **Given** todo-app at `/home/me/dev/todo-app` in the list, **When** the human adds another
   repository at `/home/me/work/todo-app`, **Then** it is named work-todo-app.

### US3: Start the server anywhere (P1)

Starting the server in a git repository adds it and opens it first. Started elsewhere, the server
opens the most recently opened repository, and with an empty list, every page shows "Add your first
repository", with the add form in the page.

Why this priority: today's habit, starting the server in a repository, keeps working, and the first
run the proposal mentions needs a way in.

Acceptance scenarios:

1. **Given** an empty list, **When** the server starts in `/home/me/dev/uraeda`, a git repository,
   and the human opens `http://127.0.0.1:4310/`, **Then** the list holds uraeda, and the page is
   `/r/uraeda/`.
2. **Given** a list holding todo-app, **When** the server starts in `/home/me`, outside git, and the
   human opens `/`, **Then** the page is `/r/todo-app/`, and the server printed
   `uraeda-server: /home/me is not in a git repository: add one from the web UI`.
3. **Given** an empty list and a server started outside git, **When** the human opens `/`, **Then**
   the page shows "Add your first repository", the Folder field set to `~/`, and no navigation.
4. **Given** `--repo /home/me/tools`, outside git, **When** the server starts, **Then** it exits 1
   with `uraeda-server: /home/me/tools is not a git repository`, as today.

### US4: Add a repository from a terminal (P2)

`ura add` adds the git repository holding the current folder, or the folder it is given, to the same
list the server reads. A running server's selector shows it without a reload.

Why this priority: the human asked for it, to add a project from where they already work
([Q4](clarifications-01.md#q4-how-do-you-name-a-folder-from-the-browser)).

Acceptance scenarios:

1. **Given** an empty list, **When** the human runs `ura add` in `/home/me/dev/todo-app/src`,
   **Then** it exits 0, prints `added todo-app: /home/me/dev/todo-app` to stderr, and the list holds
   todo-app.
2. **Given** todo-app in the list, **When** the human runs `ura add ~/dev/todo-app`, **Then** it
   exits 0 and prints `todo-app is already added: /home/me/dev/todo-app`.
3. **Given** a running server, its menu open, **When** the human runs `ura add` in todo-app,
   **Then** the menu lists todo-app within a second, without a reload.
4. **Given** `/home/me/tools`, outside git, **When** the human runs `ura add` in it, **Then** it
   exits 1 with `ura: /home/me/tools: not in a git repository: run git init first`.

### US5: Remove a repository, and a missing folder (P2)

Each row of the menu has a ⋯ menu with "Remove from Uraeda", which takes the repository off the list
and nothing else. A repository whose folder is gone stays in the list, marked "Folder not found",
and opening it says so, with Remove.

Why this priority: a list that only grows, or breaks when a folder moves, gets in the way, but the
human can edit the file by hand until then.

Acceptance scenarios:

1. **Given** todo-app in the list, **When** the human removes it from the menu, **Then** it leaves
   the list, and its folder and its sessions in the cache are unchanged.
2. **Given** the human is on `/r/todo-app/f/2026-10-14-dark-mode`, **When** they remove todo-app,
   **Then** the page is the home of the next most recently opened repository, or "Add your first
   repository" when none is left.
3. **Given** an agent is working in todo-app, **When** the human chooses "Remove from Uraeda",
   **Then** the menu shows "An agent is working in todo-app: stop it first.", and todo-app stays.
4. **Given** client-site's folder, `/home/me/work/client-site`, was deleted, **When** the human
   opens the menu, **Then** client-site's row says "Folder not found: ~/work/client-site".
5. **Given** that missing folder, **When** the human opens `/r/client-site/`, **Then** the page
   shows "Folder not found", its path, and "Remove from Uraeda".

### US6: Every page stays in its repository (P2)

Every page, link, file, and live update belongs to one repository, named in its URL. Two
repositories open in two tabs never mix, and links written before this feature still work.

Why this priority: without it, switching would show one repository's features under another's name;
it is part of US1's delivery, ranked apart because it holds the edge cases.

Acceptance scenarios:

1. **Given** uraeda and todo-app both have a feature folder `2026-10-14-dark-mode`, **When** the
   human opens it in each, in two tabs, **Then** each tab shows its own repository's files.
2. **Given** uraeda's home open in one tab, **When** a file of todo-app's specs changes, **Then**
   uraeda's tab receives no live update.
3. **Given** uraeda is the most recently opened, **When** the human opens `/f/2026-10-14-dark-mode`,
   **Then** the page is `/r/uraeda/f/2026-10-14-dark-mode`.
4. **Given** a link to `/r/old-site/` and no repository named old-site, **When** the human opens it,
   **Then** the page shows "No repository named “old-site”" and a link to the most recently opened
   repository.
5. **Given** uraeda's spec links to `/packages/server/src/app.ts`, **When** the human follows it,
   **Then** the file opens at `/r/uraeda/raw/packages/server/src/app.ts`.

## Edge cases

- A path typed without `/` or `~` gets no suggestions; adding it says "Type an absolute path,
  starting with / or ~."
- A folder that does not exist: "No such folder: /home/me/dev/nope."
- A folder the server cannot read gets no suggestions, and adding it reports the core's error.
- More than 20 matching folders: the first 20, sorted by name.
- Typing a name starting with `.`, like `~/.con`, suggests hidden folders too.
- A worktree, like `~/dev/uraeda/.worktrees/2026-10-14-x`, adds its main checkout, uraeda.
- A folder name with characters outside letters, digits, `.`, `_`, and `-`, like `my app`, is named
  `my-app`. A third repository with a name and parent already taken gets `-2`, then `-3`.
- `repositories.json` edited by hand into invalid JSON: the server keeps the last list it read, the
  menu shows "repositories.json could not be read: <problem>", adding is refused with the same
  message, and the file is never overwritten. `ura add` exits 1 with that message.
- `repositories.json` with an unknown `"version"`: refused the same way.
- `URAEDA_DATA_DIR` set only in a repository's `.env`: the server reads it, `ura add` does not, and
  each uses its own list. `.env.example` says so.
- A second server on port 4310 exits 1 with
  `uraeda-server: port 4310 is in use: another Uraeda server may run at http://127.0.0.1:4310/`.
- Removing the last repository shows "Add your first repository" on every page.
- A repository renamed by hand in the file: links with the old name show "No repository named …".
- Old file links, `/raw/<path>` and `/mockups/<path>`, redirect to the most recently opened
  repository's, with status 307.
- The CLI and the server writing at the same moment: the last write wins, and the file is never half
  written.

## Success criteria

- **SC-001**: Switching repository takes two clicks from any page: the heading, then the repository.
- **SC-002**: A change in one repository's files sends no live update to the views of another.
- **SC-003**: Every link a repository's pages build starts with `/r/<name>/`.
- **SC-004**: A repository added with `ura add` shows in an open menu within 1 second.

## Design

### Approach

The server holds one host per listed repository: its fate endpoint, its live updates, and its watch.
The core owns the list, `repositories.json`, so `ura add` and the server share it, as the new
[repositories](../decisions/repositories.md) decision says. The UI talks to one fate client per
repository, at `/r/<name>/fate`: fate's IDs stay as they are, and the cache of one repository never
holds another's records, which is why this was preferred to adding the repository to every ID
([the repository in the URL](discovery-01.md#the-repository-in-the-url)). Everything about agents
stays as it is: sessions are already keyed by the main checkout ([agents](../decisions/agents.md)).

### Data

`repositories.json`, in Uraeda's data folder, beside `runner.sqlite`:

```json
{
  "version": 1,
  "repositories": [
    { "name": "uraeda", "path": "/home/me/dev/uraeda", "openedAt": "2026-10-14T10:00:00Z" },
    { "name": "todo-app", "path": "/home/me/dev/todo-app", "openedAt": "2026-10-14T09:00:00Z" }
  ]
}
```

- `name`: unique, set when added: the folder's name, with characters outside `[A-Za-z0-9._-]`
  replaced by `-`; when taken, `<parent>-<folder>`; then `-2`, `-3`, and so on. It is never changed
  by a tool.
- `path`: the absolute path of the main checkout, as the core's `main_root` returns it.
- `openedAt`: an RFC 3339 instant in UTC, set when added, when the UI opens the repository, and when
  the server starts in it. The list is sorted by it, most recent first, then by name.
- A missing file is an empty list. Writes go to `repositories.json.tmp`, renamed over the file.

The core's view of an entry is `Repository { name, path, opened_at, missing }`, `missing` being true
when `path` no longer holds a git repository. The binding exposes it to TypeScript with napi-rs's
generated types.

Two fate records are new, readable from every fate endpoint:

- `Repositories`, id `repositories`: `rows`, each `{ name, path, home, missing }`, `home` the path
  with the home folder written `~`, and `problem`, the read error of the file, or null.
- `FolderSuggestions`, id the typed text: `rows`, each `{ path, git }`, `path` written as typed,
  ending with `/`, and `git` true when the folder holds `.git`.

### Components

- **Repository list** (`crates/core/src/repositories.rs`, new): `data_dir`, the data folder from
  `URAEDA_DATA_DIR`, `XDG_DATA_HOME`, or the platform's default, moved from
  [`runner/cache.ts`](/packages/server/src/runner/cache.ts); `read`, `add` (resolves the main
  checkout, names it, refuses a folder outside git), `remove`, and `touch`. Pure file handling over
  [`git.rs`](/crates/core/src/git.rs), testable with a temporary folder.
- **Binding** ([`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs)): `dataDir`,
  `readRepositories`, `addRepository`, `removeRepository`, and `openRepository`, each taking the
  data folder.
- **`ura add [folder]`** ([`crates/cli/`](/crates/cli/)): adds the repository holding the folder,
  the current one by default. The skill's table of commands gains its row, as the
  [CLI](../decisions/cli.md) decision requires.
- **Repository hosts** (`packages/server/src/repositories.ts`, new): reads the list through the
  binding, keeps a host per repository, `{ name, path, fate, live, watch }`, starts and stops hosts
  as the list changes, and reloads the list when `repositories.json` changes on disk, watched with
  `node:fs`. A change of the list sends a `Repositories` update on every host's live updates and the
  global ones.
- **fate server** ([`fate.ts`](/packages/server/src/fate.ts)): a function builds a fate server with
  its own live updates; the module still exports one, the global endpoint's, for the UI's generated
  client. The context gains the hosts, and its `repo` is null on the global endpoint, where a
  repository's record fails with "No repository".
- **Sources and mutations** ([`fate/`](/packages/server/src/fate/)): `Repositories` and
  `FolderSuggestions`; `repositories.add({ folder })`, `repositories.remove({ name })`, which
  refuses while one of the repository's sessions is working, and `repositories.open({ name })`.
  `FolderSuggestions` lists folders with `node:fs`: folder names only, never files.
- **Live updates** ([`live.ts`](/packages/server/src/live.ts)): the watcher's changes go to their
  repository's host; a session's change goes to the host whose path is the session's main checkout.
  The session manager's start moves out of it, into the server's wiring.
- **Server wiring** (`packages/server/src/server.ts`, new): one function, used by
  [`main.ts`](/packages/server/src/main.ts) and [`dev.ts`](/packages/server/src/dev.ts), loads the
  binding, starts the session manager and the hosts, adds the starting repository, and builds the
  app. `dev.ts` keeps one app per port, and no longer reads `URAEDA_REPO` per request.
- **Routes** ([`app.ts`](/packages/server/src/app.ts), [`files.ts`](/packages/server/src/files.ts)):
  `/fate` and `/fate/live`, global; `/r/:name/fate`, `/r/:name/fate/live`, `/r/:name/raw/*`, and
  `/r/:name/mockups/*`, each with that host's context; 404 "No repository named <name>" for an
  unknown name; 307 from `/raw/*` and `/mockups/*` to the most recent repository's. The guard is
  unchanged.
- **Router** ([`routes.tsx`](/packages/web/src/routes.tsx)): routes carry the repository's name; one
  helper builds every path from the current repository, replacing the path literals of the pages;
  `/`, and a page path without `/r/<name>`, redirect to the most recently opened repository.
- **Clients** ([`App.tsx`](/packages/web/src/App.tsx), [`main.tsx`](/packages/web/src/main.tsx)): a
  fate client per repository, made once per name, with the page tree keyed by it; the global client
  where no repository is open.
- **Repository menu** (`packages/web/src/RepositoryMenu.tsx`, new), in the navigation's heading
  ([`Shell.tsx`](/packages/web/src/Shell.tsx)): the trigger, the filter, the rows and their ⋯ menu,
  and "Add a repository…", with Astryx's menu components, adaptive. Folded, the heading's icon opens
  it. It calls `repositories.open` when a repository's page first shows in the tab.
- **Add form** (`packages/web/src/AddRepository.tsx`, new): the Folder field with its suggestions,
  in an overlay from the menu, and in the page for the first run.
- **Pages** (new, small): "Add your first repository", "Folder not found", and "No repository named
  …".
- **Browser storage** ([`useRoundPosition.ts`](/packages/web/src/useRoundPosition.ts)): its key
  gains the repository's name.

### Mockups

- [Repositories](mockups/repositories.html): the menu open on both widths; a row's ⋯ menu and the
  refusal while an agent works; the add form completing on wide screens, and refusing a folder
  outside git on narrow ones; the first run on both widths; a missing folder, and an unknown name.

### Error handling

- Adding: "No such folder: <path>.", "Not a git repository: <path>. Run git init there first.",
  "Type an absolute path, starting with / or ~.", or the core's message for anything else, under the
  field, until the text changes.
- Removing while an agent works: "An agent is working in <name>: stop it first.", in the menu.
- An unreadable `repositories.json`: "repositories.json could not be read: <problem>", in the menu
  and as the add form's error; the server logs it once per change of the file.
- An unknown name in a URL: the "No repository named “<name>”" page, and 404 for its server routes.
- A missing folder: the "Folder not found" page; its fate requests are not sent.
- The server's start: the messages of US3 and the busy port's, on stderr, exiting 1 when it cannot
  serve.

### Testing

Server tests build the app in process, with a temporary data folder holding fixture repositories
added through the binding, and call `/r/<name>/fate`. Web tests render pages at `/r/<name>/...`
against that app. CLI tests run `ura add` with `URAEDA_DATA_DIR` set. Browser tests each add their
own fixture repository, so they no longer take the repository in turn.

| What                                                          | Test                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| US1.1 to US1.4, SC-001                                        | Web integration tests of the menu, counting clicks for SC-001                               |
| US2.1 to US2.6, and the add form's edge cases                 | Server tests of `FolderSuggestions` and `repositories.add`, a web test of the form          |
| US3.1 to US3.4, the busy port                                 | Server tests of the wiring; process tests of `main.ts`, as today                            |
| US4.1, US4.2, US4.4                                           | CLI integration tests                                                                       |
| US4.3, SC-004                                                 | Server test: the core adds to the file, and a `Repositories` update follows within 1 second |
| US5.1 to US5.5                                                | Server tests of `repositories.remove`; web tests of the menu and pages                      |
| US6.1, US6.2, SC-002                                          | Server tests with two fixture repositories sharing a folder name                            |
| US6.3 to US6.5, old file links                                | Web tests of the router; server test of the 307                                             |
| SC-003                                                        | Web test: every anchor of each page of the fixture starts with `/r/repo/`                   |
| Naming, `~` expansion, invalid or unknown `repositories.json` | Table-driven core tests                                                                     |
| The menu and form at both widths                              | Browser tests, both sizes, as for every view                                                |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The `fix/2026-10-13-review-findings` work landed on the default branch before this spec; the plan
  starts from it.
- The server cleanup covers what several repositories need: one wiring for `main.ts` and `dev.ts`,
  the session manager out of `live.ts`, and per-repository endpoints. Paths that assume an Uraeda
  checkout stay for [Run the web UI with npx](../drafts/run-the-web-ui-with-npx.md), which needs
  them gone.
- URLs without a repository open the same page in the most recently opened repository.
- The list is sorted by when each repository was last opened.
- Removing a repository changes neither its files nor its sessions in the cache.
- A moved or deleted folder stays in the list, marked missing, with Remove.
- A subfolder, a worktree, or a repository added twice is stored once, as its main checkout.
- The name shown is the folder's name, made unique with its parent folder's name. No aliases or
  groups.
- Live updates carry their repository; each listed repository is watched, while it is listed.
- Agent sessions are unchanged.
- `--repo` and `URAEDA_REPO` name the repository opened first, added to the list.
- The port stays 4310, configurable; a second server exits.
- The round position's browser key gains the repository; the theme and the navigation's state stay
  shared.
- File routes carry the repository, and image attachments' will too.

Settled while writing this spec:

- Anyone the server accepts may add folders and run agents in them: security comes with "Auth and
  login for basic security", in Next
  ([Q9](clarifications-01.md#q9-who-may-add-folders-and-run-agents-in-them)).
- Git repositories only: `git init` and cloning from the UI are in Later
  ([Q3](clarifications-01.md#q3-which-folders-can-be-added)).
- A name is kept once set, so links stay valid: it is the human's to rename, in the file.
- The data folder's rules move from TypeScript into the core, so the CLI and the server find the
  same folder; `runner.sqlite` stays where it is.
- `ura add` is the only new command: removing or listing is done in the UI, or in the file.
- The menu's filter is always shown; there is no keyboard shortcut yet.
- Removing needs no confirmation: nothing is lost, and adding the folder back restores it.
- Suggestions list folders only, at most 20, and never read their contents beyond checking for
  `.git`.
- A server started outside git keeps running: the human adds a repository from the UI.
- The README's section on the web UI is updated: the selector, `ura add`, and `URAEDA_REPO`'s new
  meaning.

## Decisions

New, applied when this spec is approved:

- [Repositories](../decisions/repositories.md): one server for every listed repository, the list in
  `repositories.json` in the data folder, owned by the core, and `/r/<name>/` before every
  repository's page and route.

Relied on:

- [Stack](../decisions/stack.md): the list's logic is in the core, reached through the binding; the
  UI's data comes through fate; the server stays on 127.0.0.1 with its `Host` and `Origin` check.
- [Agents](../decisions/agents.md): the data folder it names holds the list; sessions keep their
  keys, their working folders, and their cache.
- [CLI](../decisions/cli.md): `ura add` prints messages on stderr and exits 1 on errors, and the
  skill lists it.
- [UI layout](../decisions/ui-layout.md): the menu is a popover or a sheet, the add form a dialog or
  a sheet, the repository is in the URL, and the mockups show both widths.
- [UI behaviour](../decisions/ui-behaviour.md): the add form is a short form with a visible close;
  its errors stay until the text changes.
- [UI components](../decisions/ui-components.md): the menu, the field, and the suggestions are
  Astryx components.
- [Toolchain](../decisions/toolchain.md): the tests run in `vp run ready`, on Linux and macOS.

## Constitution check

| Principle                            | Complies | Notes                                                                            |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | The human adds and removes repositories; nothing is added without them           |
| II. Git and plain text first         | yes      | No workflow state moves: the list is machine data, plain JSON, editable by hand  |
| III. Asynchronous by default         | yes      | Every workflow step still ends with a commit; losing the list costs adding again |
| IV. Review effort matches impact     | yes      | Questions came with recommendations; settled points are listed above             |
| V. Tools are optional                | yes      | The workflow is unchanged; the list only serves the UI and `ura add`             |
| VI. Code is checked against the spec | yes      | Every scenario has a test; the per-repository hosts are justified in the plan    |

## Risk tier

**High**: anyone who reaches the server can now add any repository of the machine and run agents in
it, and every URL of the UI and the server's wiring change.
