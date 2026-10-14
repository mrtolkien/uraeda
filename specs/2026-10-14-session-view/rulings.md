# Rulings: Dedicated session view

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: One announcer replaces the composer's reply status

- **Decision**: `SessionAnnouncer` replaces `useReplyStatus` in the composer, and its "<agent> is
  replying" and "Reply complete".
- **Rationale**: the spec's announcements cover the same moments, and two status regions would
  announce one turn twice ([US4](spec.md#us4-keep-up-with-a-working-agent-p2)).
- **Alternatives considered**: keeping both regions, which doubles every announcement.
- **If wrong**: the composer's hook is 13 lines, restored from git.
- **Where**: Task 10.

## R2: The following hooks move to `following.ts`

- **Decision**: `useOpenAtEnd` and `useFollowEnd` move from `Transcript.tsx` to `following.ts`, and
  `useFollowEnd` returns its state. The spec's `useJumpToLatest.ts` becomes that file.
- **Rationale**: the button needs the follow state the hook already measures, and `Transcript.tsx`
  is 611 lines, over the coming 500-line limit.
- **Alternatives considered**: a second hook measuring the same distance, which would duplicate
  `AT_END`.
- **If wrong**: a file rename.
- **Where**: Task 9.

## R3: The diff starts at the merge base through git's three dots

- **Decision**: `git diff --numstat -z -M <default>...<branch>`, rather than computing a merge base
  with gix first.
- **Rationale**: git's `A...B` diffs from the merge base in one call, and the core already runs git
  for `unmerged_commits`.
- **Alternatives considered**: gix's `merge_base` and its tree diff, with no line counts built in.
- **If wrong**: `numstat` in `changes.rs` is the only caller to change.
- **Where**: Task 2.

## R4: Tests reach the implementation through a committed plan, not a new fixture branch

- **Decision**: an `addPlan` helper commits a plan on `2026-10-12-cli-tuis`, whose spec is approved,
  in the tests that need a feature at its implementation.
- **Rationale**: a new branch in `fixtures/repo` would change the sidebar, Home, and counts that
  many existing tests assert.
- **Alternatives considered**: a new fixture branch at its implementation.
- **If wrong**: a fixture branch can replace the helper's calls.
- **Where**: Task 4, used in Tasks 5–11.

## R5: The branch's changes are a view of their own, not a field of the feature

- **Decision**: `BranchChanges` is a fate type requested by the session's page, not a field of
  `FeatureView`.
- **Rationale**: the workspace reads every feature on every change. A diff per feature there would
  run git for features nobody is looking at.
- **Alternatives considered**: a field of `FeatureView`, with one request less.
- **If wrong**: moving the field costs one view and one source.
- **Where**: Task 4.

## R6: The plan follows the code quality decision merged meanwhile

- **Decision**: the branch caught up with the default branch before the first task, which brought
  the [code quality](../decisions/code-quality.md) decision. The plan now:
  - puts the branch's changes in a new `changes.rs`, since `api.rs` and `git.rs` are over 500 lines
    and may only shrink;
  - keeps the shared task parser in `plan.rs`, since `items.rs` is at 499 lines;
  - splits the marked `Sessions`, `Session`, `Composer`, and `Transcript.tsx` first, each in a
    commit that only restructures it.
- **Rationale**: the decision's rules bind every feature that changes code. It does not conflict
  with the spec, which names no file.
- **Alternatives considered**: building on the old base and rebasing at the end, against a refactor
  of the same files.
- **If wrong**: the structural commits are behaviour-neutral, and can be reverted on their own.
- **Where**: Tasks 1, 2, 5, 6, 9, and 10.

## R7: The approved spec takes the new template's sections, unchanged in content

- **Decision**: the spec's `## Design` became `## Architecture`, `## Mockups`, and `## Details`, in
  the order of the template the code quality feature merged meanwhile. Not a word of its content
  changed, so its `revision` stays 1, and the plan still implements it.
- **Rationale**: `ura check specs`, in `vp run ready`, refuses the old sections, and the
  implementation cannot pass its validation otherwise.
- **Alternatives considered**: a new spec revision, which would send the plan back for a revision
  for no change of behaviour.
- **If wrong**: the old order is one commit away in git.
- **Where**: before Task 1.

## R8: The binding test asserts an absent progress with `toBeUndefined`

- **Decision**: `index.test.ts` checks `expect(next.step.progress).toBeUndefined()`, instead of
  `progress: undefined` in the step's `toMatchObject`.
- **Rationale**: napi-rs leaves a `None` field's key out of the object, and `toMatchObject` fails on
  a missing key it expects as `undefined`. Both forms state that a feature before its implementation
  has no progress.
- **Alternatives considered**: sending `null` from the binding, which would change every optional
  field's shape; the server fills `null` itself in Task 4.
- **If wrong**: one assertion to rewrite.
- **Where**: Task 1.

## R9: Task titles are taken as written from the heading's line

- **Decision**: `plan::tasks` keeps the parsed plan's tasks and counts, and replaces each title with
  the text after `Task N:` on its heading's source line, markup included.
- **Rationale**: the document tree flattens a heading's spans, so "The `ura status` command" lost
  its backticks, while the spec shows the title "as written", and `ura status` printed it raw
  before.
- **Alternatives considered**: a raw-text field on `TaskItem` in `items.rs`, which is at 499 lines
  and would also change the review's type.
- **If wrong**: the review page keeps drawing its own tree, so only `plan::tasks` changes back.
- **Where**: Task 1.

## R10: The diff names commits, not branches

- **Decision**: `branch_changes` passes the commits `Git::tip` resolves for the default branch and
  the feature's branch, as hashes, in `git diff --numstat -z -M --no-ext-diff <base>...<tip>`,
  rather than the feature's ref name and the default branch's name.
- **Rationale**: git does not resolve `main` to `origin/main`, so a default branch known only on
  `origin` would fail the diff, and a hash needs no care for a `fix/` slash
  ([review focus 2](plan.md#review-focus)). `--no-ext-diff` keeps the user's configured diff tool
  out of a call whose output is parsed.
- **Alternatives considered**: the full ref names `refs/heads/<branch>` or
  `refs/remotes/origin/<branch>`, which would need `Git::tip` to return which one it found.
- **If wrong**: `numstat`'s two arguments in `changes.rs`.
- **Where**: Task 2.
