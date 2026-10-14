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

## R11: A finished feature's own files are its record and its folder

- **Decision**: `branch_changes` leaves out what `Feature::owns` gives the feature, and the paths
  under its folder. On the branch of a finished feature, not yet merged, that is its record
  `specs/done/<folder>.md` and its folder's deleted files, while other files of `specs/done/` are
  listed.
- **Rationale**: the spec leaves out the feature's own folder, which the column links to. Once the
  folder becomes a record, the record plays that part, and the folder's deletions are not code. The
  prefix of the feature's `path`, `specs/done` for a finished feature, left out every record.
- **Alternatives considered**: `Feature::owns` alone, which lists a finished feature's deleted
  folder files.
- **If wrong**: the `own` closure in `changes.rs`.
- **Where**: Task 2, after its review.

## R12: The test helpers commit through one exported `commitOnBranch`

- **Decision**: `commitOnBranch(repo, branch, files)` is exported from
  `packages/binding/test-utils.ts`, and `addPlan` writes its plan through it, rather than a local
  helper of `fate.test.ts` beside an `addPlan` with its own git calls. The `BranchChanges` source
  logs through `process.stderr.write`, not `console.error`. `testApp` takes its options as one
  object, `{ allowedHosts, binding }`, so `guard.test.ts` passes `{ allowedHosts }`. It commits in a
  temporary worktree of the branch, adding only the given paths, and removes it.
- **Rationale**: one helper commits on a branch for both, and the web tests can commit code on a
  branch too. A temporary worktree leaves the main checkout alone: switching it would carry its
  uncommitted files onto the branch, and show the branch's specs in it to a live watcher. The server
  logs every other failure on `process.stderr`.
- **Alternatives considered**: the plan's local helper, which would repeat the commit; switching the
  main checkout, as `fixtureRepo` does; git's plumbing, which needs a temporary index and more
  calls. The worktree cannot be added while the branch is checked out elsewhere, as in a feature's
  `.worktrees/<folder>`, which no test does before calling it.
- **If wrong**: the helper moves into `fate.test.ts`, and `addPlan` calls git itself.
- **Where**: Task 4.

## R13: A folder that is no feature's has no branch changes, not failed ones

- **Decision**: the `BranchChanges` source answers a folder the core refuses as missing with
  `{ changes: null, failed: false }`, without a log. Only other errors are `failed`.
- **Rationale**: a deleted folder or a wrong address is not a git failure. The `Feature` source
  answers it as missing the same way, so the page says so instead of "The changes could not be
  read.", and the server's log keeps real failures only.
- **Alternatives considered**: answering it as failed, which logs every stale page's request.
- **If wrong**: the `isMissing` branch of `branchChanges` in `sources.ts`.
- **Where**: Task 4, after its review.

## R14: The sidebar's progress row shows whenever the step has a progress

- **Decision**: the progress row shows when `step.progress` is set, without also checking that
  `step.name` is `"implementation"`. While it shows, unfolded, the feature's row is not selected on
  the session's page; folded, the feature's row is selected there again, as the progress row is
  hidden. The ring fills in `--color-icon-accent`, the spec's accent, over a
  `--color-border-emphasized` track, at a status dot's size. The browser layout test searching for
  "CLI" waits for the row's slug, `cli-tuis`, instead of its title.
- **Rationale**: the core sets `progress` during the implementation only (`feature_step`), so the
  step's name would repeat a core rule in the UI, against the [stack](../decisions/stack.md)
  decision. A folded sidebar with no row selected on the session's page would lose the human's
  place. The search test's wait asserted the title the spec replaces with the slug.
- **Alternatives considered**: the plan's two checks, which agree today and would disagree only if
  the core changed its rule; the mockup's blue, which the spec's text names as the accent.
- **If wrong**: the `progress` checks in `ProgressRow` and `FeatureRow` of `SessionNav.tsx`, and the
  `fill` style of `ProgressRing.tsx`.
- **Where**: Task 5.

## R15: The session's page tests follow what the page shows with the agent, and every check moves with it

- **Decision**: US1.9 taps the fixture's recurring-tasks spec paragraph on lines 26–29, and Back
  finds "Approve and start the agent", not "Approve". US1.1 also asserts the crumbs' link to the
  feature. `agent-panel.test.tsx` reads the panel on the feature page, opened from the session's
  crumbs. `useOpenAtEnd` no longer skips on the entry's `pane`, and its browser case opens the
  session from a task view's pane, on a wide screen, through the sidebar's sub-agent row. The layout
  test checks the feature page's agent section at both sizes, and `startTurn` waits for the one
  Stop.
- **Rationale**: with the agent available, the review's Approve is split into "Approve and start the
  agent" and "Approve only", so "Approve" names no button. A session is never in a pane now, so a
  `pane` in its entry could only be another view's. No link of a task view opens a session: the
  sidebar is the way there. The agent section was checked only on the phone because the wide layout
  drew it beside the session; it now has its own page at both sizes, and skipping it on a wide
  screen would loosen the check.
- **Alternatives considered**: the plan's lines 12–14, which fall inside the fixture's callout, not
  a block of its own; keeping the `pane` check, harmless while `navigate` gives each page a new
  entry, but a rule about a layout the session no longer has.
- **If wrong**: the test's names and the one condition in `useOpenAtEnd`.
- **Where**: Task 6.

## R16: The column's tests follow the core's steps, and the layout wraps the whole session

- **Decision**: the column's heading is the core's step, so "no plan yet" on `CLI` as fixtured reads
  "Plan", not "Spec", and a plan whose boxes are all checked reads "Pull request", not "Final
  review", in the tests. The `Layout` holds the crumbs, the header, the transcript, and the composer
  as its content, `height="auto"`, and its `LayoutPanel` is made sticky through `xstyle`. The folded
  state is read once in `FeatureSession`, through `useAsideShown`, and passed to `Session` and
  `NoSession`; `WithAside` and `AsideToggle`, in `SessionAside.tsx`, draw the column and the button.
  The bar of "Task 7 of 11" shows its label above it, as the column's line. Its sections' headings
  are level 2 for screen readers, sized as level 4. `renderPage` takes the server's `binding`, for
  the failing diff.
- **Rationale**: `CLI`'s spec is approved, so its step is the plan's; with every box checked, the
  core moves past the final review when it cannot know the pull request, which the tests' machine
  cannot ask GitHub for (`PullRequest::Unknown`, as Task 4's expected failure shows). The mockup
  puts the column beside the whole page, the header included, and the window, not the layout,
  scrolls, so the panel follows `RoundNav`'s sticky column. One state for both views keeps the
  choice when a first message turns `NoSession` into `Session`, even where storage is refused.
  Astryx's `ProgressBar` names itself from its label: shown, it is the line the spec asks for,
  without saying it twice. `renderPage` had no server options.
- **Alternatives considered**: a fake pull request state in the web tests, which no helper offers;
  the transcript and composer alone in the `Layout`, with the header across it, unlike the mockup; a
  `useAsideShown` in each view, which forgets a refused choice on the first message.
- **If wrong**: the test's two headings; `WithAside`'s slots in `SessionAside.tsx`.
- **Where**: Task 7.
