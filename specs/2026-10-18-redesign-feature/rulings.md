# Rulings: Redesign feature and change pages

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A done feature's lines are the net diff of its run of commits

- **Decision**: a feature merged by rebase or fast-forward counts, file by file, the sum of the net
  diffs of its spans of scoped commits on the default branch's first-parent line, each from the
  parent of its oldest commit to its newest, over commits of no feature (R80); a feature merged with
  a merge commit counts the merge's three-dot diff. Both leave out its folder and its record.
- **Rationale**: this repository merges by rebase, and its start commits sit on the default branch
  hours before the branch's commits, with other features between. Summing each commit's own diff
  gave +7,949 −2,938 for the clarifications redesign, against +6,633 −1,455 on its pull request: a
  rewritten line counted twice.
- **Alternatives considered**: the sum of every scoped commit's diff, robust but inflated; the pull
  request's `additions` from `gh`, which counts the folder and needs the network.
- **If wrong**: a figure off by what a branch rewrote; the rule lives in `history/figures.rs`.
- **Where**: task 6

## R2: A turn's tokens are the agent session's running total minus a baseline

- **Decision**: the Claude adapter sends the running total of `modelUsage`, summed over models. The
  runner stores each turn's own counts against a baseline kept by its process: zero for a new agent
  session, the sum of the session's recorded turns since its last fresh start when it resumes.
- **Rationale**: checked while planning, a resumed `claude` restores its earlier totals, and `usage`
  alone leaves sub-agents out. Idle processes close after 15 minutes, so most runs resume.
- **Alternatives considered**: a column holding the agent's last total, not in the reviewed data
  model; a baseline in memory only, lost on every server restart.
- **If wrong**: the first resumed turn after the upgrade also counts its agent session's earlier,
  unrecorded work; the feature's total stays the agent's own.
- **Where**: task 4

## R3: A draft pull request recommends its comments only when the step does not wait on the agent

- **Decision**: the step's message wins while the step waits on the agent; otherwise an open, draft,
  or changes-requested pull request recommends the comments message.
- **Rationale**: the spec's architecture orders the two, and its scenario of a draft pull request
  happens when the folder came back for a round of questions after finishing: the step then waits on
  the human. At the finish step, the draft is the one the agent is finishing.
- **Alternatives considered**: the comments message whenever a pull request exists, which would
  replace "Finish it" before the finish ran.
- **If wrong**: one condition in `recommendedMessage`.
- **Where**: task 5

## R4: The plan stage starts at the approval's decisions or the plan

- **Decision**: the Plan stage starts at the first `decision(<slug>)` or `plan(<slug>)` commit, so
  the Spec stage ends when the spec is approved and its decisions applied.
- **Rationale**: the approval step comes between the spec and the plan, and the mockup's Plan stage
  starts at the decisions' commit, 15:01, as the spec's scenario ends the Spec stage at 15:01.
- **Alternatives considered**: the plan's commit alone, leaving the approval inside the Spec stage.
- **If wrong**: one row of the stage table in `history/stages.rs`.
- **Where**: task 3

## R5: "Next" for a build reads as the mockup draws it

- **Decision**: the heading "The agent is building", and the line "Task 7 of 11: Session column".
- **Rationale**: the spec's scenario quotes both on one line, "The agent is building: task 7 of 11,
  Session column", and the approved mockup splits them into the heading and its line.
- **Alternatives considered**: one heading holding both, too long for the card on the phone.
- **If wrong**: one row of `feature/next.ts`.
- **Where**: task 8

## R6: The old anchor's search ignores the plan's own text

- **Decision**: task 1's search for `changes-requested-on-the-pull-request` expects no match outside
  the plan's text of task 1, which quotes the anchor in its own commands.
- **Rationale**: the plan names `specs` among the folders searched, so its own text always matched.
- **Alternatives considered**: rewording the plan's commands to hide the anchor, which would lose
  what they search for.
