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
- **If wrong**: `Git::numstat` is the only caller to change.
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
