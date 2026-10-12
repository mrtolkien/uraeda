---
kind: feature
finished: 2026-10-12
pull-request: https://github.com/mrtolkien/uraeda/pull/4
---

# Record: Finish feature

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-12, finished on
> 2026-10-12, in [its pull request](https://github.com/mrtolkien/uraeda/pull/4). Its full files are
> in git: `git log -- specs/2026-10-12-finish-feature/`.

## What and why

A clear end for a feature: what stays on the default branch once it is merged, and when its branch
and worktree go. Merged folders left process noise on `main`, 10,405 lines for three features, which
cluttered the file tree and every search; the human wanted a denser format that keeps what is
useful, like specs and decisions.

## Behaviour

- After the final review of a feature, or the fix of a bug, the pull request opens as a draft, and a
  last commit, `finish(<slug>): <name>`, replaces the folder with one record,
  `specs/done/YYYY-MM-DD-<slug>.md`, rewrites every link into the folder, and removes the
  `PRIORITIES.md` entry; then the pull request is marked ready. The draft marks the final review as
  done, its readiness the finishing.
- A record holds `kind`, `finished`, and `pull-request`, a `> [!NOTE]` block saying it is not
  instructions, then what and why, behaviour, design, every question under its exact heading with
  its answer, decisions, changes after approval, and follow-ups. No line limit. Records are frozen
  once merged, except to fix a broken link.
- A link to a question keeps its anchor and only changes its path; a link to anything else points to
  the first question that links the same target, or to the record.
- Changes asked on the pull request amend the record's behaviour or design in place, listed under
  changes after approval. One that needs a new round reverts the finishing commit, carries those
  changes into the spec and the plan, and turns the pull request back into a draft.
- `ura status`, `ura next`, `ura check`, and the web UI read records as done features, on the branch
  before the merge and on the local or `origin` default branch after it; merged folders still read
  as done. A merged feature with a worktree or a local branch left says so, with `ura clean`;
  `ura next` reminds the human on stderr.
- `ura clean [feature] [--all] [--dry-run]` removes a merged feature's worktree under `.worktrees/`
  and its local branch, never forced. It leaves, with what to do: a worktree with uncommitted or
  untracked files, a locked one, one outside `.worktrees/`, the one it runs in, the branch the main
  checkout is on, and a branch with commits on neither the default branch nor `origin`'s, by patch.
  It never deletes a remote branch, and exits 1 when it leaves anything.
- `ura start` refuses a name a record holds, and `ura init` creates `specs/done/`.

## Design

The step is written in [`finish.md`](/skills/uraeda/references/finish.md), with the record's
[template](/skills/uraeda/assets/templates/specs/done/YYYY-MM-DD-feature-slug.md) and the
[example's record](/skills/uraeda/assets/example/specs/done/2026-10-06-recurring-tasks.md); the
feature and bug step tables of [`SKILL.md`](/skills/uraeda/SKILL.md) and
[`bug.md`](/skills/uraeda/references/bug.md) check for a record first.

- [`workspace.rs`](/crates/core/src/workspace.rs): `Feature::from_record`, a feature whose only file
  is its record, in `specs/done`; `owns` matches a path to a feature's files; merged features come
  from records and folders on both default tips, with `left_worktree` and `left_branch`.
- [`steps.rs`](/crates/core/src/steps.rs): the step `finish`, and `PullRequest::Draft`, from `gh`'s
  `isDraft`.
- [`check/`](/crates/core/src/check/): records are checked against their template, with `kind`,
  `finished`, and the numbering of rounds and questions; a heading under an absent optional section
  is not required.
- [`actions/clean.rs`](/crates/core/src/actions/clean.rs) decides from what git records, through new
  calls in [`git.rs`](/crates/core/src/git.rs), and
  [`crates/cli/src/clean.rs`](/crates/cli/src/clean.rs) prints it.
- [`FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx) shows the record and the leftovers.

## Questions

### Round 01

#### Q1: What does a merged feature leave on the default branch?

**Answer:** A: one record file per feature in `specs/done/`, in place of its folder, with the rest
in git.

#### Q2: When does finishing happen?

**Answer:** A: as the last commit of the branch, before the pull request is ready, since GitHub does
not let an author approve their own pull request.

#### Q3: Where do links to a finished feature point?

**Answer:** A: to the record, whose questions keep their headings and anchors.

#### Q4: How does a reader find the full files of a finished feature?

**Answer:** A: the record links its pull request and names its folder for `git log`, and the skill
advises against squash merges.

#### Q5: Who removes a merged feature's branch and worktree?

**Answer:** A, `ura clean` when the human asks, "document ura clean in the skill too", so the skill
tells the human to run it until a harness automates it.

#### Q6: What do `ura` and the web UI do in this feature?

**Answer:** A: the skill, plus `ura` and the web UI reading records, `ura check` checking them, and
the cleanup in `ura`.

#### Q7: Are the three merged features finished too?

**Answer:** A: yes, their three records replace their folders in this feature.

#### Q8: Should Uraeda also keep a living description of the system?

**Answer:** No: "the current state of the system is defined in the code", with the constitution and
decisions for what is not, and a living spec would drift.

## Decisions

- [Git](../decisions/git.md), changed: tools may remove a merged feature's worktree and delete its
  local branch when a human asks, never forced, after a patch-equivalence check against the local or
  `origin` default branch; remote branches are never deleted.

## Changes after approval

- The spec was approved with two comments: records gained a `finished` date (C1), and no line limit
  applies to them (C2), so SC-001's limits are not checked.
- Unmerged commits are counted with `git log --cherry-pick --format=%H`, not `git cherry`, whose
  output is not a `--format` form (ruling R2).
- `ura clean` without a target takes the current branch's feature only when it has something to
  clean (R1); it reads git from the main checkout and leaves the worktree it runs in (R5).
- `finish: write the record`, `finish: open the pull request`, and
  `finish: mark the pull request ready` describe the step in `ura status`.
- The final review moved the bug table's record rows first, made a broken record a problem, and
  printed worktrees outside `.worktrees/` with relative paths.

- The pull request's automated review led to six more changes: changes requested win over a draft; a
  merge commit the default branch lacks keeps a branch from `ura clean`; `ura check <feature>`
  checks a finished feature's record only; a record needs a dated name, its `> [!NOTE]` block, and a
  `kind` matching its branch.

## Follow-ups

- The web UI's problem badge does not show on a record's row (R4).
- `ura clean <merged feature>` with nothing left prints only its name (R4).
