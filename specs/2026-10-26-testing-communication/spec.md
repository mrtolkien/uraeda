---
status: changes-requested
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Testing strategy review

> [!NOTE]
>
> Changes requested on 2026-10-26: 4 comments in spec-review.md.
>
> - You approve a new way of testing: a test is evidence and never an authority, a spec lists the
>   behaviour it replaces, the web UI has no automated tests, and the whole suite is rewritten in
>   one pass. Records and pull request bodies become one text, and records point to their
>   successors.
> - Decisions: one new, Testing, and seven changed. Every UI rule now ends "Checked by review", so
>   no automatic check guards a UI behaviour, an accessibility rule, or a layout.
> - The cut line I read from your answer: all 155 `.test.tsx` files of `packages/web`, the browser
>   runner, and axe go. Its 32 logic test files, and the tests of Rust, the server, and the scripts,
>   are judged one by one.
> - Outside behaviour not verified: attaching a screenshot to a pull request without committing it.
>   The plan's first task checks it. If it fails, the body carries no image and says so.
> - The evaluation spends up to 12 Claude Code runs with Sonnet, in a throwaway copy. Approving the
>   spec approves them.
> - By your choice, this spec passes the split rule: 5 stories and 8 decisions. Risk tier `medium`,
>   and the plan does not wait for your review.

Agents bent code to keep old tests green, and the suite grew heavy, above all in the frontend. This
feature gives the skill short, generic testing guidance, a Testing decision with the project's
stage, and a way to retire tests with the behaviour they guard. It rewrites the existing tests to
match, and makes a record and its pull request body one text. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## Decisions

- **New: [Testing](../decisions/testing.md)**. Tests are evidence, not authority: a spec lists the
  behaviour it replaces with its tests, only contracts and logic are tested at the `early` stage,
  and the web UI has no automated tests.
- **Changed: [UI checks](../decisions/ui-checks.md)**. The human checks UI work live in the sandbox,
  with one screenshot of each new view in the pull request, and none in the repository.
- **Changed: [UI layout](../decisions/ui-layout.md)**. Rules keep their intent, lose their pixel
  widths, and end "Checked by review".
- **Changed: [UI look](../decisions/ui-look.md)**. The reading size is set once in the theme, with
  no percentage in the rule. Contrast stays tested, since WCAG sets it.
- **Changed: [UI behaviour](../decisions/ui-behaviour.md)**. Its rules end "Checked by review"
  instead of the UI tests.
- **Changed: [Problems](../decisions/problems.md)** and **[Settings](../decisions/settings.md)**.
  One rule each ends "Checked by review" instead of a UI test.
- **Changed: [Preview](../decisions/preview.md)**. Stories do not run as tests, since there are no
  UI tests.

Relied on:

| Decision                                     | What it means for this spec                                           |
| -------------------------------------------- | --------------------------------------------------------------------- |
| [Toolchain](../decisions/toolchain.md)       | no retries and a fast check stay; the browser tasks leave `ready`     |
| [Code quality](../decisions/code-quality.md) | tests never depend on elapsed time; limits hold for the new code      |
| [Sandbox](../decisions/sandbox.md)           | the sandbox is how you check a UI change, so it must stay startable   |
| [Benchmarks](../decisions/benchmarks.md)     | a run needs your approval, given here for the evaluation's runs       |
| [Attachments](../decisions/attachments.md)   | images you attach stay in git; this spec concerns agents' screenshots |

## User stories

### US1: An agent writes few tests, and lets them go (P1)

The skill's testing guidance says what a good test is, how many to write, and when to drop one,
without naming a language or a tool. Discovery lists the tests guarding behaviour a feature changes.
The spec lists them under replaced behaviour, and its approval covers their removal.

Why this priority: every other story rests on it, and the evaluation tunes it.

Key scenarios:

1. **Given** the stage is `early` and a spec has four scenarios, one of which changes how a record's
   file is stored, **When** the agent plans its tests, **Then** only that scenario gets a test, and
   the plan's test map says why the other three have none.
2. **Given** a spec lists "the session's column no longer links Storybook" and the test that guards
   it, **When** the agent builds the task that changes the column, **Then** the task's commit
   removes that test and no ruling is written.
3. **Given** a test fails after a change and no approved spec, decision, or request of yours
   replaces what it guards, **When** the agent finds out, **Then** it fixes the code, and its commit
   body says the code was wrong. It does not edit the assertion.

More scenarios:

1. **Given** a bug is fixed, **When** the agent finishes, **Then** one test reproduces the bug and
   names the break it catches.
