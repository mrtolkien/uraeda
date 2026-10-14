---
status: answered
---

# Clarifications, round 01: Multi-repo server

> [!NOTE]
>
> Answered on 2026-10-14.
>
> - The proposal holds three pieces of work: the recommendation keeps the selector and adding
>   folders here, and moves npm publishing to its own feature, right after this one.
> - Four choices last beyond this feature: how the UI ships, how URLs name a repository, where the
>   list of repositories lives, and who may add folders through the server.
> - "Any folder" is ambiguous: the core only works in git repositories, so a folder outside git
>   needs a choice.
> - Who may add folders is a security choice: adding any folder from the UI gives anyone who reaches
>   the server, a phone on your tailnet included, every repository on the machine.
> - 14 points are settled without you, at the end. Check two of them: the open
>   `fix/2026-10-13-review-findings` branch lands before this feature's code, and URLs without a
>   repository open the current one.

## Context

The [proposal](proposal.md) asks for a repository selector at the top left of the web UI, for adding
any folder of the machine, and for a UI that is easy to run, maybe with `npx`. Its title in the
priorities adds "clean server code".

Today, the server serves one repository: the folder it starts in, `--repo`, or `URAEDA_REPO`
([`main.ts`](/packages/server/src/main.ts), [`env.ts`](/packages/server/src/env.ts)). It runs from
Uraeda's checkout, with `pnpm start` or `vp dev`. The core and the agent sessions already take the
repository on every call. The single-repository parts are the server's wiring, the IDs that live
updates and the UI's cache use, and the UI's URLs. The top left shows "Uraeda" and the repository's
folder name, and links home ([`Shell.tsx`](/packages/web/src/Shell.tsx)).

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What does this feature deliver?

