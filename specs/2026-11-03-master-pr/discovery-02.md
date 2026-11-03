# Discovery, round 02: "Master" PR

## Why this round

In
[round 01](clarifications-01.md#q1-how-should-pull-requests-built-in-parallel-land-on-the-default-branch),
the human picked the integration pull request, in their own words: "Keep one PR per feature but as
soon as a feature opens a PR after another one, also start a master PR that holds all features and
merges neatly", as "an option in settings". This leaves open how the master pull request merges,
what it holds, where its agent runs, and where the option lives. The other answers of round 01 are
settled and need nothing new.

## Summary

A master pull request is a branch built from the default branch by merging every feature's branch
into it, its conflicts resolved there once. GitHub marks a pull request as merged when its head
commits reach the base branch through another pull request, so merging the master pull request with
a merge commit can close every feature's pull request at once. Its agent needs a worktree and
sessions, which the agents decision gives only to features and changes. The option the human asked
for meets the settings decision, which keeps settings out of repositories, and principle V, which
asks that an agent without Uraeda's tools can follow the workflow.

## How other products do it

### GitHub indirect merges

- "A pull request can be marked as merged if its head branch commits become reachable from the base
  branch outside that pull request. This can happen when the same commits are merged through another
  pull request or pushed directly to the default branch."
  ([about pull request merges](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges))
- "Pull requests merged indirectly are marked as `merged` even if branch protection rules on that
  pull request were not satisfied." (same page)
- A rebase merge "creates new commit SHAs" and a squash merge does not keep the commits (same page).
  The feature's head commits then never reach the base branch: a judgement from those two sentences,
  since the page does not say it.

### Merge queues and `spr`

- GitHub's merge queue builds the same kind of branch, the base plus the pull requests ahead, but
  tests it and merges each pull request in turn ([round 01](discovery-01.md#github-merge-queue)). It
  is not available here.
- `git spr merge` merges every pull request up to the top mergeable one as a single pull request,
  and closes the others ([spr](https://github.com/ejoffe/spr)): the closest product to the master
  pull request.

### What they have in common

- **One merge for many pull requests**, with the others closed as merged or closed.
- **The combined branch built by a tool**, never by hand.

## Standards and libraries

### `git merge` of feature branches

- Merging each feature branch, unchanged, into the master branch keeps their commits' hashes, which
  is what an indirect merge needs. Rebasing them would give new hashes. See
  [`git merge-tree` and `git rebase`](discovery-01.md#git-merge-tree-and-git-rebase) for round 01's
  checks.

## The code

### Important reads

- [Agents decision](/specs/decisions/agents.md): "Every conversation with an agent MUST be a
  session, run in the worktree of its change or feature." A master pull request is neither.
- [Settings decision](/specs/decisions/settings.md): settings live in one TOML file of the config
  folder, for every repository at once, and "MUST NOT … be read from a repository".
- [Constitution](/specs/CONSTITUTION.md), principle V: "The workflow MUST work with any agent, with
  or without the uraeda CLI, web UI, or remote workers." An agent run by hand reads the repository,
  not Uraeda's settings file.
- [Finish](/skills/uraeda/references/finish.md#mark-the-pull-request-ready): advises a rebase merge,
  or a merge commit; a squash merge loses the folder's history. A rebase merge of the master pull
  request would leave every feature's pull request open.
- [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs): already reads merged pull requests, so a
  feature merged through the master reads as merged, with its number.
- [Round 01's code map](discovery-01.md#the-code): the step table, the catch-up, and the finish.

### The proposal's path and existing actions

- **Two features ready**: Feature state and Proposal start each have a ready pull request. The
  master pull request merges both branches into a branch from the default branch, resolving their
  conflicts in the merge commits.
- **A third feature becomes ready**: it is merged into the master branch too.
- **Changes requested on one feature's pull request**: the feature goes back to its agent. Its
  branch changes, so the master branch must take the new commits, or leave the feature out.
- **The human merges one feature's pull request directly**: the master branch holds it already, and
  is rebuilt from the default branch.
- **The default branch moves**, by a change merged alone: the master branch merges it in.
- **A feature built on another** (round 01's answer): it waits at its draft until the other merges,
  so it joins a later master pull request.

### Likely changes

Beyond [round 01's](discovery-01.md#likely-changes):

- The skill: a reference, or a section of [finish](/skills/uraeda/references/finish.md), for
  building and rebuilding the master, and a row of the step table, in
  [SKILL.md](/skills/uraeda/SKILL.md) and [`steps.rs`](/crates/core/src/steps.rs).
- The core: reading the master's state, from its branch and `gh`, beside
  [`pulls.rs`](/crates/core/src/pulls.rs).
- With its own worktree: the server's runner and the web UI's sidebar, for a new kind of item.
- The option: the settings page, and wherever it is stored.

## The proposal

### The master pull request, as answered

The answer settles the approach, not its parts: what merging means for the features' pull requests,
what joins, where the agent works, and where the option lives. Each is a question of this round.

## Approaches

### Merging the master pull request

| Option                                                        | Feature pull requests       | History                 |
| ------------------------------------------------------------- | --------------------------- | ----------------------- |
| A. The human merges the master, with a merge commit           | marked merged by GitHub     | merge commits           |
| B. The human merges features one by one; the master proves it | merged one by one           | linear, by rebase merge |
| C. The human merges the master by rebase                      | left open, closed by a tool | linear                  |

### What joins the master pull request

Ready pull requests only, or drafts too. A draft has passed its final review, but has no record yet,
and merging the master merges whatever it holds.

### Where the master's agent runs

A worktree and a branch of its own, which needs the agents decision to name it, or the worktree of
the feature that joined last, which needs no change.

### Where the option lives

| Option                            | Agents without Uraeda | Decision it meets              |
| --------------------------------- | --------------------- | ------------------------------ |
| A. In the repository, per project | see it                | settings: not read from a repo |
| B. In the settings file, for all  | do not see it         | principle V: tools optional    |

### Needs no choice

- **Rebuilding**: when a feature leaves or changes, the master branch is rebuilt from the default
  branch and the features in it, deterministic and cheap with `git merge`.
- **Validation**: the project's complete validation runs on the master branch before it waits for
  the human, as on any branch.

## Not checked

- Whether GitHub marks a pull request merged when its commits reach the default branch through a
  rebase merge: the page does not say. Judged not, since a rebase merge gives new hashes.
- A real indirect merge on this repository: no pull request is open, and opening one to test is an
  outside action.