2. **Given** a test fails after your own request changed the behaviour, **When** the agent finds it,
   **Then** it changes the test, and tells you which and why in the same response.

### US2: Decisions say intent, and you check the UI live (P1)

Decisions keep what the code does not show: your intent. A number lives in the code. "Checked by"
names a test only for a contract or an outside standard, and says "review" otherwise. A UI change
reaches you as a sandbox to try and one screenshot of each new view in its pull request.

Key scenarios:

1. **Given** the changed UI layout decision, **When** an agent reads its rules, **Then** none names
   a pixel width or a test, and each ends "Checked by review."
2. **Given** a change adds a "Runs" view to the settings page, **When** its pull request is marked
   ready, **Then** the body holds one screenshot of that view, and no image is committed under
   `specs/` or `packages/`.

### US3: The suite shrinks to what matters (P1)

All of the repository's tests are rewritten against the guidance, in this feature's one pass. The
web UI keeps none of its automated tests, and the rest keep what guards a contract or logic.

Key scenarios:

1. **Given** the repository today, **When** the rewrite is done, **Then** `packages/web` has no
   `.test.tsx` file, no `__browser__` folder, and no browser configuration, and `vp run ready` has
   no browser group.
2. **Given** a core test that builds a git history and asserts a branch's step, **When** it is
   judged, **Then** it stays. A test asserting the order of internal calls goes.
3. **Given** the theme's contrast test, **When** the rewrite is done, **Then** it stays, as WCAG's
   ratios are an outside standard.

### US4: A pull request is its record, and records point forward (P2)

The pull request body is an opening block, then the record's text, with its links made absolute at
the finishing commit, and one screenshot per new view. A record may gain a "Gotchas" section, and
the record of a feature that replaces an older one's behaviour links both ways.

Key scenarios:

1. **Given** a finished change with a record and one new view, **When** its pull request is marked
   ready, **Then** the body is "Pull request to review, about 15 minutes", the record's text, and
   one screenshot, with no size table and no list of rulings.
2. **Given** a feature replaces part of the `2026-10-19-fix-testing` record's behaviour, **When** it
   finishes, **Then** its record says `supersedes: [2026-10-19-fix-testing]`, and the old record
   gains `superseded-by` and the line "Superseded in part by" at its top. Nothing else in the old
   record changes.
3. **Given** the building found that a menu primitive opens a sheet only with a coarse pointer,
   **When** the record is written, **Then** its Gotchas holds that one line next to the menu choice,
   and no routine debugging step.

### US5: The wording is tried before it ships (P1)

I iterate the skill's wording against runs of Claude Code with Sonnet, judged by me, by fresh
subagents, and by your OpenCode with DeepSeek, until the tests are small and useful.

Key scenarios:

1. **Given** a throwaway copy of this repository at the branch's start, **When** Sonnet builds the
   same small spec with the old wording and with the new, **Then** the tests of each run are scored
   by the criteria of the success criteria below, and both scores are kept in the pull request.
2. **Given** an approved spec that replaces one behaviour, **When** Sonnet builds it with the new
   wording, **Then** it removes or rewrites the test that guarded it and changes no code to keep it.

## Architecture

Replaced behaviour, and the tests that guard it, which this spec's approval covers removing:

- **Automated tests of the web UI**: the 90 `.test.tsx` files of `packages/web/src/__tests__`, the
  64 of `__browser__`, the one of `__focused__`, the browser configuration and its helpers,
  Playwright, axe, the size and measure checks, the `ready` browser groups, and the CI shards for
  them.
- **A ruling for each removed test**: replaced by this list, in each spec.
- **Rules "Checked by the UI tests" or "by the browser tests"**: now "Checked by review", in the
  decisions this spec changes.
- **Screenshots committed for review**: the skill's steps stop asking for them.
- **A pull request body with its own sections** (size, tests changed, rulings): replaced by the
  record's text.
- **Tests judged one by one** in `crates/`, `packages/server`, `packages/benchmarks`, `scripts/`,
  and the web's logic files: the plan lists each removed one by file and the behaviour it guarded,
  and the record names them.

The skill's testing guidance keeps one home, the testing section of `code-quality.md`, and the other
steps link to it. The Testing decision holds the project's choices, and the guidance holds what
holds for any stack. Records and pull request bodies share one writer, the finish step.

- **The testing section** of [`code-quality.md`](/skills/uraeda/references/code-quality.md) says
  what a test is for, how many to write, and when to drop one. It owns the rule on removing a test.
  `implementation.md`, `plan.md`, `spec.md`, and `change.md` link to it and lose their copies.
