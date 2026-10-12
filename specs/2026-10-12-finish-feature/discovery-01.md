# Discovery, round 01: Finish feature

## Summary

Finishing a feature means three things: what its files become once it is merged, when that happens
in the workflow, and when its branch and worktree go away. Tools in this space split into two
families. Most keep every per-feature folder forever (Spec Kit, Kiro, superpowers, Agent OS, BMAD),
and their users complain about clutter, stale specs, and finished plans that agents read as live
instructions. OpenSpec moves each finished change folder, intact, to a dated archive, after merging
its behaviour into living specs; its archive still grows without bound, and add-on tools now
condense or delete it. Outside AI tools, PEPs and ADRs freeze a change document into a historical
record, and changesets and towncrier consume per-change files into one curated summary, then delete
them, with git keeping the originals.

The [proposal](proposal.md) asks for a clear end of a feature: what stays on the default branch, in
a denser form, and when branches and worktrees are deleted. It values specs and decisions, and
suggests one file per feature in a `done` folder. Today, Uraeda has no finishing step: the three
merged features left 10,405 lines in 21 files on `main`, against 310 lines of decisions, and four
decisions and a draft link into those folders. `ura` recognises a merged feature by its dated folder
on the default branch, so any change to that folder changes `ura status` and the web UI.

## How other products do it

### OpenSpec

- Living specs in `openspec/specs/<domain>/spec.md` describe how the system behaves now; each change
  is a folder in `openspec/changes/<name>/` with a proposal, a design, tasks, and delta specs
  ([concepts](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md)).
- `openspec archive` validates the change, merges its ADDED, MODIFIED, and REMOVED requirements into
  the living specs, then moves the folder to `openspec/changes/archive/YYYY-MM-DD-<name>/`. "All
  artifacts remain intact in the archive"
  ([CLI](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md),
  [commands](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/commands.md)).
