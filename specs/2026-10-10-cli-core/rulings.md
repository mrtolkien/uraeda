# Rulings: CLI core features

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: gix's status feature, and a 5 MB limit

- **Decision**: `Git::changed_files` uses gix's `status` feature. SC-002 and the CI check move from
  3 MB to 5 MB, and the spec is amended to revision 3.
- **Rationale**: a release build with the CLI's dependencies, the embedded skill, and gix's `status`
  feature measured 3.40 MB. The human accepted in chat a slightly bigger binary, for less code to
  maintain. 5 MB leaves room for the next feature's TUIs, measured at about +0.75 MB.
- **Alternatives considered**: comparing gix's index with the files by hand (2.48 MB, but about a
  hundred lines of our own); `git status --porcelain` (against the git decision).
- **If wrong**: the limit can go back down by dropping the `status` feature for the hand-written
  comparison, behind the same `changed_files` signature.
- **Where**: task 1, `crates/core/src/git.rs`, `.github/workflows/ci.yml`, `spec.md` SC-002

## R2: The plan's review waived

- **Decision**: the plan is `approved` without a review, though the spec's risk tier is `high`.
- **Rationale**: the human asked in chat to start the implementation right after the plan, without
  reviewing it.
- **Alternatives considered**: `awaiting-human`, as the tier asks, against the human's request.
- **If wrong**: the pull request's review covers what the plan's would have.
- **Where**: `plan.md`'s frontmatter
