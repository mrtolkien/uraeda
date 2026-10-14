---
kind: feature
finished: 2026-10-14
pull-request: https://github.com/mrtolkien/uraeda/pull/12
---

# Record: Multi-repo server

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-13, finished on
> 2026-10-14, in [its pull request](https://github.com/mrtolkien/uraeda/pull/12). Its full files are
> in git: `git log -- specs/2026-10-13-multi-repo-server/`.

## What and why

The server served one repository, the folder it started in. The human wanted Uraeda to manage
several repositories from one web UI, with a repository selector at the top left and any folder of
the machine addable, since a packaged Uraeda needs a flow to pick its first repository anyway.
Running the UI easily, with `npx`, was split into its own feature,
[Run the web UI with npx](../drafts/run-the-web-ui-with-npx.md).

## Behaviour

- The navigation's heading, "Uraeda" over the current repository's name, opens a menu: the
  repositories, most recently opened first, the current one checked, each with its path (`~` for the
  home folder), a filter on names and paths, and "Add a repository…". A popover on wide screens, a
  bottom sheet with Close on narrow ones; folded, the heading's icon opens it. Home stays in the
  navigation. Switching to a repository moves it first, every time.
- "Add a repository…" opens a short form with a Folder field: a path starting with `/` or `~`
  completes with the folders found there, at most 20, sorted by name, git ones marked "git", hidden
  ones only after a `.`. Adding a folder in a git repository lists its main checkout once (a
  subfolder or a worktree adds its main checkout) and opens it. Errors stay under the field until
  the text changes: "Not a git repository: <path>. Run git init there first.", "No such folder:
  <path>.", "Type an absolute path, starting with / or ~.".
- A repository's name is its folder's, with characters outside `[A-Za-z0-9._-]` replaced by `-`,
  made unique with its parent folder's name, then `-2`, `-3`; it is kept once set.
- The server, started in a git repository (with or without `specs/`), adds it and opens it first.
  Started outside git, it says
  `uraeda-server: <dir> is not in a git repository: add one from the web UI` and opens the most
  recent repository; `--repo` or `URAEDA_REPO` outside git exits 1 with
  `<dir> is not a git repository`. With an empty list, every page shows "Add your first repository"
  with the form, without the navigation. A busy port exits 1 naming the first server's URL.
- `ura add [folder]` adds the repository holding a folder, the current one by default, prints
  `added <name>: <path>` or `<name> is already added: <path>`, and a running server shows it within
  a second.
- Each row's ⋯ menu has "Remove from Uraeda", which takes the repository off the list only, never
  its files or its sessions; it is refused while any agent, of a feature or a chat, works in it: "An
  agent is working in <name>: stop it first.". A folder gone, or a checkout that lost its `.git`,
  shows "Folder not found", in the menu and on its pages, with Remove, and comes back once restored.
- Every page, link, file route, and live update carries its repository, `/r/<name>/...`: two
  repositories never mix. Paths without it open in the most recent repository; `/raw/*` and
  `/mockups/*` redirect there with 307; an unknown name shows "No repository named “<name>”".
- An unreadable or unknown-version `repositories.json` is never overwritten: the menu shows
  "repositories.json could not be read: <problem>", adding is refused, and the server keeps its last
  list.

## Design

The Rust core owns the list, `repositories.json` in Uraeda's data folder, beside `runner.sqlite`:
`{ "version": 1, "repositories": [{ name, path, openedAt }] }`, written whole through a temporary
file of its own per write, renamed over it, under the core's write lock. The CLI and the binding are
its only callers, and the data folder's rules moved from TypeScript into the core. In the server,
one host per listed repository holds its own fate server, live bus, and watch; the session manager
stays one per process, its changes routed to the host of their main checkout. The UI keeps one fate
client per repository, at `/r/<name>/fate`, so fate's IDs did not change; the global `/fate` serves
only the list, folder suggestions, and the list's mutations.

- The list: [`crates/core/src/repositories.rs`](/crates/core/src/repositories.rs), its views in
  [`view.rs`](/crates/core/src/view.rs), its operations in [`api.rs`](/crates/core/src/api.rs) and
  the [binding](/crates/binding/src/lib.rs); `ura add` in [`add.rs`](/crates/cli/src/add.rs).
- The hosts, and the data folder's watch:
  [`packages/server/src/repositories.ts`](/packages/server/src/repositories.ts); the fate factory in
  [`fate.ts`](/packages/server/src/fate.ts); the routes in [`app.ts`](/packages/server/src/app.ts);
  folder suggestions in [`folders.ts`](/packages/server/src/folders.ts); one wiring for `main.ts`
  and `dev.ts` in [`server.ts`](/packages/server/src/server.ts).
- The UI: the router's `parseLocation` and `repoPath` in
  [`routes.tsx`](/packages/web/src/routes.tsx), the clients in
  [`clients.ts`](/packages/web/src/clients.ts), the menu in
  [`RepositoryMenu.tsx`](/packages/web/src/RepositoryMenu.tsx), the form in
  [`AddRepository.tsx`](/packages/web/src/AddRepository.tsx), and the first run, missing folder, and
  unknown name in [`RepositoryPages.tsx`](/packages/web/src/RepositoryPages.tsx).

## Questions

### Round 01

#### Q1: What does this feature deliver?

**Answer:** A: several repositories, the selector, adding folders, and the server cleanup it needs;
publishing the UI becomes its own feature.

#### Q2: How should people run the UI outside Uraeda's checkout?

**Answer:** Left to a separate feature, drafted with the discovery's findings: "focus on the server
code in TS for this feature".

#### Q3: Which folders can be added?

**Answer:** B: git repositories only, with `git init` and cloning from the UI added to Later.

#### Q4: How do you name a folder from the browser?

**Answer:** A: a typed path completed by the server, plus `ura add` from the CLI, "if the web UI
data is in a predictable place on the machine".

#### Q5: Where is the selector, and what does it hold?

**Answer:** A: the heading opens a menu with the repositories, a filter, removal, and "Add a
repository…".

#### Q6: How do URLs name the repository?

**Answer:** A: a short name, the folder's, made unique: `/r/<name>/...`.

#### Q7: Which repository opens when the server starts?

**Answer:** A: the starting folder when it is in git, else the last opened; a first-run view with
none.

#### Q8: Where does the server keep the list of repositories?

**Answer:** A: `repositories.json` in the data folder: "Repositories are not config but data", and a
file "can easily be edited by a human or coding agent".

#### Q9: Who may add folders and run agents in them?

**Answer:** A: the `Host` and `Origin` check stays the only protection; security is its own feature,
in Next.

### Round 02

#### Q1: Do you accept the `ura` binary growing by 36 KB for `ura add`?

**Answer:** A: accepted as an exception to constitution 1.3.0's principle VI, recorded in the plan.

## Decisions

- [Repositories](../decisions/repositories.md): one server for every listed repository, the list in
  `repositories.json` owned by the core, and `/r/<name>/` before every repository's page and route.

## Changes after approval

- The spec's revision 2 added round 02: the release `ura` grew from 5,784,512 to 5,820,976 bytes,
  approved as a constitution exception.
- Each write of the list uses its own temporary file, `repositories.json.<pid>.<count>.tmp`, not the
  spec's single `repositories.json.tmp`, so writers at the same moment never share one.
- Paths in the menu and the suggestions wrap rather than end in an ellipsis as the mockup showed:
  the UI checks decision allows no cut text.
- The menu is a popover or a sheet by width class, not a `DropdownMenu` in adaptive mode, which
  follows the pointer rather than the width.
- Removing a repository is refused while a chat's agent works too, not only a feature's; a checkout
  that lost its `.git` is missing, so the core never reaches the repository around it.

## Follow-ups

- A `git init --separate-git-dir` checkout, or a submodule, is listed at its git storage's parent
  and shows as missing.
- A hand-edited list is not validated: duplicate names or paths, or names outside the allowed
  characters, are read as they are.
- A hand edit giving a name another path keeps the UI's client and live connections of the old one
  until a reload.
- A malformed percent-encoding in a URL, like `/r/%E0/`, breaks the page.
- Folder suggestions read a whole folder, and are cached per typed text for the tab.
- A second server on a busy port touches the starting repository before exiting.
- An unreadable list is logged twice at start; `SERVER_PATHS` in `dev.ts` repeats `app.ts`'s routes;
  a few exports have no user.
- A request from a stale tab, after a removal and before its live update, shows the server error
  page.
- The test-run flakes seen in `session.test.tsx` ("Send" not found) and `editor.test.tsx` (a stray
  "Internal server error"), which pass alone.
