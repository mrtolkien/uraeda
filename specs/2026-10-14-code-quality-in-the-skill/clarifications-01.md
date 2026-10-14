---
status: answered
---

# Clarifications, round 01: Code quality and maintainability through the skill

> [!NOTE]
>
> Answered on 2026-10-14.
>
> - **Scope.** The proposal holds three independent pieces. The recommendation leaves the
>   maintenance flow for its own feature, and the rest of the questions assume it.
> - **Choices that outlast this feature:**
>   - how the spec splits and what you still read;
>   - how "quality never goes up" is enforced in any project;
>   - which checks this repository adopts, and their limits.
> - **The constitution** cannot be amended by an agent as the proposal asks. One question settles
>   who applies the text, another where it goes.
> - **Plan review.** You turned it off on every spec since the field exists, including five `high`
>   ones. One question changes the default.
> - **The proposal's examples.** Most of the "Why" examples were fixed on 2026-10-13. The diagnosis
>   still holds, and the spec will cite today's numbers.
> - **Settled without you:** 15 points, at the end.

## Context

The [proposal](proposal.md) asks for three changes to the workflow, so that apps stay maintainable
without you reading code:

- a spec split into what you approve and what the agent builds from;
- a few code-quality concepts in the references, each backed by a check a tool runs;
- a maintenance flow, where an agent audits the codebase and you answer its findings.

It also asks for two rules in the constitution: "each rule lives in one place" and "quality never
regresses".

Where things stand today:

- **The spec.** [`spec.md`](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md)
  holds behaviour, design, and what you weigh, in one file of 431 to 719 lines in past features.
- **Checks.** The repository's only quality check is `clippy::all` ([`Cargo.toml`](/Cargo.toml)). It
  has no size, complexity, or duplication rule in Rust, TypeScript, or Lua.
- **The references** say file length alone does not matter
  ([`plan.md`](/skills/uraeda/references/plan.md) line 79,
  [`implementation.md`](/skills/uraeda/references/implementation.md) lines 171 and 184).
- **The skill.** [`SKILL.md`](/skills/uraeda/SKILL.md) is 450 lines, about 8,500 tokens, against a
  recommended 5,000.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What does this feature build?

The spec split, the concepts, and the maintenance flow can each ship alone:

- **The split** changes the core, the web, and the example.
- **The concepts** are mostly reference text plus lint configuration.
- **The maintenance flow** is a new kind of work item, with its own folder, steps, records, and tool
  changes. It audits against the checks the concepts add, and sits close to two entries in **Now**:
  the low-impact change flow and the scratchpad.

