# Discovery, round 01: Add a bugfixing/low impact change flow

## Summary

Every spec-driven workflow studied ended up with three sizes of work, not two:

- **Just do it**: typos, formatting, configuration, comments.
- **A light path**: one short artifact, or none, and verification.
- **The full flow.**

Superpowers, OpenSpec, BMAD and Kiro all reached this split, most of them after complaints that a
small change produced thousands of lines of markdown. Bugs get their own shape, not a smaller
feature spec. The agent reproduces the bug and finds its root cause before any edit, writes down
what must stay unchanged, and fixes it with a test that fails first. The tools differ most on two
points:

- **The human gate before code.** Superpowers keeps an approval in chat, and Spec Kit's bug workflow
  gates on its assessment. BMAD's small route, Kiro's Quick Spec and OpenSpec's fast-forward drop
  it, and keep the questions only the human can answer plus the review of the diff.
- **Who decides the size.** The trend is that the agent decides after investigating, and the human
  can override.

The [proposal](proposal.md) asks for the light path, for both bugs and small changes:

- no questions or spec by default;
- quality kept;
- the agent offers to upgrade a change that is too big;
- possibly, a third, visual flow for iterating on UI.

Uraeda has an agent-written bug flow, [`bug.md`](/skills/uraeda/references/bug.md), that was never
reviewed and never used. It always stops at a human gate on its assessment. Its tooling is
half-built: `ura start` panics on a bug, and the web UI cannot start one. Meanwhile, about 24 small
changes went straight to `main` in five days, with no record, test evidence, or review, next to 15
features through the full flow. The smallest of those features still wrote a 446-line spec and a
616-line plan.

## How other products do it

### Superpowers

All of this comes from v7.0.0, 2026-10-09.

- **Sizing.** `brainstorming` first asks "What Do You Actually Know?", then sizes the work after
  understanding the intent, and says the size in plain words. The user can override it
  ([brainstorming skill](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)):
  - "a quick, clear task": the request is the description, so do it;
  - "a small change": a description in chat, then the normal workflow, with no document;
  - "a project": a design document, then a plan.
- **Escalation.** "If it grows mid-task, stop, say so, and step up a size." The same skill
  ([brainstorming skill](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md))
  keeps a gate on every size but the quick task: "Nothing gets built until your human partner
  approves the full description: in chat for a small change".
