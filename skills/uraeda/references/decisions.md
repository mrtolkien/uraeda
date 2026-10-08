# Decisions

Turns the human's answers into proposed decisions, then decides whether the scope is clear.

- **Runs when**: `clarifications.md` is `answered` and newer than `spec.md`, or there is no
  `spec.md`
- **Writes**: new files in `specs/decisions/`, or `## Proposed change` sections in existing ones
- **Ends at**: the [spec](spec.md) step, or a new [research](research.md) round

## Read the answers

Read the latest session of `clarifications.md`. An answer can be:

- An option letter
- `yes`: the recommended answer
- Free text: the human's own answer. When it is ambiguous, ask again in the next session, with your
  reading of it as the recommended answer.
- Empty: the question is still open

## What is a decision

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

## New decision or change

Decisions are named after the question they answer, not the answer: `due-dates.md`, not
`due-dates-are-calendar-days.md`. A name built from the answer becomes wrong at the first change.

First, look for an existing decision on the same topic.

- **None**: write a new file from
  [the template](../assets/templates/specs/decisions/decision-topic.md), with `status: proposed`.
- **One exists**: never edit its active text before approval, since other work relies on it. Add a
  `## Proposed change (<spec folder>)` section at the end of the file instead, linking to the spec.
  Describe the change, and write the new or changed rules in full. To remove a decision, propose the
  change "Delete this decision", with the reason.

## Writing a decision

Write for a reviewer who has not read the research:

- **Title**: the topic
- **Summary**: the choice and what it means for the project, in two or three plain sentences
- **Rules**: MUST, SHOULD, and MUST NOT rules that a spec, a plan, or code can be checked against
- **Why**: the problem and what the choice optimizes for, with links to the question and the
  research
- **Consequences**: what becomes easier, what becomes harder, the costs accepted
- **Applies to**: links to the code, folders, or kinds of features it governs, so agents find the
  decisions relevant to what they touch

Two sections are optional. Leave them out unless they apply:

- **Alternatives considered**: only the rejected options that were close calls, one line each. When
  a change reverses an earlier choice, always list the earlier choice and why it was abandoned, so
  no agent proposes it again.
- **Revisit when**: a condition or a date that ends a temporary decision, for example "when the new
  solver matches the old one on the benchmark for 4 weeks"

## Is the scope clear?

Go back to [research](research.md) when questions are still open, when an answer raises a new
unknown, or when the human asked for more options. Otherwise, continue to the [spec](spec.md).

## Commit

Commit the decisions: `decision(<number>): propose <summary>`. Then run the next step.