- **The replaced-behaviour section** is optional in the spec template, and this spec's list above
  stands in for it, between the stories and the architecture. The core accepts it, and the web spec
  page draws it. Discovery lists the tests that guard changed behaviour, and the plan's test map
  names the tests removed.
- **The testing decision's template**, with a once-only question in discovery for a project without
  one, like the code-quality and preview questions. The constitution template's principle drops its
  test line, since a decision now owns tests.
- **The finish step** writes the record, then the pull request body from it: the opening block, the
  record's text with absolute links, and the screenshot. It owns the supersession links, on both
  sides.
- **The record check** in the core reports a `supersedes` or `superseded-by` without its pair.
- **The test policy** of the repository: the rewrite and the tooling it removes, by the table of
  replaced behaviour. A logic rule that only a UI test guarded is first extracted into a function
  with a unit test, as
  [extract, don't grow](/skills/uraeda/references/code-quality.md#extract-dont-grow) asks.
- **The evaluation** runs outside the repository, and only its scores and the final wording reach
  it.

Tradeoffs:

- Removing the UI tests leaves a UI regression to your eyes.
- One pass over about 3,900 tests is a large change, and the open coherence-pass change edits web
  tests this feature deletes.
- A merged record gains a second allowed edit.

## Edge cases

| Importance | Situation                                                  | What happens                                                               |
| ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| High       | A test guards behaviour the spec replaces but did not list | the agent removes it with a one-line ruling, and the final review lists it |
| High       | A UI test was the only guard of a logic rule               | the logic is extracted and unit tested before the UI test goes             |
| High       | A screenshot cannot be attached without a commit           | the body carries no image, says so, and names the sandbox command          |
| Normal     | An open change still has a `screenshots/` folder           | `ura check` keeps accepting it, and the change's finish deletes it         |
| Normal     | `supersedes` names a record that does not exist            | `ura check` reports it                                                     |
| Normal     | A record is superseded twice                               | its `superseded-by` lists both, and its top has one line for each          |
| Normal     | The coherence-pass change merges first                     | the rewrite catches up with main, and deletes the tests that change edited |
| Niche      | A record has no gotchas                                    | the section is left out                                                    |

## Success criteria

- **SC-001** (no markup tests): after the rewrite, no test file asserts markup, a class name, a
  size, a call sequence, or private state, as the final review's reading of the changed tests
  reports.
- **SC-002** (the probe): in each run of the final wording, the agent that builds a spec replacing
  one behaviour changes the guarding test, and changes no code to keep it.
- **SC-003** (few tests): in each run of the final wording, the added tests number at most the
  spec's key scenarios plus its high edge cases, and two fresh reviewers find no test that repeats
  another's coverage.
- **SC-004** (fast): the tests added in the final runs finish in under 10 seconds.
- **SC-005** (one text): a pull request body after its opening block equals its record, but for the
  absolute links and the screenshot.
- **SC-006** (paired links): `ura check` reports a record whose `supersedes` or `superseded-by` has
  no pair.
- **SC-007** (generic): the skill's testing section names no language, no test runner, and no
  library.
- **SC-008** (stop): the wording is final when SC-002 to SC-004 hold in three runs in a row, or
  after five revisions of it, whichever comes first, and the pull request says which.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, except
that the existing tests are rewritten in this feature, as you answered. Settled while writing this
spec:

- **The constitution.** You removed its test principle, so no amendment is asked. The spec's
  constitution check has five columns.
- **The stage.** The project's stage is `early`, from your example, and only you move it.
- **The cut line.** "Logic and contract tests only" means every rendering test goes, and the unit
  tests of pure functions stay, once judged.
- **The accessibility check.** Axe leaves with the browser tests. Say so in your review if you want
  it back.
- **No backfill.** Only this feature's record gets supersession links, to the records of
  `2026-10-14-testing-review`, `2026-10-19-fix-testing`, and the UI checks answer of
  `2026-10-12-ui-improvements`. Older records are not searched for them.
- **The evaluation's feature.** A small feature of the core or the server, with logic and a
  contract, picked in the plan, since the web UI has no tests to judge.
- **The runs.** Up to 12 Sonnet runs in a throwaway copy, and the OpenCode reviewer through its
  skill.
- **The screenshot.** The host is checked first, as the plan's first task, and nothing for it is
  committed.
- **Test-first.** It stays for logic, contracts, and bug fixes, as the note on UI tests says.
- **The constitution template.** Its principle on code quality drops the test line, and the inbox
  note about it is closed.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: no stored data users hold changes, but about 3,900 tests and eight decisions do, and git
keeps what is deleted.