- Problems reported by its users and maintainers:
  - The archive step is forgotten, and the living specs drift; a proposal records lifecycle state
    "as data, not directory position" ([#1683](https://github.com/Fission-AI/OpenSpec/issues/1683)).
    One repository had 198 specs and 239 archived changes.
  - Merging deltas by matching headers loses scenarios when two changes touch one requirement; one
    user runs a second PR per change that only archives it
    ([#2033](https://github.com/Fission-AI/OpenSpec/issues/2033)).
  - The maintainers explore dropping the archive step entirely, updating specs as tasks finish
    ([#1968](https://github.com/Fission-AI/OpenSpec/issues/1968)).
  - Archiving deletes and recreates files, which loses their git history
    ([#709](https://github.com/Fission-AI/OpenSpec/issues/709)); users want each living requirement
    to link back to the change that introduced it
    ([#1909](https://github.com/Fission-AI/OpenSpec/issues/1909)).
  - A third-party skill condenses archived changes into summaries and deletes the raw folders
    (snippet only, [skills.rest](https://skills.rest/skill/lina-openspec-archive-consolidate)).

### GitHub Spec Kit

- `specs/NNN-feature/` folders stay on the default branch after merge: the core has no archive or
  close step
  ([spec-driven.md](https://raw.githubusercontent.com/github/spec-kit/main/spec-driven.md),
  [README](https://github.com/github/spec-kit)).
- Users ask how to keep specs current once a later spec makes an earlier one stale, and for a
  `/close` or `/compact` command that condenses finished specs
  ([#620](https://github.com/github/spec-kit/issues/620)). "The truth of the system being a chain of
  specs is horrible for humans and probably inefficient for AI"
  ([discussion #152](https://github.com/github/spec-kit/discussions/152)). The maintainers point to
  extensions.
- The spec-kit-archive extension folds merged features into `.specify/memory/spec.md`, `plan.md`,
  and `changelog.md`, each item with a source reference like
  `[Source: specs/007-invoice/spec.md -> FR-012]`
  ([repo](https://github.com/stn1slv/spec-kit-archive)). A cleanup skill writes an archive report
  with recovery commands, then deletes the spec folder (snippet only,
  [claudepluginhub](https://www.claudepluginhub.com/skills/racecraft-lab-speckit-pro-dist-claude-speckit-pro/speckit-archive-cleanup)).

### Kiro

- Each feature has `.kiro/specs/<feature>/` with requirements, design, and tasks, kept in the
  repository; there is no completion or archive concept ([specs](https://kiro.dev/docs/specs/),
  [best practices](https://kiro.dev/docs/specs/best-practices/)).
- "30+ specs accumulated over a few months... the flat alphabetical list is hard to navigate", and
  users ask for a done state and an option to hide finished specs
  ([#6387](https://github.com/kirodotdev/Kiro/issues/6387),
  [#6641](https://github.com/kirodotdev/Kiro/issues/6641)).

### superpowers

- Specs and plans are dated files in `docs/superpowers/specs/` and `docs/superpowers/plans/`,
  committed, never touched again
  ([writing-plans](https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md)).
- `finishing-a-development-branch` checks the tests, then offers four choices: merge locally, push
  and open a pull request, keep the branch, or discard it. It removes only worktrees under
  `.worktrees/` or `worktrees/`, never with `--force`, keeps the worktree while a pull request is
  open, and deletes the branch with `git branch -d` after a local merge
  ([skill](https://raw.githubusercontent.com/obra/superpowers/main/skills/finishing-a-development-branch/SKILL.md)).
- "A finished plan is a standing work order": an agent read a completed plan as instructions,
  including pushing and publishing. The fix users settled on is a status line first in the file,
  "This is an archival record, not a work order", written in the last commit before the merge, since
  a later one never reaches the merged tree
  ([#1075](https://github.com/obra/superpowers/issues/1075)).

### BMAD Method

- Plans stay in place once built: deleting one "removes the state and evidence that later builds,
  reviews, and retrospectives read"
  ([tracking](https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/)).
- When every ticket of an epic is done, a retrospective writes one file, with a verdict, the places
  where the code diverged from the requirements, and action items that become tickets
  ([finish an epic](https://docs.bmad-method.org/build/finish-an-epic/)).
- The project context holds "only what is expensive to rediscover", and leaves out overviews,
  because "the copy goes stale"
  ([project context](https://docs.bmad-method.org/existing-codebases/set-and-maintain-project-context/)).

### Other agent tools

- Agent OS keeps dated spec folders, committed to "preserve project history", with no finishing step
  ([file structure](https://buildermethods.com/agent-os/file-structure)).
- spec-workflow-mcp moves finished specs to an `archive/` folder on request, and can restore them
  ([repo](https://github.com/Pimzino/spec-workflow-mcp)).
- Cline's memory bank has no per-feature files: finished work is folded into six living files
  ([docs](https://docs.cline.bot/prompting/cline-memory-bank)).
- Taskmaster declined an archive for done tasks: statuses and filters cover it
  ([#709](https://github.com/eyaltoledano/claude-task-master/issues/709)).

### Design document processes

- **Python PEPs**: a PEP becomes `Final` once implemented, and is then "a historical document rather
  than a living specification": "formal documentation of the expected behavior should be maintained
  elsewhere". A replaced PEP gets `Superseded-By:`, its replacement `Replaces:`
  ([PEP 1](https://peps.python.org/pep-0001/)).
- **Kubernetes KEPs**: `status: implemented` means "no longer actively changed"; a replaced KEP
  points to its replacement with `superseded-by`
  ([KEP process](https://github.com/kubernetes/enhancements/blob/master/keps/sig-architecture/0000-kep-process/README.md)).
- **Rust RFCs** stay in `text/` once merged, completion is tracked on an issue, and "we cannot
  expect every merged RFC to actually reflect what the end result will be"
  ([README](https://github.com/rust-lang/rfcs/blob/master/README.md)).
- **Ember RFCs**: once released, deviations from the RFC "are briefly noted at the top of the RFC"
  ([README](https://github.com/emberjs/rfcs/blob/main/README.md)).
- **Oxide RFDs**: a fully implemented RFD is `committed`, which is "essentially no different from
  published" ([RFD 1](https://rfd.shared.oxide.computer/rfd/0001)).
- **Google design docs** drift from the system once it ships, and "still often present the most
  accessible entry point to learn about the thinking"
  ([Design docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)).
- **ADRs**: a decision is never edited once accepted, only superseded, with a link to its
  replacement
  ([Nygard](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions),
  [Fowler](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html),
  [log4brains](https://github.com/thomvaill/log4brains)). Uraeda's decisions differ on purpose: they
  are edited in place, and git keeps the earlier versions.

### Per-change files condensed into a summary

- **changesets**: one file per change in `.changeset/`; `changeset version` writes them into the
  changelog, and removes them "so we only ever use a changeset once"
  ([common questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md),
  a page marked outdated). Its rationale: write when the change is fresh, and "git is a bad place to
  store this information"
  ([detailed explanation](https://github.com/changesets/changesets/blob/main/docs/detailed-explanation.md)).
- **towncrier**: `towncrier build` writes news fragments into the news file and removes them with
  `git rm`; `--keep` keeps them
  ([tutorial](https://towncrier.readthedocs.io/en/stable/tutorial.html),
  [CLI](https://towncrier.readthedocs.io/en/stable/cli.html)).
- **reno**, the counter-example, keeps every note in the tree, and builds release notes from git
  history ([design](https://docs.openstack.org/reno/latest/user/design.html)).
- **Keep a Changelog**: "Using commit log diffs as changelogs is a bad idea: they're full of noise"
  ([1.1.0](https://keepachangelog.com/en/1.1.0/)).

### What they have in common

Capabilities a user of these tools may expect from finishing a feature:

- A finished state, visible in the file, that tells agents and readers the document is a record, not
  instructions.
- A short, current summary of what shipped, written when the work is fresh.
- The full record kept reachable, in an archive folder or in git history.
- Links from what remains (living docs, decisions) back to why a choice was made.
- Deviations from the design noted where readers will see them.
- Supersession: a later feature that replaces an earlier one says so.
- Branch and worktree removal that never loses uncommitted work.
- Optionally, a living description of the whole system, kept apart from the change records.

## Standards and libraries

### git worktree

- "Only clean worktrees (no untracked files and no modification in tracked files) can be removed",
  unless `--force`; a locked worktree needs `--force` twice
  ([git-worktree](https://git-scm.com/docs/git-worktree)). Tested with git 2.55 in this session:
  ignored files, like `node_modules/`, do not block `git worktree remove`; an untracked file does.
- `git worktree prune` only removes the records of worktrees whose folders are already gone (same
  page).

### git branch

- `git branch -d` needs the branch "fully merged in its upstream branch, or in HEAD"; `-D` deletes
  regardless ([git-branch](https://git-scm.com/docs/git-branch)). Tested in this session: after a
  rebase merge, `-d` refuses with "the branch is not fully merged", since the merged commits have
  new hashes. A branch checked out in a worktree cannot be deleted until the worktree is removed.

### GitHub pull requests and branches

- "Pull request authors cannot approve their own pull requests"
  ([approving a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews)).
  The three merged pull requests here were opened and merged by their author, with comment reviews
  only, and no approval (`gh pr view`).
- Squash merges do not keep the branch's commits on the base branch; rebase merges keep them, with
  new hashes; merge commits keep them as they are
  ([about merges](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges)).
  The three pull requests here used merge commits (#1, #3) and a rebase (#2).
- "Automatically delete head branches" deletes a branch once its pull request is merged, and a
  deleted head branch can be restored from its pull request
  ([automatic deletion](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches),
  [restoring](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/deleting-and-restoring-branches-in-a-pull-request)).
  This repository has it off (`delete_branch_on_merge: false`), and its merged branches are already
  gone from the remote.
- Tags under `archive/<name>` are a folk practice for keeping a deleted branch's commits, with no
  official git convention behind it (snippet only,
  [octavore](https://etc.octavore.com/2025/12/archiving-git-branches-as-tags/)).

### Search tools

- ripgrep skips files matched by `.gitignore`, `.ignore`, and `.rgignore`, in rising precedence;
  `.ignore` is "application agnostic", and `--no-ignore` turns all of it off
  ([ripgrep guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)). Hiding a folder
  from search this way hides it from agents' search tools too, and not from the file tree.

## The code

### Important reads

- [`specs/`](/specs/): three merged feature folders, `2026-10-10-stack-decision` (2,662 lines),
  `2026-10-10-cli-core` (3,381), and `2026-10-11-web-ui` (4,362), each with a proposal, a discovery,
  a round of questions, a spec, a plan, rulings, and mockups. Their specs are 431 to 719 lines; the
  four decisions together are 310.
- [`specs/decisions/`](/specs/decisions/): `cli.md`, `git.md`, `stack.md`, and `toolchain.md` hold
  26 links into the merged folders, mostly to questions and discovery sections, under **Why** and
  **Alternatives considered**. [`specs/drafts/cli-tuis.md`](/specs/drafts/cli-tuis.md) holds 8 more.
  The skill's [decision template](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md)
  asks for these links: "Links to the clarification question and the discovery".
- [`skills/uraeda/references/implementation.md`](/skills/uraeda/references/implementation.md): the
  last step today. Its final review, then the pull request, whose last commit removes the feature's
  `PRIORITIES.md` entry. Changes requested on the pull request amend `spec.md` in place, "the merged
  spec describes the merged code". Nothing happens after the merge.
- [`specs/decisions/git.md`](/specs/decisions/git.md): tools write in `.worktrees/<branch>/`, never
  switching the user's checkout, and "Worktrees stay until removed by hand, with
  `git worktree remove`, until a feature-finishing step removes them": the decision expects this
  feature.
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs): a folder on the default branch's
  tip is a merged feature, with the step `done`; branches whose folder is merged are skipped.
  Without the dated folder on the default branch, a finished feature disappears from the workspace,
  or, if its local branch remains, shows as in progress from the branch's tip.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): the steps, with `Done` for merged
  features, and the pull request's state read with `gh`; `ChangesRequested` comes from
  `reviewDecision`, which an author's own pull request never gets.
- [`packages/web/src/Home.tsx`](/packages/web/src/Home.tsx): the home screen lists done features,
  each linking to its feature page.
- [`skills/uraeda/assets/example/specs/`](/skills/uraeda/assets/example/specs/): the example keeps
  `2026-10-06-recurring-tasks/` complete, "the model of every file", and its decisions link into it.
- `git log`: the three features were merged on 2026-10-10, 2026-10-11, and 2026-10-12. Their
  branches exist neither locally nor on the remote, and `.worktrees/` is empty.
- The installed `ura` 0.1.0 switched the main checkout to this feature's branch when it started it,
  while the code in [`actions/start.rs`](/crates/core/src/actions/start.rs) creates a worktree by
  default, as `git.md` requires: the installed binary is older than the repository.

### The proposal's path and existing actions

- **Final review and pull request**: today the pull request merges the whole folder. A finishing
  step adds work at this point or after it, and changes what the pull request's diff shows.
- **Changes requested on the pull request**: today they amend `spec.md` in place. If the folder is
  already condensed, they amend the condensed record instead.
- **Merge**: the human merges on GitHub. Nothing in the workflow runs after it, and no agent is on
  the branch any more.
- **`ura status` and the web UI**: they list merged features from their folders. They need another
  way to find them once the folders are gone.
- **`ura check`**: it checks that links into `specs/` resolve. Links from decisions and drafts into
  a condensed folder break, and `ura check` reports them.
- **Decisions changed later**: a decision's **Why** links to the feature that made the choice. A
  later feature that changes the decision links to its own questions.
- **Bugs**: a bug's folder, `bugs/YYYY-MM-DD-<slug>/`, is merged the same way, and accumulates the
  same way.
- **Postponed and dropped features**: they move to `drafts/` or `backlog/`, or are deleted, before
  any merge. Finishing does not meet them.
- **Starting a feature**: a finished feature's slug stays taken while its folder name is in use.

### Likely changes

- [`skills/uraeda/SKILL.md`](/skills/uraeda/SKILL.md): the folder layout, the step table, the commit
  types, and a finishing section, under every option.
- A new reference, or a new section of
  [`implementation.md`](/skills/uraeda/references/implementation.md), for the finishing step, under
  every option.
- A record template in `skills/uraeda/assets/templates/specs/`, and an example record, with option A
  or B of [what stays](#what-stays-on-the-default-branch).
- [`specs/README.md`](/specs/README.md) and its template: the layout, under every option.
- [`specs/decisions/git.md`](/specs/decisions/git.md): its consequence on worktrees, with any option
  of [cleanup](#branch-and-worktree-cleanup).
- `crates/core/src/workspace.rs`, `steps.rs`, and the check module: finished features read from
  their new place, and a new step, with option A of [tool support](#tool-support).
- `packages/web/src/Home.tsx` and the feature page: done features shown from their record, with
  option A of [tool support](#tool-support).
- `fixtures/`: a finished feature, for the Rust and TypeScript tests, with option A of
  [tool support](#tool-support).
- The three merged folders, the four decisions, and `drafts/cli-tuis.md`, with option A of
  [features already merged](#features-already-merged).
- `README.md`, if it describes the folder layout.

## The proposal

### The specs are valued, and the proposal asks for something denser

The proposal names specs and decisions as useful, and asks for "a specific format that's a bit
denser". Specs here are 431 to 719 lines each. A record denser than the spec loses detail the spec
has; keeping the spec keeps most of the volume. The two goals pull apart, and the balance is the
human's.

### The pull request has no approval to wait for

A finishing step that runs "once the pull request is approved" cannot work here: GitHub does not let
an author approve their own pull request, and the human opens and merges their own. The merge is the
only signal the human gives today.

### Links from decisions into the folders

The proposal keeps decisions, and decisions link into the questions and discovery that justify them.
Condensing the folders breaks those links unless finishing rewrites them.

### No word on bugs

The proposal speaks of features. Bug folders accumulate the same way.

### No word on the features already merged

Three merged features are on `main` today. The proposal does not say whether they are condensed too.

### A living description of the system

Several of the products above keep a description of the system as it is now, apart from the change
records, and their users ask for one where it is missing. The proposal does not mention it, and it
is a new kind of file, with its own upkeep.

## Approaches

Criteria come from the proposal (less noise in the file tree and in search, denser records, keeping
specs and decisions useful), and the constitution: humans stay in control
([I](/specs/CONSTITUTION.md#i-humans-stay-in-control)), git and plain text first
([II](/specs/CONSTITUTION.md#ii-git-and-plain-text-first)), asynchronous by default
([III](/specs/CONSTITUTION.md#iii-asynchronous-by-default)), review effort matches impact
([IV](/specs/CONSTITUTION.md#iv-review-effort-matches-impact)), and tools are optional
([V](/specs/CONSTITUTION.md#v-tools-are-optional)).

### What stays on the default branch

What a merged feature's folder becomes. Relies on [OpenSpec](#openspec),
[PEPs and KEPs](#design-document-processes),
[changesets](#per-change-files-condensed-into-a-summary), and [search tools](#search-tools).

| Option                                                                  | Noise                      | Density | Detail kept in the tree   | Precedent                    |
| ----------------------------------------------------------------------- | -------------------------- | ------- | ------------------------- | ---------------------------- |
| A. One record file per feature in `specs/done/`, the folder deleted     | ~100–200 lines per feature | High    | Summary; the rest in git  | changesets, towncrier, BMAD  |
| B. Keep `spec.md` and `rulings.md` in place, delete the rest            | ~500–800 lines per feature | Medium  | Full behaviour and design | PEPs (the frozen document)   |
| C. Move the whole folder to `specs/done/`, hidden from search by ignore | Same volume, out of search | None    | Everything                | OpenSpec, spec-workflow-mcp  |
| D. Delete the folder, keep only git history and a changelog line        | Lowest                     | Highest | One line                  | reno (history as the source) |

### When finishing happens

Where the finishing commit sits in the workflow. Relies on
[the missing approval](#the-pull-request-has-no-approval-to-wait-for) and
[superpowers](#superpowers).

| Option                                                                  | Extra human action             | Record reviewed     | Pull request diff        | Agent writes on the default branch |
| ----------------------------------------------------------------------- | ------------------------------ | ------------------- | ------------------------ | ---------------------------------- |
| A. Last commit of the branch, before the pull request                   | None                           | With the code       | Code and record, no spec | No                                 |
| B. After the merge, in a small second pull request                      | A second merge                 | In its own PR       | Unchanged                | No                                 |
| C. After the merge, an agent commits on the default branch              | None                           | Not before it lands | Unchanged                | Yes                                |
| D. When the human says the pull request is ready, then the agent merges | A message instead of the merge | Before the merge    | Unchanged until the end  | No                                 |

With A, changes requested on the pull request amend the record, not the spec, and the record says
what changed after approval, like Ember's deviation note.

### Links into finished features

What happens to links from decisions, drafts, and other features into a condensed folder. Only with
A, B, or D of [what stays](#what-stays-on-the-default-branch). Relies on
[the links](#links-from-decisions-into-the-folders).

| Option                                                                                | Plain text          | One click to the reason  | Works before the merge    |
| ------------------------------------------------------------------------------------- | ------------------- | ------------------------ | ------------------------- |
| A. Point them to the record, which keeps each question and its answer under a heading | Yes                 | To the answer, in a line | Yes                       |
| B. Rewrite them as GitHub permalinks at a commit                                      | No, bound to GitHub | To the full question     | No: rebase changes hashes |
| C. Keep the files decisions cite, in the record's folder                              | Yes                 | To the full question     | Yes                       |

### Keeping the full history reachable

How a reader finds the condensed files later. Relies on
[GitHub pull requests and branches](#github-pull-requests-and-branches).

| Option                                                                               | Survives squash merges        | Extra refs      | Effort               |
| ------------------------------------------------------------------------------------ | ----------------------------- | --------------- | -------------------- |
| A. The record links its pull request and names its folder, for `git log -- <folder>` | Through the pull request only | None            | None                 |
| B. A tag `archive/<folder>` on the branch's tip, pushed, named in the record         | Yes                           | One per feature | A push               |
| C. Require merge commits                                                             | Not allowed                   | None            | A repository setting |

### Branch and worktree cleanup

When the merged feature's local branch and worktree are removed, and by whom. Relies on
[git worktree](#git-worktree), [git branch](#git-branch), and [superpowers](#superpowers).

| Option                                                                             | Human in control          | Risk                                   | Needs `ura` |
| ---------------------------------------------------------------------------------- | ------------------------- | -------------------------------------- | ----------- |
| A. When the human asks: `ura clean`, or an agent told to, for merged features only | Yes                       | None beyond the guards                 | Optional    |
| B. Automatically, at the start of any agent or `ura` run                           | No: deletions unannounced | A dev server or editor in the worktree | Optional    |
| C. By hand, the skill only describes the commands                                  | Yes                       | Forgotten worktrees pile up            | No          |

Guards common to every option: only worktrees under `.worktrees/`, never `--force`, and a branch
deleted with `-D` only once its feature is merged, since `-d` refuses after a rebase merge. Remote
branches: GitHub's automatic deletion setting covers them without any tool.

### Tool support

What `ura` and the web UI do in this feature. Relies on [the code](#important-reads).

| Option                                                                        | `ura status` and UI after finishing                                        | Effort   |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| A. The skill, plus `ura` and the UI reading records, and the cleanup in `ura` | Done features listed                                                       | Medium   |
| B. The skill, plus `ura` and the UI reading records; cleanup by hand          | Done features listed                                                       | Small    |
| C. The skill only                                                             | Finished features disappear, or show as in progress from a leftover branch | None now |

### Features already merged

What happens to the three merged features. Relies on [important reads](#important-reads).

| Option                         | Noise removed now | Proves the format      |
| ------------------------------ | ----------------- | ---------------------- |
| A. Finish them in this feature | ~10,000 lines     | On three real features |
| B. Leave them as they are      | None              | On the next feature    |

### A living description of the system

Whether Uraeda also keeps a description of the system as it is now. Relies on [OpenSpec](#openspec),
[GitHub Spec Kit](#github-spec-kit), and [Cline](#other-agent-tools).

| Option                                       | Upkeep                                | Scope                                       |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| A. Not in this feature; a priority for later | None now                              | This feature stays small                    |
| B. In this feature: finishing updates it     | Every feature, and drift when skipped | A new artifact, its template, and its rules |

### Needs no choice

- **A finished state readers see**: whatever stays opens with what it is, a record of a merged
  feature, not instructions, as superpowers' users found necessary.
- **A summary written when fresh**: the finishing step runs when the feature's work ends, under
  every option of [when](#when-finishing-happens).
- **Deviations noted**: the rulings that change behaviour, and the changes made after the spec's
  approval, go into what stays, under every option but D of
  [what stays](#what-stays-on-the-default-branch).
- **Supersession**: a later feature that replaces an earlier one already says so in its own spec,
  and decisions are edited in place, with the abandoned choice listed. Nothing more to choose.
- **Bugs**: their folders are finished the same way as features, since nothing in a bug's files
  calls for a different treatment.
- **Postponed and dropped features**: they never reach the merge, and keep their current flow.
- **Remote branches**: GitHub's setting deletes them; it is the repository owner's setting, not the
  workflow's.

## Not checked

- changesets' current FAQ at [changesets.dev/faq](https://changesets.dev/faq): the deletion of
  changeset files comes from the older documentation on GitHub.
- The body of the octavore article on archiving branches as tags: only the discussion was read.
- Whether spec-kit-archive deletes the `specs/NNN` folder: its README was not read that far.
- Sourcegraph's RFC handbook, now behind Notion, and Uber's design doc process: no official source
  reached.
- cc-sdd, Amp, Devin, and Augment: no documented finishing concept was found, and they were not
  investigated further.