The selector and adding folders are one piece of work in the server and the UI. Making the UI easy
to run is another: bundling the server, building the native binding for each platform, publishing to
npm, and a release job, with its own decision. The two meet in one place: a packaged server starts
in any folder, and shows the selector first. The shipping direction is Q2. More in
[discovery](discovery-01.md#scope).

Why it matters: it decides the size of this review, and when "easy to run" arrives.

- **A (recommended). This feature makes the server serve several repositories, with the selector,
  adding folders, and the server cleanup this needs. Publishing the UI becomes its own feature,
  added to Now right after this one.**
  - [pro] two reviews of reasonable size, and a release pipeline reviewed on its own.
  - [con] until the second feature, the UI still runs from Uraeda's checkout.
  - Why recommended: the release pipeline has its own risks, like a broken npm release that cannot
    be replaced, and needs nothing from the selector except a server that starts anywhere.
- **B. One feature for all of it: several repositories, the selector, and publishing to npm.**
  - [pro] "easy to run" arrives with the selector.
  - [con] a large review, and the plan mixes UI work with a CI matrix and npm publishing.
- **C. This feature serves several repositories, and publishing waits in Next, with no date.**
  - [pro] the smallest commitment.
  - [con] the proposal's third request waits without a date.

**Answer:** A

## Q2: How should people run the UI outside Uraeda's checkout?

The server is TypeScript on Node, calling the Rust core through a native binding, so shipping it
means shipping that binding for each platform. Biome, Rolldown, Backlog.md, and opencode publish one
npm package per platform, which `npx` picks from; the binding's generated loader already looks for
such packages. The stack decision says the `ura` CLI "MUST NOT need Node". With A in Q1, this answer
sets the direction of the next feature; with B, of this one. More in
[discovery](discovery-01.md#shipping-the-ui).

Why it matters: it becomes a decision on how Uraeda reaches users, and every release follows it.

- **A (recommended). Publish an npm package, `uraeda`, with the binding in one package per platform:
  `npx uraeda` starts the server in the current folder.**
  - [pro] one command where Node is installed; the pattern of Biome and Rolldown; fits the stack
    decision.
  - [con] a release job building the binding on Linux and macOS runners, and npm releases that can
    break halfway and cannot be replaced.
  - Why recommended: it is the proposal's own idea, needs no decision change, and `uraeda` is free
    on npm.
- **B. Add `ura ui` to the CLI, which starts the npm package of A.**
  - [pro] one entry point for people who installed `ura` with Homebrew.
  - [con] all of A's work, plus a change to the stack decision, since the CLI would need Node.
- **C. Build a single executable, with Node's single executable applications.**
  - [pro] nothing to install, not even Node.
  - [con] experimental in Node 24, CommonJS only, and the binding must be written to a temporary
    file to load; Bun or Deno would leave Node, against the stack decision.
- **D. Publish a container image.**
  - [pro] nothing to install but Docker.
  - [con] repositories mounted into the container, and `claude` and its login inside it for agents
    to run.

**Answer:** Let's focus on the server code in TS for this feature and leave packaging for a separate
feature. Create the draft with the info you found during your discovery.

## Q3: Which folders can be added?

Every call into the core needs a git repository: a folder outside git fails, and a subfolder opens
the repository holding it. A repository without `specs/` is already shown, with a banner that points
to `ura init`, which the server cannot run yet. GitHub Desktop and Lazygit offer `git init` for a
folder outside git; GitHub Desktop, Vibe Kanban, and Conductor also clone or create repositories.
More in [discovery](discovery-01.md#which-folders).

Why it matters: it decides what "any folder" means, and whether a new project can start from the UI.

C and D can come on top of A or B.

- **A (recommended). Any folder in a git repository, with or without `specs/`. A folder outside git
  is refused, with a message offering to initialise git there; accepting runs `git init` and adds
  it.**
  - [pro] any folder of the machine can be added, as the proposal asks, in one extra click.
  - [con] a new core action, `git init`, small.
  - Why recommended: it meets "any folder" without inventing a non-git mode the core does not have.
- **B. Git repositories only: a folder outside git is refused, with a message to run `git init`.**
  - [pro] the smallest.
  - [con] a new project needs a terminal first.
- **C. Also clone a repository from a URL.**
  - [pro] covers a project not yet on the machine.
  - [con] credentials, progress, and network errors to handle in the server.
- **D. Also set Uraeda up in a repository without `specs/`, from the banner, as `ura init` does.**
  - [pro] the first-run flow ends with a working project, without a terminal.
  - [con] overlaps the onboarding pass in the priorities, which plans a setup with an agent.

**Answer:** B: Add git init and pull in the "later" part

## Q4: How do you name a folder from the browser?

A web page cannot learn an absolute path from the system's folder dialog: the browser only gives the
folder's name ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle)). Every
browser-based tool reviewed has the server help instead: opencode completes a typed path, Vibe
Kanban browses folders with home and up buttons. More in
[discovery](discovery-01.md#adding-a-folder).

Why it matters: it decides how adding works on the phone, and what the server reveals of the
machine's folders.

- **A (recommended). Type a path, starting with `~` or `/`, completed as you type with the folders
  the server finds there; folders in git show a mark.**
  - [pro] fast on the desktop, workable on the phone, and the server lists folder names only.
  - [con] the human must know roughly where the folder is.
  - Why recommended: it is the smallest form that still finds folders, and fits in a dialog or a
    sheet.
- **B. Browse folders from the home folder, with up and home buttons, and pick one.**
  - [pro] nothing to remember or type.
  - [con] many taps to reach a deep folder, and a larger view to build.
- **C. Type the full path, with no completion.**
  - [pro] the smallest.
  - [con] a typo is only found when submitting, and long paths on a phone keyboard.
- **D. No adding from the UI: repositories are added by starting the server in them, or with
  `--repo`.**
  - [pro] the server never lists folders.
  - [con] not what the proposal asks.

**Answer:** A: I'd like another way if it's possible: `ura add` from the CLI would add the local
folder to the uraeda web UI

This is doable if the web UI data is in a predictable place on the machine (it should be, right?)

## Q5: Where is the selector, and what does it hold?

The top left is the navigation's heading: "Uraeda" over the repository's name, linking home, or a
home icon when the navigation is folded. GitHub Desktop's "Current repository" opens a list there,
recent first, with an add action. The [UI layout decision](../decisions/ui-layout.md) makes a menu a
popover on wide screens and a bottom sheet on narrow ones. More in
[discovery](discovery-01.md#the-selector).

Why it matters: it is the control the human uses every time they change project.

- **A (recommended). The heading opens a menu: the repositories, the current one marked, most
  recently opened first, with a filter field; then "Add a repository…". Each row has a menu to
  remove it; a missing folder shows as such.**
  - [pro] two clicks to switch, everything in one place, like GitHub Desktop.
  - [con] the heading no longer links home; Home stays in the navigation.
  - Why recommended: it is what the proposal describes, and the menu has room for the rare actions.
- **B. The heading links to a repositories page, listing them with their actions.**
  - [pro] room for details, like each repository's path and features in flight.
  - [con] switching goes through a page.
- **C. A command palette, Ctrl+K, filters and switches repositories.**
  - [pro] the fastest on a keyboard.
  - [con] nothing on the phone, and hidden for new users.

**Answer:** A

## Q6: How do URLs name the repository?

Every page needs the repository in its URL: the UI's cache and live updates would otherwise mix two
repositories' features, and a link or a reload must open the same one. code-server puts the path in
the URL, `?folder=/home/...`; Vibe Kanban an opaque ID. More in
[discovery](discovery-01.md#the-repository-in-the-url).

Why it matters: every link to a page, shared or bookmarked, follows this.

- **A (recommended). A short name, the folder's name, made unique when two match:
  `/r/uraeda/f/2026-10-13-multi-repo-server`.**
  - [pro] readable links that do not reveal the machine's paths.
  - [con] renaming a folder, or adding a second one with the same name, can change the name.
  - Why recommended: links stay readable, and a name changes only in rare cases.
- **B. An opaque ID, given when the repository is added: `/r/3fa9/f/...`.**
  - [pro] never changes.
  - [con] unreadable links.
- **C. The path in a parameter: `/f/...?repo=/home/me/uraeda`.**
  - [pro] nothing to store to resolve it.
  - [con] long links that show the machine's paths, and break when the folder moves.

**Answer:** A

## Q7: Which repository opens when the server starts?

code-server opens the folder given on the command line, else the last one; GitHub Desktop the last
one; Vibe Kanban a list. Today, the server opens the folder it starts in. With A in Q2, `npx uraeda`
runs in a folder. More in [discovery](discovery-01.md#starting-and-first-run).

Why it matters: it decides what `npx uraeda` in a project does, and the first-run flow the proposal
mentions.

- **A (recommended). The folder the server starts in, or `--repo`, when it is in a git repository:
  it is added to the list and opened. Otherwise, the last repository opened. With none, a "get
  started" view shows the add form of Q4.**
  - [pro] starting in a project opens it, as today; starting anywhere else still works.
  - [con] starting in a repository adds it, even for a quick look.
  - Why recommended: it keeps today's behaviour, and gives the first-run flow the proposal asks for.
- **B. Always the last repository opened, whatever the starting folder.**
  - [pro] the server's folder does not matter.
  - [con] starting in a new project does not open it.
- **C. Always the list of repositories, to pick from.**
  - [pro] predictable.
  - [con] one more click at every start.

**Answer:** A

## Q8: Where does the server keep the list of repositories?

The agents decision puts the runner's cache, `runner.sqlite`, in Uraeda's data folder for the user,
`~/.local/share/uraeda/` on Linux, and says losing it must cost only sessions. XDG places user
settings in `~/.config`, and recent files in `~/.local/state`
([XDG](https://specifications.freedesktop.org/basedir/latest/)). More in
[discovery](discovery-01.md#storing-the-list).

Why it matters: it becomes part of a decision on where Uraeda keeps what is not in a repository.

- **A (recommended). A plain-text file, `repositories.json`, in the same data folder as the cache,
  readable and editable by hand.**
  - [pro] one folder for everything Uraeda keeps outside repositories, already named by a decision.
  - [con] XDG would put a user's list in `~/.config`.
  - Why recommended: one location to know, back up, or delete, and plain text, in the spirit of
    principle II.
- **B. The same file in Uraeda's config folder, `~/.config/uraeda/` on Linux.**
  - [pro] where XDG puts user settings, kept apart from a cache that may be deleted.
  - [con] a second folder, and a second location rule for macOS.
- **C. A table in `runner.sqlite`.**
  - [pro] no new file.
  - [con] not editable by hand, and the cache can be lost, which the agents decision allows.

**Answer:** A: Repositories are not config but data. I think a repositories.json is nice and this
way it can easily be edited by a human or coding agent.

## Q9: Who may add folders and run agents in them?

The server listens on 127.0.0.1 and refuses other `Host` and `Origin` headers, except the host names
in `URAEDA_ALLOWED_HOSTS`, like your phone through Tailscale. Today, it reaches one repository you
chose when starting it. Adding folders from the UI lets any allowed client list folder names, add
any repository, and run an agent there. Jupyter and code-server add a token; Vibe Kanban and
opencode rely on the localhost bind. An agent in auto mode can already act outside its repository.
More in [discovery](discovery-01.md#access-from-other-machines).

Why it matters: it sets what a client of the server can reach on the machine.

- **A (recommended). Keep the `Host` and `Origin` check as the only protection: any allowed client
  may add folders.**
  - [pro] the phone keeps working as today, and nothing to set up.
  - [con] your tailnet's access rules protect the whole machine, not one repository.
  - Why recommended: the server already runs agents that can act on the whole machine, so a token
    would mostly guard what is already reachable.
- **B. Add a token, printed when the server starts, kept in a cookie once the printed link is
  opened.**
  - [pro] reaching the port is not enough.
  - [con] a link to open on every new browser and phone, and a change to the stack decision.
- **C. Keep A, but only 127.0.0.1 may add or remove repositories: other clients switch between
  them.**
  - [pro] the phone cannot widen what the server reaches.
  - [con] adding a project from the phone is impossible.

**Answer:** A: I've added security as a "Next" feature, it'll come once the core feature are down

## Settled without the human

- **The open `fix/2026-10-13-review-findings` branch**, which splits `runner/sessions.ts` and
  refactors the router and the browser tests, lands before this feature's code: the plan starts from
  the default branch once it has. The four local `worktree-agent-*` branches hold the same kind of
  work. See [discovery](discovery-01.md#overlaps-with-work-in-flight).
- **The server cleanup** covers what serving several repositories needs: one function that builds
  the server for both `main.ts` and `dev.ts`, the session manager moved out of `live.ts`, IDs that
  carry the repository, and paths that do not assume an Uraeda checkout. Broader cleanup stays with
  the code-quality item in the priorities. See [discovery](discovery-01.md#clean-server-code).
- **URLs without a repository**, like links written before this feature, open the same page in the
  current repository. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Recent first**: the list is sorted by when each repository was last opened.
- **Removing a repository** only takes it off the list: its files and its sessions in the cache
  stay. See [discovery](discovery-01.md#needs-no-choice).
- **A moved or deleted folder** stays in the list, marked missing, with Remove, rather than dropped
  silently.
- **A subfolder, a worktree, or a repository added twice** is stored as its main checkout, which the
  core already resolves, so each repository appears once.
- **The name shown** is the folder's name, with its parent folder's name added when two match. No
  aliases or groups.
- **Live updates** carry the repository, so a change in one repository never refreshes a page of
  another; each listed repository is watched, its watch started and stopped with the list.
- **Agent sessions** are unchanged: they are already keyed by the repository's main checkout, and
  work in its checkout or worktree. One server now runs them in every listed repository.
- **`--repo` and `URAEDA_REPO`** keep their meaning: the repository to open first, added to the
  list.
- **The port** stays 4310, configurable: a second server fails to start and names the URL of the
  first, since phone links and Tailscale rely on a fixed port.
- **Browser storage** gains the repository in the round position's key; the theme and the
  navigation's state stay shared.
- **File routes**, `/raw` and `/mockups`, and those image attachments will add, carry the repository
  like pages.

**Notes:**
