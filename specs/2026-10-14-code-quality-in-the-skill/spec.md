---
status: approved
revision: 2
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Code quality and maintainability through the skill

> [!NOTE]
>
> Approved on 2026-10-14.
>
> - **A new decision, [code quality](../decisions/code-quality.md).** It sets 100 lines per
>   function, 7 parameters, 4 levels of nesting, and 500 lines per file. Today's offenders are
>   marked in place with a reason, and the markers can only go away.
> - **Your fate answer, read one way.** "Follow the fate stack's rules" is read as adopting
>   `@nkzw/oxlint-config`, its shared lint config, as a new dev dependency. fate has no size limits
>   of its own. Its autofixes rewrite much of the TypeScript once. Say so if you meant the size
>   limits only.
> - **The constitution amendment** (version 1.3.0) is spelled out under
>   [Constitution check](#constitution-check). You commit it yourself once you approve. Nothing in
>   the plan waits for it.
> - **One spec file, folded in the web UI.** Your answers on the split mean one `spec.md` with the
>   build details in a last `## Details` section. The web UI folds that section and each story's
>   scenarios. GitHub and Neovim show the plain file.
> - **The new spec layout makes `ura check` fail on specs in the old layout.** That includes the
>   multi-repo-server spec waiting for you, and image-attachments if its spec is written before this
>   merges. Their agent moves the sections when it next revises them.
> - **Pushing projects toward checks.** Project setup proposes a code-quality decision. In a project
>   without one, the next discovery round asks for it, once.
> - **This spec uses today's layout**, since the new one ships with it.
> - **Risk tier `medium`.** The plan does not wait for your review, the new default for every tier.

Agents grow and copy code feature after feature, and long specs bury what the human must approve.
This feature changes the Uraeda skill in four ways:

- the spec puts what the human approves first, and folds what the agent builds from;
- a few code-quality concepts go into the skill, each backed by a check;
- projects are pushed to set those checks up;
- `SKILL.md` becomes a lean entry point.

This repository adopts the checks itself, through a new decision and a constitution amendment. See
the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md). The maintenance flow becomes its own feature
([Q1](clarifications-01.md#q1-what-does-this-feature-build)).

## User stories

### US1: Review a spec without the build details (P1)

The human opens a spec in the web UI. Each story shows its short description and why it matters; its
acceptance scenarios and the spec's build details stay folded until asked for.

Why this priority: the proposal's main complaint is specs too long to read, and the human chose one
file whose agent part the UI hides ([Q2](clarifications-01.md#q2-where-does-the-agents-design-go),
[Q3](clarifications-01.md#q3-what-stays-in-the-spec-you-read)).

Acceptance scenarios:

1. **Given** the example spec waiting for review, **When** the human opens it, **Then** each story
   shows its band, title, description, and "Why this priority", followed by a closed "Scenarios (N)"
   toggle, where N is its number of scenarios. The `## Details` section shows as one closed
   "Details" toggle.
2. **Given** a closed "Scenarios (4)" toggle under US2, **When** the human taps it, **Then** the
   four scenarios show, and each can be selected for a comment as today.
3. **Given** a pending comment on a scenario of US2, **When** the human opens the spec, **Then**
   US2's scenarios are open, showing the comment with its Edit and Remove buttons.
4. **Given** US2's scenarios and the Details section open, **When** the human goes to another page
   and comes back, **Then** both are still open.
5. **Given** a link to `spec.md#data`, **When** the human follows it, **Then** Details opens and the
   page scrolls to its Data heading.
6. **Given** an approved spec, **When** the human opens it, **Then** it shows the same folds.

### US2: Specs written human-first (P1)

The spec template puts what the human approves first:

- the stories, with a description of one or two sentences;
- the edge cases and errors users see, in plain words;
- the success criteria;
- the architecture;
- the mockups;
- the assumptions, decisions, constitution check, and risk tier.

A last `## Details` section holds the data, components, exact strings, error handling, and test map.

Why this priority: the folds of US1 need a structure the core can find, and every later spec follows
it.

Acceptance scenarios:

1. **Given** the example spec in the new layout, **When** `ura check` runs, **Then** it reports no
   problem.
2. **Given** a spec whose `### Data` is still under `## Design`, **When** `ura check` runs, **Then**
   it reports the missing `## Details` section and the sections out of order.

### US3: Limits that fail the checks in this repository (P1)

`vp run ready` fails on a new function or file over the [code quality](../decisions/code-quality.md)
limits, and on a marker left on code that no longer breaks them.

Why this priority: the human chose limits in the linters already installed
([Q7](clarifications-01.md#q7-which-checks-does-this-repository-adopt-now)); the concepts mean
nothing without them.

Acceptance scenarios:

1. **Given** a new Rust function of 101 lines, **When** `vp run ready` runs, **Then** clippy fails
   with `too_many_lines`.
2. **Given** a new TypeScript function of 101 lines, **When** `vp run ready` runs, **Then** Oxlint
   fails with `max-lines-per-function`.
3. **Given** a new Rust source file of 501 lines, **When** `vp run ready` runs, **Then** the
   structural test fails. Its message names the file, its length, and the limit, and says to split
   the file by responsibility.
4. **Given** a function marked with `#[expect(clippy::too_many_lines, reason = "…")]` and shortened
   to 90 lines, **When** `vp run ready` runs, **Then** it fails until the marker is removed.
5. **Given** a file of the structural test's list shortened to 400 lines, **When** `vp run ready`
   runs, **Then** the test fails, saying to remove the file from its list.
6. **Given** a `test.only` in a TypeScript test, **When** `vp run ready` runs, **Then** the lint
   fails.

### US4: Agents follow the quality concepts (P2)

Agents of every project follow five concepts, each written once in the skill, at the step that uses
it:

- **One home per rule**: discovery lists who owns each rule a feature touches, and the spec says
  where each new rule lives.
- **Extract, don't grow**: a task touching a unit over its limit restructures it first, in a commit
  of its own.
- **Rules enforced by tools**: each rule of a decision says how it is checked.
- **Tests that can fail**: each new test names the break it catches, and the implementer causes that
  break once to see the test fail.
- **UIs verified end to end**: UI stories run in a browser, through the real app.

The final review reports how the branch changed the size of the units it touched, and leaves a place
for a second reviewer.

Why this priority: this is what keeps a project maintainable without the human reading code, but it
is guidance, which the checks of US3 back.

Acceptance scenarios:

1. **Given** a decision proposed by a spec, **When** the agent writes it, **Then** each rule ends
   with how it is checked: a lint, a test, `ura check`, or review only.
2. **Given** a plan task that modifies a function over the project's limit, **When** the plan is
   written, **Then** the task starts with a step that only restructures the function, committed on
   its own, before the failing test of the new behaviour.
3. **Given** a plan task adding a test, **When** the plan is written, **Then** the test's step names
   the break it catches. The implementer reports the failure it saw after causing that break.
4. **Given** a finished branch, **When** the final review runs, **Then** the pull request
   description lists each function and file the branch grew, with its length before and after.
5. **Given** a task reviewer, **When** it reviews a task, **Then** it gives two verdicts, spec
   compliance and then quality, and flags what the task grew, not sizes that were already there.

### US5: Projects pushed toward their own checks (P2)

A project using Uraeda gets checks of its own, through its own linters, without the human having to
think of it.

Why this priority: the human asked that Uraeda push every project toward the setup this repository
adopts ([Q7](clarifications-01.md#q7-which-checks-does-this-repository-adopt-now)).

Acceptance scenarios:

1. **Given** a new project being set up, **When** the agent has written the constitution with the
   human, **Then** it proposes a code-quality decision for the project's linters, with limits, the
   stack's shared lint config if it has one, and today's offenders marked in place.
2. **Given** a project with no `specs/decisions/code-quality.md`, **When** an agent runs discovery,
   **Then** the round asks whether to adopt one. The recommended option names the limits for the
   project's linters.
3. **Given** a project whose code-quality decision says it has no limits, with a date to revisit,
   **When** an agent runs discovery before that date, **Then** the round does not ask again.

### US6: Plan review off by default (P2)

Approving a spec no longer turns plan review on for the `high` tier. The human turns it on when they
want to see the plan.

Why this priority: the human turned it off on every spec since the field exists
([Q5](clarifications-01.md#q5-what-happens-to-plan-review)).

Acceptance scenarios:

1. **Given** a spec proposed at `medium` with `plan-review: false`, **When** the human approves it
   at `high` in the web UI without touching the plan review switch, **Then** the spec is saved with
   `risk-tier: high` and `plan-review: false`.
2. **Given** the same spec, **When** the human approves it at `high` with
   `ura review --approve --tier high`, **Then** the spec has `plan-review: false`.
3. **Given** a spec proposed with `plan-review: true`, **When** the human approves it at the
   proposed tier, **Then** `plan-review: true` stays.

### US7: A lean entry point (P3)

`SKILL.md` holds only what every run needs:

- what Uraeda is;
- the rules for agents;
- the folder map;
- how to find the next step;
- how to come back to the human;
- a line for each reference.

Everything else lives in the reference files.

Why this priority: the human wants the skill as lean as possible, so an agent that reads it by
mistake loses little context
([Q11](clarifications-01.md#q11-how-much-of-the-skill-moves-out-of-skillmd)).

Acceptance scenarios:

1. **Given** the skill, **When** `vp run ready` runs, **Then** a test fails if `SKILL.md` is longer
   than 20,000 characters, about 5,000 tokens.
2. **Given** the skill, **When** `vp run ready` runs, **Then** every `ura` command is still named in
   the skill or its references, as today.

## Edge cases

- **A story with no scenarios** shows no toggle.
- **A spec without a `## Details` section**, such as an old one, shows no Details toggle. Everything
  else shows as today.
- **A pending comment or the current selection inside Details** opens Details, like a story's
  scenarios.
- **A Details toggle never selects a block** for a comment.
- **The plan review** shows the plan as today: nothing is folded there.
- **Lua code** has no limits checked by a tool: Neovim's plugin is held by review only.
- **A Rust test file, a TypeScript test file, or a generated file** over 500 lines is not checked.

## Success criteria

- **SC-001**: In the web UI, the example spec under review shows no scenario, Data, Components,
  Error handling, or Testing content until a toggle is opened.
- **SC-002**: `vp run ready` fails on any new function over 100 lines, any new function over 7
  parameters, and any new source file over 500 lines, in Rust and TypeScript.
- **SC-003**: `vp run ready` passes on the branch with every existing offender marked, and with no
  new marker.
- **SC-004**: `SKILL.md` is at most 20,000 characters.
- **SC-005**: Every rule of the code-quality decision names its check, and every lint rule it adds
  has a fixture that makes it fire.

## Architecture

The work falls in four parts.

**The spec layout.** One spec file stays the single source for later steps, as the human chose.

- The template moves the agent's parts into a last `## Details` section.
- The core finds the folds: the Details section, and each story's scenarios. It sends their block
  ids with the spec's items, as the [stack](../decisions/stack.md) decision requires.
- The web UI wraps those blocks in Astryx's `Collapsible`, already in use.

**The skill.** The concepts are written once, in a new `references/code-quality.md`, and each step
links to the part it needs: one home per rule, as the concepts themselves ask.

- `SKILL.md` keeps what every run needs. Its conventions, project setup, and command table move to
  three new references.
- Three lines that say file length does not matter are rewritten
  ([discovery](discovery-01.md#important-reads)).

**This repository.** It adopts the [code quality](../decisions/code-quality.md) decision.

- The limits go in clippy's and Oxlint's configuration.
- Today's offenders are marked in place.
- A structural test holds Rust files to 500 lines.

**The plan-review default.** `false` for every tier, in the core only.

## Mockups

- [Spec folds](mockups/spec-folds.html): a spec under review on the phone, with one story's
  scenarios open and a pending comment, and on a desktop, with Details opened from a link.

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- **Superseded by the answers.** `design.md`, and the agreement checks between it and the spec, are
  replaced by the single file that Q2 chose.
- **Mockups and decisions stay in the human part of the spec.**
- **`data-model.md` and `contracts/`** stay optional.
- **One home per rule, extract don't grow, rules enforced by tools, and lint messages that say the
  fix** go into the skill as settled.
- **Test rules.** No fixed sleeps or wall-clock assertions in unit tests, and changing or deleting a
  test needs a ruling. The five fixed waits found today are left to the maintenance flow.
- **UI stories run end to end** in the project's browser runner.
- **The task reviewer gives two verdicts.** The final review leaves a place for a second reviewer.
- **Features in flight** rebase onto whichever lands first.

Settled while writing this spec:

- **The fate answer.** "Follow the fate stack's rules" is read as extending `@nkzw/oxlint-config`,
  since fate has no size limits and that config is the stack's shared lint setup
  ([Q7.A](clarifications-01.md#q7a-what-limits)).
- **No budget on the spec's length**, as you answered
  ([Q4](clarifications-01.md#q4-how-long-may-the-spec-be)). The reference still asks for stories of
  one or two sentences.
- **Fold labels.** "Scenarios (N)" for a story and "Details" for the section, both closed by
  default, in the web UI only. Neovim and GitHub show the plain file, Details last.
- **Markers in place, not a suppressions file**, the same way in Rust and TypeScript. Oxlint's
  suppressions file is not confirmed to pass through `vp lint`.
- **Rust file sizes** are held by a structural test, since clippy has no file-length lint.
- **Nesting of 4 levels** counts inside a function body. The plan calibrates clippy's
  `excessive_nesting` threshold to that.
- **Being asked once.** The discovery question about a code-quality decision is asked once: a "no"
  is recorded as a decision with a date to revisit.
- **Old specs are not migrated by a tool.** Specs in the old layout fail `ura check` until revised;
  records in `specs/done/` are not checked against the template.
- **A shared concepts file.** `references/code-quality.md` holds the concepts once, and the steps
  link to it, rather than each step repeating them.
- **The constitution template** gets the amended principle as its third principle, after the two
  placeholders. The example's constitution is left as it is.

## Decisions

New, applied when this spec is approved:

- [Code quality](../decisions/code-quality.md): size and nesting limits in clippy and Oxlint, a
  file-size test for Rust, `@nkzw/oxlint-config`, and today's offenders marked in place with a
  reason. Each rule says how it is checked.

Relied on:

- [Stack](../decisions/stack.md): the folds are computed in the core and sent with the spec's items.
  The web UI parses nothing.
- [UI components](../decisions/ui-components.md): the toggles are Astryx's `Collapsible`.
- [UI behaviour](../decisions/ui-behaviour.md): Back keeps the open folds.
- [UI layout](../decisions/ui-layout.md): the mockups show both widths, and the toggles are 44 px
  tall under a coarse pointer.
- [UI checks](../decisions/ui-checks.md): browser tests drive the folds as a user does.
- [Toolchain](../decisions/toolchain.md): the new checks run in `vp run ready`, and the new dev
  dependency is pinned.
- [CLI](../decisions/cli.md): every rule `ura check` enforces is written in the skill, and every
  command stays named in it.

## Constitution check

| Principle                        | Complies | Notes                                                                 |
| -------------------------------- | -------- | --------------------------------------------------------------------- |
| I. Humans stay in control        | yes      | You apply the amendment yourself; the new decision waits for approval |
| II. Git and plain text first     | yes      | Folds are a view; the spec stays one markdown file                    |
| III. Asynchronous by default     | yes      | No change to how steps end                                            |
| IV. Review effort matches impact | yes      | The human part comes first, the build details fold                    |
| V. Tools are optional            | yes      | Checks live in each project's own linters; `ura` measures nothing     |
| VI. Code is checked against spec | yes      | Extended by the amendment below                                       |

The amendment, which you commit once you approve, replaces principle VI of
[`CONSTITUTION.md`](../CONSTITUTION.md). It also bumps the version to 1.3.0, and sets **Last
Amended** to the day you commit it
([Q9](clarifications-01.md#q9-where-do-the-two-rules-go-in-the-constitution),
[Q10](clarifications-01.md#q10-who-applies-the-constitution-change)):

```markdown
### VI. Code is checked and stays maintainable

- Implementations MUST include tests covering the spec's acceptance scenarios.
- Code SHOULD stay explicit and simple. New abstractions MUST be justified in the plan's complexity
  tracking.
- Each rule MUST live in one place. A copy in another layer or language MUST be justified in the
  plan's complexity tracking.
- Warnings, size, complexity, and duplication measured by the project's checks MUST NOT go up. An
  exception MUST be approved by a human in the plan.

Rationale: "high-quality code" cannot be checked, but acceptance tests, justified complexity, and
checks that never go back can. Agents grow and copy code feature after feature unless something
measured stops them.
```

## Risk tier

**Medium**: no user data changes, but every later spec, every plan default, and the checks of every
later change are affected, and `ura check` fails on specs in the old layout.

## Details

### Data

**Spec items.** `SpecItems` gets `details: Vec<u32>`, the ids of the blocks of the `## Details`
section, its heading included. Each `Story` gets `details: Vec<u32>`, the ids of its scenarios'
intro paragraph and their list.

- Both are computed in `crates/core/src/files/spec.rs` from `items::section`, and are empty when
  there is nothing to fold.
- The napi declarations carry them, and the web's `ItemsSelection` selects them.

**Plan review.** `REVIEWED_TIER` goes away: `plan_review_default` returns the proposed value when
the tier is unchanged, and `false` otherwise. `tier_choices` follows, for the web UI and Neovim.

**The spec template**, in order:

- the title, the block, the intro paragraph;
- `## User stories`, `## Edge cases`, `## Success criteria`;
- `## Architecture`: the approach, the main units, where each new rule lives, and the tradeoffs;
- `## Mockups`, optional;
- `## Assumptions`, `## Decisions`, `## Constitution check`, `## Risk tier`;
- `## Details`, with `### Data`, `### Components`, `### Error handling`, and `### Testing`.

`## Design` and `### Approach` go away. The heading texts of Data, Error handling, and Mockups stay,
so links to `#data`, `#error-handling`, and the mockup page keep working.

**The fold state** lives in the history entry, like the chat's tool-call groups (`Transcript.tsx`
`useOpenGroups`), so Back restores it.

### Components

**The skill**

- **`SKILL.md`** ([file](/skills/uraeda/SKILL.md)): rewritten to at most 20,000 characters. It keeps
  what Uraeda is, the rules for agents, the folder map, the next-step table, coming back to the
  human, and one line per reference saying when to read it.
- **`references/conventions.md`** (new): markdown, the status table, review files, branches and
  worktrees, and commits, moved from `SKILL.md`.
- **`references/projects.md`** (new): setting up a project, with the code-quality decision it
  proposes; starting, postponing, and dropping a feature; finishing.
- **`references/cli.md`** (new): the `ura` commands, moved from `SKILL.md`.
- **`references/code-quality.md`** (new): the five concepts, each with what it asks at each step and
  the checks behind it, and how a project sets limits in its own linters with today's offenders
  marked in place.
- **`references/discovery.md`**:
  - lists who owns each rule the feature touches;
  - asks for a code-quality decision when the project has none;
  - rewrites "a file that grew too large" as a finding against the limits.
- **`references/spec.md`**: the new layout, the short stories, and the Details section. Decision
  rules each say how they are checked, and a decision's spec includes the task that adds its check.
  The risk tier table loses its plan review column. `#what-is-a-decision` and `#tests` keep their
  anchors.
- **`references/plan.md`**:
  - structural steps before behaviour for units over their limit;
  - complexity tracking also covers growth;
  - each test step names its break;
  - line 79 is rewritten.
- **`references/implementation.md`**:
  - the break caused and seen for each new test;
  - two verdicts from the task reviewer;
  - the final review's size report, in the pull request description;
  - a place for a second reviewer;
  - no fixed sleeps;
  - a ruling to change or delete a test;
  - lines 171 and 184 rewritten.
- **`references/approval.md`, `bug.md`, `finish.md`**: their references to the spec's sections
  follow the new layout.
- **Templates**:
  - the [spec](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md) in the new
    layout, with `plan-review: false`;
  - the [plan](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/plan.md) linking
    `spec.md#details`;
  - the [decision](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md), whose rules
    each say how they are checked;
  - the [constitution](/skills/uraeda/assets/templates/specs/CONSTITUTION.md), with principle III
    from [Constitution check](#constitution-check);
  - the [specs README](/skills/uraeda/assets/templates/specs/README.md).
- **The example**
  ([recurring tasks](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/)):
  - its spec in the new layout, with shorter stories;
  - its plan showing a structural step and named breaks;
  - its decisions saying how each rule is checked.
- **[`README.md`](/README.md)**: its description of the spec.

**The core and the tools**

- **`crates/core/src/files/spec.rs`, `items.rs`**: the folds and the plan-review default.
- **`packages/server/src/fate/sources.ts`, `packages/web/src/views.ts`**: select the new fields.
- **`packages/web/src/Blocks.tsx`**: a `folds` prop wraps each run of blocks in a `Collapsible`. The
  trigger is styled to the reading size, and the folds open when a hash link targets a block inside
  them.
- **`ReviewPage.tsx`, `DocumentPage.tsx`**: pass the spec's folds, and open those holding a pending
  comment or the selection.
- **`crates/cli/src/main.rs`**: the `--tier` help no longer says "true for high".

**The checks of this repository**

- **[`Cargo.toml`](/Cargo.toml) and a new `clippy.toml`**: `too_many_lines` and `excessive_nesting`
  on, at 100 lines and 4 levels; `too_many_arguments` stays at 7; `allow_attributes_without_reason`
  on.
- **[`vite.config.ts`](/vite.config.ts)**:
  - extends `@nkzw/oxlint-config`, pinned in the pnpm catalog, with its JS plugins;
  - `max-lines-per-function` 100, `max-lines` 500 outside tests, `max-params` 7, `max-depth` 4;
  - unused disable directives reported as errors.
- **A structural test** (`crates/cli/tests/structure.rs`, new): walks `crates/*/src`, skipping test
  modules' files and generated code. It fails on a Rust file over 500 lines that is not in its list,
  and on a listed file now under the limit, with a message saying how to fix each.
- **[`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts)**: fixtures for each new rule.
- **Today's offenders**:
  - marked in place, each with a reason: 3 Rust functions, 16 TypeScript functions, and the large
    files;
  - the fate config's autofixes applied in one structural commit;
  - its remaining violations either fixed or marked.

### Error handling

- **A spec without the folds' structure**, such as an old layout or a hand-written file, gets empty
  folds and shows in full.
- **The structural test** cannot read a file: it fails, naming the file.
- **A rule of `@nkzw/oxlint-config`** conflicts with an active decision, for example `no-console`
  against the server's logging: it is turned off in `vite.config.ts`, with the decision named next
  to it.

### Testing

**Core.** Rust tests run on the example and on small texts.

**Web.**

- The happy-dom tests drive the review and document pages on `fixtures/repo`, moved to the new
  layout.
- The browser tests drive the real app in WebKit at both sizes.
- Tests that tap a scenario open its toggle first.

**Checks.** The lint and structural checks are tested by fixtures that make each one fire.

**Lua.** The Neovim tests follow the moved lines of the example spec.

| What                                        | Test                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| US1.1, US1.2, SC-001                        | Web: the review page's toggles, closed then open, on the example                                                            |
| US1.3, Details holding a comment            | Web: a pending comment's fold is open, with Edit and Remove                                                                 |
| US1.4                                       | Browser: open folds survive Back                                                                                            |
| US1.5                                       | Browser: a link to `#data` opens Details and scrolls to it                                                                  |
| US1.6                                       | Web: the document page shows the same folds                                                                                 |
| US2.1, US2.2                                | Core `check.rs`: the example is clean; an old layout reports its problems                                                   |
| Folds' block ids, a story without scenarios | Core `items.rs`: table-driven over the example and small specs                                                              |
| US3.1 to US3.6, SC-002, SC-005              | Lint fixtures in `lint.test.ts`; `structure.rs` cases; clippy's limits shown once on a scratch function in the final review |
| SC-003                                      | `vp run ready` on the branch                                                                                                |
| US4, US5                                    | The example's plan and decisions, checked by `ura check` and the final review                                               |
| US6.1                                       | Web: approving at `high` keeps the switch off                                                                               |
| US6.2, US6.3                                | Core `proposal.rs` table, cli `review.rs`, lsp `reads.rs`, nvim `test_verdict.lua`                                          |
| US7.1, SC-004, US7.2                        | cli `skill.rs`: the character limit, and every command named                                                                |
