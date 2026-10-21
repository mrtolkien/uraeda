---
kind: feature
finished: 2026-10-21
pull-request: https://github.com/mrtolkien/uraeda/pull/54
---

# Record: Fix testing

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-21, in [its pull request](https://github.com/mrtolkien/uraeda/pull/54). Its full files are
> in git: `git log -- specs/2026-10-19-fix-testing/`.

## What and why

Tests, locally and in CI, were slow, flaky, and mostly pointless: CI took 12 to 16 minutes and
failed 15 of its last 20 runs, mostly on tests pinned to text, counts, or pixel sizes. The human
wanted fewer, meaningful tests that check core behaviour across systems, and skill wording that
stops agents writing noise or bending the human's intent to pass a test. Above all, a fast loop
after each task, without trading away quality: running 15 minutes of tests per small change costs
more than writing code.

## Behaviour

- **Tests keep useful protection at affordable boundaries.** No test was deleted for the cull: the
  305 test files of the baseline all remain, each with a recorded disposition. Exact text, protocol
  values, security bounds, and commit counts stay asserted where they are the contract; incidental
  copy is not (home's readiness no longer depends on its "Needs you" heading). Several guards were
  strengthened: an install that fails after staging files leaves nothing, an attachment's size limit
  stops reading a chunked body early, an answered round makes exactly one commit.
- **Fixture repositories are built once per test file and copied for each caller.** Each copy has
  its own refs, index, configuration, objects, and worktree metadata, never hard links or shared
  object stores, so independent cases pass alone and in their suite.
- **`vp run fast` runs after every task.** It checks formatting, lint, types, the focused and
  boundary tests the changed files reach, and the changed crates' Rust tests with their reverse
  dependents. It prints what it selected and what it defers to `ready`: application journeys, the
  phone and desktop browser tests, production builds and package smoke, the full workspace and the
  editor checks. A green fast run is deliberately partial.
- **Fast never passes on nothing.** A git error, a discovery error, or a selected family with no
  test fails the run. An edit it cannot route broadens: a root configuration, lock, or toolchain
  file runs every family and the Rust workspace; an added test it does not know, `editors/`, or
  `.github/` runs `ready`.
- **Fast takes under a minute for a one-file edit** of a source, test, fixture, declaration, skill,
  or documentation file: the median of 3 warm runs on a quiet machine, from 11 to 58 seconds. A root
  configuration edit is measured without a budget, about 77 seconds.
- **`ready` runs every check before a push, and CI runs the same checks uncached.** CI splits them
  into 19 jobs, the TypeScript and browser tests in time-balanced shards. A run took 4 minutes 58
  seconds instead of 17. Nothing is retried. SC-003 is met: five green hosted runs of one commit,
  with no retry. SC-001 is not met: those runs took 4:55, 5:57, 4:44, 5:08, and 5:09, so no three in
  a row finished under 5 minutes.
- **The skill's testing rules follow behaviour.** A plan's tests cover each story's main scenarios,
  the `high` edge cases, and the success criteria; other cases share a test or are reviewed. An
  assertion is judged by the behaviour it protects, not by its value's type. Fault injection proves
  risky guarantees: security, git, writes, exact contracts.
- **A human's request outranks a test.** A safe, reversible request that contradicts a test or the
  spec is carried out, and the response says what conflicts and what each way out costs. Only an
  unsafe or irreversible one stops the work. A test the code fails without such a request gets the
  code fixed, or a report: never a weakened assertion.
- **Test changes are listed apart.** A removed, skipped, or loosened test, or a raised timeout,
  takes a ruling, and the final review and the pull request list each one with its old and new
  value.
- **The transcript keeps following its end when something leaves at its end.** While the human
  follows the end, the column never gets shorter: a failed run's banner that leaves on a send leaves
  blank space until the reply fills it. Scrolling up removes the blank space. The page's own scroll
  to the end never stops following; any human scroll does, by any input.
- **A scroll made before the transcript first draws wins over opening at the end.** The page keeps
  that place and offers "Jump to the latest". Back, reload, and a `#turn-` link still take
  precedence.
- **A transcript that first draws late keeps the place it finds.** It restores only the position
  saved when the page opened, by Back or a reload, never one saved while the human scrolled since.
- **Removing an image's thumbnail moves the focus to the next one once the removed image is gone**,
  even when the image's save ends at the same moment.

## Design

The suite is layered: each guarantee has an owning check at the cheapest boundary that can prove it.
Focused tests own local behaviour with only their real collaborators. Boundary tests own real git,
native binding output, and server requests. A few whole-app journeys and the browser tests prove the
wiring, and stay in `ready`. Fast selects before it builds anything optional, so a UI edit never
loads the app, the server, or the native binding.

- **Selection**: [`scripts/fast-selection.ts`](/scripts/fast-selection.ts) holds the families
  (binding, server, benchmarks, ui, package, scripts), each with its tests, roots, and inputs
  outside its root. `changedFiles` lists changes with the user's git, NUL-delimited; `selectFast`
  routes them; `rustCommands` builds the Rust chain with reverse dependents; `unproven` names a
  selected family with no discovered test.
- **The runner**: [`scripts/fast-check.ts`](/scripts/fast-check.ts) prints the selection, takes one
  of the machine's heavy-check slots after selecting, runs the type check beside the Rust chain,
  then the selected tests in one Vitest run. It escalates to `ready` without holding a slot.
- **The focused configuration**: [`vite.fast.config.ts`](/vite.fast.config.ts) builds one project
  per selected family with its package's settings, from
  [`scripts/test-policy.ts`](/scripts/test-policy.ts). The UI transforms and test options are shared
  with the web configuration in
  [`packages/web/vite.transforms.ts`](/packages/web/vite.transforms.ts).
- **Focused UI tests**:
  [`packages/web/src/__focused__/`](/packages/web/src/__focused__/composer.test.tsx) renders the
  Composer under real fate, repository, and fetch contexts, against
  [`request-fixture.ts`](/packages/server/src/__tests__/request-fixture.ts). That fixture serves
  fate's own server with the server's data views and no binding; an unscripted call fails the case.
  [`packages/binding/contracts.test.ts`](/packages/binding/contracts.test.ts) proves the binding's
  transport for a core edit.
- **Fixtures**: [`packages/binding/test-repos.ts`](/packages/binding/test-repos.ts) builds each
  named history once per test file in a template no caller receives, and returns a copy-on-write
  clone.
- **Following the end**: [`packages/web/src/following.ts`](/packages/web/src/following.ts)'s
  `useFollowEnd` holds its column's height with an inline `min-height` while the human follows, and
  tells its own late scroll by the position it set. `useScrolledAway` watches the human's scrolls
  until the log draws; `openAtEnd` takes the opening history entry from
  [`Transcript.tsx`](/packages/web/src/Transcript.tsx)'s `settled`, read once at mount.
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) wires them.
- **CI**: [`.github/workflows/ci.yml`](/.github/workflows/ci.yml) runs the TypeScript tests in 7
  shards, the desktop browser tests in 5, and the phone's in 3, by Vitest's `--shard` through
  `URAEDA_TEST_SHARD` in [`vite.tasks.ts`](/vite.tasks.ts). Unset, every test runs.
  [`scripts/test-shard.ts`](/scripts/test-shard.ts) balances the shards by each file's seconds on
  CI, in [`scripts/test-weights.json`](/scripts/test-weights.json); a missing file weighs 5 s. The
  toolchain test checks that every shard of each matrix is listed. Each job has its own Rust cache,
  saved by pull requests too.

## Questions

### Round 01

#### Q1: Should the constitution still require a test for every acceptance scenario?

**Answer:** A: amend the constitution so tests cover the behaviour that matters, "advise me on what
to change, let's improve the constitution".

#### Q1.A: Which scenarios besides the main ones need a test?

**Answer:** A: each story's main scenarios, the `high` edge cases, and the success criteria; other
edge cases only as a line in an existing test.

#### Q2: How much should the cull remove, and by what rule?

**Answer:** C: delete every suite and write a small set of flows from the specs, "let's make it as
clean as possible". Round 02 replaced this choice after its implementation lost protection.

#### Q3: Should an agent run a fast command after each task, and the full check only before pushing?

**Answer:** A: a fast command after each task, and `ready` before pushing and in CI.

#### Q4: Which browser tests should stay?

**Answer:** A: keep the page checks at both sizes and themes, and drop browser tests that repeat
happy-dom ones or assert measured pixels.

#### Q5: Which tests of tooling, Neovim, and benchmarks stay?

**Answer:** A: a tooling test stays only where it enforces an active decision's rule, and Neovim
keeps a smoke of the plugin's main actions.

#### Q6: How should the skill's testing wording change?

**Answer:** A: rewrite the testing rules around behaviour, with an explicit stop when a test
conflicts with the request.

#### Q7: Should the final review check test changes separately from the product's?

**Answer:** A: the final review and the pull request list every test removed, skipped, or changed in
what it expects, with its ruling.

#### Q8: Should the cull be approved before it is deleted?

**Answer:** A: the agent deletes by the approved criteria, one commit per area, and the record lists
what went.

### Round 02

#### Q1: Should we replace the all-flow rebuild with layered repairs that retain useful existing tests?

**Answer:** A: retain useful focused tests and a few whole-app journeys, allowing exact values for
required contracts.

#### Q2: May the fast check defer broad application journeys while running affected focused tests and boundary checks?

**Answer:** A: fast runs the affected focused and boundary tests, and names the journeys and browser
checks it defers to `ready`.

#### Notes

The human works on other features at the same time: pull main regularly during the rewrite and
before the pull request.

### Round 03

#### Q1: How should the one-minute fast budget read, given these measurements?

**Answer:** A: amend SC-002: under a minute for a one-file edit of a source, test, fixture,
declaration, skill, or documentation file, as the median of 3 warm runs on a quiet machine. A root
configuration, lock, or toolchain edit is reported without a budget.

#### Q2: How should the transcript keep following its end when the page shortens just before a reply?

**Answer:** A: while the human follows the end, the page never gets shorter, and what leaves at its
end leaves blank space until new content fills it or the human scrolls up.

#### Notes

A big merge had landed on main: pull it, check it, and update the tests it created if necessary.

## Decisions

- [Toolchain](../decisions/toolchain.md), changed: a fast check after every task checks formatting,
  lint, types, and the affected focused and boundary tests, and names what it defers to `ready`;
  `ready` runs before every push and in CI.
- [Constitution](../CONSTITUTION.md), principle VI, amended by the human after round 01: tests cover
  the behaviour that matters, not every acceptance scenario.

## Changes after approval

- The first approved spec replaced every suite with flows. Its implementation lost distinct guards
  (Rust line coverage fell from 93.6% to 84.5%), kept whole-app imports, and failed CI. Its pull
  request was discarded. Spec revision 2 keeps useful tests, repairs costly boundaries, allows exact
  values for contracts, and makes fast deliberately partial.
- Spec revision 3 amended the one-minute fast budget: the median of 3 warm runs on a quiet machine,
  and a root configuration, lock, or toolchain edit reported without a budget.
- A browser test found a product race: removing a thumbnail as its image's save ended left the focus
  on the page. The focus now waits until the removed image is gone.
- A browser test found a second product race: a banner leaving at the end, then a late reply, read
  as the human scrolling up and stopped following. Following the end now holds the column's height,
  as round 03 chose, and tells the page's own scrolls.
- The human decided in the session on 2026-10-21 that a scroll made before the transcript first
  draws wins over opening at the end. Before, the page jumped to the end once the log arrived.
- The human decided the same day that flaky tests not guarding important behaviour are dropped, with
  a ruling, not investigated. The desktop case "opening the line moves the place read, which the
  next width keeps" was removed; the case before it keeps the width guarantee.
- A transcript whose tail first drew late restored a position saved half a second earlier, which
  after "Jump to the latest" stopped following. It now restores only the position saved when the
  page opened.
- The skill's guidance on a request against a test or the spec now carries out a safe, reversible
  request and reports it, and stops only for an unsafe or irreversible one.
- The hosted runs found four more tests that failed under load without a product bug, each fixed at
  its cause: test repositories no longer start git's detached maintenance after a commit, which
  wrote into folders being removed; the archive case waits for the page's menu, not only the server;
  the tail cases measure once the page has settled after a turn ends; and their Back and reload
  cases count what a press drew instead of a fixed 40 and 60.
- CI moved from one job per check group to 19 jobs, with the test groups in time-balanced shards and
  one Rust cache per job, to meet the five-minute budget.

## Follow-ups

- Inbox: the skill's constitution template still says "tests covering the spec's acceptance
  scenarios" in rule VI, so a new project forbids what the testing rules ask: it needs the human's
  wording.
- Inbox: "Try again" on the server error page does not recover once the server is back, since the
  fate client keeps the failed read; only a reload does.
- Inbox: after Enter on a priorities row, the focus goes to the page body, while the inbox keeps it
  on the row; a click on a wide screen drops it too.
- Inbox: the phone's drawer is not a history entry, so Back leaves the page where a sheet's Back
  closes the sheet.
- Inbox: a few wording or format pins were accepted in the discarded flows: status labels, "N of M",
  the tab title count, and the Current and Done prefixes.
- Inbox: the benchmarks' record test never removes the nested step fields, and the invalid-run rule
  is tested only with a file outside `specs/`.
- Inbox: no test places a `config.toml` in a repository to check it is ignored, or drafts a
  priorities line from a non-default checkout; the Neovim smoke picks the waiting item by label.
- Inbox: the CLI install permission test returns silently as root.
- Work left: SC-001, three consecutive CI runs under 5 minutes, is not met: five green runs of the
  final commit took 4:55, 5:57, 4:44, 5:08, and 5:09.
- Work left: CI's margin is thin, a few seconds on the slowest shards. More shards (the 20-job limit
  allows one), weights measured again, or a Nix store cache for setup's minute and a half would
  widen it.
- Work left: the fixture edit's fast run has 2.4 seconds of margin and the server `limits.ts` edit
  5.7; both families grow with each feature and will cross the minute first. The core and skill
  edits keep about 9 seconds, on a quiet machine only.
- Work left: the levers for slow fast paths are unmeasured as fixes: the binding build's cache save
  (about 8 seconds) and Rust's test build (14 to 25 seconds).
- Work left: the request fixture's mutation answers are untyped, since typing them needs `as const`
  in production code.
- Work left: a few lines of `crates/core/src/actions/install.rs` run in no install test: a stale
  temporary file, an update writing a missing file, a manifest naming a missing file, and a link
  that would not reach `.agents`.
- Work left: two `preview.test.ts` cases and one `sessions.test.ts` case failed only at a machine
  load above 150, never reproduced alone; the hosted runs decide them.
- Work left: `watch.rs`'s new-worktree case tolerates one late empty report, whose cause is
  inferred, not reproduced; the late tail draw has no forcing case, only traces and stress batches.
