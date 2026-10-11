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

## R3: The local date from `date`

- **Decision**: `today()` reads `URA_TODAY`, else runs `date +%F`, else takes the UTC date from the
  system clock. Timestamps for JSON and "2 hours ago" are computed in the code, without a crate.
- **Rationale**: the standard library has no local time zone. The `time` crate refuses the local
  offset once the process has threads, which gix may start; `jiff` adds a time zone database for one
  date. `date` exists on every supported platform, Linux and macOS.
- **Alternatives considered**: `time` with `local-offset`, `jiff`, `chrono`.
- **If wrong**: a machine without `date` gets the UTC date, a day off near midnight; the record
  blocks carry that date.
- **Where**: task 3, `crates/core/src/today.rs`

## R4: `ura next --json` with nothing to do

- **Decision**: with no work for an agent, `ura next --json` prints `"feature": null` and a step
  whose `name` is `"none"`, the same object as every other step.
- **Rationale**: US2.5 says it prints `"step": "none"`; a step that is an object everywhere else and
  a string here would force every reader to check its type.
- **Alternatives considered**: `"step": "none"` as a string, as the scenario reads literally.
- **If wrong**: readers checking `step == "none"` must read `step.name` instead.
- **Where**: task 4, `crates/cli/src/next.rs`

## R5: No rule against an `[!IMPORTANT]` block in an answered file

- **Decision**: `ura check` requires the `> [!IMPORTANT]` block of a file waiting for the human
  (`blocks.important`), but does not report one left in an answered or approved file.
- **Rationale**: the skill lets the block stay until the next step turns it into a record: "If the
  human or a tool did not do it, the next step does it". A rule against it would fail the human's
  own commit of a hand-written answer, in this repository's pre-commit hook.
- **Alternatives considered**: `blocks.note`, as the plan listed it.
- **If wrong**: an agent that forgets the record is not caught by `check`; the next step's
  instructions still require it.
- **Where**: task 5, `crates/core/src/check/mod.rs`

## R6: Links checked when they point to markdown or into `specs/`

- **Decision**: `links.file` and `links.heading` check links whose target is a markdown file or
  under `specs/`; links to code and other files are not checked.
- **Rationale**: specs and plans link to code files the plan will create, like
  `/crates/core/src/check/`, so a check of every link would fail every approved spec until its
  feature is built. Workflow files link to each other through markdown, which is what agents get
  wrong.
- **Alternatives considered**: every relative link; none.
- **If wrong**: a broken link to a code file goes unnoticed, as it does today.
- **Where**: task 5, `crates/core/src/check/links.rs`

## R7: Commits refuse other staged files

- **Decision**: `ura` stages its own files and runs `git commit` on the index, after refusing when
  other files are staged: `other files are staged: b.md: commit or unstage them first`.
- **Rationale**: `git commit -- <paths>`, as the plan said, commits through a temporary index; a
  pre-commit hook that reformats and stages files, like this repository's `vp check --fix`, then
  leaves the file both staged and modified (`MM`) after the commit. A commit of the index keeps what
  the hook did, and the working tree clean (review focus 5).
- **Alternatives considered**: `git commit -- <paths>`, with the hook's changes left behind;
  committing the other staged files along with ours.
- **If wrong**: a user with staged work must commit or unstage it before `ura answer --submit` or
  `ura review`, or use `--no-commit`.
- **Where**: task 6, `crates/core/src/git.rs`