- **If wrong**: a stale link to the old anchor in `specs/`; the search shows it.
- **Where**: task 1

## R7: Until the new page, the feature page lists its notes after its problems

- **Decision**: `FeaturePage.tsx`'s "Problems" list shows the feature's problems, then its notes;
  the file badge "problem" marks blocking problems only. SC-001's walk uses the pathspec
  `'specs/20*'`, over the commits of every branch: 74 snapshots, 72 with errors, none blocking.
- **Rationale**: the plan expected `feature.test.tsx`'s removed `**Answer:**` line to be
  `answers.blank`; it is `answers.marker`, a note, on a round awaiting the human. Without the notes,
  the page between tasks 2 and 8 would lose every note, against the
  [Problems](../decisions/problems.md) decision, which shows them on the item's page. The plan's
  pathspec `'specs/20*/'` matches no commit, and `main` alone holds 37 snapshots: discovery counted
  every branch's.
- **Alternatives considered**: rewriting the existing test into an answered round with a blank
  answer, which would hide notes from the page until task 8.
- **If wrong**: one line of `ProblemList`, gone with task 8.
- **Where**: task 2

## R8: The warnings test reads the problems and the notes

- **Decision**: `crates/core/tests/api.rs`'s `a_features_problems_leave_its_warnings_out` asserts
  over `problems` and `notes` together.
- **Rationale**: it checked that a feature's results hold the check's errors, the stub spec's, and
  never its warnings. Those errors are notes now, so `problems` alone is empty; the rule it guards,
  warnings left out, is unchanged.
- **Alternatives considered**: a blocking error in its fixture, which would test something else.
- **If wrong**: one line of the test.
- **Where**: task 2

## R9: The binding's history read lives in a module of its own

- **Decision**: `readHistory` is exported from `crates/binding/src/history.rs`, as the settings'
  functions are from `settings.rs`, and a feature's change also sends its `History` live update.
- **Rationale**: `crates/binding/src/lib.rs` had 495 lines: one more export would take it past the
  code quality decision's 500. The page reads the history live, as it reads the branch's changes.
- **Alternatives considered**: the export in `lib.rs`, over the limit; a history read only when the
  page opens, stale after the agent's next commit.
- **If wrong**: the function moves back once `lib.rs` is split; the live update is one line of
  `live.ts`.
- **Where**: task 3

## R10: An unknown pull request recommends no message

- **Decision**: at the step `pull-request-unknown`, when `gh` could not read the pull request's
  state, the composer recommends nothing: "No recommended message: the feature waits on you". The
  step still waits on the agent, so a hand-over's message at it still runs.
- **Rationale**: the plan's own test expects nothing there, and the spec's edge case keeps the
  comments message out; the step's message, "Finish it", could open a second pull request beside one
  `gh` cannot see.
- **Alternatives considered**: recommending "Finish it", as the step's reference allows.
- **If wrong**: one entry of `NOT_RECOMMENDED` in `runner/message.ts`.
- **Where**: task 5

## R11: A merge commit's lines are checked against a two-dot diff of its parents

- **Decision**: task 6's merge-commit test catches a two-dot diff between the merge's parents, not
  the first parent's diff the plan named; its tests run with `--test history`; and
  `changes::outside` also leaves a finishing branch's record out of the session's changes.
- **Rationale**: for a clean merge, the first parent's diff and the three-dot diff of its parents
  are the same files and lines, so no test can tell them apart. Nextest's bare filter matches test
  names, and selected none of `crates/core/tests/history.rs`.
- **Alternatives considered**: a conflicted merge in the test, which depends on git's resolution
  text.
- **If wrong**: a figure off for a merge resolved with extra changes; the rule lives in
  `history/figures.rs`.
- **Where**: task 6

## R12: A live item starts no stage after its current one

- **Decision**: a live item's stages after the one its step is in have no start; the current stage
  may start.
- **Rationale**: found in review of task 3: a `fix(<slug>)` commit at 13:00, while the spec waited,
  started Build at 13:00 with Spec current, and Build jumped to the plan's first code commit later.
