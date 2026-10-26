---
status: answered
---

# Clarifications, round 01: Testing strategy review

> [!NOTE]
>
> Answered on 2026-10-26.
>
> - Verdict: worth building, with changes. The guidelines, decisions, and records are cheap and fix
>   the cause. Rewriting about 3,900 tests in the same feature is not.
> - Split of the feature: the test rewrite is far larger than the rest and depends on it.
> - Constitution: two answers, the authority of a test and scaling with the project's stage, need a
>   human amendment to principle VI. Agents cannot make it.
> - Authority of a test: today nothing says what to do with a test that guards behaviour the
>   approved spec replaces.
> - Records: the questions on the pull request body, superseded records, gotchas, and rulings work
>   together.
> - Evaluation: a few Claude Code runs spend your subscription's usage, and start only on your yes.
> - Settled points to check: a UI test needs no test-first step, and the plan stops copying exact
>   sizes into tests.

## Context

### Goal

Agents made undue changes to pass old tests that should have been dropped. The suite grew heavy,
above all in the frontend. You ask for clear, stack-agnostic testing guidelines in the skill, and
lean tests that follow them. You also ask for structural decisions. Records and pull request bodies
should say the same thing, and keep only what a later agent needs.

### Today

Two causes show in the repository.

- **The workflow gives tests authority.** A scenario's exact values become test assertions. The
  constitution forbids loosening, skipping, or deleting a test without a human request or a ruling.
  Nothing covers a test whose behaviour an approved spec replaces. In the open coherence-pass
  change, a test "failed on main before this change", and its removal still took a ruling.
- **Nothing limits how many tests exist.** Counted by hand, about 1,180 Rust and 2,680 TypeScript
  tests, in 274 TypeScript files and 71 Rust files.
  [The slowest test file](/packages/web/src/__browser__/layout.test.tsx) asserts "19 px at every
  width" and "every control is 44 px tall", although [UI checks](/specs/decisions/ui-checks.md) says
  UI tests MUST NOT assert pixels, "Checked by review".

