# Discovery, round 01: "Master" PR

## Summary

Several features built in parallel each end in a pull request against the default branch. Tools that
deal with this fall in three families: stacks, where a branch is built on another one and rebased
when it moves (`gh stack`, Graphite, git-town); merge queues, which test each pull request merged
with the ones ahead of it before merging (GitHub's merge queue, Graphite's); and, for shared files
every branch edits, one file per entry instead of one shared file (changesets, towncrier, reno,
GitLab's changelog). Git also offers merge drivers per file, and `git merge-tree` to see a conflict
without merging.

The proposal asks for all pull requests to merge smoothly, for fewer conflicts on workflow files,
and for a feature to be startable after the ones in flight. Today, the workflow catches a branch up
once, at its final review, and never again: a pull request left behind by another's merge waits for
the human, who finds the conflict on GitHub. Replaying this repository's merges shows that half the
conflicts touched only workflow files, `PRIORITIES.md`, `INBOX.md`, and the records, each for a
structural reason: every branch edits the same lines of a shared file.

## How other products do it

### GitHub stacked pull requests and `gh stack`

- `gh stack` is GitHub's own extension, `github/gh-stack`, installed with
  `gh extension install github/gh-stack`, and needs git 2.36 or later. It creates one pull request
  per branch of a stack, and `sync` fetches, rebases the stack in cascade, and pushes with
  `--force-with-lease` per branch ([gh-stack](https://github.com/github/gh-stack)). The local gh
  2.103.3 names it as "available as an official extension".
- `rebase` switches to `--onto` once a branch's pull request is merged, and v0.3.0, of 26 October,
  moves a stack onto the default branch when its base branch is deleted after merging
  ([releases](https://github.com/github/gh-stack/releases)).
- On GitHub, each pull request of a stack targets the branch below it. Reviews and checks are
  evaluated against the stack's base, and one merges only when every one below it can. A "Rebase
  stack" button rebases on the server, and merging the bottom one rebases the rest
  ([stacked pull requests](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)).
  Same-repository branches only. Whether the feature is out of preview is not stated on the pages
  read.
- Without stacks, GitHub retargets an open pull request onto the merged one's base when its base
  branch is merged and deleted
  ([changelog, 2020](https://github.blog/changelog/2020-05-19-pull-request-retargeting)). This
  repository deletes head branches on merge (`delete_branch_on_merge: true`, read with `gh api`).

### Graphite

- Graphite records each branch's parent, which git does not. `gt restack` rebases every branch on
  its parent's current version, pausing on a conflict, and leaves alone branches checked out in
  other worktrees ([restack](https://graphite.com/docs/restack-branches)).
- `gt sync` pulls the trunk, offers to delete merged branches, and restacks what it can without
  input, leaving conflicting branches for a manual restack
  ([sync](https://graphite.com/docs/sync-with-a-remote-repo)).
- Its merge queue is stack-aware, and incompatible with GitHub's
  ([merge queue](https://graphite.com/docs/graphite-merge-queue)).

### git-town

- `git town sync` updates a branch from its parent, a whole stack with `--stack`, and removes a
  merged parent's commits from its children ([sync](https://www.git-town.com/commands/sync)).
- Its guidance for stacks: ship the oldest branch first, sync often, enable `rerere`, and keep
  branches independent where possible. Squash merges give new hashes, which cause "phantom
  conflicts" it resolves ([stacked changes](https://www.git-town.com/stacked-changes)).

### spr, ghstack, git-branchless

- `spr` turns each commit into a pull request, and `git spr merge` merges everything up to the top
  mergeable one as one pull request ([spr](https://github.com/ejoffe/spr)).
- `ghstack` lands its stacks with its own `ghstack land`, not the merge button
  ([ghstack](https://github.com/ezyang/ghstack)).
- git-branchless's `git sync` rebases every stack onto main and skips the ones that would conflict
  ([git sync](https://github.com/arxanas/git-branchless/wiki/Command:-git-sync)).

### GitHub merge queue

- It groups each queued pull request with the latest base branch and the pull requests ahead of it,
  runs the required checks on that group, and merges once they pass. A failing one is removed, and
  the groups behind it rebuilt
  ([managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)).
- It is available "in any public repository owned by an organization, or in private repositories
  owned by organizations using GitHub Enterprise Cloud" (same page). This repository is owned by a
  user account (`owner.type: User`), so it cannot use one.
- Workflows need an `on: merge_group` trigger, or the required check never reports (same page). This
  repository's [CI](/.github/workflows/ci.yml) has none.

### Keeping a pull request up to date on GitHub

- "Update branch" merges or rebases the base into a pull request, only when there is no conflict
  ([keeping in sync](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/keeping-your-pull-request-in-sync-with-the-base-branch)).
- Without "Require branches to be up to date", checks "may fail after merging if the changes
  conflict with the base branch"
  ([protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).
  This repository has no branch protection, and its one ruleset is disabled.
- Auto-merge merges a pull request once its reviews and checks pass; GitHub's optional "Agent Merge"
  fixes conflicts first
  ([auto-merge](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)).

### One file per entry: changesets, towncrier, reno, GitLab

- GitLab's single changelog, edited by every merge request, "quickly became a major source of
  delays". They moved to one file per entry in an unreleased folder, compiled at release
  ([GitLab's changelog crisis](https://about.gitlab.com/blog/2018/07/03/solving-gitlabs-changelog-conflict-crisis/)).
- towncrier keeps news fragments as files "rather than … one single file which developers all write
  to and produce merge conflicts" ([towncrier](https://towncrier.readthedocs.io/en/stable/)).
- reno's design goal is to "avoid merge issues", with one uniquely named file per note
  ([reno design](https://docs.openstack.org/reno/latest/user/design.html)).
- changesets writes one `.changeset/<id>.md` file per change, compiled by `changeset version`
  ([changesets](https://github.com/changesets/changesets/blob/main/docs/detailed-explanation.md)).

### Coding agents in parallel

- Claude Code's worktrees branch from the remote default branch, and its docs give no guidance on
  merging them back ([worktrees](https://code.claude.com/docs/en/worktrees)). Its agent teams advise
  that "each teammate owns a different set of files"
  ([agent teams](https://code.claude.com/docs/en/agent-teams)).
- Codex's worktrees give no guidance on conflicts either
  ([Codex worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)).

### What they have in common

- **Detect before the human**: a queue or a sync finds the conflict, not the person merging.
- **Order**: stacks merge oldest first, and the tools rebase the rest when one lands.
- **A parent per branch**, recorded by the tool, since git does not.
- **Shared files avoided**: a new file per entry, compiled later.
- **Merging is the human's**, except in a queue, where the human's approval queues it.

## Standards and libraries

### Merge drivers and `merge=union`

- `merge=union` "take[s] lines from both versions … This tends to leave the added lines in the
  resulting file in random order", with "do not use this if you do not understand the implications"
  ([gitattributes](https://git-scm.com/docs/gitattributes)).
- A custom driver is named in the committed `.gitattributes`, and defined in `.git/config` or the
  user's config, so every clone sets it up (same page).
- Checked in a throwaway repository, git 2.56: with `merge=union` on `INBOX.md`, the default branch
  removing a note while a branch adds one after it merges without conflict, and **puts the removed
  note back**, by merge and by rebase alike. An undefined driver named in `.gitattributes` falls
  back to the ordinary merge, with conflict markers.
- GitHub's merge button and conflict check run on GitHub, which has no access to a driver defined in
  the user's config: a judgement, not stated on a page read.

### `git merge-tree` and `git rebase`

- `git merge-tree --write-tree <a> <b>` merges without a worktree or index, exits 1 on a conflict,
  and lists the conflicting files with `--name-only`; git 2.38 or later
  ([git merge-tree](https://git-scm.com/docs/git-merge-tree)). It produced the table of
  [the proposal's path](#the-proposals-path-and-existing-actions).
- `git rebase --update-refs` moves the branches stacked on the rebased commits, but not those
  checked out in a worktree ([git rebase](https://git-scm.com/docs/git-rebase)), which every Uraeda
  feature is.
- Checked in a throwaway repository: branch B built on A; A rebased and fast-forwarded into main;
  `git rebase main` on B dropped A's copies as already applied, leaving B's one commit. When A's
  commits change before landing, the copies differ, and `git rebase --onto main <old A>` is needed.
- `git rerere` replays recorded resolutions, from a cache local to the repository
  ([git rerere](https://git-scm.com/docs/git-rerere)): it does not travel between agents' clones.

### `gh` pull request fields

- `gh pr view --json` offers `mergeable` and `mergeStateStatus` (gh 2.103.3, `gh pr view --help`).
  `gh pr update-branch` merges the base into a pull request, or rebases with `--rebase`.

## The code

### Important reads

- [Finish](/skills/uraeda/references/finish.md): the last commit of every branch writes a record in
  `specs/done/`, deletes the folder, rewrites the links into it, edits older records'
  `superseded-by`, and removes the feature's proposal from `PRIORITIES.md`. Only the record is a new
  file: every other edit lands in files the default branch also edits.
- [Catch up with the default branch](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch):
  runs once, at the final review, before the draft pull request. It rebases on the default branch
  and pushes with `--force-with-lease`. Its conflict rules name `PRIORITIES.md` ("take the default
  branch's version, with this feature's proposal kept"), decisions, and code. It names neither
  `INBOX.md` nor the records of `specs/done/`.
- [Mark the pull request ready](/skills/uraeda/references/finish.md#mark-the-pull-request-ready):
  catches up again only if the default branch moved before the pull request is marked ready. Nothing
  in the workflow catches up after that: once another pull request merges, the ready one may
  conflict, and the step table still reads it as waiting on the human.
- [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs): reads the pull requests with
  `gh pr list --json headRefName,headRefOid,number,url,isDraft,reviewDecision`. It never reads
  `mergeable` or `mergeStateStatus`, which `gh` offers (`gh pr view --help`, gh 2.103.3), so no view
  knows that a pull request conflicts or is behind.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): reads with gix and writes through `git`, as
  the [git decision](/specs/decisions/git.md) requires. It has a `merge_base`, and no merge or
  conflict detection.
- [Start](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature): every
  start moves its proposal to the top of **Now**, after the other started proposals, on the default
  branch, and branches from there. A feature always starts from the default branch: there is no way
  to start one on top of another feature in flight.
- [Agents' notes](/skills/uraeda/references/inbox.md#agents-notes): an agent's note is written on
  its own branch, at the end of its category in `INBOX.md`, and reaches the default branch with the
  merge. The [git decision](/specs/decisions/git.md) makes it a rule: "An agent's inbox notes MUST
  be written in its own worktree, never on the default branch."
- [Commits](/skills/uraeda/references/conventions.md#commits): `ura` and the web UI amend the
  human's latest `chore:` commit of `INBOX.md` and `PRIORITIES.md` on the default branch. That keeps
  the history short, and does not change what conflicts.
- [`vite.config.ts`](/vite.config.ts), line 135: `proseWrap: "always"` re-wraps every markdown
  paragraph at 100 columns. A link that changes length, like a moved-link repair, re-wraps the rest
  of its paragraph, so two branches touching one sentence each conflict on the whole paragraph.
- [`.gitattributes`](/.gitattributes): holds only `fixtures/** -text`. No merge driver is set for
  any file.
- [`packages/binding/index.d.ts`](/packages/binding/index.d.ts) and `index.js`: generated by napi-rs
  and committed. Two branches that each add a binding function conflict there, though regenerating
  them settles it.

### The proposal's path and existing actions

The conflicts the proposal names were replayed: each merge commit of the default branch since
2026-10-15 was merged again with `git merge-tree --write-tree --name-only` (git 2.56), listing the
files that conflicted. Most branches were rebased rather than merged, and a rebase leaves no trace
of its conflicts, so these are a lower bound.

| Merge into the branch                                 | Workflow files that conflicted                                   | Code files |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ---------- |
| `5e837709`, main into mockup-previews                 | `INBOX.md`, `PRIORITIES.md`                                      | 0          |
| `4d9c04c2`, main into proposal-start                  | `done/2026-10-20-merge-chats.md`                                 | 1          |
| `aaac5abd`, main into mockup-previews                 | `PRIORITIES.md`                                                  | 0          |
| `29890fcb`, main into proposal-start                  | `PRIORITIES.md`, `done/…performance-pass.md`, a decision, a ref. | 28         |
| `4903fa44`, main into mockup-previews                 | `done/2026-10-30-inbox-again.md`                                 | 1          |
| `7125377f`, main into commits-shouldn                 | `done/2026-10-30-inbox-again.md`                                 | 0          |
| `266b867b`, main into feature-state                   | `INBOX.md`, `PRIORITIES.md`, `done/2026-10-30-inbox-again.md`    | 0          |
| `13a410ac`, main into inbox-again                     | `INBOX.md`                                                       | 0          |
| `4d55fd53`, main into performance-pass                | a decision                                                       | 8          |
| `4933cdce`, main into performance-pass                | `PRIORITIES.md`                                                  | 0          |
| `4419ed60`, main into help-keybindings                | `PRIORITIES.md`, two proposals                                   | 0          |
| `701f9dd3`, main into spec-page                       | `PRIORITIES.md`, `done/2026-10-20-layout-look.md`                | 20         |
| `058726fe`, fix-testing into ui-sandbox               | `INBOX.md`, a plan and rulings                                   | 5          |
| `0986f11b`, `04435824`, `389ffda4`: three more merges | `INBOX.md`, `PRIORITIES.md`, a decision                          | 1          |

Of the 43 merge commits since 2026-10-15, 21 conflicted, and 11 of those only in `specs/` and
`skills/`, with no code file: the table lists the merges of a branch into another. What each
conflict was:

- **`PRIORITIES.md`**: every start inserts a line among the started proposals at the top of **Now**,
  on the default branch. Every finish removes its own line, on its branch. A removal next to another
  feature's inserted line conflicts: in `266b867b`, the branch removed "Reading and layout pass"
  while the default branch had added "Feature state pass" on the next line.
- **`INBOX.md`**: an agent's notes go at the end of their category, on its branch. Another branch's
  notes, or the human's, go at the same end, on the default branch. Both sides adding after the same
  line conflicts, though neither removes anything: `266b867b` held four notes of feature-state
  against one of reading-pass.
- **Records in `specs/done/`**: records are frozen, but for link repairs and `superseded-by`. Each
  branch's catch-up runs `ura check --fix`, and the default branch repairs the same links when
  another feature finishes. Two repairs of nearby links, re-wrapped at 100 columns, conflict on the
  whole paragraph: in `266b867b`, a link to `changes/2026-10-30-reading-pass/proposal.md` was
  repaired on one side, while a nearby link moved on the other.

Other paths that meet the feature:

- **Dependent features**: proposal-start needed feature-state, not merged yet. Its agent merged the
  other branch into its own, `4912c023`, and ruled it: "catch up with main by a merge, as Feature
  state is not merged yet" (`0f405b19`). Its pull request then held both features' commits until
  feature-state merged. Nothing in the workflow describes this case.
- **Merging in sequence**: on 2026-10-30, eleven pull requests merged in one day (#68 to #80). Each
  one merged can leave the next ones conflicting, and only the human notices, on GitHub.
- **Rebase merge, advised by Finish**: a rebase merge gives every commit a new hash on the default
  branch. A branch built on top of another feature's branch then holds the old copies, and a plain
  rebase replays them again.
- **Postpone**: merges its branch into the default branch, so it meets the same conflicts.
- **Changes**: a [change](/skills/uraeda/references/change.md) ends with the same finish and record,
  so everything above applies to changes too.

Other features in flight: none. `gh pr list --state open` lists no pull request, and every remote
branch but this one is merged (#62 to #87).

### Rules and their owners

- **Who writes `PRIORITIES.md` and `INBOX.md`**: the [git decision](/specs/decisions/git.md) says
  the human's inbox and priorities are written on the default branch, and agents' notes in their own
  worktree. The finish step's removal of the proposal is the only write of `PRIORITIES.md` on a
  branch ([Finish](/skills/uraeda/references/finish.md#the-finishing-commit)).
- **No force-push by tools**: the [git decision](/specs/decisions/git.md) forbids it to tools. The
  skill's catch-up asks the agent for `--force-with-lease` after a rebase. A tool that rebases a
  pushed branch for the agent would need that push, which the decision rules out today.
- **When a pull request waits on the human**: one place, the
  [feature status decision](/specs/decisions/feature-status.md): a pull request reads as ready only
  when it holds the branch's latest commit. It says nothing of the default branch moving under it.
- **The step table**: [SKILL.md](/skills/uraeda/SKILL.md#finding-the-next-step) and its copy in the
  core, [`crates/core/src/steps.rs`](/crates/core/src/steps.rs). A new row, such as "the pull
  request conflicts with the default branch", goes into both.

### Likely changes

Under every option:

- The skill: [finish](/skills/uraeda/references/finish.md),
  [implementation](/skills/uraeda/references/implementation.md),
  [inbox](/skills/uraeda/references/inbox.md), [projects](/skills/uraeda/references/projects.md),
  and [SKILL.md](/skills/uraeda/SKILL.md), with their templates and the example, which must agree.
- The record template, `assets/templates/specs/done/YYYY-MM-DD-feature-slug.md`, if follow-ups
  change.

With a step for a pull request left behind:

- [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs): read `mergeable` and `mergeStateStatus`.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): a row for a pull request that conflicts,
  or is behind.
- The server's feature status and the web UI's labels, which read the step.

With features started on top of another:

- `ura start` ([`crates/core/src/actions/start/`](/crates/core/src/actions/start/)), the web UI's
  New page, and the branch's base, stored somewhere a later agent finds it.

With a merge driver:

- `.gitattributes` in the project, written by `ura init`, and the driver itself, a `ura` command.

With branches that no longer touch `PRIORITIES.md`:

- The finishing commit, and `ura clean` or the Home, which would drop or hide the line of a merged
  feature.

Tests that guard behaviour these change: the finish's removal from `PRIORITIES.md` is described in
the skill only, and no core test was found for it. `crates/core/tests/pulls.rs` guards the pull
request's states, and `crates/cli/tests/next.rs` the step table.

## The proposal

### "Master" PR is not defined

The title names a "Master" PR, and the text asks to "make sure all PRs can merge smoothly". It can
mean one pull request gathering every feature ready to merge, or each pull request kept mergeable
after the others. The two lead to different designs: see [the approaches](#approaches).

### "Selectable at feature start time"

The proposal suggests choosing, when a feature starts, whether it goes after the features in flight.
That makes the new branch depend on another one, so it is merged after it, and catches up onto it
rather than onto the default branch. That is a stack.

### Which files count as "mundane"

The proposal names the inbox and the priorities. The replay finds a third, the records of
`specs/done/`, and a cause under all three: paragraphs re-wrapped at 100 columns.

### This project's own setup, or every project's

The re-wrap setting and the generated binding files are this repository's, not the workflow's. A
user's project may wrap differently, or not at all.

## Worth it and feasibility

**Worth it.** The cost is a day's agent work for the workflow files: the skill, the finish, and a
few writes in the core. Detecting a pull request left behind adds a field to `gh`'s read, a
`merge-tree` call, and a row of the step table. The gain is measured: 21 of 43 recent merges
conflicted, 11 on workflow files alone, and every one cost the human or an agent a resolution.
Starting a feature on top of another is cheap with a plain branch, and costly with stacked pull
requests, which need GitHub's preview feature or `gh stack`.

**Outside behaviour relied on:**

- `git merge-tree --write-tree`: checked, git 2.56, on this repository's merges.
- Rebasing a branch after its parent's rebase merge: checked in a throwaway repository.
- `merge=union` putting back removed lines: checked.
- `gh pr view --json mergeable,mergeStateStatus`: the fields exist (`--help`); their values right
  after a merge were not observed, since no pull request is open. GitHub computes `mergeable` in the
  background, so it can read `UNKNOWN` for a moment: unverified, the plan's first task checks it.
- GitHub stacked pull requests' status, preview or general: unverified.

**Guards relaxed:** none. A tool that force-pushes would loosen the
[git decision](/specs/decisions/git.md)'s "no force-push": no option needs it, since the agent, not
`ura`, rebases and pushes, as the catch-up already does.

## Approaches

Criteria: the proposal (smooth merges, fewer conflicts on workflow files, a choice at start); the
constitution's [principle I](/specs/CONSTITUTION.md), humans decide and merge; principle V, tools
optional, every rule followable by hand; the [git decision](/specs/decisions/git.md); the
[feature status decision](/specs/decisions/feature-status.md).

### Landing parallel pull requests

How several ready pull requests reach the default branch. Relies on
[GitHub merge queue](#github-merge-queue) and
[the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                 | Human's work           | By hand            | New machinery                    |
| ------------------------------------------------------ | ---------------------- | ------------------ | -------------------------------- |
| A. A step catches up any pull request left conflicting | merge, in any order    | yes                | a field, `merge-tree`, a row     |
| B. One integration pull request of all ready features  | review each, merge one | yes, one more step | a branch and a step              |
| C. A merge train: Uraeda merges approved ones in order | approve; Uraeda merges | no, a tool merges  | a queue, merges by the tool      |
| D. GitHub's merge queue                                | queue                  | yes                | not available on user-owned repo |

### When a pull request counts as left behind

Only with A or C of [landing](#landing-parallel-pull-requests): on a conflict only, or whenever the
default branch moved. Each merge would trigger a catch-up of every other open pull request with the
second.

### Starting a feature after another

Relies on [GitHub stacked pull requests](#github-stacked-pull-requests-and-gh-stack) and
[`git rebase`](#git-merge-tree-and-git-rebase).

| Option                                                 | Review on GitHub             | Tools needed   | After the first merges            |
| ------------------------------------------------------ | ---------------------------- | -------------- | --------------------------------- |
| A. Branch from the other feature, pull request to main | both features' commits shown | git            | catch-up drops the merged copies  |
| B. Stacked pull requests, based on the other branch    | own diff only                | GitHub's stack | GitHub retargets, a rebase anyway |
| C. No stacks: start once the other merged              | own diff                     | none           | nothing                           |

### `PRIORITIES.md`

The finish's removal of the feature's line conflicts with starts. Relies on
[merge drivers](#merge-drivers-and-mergeunion).

| Option                                          | Conflicts     | Works without `ura`  | Line of a merged feature           |
| ----------------------------------------------- | ------------- | -------------------- | ---------------------------------- |
| A. Branches never write it; removed after merge | none          | yes, removed by hand | stays, read as done, until cleaned |
| B. A `ura` merge driver, item by item           | none with ura | conflicts as today   | removed by the merge               |
| C. `merge=union`                                | none          | yes                  | removed lines may come back        |

### `INBOX.md` and agents' notes

Relies on [one file per entry](#one-file-per-entry-changesets-towncrier-reno-gitlab).

| Option                                                   | Conflicts     | Format change         | When the note shows       |
| -------------------------------------------------------- | ------------- | --------------------- | ------------------------- |
| A. An agent's note is its own note file                  | none          | the inbox reads files | at the merge              |
| B. Notes stay in the record, moved to the inbox at clean | none          | none                  | at `ura clean`            |
| C. Agents write notes on the default branch              | rare          | the git decision      | at once, before the merge |
| D. A `ura` merge driver                                  | none with ura | none                  | at the merge              |

### Records' link repairs

Two sides repairing nearby links in a record conflict, amplified by re-wrapped paragraphs.

| Option                                                         | Conflicts                  | Cost                                |
| -------------------------------------------------------------- | -------------------------- | ----------------------------------- |
| A. A rule: take the default branch's record, run `--fix` again | still happen, settled fast | a line in the catch-up              |
| B. One sentence per line in workflow files                     | far fewer, everywhere      | every template, file, and formatter |

### Needs no choice

- **Detection without `gh`**: `git merge-tree` against the default branch works without a forge, as
  principle V asks; `gh`'s `mergeable` adds the forge's view when present.
- **Generated binding files**: regenerate them in a catch-up, never merge them by hand: they are
  this repository's, and the build writes them.
- **Rebase or merge to catch up**: the catch-up already rebases and pushes with
  `--force-with-lease`, done by the agent, not a tool.
- **Order of merging**: with any option, the human merges in the order they like; a stacked feature
  merges after the one it builds on, as every stack tool requires.

## Not checked

- GitHub stacked pull requests' current status, preview or generally available: no page read states
  it.
- `mergeable`'s values just after another pull request merges: no pull request was open to observe.
- Whether GitHub's rebase merge accepts a pull request holding merge commits: not found in the pages
  read.
- git-branchless's `git restack` page and Sapling's stack page: not reached.