- **Why sizing came in.** A two-week audit of 2,240 sessions found "process cost was not
  proportional to risk or uncertainty" ([PR #2063](https://github.com/obra/superpowers/pull/2063)).
  Before that, one paragraph of a rule change produced a 274-line spec, a 1,706-line plan, and 14
  commits over about 10 hours ([#2079](https://github.com/obra/superpowers/issues/2079)).
- **What the evidence says to keep.** The same PR found that the document ceremony was the waste,
  and the approval gate is "what caught unexamined assumptions". It also found that absolute wording
  ("EVERY project regardless of perceived simplicity") forced full ceremony on a bounded task 5
  times out of 5, when a prompt with no guidance at all sized tasks correctly
  ([PR #2063](https://github.com/obra/superpowers/pull/2063)).
- **Effort settings.** The author tried effort levels before v5 and gave them up: "the model used
  that as permission to skip steps when they really needed to be mandatory"
  ([#1120](https://github.com/obra/superpowers/issues/1120)).
- **Bugs** never go through brainstorming. They go to `systematic-debugging`:
  - "NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST";
  - one hypothesis at a time;
  - a failing test before the fix;
  - "No 'while I'm here' improvements";
  - after three failed fixes, "STOP and question the architecture"

  ([systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md)).
  TDD applies to bug fixes
  ([test-driven-development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md)).
  "Bug fixed" needs "Test original symptom: passes"
  ([verification-before-completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md)).

- **No artifact for a bug or a small change**: a test and the code. A code review is mandatory only
  before a merge to main
  ([requesting-code-review](https://github.com/obra/superpowers/blob/main/skills/requesting-code-review/SKILL.md)).
- **Open complaints:**
  - nothing exists between the full flow and vibe coding for iterating on something already built
    ([#921](https://github.com/obra/superpowers/issues/921));
  - fixes create new bugs because nothing traces what a fix changes
    ([#2266](https://github.com/obra/superpowers/issues/2266)).

### Spec Kit

All of this comes from v1.2.0, 2026-10-13.

- **The core flow has no small path.** Bugs are a bundled extension, `bug`, since 0.9.5, with three
  commands, each writing to `.specify/bugs/<slug>/`
  ([extension README](https://github.com/github/spec-kit/blob/main/extensions/bug/README.md)):
  - `assess`: read-only;
  - `fix`: the only command that edits code;
  - `test`: read-only.
- **`assess`** writes `assessment.md`
  ([assess command](https://github.com/github/spec-kit/blob/main/extensions/bug/commands/speckit.bug.assess.md)):
  - a verdict: valid, likely valid, or invalid, invalid covering misuse, expected behaviour, and out
    of scope;
  - a severity;
  - the reproduction;
  - the suspected code paths;
  - a root cause hypothesis with its confidence;
  - the remediation, the files likely to change, the tests to add, the risks, and open questions.
- **`fix`** stays within the assessed files, and logs any expansion under "Deviations from
  Assessment". It stops and asks for a new assessment when the assessment proves wrong, and never
  edits it
  ([fix command](https://github.com/github/spec-kit/blob/main/extensions/bug/commands/speckit.bug.fix.md)).
- **`test`** marks a fix `partial`, not `verified`, when the original reproduction was not run
  ([test command](https://github.com/github/spec-kit/blob/main/extensions/bug/commands/speckit.bug.test.md)).
- **The `bugfix` workflow** runs assess, then a human gate ("Review the assessment before any code
  change"), then fix, then test
  ([workflow](https://github.com/github/spec-kit/blob/main/workflows/bugfix/workflow.yml)).
- **Asynchronous version.** Spec Kit's own repository runs the same stages from labels a maintainer
  applies, the fix opening a draft pull request
  ([agentic SDLC guide](https://github.com/github/spec-kit/blob/main/docs/guides/agentic-sdlc.md)).
- **What the bug path does not do**: it does not read the constitution or the feature's spec, it
  does not require the test to fail first, and it does not hand a feature request over to
  `/specify`.
- **Small features.** A user complained that adding one button changed 30 files for under 20 lines
  of code ([#1174](https://github.com/github/spec-kit/issues/1174)). The answer was a community
  extension, `tinyspec`: one file of about 80 lines, routed by size, 1 to 5 files and 1 to 8 tasks,
  with schema changes, new services, and cross-cutting work sent to the full flow
  ([tinyspec](https://github.com/Quratulain-bilal/spec-kit-tinyspec)).
- **Spec Kit's own repository**: "Small fixes can use the normal issue, pull request, review, and
  test process" ([CONTRIBUTING](https://github.com/github/spec-kit/blob/main/CONTRIBUTING.md)).

### OpenSpec

All of this comes from v1.14.2.

- **The old rule.** Up to v0.20, the instructions for agents said to skip the proposal for "Bug
  fixes (restore intended behavior)", typos, formatting, comments, non-breaking dependency updates,
  configuration, and tests for existing behaviour. They also gave a decision tree that ends with
  "Unclear? → Create proposal (safer)"
  ([v0.20 agents template](https://github.com/Fission-AI/OpenSpec/blob/v0.20.0/src/core/templates/agents-template.ts)).
  The line between the two paths is restoring intended behaviour against changing the contract.
- **The current docs** file every bug as a change. "Bug fixes work exactly like features. The
  difference is in how you frame the proposal: describe the _correct_ behavior". The fix lands as a
  modified requirement with a new scenario
  ([examples](https://github.com/Fission-AI/OpenSpec/blob/main/docs/examples.md)).
- **The light path** is `/opsx:new`, then `/opsx:ff`, which writes every planning file at once, then
  apply, verify, and archive: "Best for: Small to medium features, bug fixes, straightforward
  changes". The rule: "If you can describe the full scope upfront, use `/opsx:ff`"
  ([workflows](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md)).
- **"Progressive Rigor"**: a full spec only for cross-team work, API or contract changes,
  migrations, security, and "Changes where ambiguity is likely to cause expensive rework". "Most
  changes should stay in Lite mode"
  ([concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md)).
- **Open requests:**
  - a cheap "Draft" state, for a bug found while building another change that does not deserve a
    full change ([#1818](https://github.com/Fission-AI/OpenSpec/issues/1818));
  - a loop back from bugs found after apply
    ([#821](https://github.com/Fission-AI/OpenSpec/issues/821)).

### Kiro

- **Workflows.** Kiro offers Feature Specs, Bugfix Specs, and a Quick Spec, which writes
  requirements, design, and tasks "in one pass… no approval gates"
  ([specs](https://kiro.dev/docs/specs/)).
- **The bugfix spec** replaces the requirements with `bugfix.md`, in three sets
  ([bugfix specs](https://kiro.dev/docs/specs/bugfix-specs/)):
  - current behaviour;
  - expected behaviour;
  - **unchanged behaviour**: "WHEN [condition] THEN the system SHALL CONTINUE TO [existing
    behavior]".

  Then a design with the root cause, then tasks.

- **Its tests come in order** ([bug fix paradox](https://kiro.dev/blog/bug-fix-paradox/)):
  1. tests of the bug condition, failing on the unfixed code;
  2. preservation tests, passing on the unfixed code;
  3. the fix, then both again.

  "A failing bug-condition test means the root-cause hypothesis was wrong. A flipped preservation
  test means the fix has side effects."

- **When to use a bugfix spec**: "The root cause isn't immediately obvious", "Previous fix attempts
  caused regressions", or a critical code path. A quick chat fix suits typos and "well-understood
  one-line changes" ([best practices](https://kiro.dev/docs/specs/best-practices/)).
- **Who picks.** The user picks the workflow. When a spec's input looks like a bug, Kiro asks
  whether it is a bug or a feature
  ([Classmethod hands-on](https://dev.classmethod.jp/articles/kiro-ide-bugfix-specs/)).

### BMAD Method

- **History of its sizing.** It went from keyword levels 0 to 4, then three tracks, then routing
  after investigation. v6.12.0: "Build decides how much ceremony a change needs after investigating
  it, not before. Simple changes now get a two-section spec"
  ([changelog](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md)).
- **What it routes on.** After investigating, the agent writes three facts
  ([step-02-plan, v6.12.4](https://github.com/bmad-code-org/BMAD-METHOD/blob/v6.12.4/src/bmm-skills/ship/bmad-build/step-02-plan.md)):
  - "intent gaps", what the request leaves out that "the user would notice in the result";
  - "irreversibles", migrations, deleting data, external side effects;
  - the "footprint".

  No gap, nothing irreversible, and a small footprint take the one-shot route. Anything else writes
  the full spec and waits for approval.

- **The v7 preview** routes by size instead: "100 lines or fewer: oneshot", and an upgrade to
  consider above five files. The user can pin the route
  ([customize.toml](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-build/customize.toml)).
  Its docs still describe the v6.12 routing: docs and code drifted.
- **Mid-way escalation**: "Stop coding if the request left out something the user would notice", and
  go back to open questions.
- **Its quality steps** on the one-shot route:
  - review agents in a fresh context;
  - each finding graded with its evidence;
  - each finding patched (caused by this change, simple to fix), halted on (not simple), or deferred
    (already there before the change) to a `deferred-work.md` list.

### Other agent tools

- **Claude Code**: "If you could describe the diff in one sentence, skip the plan"; for a bug,
  "write a failing test that reproduces the issue, then fix it". It recommends a reviewer agent told
  to "flag only gaps that affect correctness"
  ([best practices](https://code.claude.com/docs/en/best-practices)).
- **GitHub Copilot's coding agent**
  ([best results](https://docs.github.com/en/copilot/tutorials/coding-agent/get-the-best-results)):
  - suited to bug fixes, UI changes, and test coverage;
  - not suited to ambiguous, broad, production-critical, or security work;
  - a good task has "Complete acceptance criteria" and names the files to change.
- **Devin**: "if a task would take you three hours or less, Devin can most likely do it"
  ([when to use Devin](https://docs.devin.ai/essential-guidelines/when-to-use-devin)).
- **Cursor** suggests Plan Mode by itself "when you type keywords that indicate complex tasks"
  ([planning](https://cursor.com/docs/agent/planning)).
- **Practitioners**:
  - Böckeler found Kiro turned a small bug into "4 'user stories' with a total of 16 acceptance
    criteria", and asks for "a few different core workflows" for different sizes
    ([martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html));
  - Eberhardt measured 2,262 lines of markdown for a 300-line increment
    ([Scott Logic](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html)).

### Visual iteration on UI

These are the tools behind the proposal's third flow.

- **Click an element, then describe the change.** Nearly every agent tool turns a clicked element
  into context for the chat:
  - v0's design mode attaches a screenshot of the element ([v0](https://v0.app/docs/design-mode));
  - Lovable can select several elements, or draw on the preview
    ([Lovable](https://docs.lovable.dev/features/visual-edit));
  - Cursor 3's Design Mode ([changelog 3.0](https://cursor.com/changelog/3-0));
  - Figma Make's numbered "Annotate for agent"
    ([Figma](https://www.figma.com/blog/properties-panel-and-annotations-now-in-figma-make/)).

  Simple property edits are free or staged. Structural ones go through the agent, and each applied
  batch becomes a new version with a diff.

- **Variants live on a canvas, next to the app**: Stitch's "Create variants", Replit's Canvas,
  Onlook's artifacts, Magic Patterns' 1 to 8 concepts side by side, and Claude Design, which
  suggests asking for "2–3 options". The chosen one is then rebuilt into real code, and that rebuild
  is where the mockup and the code drift apart. Onlook's artifacts never reach the repository at
  all. Sources:
  - [Replit canvas](https://docs.replit.com/build/design-with-canvas);
  - [Onlook artifacts](https://docs.onlook.com/canvas/artifacts);
  - [Magic Patterns](https://www.magicpatterns.com/docs/documentation/features/mcp-server/available_tools);
  - [Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design).
- **Comments pinned on a preview** are kept by a hosted service, not in the repository. Vercel's
  comments can be listed and resolved from its CLI, in JSON
  ([Vercel CLI](https://vercel.com/docs/cli/comments)). Lovable's pins detach or land on the wrong
  element when the page's structure changes
  ([Lovable comments](https://docs.lovable.dev/features/project-comments)).
- **Mapping an element back to its code** takes development-only instrumentation:
  - react-grab copies the component stack with `file:line:col`
    ([react-grab](https://github.com/aidenybai/react-grab));
  - LocatorJS uses a Babel plugin ([LocatorJS](https://github.com/infi-pc/locatorjs));
  - React 19 removed `_debugSource`, which broke older tools
    ([React PR 28351](https://github.com/facebook/react/pull/28351)).
- **Accessibility.** None of these tools documents a keyboard way to pick an element.

### What they have in common

- **Three sizes**: just do it, a light path, and the full flow.
- **A bug's shape**: what happens, what should happen, how to reproduce it, the root cause, what
  stays unchanged, the files, and the tests.
- **Investigation before any edit**, and no fix without its root cause.
- **A test that fails first** for a bug, and checks of what must stay unchanged.
- **The size picked after investigating**, said to the human, who can override it. Escalation
  happens mid-way when the work grows.
- **Escalation triggers**, by how often the sources name them:
  - new or changed contracts: an API, a schema, a data format, a breaking change;
  - a new dependency or a migration;
  - security;
  - intent the user would notice that the request leaves open;
  - several independent goals;
  - repeated failed fixes;
  - a size: 100 lines or about 5 files.
- **Gates that remain**: the questions only the human can answer, and the review of the diff or pull
  request. Approval of a plan before code is dropped, except by Superpowers (in chat) and Spec Kit
  (on the assessment).
- **Scope discipline**: no improvements in passing, and findings outside the scope deferred to a
  list.
- **A fresh reviewer** on the diff, told to flag what affects correctness.
- **Small changes in a batch**: UI tools collect several small edits and apply them as one version.

## Standards and libraries

### Engineering processes: what needs the heavy path

- **Rust.** An RFC is needed for "Any semantic or syntactic change to the language that is not a
  bugfix". It is not needed for refactors, objective quality gains, or changes "invisible to
  users-of-rust" ([Rust RFCs](https://github.com/rust-lang/rfcs/blob/master/README.md)).
- **Go.** A proposal is needed for API changes, command-line changes, and "Any other visible
  behavior changes in existing functionality". "If in doubt, file a proposal"
  ([Go proposals](https://github.com/golang/proposal/blob/master/README.md)).
- **React and Ember.** An RFC is needed for new API surface, removals, and "new idiomatic usage or
  conventions". It is not needed for bug fixes, docs, refactors, or warnings
  ([React RFCs](https://github.com/reactjs/rfcs/blob/main/README.md)).
- **Django.** "All contributions require a ticket unless the change is considered trivial", and a
  wider discussion when "a patch introduces new Django functionality and makes some sort of design
  decision"
  ([Django patches](https://docs.djangoproject.com/en/dev/internals/contributing/writing-code/submitting-patches/)).
- **IETF errata** fix "bugs" in a specification, but "should not be used to change what the
  community meant when it approved the RFC"
  ([IESG statement, 2008](https://datatracker.ietf.org/doc/statement-iesg-iesg-processing-of-rfc-errata-for-the-ietf-stream-20080730)).
  This is the closest model for a light flow that must not change an approved spec.
- **ITIL standard changes** are pre-authorized because their procedure is "well known, documented,
  and proven" and their risk low. Automated tests and rollback are what make a change eligible
  ([AWS CAF](https://docs.aws.amazon.com/whitepapers/latest/aws-caf-operations-perspective/change-and-release-management.html)).
- **Linux stable fixes** must be "obviously correct and tested", under 100 lines with context, and
  "fix a real bug that bothers people"
  ([stable rules](https://docs.kernel.org/process/stable-kernel-rules.html)).

### Small changes and review

- **Google.** "the right size for a CL is one self-contained change"; "100 lines is usually a
  reasonable size … 1000 lines is usually too large"; spread across files matters more than lines. A
  bug fix and a refactor go in separate changes, and tests come in the same change
  ([small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html)). Approve a
  change that "definitely improves the overall code health", never one that worsens it
  ([standard](https://google.github.io/eng-practices/review/reviewer/standard.html)).
- **DORA.** Heavyweight approval before a change has "a negative impact on software delivery
  performance", and "no evidence was found" that it lowers failures. Peer review at check-in, with
  automated tests, works instead
  ([change approval](https://dora.dev/capabilities/streamlining-change-approval/)). Small batches
  are "a safety net for AI adoption"
  ([small batches](https://dora.dev/capabilities/working-in-small-batches/)).
- **The common practice is that every change is reviewed.** Small changes get a faster review, not
  no review.

### Bug reports and regression tests

- **A report needs three things**: steps to reproduce, what you expected, and what you saw
  ([Spolsky](https://www.joelonsoftware.com/2000/11/08/painless-bug-tracking/),
  [Mozilla](https://bugzilla.mozilla.org/page.cgi?id=bug-writing.html)). Uraeda's report template,
  `skills/uraeda/assets/templates/specs/bugs/YYYY-MM-DD-bug-slug/report.md` until this feature
  removed it, has them.
- **A regression test fails before the fix** (Django's checklist, above). It is named after what it
  guards, not after the issue's number
  ([rustc-dev-guide](https://rustc-dev-guide.rust-lang.org/tests/best-practices.html)).

### Accessibility of a visual picker

- **Choosing among variants** maps to a radio group, with arrow keys and a description for each
  option ([WAI-ARIA radio](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)). A thumbnail alone
  fails people who cannot see it.
- **Dragging**, for selecting an area or for a swipe comparison, needs a single-pointer alternative
  ([WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)).

## The code

### Important reads

- [`bug.md`](/skills/uraeda/references/bug.md), 111 lines:
  - it carries a warning: "Agent-authored draft, not reviewed by a human yet";
  - a bug starts by hand on `fix/YYYY-MM-DD-<slug>`;
  - the agent assesses: reproduce, root cause, then plan the fix;
  - it always stops at `assessment.md` with `status: awaiting-human`, even with nothing to ask;
  - after approval it fixes, reviews, and finishes into a `kind: bug` record.

  Its questions sit at the end of the assessment, in the clarifications format.

- **The bug templates**, in `skills/uraeda/assets/templates/specs/bugs/YYYY-MM-DD-bug-slug/` until
  this feature removed them:
  - `report.md`: what happens, what should happen, how to reproduce, and the environment;
  - `assessment.md`: reproduction, root cause, the fix with checked steps, and optional questions;
  - the example's `specs/bugs/2026-10-14-tasks-reappear/assessment.md`: a 108-line assessment.
- [`steps.rs`](/crates/core/src/steps.rs):
  - `feature_step` (85 lines) and `bug_step` are separate tables;
  - `bug_step` gates on the report, then on the assessment's status, then counts its checkboxes;
  - both share the pull request tail, `after_the_last_step`, and finished records.
- [`workspace.rs`](/crates/core/src/workspace.rs), 1,061 lines, on the structural test's list of
  large files:
  - `Kind` is `Feature` or `Bug`;
  - `branch_folder` takes the `fix/` prefix to mean a bug;
  - `folder_path` maps a bug to `specs/bugs/`;
  - the first file, `proposal.md` or `report.md`, is chosen in three places: `read_feature`,
    `from_texts`, and [`view.rs`](/crates/core/src/view.rs);
  - `read_feature` is about 106 lines, at the 100-line limit.
- **Missing in the core for bugs**:
  - [`items.rs`](/crates/core/src/files/items.rs) does not read an assessment's questions or steps,
    so the web UI cannot answer them, and `ura answer` only answers `clarifications-NN.md`
    ([`answer.rs`](/crates/core/src/actions/answer.rs));
  - [`sections.rs`](/crates/core/src/check/sections.rs) does not check a report's sections, and its
    `check_sections` is at the limit too.
- **Starting.** [`start.rs`](/crates/core/src/actions/start.rs) (493 lines, near the 500-line limit)
  starts only drafts. [The CLI's `start`](/crates/cli/src/start.rs) panics on a bug:
  `unimplemented!("starting a bug, until the bug flow has its spec")`. The web UI starts drafts only
  (the `feature.start` mutation in [`mutations.ts`](/packages/server/src/fate/mutations.ts)).
  Nothing in the UI starts or reports a bug.
- [`message.ts`](/packages/server/src/runner/message.ts): the agent's message for each step, added
  in `d25a7e7`, with `assess`, `assess-revision`, and `fix` already written. The
  [agents decision](/specs/decisions/agents.md) requires each run to carry its step and reference.
- **The web UI.** It shows a bug like a feature. The generic review page reviews an assessment, and
  [`labels.ts`](/packages/web/src/labels.ts) names its steps. An assessment shows no mockups, since
  the core reads no items from it.
- [The finish step](/skills/uraeda/references/finish.md) and `ura clean` already handle both kinds.

### The proposal's path and existing actions

- **Writing the request.** Today a human writes a draft (`ura draft`, or the web UI), or a bug
  report by hand on a branch they create. Nothing starts a bug for them. The in-flight
  [scratchpad feature](#overlaps-with-features-in-flight) would add a third entry point, notes
  triaged later.
- **The agent investigates.** For a bug, `bug.md` already describes reproducing it, the failing
  test, and the root cause. For a small change, nothing describes it: the full flow's discovery
  covers it, at a much larger scale.
- **No questions by default.** `bug.md` always stops at its assessment. The feature flow always
  writes a round of questions, at least one to confirm the scope.
- **Code, tests, review.** `bug.md`'s fix reuses the implementation step's final review: catching up
  with the default branch, a fresh reviewer, and a second one when available.
- **The pull request and the record.** Shared with features.
- **Escalation.** It does not exist. [Postponing](/skills/uraeda/references/projects.md) moves a
  feature's folder to `specs/drafts/<slug>/` and merges it into the default branch, so it could
  carry a request and its investigation there too. A draft folder is started like any other.
- **Existing actions that meet a light change**:
  - **Answering questions**: only rounds are answerable, by `ura answer` and the web UI.
  - **Reviewing**: an assessment's review works like a spec's.
  - **Images**: a bug's folder takes attachments, through the
    [attachments decision](/specs/decisions/attachments.md).
  - **`ura clean`**: it cleans `fix/` branches.
  - **Ad-hoc `fix/` branches**: the core counted any `fix/YYYY-MM-DD-*` branch as a bug, until
    `9187d86` required its folder or its record. `fix/2026-10-13-review-findings` showed in the UI
    without using the flow, which the scratchpad in [`PRIORITIES.md`](/specs/PRIORITIES.md) notes.

### What happened to small work so far

- **The bug flow was never used.** No commit ever added a folder under `specs/bugs/`, no
  `assessment(` commit exists, and every record in `specs/done/` is `kind: feature`.
- **Both `fix/` branches bypassed it.** Each wrote a pull request description in the skill's style,
  and no file in `specs/`:
  - [#8](https://github.com/mrtolkien/uraeda/pull/8) changed 60 files;
  - [#11](https://github.com/mrtolkien/uraeda/pull/11) changed 101 files, and edited two decisions
    without a spec. It was a quality sweep, not a bug fix.
- **About 24 changes went straight to `main` between 2026-10-11 and 2026-10-15.** Some were small UI
  fixes, like `1f0183c` "remove useless pill". Some changed workflow rules, like `325b833` (slugs of
  two words), `8dd567d` (discovery effort), and `d8b04cc` (plan review chosen at spec review). Some
  were 300-line changes, like `d25a7e7`. None has a record, test evidence, or a review.
- **The full flow stays large even for small features.** The 15 records range from 5 to 16
  questions, 6 to 18 tasks, and 430 to 720 lines of spec plus 570 to 1,660 lines of plan.
- **UI features end in long tails of small fixes.** `fix(ui-improvements)` has 27 commits,
  `fix(text-inputs)` 24, and `fix(chat-in-the-web-ui)` 23. That is the UI iteration the proposal
  describes.

### Overlaps with features in flight

- **`2026-10-15-add-scratchpad`** (proposal only): quick notes, triaged later. Its proposal says a
  note "could be fixed quickly without a full dev flow". The scratchpad is the natural intake of
  light changes. This feature gives it a target, and the scratchpad owns the capture and the triage.
- **`2026-10-14-testing-review`** (implementing): its US2 makes `vp run ready` rerun only what a
  change can affect. A light change's cost is mostly its validation runs, so it benefits directly.
  No conflict.
- **[`look-and-feel`](/specs/drafts/look-and-feel.md)** (draft, in Now): a list of small UI fixes, a
  likely first user of a light flow or of UI iteration.
- **[Benchmarks](/specs/backlog/benchmarks/discovery-01.md)** (backlog): it leaves the bug flow out
  of the benchmarks, and notes that bug fixes with clear reports have nothing to ask in the
  questions step.

### Rules and their owners

- **Which step comes next**: [`steps.rs`](/crates/core/src/steps.rs) owns it, written in prose in
  [SKILL.md's table](/skills/uraeda/SKILL.md#finding-the-next-step) and
  [`bug.md`'s table](/skills/uraeda/references/bug.md#finding-the-step). Each table exists twice, in
  Rust and in the skill, as the [CLI decision](/specs/decisions/cli.md) requires.
- **A branch's kind and its folder**: `branch_folder` and `folder_path` in
  [`workspace.rs`](/crates/core/src/workspace.rs) own it. It is copied as a `specs/bugs` pattern in
  [`sessions.ts`](/packages/server/src/fate/sessions.ts) and
  [`routes.tsx`](/packages/web/src/routes.tsx), and as a stripped `bugs/` in the LSP's
  [`commands.rs`](/crates/lsp/src/commands.rs) and `commands/attach.rs`.
- **The first file of a folder**: chosen in three places, as listed in
  [Important reads](#important-reads).
- **Which statuses a file takes**: `FileKind::statuses` in
  [`workspace.rs`](/crates/core/src/workspace.rs) owns it. It is written again in
  [the conventions' status table](/skills/uraeda/references/conventions.md#workflow-status).
- **Each step's message to the agent**: [`message.ts`](/packages/server/src/runner/message.ts) owns
  it.

### Likely changes

- **Under every option**:
  - the skill's reference for the light flow, replacing or rewriting `bug.md`;
  - its templates and example;
  - [SKILL.md](/skills/uraeda/SKILL.md), [conventions](/skills/uraeda/references/conventions.md),
    [projects](/skills/uraeda/references/projects.md), and
    [finish](/skills/uraeda/references/finish.md);
  - [`README.md`](/README.md), whose "Bugs get a lighter flow" paragraph describes today's gate;
  - [`specs/README.md`](/specs/README.md).
- **With the core in scope**:
  - [`steps.rs`](/crates/core/src/steps.rs): the light table;
  - [`workspace.rs`](/crates/core/src/workspace.rs): kinds, branches, folders, and first files.
    `read_feature` must be split first, being at its limit;
  - [`start.rs`](/crates/core/src/actions/start.rs), which must be split first, being near the file
    limit;
  - [`items.rs`](/crates/core/src/files/items.rs), if questions stay inside the agent's file;
  - [`check/`](/crates/core/src/check/): templates and names;
  - the CLI's `start` and `status`;
  - [`message.ts`](/packages/server/src/runner/message.ts) and
    [`labels.ts`](/packages/web/src/labels.ts);
  - a start action in the web UI;
  - [`fixtures/`](/fixtures/), which has no real bug fixture today.
- **With a new folder or branch name**: everything listed in
  [Rules and their owners](#rules-and-their-owners) for the branch's kind, and the
  [attachments decision](/specs/decisions/attachments.md), which names "a bug's" folder.
- **With UI changes allowed in the light flow**: proposed changes to the
  [UI checks](/specs/decisions/ui-checks.md) and [UI layout](/specs/decisions/ui-layout.md)
  decisions. See [The UI decisions require a spec](#the-ui-decisions-require-a-spec).

## The proposal

### Three flows in one proposal

The proposal names three things: a bug flow, a flow for small changes, and a visual flow for
iterating on UI. The first two share their shape in every product studied: settled intent, an
investigation, code, and a review. The third needs new UI tooling: variants side by side, clicking
an element, feedback kept in the repository. Its open questions are about visual direction and
tools, not about the workflow's steps.

### The bug flow exists, unreviewed

[`bug.md`](/skills/uraeda/references/bug.md) says it "will get its own spec once the feature flow
works". This feature is that spec. Its gate on every assessment goes against the proposal's "by
default there should be no need for clarifications or specs".

### What counts as small is not defined

The proposal gives examples: "a small UI change, a small behaviour change". It leaves the agent to
judge "too big". The sources split on criteria (contracts, intent gaps, irreversibles) against a
size, as listed in [What they have in common](#what-they-have-in-common).

### No gate against the human's control

The constitution's [principle I](/specs/CONSTITUTION.md#i-humans-stay-in-control) says agents stay
"within the scope and decisions a human approved". In a light flow with no gate, the request itself
is the approved scope, and anything beyond it is a question or an escalation. Superpowers kept a
gate because it caught unexamined assumptions; DORA found that approval before a change does not
lower failures.

### "Not run the full review process" against "no negative impact on code quality"

The proposal names both, and calls the balance "the difficulty". The full flow reviews each task,
then the whole branch with a fresh reviewer, then a second reviewer when one is available.

### The constitution names the spec and the plan

[Principle VI](/specs/CONSTITUTION.md#vi-code-is-checked-and-stays-maintainable) says:

- implementations include tests "covering the spec's acceptance scenarios";
- new abstractions and exceptions are approved "in the plan's complexity tracking", or "in the spec
  or plan".

A light change has neither file. Its request's expected behaviour can stand for the acceptance
scenarios. An exception or a marker has no place to be approved, unless such a change escalates.

### The UI decisions require a spec

Three active decisions assume a spec:

- [UI checks](/specs/decisions/ui-checks.md): "Every UI test MUST guard a spec's acceptance
  scenario, edge case, or success criterion, or a rule of a UI decision". A small UI change's test
  guards a request, which this rule does not allow.
- [UI layout](/specs/decisions/ui-layout.md): "A view's spec MUST say why its layout reads best".
- The same decision: "Every view's spec MUST say what it shows at both width classes, and its
  mockups MUST show both".

The screenshots rule of UI checks only needs a folder, which a light change has.

### Upgrading to a feature is not described

The proposal says the flow "should offer to upgrade it to a draft/proposal". Drafts live on the
default branch ([git decision](/specs/decisions/git.md)), and a light change lives on its own
branch, so the move has to go through a merge, as postponing does.

## Approaches

Criteria come from:

- the proposal: short, no questions by default, quality kept, escalation;
- the constitution: principle I, control; III, asynchronous; IV, review effort matches impact; V,
  tools optional; VI, code checked;
- the active decisions: [code quality](/specs/decisions/code-quality.md),
  [UI checks](/specs/decisions/ui-checks.md), [UI layout](/specs/decisions/ui-layout.md),
  [CLI](/specs/decisions/cli.md), [agents](/specs/decisions/agents.md), and
  [git](/specs/decisions/git.md).

### Splitting the proposal

Which of the three flows this feature builds. See
[Three flows in one proposal](#three-flows-in-one-proposal).

| Option                                                      | Size of this feature                     | Covers the pain now                              | Risk                                          |
| ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| A. Bugs and small changes now, UI iteration later           | One flow, its tools, the skill           | The direct commits and the unused bug flow       | UI tails stay until the visual flow           |
| B. All three at once                                        | Adds variants, element picking, feedback | Also the UI tails                                | Large, with visual direction questions on top |
| C. Bugs only, as `bug.md` needs a spec, small changes later | Smallest                                 | Bugs only: most direct commits are small changes | Small changes keep bypassing the workflow     |

### One flow or two

Whether bugs and small changes share one flow. See
[What they have in common](#what-they-have-in-common).

| Option                                                                                       | Rules to keep                                      | Matches others                                   | Cost                                                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| A. One light flow, its investigation differing for a bug (reproduce, root cause) or a change | One table, one template set                        | BMAD's build, OpenSpec's ff for both             | Rename or extend the bug flow's names                          |
| B. Two flows: the bug flow kept, a second one for changes                                    | Two tables, two template sets, two kinds of folder | Spec Kit (bug extension and tinyspec separately) | Three step tables in the core and the skill                    |
| C. Small changes as features with a light mode, the bug flow apart                           | The feature table gains branches                   | OpenSpec's `/opsx:ff`, Kiro's Quick Spec         | `feature_step` already at 85 lines; specs stay files to review |

### Names of the light flow

How a light change's folder, branch, and record are named. Only with option A of
[one flow or two](#one-flow-or-two). See [Rules and their owners](#rules-and-their-owners).

| Option                                                                        | Clarity                                             | Collisions                                          | Migration                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| A. `specs/changes/<folder>/`, branch `change/<folder>`, record `kind: change` | "Change" covers a bug and a tweak (OpenSpec's word) | `change/` is used by nothing else                   | Rename the bug flow's names; no real bug to move |
| B. `specs/fixes/<folder>/`, branch `fix/<folder>`, record `kind: fix`         | "Fix" reads as a bug, less as a tweak               | Ad-hoc `fix/` branches, kept out by the folder rule | Rename the folder only                           |
| C. Keep `specs/bugs/` and `fix/` for bugs, add `specs/changes/` and `change/` | Two names to learn                                  | As A for changes, as B for bugs                     | No rename, two kinds more in every copy          |

### The gate before code

Whether the agent stops for the human before writing code. See
[No gate against the human's control](#no-gate-against-the-humans-control).

| Option                                                                                  | Human time                      | Catches wrong assumptions                           | Others                                  |
| --------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------- | --------------------------------------- |
| A. No gate unless the agent has a question or escalates; the pull request is the review | One review, at the pull request | At the pull request, with the settled points listed | BMAD one-shot, Kiro Quick Spec, Copilot |
| B. Always a gate on the agent's assessment, as `bug.md` does today                      | Two reviews per change          | Before code                                         | Spec Kit's workflow                     |
| C. The request says whether to stop on the assessment, on top of A or B                 | As the human chooses            | When asked                                          | BMAD's pinned route                     |

### When a change is too big

What makes the agent stop and offer an upgrade. See
[What they have in common](#what-they-have-in-common).

| Option                                                                                                                                                                                                                                 | Predictable                            | Fits the constitution           | Others                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------- | --------------------------------- |
| A. Criteria: a new or changed decision, a data format users have, a public interface (CLI, file format, API), behaviour beyond the request, intent the user would notice, a constitution exception or a new marker, three failed fixes | Judged by the agent, named in its file | Matches principles I and VI     | BMAD v6.12, OpenSpec, Superpowers |
| B. A's criteria, plus a size that stops the flow, like 200 changed lines outside tests or 5 files                                                                                                                                      | A number to check                      | As A                            | BMAD v7, tinyspec                 |
| C. A size only                                                                                                                                                                                                                         | Most predictable                       | Misses a one-line format change | None alone                        |

### How an upgrade happens

What the folder becomes once the human agrees to upgrade. See
[Upgrading to a feature is not described](#upgrading-to-a-feature-is-not-described).

| Option                                                                                                                                   | Reuses                                    | Speed                              | Human control                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------- | ---------------------------------------- |
| A. Postpone it into a draft folder: the request as `proposal.md`, the investigation kept, merged to the default branch, its entry in Now | Postponing, starting a draft folder       | One start by the human             | The human starts it and chooses its slug |
| B. Turn the branch into a feature at once: folder and branch renamed, discovery starts                                                   | Little: renames a branch and its worktree | No wait                            | No point to re-prioritise                |
| C. The agent drops the branch and asks the human to write a draft                                                                        | Nothing                                   | Slowest, the investigation is lost | Full                                     |

### One change or a batch

Whether a request may hold several small changes. See
[What happened to small work so far](#what-happened-to-small-work-so-far).

| Option                                                                                          | Human time                  | Review quality               | Others                                    |
| ----------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------- | ----------------------------------------- |
| A. A short list of related changes in one area, each with its commit and test, one pull request | One pull request per batch  | Larger diff, split by commit | UI tools apply batches; Google splits CLs |
| B. One change per request                                                                       | One pull request per change | Smallest diffs               | Google, Linux, Kubernetes                 |

### The review before the pull request

How much review a light change gets. See
["Not run the full review process" against "no negative impact on code quality"](#not-run-the-full-review-process-against-no-negative-impact-on-code-quality).

| Option                                                                                                                       | Cost             | Quality                           | Others                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------- | ----------------------------- |
| A. One fresh reviewer on the whole diff, the final review's criteria scaled to it, minor findings listed in the pull request | One review agent | Independent check of every change | Claude Code, BMAD one-shot    |
| B. The full final review: per-step reviews, a fresh reviewer, and a second reviewer                                          | As a feature     | Highest                           | The full flow                 |
| C. The agent reviews its own diff                                                                                            | Lowest           | Weaker: an author's review        | Superpowers for small changes |

### UI changes without a spec

How a light UI change meets the UI decisions. See
[The UI decisions require a spec](#the-ui-decisions-require-a-spec).

| Option                                                                                                                                                                       | Decisions                                   | Human time                       | Quality                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------- | ------------------------------------- |
| A. The request and the agent's file stand for the spec: tests guard the request's expected behaviour, screenshots at both widths replace mockups, a new view stays a feature | Proposed changes to UI checks and UI layout | Screenshots in the pull request  | The same checks, the same screenshots |
| B. Every UI change escalates to a feature                                                                                                                                    | None                                        | The full flow for every UI tweak | As today                              |
| C. A light UI change writes HTML mockups and waits for their approval before code                                                                                            | Changes to both, and a gate                 | Two reviews                      | Mockups before code                   |

### Tools for the light flow

How much of the tooling this feature builds. See [Likely changes](#likely-changes).

| Option                                                                                                                     | Size   | Use from the UI                  | Decisions                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------- | ---------------------------------------------------- |
| A. The skill, the core's table, `ura start` for a request, and a start action in the web UI; editors through the core only | Medium | Start, run, answer, review       | Follows the CLI decision: skill and command together |
| B. The skill only, the tools later                                                                                         | Small  | None: the runner cannot start it | `ura start` keeps refusing                           |
| C. A, plus a dedicated view for light changes in the web UI                                                                | Large  | Full                             | As A                                                 |

### Needs no choice

- **The request's template.** A bug report's three parts (what happens, what should happen, how to
  see it) fit a small change too: what it does now, what it should do, where. One template serves
  both. The agent tells a bug from a change by checking the request against the spec, the docs, and
  the records, and says which in its file.
- **The investigation.** It follows `bug.md` for a bug: reproduce, a failing test, the root cause,
  one hypothesis at a time. For a change, it reads the code, the decisions, and the dependencies'
  docs, as a `low` discovery effort does. Neither compares products online.
- **Unchanged behaviour.** The agent's file lists what must stay unchanged, as Kiro's bugfix spec
  does, and the tests check it. This answers the over-editing that Kiro measured, and Superpowers'
  open issue on fixes that create bugs.
- **Tests.** A test fails first for the bug or for the new behaviour, and checks of preserved
  behaviour keep passing. These are the implementation step's rules, and the constitution's.
- **Questions inside a light change.** They use a round of questions, `clarifications-01.md`, which
  `ura answer`, the web UI, and the status table already handle. Questions inside the assessment
  would need new parsing in [`items.rs`](/crates/core/src/files/items.rs) and in `ura answer`.
- **Code quality.** The code-quality decision applies as it is. A structural commit comes first when
  a change grows a unit over a limit, and a new marker is a reason to escalate, since only a plan
  can carry its approval.
- **Catching up with the default branch.** The light flow rebases before its review, as the
  implementation step does.
- **Rulings.** Choices the agent makes inside the change go in `rulings.md`, as today.
- **The pull request and the record.** The finish step writes a short record, with the light flow's
  kind, and removes its entry from `PRIORITIES.md`.
- **Priorities.** A light change gets an entry in **Now**, so `ura next` and the web UI find it.
- **Just-do-it edits.** Typos, formatting, and comments stay outside any flow, as they are today:
  nothing in the workflow requires a flow for them.
- **The scratchpad.** Capture and triage belong to the scratchpad feature. This feature gives it a
  target: a note starts as a light change, like a draft starts as a feature.
- **Images.** A light change's folder takes images like a bug's folder today.
- **The UI iteration research.** It is recorded above, in
  [Visual iteration on UI](#visual-iteration-on-ui), for its own feature.

## Not checked

- **ITIL 4's own text**: paywalled. Its change types come from AWS and ServiceNow pages.
- **The IESG's 2021 errata statement**, which replaces the 2008 one: not read.
- **Kiro's vibe-mode page**: it redirects, and how Kiro decides to offer a spec session is only
  described by a third party.
- **Google Stitch's variant options** ("Creative Range", three variants by default): seen only in
  search results; no official page reached.
- **Tempo Labs and Bolt's visual inspector**: no official documentation reached.
- **How v0, Lovable, Subframe, and Windsurf map a selected element to its code**: not documented on
  the pages read.
- **Data on the cost of generating several variants, or on drift between a mockup and its code**:
  only vendor material found.
- **Hacker News and Reddit threads on lightweight flows**: none found directly. Sentiment comes from
  GitHub issues and blog posts.
- **Why `fix/2026-10-13-review-findings` still showed in the UI after `9187d86`**: a server older
  than the commit is likely, but not confirmed.