- **Alternatives considered**: leaving code commits made before the plan out of Build, which a
  change's Fix stage, with no plan, could not use.
- **If wrong**: a later stage shows no time until the step reaches it; one line of `history.rs`.
- **Where**: task 3, fixed with task 6

## R13: A done item's merge and lines are read from its finish commit

- **Decision**: a done item arrived with its `finish(<slug>)` commit: at its committer time when it
  is on the default branch's first-parent line, its lines the runs of scoped first-parent commits up
  to it and those committed within ten minutes after it, its review fixes (R80, R81); otherwise
  through the oldest first-parent merge commit that has it.
- **Rationale**: found in review of task 3: a `fix(<slug>)` commit made on `main` after the merge
  moved the merge to its time, and took the lines from its run alone. Rebased commits also often
  share one committer time, so the newest scoped commit by that time could be any of the run.
- **Alternatives considered**: the newest scoped commit, as task 3 built it.
- **If wrong**: a merge timed to the finish of a feature reopened after merging; the rule lives in
  `history/figures.rs`.
- **Where**: tasks 3 and 6

## R14: The history reads its one folder, and a done item's walk starts at its record

- **Decision**: `read_history` reads the workspace with only its folder, `Workspace::read_folder`,
  which skips every other branch's and record's read and gives the same feature. A done item's walk
  starts at the first-parent commit that added its record, found by
  `git log --first-parent --diff-filter=A -1 -- <record>`, and stops at the folder's date as before.
  A rebased item's first-parent line, for its runs, is read by
  `git log --first-parent --since=<folder's date minus a day> --until=<finish plus ten minutes>`
  from the default branch's tip that holds the record, git stopping at the first commit older than
  the bound (R80, R81).
- **Rationale**: found in review of task 3: the whole workspace took about 200 ms of a read in a
  debug build here, and a done item's walk from the default branch's tip grew with every later
  feature. The benchmark went from 73 ms to 24 ms; on this repository, 2026-10-12-finish-feature
  reads in 92 ms, 2026-10-17-redesign-clarifications in 123 ms, and the slowest record,
  2026-10-16-redesign-interface, whose days hold 500 commits, in 251 ms, all debug builds. gix has
  no path-limited log; the [Git](../decisions/git.md) decision runs the system `git` for such reads,
  as `first_parent_changes` does, and git stops at the addition.
- **Alternatives considered**: `first_parent_changes`, which walks to the root, 97 ms against 7 ms
  here; a walk of the first-parent line checking each tree for the record, slower in gix.
- **If wrong**: a feature read alone that differs from the workspace's, which
  `a_folder_read_alone_is_the_workspaces` compares; a record deleted and added again starts the walk
  at its second addition.
- **Where**: tasks 3 and 6

## R40: A new agent session in a process says so, and its first total is its turn's own

- **Decision**: a reported total lower than the process's baseline in any field starts a new agent
  session: the turn gets the whole total. An `init` with a new session ID, `/clear`, adds the system
  line "Started a new session: the agent cleared the turns above." to its turn, and
  `agentSessionTokens` starts at it, as at `FRESH` and `REPLACED`. A fresh turn taken back while its
  process opened leaves its `FRESH` line to the next turn started on that process.
- **Rationale**: the plan clamped a lower total to zero, losing the new agent session's first turn,
  and a later resume summed the previous agent session's turns into its baseline, counting the new
  one's turns twice. An agent session's running total never decreases, and the baseline of a resume
  needs a mark in the turns where the agent session started.
- **Alternatives considered**: a column of the turns holding their agent session's ID, a migration
  for one case; the lower-total rule alone, which counts a resumed agent session's earlier turns
  again.
- **If wrong**: `processes.ts`'s `tokens`, and the `init` case of `transcript.ts`.
- **Where**: task 4, after its review

## R50: A workflow message sent as a chat opens the chat

