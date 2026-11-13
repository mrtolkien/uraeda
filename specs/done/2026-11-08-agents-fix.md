---
kind: feature
finished: 2026-11-09
pull-request: https://github.com/mrtolkien/uraeda/pull/119
supersedes: [2026-10-30-feature-state, 2026-11-03-worker-lifecycle]
---

# Record: Agents catch up open pull requests with main

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-08, finished on
> 2026-11-09, in [its pull request](https://github.com/mrtolkien/uraeda/pull/119). Its full files
> are in git: `git log -- specs/2026-11-08-agents-fix/`.

## What and why

Merging one pull request left the other open ones behind main, and the human restarted each one's
agent by hand: "I start 4 features before going to sleep, then have to restart 3 after merging the
first." An open pull request behind main now has a step of its own, "Catch up", whose run rebases
the branch on main, validates it, and pushes it, then waits for review again. With a switch the
human turns on, Uraeda starts that run by itself as soon as it sees main move, without a pull, and a
conflict that needs the human's choice stops it with a comment on the pull request.

## Behaviour

- **An open pull request behind main reads "Catch up"**, the agent's step `catch-up`, everywhere a
  step shows and in `ura next`, for features and changes alike. It applies to a pull request open
  for review, unpushed or not: a draft, changes requested, and an unknown state keep their steps. It
  wins over Push, since the catch-up pushes.
- **Behind** means: the branch's newest tips, local and `origin/<branch>`, all lack the tip of
  `origin/<default>` (the local default branch without a remote). When one tip holds the other, only
  the newer counts; both count when they diverged. The commits lacked must also change a file
  outside the default branch's own: `PRIORITIES.md`, `INBOX.md`, `INBOX-TRIAGE.md`,
  `DECISIONS-CHECK.md`, `decisions-check/`, `proposals/`, `notes/`, and a started folder's
  `proposal.md`, under `specs/`. A branch whose tip `origin/<default>` already holds is merged, not
  behind.
- **Main is seen moving without a pull**: through the server's fetch every 5 minutes, a pull, or a
  push. A merge in the local main alone triggers nothing until `origin/main` holds it.
- **The switch "Catch up open pull requests"**, in Settings › Runs, is off by default. It is
  `catch_up_pull_requests` in `[runs]`, `--catch-up-pull-requests` turns it on for one run, and
  `URAEDA_CATCH_UP_PULL_REQUESTS` reads `true` or `false`. A change applies at once: turning it on
  catches up every feature already at "Catch up"; turning it off lets a running catch-up finish and
  starts no other.
- **With the switch on, the catcher** sends the step's message to the feature's latest session, once
  per tip of main, across restarts. The session first shows "Catching up with main, which moved to
  “<subject of the commit>”." It skips a feature without a session, one that needs attention, and
  one with a session at work, which it catches up once that turn ends. It sends only while the
  feature is still at "Catch up" for the same commit. Main moving again during a catch-up gets one
  more catch-up for the new tip.
- **The catcher runs** on each watcher burst once the pull-request refresh that burst asks has
  ended, on each refresh that changed the pull requests, on each turn's end, and on each change of
  the settings. A repository's runs go one at a time. The server's stop waits for the runs in
  flight.
- **A catch-up that ends at the pull request again does not notify**: the notification's key skips
  turns sent at `catch-up` when the feature asks for a review.
- **A catch-up stops on a conflict** when resolving needs a choice the spec and the decisions do not
  settle, when a new decision on main conflicts with the branch, or when the complete validation
  fails in a way it cannot fix. The agent goes back to the tip it noted, pushes nothing, and
  comments on the pull request: the files or checks, the choice, and its recommendation.
- **The stop reads "Needs attention"**, notifies, and its session's banner reads "The catch-up
  stopped on a conflict." with "It left the branch as it was, and asked on pull request #N how to
  settle a conflict. Answer there by requesting changes, or dismiss this." The server reads it from
  a done turn, in the folder's latest session, that caught up with the step's current commit. A
  retry allowed after a refused action, or an automatic continue, keeps that commit and reads the
  same. A dismissal reads idle, ends no turn, and starts no catch-up until main moves again.
- **Continue and Continue all** send the catch-up's message too. Continue all includes a feature at
  "Catch up" that reads idle or with a new reply. It leaves alone one whose catch-up already ran for
  main's current commit, a dismissed conflict included, but continues a catch-up the human stopped.
- **A turn before the catch-up halted nothing**: at "Catch up", only a catch-up's own turn can read
  as stopped; an earlier turn reads idle or with a new reply.
- **The skill** has the step in the tables of `SKILL.md` and the change reference, `catch-up` in
  `ura next`, and the section "Catch up an open pull request". The comments pass catches the branch
  up first when it is behind. A ruling the catch-up needs goes under the record's **Changes after
  approval**.

## Design

The rule lives in the workflow, so the core, `ura next`, and an agent without the server agree; the
server only starts the step's run, as it continues others. Every pull request behind catches up, so
nothing simulates a merge: the core compares the branch with the default branch's tip, and keeps its
answer by the pair of tips, so a read with no tip moved computes no diff.

- The behind rule, [`behind.rs`](/crates/core/src/behind.rs): `catch_up`, `newest`, `compute`, and
  `default_branch_own`, which owns the list of the default branch's own files that the skill copies.
  `changed_paths` and `subject` in [`git/diff.rs`](/crates/core/src/git/diff.rs).
- The step: `PullRequest::Behind` and `StepName::CatchUp`, with `Step.catch_up` (the default
  branch's name, commit, and subject), in [`steps.rs`](/crates/core/src/steps.rs); applied to an
  open pull request in [`pulls.rs`](/crates/core/src/pulls.rs); `CatchUpView` in
  [`view.rs`](/crates/core/src/view.rs). The key and `ContinueKey::CatchUp` in
  [`settings.rs`](/crates/core/src/settings.rs).
- The catcher, [`catch-ups.ts`](/packages/server/src/catch-ups.ts): `due`, `serially`, and
  `catcher`, sending through `continueOne` in
  [`continue-all.ts`](/packages/server/src/fate/continue-all.ts), which also holds Continue all's
  `ranFor`. Its triggers: `settled` in [`repositories.ts`](/packages/server/src/repositories.ts),
  after the refresh `onChanges` returns in [`pulls.ts`](/packages/server/src/pulls.ts), and
  `openParts` and the stop in [`server.ts`](/packages/server/src/server.ts).
- The turn: `caught_up_to` in the session cache, a migration in
  [`migrations.ts`](/packages/server/src/runner/migrations.ts) and `caughtUp` in
  [`cache.ts`](/packages/server/src/runner/cache.ts); kept by continues in
  [`send.ts`](/packages/server/src/runner/send.ts) and by retries in
  [`allow.ts`](/packages/server/src/runner/allow.ts). The work line and `catchUpLine` in
  [`message.ts`](/packages/server/src/runner/message.ts).
- The status: the `conflict` reason in `sessionStatus` and `continuedByAll`, in
  [`status.ts`](/packages/server/src/runner/status.ts); the notification's `askedBy` in
  [`needs-you.ts`](/packages/server/src/fate/needs-you.ts).
- The web UI: the banner in [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx), the
  switch in [`RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx), and the step's label in
  [`labels.ts`](/packages/web/src/labels.ts). The approved mockups stay in
  [`CatchUpMockups.stories.tsx`](/packages/web/src/CatchUpMockups.stories.tsx).
- The skill:
  [Catch up an open pull request](/skills/uraeda/references/implementation.md#catch-up-an-open-pull-request);
  the user's docs in [the web UI's page](/docs/app.md).
- Tests: `behind_main_rows` in [`steps.rs`](/crates/core/tests/steps.rs), `behind_rows` and the
  memo's tests in [`pulls.rs`](/crates/core/tests/pulls.rs);
  [`catch-ups.test.ts`](/packages/server/src/__tests__/catch-ups.test.ts) and
  [`catch-ups-server.test.ts`](/packages/server/src/__tests__/catch-ups-server.test.ts).

## Replaced behaviour

- **An open, ready pull request reads "PR ready" whatever main gained since**, from
  [2026-10-30-feature-state](2026-10-30-feature-state.md). Guarded by `pull_request_rows` and
  `finishing_rows` in [`steps.rs`](/crates/core/tests/steps.rs), and
  `an_open_pull_request_and_the_implementation_keep_their_steps` in
  [`pulls.rs`](/crates/core/tests/pulls.rs). They keep their cases, which are not behind main; the
  behind ones are `behind_main_rows` and `a_pull_request_behind_the_default_branch_catches_up`.
- **Continue all sends a message only to runs that ask for you**, from
  [2026-11-03-worker-lifecycle](2026-11-03-worker-lifecycle.md). Guarded by "US5: Continue all sends
  each stopped run its step's message, and none to a gate" in
  [`continue-all.test.ts`](/packages/server/src/__tests__/continue-all.test.ts), joined by "Continue
  all sends an idle catch-up its message" and the conflict and stopped cases after it.
- **A finished turn whose step now waits on the agent reads "The agent stopped before a human
  gate."**, from [2026-11-03-worker-lifecycle](2026-11-03-worker-lifecycle.md). At "Catch up", it
  holds only for a catch-up's own turn. Guarded by the halted rows of
  [`status.test.ts`](/packages/server/src/runner/__tests__/status.test.ts), joined by "an earlier
  turn at Catch up" and the catch-up rows.

No test was removed.

## Gotchas

- **`changed_paths` lists a rename's two paths**: gix's default diff options detect no renames, so a
  rename reads as a deletion plus an addition. A proposal moved into a started folder then counts
  both paths, both the default branch's own. See [`git/diff.rs`](/crates/core/src/git/diff.rs).
- **A tip main holds is merged, and the catcher waits for the pull requests' refresh**: GitHub
  merges a pull request before `gh` reports it. The fetch moves `origin/main` while the snapshot
  still reads it open, and a squash merge leaves no ancestry. See
  [`behind.rs`](/crates/core/src/behind.rs) and
  [`repositories.ts`](/packages/server/src/repositories.ts).
- **Vite's close awaits the server's stop**, through the plugin's `closeServer` hook: an
  `on("close")` listener was not awaited, so a sandbox test's end deleted folders its turns and the
  catcher still wrote in. See [`vite.config.ts`](/packages/web/vite.config.ts) and
  [`dev.ts`](/packages/server/src/dev.ts).
- **`SKILL.md` stays under 20,000 characters**, which [`skill.rs`](/crates/cli/tests/skill.rs)
  checks: the catch-up's rows pushed it over, so how follow-ups are answered moved to
  [Writing for the human](/skills/uraeda/references/writing.md).

## Questions

### Round 01

#### Q1: Which open pull requests should catch up when main moves?

**Answer:** "B: Just always trigger it to make sure the code is coherent. It's not that big." Every
pull request behind main whose new commits change code, decisions, or records catches up.

#### Q2: What should make Uraeda look at the open pull requests?

**Answer:** A: the remote main moving, however Uraeda learns it: a pull, a push, or its own fetch
every 5 minutes.

#### Q3: Should a pull request that needs a catch-up still read "ready for review"?

**Answer:** A: no, a new step, "Catch up", agent work everywhere; the switch only decides whether
Uraeda starts it by itself.

#### Q4: Where should a catch-up that cannot settle a conflict ask you?

**Answer:** A: the agent leaves the branch as it was and comments on the pull request; the human
answers by requesting changes.

#### Q5: Should the catch-up rebase the branch, or merge main into it?

**Answer:** A: rebase on main and push with `--force-with-lease`, read as allowed by the git
decision since the lease never loses work.

#### Q6: Where should the switch live, and should it be on by default?

**Answer:** B: one switch, "Catch up open pull requests", in Settings › Runs and `[runs]`, off by
default.

#### Notes

- **There is no opt-out per pull request**: "There should be a global opt-out though, and the
  feature should be off by default."

## Decisions

- [Run lifecycle](../decisions/run-lifecycle.md), changed: an open pull request behind the default
  branch is caught up by itself only when the human turned it on, at most once per tip; every
  automatic run, not only a continue, says why and has its switch.
- [Feature status](../decisions/feature-status.md), changed: a pull request reads ready only when
  its branch also holds every change of the default branch beyond its priorities, inbox, proposals,
  and notes.

## Changes after approval

- A branch holds main's tip when its local tip or `origin/<branch>` does: GitHub's "Update branch"
  catches up the remote one first. Only the newest tips count, so a stale local tip main merged does
  not hide a remote branch gone on.
- A branch whose tip main already holds is merged, not behind: the fetch moves main before `gh`
  reports the merge.
- The catcher runs on a watcher burst only once the pull-request refresh it asks has ended, and on
  each refresh that changed them, so a merge `gh` has not reported yet is not caught up.
- The catcher skips a feature without a session, and one that needs attention, as a run the human
  stopped.
- A catch-up reads stopped on a conflict only for the tip it caught up with, and only in the
  folder's latest session: one that pushed while main moved again leaves the next catch-up to run.
- An automatic continue and an allowed retry of a catch-up keep its commit, so their stop reads as
  the catch-up's; a queued catch-up started as a chat drops the commit, and its line gives way to
  the chat's.
- A dismissal ends no turn: it no longer reaches the turn's-end listeners nor the extensions'
  `turn-ended`, so a dismissed conflict starts no catch-up or Storybook.
- A second conflict, after the first was dismissed, notifies again: only a ready pull request's ask
  skips the catch-up's turns in the notification's key.
- The catcher sends only while the feature is still at "Catch up" for the commit it read.
- Continue all leaves a catch-up already run for main's current commit, a dismissed conflict
  included, and continues one the human stopped.
- A complete validation the catch-up cannot fix stops it as a conflict.
- The server's stop waits for the catcher's runs in flight, and Vite's close waits for the server's
  stop and the sandbox's turns at work.

## Follow-ups

- The feature page's "Next" help for the step, "The agent catches the branch up with main", and the
  switch's help in Settings say "main" literally, whatever the default branch's name.
- Per-feature overrides of the switch wait for Run options.
