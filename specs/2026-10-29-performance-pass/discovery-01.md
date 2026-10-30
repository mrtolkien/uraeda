# Discovery, round 01: Performance pass

## Summary

Products that feel instant share five habits:

- they render from data already on the client;
- they revalidate it in the background;
- they fetch the likely next view before the click;
- they apply small writes before the server confirms, rolling back on refusal;
- they keep measuring.

They differ on how far the local copy goes. Superhuman and Linear keep a whole local database.
GitHub Issues keeps an IndexedDB cache with preheating. VS Code updates its Source Control view
optimistically after git commands.

The [proposal](proposal.md) asks for the far end: optimistic UI everywhere, values cached ahead of
time, no page over 100 ms locally. It also names one flow: moving a draft to a feature takes over 10
seconds, across several page changes, without clear feedback.

The measurements say the proposal's cause is mostly elsewhere. The human's server runs a **debug
build of the Rust binding**, which makes every read about 4 times slower. A fresh worktree makes
each read slower still, by about 3 seconds per new worktree. Every read rebuilds the whole
workspace, every branch, every worktree, every file: about 95 ms on this repository even in a
release build. So no page can load under 100 ms without a server-side cache, whatever the client
does.

On the client, there is:

- no prefetch;
- no transition state on navigation;
- a cache of 10 released requests;
- 2 to 4 chained reads per page;
- optimistic results on about 10 of 95 write call sites.

Git writes are bound by an active rule: "never a guessed status". It conflicts with "optimistic
everywhere" for commits.

## How other products do it

### Superhuman