- **Decision**: a workflow message that no longer applies, sent as a chat, gets the chat opening as
  any chat does: when it is the session's first turn, or follows a workflow run.
- **Rationale**: without it, the next chat saw a chat turn last and got no opening either, so after
  a run the agent was never told a human is chatting, against the agents decision: a chat after a
  run opens by saying a human is chatting, so the agent acts only when asked.
- **Alternatives considered**: the plan's message sent as written, with the opening left to the next
  chat, which would treat a chat turn as a run in `#opens`.
- **If wrong**: one condition of `#send` in `runner/sessions.ts`.
- **Where**: task 5

## R30: The composer holds the inserted message's run

- **Decision**: `Composer` keeps the run of an inserted recommended message, `{ step, trigger }`, in
  its own state, behind a `recommended` flag the feature's session sets; the page's `workflow`, a
  hand-over's, wins over it. The human emptying the field drops it, and a sent message clears it.
  The offer reads the recommendation itself, under `Suspense`, and is hidden while the composer is
  unavailable, which already says why. US4.1's test runs on `2026-10-12-cli-tuis`, the fixture's
  feature whose plan waits on the agent.
- **Rationale**: the composer clears its field as it sends and puts the text back on a refusal: only
  it tells the human's emptying from its own, so a refused send keeps its run. The session page then
  draws before the recommendation is read. Without the agent or a branch, the reason repeated the
  composer's own line. The plan's `2026-10-11-web-ui` waits on the human's answers in the fixture.
- **Alternatives considered**: the run in `FeatureSession`, cleared when the draft's text empties,
  which a refused send would also clear; the record read by `FeatureSession`, which would suspend
  the whole page on it.
- **If wrong**: the state moves to `FeatureSession`; one hook in `RecommendedMessage.tsx`. Its fresh
  session switch is the hand-over's, keyed by each insert rather than by the address.
- **Where**: task 7

## R31: A refused hand-over's tests send a chat

- **Decision**: `commit-actions.test.tsx`'s "a hand-over refused once read" and "a session opened to
  continue a feature that waits on you" now expect the notice, no "Start the agent", and Send
  sending the composer's text as a chat; they no longer expect a disabled "Start the agent".
- **Rationale**: they checked that a refused workflow message never went as a chat. Since task 5,
  the server sends a stale workflow message as a chat, and the spec asks that anything typed can
  always be sent (US4, review focus 8): the composer no longer disables itself on a refusal.
- **Alternatives considered**: keeping "Start the agent" disabled beside a chat's Send, two buttons
  for one message.
- **If wrong**: the `refused` check comes back in `Composer.tsx`.
- **Where**: task 7

## R20: The page's header keeps the app's crumbs

- **Decision**: the feature page opens with the crumbs every page of a feature has, "Home ›
  <title>", in place of the mockup's muted "Features ›".
- **Rationale**: no page lists the features for "Features" to lead to, and the crumbs are the way
  back from the page's own files and session, which the tests already walk.
- **Alternatives considered**: the mockup's "Features ›" as plain text, which leads nowhere.
- **If wrong**: one line of `feature/FeaturePage.tsx`.
- **Where**: task 8

## R21: The tests of a change's session open it at its own address

- **Decision**: the tests that opened a change's session at `/f/<change>` open it at
  `/f/<change>/session`, and a change's session has the crumbs back to its page, as a feature's has.
  The old agent panel's tests that never opened the feature page move to `session-turns.test.tsx`;
  its US2.5 test opens the session at `?continue=manual`, as a hand-over does, since "Review and
  start the agent" is gone. `links.test.ts` and the layout tests wait for the new page's texts, "You
  answer the questions" and "Open the session".
- **Rationale**: US3 gives a change the feature's page, so `/f/<change>` no longer is its session; a
  change's session without crumbs had "no other page to go back to" (US4.6 of the change workflow),
  which no longer holds. Each moved test checks what it checked before.
