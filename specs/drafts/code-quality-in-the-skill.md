---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Code quality and maintainability through the skill

## What

Code quality and maintainability, built into the Uraeda skill, so that apps stay maintainable
feature after feature without the human reading code:

> What I want is a system that gives me the least amount of work to create high quality,
> maintainable apps. I do not intend to read a single line of code.

Three changes to the workflow:

1. **The spec split in two**: what the human approves, and what the agent builds from.
2. **Code quality concepts in the references**, backed by checks that tools run, not by prose alone.
3. **A maintenance flow**: an agent audits the codebase, the human answers its findings like a round
   of questions, and the fixes, decisions, and checks go through the usual flow.

The issues found in this repository are fixed later, through the maintenance flow once it exists.

### 1. Spec for the human, design for the agent

> I did review the specs but rarely the plan indeed. [...] The important point is splitting the spec
> in what's "for human" vs what's "for agent": the spec did go into too much details sometimes and
> was hard to read. Clarifications were IMO the perfect size.

- **`spec.md`, for the human, approved**: the behaviour in plain terms, what changes for the human
  and for users, the decisions it proposes, the tradeoffs and risks, and the assumptions. The size
  of a clarifications round.
- **A design file, for the agent, not reviewed** (`design.md`, or another name): data, components,
  exact strings, edge cases, the test map, and where each rule lives. It must agree with the spec
  and the active decisions; the review checks it does.
- **The rule that keeps the split safe**: anything that changes what a user sees, or can lose, is in
  the human's part. For example, chat-in-the-web-ui's ruling R17 (an unread message silently taken
  back when a turn ends) was settled by the agent, and should have reached the human.
- With nobody reading the design or the code, maintainability rests on the checks, the reviews, and
  the maintenance flow below. The human gets reports about quality, never code.

### 2. Concepts for the references

Few concepts, short, in the references they belong to, each backed by a check where one is possible.
Not a style guide: long instruction lists cost more and do not stop the decay (see Why).

- **One home per rule**: before writing logic, find where the codebase already does it. Discovery
  lists who owns each rule the feature touches; the design says where each new rule lives; a copy of
  a rule in another layer (a UI, a plugin) is a complexity-tracking row, justified or refused. The
  review looks for duplication across the codebase, not only in the diff.
- **Extract, don't grow**: complexity tracking covers the growth of existing functions and files,
  not only new abstractions. A task that touches a unit already over a size or complexity limit
  starts with a commit that only restructures it, never mixed with behaviour changes. The final
  review reports the size and complexity changes of the units the branch touched.
- **Rules enforced by tools, explained by prose**: every MUST of a decision says how it is enforced
  (a lint rule, a test, `ura check`, or review only). A spec proposing a decision includes the task
  that adds its check, as ui-improvements did with its lint rules and fixtures. Lint messages say
  how to fix the problem, for the agent reading them. Warnings, complexity, and duplication never go
  up: a ratchet.
- **Tests that can fail**: beyond watching a test fail before the code exists, break the code in a
  realistic way and see a test catch it. Each test names the break it catches. No fixed sleeps or
  wall-clock assertions in unit tests. Changing or deleting an existing test needs a ruling.
- **Interfaces verified the way they are used**: UI stories run end to end in a browser, the way the
  human would click through them, not only as component tests.

### 3. Maintenance flow

> Would that be another reference file or a separate skill? It needs to be connected to the uraeda
> flow though to update decisions and all.

A reference file in the Uraeda skill, `references/maintenance.md`, shaped like the bug flow, since
it needs the constitution, decisions, `PRIORITIES.md`, branches, records, and `ura check`:

1. **Audit**: an agent writes `specs/maintenance/YYYY-MM-DD-<slug>/report.md` (or similar): rules
   duplicated across layers, units over their limits, decisions without a check, drift between
   layers, tests that cannot fail, the ratchet's numbers. Each finding is a question in the
   clarifications format, with a recommended answer: "The plan-review default lives in three places.
   A (recommended): keep it in the core and expose it to the UI and the plugin."
2. **The human answers**, the same work as a clarifications round.
3. **The agent acts**: small fixes on a branch, new or changed decisions proposed for approval,
   checks added for what can be enforced, and a record in `specs/done/`.
4. **Trigger**: the human asks for it, or `ura status` suggests one after a few features merged
   since the last audit.

## Why

A review of this repository (2026-10-13), against the proposals, answers, specs, and code of its
nine features, found the workflow builds what was asked, with a solid Rust core, but quality is held
by instructions alone, and it decays:

