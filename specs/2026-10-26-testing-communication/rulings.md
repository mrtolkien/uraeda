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