- **Alternatives considered**: moving the session's tests into `feature-page.test.tsx`, as the plan
  said, where they would test a page they never open.
- **If wrong**: the paths of the changed tests, and one condition of `Crumbs.tsx`.
- **Where**: task 8

## R22: The stages keep each part of a line whole, their indicators on the track

- **Decision**: on a wide screen the stages draw their indicators on the track, and each part of a
  stage's line, a time or a duration, holds no-break spaces: a line too long for its stage, "Oct 13,
  00:01 · 18 h 9 min", breaks between its parts only. No `white-space: nowrap`.
- **Rationale**: beside the sidebar, a stage is about 155 px wide; with the indicator's gutter,
  "12:11 · 2 h 50 min" wrapped. A `white-space: nowrap` on the stages let a dated line run over the
  next stage, and its StyleX class, injected after the others in the browser tests, broke the
  overflow checks of the session's and the sidebar's long lines.
- **Alternatives considered**: `text-wrap: nowrap`, which runs a dated line over the next stage; the
  mockup's separated indicators, which wrap every duration of hours.
- **If wrong**: two props of `feature/Stages.tsx`; task 10's screenshots show it at both sizes.
- **Where**: task 8

## R23: The agent's card shows its own trouble, and always opens the session

- **Decision**: the card reads "Working" while a turn runs, the session's "Needs attention" after a
  failed, stopped, or halted run, and "Needs you" for a blocked action; otherwise "Idle", even while
  the feature waits on the human, which "Next" says. "Open the session" shows on every item's page,
  a done one's and one without a session included; "Last run" gives a turn's time once it ended.
- **Rationale**: SC-003 asks for one "Open the session" on every page, so the old "no panel" tests
  go. A run that failed is the agent's state, which the old panel showed and its tests kept. A
  running turn's time would stand still between live updates: the React Compiler refuses
  `Date.now()` in a render.
- **Alternatives considered**: the session's status label always, which reads "Needs you" while the
  spec waits, against US1 more 3's "Idle".
- **If wrong**: the `State` part of `feature/AgentCard.tsx`.
- **Where**: task 8

## R24: The open pull request's page test fakes `gh` on the PATH

- **Decision**: `feature-page.test.tsx` puts a `gh` script on the PATH that lists pull request #31,
  and reads it once with the binding's `refreshPullRequests`, as `crates/cli/tests/next.rs` fakes
  `gh` for the CLI. The server, its binding, and the page run as they do.
- **Rationale**: `pulls.test.ts` fakes the binding's functions, not `gh`; the PATH script leaves
  every layer real, and fakes no server response.
- **Alternatives considered**: a binding whose `readFeature` returns a pull request, a fake of the
  server's answer, which the preview decision forbids in stories and the UI checks avoid.
- **If wrong**: the `fakeGh` helper of the test.
- **Where**: task 8

## R80: A rebased feature's lines are its spans of commits, other features' left out

- **Decision**: for a done item merged without a merge commit, its scoped commits on the default
  branch's first-parent line, from the folder's date minus a day, are grouped into spans: a span
  runs from the first parent of its oldest commit to its newest, and keeps going over commits of no
  feature, such as a branch's own `chore: add … to the inbox`; a commit scoped by another feature
  ends it. The lines are the sum, file by file, of each span's net diff, outside the folder and the
  record; `files` the distinct paths. The decisions are each decision file a span touched, compared
  between the oldest span's base and the newest span's tip.
- **Rationale**: found in review of task 6: the branch of `2026-10-17-redesign-specs` holds
  `chore: add … to the inbox` among its rebased commits, which cut the run at it: the record read
  +8,482 −2,855 over 146 files and 1 decision. Summing the runs on each side of it gave +15,371
  −6,011, a file rewritten on both sides counted twice. As spans, it reads +13,364 −4,127 over 218
  files and 18 decisions: the branch's net diff, with its review fixes (R81).
