# Discovery, round 01: Code quality and maintainability through the skill

## Summary

The proposal bundles three changes to the workflow, plus a constitution amendment:

1. **Split the spec.** Today's `spec.md` holds both what the human approves and what the agent
   builds from. The proposal wants a short spec for the human and a `design.md` for the agent that
   nobody reviews.
2. **Add a few code-quality concepts to the references**, each backed by a check a tool runs: one
   home per rule, extract instead of grow, rules enforced by tools with a ratchet, tests that can
   fail, and UIs verified end to end.
3. **Add a maintenance flow**: an agent audits the codebase, the human answers its findings like a
   round of questions, and the fixes go through the usual flow.
4. **Amend the constitution**: "each rule lives in one place" and "quality never regresses", in this
   repository's constitution and in the template.

Established tools draw the same line as the proposal:

- Spec Kit, Kiro, OpenSpec, and BMAD separate what and why from how.
- The tools practitioners find bearable gate the human on a short what-and-why document. OpenSpec
  gives its `design.md` no review question at all.
- `design.md` is the most common name for the how-file.
- Agreement between the files is kept by stable IDs and a read-only checker, not by a human
  rereading.

Prior art on quality says the same as the proposal:

- Instructions alone do not stop decay.
- OpenAI enforces layers and file sizes with custom lints whose messages tell the agent the fix, and
  runs recurring cleanup agents "like garbage collection".
- SonarQube and CodeScene gate only what a change makes worse.
- Linters now ship baselines (ESLint and Oxlint bulk suppressions), which turn a size rule into a
  ratchet.

The code today:

- Several of the proposal's examples were fixed on 2026-10-13 by the review-findings refactors.
- The repository has almost no quality tooling: only `clippy::all`, and no size, complexity, or
  duplication rule in any language.
- Three lines of the references argue against size limits.
- `report.md` already names a bug report in the core.
- The skill's `SKILL.md` is 450 lines but about 8,500 tokens, over the Agent Skills recommendation
  of 5,000 tokens.

## How other products do it

### GitHub Spec Kit

