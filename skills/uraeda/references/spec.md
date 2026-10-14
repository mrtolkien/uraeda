# Spec and decisions

Turns the human's answers into a spec, the feature's behaviour and technical design, and the
decisions it proposes, for the human to approve together.

- **Runs when**: the latest round, `clarifications-NN.md`, is `answered`, and there is no `spec.md`
  or the spec's `clarifications` field is lower than `NN`; or `spec.md` is `changes-requested`
- **Writes**: `spec.md`, and new files in `specs/decisions/` or `## Proposed change` sections in
  existing ones
- **Ends at**: a human gate, `spec.md` with `status: awaiting-human`, or a new
  [discovery](discovery.md) round

Read this file in full before writing. In a design conversation, the agent would present the design
section by section, and the human would approve each one as it goes. Here, the human approves once,
in a file: the spec must be complete enough to approve with confidence, and fast to check.

## Overview

The spec says what the feature does and how it will be built, for a technical human to approve
before any code. It is the main review of the workflow: once it is approved, most features reach the
pull request without the human, since the plan follows the spec, and only the plans the human chose
to review when approving it wait for them. Anything the spec leaves vague, a later agent decides
alone.

The spec puts what the human approves first, and what the agents build from last:

- **Behaviour first**: user stories with acceptance scenarios, edge cases, and success criteria.
  They say what users get, with the exact values the tests will check.
- **Then the architecture and the mockups**: the approach, the main units, where each new rule
  lives, and the tradeoffs; and what users will see.
- **Then what the human must weigh**: the assumptions you made, the decisions the spec proposes or
  relies on, the constitution check, the risk tier, and whether the plan waits for a review.
- **Last, the details**: the data, the components, error handling, and testing, scaled to the
  feature. They say how the feature is built, at the level of components and data: file-by-file
  changes and implementation steps belong in the plan. The web UI folds them, with each story's
  scenarios, until the human opens them.

Decide the design: do not list possibilities. The questions already settled what needed the human;
everything else is yours to settle, and to state as an assumption the human can object to. YAGNI
ruthlessly: every part of the design serves a user story or an answer.

## Read the answers

Read every round's questions, answers, settled points, and **Notes:**, the latest last: later
answers win. A settled point the human objected to in an answer or a note follows them. An answer
can be:

- **One or more option letters.** Letters from options that exclude each other, when the question
  does not say they combine, are ambiguous: ask again in a new round.
- **Free text, alone or after letters**: the human's own answer, which wins over the option's
  wording. When it can be read more than one way, either ask again in a new round, with your reading
  as the recommended answer, or, when the readings differ little, pick one and say so in the spec's
  `> [!IMPORTANT]` block.

