# Spec and decisions

Turns the human's answers into proposed decisions and a spec, for the human to approve together.

- **Runs when**: `clarifications.md` is `answered` and newer than `spec.md` (or there is no spec
  yet), or `spec.md` is `changes-requested`
- **Writes**: `spec.md`, and new files in `specs/decisions/` or `## Proposed change` sections in
  existing ones
- **Ends at**: a human gate, `spec.md` with `status: awaiting-human`, or a new
  [discovery](discovery.md) round

## Read the answers

Read the latest session of `clarifications.md`. An answer can be:

- An option letter
- `yes`: the recommended answer
- Free text: the human's own answer. When it is ambiguous, ask again in the next session, with your
  reading of it as the recommended answer.
- Empty: the question is still open

## Is the scope clear?

Go back to [discovery](discovery.md) when questions are still open, when an answer raises a new
unknown, or when the human asked for more options. Otherwise, propose the decisions, then write the
spec.

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
the spec.

### New decision or change

Decisions are named after the question they answer, not the answer: `due-dates.md`, not
`due-dates-are-calendar-days.md`. A name built from the answer becomes wrong at the first change.

First, look for an existing decision on the same topic.

- **None**: write a new file from
  [the template](../assets/templates/specs/decisions/decision-topic.md), with `status: proposed`.
- **One exists**: never edit its active text before approval, since other work relies on it. Add a
  `## Proposed change (<spec folder>)` section at the end of the file instead, linking to the spec.
  Describe the change, and write the new or changed rules in full. To remove a decision, propose the
  change "Delete this decision", with the reason.

### Writing a decision

Write for a reviewer who has not read the discovery:

- **Title**: the topic
- **Summary**: the choice and what it means for the project, in two or three plain sentences
- **Rules**: MUST, SHOULD, and MUST NOT rules that a spec, a plan, or code can be checked against
- **Why**: the problem and what the choice optimizes for, with links to the question and the
  discovery topic
- **Consequences**: what becomes easier, what becomes harder, the costs accepted
- **Applies to**: links to the code, folders, or kinds of features it governs, so agents find the
  decisions relevant to what they touch

Two sections are optional. Leave them out unless they apply:

- **Alternatives considered**: only the rejected options that were close calls, one line each. When
  a change reverses an earlier choice, always list the earlier choice and why it was abandoned, so
  no agent proposes it again.
- **Revisit when**: a condition or a date that ends a temporary decision, for example "when the new
  solver matches the old one on the benchmark for 4 weeks"

## Write `spec.md`

Use [the template](../assets/templates/specs/000-feature-name/spec.md). The spec says what the
feature does and how it will be built, for a technical human to approve before any code. It is the
main review of the workflow: once it is approved, most features reach the pull request without the
human. Make it complete enough to approve with confidence, and fast to check: precise, without
filler, with the design decided rather than listing possibilities.

Open the spec with the `> [!IMPORTANT]` block described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human): how long the review takes, then
what most needs attention, such as the new and changed decisions, the riskiest assumptions, the risk
tier, and any cost or migration. On a revision, say what changed since the last review.

- **User stories**, ranked by priority (P1, P2, ...). Each one can be shipped and tested on its own,
  and has acceptance scenarios written as Given / When / Then. The implementation must test each
  scenario.
- **Edge cases**
- **Success criteria** (SC-001, ...), measurable
- **Design**, each part scaled to the feature: a few sentences when it is simple, up to a few
  hundred words when it is not.
  - **Approach**: the chosen approach and why, linking to the decisions and discovery topics
  - **Components**: the units the feature adds or changes. Each has one clear purpose: say what it
    does, how it is used, and what it depends on. Follow the existing patterns found in discovery.
    Include targeted fixes to existing code when it is in the way, but no unrelated refactoring.
  - **Data**: what is stored or changes, and how data flows between the components
  - **Error handling**: what can fail, and what the user sees
  - **Testing**: how the acceptance scenarios and success criteria are tested
- **Assumptions**: what you settled yourself, so the human can object
- **Decisions**: links to the new decisions and proposed changes, then to the active decisions the
  spec relies on. Approving the spec applies the new decisions and changes.
- **Constitution check**: how the spec complies with each principle and each relevant active
  decision. A conflict cannot be approved: it goes back to [discovery](discovery.md) as a question.
- **Risk tier**: see below

The design stays at the level of components and data: file-by-file changes and implementation steps
belong in the plan. When a visual direction matters, add a mockup next to the spec and link it.

## Self-review

Before committing, read the spec again with fresh eyes, and fix what you find:

1. **Placeholders**: no `TBD`, `TODO`, `[NEEDS CLARIFICATION]`, empty section, or vague requirement.
   Open questions go back to [discovery](discovery.md).
2. **Consistency**: no section contradicts another, and the design delivers every user story.
3. **Scope**: the spec fits a single plan. If it does not, propose splitting the feature in the
   clarifications.
4. **Ambiguity**: a requirement that can be read two ways is rewritten to say one.

## Risk tier

The tier decides whether the human reviews the plan. Propose it in the frontmatter, with a one-line
reason in the spec.

| Tier     | Plan review                          | Typical features                                          |
| -------- | ------------------------------------ | --------------------------------------------------------- |
| `low`    | none, the plan is auto-approved      | No data format change, no new table, no new interface     |
| `medium` | chosen by the human, none by default | Small data format changes, minimal UI, low impact         |
| `high`   | required                             | Security changes, new complex data structures or services |

- For `medium`, add `plan-review: false`.
- When unsure between two tiers, propose the higher one.

## Revising

When `spec.md` is `changes-requested`, read its `## Review` section.

- If the feedback asks for more options or raises a new question, go to [discovery](discovery.md).
- If a newer clarification session was answered since the review, read its answers and propose their
  decisions first.
- Otherwise, apply the feedback, update the proposed decisions it affects, and remove the
  `## Review` section: git keeps it.

Set `status: awaiting-human` again.

## Commit

Commit the spec and its decisions together: `spec(<number>): <feature name>`, or what changed when
revising. The commit message body is the first line of the block, for example "Spec to review, about
15 minutes." Then stop at the gate.
