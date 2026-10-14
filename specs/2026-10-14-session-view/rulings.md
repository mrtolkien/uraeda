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

## R17: The layout wraps the page at every width, its column at the window's edge

- **Decision**: `WithAside` always draws the `Layout`, with the session's `Page` as its content, and
  only adds or removes the `end` panel. The `Layout` is outside the `Page`, not inside it.
- **Rationale**: the task's review found that drawing the page bare when the column was hidden, or
  on a phone, remounted the crumbs, the header, the transcript, and the composer at each fold or
  change of width: the focus fell to the page's body, following watched a detached log, and an error
  under the composer vanished, against "Errors MUST stay on screen". Inside the `Page`, the column
  shared its 720 px below 1024 px, leaving the transcript about 336 px, and floated mid-screen on a
  wide window, where the mockup puts it at the window's edge.
- **Alternatives considered**: keeping the page's state above the switch, which still moves the DOM
  and its focus; a `key` kept on the content, which React does not keep across parents.
- **If wrong**: `WithAside` in `SessionAside.tsx`, and the two `Page`s it wraps in
  `SessionPage.tsx`.
- **Where**: Task 7, after its review.

## R18: The column's step reads as a gate, and its reads fail alone

- **Decision**: the column's first heading is `waiting(feature).title` while the step waits on the
  human, like "Review the plan" or "Write the proposal", and `stepLabel` otherwise. Each of its
  reads has its own error boundary, which leaves the section out when the read fails. A choice
  storage refuses is kept in a module variable for the document's life. The `BranchChanges` source
  answers a repository without `specs/` as having no changes, without a log, as it answers a folder
  that is no feature's.
- **Rationale**: the task's review found the heading showing the core's raw `human-gate` and `none`;
  Home already names a gate with `waiting`. One failed read took the whole page down to the server's
  error banner, transcript included. Pages are drawn anew at each address, so a choice kept in a
  component's state was lost on the next session. A repository whose `specs/` went away under an
  open page is not a git failure, and was logged as one in a web test.
- **Alternatives considered**: new labels for `human-gate` and `none` in `labels.ts`, which say less
  than the gate's own words; one boundary around the whole column, which would hide the feature's
  links with a failed diff; treating "no specs/ folder" as missing in every source, which changes
  the other sources' answers.
- **If wrong**: `stepTitle` and `Section` in `SessionAside.tsx`, and one condition in
  `branchChanges` of `sources.ts`.
- **Where**: Task 7, after its review.

## R19: The phone's line is Astryx's Collapsible, and the page keeps the line read

- **Decision**: the phone's progress line is an Astryx `Collapsible`, its trigger the button with
  `aria-expanded`, its content `SessionAside`, drawn only while open. Its step reads as the column's
  heading, through `stepTitle`, so a plan in review reads "Review the plan". The line lives in
  `ProgressLine.tsx`. `useKeepPlace`, in `Session`, keeps the transcript's line read a third down
  the window where it was as the width class changes, or the end in view, and the browser test
  checks that line's place rather than an equal `scrollY`. The browser tests gain an
  `addPlan(folder)` command, for the plan's link and the "7/11" line.
- **Rationale**: a `Button` has a fixed height and one line, which a long task title would cut on a
  402 px screen, and the `Collapsible` is Astryx's component for a disclosure, with its chevron, as
  the mockup draws it. Crossing 768 px, WebKit first lays the page drawn for the old width out at
  the new one, the column squeezing the transcript to a page 15,000 px tall, then clamps the
  position at the end once the new layout is drawn: the page jumped to its end and started following
  it. The same `scrollY` at 402 and 1440 px is not the same place, as text sizes and widths change:
  what the human reads is. `SessionPage.tsx` is near the 500-line limit.
- **Alternatives considered**: the plan's `Button`; an equal `scrollY`, which only holds without the
  clamp, at another place of the text; hiding the column with a media query, against the UI layout
  decision's rule on media queries; anchoring on the element under a point, which is a message's
  padding between two lines.
- **If wrong**: `ProgressLine.tsx`, `useKeepPlace.ts`, and the width test of
  `__browser__/session.test.tsx`.
- **Where**: Task 8.

## R20: The place read follows what moves, and the line folds back

- **Decision**: `useKeepPlace` reads the place again on a `ResizeObserver` of the page and the
  transcript, through the same frame as a scroll, and takes as the place a block holding text of its
  own across the reading line, though its children, like inline code, are above it. The line's open
  state lives in an inner `Line`, which the wide layout removes; leaving because the window turned
  wide writes `progress: false` to the entry, so the line comes back folded. The open content is a
  region labelled "Progress", and the trigger holds the row's inset, so all of the bordered row but
  the chevron's 8 px margin toggles it. Back's scroll restore is not held until the open line's
  reads resolve: the session's page restores once its own data is drawn, and the line's reads are
  those the session already made, so US3.3 waits for the plan's link with `findByRole`.
- **Rationale**: the task's review found the place stale after the line opened without a scroll: the
  next width put back an element the human no longer read, 817 px away in the browser test, and a
  paragraph with inline code above the line was passed over for the next block, 1,168 px away. The
  spec says the column becomes the collapsed line. A message's padding under its text, with no text
  of its own, is still passed, as R19 found. Holding the restore would need the sections' suspense
  above `useRestoreScroll`, a change to every page's restore for a read already cached.
- **Alternatives considered**: re-reading on the line's toggle only, which misses a tool group
  opened in the transcript; resetting the state in an effect, which the React compiler's lint
  refuses; a theme override of every `Collapsible`'s trigger padding, which would move the spec's
  folds too.
- **If wrong**: `firstFrom` and the observer in `useKeepPlace.ts`, `useLineOpen` in
  `ProgressLine.tsx`, and US3.3's wait.
- **Where**: Task 8, after its review.