- **Files.** `/specify` writes `spec.md`. `/plan` writes `plan.md`, `research.md`, `data-model.md`,
  `quickstart.md`, and `contracts/`. `/tasks` writes `tasks.md`.
  ([plan template](https://raw.githubusercontent.com/github/spec-kit/main/templates/plan-template.md),
  [agentic SDD](https://github.github.io/spec-kit/reference/agentic-sdd.html))
- **The spec is for stakeholders**: "Written for business stakeholders, not developers", "Focus on
  WHAT users need and WHY", "Avoid HOW to implement"
  ([specify command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md)).
  - It has no length limit, only "Maximum 3 [NEEDS CLARIFICATION] markers".
- **The plan stays readable**: "This implementation plan should remain high-level and readable. Any
  code samples, detailed algorithms, or extensive technical specifications must be placed in the
  appropriate `implementation-details/` file"
  ([spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md)).
- **`/clarify`** asks at most 5 questions, each with "Why it matters" and a recommended option
  ([clarify command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md)).
- **`/analyze`** is a read-only consistency checker
  ([analyze command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/analyze.md)):
  - It looks for duplication, ambiguity, gaps, and conflicts with the constitution, which are
    "automatically CRITICAL".
  - It checks coverage both ways: requirements with no task, and tasks with no requirement.
  - It caps the report at 50 findings.
- **Constitution check and complexity tracking.**
  - The plan template has a "Constitution Check" gate.
  - Complexity Tracking is filled "ONLY if Constitution Check has violations", with the columns
    Violation, Why Needed, and Simpler Alternative Rejected Because.
  - Spec Kit's own constitution words code quality as MUST rules: "Honor the single source of truth
    … Duplicate keys MUST fail loudly", and PRs "MUST: pass `ruff`, `pytest` …"
  - Sources: the plan template, and the repository's `.specify/memory/constitution.md` (cloned at
    96774bc).
- **A real drift case.** `spec.md` and `data-model.md` said `nvarchar(200)`, `tasks.md` dropped it,
  and the agent built 500 ([issue #4383](https://github.com/github/spec-kit/issues/4383)).
- **Experience report.** Colin Eberhardt measured **2,577 lines** of markdown for one feature
  ([Scott Logic](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html)):
  - a 189-line spec, then about 2,030 lines of plan files;
  - the spec took 15 minutes to review, the plan 2 hours, which "might not have been needed";
  - the 689 lines of code took 30 minutes.

### AWS Kiro

- **Files.** `requirements.md` holds user stories in EARS form ("WHEN … THE SYSTEM SHALL …"),
  `design.md` the architecture, data models, error handling, and testing strategy, and `tasks.md`
  the tasks ([Kiro specs](https://kiro.dev/docs/specs/)).
- **All three are reviewed**: "Review requirements for completeness", "Review the technical
  approach", "Review the task breakdown"
  ([requirements-first](https://kiro.dev/docs/specs/feature-specs/requirements-first.md)).
- **Traceability.** Tasks link to requirements
  ([introducing Kiro](https://kiro.dev/blog/introducing-kiro/)), and property-based tests derive
  from the EARS requirements ([correctness](https://kiro.dev/docs/specs/correctness.md)).

### OpenSpec

- **Files.** `proposal.md`, spec deltas, an optional `design.md`, and `tasks.md`
  ([schema](https://github.com/Fission-AI/OpenSpec/blob/main/schemas/spec-driven/schema.yaml)).
- **Size and content rules** (same schema):
  - The proposal is "concise (1-2 pages) … implementation details belong in design.md".
  - "A spec is a behavior contract, not an implementation plan. … if the implementation can change
    without changing externally visible behavior, it likely does not belong in the spec."
  - Each requirement is at most 500 characters, enforced by `validate --strict`.
- **`design.md`** is written only for cross-cutting changes, new dependencies, data model changes,
  or migrations
  ([design template](https://github.com/Fission-AI/OpenSpec/blob/main/schemas/spec-driven/templates/design.md)):
  - Its sections are Context, Goals and Non-Goals, Decisions, Risks and Trade-offs, Migration Plan,
    and Open Questions.
  - "If a section would only restate them, point to them instead."
- **Review order**
  ([reviewing changes](https://github.com/Fission-AI/OpenSpec/blob/main/docs/reviewing-changes.md)):
  - The review is "the two minutes where you do that", and "You don't need to read every line".
  - Read in the order that "lets you quit earliest": proposal, then spec deltas, then tasks.
  - `design.md` has no review question of its own.
  - A second check after the code, `/opsx:verify`, confirms "Design decisions actually show up in
    the code".

### BMAD method

- **The spec.** `spec-<slug>.md` is "a short contract that Build reads", with five fields: Why,
  Capabilities, Constraints, Non-goals, and Success signal. Technical choices go to `addendum.md`
  ([define requirements](https://docs.bmad-method.org/plan/define-requirements-and-a-specification/)).
- **The architecture "spine"** keeps "only the decisions that would conflict if two people made them
  independently"
  ([design and architecture](https://docs.bmad-method.org/plan/design-ux-and-architecture/)):
  - The folder tree and data shapes are left to the code: "the code owns them once they exist".
  - It names "a spine written once and never updated" as a failure mode.

### superpowers

- **brainstorming** writes `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, "a plain document
  a talented builder in the domain could plan from", which the human approves at a hard gate
  ([brainstorming](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)).
- **writing-plans**: "A plan is the set of decisions the implementer cannot make alone. A plan
  longer than the code it describes has written the code instead."
  ([writing-plans](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md))
- **Task reviewer**: two verdicts, spec compliance then code quality
  (`skills/subagent-driven-development/task-reviewer-prompt.md`, read at bb92a77).
  - It asks: "Did this change create new files that are already large, or significantly grow
    existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)"
  - It counts "verbatim duplication of a logic block" and "tests that assert nothing" as Important.
- **Tests** (`skills/test-driven-development/writing-good-tests.md`):
  - "Every test names the break it catches. Every test exercises the real thing."
  - "The Mutation Check: Before finishing, mentally mutate the production code; at least one test
    should fail for each realistic mutation."
  - The file replaced `testing-anti-patterns.md` in v7.0.0.
- **Skill length.** Two of its own `SKILL.md` files go over 500 lines: subagent-driven-development
  is 568 and writing-skills is 681. writing-skills asks for frequently loaded skills under 200
  words.

### OpenAI harness engineering

All quotes from ["Harness engineering"](https://openai.com/index/harness-engineering/) (2026-02-11,
read from a saved copy).

- **AGENTS.md is a map**: "give Codex a map, not a 1,000-page instruction manual". A "short
  AGENTS.md (roughly 100 lines)" points into `docs/`.
- **Mechanical rules**: "we statically enforce structured logging, naming conventions …, file size
  limits … with custom lints. Because the lints are custom, we write the error messages to inject
  remediation instructions into agent context."
- **Layers**: "Types → Config → Repo → Service → Runtime → UI", "enforced mechanically via custom
  linters … and structural tests".
- **Golden principles and cleanup.** "Codex replicates patterns that already exist in the
  repository—even uneven or suboptimal ones."
  - One golden principle: "we prefer shared utility packages over hand-rolled helpers to keep
    invariants centralized".
  - "background Codex tasks that scan for deviations, update quality grades, and open targeted
    refactoring pull requests. Most of these can be reviewed in under a minute … This functions like
    garbage collection."
  - Before this, the team spent "every Friday (20% of the week)" cleaning up.
- **A quality document** "grades each product domain and architectural layer, tracking gaps over
  time".
- **Rules move into code**: "When documentation falls short, we promote the rule into code".

### Anthropic and Claude Code

- **Routines** run on a schedule, an API call, or GitHub events, with an hourly minimum
  ([routines](https://code.claude.com/docs/en/routines), research preview).
  - One documented example scans the PRs merged since the last run.
- **Anthropic's internal maintenance routines**, from secondary coverage only
  ([The Decoder](https://the-decoder.com/claude-code-now-runs-daily-maintenance-on-anthropics-software-with-a-46-percent-merge-rate/)):
  - They run daily, with names like Dup Unifier, Dead Code Removal, Useless Test Pruner, and
    Abstraction Police.
  - 180 of 388 PRs were merged.
- **The `code-review` plugin** keeps noise down (`plugins/code-review/commands/code-review.md` in
  [anthropics/claude-code](https://github.com/anthropics/claude-code)):
  - It reports "HIGH SIGNAL issues" only, each checked by a validation subagent.
  - It drops pre-existing issues, nitpicks, and "Issues that a linter will catch".
- **Best practices** ([best practices](https://code.claude.com/docs/en/best-practices)):
  - "Give Claude a check it can run."
  - "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic."
  - "Bloated CLAUDE.md files cause Claude to ignore your actual instructions."

### Quality gates: SonarQube, CodeScene, Google

- **SonarQube**
  ([clean as you code](https://docs.sonarsource.com/sonarqube-server/latest/core-concepts/clean-as-you-code/introduction/),
  [quality gates](https://docs.sonarsource.com/sonarqube-server/latest/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates/)):
  - "Sonar way" gates new code only: zero new issues, and duplicated lines at most 3%.
  - Cleaning new code improves the old code over time.
  - Findings can be Accepted ("fix later") or marked False positive
    ([managing issues](https://docs.sonarsource.com/sonarqube-server/latest/user-guide/issues/managing/)).
- **CodeScene**
  ([delta analysis](https://docs.enterprise.codescene.io/latest/guides/delta/automated-delta-analyses.html)):
  - Its "Code Health Decline" gate flags only what a change makes worse.
  - It audits hotspots first: high change frequency and low health. In its example, 1.2% of the code
    takes 45% of the bug fixes
    ([hotspots](https://codescene.io/docs/guides/technical/hotspots.html)).
- **Google**: approve a change once it "definitely improves the overall code health", because
  "codebases degrade through small decreases in code health over time"
  ([review standard](https://google.github.io/eng-practices/review/reviewer/standard.html)).
- **Notion**: a per-file, per-rule count of allowed lint errors
  ([ratcheting](https://www.notion.com/blog/how-we-evolved-our-code-notions-ratcheting-system-using-custom-eslint-rules)):
  - The count goes down automatically when an error is fixed.
  - A new error blocks the merge.

### Recurring reports answered by a human

- **Renovate**: one living "Dependency Dashboard" issue, answered with checkboxes
  ([dashboard](https://docs.renovatebot.com/key-concepts/dashboard/)).
  - It advises against requiring approval for everything: "you'll probably forget to check often
    enough, and out of sight means out of mind!"
- **GitHub code scanning**: a dismissed alert needs a reason, one of `false positive`, `won't fix`,
  or `used in tests`, plus a comment of up to 280 characters
  ([REST API](https://docs.github.com/en/rest/code-scanning/code-scanning)).
- **Devin**: scheduled sessions for "Routine code maintenance"
  ([scheduled sessions](https://docs.devin.ai/product-guides/scheduled-sessions)).
  - Its playbooks have a "Required from User" section
    ([playbooks](https://docs.devin.ai/product-guides/creating-playbooks)).
- **Cadence**: daily at OpenAI and Anthropic, weekly in the Claude Code and Devin examples, and per
  sprint or quarter for debt registers. No source triggers an audit after a number of merges.

### Design documents for busy readers

- **Google design docs**: context and scope come first, then goals and non-goals, the design, and
  "Alternatives considered", "one of the most important"
  ([design docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)).
  - A mini doc is 1 to 3 pages.
  - Copy-pasted schemas and interfaces "go stale quickly".
- **Rust RFCs** split one document for two readers
  ([template](https://github.com/rust-lang/rfcs/blob/master/0000-template.md)): a guide-level
  explanation, for teaching, and a reference-level one, for implementers.
- **ADRs**: "one or two pages", because "Large documents are never kept up to date" and "Nobody ever
  reads large documents"
  ([Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).
  - MADR adds an optional **Confirmation** section: how compliance is verified, by review or by a
    test ([MADR](https://adr.github.io/madr/)).
- **C4**: "the system context and container diagrams are sufficient for most software development
  teams" ([C4 diagrams](https://c4model.com/diagrams)).
- **Inverted pyramid**: put the most important information first, so readers can stop anywhere
  ([NN/g](https://www.nngroup.com/articles/inverted-pyramid/)).
  - Users read "at most 28% of the words"
    ([NN/g](https://www.nngroup.com/articles/how-little-do-users-read/)).
- **Practitioner reports on volume**:
  - Böckeler: "I'd rather review code than all these markdown files"; Spec Kit's files were "very
    verbose and tedious to review"; the agent still "generated them all over again, creating
    duplicates"
    ([martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).
  - Marmelab: "SDD produces too much text, especially in the design phase"
    ([Marmelab](https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html)).
  - Thoughtworks Radar: "lengthy spec files that are hard to review"
    ([radar](https://www.thoughtworks.com/radar/techniques/spec-driven-development)).
- **Reviewer fatigue**: approval of agent PRs rose from 30.1% to 36.8% while inline comments fell
  22%, "most consistent with reflexive habituation"
  ([Yu et al., 2026 preprint](https://arxiv.org/abs/2606.22721)).

### What they have in common

- **What and why are kept apart from how.** The human gate sits on the short what-and-why file;
  `design.md` is the usual name for the how.
- **Agreement comes from stable IDs and a read-only checker**: `/analyze`, Kiro's links,
  `openspec validate`. Detail lost between agent files is the documented failure.
- **Leave to the code what the code owns**: schemas, interfaces, folder trees.
- **Size budgets are small and counted in pages, items, or sentences**, never in thousands of lines.
- **Quality is held by mechanical gates on new code**: lints with remediation messages, baselines,
  and gates on what a change makes worse. Prose instructions are kept short.
- **A recurring agent cleans up**, in small changes reviewed quickly. Findings are triaged as fix,
  accept, or false positive, with a reason.
- **Reviews state what was added**: "don't flag pre-existing file sizes".

## Standards and libraries

### Agent Skills specification and skill authoring guidance

- **The specification** ([specification](https://agentskills.io/specification)):
  - "Keep your main `SKILL.md` under 500 lines. Move detailed reference material to separate files."
  - The body should stay "< 5000 tokens recommended".
  - "Keep file references one level deep from SKILL.md."
- **Anthropic's best practices**
  ([best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)):
  - "The context window is a public good." "Does this paragraph justify its token cost?"
  - Reference files over 100 lines need a table of contents.
  - "Prefer scripts for deterministic operations", with "specific error messages … to help Claude
    fix issues".

### Research on agents and code quality

Each claim the proposal cites, checked against its source:

- **SlopCodeBench** ([arXiv 2603.24755](https://arxiv.org/abs/2603.24755), Python only): confirmed.
  - Erosion rises in 77% of runs, and agent code ends 2.3× more verbose and 2.0× more eroded than
    human repositories.
  - "main() … from 38 to 240 lines … no helper is extracted."
  - Quality prompts cut the initial levels "by up to a third, without affecting degradation rates".
  - The paper tests no gates: "structure and measured gates have to do the rest" is the proposal's
    inference.
- **SWE-CI** ([arXiv 2603.03823](https://arxiv.org/abs/2603.03823)): confirmed.
  - 15 of 20 models beat humans on Pylint, and all 20 are worse on the maintainability index.
- **He et al., MSR '26** ([arXiv 2511.04427](https://arxiv.org/abs/2511.04427)): confirmed.
  - Warnings are +30.3% and cognitive complexity +41.6% after adopting Cursor.
  - The velocity gain is gone after the first two months.
  - Duplicated lines show no significant change.
  - The authors suggest "refactoring sprints triggered by code quality metrics".
- **METR**
  ([note](https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/)):
  confirmed. About half of test-passing patches would not be merged, increasingly for code quality
  in recent models.
- **Gloaguen et al.** ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988)):
  - **Venue.** It was presented at ICLR 2026 _workshops_ (RSI, MemAgents), not the main conference.
  - **Findings.** Context files "do not generally improve task success rates, while increasing
    inference cost by over 20%".
  - **Instructions are followed.** Repository overviews do not help.
  - The paper does not test moving rules into tools.
- **GitClear 2025** ([report](https://www.gitclear.com/ai_assistant_code_quality_2025_research)):
  confirmed. Moved lines fell from 25% to under 10%, and copy-pasted lines rose from 8.3% to 12.3%.
- **OX Security.** The 80 to 90% figure was seen only in secondary coverage: see
  [Not checked](#not-checked).

### Kent Beck, Tidy First

- **The newsletter**: "changes to the structure of the system are fundamentally different from
  changes to the behavior"
  ([Structure & Behavior](https://newsletter.kentbeck.com/p/structure-and-behavior)).
- **The commit rule.** "Never mix structural and behavioral changes in the same commit — Always make
  structural changes first when both are needed — Validate structural changes do not alter behavior
  by running tests before and after."
  - This is in Beck's own agent instructions, `rust/docs/CLAUDE.md` in
    [KentBeck/BPlusTree3](https://github.com/KentBeck/BPlusTree3).
  - The proposal's quote comes from there.

### Clippy

All from the [lint list](https://rust-lang.github.io/rust-clippy/master/index.html) and the
[configuration](https://doc.rust-lang.org/clippy/lint_configuration.html).

- **`too_many_lines`**: pedantic, off by default, threshold 100.
- **`too_many_arguments`**: warn by default, threshold 7. Under `-D warnings` it already fails at 8
  parameters.
- **`excessive_nesting`**: warn, but it only fires once a threshold is set.
- **`cognitive_complexity`**: in restriction, with the note "The true Cognitive Complexity of a
  method is not something we can calculate using modern technology". It recommends `too_many_lines`
  and `excessive_nesting` instead.
- **`disallowed_methods` and `disallowed_types`** take a `reason` that is printed in the diagnostic.
  That is a remediation message.
- **Existing offenders.** Clippy has no baseline file.
  `#[expect(clippy::too_many_lines, reason = "…")]` marks one: it warns once the expectation is no
  longer met, so under `-D warnings` the marker must be removed when the function is fixed
  (judgement: it works as a per-item ratchet).
  - `allow_attributes_without_reason` requires the reason.

### Oxlint, through Vite+

- **Available rules.** The bundled oxlint 1.85.0 has `max-lines` (300), `max-lines-per-function`
  (50), `complexity` (cyclomatic, 20), `max-depth` (4), `max-params` (3), and `import/no-cycle`.
  - Source: the `configuration_schema.json` installed with vite-plus, and the
    [rule docs](https://oxc.rs/docs/guide/usage/linter/rules/).
  - It has no cognitive-complexity rule.
- **Messages.** The size rules print generic help. `no-restricted-imports` takes a `message` per
  entry, and JS plugins can define their own messages
  ([JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins), alpha).
- **Bulk suppressions**, verified locally on 1.85.0 but not in the CLI docs:
  - `--suppress-all` writes `oxlint-suppressions.json`, a count per file and rule.
  - A run fails when a count rises, and asks for `--prune-suppressions` when it falls.
  - Whether `vp lint` passes these flags through is not verified.
  - ESLint has the same feature since v9.24
    ([suppressions](https://eslint.org/docs/latest/use/suppressions)).
- **Precedent in this repository.** The lint rules already print the fix ("use Astryx Button"), and
  [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts) checks that each rule fires on a
  fixture.

### Duplication detectors

- **jscpd** 5.4.1 ([repository](https://github.com/kucherenko/jscpd)):
  - It reads Rust, TypeScript, and Lua, but token matching stays within one language:
    `--cross-formats` only groups the JS family and the CSS family.
  - Its experimental semantic mode pairs functions across languages, using a 548 MB embedding model.
    It skips Lua, and also "reports related code, such as a client function and the server endpoint
    it calls".
  - `--baseline … --fail-on-new-clones` is a ratchet.
- **PMD CPD** compares one language per run
  ([CPD](https://docs.pmd-code.org/latest/pmd_userdocs_cpd.html)).
- **Judgement**: a rule written once in Rust and again in TypeScript, such as a default value or a
  list of gate kinds, escapes token detectors. Architecture tests and generated bindings catch it
  better. This repository already has both: `stack.test.ts` and the napi-generated types.

### Mutation testing

- **cargo-mutants** 27.1.0 ([book](https://mutants.rs/print.html)):
  - `--in-diff` mutates only the changed lines, and is "not a substitute for a full test run".
  - Each mutant runs the mutated package's own tests. `--test-workspace` is needed for the cli and
    lsp integration tests.
  - Each job's target folder can be 2 GB or more.
  - Judgement: a full run on this repository would take hours.
- **Stryker** 10.0.0 with the Vitest runner
  ([vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)): "Browser Mode is not
  supported", so the web's WebKit tests cannot be mutation-tested.
- **Lua**: no maintained mutation tool. luamut on LuaRocks is dev-only, with 50 downloads.
- **Google at scale**
  ([TSE 2021](https://homes.cs.washington.edu/~rjust/publ/practical_mutation_testing_tse_2021.pdf)):
  - It mutates changed lines only, and surfaces the results in code review.
  - Developers first judged 85% of reported mutants unproductive, 11% after suppressing "arid" code.

### Lua linters

- **selene** 0.32.0 has `high_cyclomatic_complexity`, off by default, and `restricted_module_paths`
  with custom messages. It has no function-length lint.
- **luacheck** has a cyclomatic-complexity warning.
- **Neither is in the Nix flake today** ([`flake.nix`](/flake.nix)).

### Browser tests

- **Vitest browser mode** "does not completely replace standalone end-to-end test runners"
  ([why](https://vitest.dev/guide/browser/why)).
- **This repository's browser project**
  ([`vite.browser.config.ts`](/packages/web/vite.browser.config.ts)) runs the whole app:
  - in WebKit, at phone and desktop sizes;
  - with the real server mounted in-process and a fake agent.
- **Playwright's test agents** include a "healer" that edits tests until they pass
  ([test agents](https://playwright.dev/docs/test-agents)). That conflicts with
  [UI checks](../decisions/ui-checks.md): a test is "never kept passing by loosening its assertion".

## The code

### Important reads

- [`SKILL.md`](/skills/uraeda/SKILL.md): 450 lines, 4,772 words, about 8,500 tokens.
  - Starting, postponing, and dropping (lines 306 to 345), project setup (398 to 415), the `ura` CLI
    table (417 to 450), and the human's commit formats (380 to 394) are needed rarely, about 120
    lines in all.
  - [`crates/cli/tests/skill.rs`](/crates/cli/tests/skill.rs) line 24 requires every `ura`
    subcommand to be named in the skill.
- **The references** total 1,733 lines: approval 47, bug 110, discovery 404, finish 157,
  implementation 231, plan 414, spec 370. The proposal's "about 2,100" counts `SKILL.md` too.
- [`references/spec.md`](/skills/uraeda/references/spec.md) and the
  [spec template](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md): the spec
  holds behaviour (user stories, edge cases, success criteria), then design (approach, data,
  components, mockups, error handling, testing), then what the human weighs (assumptions, decisions,
  constitution check, risk tier).
- **The example spec**
  ([`spec.md`](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md), 248 lines):
  - About 150 lines serve the human: block, stories, approach, mockups, assumptions, decisions,
    constitution check, tier.
  - About 52 serve the agent: data, components, testing.
  - About 21 are mixed: edge cases, success criteria, error handling.
  - Real specs ran 431 to 719 lines, so their agent share is larger.
- **What the references already say about quality.**
  - **Complexity tracking.** New abstractions only: [`plan.md`](/skills/uraeda/references/plan.md)
    lines 199 to 203, and constitution principle VI. Nothing covers the growth of existing units.
  - **Ownership.** `plan.md` lines 69 to 80: "A shared guarantee needs one enforcement point".
    Nothing asks discovery to find who owns a rule today.
  - **Lines that argue against size limits:**
    - `plan.md` line 79: "File length alone does not answer that question".
    - [`implementation.md`](/skills/uraeda/references/implementation.md) line 171: "rather than file
      length or a preferred style".
    - `implementation.md` line 184: "A preference for different names, formatting, or file sizes
      alone is minor".
  - **Structural changes.** `implementation.md` lines 80 to 81 and 176 to 178 ask structural fixes
    to keep behavioural tests passing. No rule separates them into their own commits. Line 229 says
    one commit per task.
  - **Tests that can fail.** `implementation.md` line 53: "must fail for the intended reason". Lines
    162 to 167, in the final review: "fault injection or temporary removal of the protection", for
    risky guarantees only. There is no rule on fixed sleeps, and no ruling is needed to change an
    existing test.
  - **Reviews.** The task reviewer (`implementation.md` lines 75 to 82) gives one combined verdict.
    The final review (lines 145 to 189) has four axes but no report of size or complexity changes,
    and no place for a second reviewer.
  - **Decisions.** `spec.md` line 113: rules "a spec, a plan, or code can be checked against".
    Nothing asks how each rule is enforced.
- [`references/bug.md`](/skills/uraeda/references/bug.md): the shape the proposal wants for
  maintenance.
  - A `fix/` branch, a human-written `report.md`, and an agent-written `assessment.md` with
    questions in the clarifications format.
  - Its own step table, fix steps as checkboxes, `rulings.md`, and a `kind: bug` record.
  - `ura start` refuses bugs ([`start.rs`](/crates/cli/src/start.rs)).
- [Constitution](../CONSTITUTION.md) 1.2.1: principle VI, "Code is checked against the spec", holds
  the only quality rules: "Code SHOULD stay explicit and simple. New abstractions MUST be justified
  in the plan's complexity tracking." The
  [template constitution](/skills/uraeda/assets/templates/specs/CONSTITUTION.md) is a skeleton of
  placeholders.
- **The decisions in [`specs/decisions/`](../decisions/):**
  - None states a code-quality rule.
  - Only [toolchain](../decisions/toolchain.md), [UI checks](../decisions/ui-checks.md),
    [UI components](../decisions/ui-components.md), and in part [CLI](../decisions/cli.md) and
    [agents](../decisions/agents.md) say how their rules are enforced.
  - [Stack](../decisions/stack.md) lines 17 to 18: "Workflow logic, parsing, validation, and
    workflow states MUST live in the Rust core". Only
    [`stack.test.ts`](/packages/server/src/__tests__/stack.test.ts) checks part of it: no markdown
    parser in TypeScript.
- **Quality tooling today.**
  - Rust: [`Cargo.toml`](/Cargo.toml) lines 41 to 42, `clippy::all = warn` only, run with
    `-D warnings` in `vp run ready` ([`package.json`](/package.json) line 7). There is no
    `clippy.toml`.
  - TypeScript: [`vite.config.ts`](/vite.config.ts) lines 106 to 156, Oxlint's default categories
    plus the Astryx and StyleX rules, with no size or complexity rule.
  - Lua: StyLua formats, and no linter runs.
  - CI ([`ci.yml`](/.github/workflows/ci.yml)) runs `vp run ready`.
- **The largest units today.**
  - Files: `workspace.rs` is 1,080 lines, `api.rs` 1,004.
  - Functions over 100 lines: 3 in Rust, outside tests (`clean` 125, `read_feature` 106,
    `check_sections` 102), and 16 in TypeScript (`EditorPage` 285, `ReviewPage` 222, `RoundPage`
    213, …).
  - Six functions take 6 parameters, and none takes more.
- **Fixed sleeps and wall-clock assertions still present:**
  - [`performance.rs`](/crates/cli/tests/performance.rs) lines 36 to 41;
  - [`diagnostics.rs`](/crates/lsp/tests/diagnostics.rs) lines 147 to 158;
  - [`live.test.ts`](/packages/server/src/__tests__/live.test.ts) line 373;
  - [`helpers.tsx`](/packages/web/src/__tests__/helpers.tsx) line 184;
  - [`test_client.lua`](/editors/nvim/tests/test_client.lua) line 133.
- **Earlier features, at the commit before each finished** ([records](../done/)):
  - All 9 features add up to 26,504 lines of discovery, questions, spec, plan, and rulings: about
    2,945 per feature.
  - Specs ran 431 to 719 lines and plans 568 to 1,661. Every feature had a single round of
    questions.
  - **Plan review.** Only the two earliest plans were reviewed by the human, before the
    `plan-review` field existed. Since then, `plan-review` was `false` in all seven features,
    including five at risk tier `high`, where the default is `true`: the human overrode it every
    time.
  - No feature wrote a `data-model.md`.

### The proposal's path and existing actions

**Writing the spec and the design**

- **Today.** The spec step writes `spec.md`. Every tool that reads a feature knows its sections
  through the core.
- **Where the core reads `spec.md`:**
  - [`FileKind`](/crates/core/src/workspace.rs) lines 40 to 89 matches files by name. `read_feature`
    (lines 788 to 790) skips any file it does not know, so a `design.md` would be invisible to every
    tool until it gets a kind.
  - `ura check` takes each file's sections from its embedded template
    ([`check/sections.rs`](/crates/core/src/check/sections.rs) lines 11 to 98). Splitting the
    template splits the checks once `design.md` has an entry.
  - `decisions_pending` reads the spec's `## Decisions` to drive the approval step (`workspace.rs`
    lines 1020 to 1057), so decisions must stay in the human spec.
  - Spec items, the stories and success criteria, come from
    [`files/spec.rs`](/crates/core/src/files/spec.rs). They feed the review page and the outline.
- **Mockups.** [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx) line 60 reads `spec.md` to find
  the block linking a mockup. Mockups must stay linked from the spec, or the page changes.
- **Hard-coded lists.** [`FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx) lines 58 to 61 lists
  the missing files as `spec.md` and `plan.md`.
- **Tests tied to the example spec:**
  - [`crates/core/tests/check.rs`](/crates/core/tests/check.rs) lines 87 to 255 mutate it.
  - So do the items tests, the LSP outline tests, and the Neovim `test_fields.lua`.
  - Fixtures under `fixtures/repo/branches/*/specs/*/spec.md` carry full spec frontmatter.
- **References that name spec sections**, all of which change with a split:
  - `plan.md` lines 34, 86, 134 to 137, 200, 205 to 207, 304 to 306, 358, and 366;
  - `implementation.md` lines 23 to 26, 76, 149, 203, and 217;
  - `finish.md` lines 58 to 61;
  - `bug.md` lines 53 to 57;
  - the plan template, lines 18 to 20;
  - the specs README template, line 31.
- **Anchors to keep.** `references/spec.md#what-is-a-decision` (linked 7 times) and `#tests` must
  survive any reorganization.

**Approving the spec**

- **Today.** The human reads the whole spec, then approves it with a risk tier and `plan-review`.
- **The tier** lives in the core: `REVIEWED_TIER = "high"`, at `files/spec.rs` line 9.
- **With a split**, the approval covers only the human file. A `design.md` written in the same
  commit is visible but not asked about.

**Planning and building**

- **Today.** The plan reads the spec's Design, Testing, and Assumptions. Each task is one commit.
  The task reviewer and the final reviewer get the spec.
- **With a split**, they read `design.md` too. Structural commits come before the task's behaviour
  commit when a unit is over its limit.

**Auditing (the maintenance flow)**

- **No folder for audits.** `ura check` rejects any top-level folder other than `drafts`, `backlog`,
  `decisions`, `bugs`, and `done` ([`check/names.rs`](/crates/core/src/check/names.rs) line 27).
- **`report.md` already means a bug report**: `workspace.rs` line 63, and
  [`api.rs`](/crates/core/src/api.rs) lines 648 to 652 and 785 to 786. A dated folder under a new
  `specs/maintenance/` would be checked as a workflow folder, and its `report.md` read as a bug
  report.
- **Record kinds are `feature` or `bug` only**
  ([`check/values.rs`](/crates/core/src/check/values.rs) line 35).
- **Suggesting an audit from `ura status`** is new logic: it would count the records in
  `specs/done/` since the last audit.

**Features in flight**

- **`2026-10-13-multi-repo-server`**: its spec waits for the human. It adds a `ura add` row to the
  skill's CLI table. Its clarifications leave "broader cleanup" to this feature.
- **`2026-10-13-image-attachments`**: answered, with its spec next. It adds text to the skill about
  opening linked images, an `images/` folder in feature folders, and changes to `finish.md`.
  - It is 45 commits behind main.
  - Both features edit `SKILL.md` and the references this feature restructures.
- **Related entries in [priorities](../PRIORITIES.md):**
  - Now: "Add a bugfixing/low impact change flow" and "Add a 'scratchpad' concept", both close to
    the maintenance flow.
  - Next: "Adversarial review flow with a secondary model".
  - Later: "Non-technical users".

### Likely changes

- **Under every option:**
  - [`references/plan.md`](/skills/uraeda/references/plan.md) and
    [`references/implementation.md`](/skills/uraeda/references/implementation.md): the concepts,
    rewriting the three lines that argue against size limits; two verdicts for the task reviewer; a
    size and complexity report in the final review; a place for a second reviewer.
  - [`references/discovery.md`](/skills/uraeda/references/discovery.md): list who owns each rule the
    feature touches.
  - [Decision template](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md) and
    `references/spec.md`: each rule says how it is enforced.
  - [Constitution](../CONSTITUTION.md) and the
    [template constitution](/skills/uraeda/assets/templates/specs/CONSTITUTION.md): the two rules,
    with the mechanics of [amending the constitution](#amending-the-constitution).
  - The [example](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/): its spec and
    plan follow the new templates.
  - [`README.md`](/README.md), where it describes the spec.
- **With a separate `design.md`** (see [splitting the spec](#splitting-the-spec)):
  - a new template;
  - `FileKind::Design` and its section checks in `crates/core`;
  - `references/spec.md` split into what the human approves and the design;
  - the plan template and every reference line listed above;
  - the example gets a `design.md`;
  - the web shows it as a document;
  - tests and fixtures.
- **With a change to plan review** (see [plan review](#plan-review)): `files/spec.rs` and the
  references that name the default.
- **With checks in this repository** (see [checks in this repository](#checks-in-this-repository)):
  - `Cargo.toml` lints and a `clippy.toml`;
  - `#[expect]` markers on current offenders;
  - the lint block of `vite.config.ts` and `oxlint-suppressions.json`;
  - possibly `flake.nix` (selene, jscpd) and `package.json` `ready`;
  - a new decision, `code-quality.md`.
- **With the maintenance flow in this feature** (see [scope](#scope)):
  - `references/maintenance.md` and its templates;
  - a `Kind::Maintenance`, the `maintenance` folder in `check/names.rs` and `ura init`;
  - steps in `steps.rs`, record kinds, web routes and labels;
  - possibly `ura status`.
- **With skill trimming** (see [trimming the skill](#trimming-the-skill)):
  - `SKILL.md` and new reference files;
  - possibly `crates/cli/tests/skill.rs`.

## The proposal

### Three subsystems in one feature

The spec split, the concepts, and the maintenance flow can each ship on their own:

- **The spec split** changes the core, the web, the LSP tests, and the example.
- **The concepts** are mostly reference text plus checks.
- **The maintenance flow** is a new kind of work item, with its own folder, steps, records, and
  tools.

Only the concepts and the split touch the same reference lines (`spec.md`, `plan.md`).

The maintenance flow audits against the concepts' checks, so it comes after them. It is also close
to two entries in **Now**: the low-impact change flow and the scratchpad.

### Examples in "Why" that no longer hold

Most of the named examples were fixed on 2026-10-13, by `9b2d881`, `fa13e61`, `9f4b936`, `287c8bc`,
`a410a70`, `188fc35`, and `28cd8e1`:

- `discovery.ts` is deleted.
- The plan-review default lives only in the core.
- The language server calls the core's `awaits_human`.
- `Workspace::read` is 75 lines.
- `start` is split, with 47 lines at most.
- `sessions.ts` is 474 lines.
- `ReviewPage` is 222 lines.

Some duplication remains:

- `FilePage.tsx` line 39 repeats the gate kinds of `gates.rs`.
- `FeaturePage.tsx` lines 58 to 61 hard-code the missing files.
- Path regexes in `fate/sessions.ts` line 362 and `routes.tsx` lines 324 to 327 re-derive the folder
  layout.

The diagnosis stands, but the spec should cite today's numbers.

### "The review looks for duplication across the codebase"

No detector finds a rule duplicated across Rust, TypeScript, and Lua (see
[duplication detectors](#duplication-detectors)). Across languages, "one home per rule" can be
checked:

- by architecture tests, like `stack.test.ts`;
- by generated bindings;
- by the review, with discovery's list of owners.

### "Warnings, complexity, and duplication never go up"

The proposal does not say what is measured or where the baseline lives. Clippy has no baseline,
Oxlint's is a per-file count, and jscpd's is a fingerprint file. See [the ratchet](#the-ratchet).

### "Each test names the break it catches" and mutation checks

A tool cannot check every test the same way:

- No mutation tool covers Lua or the web's browser tests.
- cargo-mutants on the whole workspace takes hours.

See [tests that can fail](#tests-that-can-fail).

### "The review checks it does" agree, for a design nobody reads

Agreement between the spec and `design.md` needs an owner:

- Spec Kit uses a read-only checker.
- OpenSpec uses `verify` after the code.

### Amending the constitution

The proposal asks the agent to "make a proposal for an uraeda constitution update" and to add the
text to the template.

- [`AGENTS.md`](/AGENTS.md) says "Only a human amends it: report a problem instead of editing it".
- The constitution's governance says "Only humans amend this constitution".

An agent can propose wording, but applying it needs the human's explicit consent to that mechanism.

The template is a skeleton of placeholders today. Concrete principles in it would be the first
opinionated content every new project gets.

### Plan review and the human's habit

- **The data.** The human set `plan-review: false` on every spec since the field exists, including
  five `high` features.
- **The proposal** says plans are rarely reviewed.
- **The default** still says `true` for `high`.

### Gloaguen et al. is a workshop paper

The proposal calls it "ICLR 2026". It was presented at ICLR 2026 workshops, and its finding is
"costlier, with no success gain", not "harder". See
[research on agents and code quality](#research-on-agents-and-code-quality).

### "Keep the skill short"

`SKILL.md` is under the 500-line limit but about 70% over the 5,000-token recommendation. The
proposal asks for trimming alongside the new concepts, without a target.

## Approaches

Criteria:

- From the proposal: the least work for the human, quality held without reading code, a short skill.
- From the constitution: [I](../CONSTITUTION.md#i-humans-stay-in-control) humans in control,
  [II](../CONSTITUTION.md#ii-git-and-plain-text-first) plain text,
  [IV](../CONSTITUTION.md#iv-review-effort-matches-impact) review effort matches impact,
  [V](../CONSTITUTION.md#v-tools-are-optional) tools are optional, and
  [VI](../CONSTITUTION.md#vi-code-is-checked-and-stays-maintainable) code checked against the spec.
- From the decisions: [stack](../decisions/stack.md), logic once in the core; and
  [toolchain](../decisions/toolchain.md), tools pinned in the Nix flake.

### Scope

How much of the proposal this feature builds. See
[three subsystems in one feature](#three-subsystems-in-one-feature).

| Option                                                                            | Human work                         | Plan size                    | Order                                                            |
| --------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| A. Split and concepts here, with the constitution; maintenance as its own feature | Two features to answer and approve | Large                        | Concepts and checks exist before the audit that uses them        |
| B. All three here                                                                 | One feature, one long spec         | Very large: core, web, skill | One branch touching everything                                   |
| C. Three features: split, concepts, maintenance                                   | Three features                     | Small each                   | Split and concepts edit the same reference lines on two branches |

### Splitting the spec

Where the agent-facing design goes. See [GitHub Spec Kit](#github-spec-kit), [OpenSpec](#openspec),
[Kiro](#aws-kiro), and [the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                                  | What the human reads             | Tool changes                                       | Prior art                               |
| ----------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------- | --------------------------------------- |
| A. `design.md`, written with the spec in the same step, not reviewed    | A short `spec.md` only           | A new file kind, its template and checks, web page | Kiro, OpenSpec (`design.md`)            |
| B. The design moves into `plan.md`, written after approval              | A short `spec.md` only           | Fewer: no new file kind                            | Spec Kit (`plan.md` holds the design)   |
| C. One `spec.md`: human part first, a "For the builder" part at the end | The first part, the rest visible | Template sections only                             | Rust RFC (guide-level, reference-level) |

With B, design choices are made after approval, out of the human's sight. With C, the file stays
long on GitHub and in the web UI.

### What the human spec holds

Only with A or B of [splitting the spec](#splitting-the-spec). Where the acceptance scenarios, edge
cases, and error messages go. See [the example spec](#important-reads) and
[design documents for busy readers](#design-documents-for-busy-readers).

| Option                                                                                                                                                                    | Length (example: 248 lines) | What the human approves                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------- |
| A. Stories with their scenarios, user-visible edge cases and errors in plain words; the data, components, exact strings, technical edge cases, and test map in the design | About 170 lines             | Every behaviour, with its exact values         |
| B. Stories as plain-language journeys only; all Given/When/Then scenarios in the design                                                                                   | About 100 lines             | The journeys; the exact values are the agent's |
| C. The minimal cut: only Data, Components, and Testing move                                                                                                               | About 195 lines             | The same as today, minus three sections        |

### Size budget for the spec

How long the human spec may be. See
[design documents for busy readers](#design-documents-for-busy-readers).

| Option                                                                               | Enforcement       | Cost                                        |
| ------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------- |
| A. A reading time target in the reference (about 15 minutes), checked in self-review | Agent self-review | None in tools                               |
| B. A line limit checked by `ura check`                                               | Tool              | Hard limit on large features, new rule kind |
| C. No budget, only the structure                                                     | None              | Specs may grow back                         |

### Plan review

What happens to `plan-review` once the design is not reviewed either. See
[plan review and the human's habit](#plan-review-and-the-humans-habit).

| Option                                                | Human work                       | Core change                             |
| ----------------------------------------------------- | -------------------------------- | --------------------------------------- |
| A. Keep `plan-review`, default `false` for every tier | Opt in on approval               | `files/spec.rs` default, references     |
| B. Keep today's default (`true` for `high`)           | Turn it off at every `high` spec | None                                    |
| C. Remove plan review                                 | None, and no way to opt in       | Remove the field, steps, review targets |

### The ratchet

How the skill makes warnings, size, complexity, and duplication never go up, in any project. See
[clippy](#clippy), [Oxlint](#oxlint-through-vite), and
[quality gates](#quality-gates-sonarqube-codescene-google).

| Option                                                                                                                                          | Constitution V (tools optional) | Languages                  | Noise                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------- | ------------------------------ |
| A. The project's own linters, with limits and their baseline (suppressions file, `#[expect]`); the final review reports what the branch changed | Holds: plain config files       | Whatever the linters cover | Prune commits when counts fall |
| B. A `ura` command that measures units and stores a baseline in the repository                                                                  | `ura` becomes the enforcer      | Must parse each language   | One more tool to maintain      |
| C. Review only: the final review reports the changes, nothing fails                                                                             | Holds                           | All                        | Decay is reported, not stopped |

### Checks in this repository

Which checks Uraeda adopts now. See [quality tooling today](#important-reads),
[duplication detectors](#duplication-detectors), and [Lua linters](#lua-linters).

| Option                                                                                                  | New dependencies      | Catches                                           |
| ------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------- |
| A. Limits in the linters already installed: clippy and Oxlint, with today's offenders in their baseline | None                  | Size, nesting, parameters in Rust and TypeScript  |
| B. A, plus jscpd for duplication and selene for Lua complexity                                          | Two, in the Nix flake | Also copy-paste within a language, Lua complexity |
| C. None in this feature: the maintenance flow adds them                                                 | None                  | Nothing until then                                |

The thresholds:

- the tools' defaults: Rust functions 100 lines, Oxlint functions 50 and files 300, 7 parameters;
- or looser ones for React components: 32 TypeScript functions are over 50 lines.

### Tests that can fail

How a test is shown to catch a break. See [mutation testing](#mutation-testing) and
[superpowers](#superpowers).

| Option                                                                                     | Languages   | Time                          |
| ------------------------------------------------------------------------------------------ | ----------- | ----------------------------- |
| A. A manual mutation check per task: break the code realistically, see a test fail, revert | All         | Minutes per task              |
| B. A, plus cargo-mutants `--in-diff` in the final review                                   | Rust only   | Minutes to an hour per branch |
| C. B, plus Stryker on the non-browser TypeScript tests                                     | Rust and TS | More, and a second new tool   |

### Constitution wording and place

Where the two rules go. See [amending the constitution](#amending-the-constitution).

| Option                                                               | Version | Priority               |
| -------------------------------------------------------------------- | ------- | ---------------------- |
| A. Expand principle VI into "Code is checked and stays maintainable" | 1.3.0   | Last, as VI is today   |
| B. A new principle VII                                               | 1.3.0   | Last, below VI         |
| C. A new principle above "Tools are optional"                        | 1.3.0   | Above tools and checks |

### Who applies the amendment

Only with a change to the constitution. See [amending the constitution](#amending-the-constitution).

| Option                                                                                             | Constitution I and governance                  | Human work         |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------ |
| A. The spec carries the exact text; approving the spec applies it, in a commit naming the approval | Needs the human to accept approval as amending | Approve once       |
| B. The spec proposes the text; the human edits the constitution themselves                         | Holds as written                               | Approve, then edit |

### Trimming the skill

How much of `SKILL.md` moves out. See
[Agent Skills](#agent-skills-specification-and-skill-authoring-guidance).

| Option                                                                                                                          | `SKILL.md` after               | Risk                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| A. Move the rare parts out (setup, starting and postponing, the human's commit formats, the CLI table) into new reference files | About 330 lines, ~6,000 tokens | Conflicts with multi-repo-server's `ura add` row |
| B. Make room for the new concepts only, net zero                                                                                | About 450 lines                | Stays over the token recommendation              |
| C. A rewrite to the 5,000-token target                                                                                          | About 250 lines                | A large rewrite of text every step relies on     |

### Triggering an audit

Only with the maintenance flow in this feature. See
[recurring reports answered by a human](#recurring-reports-answered-by-a-human).

| Option                                                         | Tool change    | Prior art                          |
| -------------------------------------------------------------- | -------------- | ---------------------------------- |
| A. When the human asks only                                    | None           | Bug flow                           |
| B. `ura status` suggests one after a number of merged features | Count records  | None found; schedules are the norm |
| C. A schedule, outside Uraeda (a routine, cron)                | None in Uraeda | OpenAI, Anthropic, Devin           |

### Needs no choice

- **The name `design.md`**: the most common name for the how-file (Kiro, OpenSpec, Google's design
  docs).
- **Mockups stay linked from the spec**: the human approves what users see, and `MockupPage.tsx`
  keeps working.
- **Decisions stay in the spec**: the approval step reads them there.
- **Agreement between spec and design**: the plan's self-review and the final review check that
  every story, scenario, and success criterion of the spec appears in the design's test map, like
  Spec Kit's `/analyze` coverage.
- **`data-model.md` and `contracts/`** stay optional companions of the design. No feature used them.
- **One home per rule**: discovery lists who owns each rule the feature touches, and the design says
  where each new rule lives. A copy in another layer is a complexity-tracking row. The references
  stop saying file length does not matter.
- **Extract, don't grow**: complexity tracking covers growth. A task that touches a unit over its
  limit starts with a structural commit, as Beck's rule says.
- **Rules enforced by tools**: each rule of a decision says how it is enforced, like MADR's
  Confirmation. A spec proposing a decision adds the task for its check.
- **Lint messages that say the fix**: where the linter allows custom messages (clippy `disallowed_*`
  reasons, `no-restricted-imports`, JS plugins), as the Astryx rules already do.
- **Tests**:
  - No fixed sleeps or wall-clock assertions in unit tests. Benchmarks for success criteria are not
    unit tests.
  - Changing or deleting an existing test needs a ruling.
  - Each test's break is named in the plan's step.
- **UI end to end**: UI stories run in the project's browser runner through the real app. Adding a
  runner to a project without one is a decision of that project.
- **The task reviewer** gives two verdicts, spec compliance and then quality, as superpowers does,
  and flags what the change grew, not pre-existing sizes.
- **A place for a second reviewer** in the final review, which an optional skill fills.
- **Audit file naming**: `report.md` already names a bug report, so the audit file needs another
  name.
- **Records of audits**: a new record kind, if the flow is built.

## Not checked

- The OX Security "Army of Juniors" primary report: the 80 to 90% figures were seen only in
  secondary coverage.
- Kent Beck's _Tidy First?_ chapters (O'Reilly returned 403) and his Medium post "BS changes" (403).
  The commit rule is quoted from his own `CLAUDE.md` instead.
- Whether `vp lint` passes Oxlint's `--suppress-all` and `--prune-suppressions` through.
- The real runtime of cargo-mutants or Stryker on this repository: neither tool is installed.
- An independent evaluation of jscpd's semantic mode.
- The body of Google's 2017 "Code Health" article, which did not render.
- Boris Cherny's post on Anthropic's maintenance routines: seen only through The Decoder.
- Amazon's PR/FAQ length limits: seen only in a book note.