A follow-up like `Q2.B` only needs an answer if the human picked that letter in its parent: ignore
it otherwise. The workflow only moves on once every other question is answered: see
[Coming back to the human](../SKILL.md#coming-back-to-the-human) for blank answers.

Turn the answered round's `> [!IMPORTANT]` block into a record, as described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human), in the same commit as the spec.

## Is the scope clear?

Start a new round, following [Discovery](discovery.md), when an answer raises a new unknown, when an
answer is ambiguous in a way that matters, or when the human asked for more options. Otherwise,
propose the decisions, then write the spec.

## Propose decisions

### What is a decision

A decision records a choice a human made that agents must follow across the codebase, but would not
reliably make on their own. The ledger is the current state of what the human wants: it grows as the
project grows, and decisions change when the human changes their mind.

An answer becomes a decision only if it passes all three tests:

1. **An agent would not guess it.** A capable agent, reading the code and the constitution, could
   reasonably do something else. If any agent would do it anyway, it is noise.
2. **It outlives the feature.** It shapes future work, not only this feature. Behaviour inside one
   feature goes in the spec. A rule that the code already enforces, with types, a schema, or a lint
   rule, is recorded by the code.
3. **Getting it wrong is costly**: inconsistent code, a hard migration, a rewrite, a look and feel
   that drifts.

Typical decisions: how the code is organized, dependencies, the technical approach to a problem,
visual direction, cross-cutting conventions (errors, dates, logging), and transitions, like two
implementations kept side by side during a trial.

Most features produce no decision, or one. If a feature produces three, check whether they restate
the spec. A low-impact choice made inside the feature is not a decision: it is an assumption in the
spec, or a ruling in `rulings.md` during the plan and the implementation.

### New decision or change

Decisions are named after the question they answer, not the answer: `due-dates.md`, not
`due-dates-are-calendar-days.md`. A name built from the answer becomes wrong at the first change.

First, look for an existing decision on the same topic.

- **None**: write a new file from
  [the template](../assets/templates/specs/decisions/decision-topic.md), with `status: proposed`, an
  empty `approved-by`, and consequences in the future tense.
- **One exists**: never edit its active text before approval, since other work relies on it. Add a
  `## Proposed change (<spec folder>)` section at the end of the file instead, from the template's
  skeleton: who proposes it (a link to the spec), the change in a sentence or two, **every rule of
  the decision as it would read after the change** (not only the new ones), why, with links to the
  question and discovery topic, and each consequence that changes. On approval, this section
  replaces the decision's text. To remove a decision, propose the change "Delete this decision",
  with the reason.

### Writing a decision

Write for a reviewer who has not read the discovery:

- **Title**: the topic.
- **Summary**: the choice and what it means for the project, in two or three plain sentences.
- **Rules**: MUST, SHOULD, and MUST NOT rules that a spec, a plan, or code can be checked against.
  Plans copy them word for word, so write each rule to stand on its own.
- **Why**: the problem and what the choice optimizes for, with links to the question and the
  discovery topic. Once the feature is [finished](finish.md#rewrite-the-links), these links point to
  its record, where the question keeps its anchor.
- **Consequences**: what becomes easier, what becomes harder, the costs accepted.
- **Applies to**: links to the code, folders, or kinds of features it governs, so agents find the
  decisions relevant to what they touch.

Two sections are optional, at their place in the template. Leave them out unless they apply:

- **Alternatives considered**: only the rejected options that were close calls, one line each. When
  a change reverses an earlier choice, always list the earlier choice and why it was abandoned, so
  no agent proposes it again.
- **Revisit when**: a condition or a date that ends a temporary decision, for example "when the new
  solver matches the old one on the benchmark for 4 weeks".

## Spec document

Use [the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md). Every spec has this
frontmatter and these sections, in this order:

```markdown
---
status: awaiting-human
revision: 1
clarifications: [the latest round included]
risk-tier: [low | medium | high]
plan-review: false
---

# Spec: [Feature name]

> [!IMPORTANT]
>
> Spec to review, about [M] minutes.
>
> - [What most needs attention]

[One paragraph: what the feature does, for whom, and why, with links to the proposal, discovery, and
clarifications.]

## User stories

### US1: [Title] (P1)

## Edge cases

## Success criteria

## Architecture

## Mockups

## Assumptions

## Decisions

## Constitution check

## Risk tier

## Details

### Data

### Components

### Error handling

### Testing
```

`## Mockups` is left out when the feature has no UI work.

The `> [!IMPORTANT]` block, as described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human): how long the review takes, then
what most needs attention, one line each: the new and changed decisions, the answers you read one
way among several, the riskiest assumptions, the risk tier and whether the plan waits for a review,
and any cost or migration. On a revision, what changed since the last review.

## Behaviour

**User stories**, ranked by priority (P1, P2, ...):

- Each one is a slice of the feature that can be shipped and tested on its own: a user could get
  value from P1 alone.
- A short description of the user's journey, in plain language, in one or two sentences, then "Why
  this priority". The rest of the story is in its scenarios.
- Acceptance scenarios written as **Given** / **When** / **Then**, with exact values: "a weekly task
  due Monday the 5th", "it is due Monday the 12th", never "the next week". The plan's tests use them
  as written, and the implementation must test each one.
- Every answer of the questions that changes behaviour shows up in a scenario.

**Edge cases**: the inputs and situations at the boundary, each with what happens: an empty field, a
month end, a failed save, an existing action that meets the feature (undo, delete, edit). The
discovery's **The proposal's path and existing actions** section is a starting list.

**Success criteria** (SC-001, ...): measurable outcomes, each one checkable by a test or a
benchmark: "Setting a preset repeat takes two clicks from the open task", not "Setting a repeat is
easy".

## Architecture

The architecture is what the human approves of the build: the chosen approach and why, in a few
sentences, linking to the decisions and discovery topics behind it; the main units; where each new
rule lives; and the tradeoffs. It names the units, and the details describe them.

Design for isolation and clarity:

- Break the feature into smaller units that each have one clear purpose, communicate through
  well-defined interfaces, and can be understood and tested independently.
- For each unit, the details say what it does, how it is used, and what it depends on.
- Can someone understand what a unit does without reading its internals? Can its internals change
  without breaking its consumers? If not, the boundaries need work.
- Smaller, well-bounded units are also easier for agents to work with: they reason better about code
  they can hold in context at once, and their edits are more reliable when files are focused.

Working in the existing codebase:

- Follow the patterns the discovery found.
- Where existing code has problems that affect the feature, like a file that has grown too large,
  unclear boundaries, or tangled responsibilities, include targeted improvements in the design, the
  way a good developer improves code they work in.
- Do not propose unrelated refactoring. Stay focused on what serves the feature.

## Mockups

Any UI work requires mockups: a new screen, a new control, or a visible change to an existing one.
The human approves what users will see, not a description of it, and the implementation follows it.
Put them in `mockups/`, next to the spec, and link each one from the spec's `## Mockups` section.

The format is yours: use whatever shows the change best, and is quickest for the human to check. For
example, a static HTML page when layout or interaction matters, an SVG for a single screen or
component, a generated image when the look matters more than the exact layout, or code, when the UI
is simple to build: a small component in the project's own stack, that the human can run or read.

Show every state the user stories name, like an open menu, an empty list, or an error, with the
exact text the spec fixes. A mockup shows what users see: the spec's text stays the reference for
behaviour, and wins when the two disagree.

## What the human weighs

- **Assumptions**: first the points settled in the clarifications, then what you settled yourself
  while writing the spec, so the human can object. An assumption that changes what users get is also
  an item of the `> [!IMPORTANT]` block.
- **Decisions**: grouped as "New, applied when this spec is approved", "Changed", and "Relied on",
  each with a sentence: the rule for new ones, the change for changed ones, how the spec follows the
  others. Only the decisions that apply to the feature, not the whole ledger. Approving the spec
  applies the new decisions and changes.
- **Constitution check**: a table with one row per principle, all of them: principles always apply.
  Decisions are not part of it. A conflict goes back to the human as a new round of questions,
  following [Discovery](discovery.md). A decision that must give way gets a proposed change, and a
  constitution exception the human accepted is named here and spelled out in the plan.
- **Risk tier**: see below.

## Risk tier

The tier tells the human how much the feature can break. Propose it in the frontmatter, with a
one-line reason for it in the spec. The human decides it when approving the spec.

| Tier     | Typical features                                          |
| -------- | --------------------------------------------------------- |
| `low`    | No data format change, no new table, no new interface     |
| `medium` | Small data format changes, minimal UI, low impact         |
| `high`   | Security changes, new complex data structures or services |

`plan-review` says whether the plan waits for the human's review before the implementation. It is
`false` by default, whatever the tier: propose `false`. The plan waits only when the human turns
plan review on when approving the spec, or when the plan lists a constitution exception. A spec with
no `plan-review` has `false`.

- When unsure between two tiers, propose the higher one. A change to the format of data users
  already have is at least `medium`; converting every saved record is `high`.

## Details

The details are what the agents build from. Scale each part to the feature: a few sentences when it
is straightforward, up to a few hundred words when it is nuanced.

- **Data**: what is stored or changes, with exact types, the rules that apply to it, and how it
  flows between components. Data comes before components, so types are defined before they are used.
- **Components**: the units the feature adds or changes, with the exact strings users see.
- **Error handling**: what can fail, and what the user sees, with the exact text when the spec fixes
  it.
- **Testing**: see [Tests](#tests).

## Tests

Test the feature the way a user or a caller uses it: integration tests, through the real components
and an in-memory store, with the clock set by the test. They survive refactoring, where unit tests
of internal functions break, and an agent writes them quickly.

- Tests are part of the codebase: organize them with the same care as the main code. Create the
  helpers, fixtures, and fakes the tests need (rendering the app, seeding the store, setting the
  clock), in shared files, so that each test holds no boilerplate.
- Readability is a key feature of a test: each one is short and readable by a human, Arrange, Act,
  Assert, in that order, with a name that states the scenario. Test files stay short.
- Write unit tests only for pure logic with many cases, as one table-driven test: one row per case.

The spec's **Testing** section opens with a sentence on how the integration tests run, then a table
mapping every acceptance scenario, edge case, and success criterion to its test.

## Spec frontmatter

- `status`: `awaiting-human` when you submit it.
- `revision`: `1` for the first spec, then one more at every change, by you or by the human.
- `clarifications`: the number of the latest round the spec includes, so the next agent knows
  whether a newer round is answered.
- `risk-tier` and `plan-review`: see above.

## Self-review

Before committing, read the spec again with fresh eyes, and fix what you find inline:

1. **Placeholders**: no `TBD`, `TODO`, `[NEEDS CLARIFICATION]`, empty section, or vague requirement.
   Open questions go back to [discovery](discovery.md).
2. **Answers**: every answer and settled point shows up in the spec, the human's own words included,
   and nothing in the spec contradicts one.
3. **Consistency**: no section contradicts another; every UI change has a mockup; the architecture
   and the details deliver every user story; the data supports every edge case, over two consecutive
   occurrences when it repeats; the Testing table covers every scenario, edge case, and success
   criterion.
4. **Scope**: the spec fits a single plan. If it does not, start a new round, following
   [Discovery](discovery.md), with a question proposing the split, the recommended split as option
   A. Answered rounds are never edited.
5. **Ambiguity**: a requirement that can be read two ways is rewritten to say one.
6. **Linear reading**: nothing is referred to before it is introduced, and the block names subjects.
7. **Decisions**: each new one passes the three tests, and each changed one lists every rule after
   the change.

## Red flags

| Thought                                                       | Reality                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| "I'll list the options, the human picks during review"        | The questions are over. Decide the design, and state what you settled as assumptions.               |
| "The plan will figure out the details"                        | The plan argues from the spec. A detail the spec leaves vague, a later agent decides alone.         |
| "Next week is close enough for a scenario"                    | Scenarios carry exact values: the tests copy them as written.                                       |
| "This answer could mean two things, I'll take the likely one" | Pick it only if the readings differ little, and say so in the block. Otherwise, ask in a new round. |
| "Every important choice deserves a decision"                  | Only what an agent would not guess, that outlives the feature, and that is costly to get wrong.     |
| "The details are the plan's job"                              | The details are the spec's job: components and data. Files and steps are the plan's.                |

## Revising

The spec is amended in place: it stays the single source of truth for the implementation.

- **`changes-requested`**: read `spec-review.md`, its comments and its summary; each line comment
  quotes the lines it is about, as they were at the review's `commit`. If the feedback asks for more
  options or raises a new question, start a new round, following [Discovery](discovery.md).
  Otherwise, apply the feedback, and update the proposed decisions it affects. Turn the previous
  block into a record of the request, as described in
  [Coming back to the human](../SKILL.md#coming-back-to-the-human). The new block says how each
  comment was handled: "C1: done", "C2: declined, because ...". Leave the review file as it is: the
  next review replaces it.
- **A newer round is answered**: read its answers, propose their decisions, and amend the spec.

Increase `revision`, set `clarifications` to the latest round, and set `status: awaiting-human`
again. The `> [!IMPORTANT]` block says what changed since the last review.

With `ura`, run `ura check` on the feature's folder before committing.

## Commit

Commit the spec and its decisions together: `spec(<slug>): <feature name>`, or what changed when
revising. The commit message body is the first line of the block, for example "Spec to review, about
15 minutes." Then stop at the gate.