Records and pull request bodies overlap: the
[record](/skills/uraeda/references/finish.md#write-the-record) and
[the pull request](/skills/uraeda/references/implementation.md#pull-request) each explain what
changed, with different sections. Rulings hold library facts, like Astryx's `adaptive` menu opening
as a sheet only with a coarse pointer, that disappear with the folder.

### Scope

Covered: the skill's testing guidance, the constitution's rules about tests, and the decisions'
wording. Also the formats of the record, the pull request body, and the rulings, and the evaluation
that tunes the wording. The rewrite of the existing tests depends on the first question. Not
covered: the CI and speed work of the two earlier testing features, and new test tools.

### Sources

- The code: [the constitution](/specs/CONSTITUTION.md),
  [`code-quality.md`](/skills/uraeda/references/code-quality.md),
  [`implementation.md`](/skills/uraeda/references/implementation.md),
  [`finish.md`](/skills/uraeda/references/finish.md), the
  [UI decisions](/specs/decisions/ui-checks.md), and the tests of [`packages/web`](/packages/web/).
- Outside: testing guidance from superpowers, Claude Code, Spec Kit, Google, Fowler, Dodds, and
  Beck. Playwright and Testing Library on the frontend. Studies of agent-written tests. ADR, kernel,
  and Google guidance on records. Claude Code's and ETH Zurich's findings on agent memory files. The
  full investigation is in [discovery](discovery-01.md).

## Check these

- **A UI test needs no test-first step.** The skill keeps test-first for logic, contracts, and bug
  fixes. A view's tests may follow its code, because its looks are judged by the screenshots you
  review. See [frontend testing](discovery-01.md#frontend-testing).
- **The plan stops copying exact sizes into tests.** A spec may still give a size, but a test
  asserts one only when an outside standard sets it, like a contrast ratio. See
  [where the pressure comes from](discovery-01.md#where-the-pressure-comes-from).
- **Existing tests are not touched in this round's work, unless Q1 puts the rewrite here.** The
  guidelines apply to tests written after them.

## Q1: Does this feature also rewrite the existing tests?

The proposal lists the guidelines and the rewrite of the existing tests as two steps of one feature.
About 3,900 tests across 345 files would each need a judgement against the guidelines. The open
coherence-pass change also edits web tests, so a big rewrite would meet it. See
[the scope](discovery-01.md#scope-of-this-feature).

Why it matters: the rewrite is the larger part, and its quality depends on guidelines tuned by the
evaluation. Done first, it may need redoing.

- **A (recommended). This feature does the guidelines, the decisions, the record and pull request
  formats, and the evaluation. A second feature, written after, rewrites the existing tests with the
  tuned guidelines.**
  - [pro] each pull request is reviewable, and the rewrite follows guidelines already tried.
  - [con] the suite stays heavy a few days longer.
  - Why recommended: the guidelines decide what the rewrite keeps, so they come first.
- **B. One feature does everything, including the rewrite.**
  - [pro] one pull request, one review.
  - [con] thousands of changed tests in one review, and guidelines not yet tried.
- **C. This feature does the guidelines and the rewrite. A second feature does the record, pull
  request, and rulings formats.**
  - [pro] the suite shrinks at once.
  - [con] the skill is edited by two features, and the rewrite still precedes the evaluation.

**Answer:** B: I'd rather you do everything in a single pass, I'll let you work for 10+ hours.

## Q2: What happens to a test that guards behaviour the approved spec replaces?

Example: a spec moves the session's column from the right edge to a tab. A test asserts a Storybook
link absent from the old column. The spec says the column's content changed.

Today the agent may not change that test without a ruling, and the constitution forbids loosening
it. So the agent bent code to keep the test green, or wrote a ruling for each. A test then has more
authority than the spec you approved. Superpowers says "Fix the code, not the test" and Google says
a test changes "only when requirements change": a requirement change is the missing exception. More
in [authority of a test](discovery-01.md#authority-of-a-test-against-the-spec).

Why it matters: this is the cause of the behaviour you describe, and it decides who owns the
exception, the spec or the constitution. The constitution is yours to amend.

- **A (recommended). The spec lists the behaviour it replaces, with the tests that guard it, found
  in discovery and planning. Your approval of the spec covers removing or rewriting them, and the
  record names them. The constitution stays as it is.**
  - Example: the spec names "the session's column no longer links Storybook" as replaced. The test
    goes in the task that changes the column, with no ruling.
  - [pro] the human decides at the moment they read the behaviour change, with nothing left to bend.
  - [con] discovery and the plan must find the tests, and a test missed still takes a ruling.
  - Why recommended: it puts the decision where you already decide, without touching the
    constitution.
- **B. As A, and you amend principle VI so that a test guarding replaced behaviour needs no
  ruling.**
  - [pro] the rule is stated once, at the top, and the skill's six copies shrink.
  - [con] a constitution amendment, which only you can make.
- **C. Keep today's rule: one ruling per removed test, listed in the review.**
  - [pro] no change to write.
  - [con] the cost that made the agent bend code stays.

**Answer:** B: I've actually removed principle VI, it was a bad principle and not really related to
the project at hand.

## Q3: Does testing effort scale with the project's stage?

Example: Uraeda is early. A view's scenarios change every few days. A stored file format, like a
record, rarely does.

Principle VI says each story's main scenarios, high-priority edge cases, and success criteria MUST
have tests. Storybook says "A prototype might skip testing, while a critical app may need thorough
coverage". Superpowers exempts throwaway prototypes with permission. The two sources agree that
stability, not a fixed ratio, makes tests pay. See
[scaling](discovery-01.md#scaling-testing-with-the-projects-stage). Option A conflicts with the
constitution: VI's MUST rules would depend on the stage, which only your amendment allows.

Why it matters: it sets how many tests every later feature writes, and so how much each change
costs.

- **A (recommended). A `testing` decision of the project names its stage: `early`, `growing`, or
  `stable`. The stage says what "behaviour that matters" is: at `early`, stored formats, git,
  security, and bug fixes; at `stable`, every story's main scenarios. You amend VI to point at it.**
  - Example: at `early`, a new view gets one journey and its logic tests, not one test per scenario.
  - [pro] early work gets no undue inertia, and stability earns more tests.
  - [con] a constitution amendment, and the stage is a judgement you must move over time.
  - Why recommended: you named the early-stage inertia, and a decision is where a changing state
    lives.
- **B. No stages. Lean guidelines under VI as written.**
  - [pro] no amendment, one rule for all.
  - [con] early work keeps VI's full scope for every scenario.
- **C. Each spec rates a story's risk, and the rating sets its tests, under VI's "that matters".**
  - [pro] no amendment, and a risky story gets more.
  - [con] a judgement per spec, which you review each time.

**Answer:** A

## Q4: How should the web UI be tested?

Example: the layout test checks a paragraph is 19 px, a control is 44 px, and the transcript is at
least 1.4 times the column. Changing the look means rewriting these.

The suite has 64 browser files at two sizes, and the two slowest take about two minutes each. Fowler
calls UI end-to-end tests "notoriously flaky", Dodds says tests of implementation details give false
alarms, and Playwright says screenshot baselines vary by host. WCAG contrast and axe are outside
standards that do not change with the look. See
[frontend testing](discovery-01.md#frontend-testing).

Why it matters: it sets what the rewrite keeps and what every UI feature costs.

- **A (recommended). Behaviour tests by roles and text in the fast runner, a few real-browser
  journeys, and axe for accessibility. Sizes and looks are judged by the screenshots you review,
  with no pixel assertions.**
  - Example: the layout test keeps "the page has no sideways scroll" and axe, and drops 19 px and 44
    px.
  - [pro] looks can change without test edits, and browser time drops.
  - [con] a size regression no screenshot shows is not caught.
  - Why recommended: it matches UI checks' own rule and the sources.
- **B. Logic and contract tests only. The UI is checked by screenshots and your review.**
  - [pro] the fastest, and the least to maintain.
  - [con] no automatic guard on UI behaviour like Back or a reload keeping a pane.
- **C. Keep the suite and delete only the pixel assertions.**
  - [pro] the least change.
  - [con] about 3,000 tests of mostly unclear value stay, and the speed does not improve.

**Answer:** B: I don't even want screenshots, I'd rather review actual behaviour with the sandbox.

Maybe 1 screenshot per new view in the PR is warranted but that's it. No screenshots for review in
the repo.

## Q5: Do decisions state structure and never specifics?

Example: UI layout says a feature's session opens "at least 400 px wide", and UI look says "120% of
Astryx's base size". The values live in the theme, and a test pins them.

You say a decision should be structural.
[What is a decision](/skills/uraeda/references/spec.md#what-is-a-decision) already says a decision
states intent, not a value the code holds. Today a rule can name a value, and then a test. See
[decisions](discovery-01.md#decisions-structural-not-specific).

Why it matters: a specific in a decision makes every look change a decision change. A rule left
without a check is a rule only review enforces.

- **A (recommended). A rule states intent. Its numbers live in the code. "Checked by" names a test
  only for an outside standard or a contract, like WCAG contrast or a file format, and says "review"
  otherwise.**
  - Example: "the session opens beside the document at a readable width", with 400 px in the theme.
  - [pro] looks change without a decision change, and no test exists only for a chosen number.
  - [con] a rule checked by review can be forgotten.
  - Why recommended: it follows the rule already written, and tests nothing a user cannot feel.
- **B. Only the new rule. Existing decisions stay as they are.**
  - [pro] no decision edit.
  - [con] the specifics and their tests stay.
- **C. Drop "Checked by" from every decision.**
  - [pro] decisions become pure intent.
  - [con] tools and agents lose the pointer to what guards a rule.

**Answer:** A: Yes: behaviour is encoded IN THE CODE.

Decisions only serve a purpose if they store information that's not already in the code.

### Q5.A: Which existing decisions does this feature rewrite?

Only if you picked A in Q5. The audit found values in [UI layout](/specs/decisions/ui-layout.md),
[UI look](/specs/decisions/ui-look.md), and [UI checks](/specs/decisions/ui-checks.md). The other 22
were not audited rule by rule.

Why it matters: each rewritten decision needs your approval of the spec that lists it.

- **A (recommended). The decisions with specifics the audit found, in this feature. The others in a
  later decisions check.**
  - [pro] a short list to approve.
  - [con] a specific in an unaudited decision can remain.
  - Why recommended: it keeps the spec within one sitting.
- **B. All 25 decisions, audited and rewritten here.**
  - [pro] the ledger is consistent at once.
  - [con] a long spec, with many changed decisions.

**Answer:** A

## Q6: Is the pull request body the record?

Example: the coherence-pass body has an opening block, "What was done", "Approach", "What stays
unchanged, and the tests", "Size", and rulings. Its record has "What and why", "Behaviour",
"Design", and "Changes after approval".

Both explain what changed, how, and why. Google calls a description a "permanent public record", and
the kernel says to lead with the problem. The record is written first, then the pull request is
marked ready. See [the order](discovery-01.md#the-pr-body-should-just-be-the-record-needs-an-order).

Why it matters: two texts that say the same thing drift, and the reviewer reads both.

- **A (recommended). The body is the opening block, "Pull request to review, about N minutes" with
  the points needing attention, then the record's text verbatim. Review-only facts, like function
  sizes, drop out, and what a later agent needs, like tests replaced, is in the record.**
  - [pro] one text, written once, and the reviewer reads what will be kept.
  - [con] the reviewer loses the size table, a list the checks already print.
  - Why recommended: it is your own wording, and no copy can drift.
- **B. The record is a short summary of the body.**
  - [pro] the body can stay detailed.
  - [con] two texts, and the summary can omit the why.
- **C. Keep two documents, written for two readers.**
  - [pro] each fits its reader.
  - [con] the duplication you want gone.

**Answer:** A: Let's do that but allow the agent to make small changes to the record for the PR
body.

In particular in the PR it can include screenshots, which should not be in the record/repo.

## Q7: May an agent edit an old record to link to its successor?

Example: a record says the session's column has a Storybook link. A newer change removed it. An
agent reading the old record trusts it.

Today records are frozen except to fix a broken link. Nygard and MADR mark a superseded decision
with a reference to its replacement. The IETF puts the link in the new document. A practitioner repo
found strict immutability worked worse than dated notes. See
[superseded records](discovery-01.md#records-decisions-and-pull-requests).

Why it matters: it decides whether a stale record can mislead an agent. It also changes what the
finish step and `ura check` do.

- **A (recommended). The old record gains a `superseded-by` front matter field and a one-line note
  at its top. The new record's `supersedes` names it. `ura check` pairs them. Nothing else in an old
  record is edited.**
  - Example: the old record's top reads "Superseded in part by [the coherence pass]".
  - [pro] the reader of an old record learns first that it is out of date, and the tool can check
    it.
  - [con] a second allowed edit to a frozen record, and a field the core must learn.
  - Why recommended: it is the standard practice with a narrow edit.
- **B. Only the new record links back. Old records are never edited.**
  - [pro] records stay frozen.
  - [con] the stale record carries no warning, and the agent finds the new one only by search.
- **C. Dated "later" notes may be added in the body of an old record.**
  - [pro] the correction sits beside the stale text.
  - [con] old records grow, and notes drift from their sources.

**Answer:** A

## Q8: Should records keep the issues faced during implementation?

Example: a library forces a workaround. The coherence-pass change found that Astryx's `adaptive`
opens a sheet only with a coarse pointer. It is today only in a ruling, which the finish step
deletes with the folder.

My opinion, as you asked. Claude Code's memory keeps what "can't [be derived] from the code or git
history" and skips debugging fixes. ETH Zurich finds repository context that restates the code
raises cost without raising success, but helps on non-standard practices. A record is read for one
feature, not loaded every session, so its cost is lower. The next priority, references querying,
will hold library facts in general. See [gotchas](discovery-01.md#recording-implementation-issues).

Why it matters: it decides whether a later agent meets the same trap twice, and how much noise
records carry.

- **A (recommended). An optional "Gotchas" section: only what the code and tests do not show, one
  line each, next to the choice it shaped.**
  - [pro] the trap is found with its feature, at a small cost.
  - [con] an agent must judge what the code shows, and may keep noise.
  - Why recommended: it keeps the non-derivable facts, which the sources agree are worth keeping.
- **B. None. Gotchas wait for the references feature.**
  - [pro] records stay short.
  - [con] the facts are lost until that feature exists.
- **C. Every ruling is kept in the record.**
  - [pro] nothing is lost.
  - [con] 22 rulings of one change would bury the facts that matter.

**Answer:** A

## Q9: What happens to rulings?

Example: coherence-pass has 22 rulings of five fields each: Decision, Rationale, Alternatives
considered, If wrong, Where. R1 is a re-aimed test, R2 a library fact, R7 "round marks stay round".

The finish step lifts only rulings that change behaviour. This depends on Q6 and Q8: the record is
the pull request, and a gotcha has a section. See [rulings](discovery-01.md#rulings).

Why it matters: the cost of a ruling is paid at every small choice, and what it stores must reach
the record to matter.

- **A (recommended). A ruling keeps Decision, Rationale, and Where, with the other two fields
  optional. The finish step lifts behaviour changes and gotchas into the record.**
  - [pro] cheaper rulings, and the facts that matter reach the record.
  - [con] a template and an example to change.
  - Why recommended: it fits Q6 and Q8 and keeps the reasoning.
- **B. Unchanged.**
  - [pro] no change.
  - [con] the highest cost per ruling, and gotchas stay buried.
- **C. No rulings file: choices go in commit bodies.**
  - [pro] nothing to maintain.
  - [con] a choice is found only by `git log`, with no list for the review.

**Answer:** A

## Q10: How is the new wording evaluated?

Example: Sonnet builds one small web feature with the current skill, then with the new wording. A
probe then changes a requirement and checks whether it edits the test or bends the code.

You asked for a small evaluation with Claude Code and Sonnet, judged by you. The
[benchmarks package](/packages/benchmarks/) scores hidden tests on non-UI tasks. The studies measure
test counts, mocks, and "cheating" on impossible tests, and none measures stale tests in a real
repository. A run needs your approval, per the benchmarks decision. See
[the evaluation](discovery-01.md#the-evaluation).

Why it matters: the wording is unverified until it is run, and the runs spend your subscription's
usage.

- **A (recommended). By hand: about four Sonnet runs on one small web feature, two with the old
  wording and two with the new, plus the requirement probe. Scored by a fixed list: number of tests,
  assertions on markup or sizes, run time, and what a changed requirement does. Choosing it approves
  those runs.**
  - [pro] cheap, and it measures your stated problem directly.
  - [con] four runs are anecdotes, not a benchmark.
  - Why recommended: you asked for no complexity and a feature judged by you.
- **B. Automated test-quality scoring in the benchmarks package.**
  - [pro] repeatable on later changes.
  - [con] new code, and runs of its own.
- **C. No evaluation. The wording is judged by reading.**
  - [pro] free.
  - [con] nothing shows the agents behave differently.

**Answer:** A: I want _you_ to judge the output as part of the feature development. Iterate on the
skill's wording until we get small, efficient, useful, focused tests. But keep the skill's wording
generic.

You can use fresh subagents to evaluate testing quality for example. You're allowed to use my
opencode client too, with DeepSeek Flash v4.1, to have another model evaluate things, making it a
bit more objective.

## Settled without the human

### Behaviour

- **Guidelines stay stack-agnostic.** They say what a good test is, how many, and when to drop one,
  without naming a language or tool, as you asked. Tool names live in the project's decisions. See
  [what the sources agree on](discovery-01.md#what-they-have-in-common).
- **A test is evidence, never authority.** A failing test is first checked against the spec and the
  human's request. Then the code or the test is fixed, and the report says which. Superpowers and
  Google say the same.
- **Mocks only at boundaries.** The project already uses real components and an in-memory store.
- **Mutation checks stay for risky guarantees.** They are the existing
  [tests that can fail](/skills/uraeda/references/code-quality.md#tests-that-can-fail), shortened.

### Under the hood

- **The evaluation's feature.** A small web feature from Uraeda's own drafts, picked at planning, so
  the tests are real UI tests.
- **Tests and the benchmarks decision.** The evaluation runs only once you have answered Q10.
- **The one home of the rule.** The test-removal rule lives in the testing section of
  `code-quality.md`, and the other steps link to it, per
  [one home per rule](/skills/uraeda/references/code-quality.md#one-home-per-rule).

**Notes:**

- **A UI test needs no test-first step.**: They're usually even judged by generated code and running
  the live application.