More in [discovery](discovery-01.md#scope).

Why it matters: it sets the size of this feature's plan, and the order in which the pieces land.

- **A (recommended). Build the spec split, the concepts with their checks, and the constitution
  changes here. The maintenance flow becomes its own feature, started once this one is merged.**
  - [pro] the audit lands after the checks it relies on, and can be designed with the low-impact
    flow and the scratchpad in view.
  - [pro] the split and the concepts edit the same reference lines, so one branch rewrites them
    once.
  - [con] two features to answer and approve instead of one.
  - Why recommended: it is the largest piece that edits each file once, and the maintenance flow
    gets its own discovery.
- **B. Build all three here, as the proposal describes.**
  - [pro] one feature, one approval.
  - [con] a very large plan touching the skill, the core, the CLI, the web, and the LSP. The audit
    would be designed before its checks exist.
- **C. Three features: the spec split, the concepts, and the maintenance flow, in that order.**
  - [pro] the smallest specs to read.
  - [con] the first two rewrite the same lines of `references/spec.md` and `references/plan.md` on
    two branches.

**Answer:** A

### Q1.B: What triggers an audit?

Only if you picked B in Q1.

- OpenAI and Anthropic run their cleanup agents daily on a schedule; Devin's examples run weekly.
- No source triggers an audit after a number of merges.
- Renovate warns that reports waiting for approval are forgotten: "out of sight means out of mind".

More in [discovery](discovery-01.md#triggering-an-audit).

- **A (recommended). An audit starts when you ask for one, like a bug.**
  - [pro] no tool change, and nothing runs without you.
  - [con] audits happen only when you remember them.
  - Why recommended: it ships the flow first, and a trigger can be added once the flow has run a few
    times.
- **B. `ura status` also suggests an audit once three features are merged since the last one.**
  - [pro] a reminder in the tool you already use.
  - [con] new logic in the core, counting records.
- **C. Run audits on a schedule outside Uraeda, such as a Claude Code routine or a cron job.**
  - [pro] the way OpenAI and Anthropic do it.
  - [con] it depends on a harness's scheduler, outside the workflow.

**Answer:**

## Q2: Where does the agent's design go?

Every past spec held both the behaviour you approve and the data, components, and test map the agent
builds from.

- **Kiro and OpenSpec** put the how in a `design.md`. OpenSpec's review guide gives it no review
  question: "you don't need to read every line".
- **Spec Kit** puts it in `plan.md`. In one measured case, Spec Kit's plan files took 2 hours to
  review against 15 minutes for the spec.

More in [discovery](discovery-01.md#splitting-the-spec).

Why it matters: it decides what you read before approving, and when the agent's design choices are
made.

- **A (recommended). The spec step writes a short `spec.md` for you and a `design.md` for the agent,
  in the same commit. You approve the spec only; the design is checked against it by the plan's
  self-review and the final review.**
  - [pro] the design exists before you approve, so the spec's risks and architecture summary are
    grounded in it, and you can open it when you want.
  - [con] a new file kind in the core, its template and checks, and a page in the web UI.
  - Why recommended: it is what the proposal asks, it follows Kiro and OpenSpec, and the design is
    settled before approval rather than after.
- **B. `spec.md` becomes the human part only, and the plan step writes the design at the top of
  `plan.md`, after approval.**
  - [pro] no new file kind: fewer tool changes.
  - [con] design choices are made after you approved, out of your sight, and plans grow even longer.
- **C. Keep one `spec.md`: your part first, then a "For the builder" part at the end, which you may
  skip.**
  - [pro] almost no tool change.
  - [con] the file stays as long as today on GitHub and in the web UI, which is what the proposal
    complains about.

**Answer:** C: There's no reason is stays as long as today in the Web UI, we're allowed to parse it
and show whatever we want :)

I think it's good to have a single file with all the info and a well defined structure. The "agent
part" can be hidden behind a toggle for example, and called "Details" or something.

I like the idea of keeping it all in one file as the subsequent steps need to read all the
information anyways anyways.

## Q3: What stays in the spec you read?

With A or B in Q2.

- **The example spec** has 248 lines: about 150 serve you, 52 serve the agent (data, components,
  test map), and 21 are mixed (edge cases, success criteria, error handling).
- **Real specs** ran 431 to 719 lines.
- **What dominates** is the user stories and their Given/When/Then scenarios with exact values,
  which the tests copy.

More in [discovery](discovery-01.md#what-the-human-spec-holds).

Why it matters: what you do not read, the agent decides alone, within the approved behaviour.

- **A (recommended). The spec keeps the user stories with their acceptance scenarios, the edge cases
  and errors users can see (in plain words), the success criteria, a short architecture summary, the
  decisions, tradeoffs and risks, the assumptions, the constitution check, and the risk tier. The
  data, components, exact strings, technical edge cases, and the test map go to the design.**
  - [pro] you still approve every behaviour with its exact values; the example would drop to about
    170 lines.
  - [con] the scenarios remain the longest part of the spec.
  - Why recommended: the scenarios are what you would object to; the rest is how the agent builds
    them.
- **B. The spec describes each user story as a plain-language journey only; all Given/When/Then
  scenarios and their exact values move to the design.**
  - [pro] the shortest spec, about 100 lines in the example.
  - [con] the agent picks the exact behaviour, such as which date a task moves to, without your
    review.
- **C. Only the Data, Components, and Testing sections move to the design; everything else stays.**
  - [pro] the smallest change to the workflow.
  - [con] about 20% shorter, which may not change how the spec feels to read.

**Answer:** A: The user stories for the user should be made shorter, with extra "comments" or
"details". It can be in the user stories paragraph but just showed in a compact form in the UI, with
a toggle "See user stories details" or something.

It IS relevant to C in the previous selection: this rework of the flow is about what the human SEES,
not what EXISTS in the system.

## Q4: How long may the spec be?

OpenSpec asks for a proposal of "1-2 pages" and enforces 500 characters per requirement. Google's
mini design doc is 1 to 3 pages, and Nygard keeps decision records to "one or two pages". Readers on
the web read "at most 28% of the words". More in
[discovery](discovery-01.md#size-budget-for-the-spec).

Why it matters: without a budget, specs tend to grow back.

- **A (recommended). The reference sets a target of about 15 minutes of reading, and the spec's
  self-review cuts or moves what goes over it to the design. The block states the time, as today.**
  - [pro] a target every agent can follow, with no tool change.
  - [con] not enforced by a tool: an agent can overrun it.
  - Why recommended: a large feature legitimately needs more, and the block's time already tells you
    when a spec is long.
- **B. `ura check` fails a spec over a fixed number of lines, such as 250.**
  - [pro] enforced.
  - [con] a hard limit that large features must break or work around, and a new kind of rule.
- **C. No budget: the new structure alone keeps it short.**
  - [pro] nothing to follow.
  - [con] nothing stops the spec from growing again.

**Answer:** C: Simpler to not impose gates at the moment, we'll review if it is enough after usage.

## Q5: What happens to plan review?

Since `plan-review` exists, you set it to `false` on all seven specs, including five at risk tier
`high`, where the default is `true`. With A in Q2, the design is not reviewed either. More in
[discovery](discovery-01.md#plan-review).

Why it matters: it decides whether any agent-written file waits for you after the spec.

- **A (recommended). Keep `plan-review`, with a default of `false` for every tier. You turn it on
  when approving a spec you want to see planned; the spec's block says when that is worth it.**
  - [pro] matches what you have done every time, and keeps the option.
  - [con] a `high` feature no longer waits by default.
  - Why recommended: it removes a toggle you switch off every time, without losing the gate.
- **B. Keep today's default: `true` for `high`.**
  - [pro] no change.
  - [con] you keep turning it off.
- **C. Remove plan review altogether.**
  - [pro] the simplest workflow.
  - [con] no way to review a risky plan, and the core, the web, and the LSP lose a feature.

**Answer:** A

## Q6: How does the skill keep quality from going down, in any project?

The proposal wants warnings, complexity, and duplication never to go up.

- **Linter baselines.** Linters now ship them: ESLint since v9.24 and Oxlint, in the version this
  repository uses, keep a file of counts per file and rule that fails when a count rises. In Rust,
  `#[expect(clippy::too_many_lines, reason = "…")]` marks an existing offender, and fails once it is
  fixed.
- **Gates on new code.** SonarQube and CodeScene flag only what a change makes worse.

More in [discovery](discovery-01.md#the-ratchet).

Why it matters: this is the rule every project using Uraeda would follow, and it decides whether
`ura` becomes a quality tool.

- **A (recommended). The skill asks each project to set limits in its own linters, with today's
  offenders in the linter's baseline, so a new violation fails the checks. The final review reports
  how the branch changed the size and complexity of the units it touched.**
  - [pro] plain configuration files, any language the project's linters cover, and `ura` stays
    optional.
  - [con] counts that fall need a prune in the same branch, and limits differ between projects.
  - Why recommended: it uses tools that already exist, and keeps the constitution's "tools are
    optional" intact.
- **B. A `ura` command measures function and file sizes and stores a baseline in the repository,
  compared on every branch.**
  - [pro] the same rule for every project, whatever its linters.
  - [con] `ura` must parse every language, and becomes the enforcer of code quality.
- **C. The final review only reports the changes; nothing fails.**
  - [pro] no configuration.
  - [con] decay is reported, not stopped, which is what the research says does not work.

**Answer:** A

## Q7: Which checks does this repository adopt now?

Today only `clippy::all` runs. The linters already installed cover function length, nesting, and
parameters in Rust and TypeScript.

- **Duplication.** jscpd finds copy-paste within one language. No tool finds a rule written once in
  Rust and again in TypeScript: the cross-language mode is experimental, downloads a 548 MB model,
  and skips Lua.
- **Lua.** selene adds a complexity limit for Lua.
- **Dependencies.** Both jscpd and selene would be new tools in the Nix flake.

More in [discovery](discovery-01.md#checks-in-this-repository).

Why it matters: these limits apply to every later feature here, and a new tool is a decision.

- **A (recommended). Set limits in clippy and Oxlint only, with today's offenders in their
  baselines, recorded in a new code-quality decision whose rules each say how they are enforced.**
  - [pro] no new dependency, and every later feature is held to the limits.
  - [con] no duplication or Lua check; those stay with the review and the maintenance flow.
  - Why recommended: it covers the growth the research measures, with tools already pinned.
- **B. A, plus jscpd for duplication within a language and selene for Lua complexity.**
  - [pro] also catches copy-paste, and covers the Neovim plugin.
  - [con] two new tools, and jscpd still misses the cross-language duplication the proposal names.
- **C. No checks in this feature: the maintenance flow adds them later.**
  - [pro] a smaller feature.
  - [con] the concepts ship without the checks the proposal says must back them.

**Answer:** A: What matters though is that projects using uraeda are pushed to do that setup to.

Uraeda (the skill and workflow) should push the user towards setting up good guidelines to guarantee
code quality.

### Q7.A: What limits?

Only if you picked A or B in Q7.

- **Defaults.** Clippy's default function limit is 100 lines. Oxlint's defaults are 50 lines per
  function and 300 per file.
- **Today's code** has 3 Rust functions and 16 TypeScript functions over 100 lines, and 32
  TypeScript functions over 50, mostly React components.
- **Rust files.** Clippy has no file-length lint, so a Rust file limit would need a small test.

More in [discovery](discovery-01.md#oxlint-through-vite).

- **A (recommended). Functions at most 100 lines in both languages, 7 parameters, 4 levels of
  nesting; TypeScript files at most 500 lines; and a test that holds Rust source files to 500
  lines.**
  - [pro] today's code mostly fits, so the baseline stays short.
  - [con] looser than the tools' defaults.
  - Why recommended: it stops the growth the research measures without baselining a third of the web
    UI.
- **B. The tools' defaults: 100 lines per Rust function, 50 per TypeScript function, 300 lines per
  TypeScript file, no Rust file limit.**
  - [pro] no tuning.
  - [con] 32 functions in the baseline from the start, mostly components that are fine today.
- **C. Tighter: 50 lines per function in both languages, 300 lines per file.**
  - [pro] the smallest units.
  - [con] a long baseline, and many structural commits in the next features.

**Answer:** A: Check what the rules are for the fate stack: https://fate.technology/

If they have rules for typescript code quality, follow them

## Q8: How is a test shown to catch a break?

The proposal asks for tests that can fail: break the code realistically and see a test catch it.

- **Superpowers** does it as a mental "mutation check" per test.
- **Mutation tools** exist for Rust (cargo-mutants, which mutates only the changed lines with
  `--in-diff`) and for TypeScript (Stryker, which cannot run browser tests). None exists for Lua.

More in [discovery](discovery-01.md#tests-that-can-fail).

Why it matters: it sets how much each task and each final review cost.

- **A (recommended). Each task's plan names the break each new test catches; the implementer breaks
  the code that way, sees the test fail, and reverts. No tool.**
  - [pro] works in every language, minutes per task.
  - [con] relies on the agent doing it honestly; the reviewer checks it.
  - Why recommended: it covers every language, and a tool can be added once the maintenance flow
    finds weak tests.
- **B. A, plus cargo-mutants on the branch's changed Rust lines in the final review.**
  - [pro] a tool checks the Rust part.
  - [con] a new tool, minutes to an hour per branch, and Rust only.
- **C. B, plus Stryker on the TypeScript tests outside the browser.**
  - [pro] covers more code.
  - [con] a second tool, and the browser tests stay uncovered.

**Answer:** A

## Q9: Where do the two rules go in the constitution?

The [constitution](../CONSTITUTION.md) lists principles by priority. The only quality rules are in
the last principle, VI, "Code is checked against the spec": "Code SHOULD stay explicit and simple.
New abstractions MUST be justified in the plan's complexity tracking." The proposed rules would
read:

- "Each rule MUST live in one place. A copy in another layer or language MUST be justified in the
  plan's complexity tracking."
- "Warnings, size, complexity, and duplication measured by the project's checks MUST NOT go up. An
  exception MUST be approved by a human in the plan."

The template constitution gets the same rules as a default principle. More in
[discovery](discovery-01.md#constitution-wording-and-place).

Why it matters: the place sets which principle wins when two conflict.

- **A (recommended). Expand principle VI into "Code is checked and stays maintainable", with both
  rules: version 1.3.0.**
  - [pro] one principle for code quality, at the priority it has today.
  - [con] a longer principle.
  - Why recommended: both rules extend what VI already says about simplicity and complexity
    tracking.
- **B. A new principle VII, "Code stays maintainable", below VI.**
  - [pro] the rules stand alone.
  - [con] the lowest priority of all, below checking against the spec.
- **C. A new principle above "Tools are optional".**
  - [pro] quality wins over tooling concerns.
  - [con] a limit could then override "tools are optional", for example by requiring `ura`.

**Answer:** A

## Q10: Who applies the constitution change?

The proposal asks the agent to propose the amendment, but [`AGENTS.md`](/AGENTS.md) says "Only a
human amends it: report a problem instead of editing it", and the constitution's governance says the
same. Decisions are applied by an agent once you approve the spec that proposes them. More in
[discovery](discovery-01.md#who-applies-the-amendment).

Why it matters: it decides whether approving a spec can change the constitution.

- **A (recommended). The spec carries the exact amended text and version. You edit
  `specs/CONSTITUTION.md` yourself once you approve, and the plan's tasks that depend on it wait for
  that commit.**
  - [pro] the constitution's governance holds as written.
  - [con] one more edit for you after approving.
  - Why recommended: it follows the constitution without an exception, for a change made once.
- **B. Approving the spec applies the amendment: the agent commits the exact approved text, naming
  your approval, as it does for decisions.**
  - [pro] no extra step for you.
  - [con] an exception to "only a human amends it", which you would accept here, and which AGENTS.md
    would then need to describe.

**Answer:** A

## Q11: How much of the skill moves out of `SKILL.md`?

Every step loads `SKILL.md` in full: 450 lines, about 8,500 tokens. The Agent Skills specification
recommends under 500 lines and under 5,000 tokens. About 120 lines are rarely needed:

- starting and postponing a feature;
- setting up a project;
- the human's commit formats;
- the `ura` command table.

More in [discovery](discovery-01.md#trimming-the-skill).

Why it matters: this feature adds concepts to the skill, and the research finds that longer context
costs more without helping.

- **A (recommended). Move the rarely needed parts into new reference files, linked from `SKILL.md`,
  bringing it to about 330 lines.**
  - [pro] room for the concepts, and every step loads less.
  - [con] the multi-repo-server feature adds a row to the command table: whichever lands second
    moves it.
  - Why recommended: it trims what most steps never use, without rewriting the text they rely on.
- **B. Only make room for the new concepts: `SKILL.md` stays about 450 lines.**
  - [pro] the smallest change.
  - [con] still over the token recommendation.
- **C. Rewrite `SKILL.md` to the 5,000-token target, about 250 lines.**
  - [pro] the leanest skill.
  - [con] a large rewrite of the text every step relies on, in a feature that is already large.

**Answer:** C: The skill should be only the entry point to uraeda. The actual content is in the
reference files, templates, ...

So let's try keeping it as lean as possible. It would matter for example if the skill is installed
but not relevant and a coding agent decides to read it by mistake. We don't want to pollute its
context.

## Settled without the human

- **The design file is named `design.md`**, the most common name for it (Kiro, OpenSpec, Google's
  design docs). See [discovery](discovery-01.md#needs-no-choice).
- **Mockups stay linked from the spec**, since you approve what users see, and the web's mockup page
  reads them there. See [the code](discovery-01.md#the-proposals-path-and-existing-actions).
- **Decisions stay in the spec**, where the approval step reads them. Same section.
- **The spec and the design must agree.** The plan's self-review and the final review check that
  every story, scenario, and success criterion of the spec appears in the design's test map, like
  Spec Kit's `/analyze`. See [discovery](discovery-01.md#github-spec-kit).
- **`data-model.md` and `contracts/`** stay optional, for designs too large for one file. No feature
  has used them. See [important reads](discovery-01.md#important-reads).
- **One home per rule.** Discovery lists who owns each rule the feature touches, the design says
  where each new rule lives, and a copy in another layer is a complexity-tracking row. The three
  reference lines saying file length does not matter are rewritten. See
  [the proposal](discovery-01.md#the-review-looks-for-duplication-across-the-codebase).
- **Extract, don't grow.** Complexity tracking also covers growing an existing unit. A task touching
  a unit over the project's limit starts with a commit that only restructures it, as Kent Beck's
  rule says. See [discovery](discovery-01.md#kent-beck-tidy-first).
- **Enforcement of decision rules.** Each rule of a decision says how it is enforced: a lint, a
  test, `ura check`, or review only, like MADR's Confirmation section. A spec proposing a decision
  includes the task that adds its check. See
  [discovery](discovery-01.md#design-documents-for-busy-readers).
- **Lint messages say the fix**, wherever the linter allows a custom message, as the Astryx rules do
  today. See [discovery](discovery-01.md#oxlint-through-vite).
- **Test rules.**
  - No fixed sleeps or wall-clock assertions in unit tests: benchmarks for success criteria are not
    unit tests.
  - Changing or deleting an existing test needs a ruling.
  - The five fixed waits found today are left to the maintenance flow.
  - See [important reads](discovery-01.md#important-reads).
- **UI stories run end to end** in the project's browser runner, through the real app, as this
  repository's browser tests already do. Adding a runner to a project without one is that project's
  decision. See [discovery](discovery-01.md#browser-tests).
- **The task reviewer gives two verdicts**, spec compliance then quality, and flags what the change
  grew rather than sizes that were already there, as superpowers does. See
  [discovery](discovery-01.md#superpowers).
- **The final review leaves a place for a second reviewer**, which an optional skill fills; the
  adversarial review itself stays in **Next**. See [the code](discovery-01.md#important-reads).
- **The spec cites today's numbers**, not the proposal's examples fixed on 2026-10-13, and calls
  Gloaguen et al. a workshop paper. See
  [discovery](discovery-01.md#examples-in-why-that-no-longer-hold).
- **Features in flight.** Multi-repo-server and image-attachments both edit `SKILL.md` and the
  references. Whichever lands second rebases onto the other; nothing here waits for them. With B in
  Q1, the audit file is named `audit.md`, since `report.md` already means a bug report. See
  [the code](discovery-01.md#the-proposals-path-and-existing-actions).

**Notes:**
