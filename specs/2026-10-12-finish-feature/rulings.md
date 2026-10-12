# Rulings: Finish feature

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: `ura clean` takes the current branch's feature only when it has something to clean

- **Decision**: without a target, `ura clean` uses the current branch's feature when it is merged
  with a worktree or a branch left, else the only such feature, else lists them.
- **Rationale**: the shared target rule of the [CLI decision](../decisions/cli.md#rules) starts from
  the current branch's feature. For `ura clean`, the current branch is usually a feature in
  progress, which has nothing to clean: taking it would refuse every `ura clean` run from a
  feature's checkout.
- **Alternatives considered**: the rule as written, which refuses with "not merged" from any feature
  branch.
- **If wrong**: `ura clean` from a feature branch cleans another merged feature; a target names it
  explicitly.
- **Where**: task 7 of the plan.

## R2: Unmerged commits are counted with `git log --cherry-pick`, not `git cherry`

- **Decision**: a branch's commits absent from a base, patch-equivalents counted as present, come
  from `git log --cherry-pick --right-only --no-merges --format=%H <base>...<branch>`.
- **Rationale**: the [git decision](../decisions/git.md#rules) allows parsing `git` only in its
  plumbing, porcelain, or `--format` forms; `git cherry`'s `+`/`-` lines are none of them, while
  `git log --cherry-pick` compares commits by patch the same way, in a `--format` output.
- **Alternatives considered**: `git cherry <base> <branch>`, which the decision names as the
  reference behaviour.
- **If wrong**: a branch is kept when it could have been deleted, never the reverse; switching the
  call is local to `git.rs`.
- **Where**: task 6 of the plan.

## R3: Sections under an absent optional section are not required

- **Decision**: `ura check` requires a template's heading only when the level-2 section holding it
  is present, or required.
- **Rationale**: the record's `## Questions` is optional, absent for a bug, and its `### Round` and
  `#### Q1` headings would otherwise be reported missing.
- **Alternatives considered**: marking `### Round` and `#### Q1` optional in the template, which
  would let a record with questions drop them silently.
- **If wrong**: an optional section of another template with required children is checked less; no
  current template has one.
- **Where**: task 1 of the plan.

## R4: Two minor findings of the final review are left for the pull request

- **Decision**: the web UI's problem badge does not show on a record's row, and
  `ura clean <merged feature>` with nothing left prints only the feature's name, with exit 0.
- **Rationale**: neither loses work nor misleads: the problems still show in the page's Problems
  list, and the name alone means nothing was done. The implementation step leaves minor findings to
  the human ([implementation](/skills/uraeda/references/implementation.md#final-review)).
- **Alternatives considered**: fixing both now, in `FeaturePage.tsx` and `crates/cli/src/clean.rs`.
- **If wrong**: a one-line change each.
- **Where**: the final review.

## R5: `ura clean` leaves a worktree it runs in, and reads git from the main checkout

- **Decision**: `clean` opens the main checkout for every git read and write, and leaves a worktree
  that holds the folder it runs from, "you are in it. Run ura clean from the main checkout".
- **Rationale**: the final review found that, run from inside the worktree, the removal made the
  branch invisible to the caller's git, so the branch was skipped with exit 0, and the shell was
  left in a deleted folder. The [mockup](mockups/cli-output.md) gains this outcome.
- **Alternatives considered**: removing the worktree anyway, which leaves the human's shell in a
  deleted folder.
- **If wrong**: the human runs `ura clean` once more from the main checkout.
- **Where**: `crates/core/src/actions/clean.rs`, after task 7.