- **Alternatives considered**: one diff from the oldest commit's base to the newest, which counts
  every other feature's commits between the start and the branch; runs cut at any unscoped commit,
  which count a rewritten file twice; each commit's own diff (R1).
- **If wrong**: a figure off by a commit of `main` with no scope that a rebase put inside the
  branch's span; the rule lives in `history/figures.rs`.
- **Where**: task 6, fixed after its review

## R81: A rebased feature's review fixes arrive with its finish, within ten minutes

- **Decision**: a done item merged without a merge commit also counts, in its lines and decisions,
  its scoped commits on the first-parent line committed within ten minutes, committer time, after
  its finish commit's: the pull request's review fixes, rebased with it. Its merge stays the finish
  commit's arrival, at its committer time (R13).
- **Rationale**: found in review of task 6: `53d8b999`, `be0da469`, and `bc786912`, the review fixes
  of `2026-10-17-redesign-specs`, come after its finish `340ce6ab` and share its committer time, yet
  were left out; with them the record reads +15,371 −6,011 over 224 files. A rebase writes its
  commits within seconds, and a `fix(<slug>)` committed to `main` hours later is no review fix. The
  finish's committer time is the batch's too, or within ten minutes of it, so moving the merge to
  the batch's newest commit would change no day the page shows.
- **Alternatives considered**: every scoped commit after the finish, which counts a later fix on
  `main`; the merge timed to the batch's newest commit, which a later push within ten minutes would
  move.
- **If wrong**: a review fix pushed more than ten minutes after the rebase left out, or a fix
  committed straight to `main` within ten minutes counted; `BATCH_SECONDS` in `history/figures.rs`.
- **Where**: task 6, fixed after its review

## R82: A done item's diffs and decision comparisons run at once

- **Decision**: `Git::numstats` runs the `git diff --numstat` of each run of commits at once, one
  thread per process, and `history/figures.rs` compares each changed decision on its own thread.
- **Rationale**: with every run counted (R80, R81), `2026-10-17-redesign-specs` needs three diffs
  and 18 comparisons, and read in 113 ms in a release build, 378 ms in a debug one; at once, 57 ms
  and 163 ms. `2026-10-16-redesign-interface` reads in 67 ms, `2026-10-17-redesign-clarifications`
  in 49 ms, and SC-002's benchmark in 13 ms, all release builds. A `Git` holds a gix repository no
  thread can share, so the threads run `git` in its root.
- **Alternatives considered**: gix's own diff, which counts lines through a blob diff the core does
  not have; one process per run, in turn, as before.
- **If wrong**: a slower page for a feature of many runs or decisions; `Git::numstats` and
  `decisions` in `history/figures.rs`.
- **Where**: task 6, fixed after its review

## R60: A figure's tests read its group, and the decision's pill reads "New"

- **Decision**: each figure is a group named by its label, inside its card or its clickable card;
  the tests read a figure's text from that group, its link only for where it leads, and they find
  the figures inside the "What it produced" region. The decision card's pill reads "New", as the
  spec page draws it.
- **Rationale**: the clickable card's link is a hidden element inside the card, so the plan's
  `within(link)` found none of its text; the sidebar has a "Decisions" link of its own, so
  `/^Decisions/` matched two links; `DecisionCard` writes its kind as "New", not "new".
- **Alternatives considered**: the figure's text inside its link, which the clickable card does not
  do; a `Link` around the card, a second way of drawing the same card than Home's tiles.
- **If wrong**: the helpers `figureCard` and `produced` of `feature-done.test.tsx`.
- **Where**: task 9

## R61: A done feature shows its five figures, a done change those it has

- **Decision**: a done feature shows all five figures, as US2 lists them: "Questions" reads "0" and
  "no round" without a round, and "Decisions" "0", both plain cards at zero. A done change shows
  "Questions" only after a round, and "Decisions" only when one changed, as the mockup's merged
  change shows neither. "Not recorded" has no caption. A done item not found on the default branch
  reads "Not found on the default branch" in place of all its figures, tokens included. The done
  page keeps its files under the figures, the record's row included.
