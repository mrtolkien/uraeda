# Rulings: Testing strategy review

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Each judging task lists the tests it removes

- **Decision**: the web UI's `.test.tsx` files are judged in the plan, which lists the kept ones.
  The tests of `crates/`, the server, the benchmarks, the scripts, and the web's logic files are
  judged by their tasks, each adding its removed tests to the plan's **Removed tests**, which the
  record copies.
- **Rationale**: the spec asks the plan to name each removed test. About 3,200 tests outside the web
  UI's rendering files would make the plan longer than the change; the global constraints give every
  judging task the same rules, and task 15 checks the lists against the diff.
- **Alternatives considered**: judging every test while planning: thousands of lines of plan that
  restate the tests.
- **Where**: tasks 6, 7, 10 to 13, and 15.

## R2: The browser runner goes, with its two weakest candidates

- **Decision**: no browser test is kept. The two candidates the triage found, a picked story
  element's unsaved comment through a reload, and a variant's comment joining its answer, have their
  logic extracted (`storyComment`, `saveWithLine`) and their wiring left to review.
- **Rationale**: the Testing decision keeps a UI test only when it is extremely useful; these two
  guard wiring between a real Storybook frame and code the unit tests now own, and keeping them
  keeps Playwright's browser runner, its configuration, and two CI jobs.
- **If wrong**: the runner comes back from git, with these two files.
- **Where**: tasks 5 and 10.

## R3: UI tests a decision names stay

- **Decision**: `diagram.test.tsx`'s failure fallback and `notify.test.tsx` stay as kept UI tests,
  with `diagram-hostile.test.tsx`.
- **Rationale**: the Diagrams and Notifications decisions, which this spec did not change, say their
  rules are "Checked by the diagram's tests" and "by the notifier's tests"; removing the tests would
  edit what those decisions mean without the human's approval.
- **Where**: the plan's **Kept web UI tests**, task 12.

## R4: The evaluation's feature is a small check of the core

- **Decision**: "Record dates": `ura check` warns when a record's `finished` date is before its
  name's date, and a record's `kind` may be `chore`, which a test refuses today.
- **Rationale**: the spec asks for a feature of the core or the server with logic and a contract.
  The first rule is date logic with a message contract; the second replaces a behaviour an existing
  test pins, which is the probe of US5's second scenario.
- **Where**: task 14.

## R5: How a screenshot reaches the pull request

- **Decision**: the screenshot of a new view is taken into a file outside the repository, referenced
  in the body as `![<view>](./<file>.png)`, and uploaded with
  `gh pr edit --body-file <body> --attach './<file>.png#<view>'`, which rewrites the reference to
  the uploaded asset. Without a forge tool that attaches images, the body says it carries no image,
  and names the command that starts the sandbox.
- **Rationale**: `gh` 2.102's `gh pr create --help` and `gh pr edit --help` document `--attach`:
  "Use `--attach` to upload an image or video... If the body references an attached file, such as
  `![alt](./login.png)`, that reference is rewritten to point at the uploaded asset instead." The
  forge keeps the asset, not git. Nothing was uploaded to check it: this feature adds no view, and
  the repository is public.
- **If wrong**: an older `gh` refuses the flag; the body then follows the fallback, as the spec's
  edge case says.
- **Where**: task 1; task 9 writes it into the finish step.

## R6: The unit tests own the Sandbox rule on a pick's text, with the pick script's cases

- **Decision**: `pickText.test.ts` and the pick script's cases in `storybook-pick.test.ts` own the
  [Sandbox](/specs/decisions/sandbox.md) rule "A pick MUST be copied to the clipboard as text that
  names the page, the element, and its source location", which the browser test
  `sandbox-pick.test.tsx` owned with them. `pickText` writes the text that names the page, the
  element, and its source; the script reports the element's role, name, text, HTML, and nearest
  `data-insp-path`, with its text cut at 200 characters and its HTML at 2,000. The clipboard write
  and its fallback to a text to copy by hand are wiring that review checks.
- **Rationale**: the rule's logic is the text and what the script reports; the browser runner goes
  with its tests (R2), and a test of a clipboard in a headless browser guarded a call to the
  browser's own API.
- **Where**: task 5; the browser test goes in task 10.
- **If wrong**: `sandbox-pick.test.tsx` comes back from git, with the browser runner.

## R7: The toolchain test's comment stripping keeps strings whole

- **Decision**: `uncommented` in `packages/server/src/__tests__/toolchain.test.ts` removes comments
  but keeps every string, so a glob such as `"packages/**"` opens no block comment.
- **Rationale**: the old stripping read the `/*` of `"src/**"` as a block comment up to the next
  `*/` of a later glob, so a `retry: 2` between two globs in the root `vite.config.ts` went
  unreported: the rule "Test runners MUST NOT retry a failed test", checked by this test, had a
  hole. Task 10, a risky change of this test, found it by breaking the rule on purpose.
