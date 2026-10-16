# Rulings: Redesign sidebars and global interface

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The pull requests' snapshot is a cache in the core, not a parameter of every read

- **Decision**: the core keeps the latest `PullRequests` snapshot per repository in memory,
  refreshed by `refresh_pull_requests(repo)`, which runs `gh`; `Workspace::read` reads it. The
  spec's `Workspace::read(repo, &PullRequests)` becomes this cache.
- **Rationale**: the server reads the workspace from 13 call sites and the watcher, and the CLI from
  `output::workspace()`; one refresh call keeps them all on the same snapshot without changing each
  binding signature. The constitution allows caches in memory (principle III).
- **Alternatives considered**: a snapshot argument on `readWorkspace`, `readFeature`, `nextStep`,
  and the watcher: the same behaviour, with every caller and the binding changed.
- **If wrong**: a parameter replaces the cache's lookup in `Workspace::read`; the refresh stays.
- **Where**: task 2.

## R2: Names and colours are joined to features by the server

- **Decision**: the server reads the repository's entry, `readRepositories(dataDir)`, and sets
  `label` and `color` on each feature record it sends; the core's `FeatureView` does not carry them.
- **Rationale**: the core's reads take only the repository's path, and the data folder the server
  uses is its own (`ctx.dataDir`, a temporary one in tests); reading the default folder from the
  core would read the user's real list in tests.
- **Alternatives considered**: a `data_dir` argument on every core read: more churn for a join.
- **If wrong**: the join moves into the core with a `data_dir` argument; records keep their fields.
- **Where**: tasks 3 and 4.

## R3: A branch whose proposal was never committed is no item

- **Decision**: the approved [git](../decisions/git.md) rule counts a branch only with its folder or
  record in its latest commit, so a branch where `proposal.md` was written but never committed is
  not listed by `ura status` or the UI until it is. The CLI test `uncommitted_proposal_waits_on_you`
  becomes a test of its absence.
- **Rationale**: the decision's rule is explicit; `ura start` and the web UI always commit the
  proposal, so only a hand-made branch meets this case.
- **Alternatives considered**: an exception for an uncommitted `proposal.md` on disk: against the
  decision's wording.
- **If wrong**: the human amends the decision; the core's item rule gains the exception.
- **Where**: task 1.

## R4: A step is read from the commit's texts, while pages keep the disk's

- **Decision**: a branch checked out in a worktree is read twice: its texts from disk, for its
  pages, `uncommitted`, `ura check`, and `waiting`; its step from its latest commit's texts.
- **Rationale**: the [git](../decisions/git.md) rule reads the workflow's state from commits, while
  file pages must still show uncommitted edits (`api::file_view`).
- **Alternatives considered**: commit texts everywhere: file pages, `waiting`, and `ura check` would
  lose uncommitted edits.
- **If wrong**: the step's second read is removed.
- **Where**: task 1.

## R5: Dark mode in browser tests is emulated

- **Decision**: browser tests and screenshot scripts set the colour scheme with Playwright's
  `emulateMedia`, through a command of their own, instead of writing `uraeda.theme`.
- **Rationale**: the theme now follows the system only (Q7), so the stored key is no longer read.
- **Alternatives considered**: keeping a hidden reader of the old key for tests: a path users cannot
  reach.
- **If wrong**: the settings page brings a stored choice back; tests may use it again.
- **Where**: task 8.