- **Rationale**: the spec's row of figures names all five for a feature; a change's zero leads to
  nothing to open, and its mockup leaves them out; the mockup's "before Oct 19" names a date the
  server does not have when no turn was counted; the spec's squash edge case says its figures read
  the line. Task 8's test of a merged feature expects the record's row in the files.
- **Alternatives considered**: a feature's zeros hidden, against US2's row of five; zeros leading to
  sections that are not drawn; the tokens kept beside the line, against the spec's wording.
- **If wrong**: `doneFigures` and `Figures` in `feature/Figures.tsx`.
- **Where**: task 9

## R70: A run after a spec's approval sent without `fresh` follows the setting on the server

- **Decision**: a workflow run at the approval or plan step whose message carries no `fresh` starts
  a fresh agent session as the `build_in_fresh_session` setting says: `session.send` passes the
  setting in force as the input's `freshByDefault`, and the runner takes it on when not given. An
  explicit `false`, the switch turned off, now reaches the runner and stays false.
- **Rationale**: the composer reads the setting after a message is inserted; "Start the agent"
  pressed before that sent no `fresh`, which the server read as false, against the agents decision.
  A failed settings read draws nothing and leaves the default to the server.
- **Alternatives considered**: the setting given to the session manager as it is made, which the UI
  tests' harness makes before the settings; the client waiting for the setting before Send.
- **If wrong**: the `fresh` line of `runner/sessions.ts#send`, and the workflow's spread in the
  `session.send` mutation.
- **Where**: review fixes of tasks 7 and 8

## R71: A long "Insert: <name>" wraps inside its button

- **Decision**: the recommended message's button shows its label in a span that wraps, the button's
  height growing from a control's: at 1024 px, beside the sidebar and the column, "Insert: Continue,
  implement the plan" takes two lines. Its accessible name stays the label.
- **Rationale**: the label held on one line kept the composer about 50 px wider than its place, and
  the progress column covered Send.
- **Alternatives considered**: an ellipsis, which the layout checks refuse as cut text; a shorter
  visible label, which hides the message's name; the offer outside the footer, where the plan puts
  it.
- **If wrong**: the two styles of `RecommendedMessage.tsx`.
- **Where**: review fixes of tasks 7 and 8

## R90: A figure's in-page link scrolls in place, without a history entry

- **Decision**: a figure leading to a detail of the page, `#stages`, `#files`, `#questions`, or
  `#decisions`, keeps its link and its address, but a tap or a key opens the detail when it is
  folded, as the questions are, scrolls to it below the top bar, and moves the focus there, in the
  same history entry; the address keeps no hash. Caught around the figures, so the card's surface
  and its hidden link both reach it; a modified click and a detail not drawn yet are left to the
  browser.
- **Rationale**: the browser's own jump pushes an entry without the page's state: the open items
  stopped being kept, and Back neither restored them nor scrolled back. `RoundSubmit`'s links to the
  questions left jump the same way.
- **Alternatives considered**: an entry pushed through the router, which gives the page a new id its
  views do not write into; in-page links handled by `RouterAnchor` for the whole app, which
  `useHashFold` relies on the browser for; buttons in place of the links.
- **If wrong**: `jumpInPage` in `feature/Figures.tsx`, and `Produced`'s `onOpen`.
- **Where**: task 9

## R91: The record's questions fold under a title, not a heading

- **Decision**: "Questions · N in R rounds" is the fold's button, its text drawn at a heading's
  size, and its section is named "Questions"; no heading sits inside the button.
- **Rationale**: a button's content is phrasing only, and its children lose their role: the mockup's
  heading in the trigger was read as plain text. The spec page's folded history does the same.
- **Alternatives considered**: a heading wrapping the button, which Astryx's `Collapsible` does not
  draw; a heading above the fold, a second line saying the same.
- **If wrong**: `Questions` in `feature/Record.tsx`.
- **Where**: task 9