- **Where**: task 10, `toolchain.test.ts`; a fixture case (a retry between two globs) fails on the
  old stripping.

## R8: The web tests' setup gets the time bound of their tests

- **Decision**: `uiTestOptions` gives hooks `gitTestTimeout`, the 20-second bound its tests already
  have, instead of Vitest's 10-second default.
- **Rationale**: `storybook-fate.test.ts`'s `beforeAll` builds a fixture repository through the
  binding and starts a server, the work `gitTestTimeout` bounds in a test. Under the load of several
  worktrees, it timed out in `ready` at 10 seconds and passed alone in 13. Its four tests guard
  cross-site requests, a security rule, so the file stays, and the toolchain decision asks a test
  failing without a bug to be fixed in the pull request that finds it.
- **Where**: `packages/web/vite.transforms.ts`, found by the validation of wave 3.

## R9: UI behaviour's last rule is checked by review, as the approved spec says

- **Decision**: the rule on growing views in [UI behaviour](../decisions/ui-behaviour.md) ends
  "Checked by review." instead of "Checked by the UI tests, which count what draws and never time
  it."
- **Rationale**: the approved spec's decisions say of UI behaviour: "Its rules end 'Checked by
  review' instead of the UI tests." The decision's text, written with the spec, missed this one
  rule, and task 12 removed the tests that counted draws, as the Testing decision asks of tests of
  how the code does it. The bounded number of rows keeps its unit test, `tail.test.ts`. The pull
  request names this edit, since the decision changed after the spec's approval.
- **If wrong**: the rule's old ending comes back, with one test that counts what a growing view
  mounts.
- **Where**: `specs/decisions/ui-behaviour.md`, found by the review of wave 3.

## R10: The sandbox of the preview frames is tested again

- **Decision**: `preview-sandbox.test.tsx` asserts that the mockup embed, a story's frame, and the
  mockup page each draw a frame sandboxed with `allow-scripts` and never `allow-same-origin`.
- **Rationale**: the [Stack](/specs/decisions/stack.md) decision says the web UI MUST sandbox
  previews apart from Uraeda's origin, "checked by the preview proxy's and the embed's tests", and
  task 12 removed the last test of the embed's `sandbox` attribute: a preview running with Uraeda's
  origin is a security cost the human's use of the page does not show.
- **Where**: `packages/web/src/__tests__/preview-sandbox.test.tsx`, and its row in the Kept web UI
  tests table.

## R11: The writes store's test comes back

- **Decision**: `packages/web/src/__tests__/writes-store.test.tsx` is restored as it was at the
  start of the branch, and its row leaves task 12's Removed table.
- **Rationale**: it tests the pending label's state machine (`runWrite`, `usePendingAction`) through
  a hook, not a page: an action shown until the server's status changes, 10 seconds pass, or the
  write fails, overlapping writes keeping the label, and a failed write after a status change that
  once showed a stale git-write status again, a bug reproduced. It is logic with many cases and a
  reproduced bug, which the `early` stage keeps, and no unit test replaced it. Its timers are
  Vitest's fake ones, so it depends on no elapsed time.
- **Where**: the Kept web UI tests table, and task 12's Removed table.

## R12: The figure rows' cases come back

- **Decision**: the five cases of `figureRows` that task 13 removed (a live feature, a done one, a
  change, zero questions, and commits not traced) are restored in `figure-rows.test.ts`, as they
  were at the start of the branch.
- **Rationale**: `figureRows` is a pure function with many cases, which the `early` stage keeps, and
  its cases are its whole specification: the rows' labels, order, and links, all in one place.
- **Where**: task 13's Removed table loses their five rows (14 removed become 9).

## R13: What the reading of SC-001 cut, and what it kept

- **Decision**: the reading of every added or changed test cut the rows that pin the columns' chosen
  pixel limits, made the diagram's fallback test read the shown source instead of a `<pre>`, and
  compared a draft's images by value, not by identity. It kept four readings of the page that look
  like markup or counts, because each is the observable of its rule: `diagram-hostile.test.tsx`
  reads the page for a script, an event handler, or a `javascript:` link, and
  `preview-sandbox.test.tsx` reads a frame's `sandbox` tokens, both security rules a decision names;
  `writes-store.test.tsx` reads what the store's hooks return, the store's public face;
  `notify.test.tsx` counts what it asks of the browser's `Notification`, a boundary the
  Notifications decision is about.
- **Rationale**: SC-001 asks that no test assert markup, a class name, a size, a call sequence, or
  private state. A security rule about what reaches the page can only be read in the page, and a
  stored width is data, but its limits are a look the human reviews.
- **Where**: task 15.