- "The 100ms rule states that every digital interaction should be faster than 100ms"; Superhuman
  treats it as a maximum and aims under 50 ms
  ([Superhuman blog](https://blog.superhuman.com/superhuman-is-built-for-speed/)).
- It "keeps a database of your emails stored in your app or browser", and "preloads and prerenders
  the email threads that you're most likely to view soon" (same source).

### Linear

- "Linear is a local-first application. Each client maintains a local database so that creating an
  issue, changing its status, or navigating a workspace … doesn't require a network round trip"
  ([Linear, rebuilding the delta sync read path](https://linear.app/now/rebuilding-delta-sync-read-path)).
- Models are updated in memory before they are saved. Transactions queue, and a rejected one runs
  its `rollback`. Only server-approved data is persisted locally
  ([reverse-engineered write-up](https://github.com/wzhudev/reverse-linear-sync-engine), unofficial,
  which Linear's CTO called "probably the best documentation that exists").

### GitHub Issues

- "Render instantly from locally available data, then revalidate in the background": an in-memory
  tier, an IndexedDB cache, low-priority rate-limited preheating, a service worker, and route-level
  code splitting
  ([GitHub blog](https://github.blog/engineering/architecture-optimization/from-latency-to-instant-modernizing-github-issues-navigation-performance)).
- Instant is under 200 ms, Fast under 1,000 ms. Preheating raised the cache hit ratio from about 33%
  to about 96%. The median went from about 1,200 ms to 700 ms, and p10 from about 600 ms to 70 ms
  (same source).

### VS Code

- Since 1.74, "the Source Control view is optimistically updated for some of the Git operations
  (stage, unstage, discard changes, and commit)", behind `git.optimisticUpdate`, on by default. "The
  Commit button also shows an animation indicating progress"
  ([VS Code 1.74 release notes](https://code.visualstudio.com/updates/v1_74)).
- The proposal called it "Low risk, as git status will still run" afterwards to reconcile
  ([vscode#162417](https://github.com/microsoft/vscode/issues/162417)).

### GitHub Desktop and other git GUIs

- "Hook output is displayed in real time." A failing hook shows its output, with **Commit anyway**,
  the same as `--no-verify`
  ([GitHub Desktop docs](https://docs.github.com/en/desktop/making-changes-in-a-branch/working-with-git-hooks-in-github-desktop)).
  Before 3.5.5, users could not tell a hook's rejection from another failure
  ([changelog](https://github.blog/changelog/2026-02-18-github-desktop-3-5-5-adds-git-hooks-support)).
- GitKraken blocks the action on a failing hook and shows a notification, with no progress while
  hooks run ([GitKraken help](https://help.gitkraken.com/gitkraken-client/githooks/)).
- Sublime Merge reads with "a custom high-performance Git reading library" and writes with git, the
  same split as Uraeda ([Sublime Merge](https://www.sublimemerge.com/)).

### GitHub Codespaces

- Creating a codespace runs four named steps: assign a machine, create the container and clone,
  connect, post-creation setup. The user can connect at step 3 while step 4 finishes, and a creation
  log is available
  ([docs](https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository),
  [logs](https://docs.github.com/en/codespaces/troubleshooting/github-codespaces-logs)).

### What they have in common

- Reads are served from a copy kept close, warmed before the click, and refreshed behind it.
- Small, reversible writes show their result at once, and a refusal puts it back and says why.
- Long operations stay on one view, with named steps, and hand control back as soon as the minimum
  is ready.
- Hook output is shown, at least when a hook fails.
- Speed is measured continuously, against a stated threshold.

## Standards and libraries

### Response-time limits

- 0.1 s: "the limit for having the user feel that the system is reacting instantaneously". 1 s: the
  limit for an uninterrupted flow of thought. 10 s: the limit for keeping attention, beyond which
  users need to know "when the computer expects to be done"
  ([Nielsen, NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)).
- No indicator under 1 s; a looped spinner for 2 to 10 s; percent-done or steps for 10 s and more,
  with a description and a way to cancel
  ([NN/g, progress indicators](https://www.nngroup.com/articles/progress-indicators/)). Skeletons
  suit full-page loads under 10 s only
  ([NN/g, skeleton screens](https://www.nngroup.com/articles/skeleton-screens/)).
- RAIL: "Complete a transition initiated by user input within 100 ms", and "For actions that take
  longer than 50 ms to complete, always provide feedback"
  ([web.dev, RAIL](https://web.dev/articles/rail)).
- INP: good at 200 ms or less, poor above 500 ms. It counts the time "the next paint is being
  blocked", so quick visual feedback counts even when the work ends later
  ([web.dev, INP](https://web.dev/articles/inp)).
- Doherty threshold: productivity "soars" under 400 ms
  ([Laws of UX](https://lawsofux.com/doherty-threshold/)).
- Judgment: on localhost, network transfer costs almost nothing, so load-oriented targets such as
  LCP mostly do not apply. The 100 ms target is RAIL's response goal.

### fate 1.12.1

Read in the installed package's docs and types (`node_modules/@nkzw/fate/docs/guide/`,
`lib/refetch-*.d.mts`).

- **Request modes**: `cache-first` (the default), `stale-while-revalidate`, `network-only`, and
  `cache-only` ([requests guide](https://fate.technology/guide/requests)).
- **Cache lifetime**: "fate keeps a screen's data in memory while its `useRequest` is mounted. After
  you leave, it keeps the 10 most recently released requests", set by `gcReleaseBufferSize` (same
  guide).
- **Preloading**: no prefetch API. `fate.request(...)` fills the cache, and `fate.retain(...)` keeps
  it, documented "for non-React request lifetimes, tests, or preloaded data" (types).
- **Optimistic updates**: an `optimistic` object on a mutation updates the views that select its
  fields at once. "If the mutation fails, fate rolls back the optimistic update." Inserts take a
  temporary id that the server's replaces. `delete: true` removes a record from every list and
  restores it on failure ([actions guide](https://fate.technology/guide/actions)).
- **Persistence**: `@nkzw/fate/persistence` with the separate `@nkzw/fate-indexeddb` package keeps
  data across reloads (one day, 25 MiB by default) and queues mutations durably
  ([persistence guide](https://fate.technology/guide/persistence)).
- **Live views**: one SSE connection per client; the default event bus does not replay missed events
  ([live views guide](https://fate.technology/guide/live-views)).
- **Newer versions**: 1.12.2 "Fixed explicit list insertions disappearing during background
  refreshes, including optimistic insertion and rollback". 1.13.0 adds streaming for GraphQL reads
  only ([releases](https://github.com/nkzw-tech/fate/releases)).

### React 19

- "React reveals suspended content at most once every 300ms, measured from the last reveal"
  ([Suspense reference](https://react.dev/reference/react/Suspense)). Judgment: a page that suspends
  cannot draw under 100 ms; only cached data can.
- A Transition keeps "showing the previous page instead of hiding any already revealed content", and
  `useTransition` gives `isPending` for a cue on the old page
  ([Suspense](https://react.dev/reference/react/Suspense),
  [useTransition](https://react.dev/reference/react/useTransition)).
- `useOptimistic` holds a value only while an Action runs, scoped to one component
  ([useOptimistic](https://react.dev/reference/react/useOptimistic)).
- `<Activity mode="hidden">` can pre-render a likely next page and keep a page's state on Back.
  Effects are torn down while hidden, so a subscription opened in an Effect pauses
  ([Activity](https://react.dev/reference/react/Activity),
  [React 19.2](https://react.dev/blog/2025/10/01/react-19-2)).

### Sync engines

- Zero reads and writes a local store first, but "requires" Postgres with logical replication and a
  zero-cache server ([Zero](https://zero.rocicorp.dev/docs/introduction)). Electric syncs from
  Postgres and "does not do write-path sync" ([Electric](https://electric.ax/docs/guides/writes)).
  InstantDB "is sunsetting" ([InstantDB docs](https://www.instantdb.com/docs)).
- TanStack DB is pre-1.0 (0.15.2), with an optimistic layer above synced collections
  ([TanStack DB](https://tanstack.com/db/latest/docs/overview)).
- Judgment: each assumes a database or would replace fate, which the [stack](../decisions/stack.md)
  decision names as the only feed of the web UI. fate already has the pieces they use: a normalized
  store, optimistic updates with rollback, live push, persistence, and `request` with `retain`.

### Optimistic UI pitfalls

- Optimistic UI suits "simple binary-like elements" with errors around 1 to 3%. It "works best for
  server response times of less than 2 seconds", and must report a failure within those 2 seconds
  ([Smashing Magazine](https://www.smashingmagazine.com/2016/11/true-lies-of-optimistic-user-interfaces/)).
- A refetch landing during an optimistic write can flip the state back and forth, and "you have to
  know exactly what will happen on the server"
  ([TkDodo](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)).

### Git

- `git worktree add` checks out the whole tree, and runs `post-checkout` "unless `--no-checkout` is
  used" ([githooks](https://git-scm.com/docs/githooks),
  [git-worktree](https://git-scm.com/docs/git-worktree)).
- `pre-commit` and `commit-msg` can be skipped with `--no-verify`; `prepare-commit-msg` cannot
  (githooks).

## The code

### Important reads

- [`crates/core/src/api.rs`](/crates/core/src/api.rs) `open`: every read opens gix and runs
  `Workspace::read`. That reads every branch, every worktree with a gix status of each checked-out
  feature, and parses their files. Nothing is cached between calls, except the pull requests'
  snapshot ([`pulls.rs`](/crates/core/src/pulls.rs)).
- [`crates/core/src/api/proposal_files.rs`](/crates/core/src/api/proposal_files.rs)
  `read_proposal_file`: opens the workspace twice, once itself and once through `read_priorities`.
- [`packages/binding/package.json`](/packages/binding/package.json): `napi build` without
  `--release`. Root `start` and `dev` ([`package.json`](/package.json)) build it this way, so a
  server run from a checkout loads a 188 MB debug binary. The npm release builds with `--release`
  ([`.github/workflows/npm.yml`](/.github/workflows/npm.yml)).
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): every function that reads runs as an
  `AsyncTask` on libuv's pool, 4 threads by default. Node's event loop is never blocked, but four
  slow reads fill the pool. Every core write takes one global `write_lock`, across all repositories.
- [`packages/server/src/fate.ts`](/packages/server/src/fate.ts) `liveBus`: each live subscription is
  sent an update right after it subscribes, so each record a page reads is resolved twice.
- [`packages/server/src/live.ts`](/packages/server/src/live.ts) `publish`: every change re-sends the
  workspace and the global needs-you list, which reads every repository. For each changed feature,
  it also re-sends its feature, branch changes, history, recommended message, and sessions. fate
  resolves them one after another per connection.
- [`packages/web/src/routes.tsx`](/packages/web/src/routes.tsx) `useRoute`: the route follows the
  location through `useDeferredValue`. The old page stays until the new one draws, with nothing
  showing that a page is loading
  ([commit `0691a2a9`](https://github.com/mrtolkien/uraeda/commit/0691a2a9)).
- [`packages/web/src/App.tsx`](/packages/web/src/App.tsx): every page is a static import, so the
  built app is one bundle. Three nested Suspense boundaries show "Loading…".
- [`packages/web/src/clients.ts`](/packages/web/src/clients.ts): one fate client per repository,
  without `gcReleaseBufferSize`, persistence, or prefetch.
- [`packages/web/src/data.ts`](/packages/web/src/data.ts): every hook reads `cache-first`, then
  follows live updates. `readPriorities`, `readInbox`, and `rereadChanges` read `network-only`,
  before and after many writes. `useRefreshOnShow` reads every mounted request again when the tab
  comes back to the foreground: one batch of 43 reads, 2.1 s on the sample project.
- [`packages/web/src/sidebar/Cards.tsx`](/packages/web/src/sidebar/Cards.tsx) `WithChanges`: each
  feature's card in the sidebar reads its own `BranchChanges`, a full workspace read on the server.
  A reload sends one request per card, 32 on the sample project. The page's own reads queue behind
  them, in the browser's 6 connections per origin, 2 of them held by live streams.
- [`packages/web/src/writes/store.ts`](/packages/web/src/writes/store.ts): one git write at a time.
  Its button reads what it does, a card shows the action until the server's status changes, and a
  thin bar runs at the top.
- [`packages/web/src/lists/`](/packages/web/src/lists/): the outliners draw inserts, edits, drops,
  and moves ahead of the file, and wait up to 2 s for each write to show before the next.

### The proposal's path and existing actions

"A draft" is a proposal: a title typed on the New page, a priorities line, or an inbox note, which
becomes a proposal file, then a feature.

1. **New page, Ctrl+Enter** ([`useStartFrom.ts`](/packages/web/src/useStartFrom.ts)): a dialog asks
   the title. Then 4 to 5 sequential round trips: read the priorities, insert the line, expand it
   into a file, read the file, save its text. "Writing the proposal…" shows on the button and the
   top bar.
2. **Page change 1**: the editor at `/edit/<path>`. The New page stays until it draws.
3. **Start feature** ([`ProposalStart.tsx`](/packages/web/src/ProposalStart.tsx),
   [`useEditorActions.ts`](/packages/web/src/useEditorActions.ts)): saves the text if needed, then
   `feature.start`. On the server, under the write lock: a full read, the proposal moved and the
   priorities linked, **one commit on the default branch, which runs the hooks**,
   `git worktree prune`, `git worktree add`, then a full read for the answer
   ([`actions/start/`](/crates/core/src/actions/start/)). The button reads "Starting the feature…".
   Ctrl+Enter and Enter in the slug call the same action directly, and show no label, no bar, and
   block nothing.
4. **Page change 2**: the session page at `/f/<folder>/session?continue=start`. The editor stays
   until the feature is read, then the composer fills a moment later, once the workflow message is
   read ([`HandOver.tsx`](/packages/web/src/HandOver.tsx)).
5. The live fan-out of the start arrives meanwhile: the sidebar gains the new feature's card.
6. **Send** starts the agent: "Starting the agent…" on the card, then the URL drops `?continue`.

Other paths into a draft: `p` on a priorities line expands it with no feedback, then opens the
editor ([`PrioritiesList.tsx`](/packages/web/src/lists/PrioritiesList.tsx)). `p` on a note makes 2
to 4 round trips, then navigates ([`useNoteActions.ts`](/packages/web/src/useNoteActions.ts)).

Other features in flight: the [amend-latest](/specs/done/2026-10-29-amend-latest.md) change will
amend commits of workflow files only. That cuts commit noise, not hook time.
[help-keybindings](/specs/done/2026-10-29-help-keybindings.md) and
[decisions-needs](/specs/2026-10-29-decisions-needs/proposal.md) touch nothing here. All three hold
only their proposal.

### Rules and their owners

- **A git write shows its action, never a guessed status, and blocks other git writes**:
  [UI behaviour](../decisions/ui-behaviour.md), owned by
  [`writes/store.ts`](/packages/web/src/writes/store.ts) and `WriteButton`. The server's
  `write_lock` serializes writes for all repositories.
- **Moves, edits, and reorders are optimistic; a refused write puts the result back and says why
  where it happened**: [space and motion](../ui/space-and-motion.md#speed) and
  [keyboard](../ui/keyboard.md), owned by the outliners in [`lists/`](/packages/web/src/lists/).
- **Workflow logic lives only in the Rust core**: [stack](../decisions/stack.md). A slug's folder, a
  feature's step, and a proposal file's path are the core's, so the client cannot compute them for
  an optimistic result.
- **Tools never bypass the user's hooks**: [git](../decisions/git.md).
- **Only caches and temporary chat state may live in memory**:
  [constitution, principle III](../CONSTITUTION.md#iii-asynchronous-by-default).
- **No unit test depends on elapsed time, except benchmarks of a spec's success criteria**:
  [code quality](../decisions/code-quality.md).
- **New code does not memoize by hand for speed**: [toolchain](../decisions/toolchain.md).

### Likely changes

- [`packages/binding/package.json`](/packages/binding/package.json) and root
  [`package.json`](/package.json): a release build for `start`, under every option.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs),
  [`workspace.rs`](/crates/core/src/workspace.rs), [`watch.rs`](/crates/core/src/watch.rs): a
  workspace kept between reads and invalidated by the watcher, with [a server cache](#server-reads).
- [`packages/server/src/fate.ts`](/packages/server/src/fate.ts),
  [`live.ts`](/packages/server/src/live.ts): no second resolve per subscription; fan-out coalesced.
- [`packages/web/src/sidebar/Cards.tsx`](/packages/web/src/sidebar/Cards.tsx): every card's changes
  in one read, under every option.
- [`packages/web/src/clients.ts`](/packages/web/src/clients.ts),
  [`data.ts`](/packages/web/src/data.ts), [`links.tsx`](/packages/web/src/links.tsx),
  [`routes.tsx`](/packages/web/src/routes.tsx), [`App.tsx`](/packages/web/src/App.tsx): prefetch, a
  larger buffer, a pending cue, lazy routes, with [client caching](#caching-ahead-on-the-client).
- The 88 `fate.mutations` call sites in [`packages/web/src/`](/packages/web/src/), and the settings
  page's 7: `optimistic` results, with [optimistic writes](#optimistic-file-writes).
- [`writes/store.ts`](/packages/web/src/writes/store.ts),
  [`WriteButton.tsx`](/packages/web/src/writes/WriteButton.tsx), and
  [UI behaviour](../decisions/ui-behaviour.md), with option B or C of [git writes](#git-writes).
- [`useStartFrom.ts`](/packages/web/src/useStartFrom.ts),
  [`useEditorActions.ts`](/packages/web/src/useEditorActions.ts),
  [`ProposalStart.tsx`](/packages/web/src/ProposalStart.tsx),
  [`HandOver.tsx`](/packages/web/src/HandOver.tsx),
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx): the start flow.
- Tests that guard timing today:
  [`crates/cli/tests/performance.rs`](/crates/cli/tests/performance.rs),
  [`packages/server/src/__tests__/live.bench.ts`](/packages/server/src/__tests__/live.bench.ts) (a
  commit's live update under 2 s), and the `smoke.ts --timed` first page under 2 s. A tighter budget
  changes their bounds.
- Tests that guard the blocking of git writes: those of [`writes/`](/packages/web/src/writes/) in
  `packages/web/src/__tests__/`, with option B or C of [git writes](#git-writes).

## The proposal

### Where the 10 seconds go

Measured in this session, with Node calling the binding directly, on this repository: 2,719 files,
11 branches, 6 worktrees. Scripts were kept outside the repository. Medians of 5 to 7 runs.

| Read                                   | Debug binding (today) | Release binding |
| -------------------------------------- | --------------------- | --------------- |
| `readWorkspace`                        | 422 ms                | 99 ms           |
| `readFeature`                          | 403 ms                | 93 ms           |
| `readPriorities`                       | 403 ms                | 99 ms           |
| `readInbox`                            | 387 ms                | 101 ms          |
| `readFile`                             | 429 ms                | 84 ms           |
| `readProposalFile`                     | 931 ms                | 193 ms          |
| A fresh worktree's effect on each read | +3.3 s per worktree   | about +10 ms    |

- A read after `git worktree add` took 6.8 s with two fresh worktrees in the debug build, and 0.3 s
  once `git status` had run in each. Each read runs a gix status of every checked-out feature
  ([`workspace/read.rs`](/crates/core/src/workspace/read.rs) `folder_uncommitted`, through
  [`git/status.rs`](/crates/core/src/git/status.rs)). Judgment: gix rehashes every file of a fresh
  worktree and never writes the refreshed index back, and the debug build hashes slowly.
- The core's calls of the draft→feature path, on a clone of this repository, without hooks: **20.7
  s** with the debug binding, **3.3 s** with the release one. Starting itself took 11.4 s and 1.6 s.
- The git commands of a start take about 0.4 s: `git worktree add` 0.23 s, `git commit` 0.01 to 0.2
  s.
- This repository's pre-commit hook, `vp staged`, runs `vp check --fix` on the staged files: 1.2 to
  2.1 s for one markdown file ([`vite.config.ts`](/vite.config.ts)).
- The human's server runs `vp run start` from the main checkout, whose binding is the 188 MB debug
  build.

In the browser, measured by a research agent with Playwright's Chromium against the built UI and the
real server, with the debug binding. The machine was shared with test runs from other worktrees, so
single numbers vary by about 30%. Medians of 3 runs, on the sandbox's sample project of 36 features:

| Page    | Reload, content drawn | Navigation in the app, content drawn | Reads on navigation |
| ------- | --------------------- | ------------------------------------ | ------------------- |
| Home    | 753 ms                | 46 ms                                | 0, from the cache   |
| Inbox   | 1,558 ms              | 37 ms                                | 0                   |
| Feature | 2,155 ms              | 235 ms                               | 4, in 2 steps       |
| Spec    | 2,290 ms              | 600 ms                               | 4, in 3 steps       |
| Session | 1,856 ms              | 209 ms                               | 3                   |
| Editor  | 2,140 ms              | 352 ms                               | 1                   |

- The first paint comes after 40 to 150 ms everywhere: the time goes to data, not to the bundle.
- A reload sends about 40 reads, each also subscribed live by its own request. The per-card
  `BranchChanges` reads hold back the page's own: the feature's read took 336 ms on the server and
  ended after 2 s.
- On this repository, read-only, every read took 870 to 940 ms on the server, and a feature's page
  drew 681 ms after its click.
- The draft→feature path on the sample project took about 4.2 s, with 2 page changes. On a clone of
  this repository with its pre-commit hook, it took about 29 s. A second run, with 4 fresh worktrees
  by then, took about 71 s: every request waited 3.7 to 13.7 s for its first byte.
- The pre-commit hook took 1.7 to 1.9 s per commit, and 3.6 to 10.9 s while the machine was loaded.

Judgment: the debug build and the reads after a fresh worktree explain most of "upwards of 10s".
With a release build, the start would cost about 5 s: 3.3 s of core calls, 1.2 to 2.1 s of hook,
plus the pages.

### What 100 ms means

The proposal says "ideally locally no page takes more than 100ms to load" without saying from where
to where.

- A page from the cache can draw in one frame. A page that suspends waits for its reads, and React
  reveals suspended content at most every 300 ms (see [React 19](#react-19)).
- A read costs about 95 ms on this repository in a release build. Pages chain 2 to 4 reads.
- A navigation to a page whose data is cached already draws in 22 to 46 ms. One that reads draws in
  200 to 700 ms on the sample project, in the debug build.
- A reload parses one bundle of every page before its first request.
- A commit runs the user's hooks, which take what they take.

So 100 ms holds for a navigation from cached or prefetched data, and for the first feedback of any
action. It cannot hold for a cold read, a reload, or a git write.

### Optimistic everywhere, and git writes

The proposal asks for "optimistic UI _everywhere_". The [UI behaviour](../decisions/ui-behaviour.md)
decision says "A git write MUST show its action at once and never a guessed status, and MUST block
other git writes until it ends." It came from the human's request for "EXTREMELY CLEAR feedback" on
commits, which take seconds while hooks run.

File writes are not git writes: saving text, answering, commenting, moving notes and proposals,
settings. They are free to become optimistic within the decisions, and the
[space and motion](../ui/space-and-motion.md#speed) guide already asks for it.

### Caching almost all values ahead of time

The proposal does not say where the cache lives: on the server, in the browser's memory, or on disk
across reloads. Each place has a different cost, and the browser's disk needs a new dependency,
`@nkzw/fate-indexeddb`.

### No clear feedback while moving a draft

Today the feedback is a button's label, which Ctrl+Enter skips, then two page changes, and a
composer that fills a moment after the page. No view names the steps, and the hook's output shows
only when it fails.

## Worth it and feasibility

Worth it, with changes. The release build costs one flag, and it cuts every read by about 4 times
and the start path by about 6 times. A server cache is the only way to the 100 ms target, and the
core already has a watcher that knows when to drop it. Prefetch and optimistic file writes use fate
features already installed. Their cost is mostly the 95 write call sites, each needing its
optimistic shape.

Outside behaviour relied on:

- **fate's optimistic rollback**: documented, not used in the app yet. fate 1.12.2 fixed optimistic
  inserts lost during background refreshes, which live updates cause. Checked in the release notes
  only; the plan's first task should verify it with an upgrade.
- **gix on a fresh worktree**: measured. Why it rehashes is unverified (judgment above). A release
  build makes it small, and refreshing the worktree's index after `git worktree add` may remove it.
  The plan checks it first.
- **React's 300 ms reveal**: documented.
- **Raising libuv's pool** through `UV_THREADPOOL_SIZE`: documented by Node, not measured here.

No guard is relaxed. Optimistic git writes (option C of [git writes](#git-writes)) would show a
commit as done before the hook passed. An attacker gains nothing, but the human could act on a
commit a hook later refuses.

## Approaches

Criteria: the [proposal](proposal.md)'s 100 ms target and feedback; the
[constitution](../CONSTITUTION.md) (state in git, only caches in memory); the
[stack](../decisions/stack.md), [git](../decisions/git.md),
[UI behaviour](../decisions/ui-behaviour.md), [toolchain](../decisions/toolchain.md), and
[testing](../decisions/testing.md) decisions; the cost of the change.

### Server reads

How reads get under 100 ms. Relies on [where the 10 seconds go](#where-the-10-seconds-go).

| Option                                                                           | Read cost                                 | Freshness                                 | Cost                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| A. Release build only                                                            | about 95 ms each, chained 2 to 4 per page | always fresh                              | one flag; release builds take about 1 min     |
| B. Release build, plus the workspace kept in memory and dropped by the watcher   | a few ms from memory, about 95 ms once    | stale until the watcher's 200 ms debounce | a cache in the core, its invalidation by area |
| C. B, plus each feature and file kept apart, so a change rereads only its branch | a few ms; a change rereads one branch     | same as B                                 | the workspace read split by branch            |

### Caching ahead on the client

What the browser holds before the click. Relies on [fate](#fate-1121) and
[GitHub Issues](#github-issues).

| Option                                                                                   | Navigation                  | Reload                          | Cost                                        |
| ---------------------------------------------------------------------------------------- | --------------------------- | ------------------------------- | ------------------------------------------- |
| A. Prefetch links on hover and focus, and the likely next pages, kept in a larger buffer | from memory once prefetched | as today                        | `fate.request` and `retain`; no dependency  |
| B. A, plus fate's persistence in IndexedDB                                               | same                        | the last data, then revalidated | `@nkzw/fate-indexeddb`; a stale first frame |
| C. Nothing on the client; the server cache alone                                         | one round trip of a few ms  | as today                        | none                                        |

### Navigation feedback

What shows while a page is not drawn. Relies on [React 19](#react-19) and
[`useRoute`](#important-reads).

| Option                                                    | Under 100 ms | Slower                 |
| --------------------------------------------------------- | ------------ | ---------------------- |
| A. The old page stays; the thin top bar runs after 100 ms | nothing      | the bar, then the page |
| B. As today: the old page stays, nothing shows            | nothing      | nothing, then the page |
| C. A skeleton of the new page at once                     | a flash      | the skeleton           |

### Optimistic file writes

Which writes show their result before the server answers. Relies on
[optimistic pitfalls](#optimistic-ui-pitfalls) and [the stack rule](#rules-and-their-owners).

| Option                                                                            | Coverage            | Values the core computes                     |
| --------------------------------------------------------------------------------- | ------------------- | -------------------------------------------- |
| A. Every file write, through fate's `optimistic`, with rollback where it happened | about 80 call sites | shown as the action until the server answers |
| B. Only the writes the human repeats: lists, answers, comments, settings          | about 40            | same                                         |
| C. As today: the outliners and a review comment                                   | about 10            | n/a                                          |

### Git writes

How a commit shows while it runs. Relies on
[optimistic everywhere, and git writes](#optimistic-everywhere-and-git-writes) and
[VS Code](#vs-code).

| Option                                                                              | Decision                             | Navigation during a write | A failing hook                     |
| ----------------------------------------------------------------------------------- | ------------------------------------ | ------------------------- | ---------------------------------- |
| A. Its action at once, on its button and its card; other git writes queue behind it | rule changed: queue instead of block | free                      | its output where it happened       |
| B. As today: its action at once, other git writes blocked                           | unchanged                            | free                      | same                               |
| C. Its result at once, as if done, rolled back if a hook refuses                    | rule removed                         | free                      | the result disappears, with output |

### The start flow

How a draft becomes a feature. Relies on
[the proposal's path](#the-proposals-path-and-existing-actions) and
[Codespaces](#github-codespaces).

| Option                                                                                        | Page changes  | Feedback                         |
| --------------------------------------------------------------------------------------------- | ------------- | -------------------------------- |
| A. Start lands at once on the feature's session, which lists the start's steps until they end | 1             | each step, its time, hook output |
| B. The editor shows the steps, then opens the session once done                               | 1, at the end | same, on the editor              |
| C. As today, only faster                                                                      | 2             | the button's label               |
| D. On top: starting straight from the New page's dialog, title and slug, skipping the editor  | 1 fewer       | same as the option it adds to    |

### Guarding the budget

How the target is kept once reached. Relies on [response-time limits](#response-time-limits) and the
[code quality](../decisions/code-quality.md) rule on elapsed time.

| Option                                                                             | Catches a regression | Cost                                 |
| ---------------------------------------------------------------------------------- | -------------------- | ------------------------------------ |
| A. A benchmark over the sandbox, run on demand, and a dev-only warning past 100 ms | when run, or seen    | a script; no CI time                 |
| B. A, plus the benchmark in `vp run ready`, with a margin                          | before every push    | browser time in every `ready`; noise |
| C. No guard: a one-time pass                                                       | never                | none                                 |

### Needs no choice

- **Rollback where it happened**: the [space and motion](../ui/space-and-motion.md#speed) guide
  already says a refused write puts the result back and says why where it happened.
- **Hook output on failure**: the core already returns it with a `hook:` refusal
  ([`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs)). Showing it live is part of
  [the start flow](#the-start-flow).
- **Commit anyway, without hooks**: GitHub Desktop offers it; the [git](../decisions/git.md)
  decision forbids bypassing hooks.
- **A local database or sync engine**: none fits a git source of truth without replacing fate (see
  [sync engines](#sync-engines)).
- **Code splitting by route**: lowers the reload's parse time, with no behaviour to choose.
- **The server's double resolve and coalesced fan-out**: fixes in the code, with nothing visible to
  choose.
- **The sidebar's per-card reads**: one read for every card's changes is a fix in the code, with
  nothing visible to choose.

## Not checked

- Why gix does not keep a fresh worktree's refreshed index: traced to the status call, not into gix
  itself.
- Browser timings with a release binding: only the binding's calls were measured in release.
- Long tasks and main-thread time per page: no CPU profile was taken.
- The Linear sync-engine talk itself; only Linear's blog and the unofficial write-up were read.
- Whether `useLiveView` subscribes in an Effect, which decides whether a hidden `<Activity>` page
  stays live.
- Whether fate 1.12.2's fix covers live refreshes of the app's own views.
- lazygit's and Fork's handling of hooks and progress.
- A published benchmark of `git worktree add` or of git's process cost.
