# Discovery, round 01: Testing strategy review

## Summary

The proposal asks for five things: testing guidelines in the skill, a rewrite of the repository's
tests, structural decisions, records that equal pull request bodies, and an evaluation to tune the
wording. Two root causes explain the pain it describes.

1. **Tests carry authority they should not have.** The workflow tells the agent to write a test for
   every scenario with "exact values" ([spec](/skills/uraeda/references/spec.md)), forbids loosening
   or deleting a test ([constitution VI](/specs/CONSTITUTION.md), `implementation.md`), and gives no
   path for a test that guards behaviour the approved spec replaces. See
   [where the pressure comes from](#where-the-pressure-comes-from).
2. **Nothing limits how many tests exist or how coupled they are.** The repository has about 1,180
   Rust tests and about 2,700 TypeScript tests, many through a real browser. See
   [the suite today](#the-suite-today).

External sources agree on the principles: test observable behaviour, keep few tests chosen by risk,
and let a failing test mean a real problem. They are thin on agents and on pixel assertions. See
[what the sources agree on](#what-they-have-in-common).

Records and pull request bodies overlap by construction: both explain what, how, and why. The
sources support "the description is the permanent record" and "add only supersession links to old
records". On implementation gotchas they pull both ways. See
[records and pull requests](#records-decisions-and-pull-requests).

## How other products do it

Testing guidance for agents, and record-keeping practice, from sources a research agent fetched in
this session. A fetch returns a small model's digest of a page, not its raw text: facts are
near-verbatim at best, and the Google Testing Blog posts did not load their bodies.

### Agent skills and instructions

- **superpowers**: "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"; "Fix the code, not the test,
  when a test fails"; every test names the break it catches; avoid change-detector tests ("fail on
  redesign and miss real bugs"); "Tests ship with the implementation. Write only the tests the
  behavior needs. Trivial code and prose need none"; throwaway prototypes are exempt with the
  human's permission
  ([TDD skill](https://raw.githubusercontent.com/obra/superpowers/main/skills/test-driven-development/SKILL.md),
  `writing-good-tests.md` in the same folder).
- **Claude Code best practices**: give the agent a way to verify its work, write a failing test for
  a bug first, and do not chase every reviewer finding: it leads to "tests for cases that can't
  happen" ([best practices](https://code.claude.com/docs/en/best-practices)). Its CLAUDE.md advice:
  ask of each line whether removing it would cause mistakes; hooks are deterministic, instructions
  advisory.
- **Spec Kit**: strict test-first, "acceptance scenarios become tests", tests approved by the user
  and confirmed red first, real databases over mocks
  ([spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md)).
- **AGENTS.md conventions**: only seen in search-result snippets (see [Not checked](#not-checked)).

### Foundations of testing

- **Google, Software Engineering at Google**: "the ideal test is unchanging", and changes only when
  requirements change; a brittle test "fails in the face of an unrelated change... that does not
  introduce any real bugs"; test through the public API; one test per behaviour, not per method;
  target mix about 80/15/5 unit, integration, end-to-end
  ([chapter 11](https://abseil.io/resources/swe-book/html/ch11.html),
  [chapter 12](https://abseil.io/resources/swe-book/html/ch12.html)).
- **Fowler**: "Every single test in your test suite is additional baggage"; UI end-to-end tests are
  "notoriously flaky", so keep a few around key journeys; "too much testing shows up as friction":
  simple changes forcing many test edits; coverage is "a search tool, not a score"
  ([practical test pyramid](https://martinfowler.com/articles/practical-test-pyramid.html),
  [TestCoverage](https://martinfowler.com/bliki/TestCoverage.html),
  [Is TDD dead?](https://martinfowler.com/articles/is-tdd-dead/)).
- **Kent C. Dodds**: "Write tests. Not too many. Mostly integration"; tests of implementation
  details give false negatives (a refactor breaks them) and false positives (the app breaks, no test
  fails) ([article](https://kentcdodds.com/blog/write-tests),
  [implementation details](https://kentcdodds.com/blog/testing-implementation-details)).
- **Kent Beck, Test Desiderata**: twelve properties, among them behavioural and
  structure-insensitive tests; predictiveness trades against speed
  ([testdesiderata.com](https://testdesiderata.com/)).

### Frontend testing

- **Playwright**: test user-visible behaviour; prefer role locators over CSS or XPath; rendering
  "can vary based on the host OS, version, settings, hardware", so screenshot baselines are per
  platform and need manual updates ([best practices](https://playwright.dev/docs/best-practices),
  [snapshots](https://playwright.dev/docs/test-snapshots)).
- **Testing Library**: "The more your tests resemble the way your software is used, the more
  confidence they can give you"
  ([principles](https://testing-library.com/docs/guiding-principles/)).
- **Snapshots**: developers "will sooner just nuke the snapshot and record a fresh passing one"
  ([Dodds on snapshots](https://kentcdodds.com/blog/effective-snapshot-testing)).
- **Storybook**: render, interaction, accessibility, then visual tests; "A prototype might skip
  testing, while a critical app may need thorough coverage"
  ([writing tests](https://storybook.js.org/docs/writing-tests)).
- **Vitest browser mode** runs in a real browser; testing-library's `user-event` "simulates events
  instead of actually triggering them" ([guide](https://vitest.dev/guide/browser/)).
- No source discusses asserting exact pixel or CSS values. The closest are Playwright's warning
  about structure-tied locators and the snapshot sources above. That pixel assertions are an
  anti-pattern is an inference from them.

### Studies of agent-written tests

- **Rethinking the Value of Agent-Generated Tests** (SWE-bench Verified, six models): agent tests
  are mostly value-revealing prints, "an observational channel rather than a systematic verification
  mechanism"; flipping how often agents write tests moved outcomes little; discouraging tests cut
  API calls by 25-35% ([arXiv 2602.07900](https://arxiv.org/html/2602.07900v1)). Limits: one
  benchmark, Python, tests optional.
- **Over-mocked tests** (1.25M commits, 2,168 repositories): 23% of agent commits touch tests
  against 13% of human commits, and 36% of agent test commits add mocks against 26%
  ([arXiv 2602.00409](https://arxiv.org/html/2602.00409v1)). It measures frequency, not quality.
- **SWE-bench solved issues** (abstract only): 29.6% of plausible patches behave differently from
  the ground truth, so passing tests does not prove correctness
  ([arXiv 2503.15223](https://arxiv.org/abs/2503.15223)).
- **ImpossibleBench** (abstract only): tasks whose spec contradicts the tests, to measure agents
  that bend code or tests to pass ([arXiv 2510.20270](https://arxiv.org/abs/2510.20270)). It is the
  closest study to this proposal's complaint. No study found measures how often agents weaken tests
  in real repositories.

### Records, decisions, and pull requests

- **ADRs**: Nygard keeps a reversed decision, marked superseded, with "a reference to its
  replacement" ([post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).
  MADR has `superseded by ADR-0123` in front matter ([MADR](https://adr.github.io/madr/)). A
  practitioner repo reports that "in theory, immutability is ideal. In practice, mutability has
  worked better", with dated notes added
  ([Henderson](https://github.com/joelparkerhenderson/architecture-decision-record)).
- **Descriptions**: Google calls a change description a "permanent public record" of what and why,
  to be re-checked before submit; the kernel says to lead with the problem, and that the text must
  make sense without its links
  ([Google](https://google.github.io/eng-practices/review/developer/cl-descriptions.html),
  [kernel](https://www.kernel.org/doc/html/latest/process/submitting-patches.html)). GitHub's squash
  message draws on the description by setting, not by a documented guarantee
  ([GitHub](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges)).
- **Links between records**: the IETF puts `Obsoletes:` in the new RFC
  ([RFC 7322](https://www.rfc-editor.org/rfc/rfc7322.html)); ADRs put "superseded by" on the old
  one. Whether the old record is edited differs by source.
- **Agent memory**: files that restate what the code shows "do not generally improve task success"
  and raise cost by over 20%, but help for non-standard practices
  ([ETH Zurich, arXiv 2602.11988](https://arxiv.org/abs/2602.11988)). Claude Code's memory skips
  "anything it can derive from the codebase, such as architecture, file paths, or debugging fixes",
  and keeps what "can't [be derived] from the code or git history"
  ([memory docs](https://code.claude.com/docs/en/memory)). Anthropic favours the smallest set of
  high-signal tokens, retrieved just in time
  ([context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).
  Cline's memory bank keeps "lessons learned"
  ([docs](https://docs.cline.bot/prompting/cline-memory-bank)).

### What they have in common

- Test observable behaviour through public interfaces, so tests survive refactoring.
- Every test costs maintenance, so the suite is not a number to raise. Coverage is not a goal.
- Mocks are a smell by default, and agents mock more than humans.
- A test must be able to fail for a real reason, and a failing test after a change should mean a
  real problem.
- UI tests use roles and text, never structure or exact rendering, and end-to-end UI tests stay few.
- Testing effort depends on the project's stage: Storybook and superpowers allow a prototype to skip
  tests.
- A description is a standalone record of the problem and the why. A superseded record stays and
  points to its replacement.

Where they differ: test-first as a rule (superpowers, Spec Kit) or an option (Fowler, Beck); the
shape of the pyramid; visual regression (Storybook for, Playwright and Searls wary); whether old
records are edited at all; and whether debugging learnings belong in agent memory.

## Standards and libraries

### The project's test tools

- [Vitest through Vite+](/vite.config.ts), with happy-dom for focused tests and a real-browser
  project for `__browser__` tests, run at a phone and a desktop size, in both themes.
  [`packages/web/src/__browser__/helpers.tsx`](/packages/web/src/__browser__/helpers.tsx) holds
  `checkTextSizes`, `checkControlHeights`, `checkMeasure`, `checkInsets`, `checkAccessibility`.
- Rust tests run under cargo-nextest, per the [toolchain](/specs/decisions/toolchain.md) decision.
- axe-core checks WCAG 2.1 A and AA in the browser tests. WCAG's contrast ratios (4.5:1 text, 3:1
  controls) are an external standard, unlike a pixel size the project chose.

## The code

### Important reads

- [`specs/CONSTITUTION.md`](/specs/CONSTITUTION.md) principle VI: "Implementations MUST include
  tests of the behaviour that matters: each story's main scenarios, the edge cases marked high, and
  the success criteria", and "A test MUST NOT be loosened, skipped, or deleted to make a run pass,
  except at a human's request or with a ruling the review lists." Only a human amends it.
- [`skills/uraeda/references/code-quality.md`](/skills/uraeda/references/code-quality.md#writing-tests)
  and [`#tests-that-can-fail`](/skills/uraeda/references/code-quality.md#tests-that-can-fail): the
  skill's whole testing guidance is about 70 lines, spread over "Writing tests", "Tests that can
  fail" and "UIs verified end to end", plus rules in
  [`implementation.md`](/skills/uraeda/references/implementation.md#each-task) and
  [`plan.md`](/skills/uraeda/references/plan.md). It says how to write a test, but not how many to
  write, when a test may be dropped, or what makes one worth keeping.
- [`specs/decisions/ui-checks.md`](/specs/decisions/ui-checks.md): "UI tests MUST drive the UI as a
  user does, and MUST NOT assert markup, class names, or pixels. Checked by review." Its Why quotes
  the human: "each test is added maintenance, because tests also drift away from expected
  behaviour".
- [`packages/web/src/__browser__/layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx):
  its opening comment lists assertions of "19 px at every width", "every control is 44 px tall", "a
  transcript at least 1.4 times as wide as the column at 1440 px", and "a line... about 110
  characters". It runs for about 122 s on desktop and 120 s on phone, the two slowest files in
  [`scripts/test-weights.json`](/scripts/test-weights.json).
- The open change `2026-10-26-coherence-pass`, read with
  `git show origin/change/2026-10-26-coherence-pass:specs/changes/2026-10-26-coherence-pass/rulings.md`.
  Its R1: "The story page's column test reads the session's column... The test failed on main before
  this change." Its R2 records a library fact, that Astryx's `adaptive` opens a sheet only on a
  narrow screen with a coarse pointer.
- [`specs/done/2026-10-14-testing-review.md`](/specs/done/2026-10-14-testing-review.md) and
  [`2026-10-19-fix-testing.md`](/specs/done/2026-10-19-fix-testing.md): the two earlier testing
  features. They fixed speed and flakiness (no retries, a fast check, caching). They did not ask how
  many tests there should be, or when a test may go.
- [`specs/done/`](/specs/done/): 61 records, about 570 KB, of which the largest are about 21 KB.

### The suite today

Counted in this session, approximately:

| Part                                      | Count                                                 |
| ----------------------------------------- | ----------------------------------------------------- |
| Rust tests (`#[test]`, `tokio::test`)     | about 1,180, in 46 core, 21 cli, and 4 lsp test files |
| TypeScript `it`/`test` calls              | about 2,680, in 274 test files                        |
| Browser test files in `packages/web`      | 64, each run at two sizes                             |
| Test CPU time listed in the weights file  | about 2,900 s over 236 entries                        |
| Screenshots committed by one change       | 608 in the coherence-pass folder                      |
| Commits since 10 October that name a test | 366 of 2,606                                          |

### Where the pressure comes from

- **The spec asks for exact values and every scenario tested.**
  [`spec.md`](/skills/uraeda/references/spec.md): scenarios "with exact values. ... The plan's tests
  use them as written, and the implementation must test each one." Success criteria are "each one
  checkable by a test or a benchmark". A success criterion like "19 px" becomes a pixel test.
- **The plan copies exact values into tests.** [`plan.md`](/skills/uraeda/references/plan.md): a
  test step has "the spec's exact values in them, including the human's approval comments".
- **A test can only be removed with a ruling, and a failing test is never to be changed.**
  [`implementation.md`](/skills/uraeda/references/implementation.md#each-task): "Never change a test
  or an expected value to make a run pass. Removing, skipping, or loosening an existing test...
  takes a ruling." The one exception is a human's request. Nothing says what happens when the
  approved spec or an updated decision replaces the behaviour a test guards.
- **A decision's rule can name a value, and then a test.**
  [UI layout](/specs/decisions/ui-layout.md) names "at least 400 px wide" and "768 px" in its Why,
  and rules checked "by the browser tests" at each class. [UI look](/specs/decisions/ui-look.md)
  says "120% of Astryx's base size... Checked by a test of the theme's tokens". The UI checks
  decision forbids pixel assertions, and its own suite asserts them: a rule "Checked by review" is
  not enforced.
- **The record's reader cannot tell a stale test from a live one.** Records describe behaviour as it
  was, and nothing links an older record to the one that replaced its behaviour.

### The proposal's path and existing actions

Tracing the proposal's own steps through the code:

- **Skill guidance**: one section, `code-quality.md#writing-tests`, plus the rules above. The
  constitution's VI is quoted by every step through [`SKILL.md`](/skills/uraeda/SKILL.md)'s
  hierarchy. A new section needs the same links from the plan, implementation, and change steps.
- **Rewriting the tests**: [`packages/web`](/packages/web/) has `__tests__` (122 files),
  `__browser__` (64), plus sandbox, samples, and focused tests. Rust has 71 test files. The fast
  check ([`vite.fast.config.ts`](/vite.fast.config.ts),
  [`scripts/fast-selection.ts`](/scripts/fast-selection.ts)) selects tests by file, so a rewrite
  does not change how checks run.
- **Decisions**: 25 files in [`specs/decisions/`](/specs/decisions/). A decision changes only on the
  branch that asks, and stays `proposed` until the human approves the spec that lists it.
- **Record and pull request**: [`finish.md`](/skills/uraeda/references/finish.md) writes the record
  before the pull request is marked ready, and
  [`implementation.md`](/skills/uraeda/references/implementation.md#pull-request) lists a different,
  longer set of sections for the pull request: what was done, attention, links, tests, size,
  rulings, review comments, inbox notes. The coherence-pass body has Approach, What stays unchanged,
  Points settled without you, and Size, none of which a record has.
- **Records after merge**: [`finish.md`](/skills/uraeda/references/finish.md#after-the-merge) says
  "Records are frozen once merged: edit one only to fix a broken link." Supersession links would be
  a second allowed edit. `ura check` validates a record's name, dates, rounds, and opening block
  only, per [`conventions.md`](/skills/uraeda/references/conventions.md).
- **Rulings**:
  [`rulings.md`](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/rulings.md) has five
  fields per ruling (Decision, Rationale, Alternatives considered, If wrong, Where). Coherence-pass
  has 22. The finish step lifts "the rulings that change behaviour" into the record's **Changes
  after approval**. The rest, including library facts like Astryx's `adaptive`, exist only in the
  deleted folder, found by `git log`.

### Rules and their owners

- **A test may be removed**: owned by constitution VI, restated in `code-quality.md`,
  `implementation.md` (twice), `plan.md`, and the pull request section. Six copies of one rule.
- **A UI test must not assert pixels**: owned by the UI checks decision, "Checked by review", and
  copied into no test. [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts) exists for web
  lint rules and is the nearest enforcement point.
- **Decision values**: 120% text size owned by the theme and its test
  ([`theme-tokens.test.ts`](/packages/web/src/__tests__/theme-tokens.test.ts)), and by the UI look
  decision's text.

### Likely changes

- [`skills/uraeda/references/code-quality.md`](/skills/uraeda/references/code-quality.md): a testing
  section, rewritten ("what a test is for"), under every option.
- [`implementation.md`](/skills/uraeda/references/implementation.md),
  [`plan.md`](/skills/uraeda/references/plan.md), [`spec.md`](/skills/uraeda/references/spec.md),
  [`change.md`](/skills/uraeda/references/change.md): their test rules point to the new section and
  lose their copies.
- [`finish.md`](/skills/uraeda/references/finish.md), the record and rulings templates, and the
  example: with the options of [records](#records-decisions-and-pull-requests).
- [`specs/decisions/ui-checks.md`](/specs/decisions/ui-checks.md), and the decisions with specifics,
  per the [decisions topic](#decisions-structural-not-specific).
- [`crates/core`](/crates/core/): the record's checks, with a supersession option.
- Tests in `packages/web`, `crates/`, `packages/server`: only if the split of the first topic puts
  the rewrite here.
- [`packages/benchmarks/`](/packages/benchmarks/): only with the automated option of the evaluation
  topic.

## The proposal

### The test rewrite is much larger than the guidelines

Rewriting about 3,900 tests across 274 TypeScript files and 71 Rust files takes far longer than
writing guidelines, and its result depends on them. The proposal lists it as the second step of one
feature. The discovery's scope rule asks to split independent subsystems.

### Two rules of the constitution stand in the way

Scaling effort with maturity, and removing tests whose behaviour was replaced, both conflict with
text in principle VI: "each story's main scenarios... MUST" be tested, and a test "MUST NOT be...
deleted... except at a human's request or with a ruling the review lists". Only a human amends the
constitution.

### Decisions mix intent and values

Of the 25 decisions, most rules end "Checked by review" or "Checked by the browser tests". Values
appear in rules and Why sections: 120%, 400 px, 768 px, and the "three width classes". Some tests
exist because a decision names the value, not because a user needs it.

### "The PR body should just be the record" needs an order

The record is written before the pull request is marked ready, and can be edited for requested
changes. The pull request body has parts only for the reviewer: size, tests changed, the opening
block. The proposal does not say which of these reach the record.

### The proposal asks my opinion on gotchas

Answered in [the approaches](#recording-implementation-issues).

## Worth it and feasibility

The cost is low for the guidelines, decisions, and records: skill and template text, one core check.
It is high for the test rewrite: thousands of tests, each needing a judgement against the new rule.
The gain is real: a coherence-pass test that "failed on main before this change" cost a ruling and a
re-aimed test, and the proposal says agents bent implementations to pass obsolete tests.

The evidence on agent-written tests is observational (one benchmark, Python, frequency of mocks).
The pixel-assertion advice rests on practitioner sources and inference. Whether the new wording
makes a Sonnet agent write fewer, better tests is **unverified**: the evaluation is how this feature
would find out, and it needs the human's approval to run, per the
[benchmarks decision](/specs/decisions/benchmarks.md).

No guard is relaxed. The constitution amendments in the approaches below are the human's to make.

## Approaches

Criteria come from the [proposal](proposal.md), the [constitution](/specs/CONSTITUTION.md) (VI on
tests, I on human control, V on tools being optional), the
[UI checks](/specs/decisions/ui-checks.md) decision, the [toolchain](/specs/decisions/toolchain.md)
decision (no flaky tests, fast checks), and the [benchmarks](/specs/decisions/benchmarks.md)
decision (runs need approval).

### Scope of this feature

The proposal covers independent pieces: guidelines and decisions, the test rewrite, records and pull
requests, and an evaluation. See
[the proposal](#the-test-rewrite-is-much-larger-than-the-guidelines).

| Option                                                                              | Review size                   | Risk                                    |
| ----------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------- |
| A. This feature: guidelines, decisions, records, evaluation. Test rewrite: next one | skill, templates, decisions   | rewrite waits for guidelines tuned      |
| B. Everything in one feature                                                        | thousands of test changes     | one huge pull request; stale guidelines |
| C. Guidelines and rewrite here; records and pull requests in another                | skill plus thousands of tests | two reviews of the same skill files     |

### Authority of a test against the spec

See [where the pressure comes from](#where-the-pressure-comes-from). The topic is what happens to a
test that guards behaviour an approved spec, a decision, or the human's request replaces.

| Option                                                                                                 | Constitution | Human effort                  | Stale tests                              |
| ------------------------------------------------------------------------------------------------------ | ------------ | ----------------------------- | ---------------------------------------- |
| A. The spec lists the behaviour it replaces and the tests that guard it; approval covers removing them | unchanged    | one list read at approval     | removed at the task, named in the record |
| B. A: and amend VI so a test guarding replaced behaviour needs no ruling                               | amended      | one amendment, then as A      | same, with the rule stated in one place  |
| C. Keep today's ruling per removed test                                                                | unchanged    | the ruling lists, per feature | what pushed agents to bend code          |

### Scaling testing with the project's stage

See [the studies and sources](#what-they-have-in-common): Storybook and superpowers allow a
prototype to skip tests; Beck and Fowler say tests pay off with stability.

| Option                                                                                         | Constitution                              | Cost                          |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------- |
| A. A project testing decision names the stage; the stage says what "behaviour that matters" is | VI amended: its MUSTs depend on the stage | one decision, one amendment   |
| B. No stages: lean guidelines under VI as written                                              | unchanged                                 | no inertia fix for early work |
| C. The spec rates each story's risk, and the rating sets its tests                             | unchanged, VI read as "that matters"      | judgement per spec            |

### Frontend testing in Uraeda

See [the suite today](#the-suite-today) and [frontend testing](#frontend-testing). The UI checks
decision forbids pixel assertions, and the suite asserts them.

| Option                                                                                                            | Speed                      | Guards                                   |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------- |
| A. Behaviour tests with roles and text, a few real-browser journeys, axe; sizes and looks by screenshots reviewed | faster, browser files drop | behaviour and standards; looks by review |
| B. Logic and contract tests only; the UI by screenshots and review                                                | fastest                    | no UI behaviour guard                    |
| C. Keep the suite, delete only pixel assertions                                                                   | unchanged                  | today's coverage                         |

### Decisions: structural, not specific

See [decisions are mixed](#decisions-mix-intent-and-values). A rule states intent. The topic is
which rules may name a check, and whether to rewrite existing decisions here.

| Option                                                                                                        | Rewrites now                   | Cost of change         |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------- |
| A. Rules say intent; a number lives in code; a test named only for a standard or contract; the rest by review | decisions with specifics found | low for later features |
| B. Only the new rule, existing decisions left as they are                                                     | none                           | specifics stay         |
| C. Drop "Checked by" from decisions                                                                           | all 25                         | tools lose the pointer |

### The pull request body and the record

See [the order](#the-pr-body-should-just-be-the-record-needs-an-order) and the
[descriptions](#records-decisions-and-pull-requests) sources.

| Option                                                                                                                            | Duplication | Reviewer's view             |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------- |
| A. The body is the attention block, then the record verbatim; review-only items live in the record when a future agent needs them | none        | one text                    |
| B. The record is a short summary of the body                                                                                      | partial     | body longer than the record |
| C. Keep two documents                                                                                                             | full        | each written for its reader |

### Superseded records

| Option                                                                                               | Old record edited                           | Agent reads stale text        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------- |
| A. `superseded-by` in the old record's front matter, `supersedes` in the new; `ura check` pairs them | front matter and a one-line note at the top | warned at the top             |
| B. Only the new record links back                                                                    | never                                       | finds the old by search       |
| C. Dated "later" notes in the body                                                                   | body grows                                  | sees the correction beside it |

### Recording implementation issues

The proposal asks for an opinion. For: Claude Code's memory keeps what "can't [be derived] from the
code or git history"; ETH finds context helps on non-standard practices. Against: it skips
"debugging fixes" and files restating the code cost more. Records are read per feature, not loaded
every session, which lowers the cost the ETH study measured (judgement). The
[next priority](/specs/PRIORITIES.md) "References (docs) querying" already names the home for
library facts in general.

| Option                                                                                                     | Record size | Value to a later agent          |
| ---------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------- |
| A. An optional **Gotchas** section: only what the code and tests do not show, next to the choice it shaped | a few lines | finds the trap with the feature |
| B. None: gotchas wait for the references feature                                                           | none        | lost until that feature exists  |
| C. All rulings kept in the record                                                                          | large       | noise with the gotchas          |

### Rulings

See [rulings](#the-proposals-path-and-existing-actions). Five fields each, 22 in one change.

| Option                                                                                                            | Effort per ruling | Where the facts end up                  |
| ----------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------- |
| A. Decision, Rationale, Where; the other two optional; finish lifts behaviour changes and gotchas into the record | lower             | record                                  |
| B. Unchanged                                                                                                      | highest           | only behaviour changes reach the record |
| C. No rulings file: the commit bodies hold them                                                                   | none              | git only                                |

### The evaluation

See [studies of agent-written tests](#studies-of-agent-written-tests). The
[benchmarks package](/packages/benchmarks/) already runs whole flows on SWE-bench Pro tasks and
scores hidden tests, none of them UI.

| Option                                                                                                                                                           | Cost                       | Measures                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------- |
| A. By hand: Sonnet runs one small UI feature before and after the new wording, plus a probe that changes a requirement to see if it bends code or edits the test | a few runs, usage approval | test count, coupling, speed, stale-test behaviour |
| B. Automated scoring in the benchmarks package                                                                                                                   | new code and runs          | the same, repeatable                              |
| C. None: the wording is judged by reading                                                                                                                        | none                       | nothing                                           |

### Needs no choice

- **Mutation checks and test-first**: the skill already has them for risky guarantees
  ([tests that can fail](/skills/uraeda/references/code-quality.md#tests-that-can-fail)); the
  guidelines keep and shorten them.
- **Flaky tests, retries, fast check**: settled by the toolchain decision and the two earlier
  features.
- **Coverage**: stays on demand, per the toolchain decision.
- **Over-mocking**: the guidelines say to mock only boundaries; the project uses real components and
  an in-memory store already.

## Not checked

- **Pages not opened directly**: every web source above was fetched by a research agent, which
  returns a model's digest. I did not open them myself.
- **Google Testing Blog posts** ("Test Behavior, Not Implementation", "Change-Detector Tests
  Considered Harmful"): only comment threads loaded, so the posts are not cited.
- **Search-result snippets only**: AGENTS.md guidance beyond its example, the EvilGenie and
  ImpossibleBench percentages, the test-smell studies (arXiv 2410.10628, 2305.00418), and Meta's ACH
  mutation-guided generation (arXiv 2501.12862).
- **Not found**: a study of how often agents weaken tests in real repositories, an authoritative
  AGENTS.md rule on editing tests, and Sandi Metz's talk (no transcript).
- **Zettelkasten and the IETF's "Obsoleted by" index line**: not read.
- **Other branches in flight**: I read only the coherence-pass change in depth. I did not read the
  other open branches' diffs.