- **Rules duplicated across layers**, against the stack decision's "logic lives once in the core":
  the web UI reads and sets frontmatter with regexes (`packages/web/src/discovery.ts`) and splits
  markdown sections (`EditorPage.tsx`); "plan review defaults to a high tier" is written in the
  core, the web UI, and the Lua plugin; the language server checks `awaiting-human` itself.
- **Functions and files that grow feature after feature**: `Workspace::read` went from 114 to about
  220 lines, `actions/start.rs` has a 236-line function with 8 parameters, `sessions.ts` reached 998
  lines in one feature, `ReviewPage` is a 434-line component.
- **Specs too long to read**: about 2,500 to 3,000 lines of discovery, questions, spec, and plan per
  feature; plans were rarely reviewed, and the agent settled some choices a human should have made.
- **Reviews that miss what an independent one finds**: the second-model review caught serious bugs
  the agent's own final review missed in four features (a path traversal, `ura clean` deleting a
  branch with unmerged work, saves overwriting changes made elsewhere).
- **Tests that could not fail** (fixed in 07a63ee), fixed sleeps, and about two fix commits per
  feature commit on UI features.

The research says the same, at scale:

- [SlopCodeBench](https://arxiv.org/abs/2603.24755) (2026 preprint): agents extending their own code
  over many iterations erode it in 77% of runs, ending 2.3× more verbose and 2.0× more eroded than
  human repositories; they grow existing functions instead of extracting (one `main()` went from 38
  to 240 lines). Quality prompts cut the levels by about a third, but did not change how fast
  quality decayed: structure and measured gates have to do the rest.
- [METR](https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/)
  (2026): about half of agent patches that pass the tests would not be merged by maintainers,
  increasingly for code quality. Passing tests is not done.
- [He et al., MSR 2026](https://arxiv.org/abs/2511.04427) (peer-reviewed, 806 repositories against
  matched controls): after adopting an AI coding tool, static-analysis warnings stay about 30%
  higher and complexity about 42% higher, and the speed gain is gone by the third month.
- [SWE-CI](https://arxiv.org/abs/2603.03823) (2026 preprint): most models beat human code on lint,
  all are worse on the maintainability index, and regressions grow as iterations go on.
- [Gloaguen et al., ICLR 2026](https://arxiv.org/abs/2602.11988): agents follow the instructions of
  context files, so extra rules make tasks harder and costlier. Keep instructions short, and move
  what a tool can check into the tool.
- [OpenAI, "Harness engineering"](https://openai.com/index/harness-engineering/) (2026): layer rules
  enforced by custom linters whose messages tell the agent the fix, AGENTS.md as "a map, not a
  manual", and a recurring cleanup that works "like garbage collection".
- OX Security's "Army of Juniors" and GitClear's 2025 report (vendor reports, directional):
  re-implementing instead of reusing, and avoiding refactors, in 80 to 90% of AI-written
  repositories; refactored code fell from 25% to under 10% of changes while copy-pasted code rose.
- [Böckeler on spec-driven tools](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
  (2025): long markdown specs are "very verbose and tedious to review", and agents still duplicated
  existing classes the spec described.

## Notes

- **Out of scope**: the adversarial review with a secondary model, its own line in Next. This
  feature leaves a place for it in the review steps. Fixing this repository's issues, which the
  maintenance flow does later.
- **Constitution**: "each rule lives in one place" and "quality never regresses" may belong in the
  constitution, which only the human amends: ask.
- **Keep the skill short**: `SKILL.md` is at 450 of the 500 lines the Agent Skills guidance
  recommends, and the references total about 2,100 lines. Adding concepts should come with trimming:
  the CLI reference and rare cases could move out of the paths every step reads.
- **Inspiration**: superpowers' writing-good-tests ("every test names the break it catches", the
  mutation check), its task reviewer's two verdicts (spec compliance, then quality, including "did
  this change significantly grow existing files?"), Kent Beck's "never mix structural and behavioral
  changes in the same commit", and Spec Kit's `/analyze` (spec items without a task).
- **Tools to look at for the ratchet**: clippy's `too_many_lines` and `cognitive_complexity`
  thresholds and `disallowed_methods`, a duplication detector across languages (jscpd or similar),
  import-boundary rules on the TypeScript side.
- **Related, in Later**: "Non-technical users", which also adapts the spec's contents (plain
  language behaviour, design summarized or hidden). The split here is a first step towards it.
- The spec split touches `ura check`, the templates, the example, the web UI, and the Neovim plugin:
  every tool that reads `spec.md`.
