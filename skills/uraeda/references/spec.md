# Spec and decisions

Turns the human's answers into a spec, the feature's behaviour and the big picture of its build. The
human approves it with the decisions the answers ask for.

- **Runs when**: the latest round, `clarifications-NN.md`, is `answered`, and there is no `spec.md`
  or the spec's `clarifications` field is lower than `NN`; or `spec.md` is `changes-requested`
- **Writes**: `spec.md`; `data-model.md` when the feature changes stored data or a file format; and
  decisions in `specs/decisions/`, new or edited in place on the branch
- **Ends at**: a human gate, `spec.md` with `status: awaiting-human`, or a new
  [discovery](discovery.md) round

Read this file in full before writing. In a design conversation, the agent would present the design
section by section, and the human would approve each one as it goes. Here, the human approves once,
in a file: the spec must be complete enough to approve with confidence, and fast to check.

## Overview

The spec says what the feature does and how it will be built, for a technical human to approve
before any code. It is the main review of the workflow. Once it is approved, most features reach the
pull request without the human, since the plan follows the spec. Only the plans the human chose to
review when approving it wait for them. Anything the spec leaves vague, a later agent decides alone.

The spec is a page the human approves in one sitting, without opening anything else. In order:

- **What they approve**: the block, with the time it takes, a "You approve" sentence, and what most
  needs their attention.
- **Their last review, answered**: on a revision, each comment with what was done about it.
- **The decisions**: the new, changed, and removed ones, then those the spec relies on. They come
  first because they outlive the feature.
- **The user stories**: what users get, each with its mockup and its key scenarios, exact values
  included.
- **How it is built, and its limits**: the architecture's units, the edge cases, the success
  criteria, and the assumptions.
- **What the human weighs last**: the constitution check and the risk tier, then the history of
  earlier reviews.

The data the feature stores, or a file format it changes, goes to `data-model.md`, reviewed with the
spec. Components, error handling, and the tests are the plan's: the spec says what users get, and
the architecture's units. File-by-file changes and implementation steps belong in the plan.

Decide the design: do not list possibilities. The questions already settled what needed the human;
everything else is yours to settle, and to state as an assumption the human can object to. YAGNI
ruthlessly: every part of the design serves a user story or an answer.

## Read the answers

Read every round's questions, answers, settled points, and **Notes:**, the latest last: later
answers win. A settled point the human objected to in an answer or a note follows them. A bullet of
the notes starting with a settled point's bold subject, `- **<subject>**: <comment>`, is the human's
answer to that point. An answer can be:

- **One or more option letters**, at the answer's start, joined by `, `, `and`, or `, and `, and
  ended by `:`, `,`, `.`, or the end: "B", "A and C: ...". "C but with napi-rs" names no letter.
  Letters from options that exclude each other, when the question does not say they combine, are
  ambiguous: ask again in a new round.
- **Free text, alone or after letters**: the human's own answer, which wins over the option's
  wording. When it can be read more than one way, either ask again in a new round, with your reading
  as the recommended answer. Or, when the readings differ little, pick one and say so in the spec's
  `> [!IMPORTANT]` block. An answer without a letter closes the question's follow-ups.

A follow-up like `Q2.B` only needs an answer if the human picked that letter in its parent: ignore
it otherwise. The workflow only moves on once every other question is answered: see
[Coming back to the human](../SKILL.md#coming-back-to-the-human) for blank answers.

Turn the answered round's `> [!IMPORTANT]` block into a record, as described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human), in the same commit as the spec.

## Is the scope clear?

Start a new round, following [Discovery](discovery.md), when an answer raises a new unknown or is
ambiguous in a way that matters. Start one too when the human asked for more options. A folder from
an [upgraded change](change.md#upgrading) has rounds with no discovery file, that settled the
change, not the feature's scope: start a new round for it. Otherwise, write the decisions the
answers ask for, then the spec.

## Propose decisions

### What is a decision

A decision records a choice a human made that agents must follow across the codebase, but would not
reliably make on their own. The ledger is the current state of what the human wants. It grows as the
project grows, and decisions change when the human changes their mind.

An answer becomes a decision only if it passes all four tests:

1. **An agent would not guess it.** A capable agent, reading the code and the constitution, could
   reasonably do something else. If any agent would do it anyway, it is noise.
2. **It outlives the feature.** It shapes future work, not only this feature. Behaviour inside one
   feature goes in the spec. A rule that the code already enforces, with types, a schema, or a lint
   rule, is recorded by the code.
3. **Getting it wrong is costly**: inconsistent code, a hard migration, a rewrite, a look and feel
   that drifts.
4. **Intent, not mechanism.** It states the human's goal or approach, not a value the code holds: a
   flag, a timeout, a file name, a size, a version, an exit code. The code, its configuration, and
   its checks hold those, and change them without the human. A rule keeps a value only when the
   human chose that value, and its **Why** then links the answer.

Examples:

- An answer "harnesses must not use CLI flags" names a mechanism. It is an assumption of the spec,
  not a decision.
- An answer "agents never run with permissions skipped" is a boundary. It is a decision, and its
  rule is written without the flag's name.
- An answer "a session lasts 30 days" is a value the human chose. The rule keeps the 30 days, and
  the **Why** links the answer.

Typical decisions: how the code is organized, dependencies, the technical approach to a problem, and
visual direction. Others are cross-cutting conventions (errors, dates, logging), and transitions,
like two implementations kept side by side during a trial.

A decision is created, changed, or removed only from a question the human answered, or a review
comment asking for it. The human approves every line of the ledger, so no decision starts from your
own judgment. A choice you think deserves one goes back to the human as a question in a new round,
following [Discovery](discovery.md). A low-impact choice made inside the feature is not a decision.
It is an assumption in the spec, or a ruling in `rulings.md` during the plan and the implementation.

### New decision or change

Decisions are named after the question they answer, not the answer: `due-dates.md`, not
`due-dates-are-calendar-days.md`. A name built from the answer becomes wrong at the first change.

First, look for an existing decision on the same topic.

- **None**: write a new file from
  [the template](../assets/templates/specs/decisions/decision-topic.md), with `status: proposed`, an
  empty `approved-by`, and consequences in the future tense.
- **One exists**: edit it in place, on the feature's branch, as it should read after the change. Set
  `status: proposed` and empty `approved-by`. The default branch and every other branch keep the
  active text until this one merges. A change that reverses an earlier choice lists that choice
  under **Alternatives considered**, with why it was abandoned, so no agent proposes it again.
- **To remove one**: delete its file on the branch. Its item in the spec names it without a link,
  since the file is gone.

The human sees each change as the difference between the decision on the branch and at the merge
base with the default branch. Uraeda draws it in place, and `git diff` shows it without Uraeda. The
approval step activates each listed decision: see [Approval](approval.md).

### Writing a decision

Write for a reviewer who has not read the discovery, as [a decision](writing.md#a-decision) in
Writing for the human says:

- **Title**: the topic.
- **Icon**: in the frontmatter, the name of a [Lucide](https://lucide.dev/icons/) icon that shows
  the topic, like `git-branch`. The web UI draws it beside the title, and a default icon for a name
  it does not know. It is optional.
- **Intent**: before `## Rules`, two or three plain sentences: the choice and what it protects.
  Specifics appear only where they are hard constraints.
- **Rules**: MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY rules that a spec, a plan, or code can be
  checked against. Each rule is the human's goal or approach, not a value the code holds (the fourth
  test of [what is a decision](#what-is-a-decision)). Each rule is one sentence that stands on its
  own, since plans copy it word for word. It ends with how it is checked: a lint, a test,
  `ura check`, or "Checked by review." Rules come strongest first, at most 10. A check a tool could
  run but does not yet becomes a line of the plan's test map, and a task. See
  [rules enforced by tools](code-quality.md#rules-enforced-by-tools).
- **Why**: the problem and what the choice optimizes for, with links to the question and the
  discovery topic. Once the feature is [finished](finish.md#rewrite-the-links), these links point to
  its record, where the question keeps its anchor. The history and the investigation stay in that
  record.
- **Consequences**: what becomes easier, what becomes harder, the costs accepted.
- **Applies to**: links to the code, folders, or kinds of features it governs, so agents find the
  decisions relevant to what they touch.

Two sections are optional, at their place in the template. Leave them out unless they apply:

- **Alternatives considered**: only the rejected options that were close calls, one line each. When
  a change reverses an earlier choice, always list the earlier choice and why it was abandoned.
- **Revisit when**: a condition or a date that ends a temporary decision. For example, "when the new
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
> - You approve [what the feature does, in one sentence].
> - [What most needs attention]

[One paragraph: what the feature does, for whom, and why, with links to the proposal, discovery, and
clarifications.]

## Your review

## Decisions

## User stories

### US1: [Title] (P1)

## Architecture

## Edge cases

## Success criteria

## Assumptions

## Constitution check

## Risk tier

## History
```

`## Your review` is left out at revision 1. `## History` is left out until a revision has an earlier
review's record. `ura check` reports a section out of this order as `sections.order`, and a section
the template does not have as `sections.unknown`.

Write the spec as [Writing for the human](writing.md#every-document) says for every document, and as
[a spec](writing.md#a-spec) adds: the block's items, its time, and the spec's length.

## What the human approves

The `> [!IMPORTANT]` block, as described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human), opens with how long the review
takes. Its first item starts "You approve", and says in one sentence what approving commits to. Then
what most needs attention, one line each:

- the new, changed, and removed decisions;
- the answers you read one way among several;
- the riskiest assumptions, and outside behaviour not verified yet;
- a relaxed guard, as what an attacker could do;
- the risk tier, whether the plan waits for a review, and a tension with the constitution;
- any cost or migration.

On a revision, what changed since the last review. At most 7 items in all.

## The spec's decisions

`## Decisions` lists the decisions this spec creates, changes, or removes, one item each:

```markdown
- **New: [Due dates](../decisions/due-dates.md)**. Due dates are calendar days, without a time.
- **Changed: [Task storage](../decisions/task-storage.md)**. An upgrade keeps every earlier version.
- **Removed: Sync** (`sync.md`). The app stays local-only, as you chose.
```

The sentence says the rule for a new decision, what changed for a changed one, and why for a removed
one. Only these items count as listed: the approval step activates the decisions they name.

Then the paragraph "Relied on:", and a table of the active decisions the spec follows. It has two
columns: the decision, linked, and what it means for this spec. Only the decisions that apply to the
feature, not the whole ledger.

## User stories

Stories are ranked by priority (P1, P2, ...). Each is a slice of the feature that can be shipped and
tested on its own: a user could get value from P1 alone. A story holds, in order:

- **Its journey**: the user's path, in plain language, in one or two sentences.
- **Its mockup**: a story link alone in its paragraph, for a story with UI work. See
  [Mockups](#mockups).
- **"Why this priority:"**: only when the order is not obvious from the journeys.
- **"Key scenarios:"**: a numbered list of two or three scenarios, the ones that show the story
  best.
- **"More scenarios:"**: optional, the other scenarios. The web UI folds them, and they do not count
  in the spec's reviewed part.

Scenarios are written as **Given** / **When** / **Then**, with exact values. Write "a weekly task
due Monday the 5th", "it is due Monday the 12th", never "the next week". Each has at most 4 steps.
The plan's tests use them as written, and the implementation must test each one. Every answer of the
questions that changes behaviour shows up in a scenario.

## Mockups

Any UI work requires mockups: a new screen, a new control, or a visible change to an existing one.
The human approves what users will see, not a description of it, and the implementation follows it.
Each mockup sits in the story it illustrates, alone in its paragraph after the journey.

Show every state the user stories name, like an open menu, an empty list, or an error, with the
exact text the spec fixes. A mockup shows what users see: the spec's text stays the reference for
behaviour, and wins when the two disagree.

**With an active preview decision**, `specs/decisions/preview.md`, mockups are Storybook stories,
written where the decision says: one export per state. Embed each one by a
[story link](conventions.md#markdown) alone in its paragraph: Uraeda shows the story there, live, at
a phone's width and a desktop's.

```markdown
[Repeat menu, open](/src/tasks/RepeatMenu.stories.tsx#Open)
```

Before linking a story, set the worktree up as the project's git decision asks, like its install. A
new worktree has none of its dependencies, and its Storybook does not start without them. Then check
that each story you link renders, in Uraeda or with the decision's `preview-command`.

Story links need Storybook's Vite builder, which the decision requires. After a
[visual question](discovery.md#visual-questions), the spec's commit keeps the picked variant's
export and deletes the others, so the spec embeds the picked one.

**Without one**, put the mockups in `mockups/`, next to the spec, and link each one from its story.
The format is yours: use whatever shows the change best, and is quickest for the human to check. For
example:

- a static HTML page when layout or interaction matters
- an SVG for a single screen or component
- a generated image when the look matters more than the exact layout
- code, when the UI is simple to build: a small component in the project's own stack, that the human
  can run or read

## Architecture

The architecture is what the human approves of the build: the big picture, never the components'
details. It opens with the chosen approach and why, in a few sentences, linking to the decisions and
discovery topics behind it. Then one item per unit, its name in bold, saying what it does and the
rules it owns ([one home per rule](code-quality.md#one-home-per-rule)):

```markdown
- **The repeat rule** computes the next due date from a pattern. It owns the month-end rule.
```

Then the paragraph "Tradeoffs:", and one item per cost the approach accepts.

Design for isolation and clarity:

- Break the feature into smaller units that each have one clear purpose, communicate through
  well-defined interfaces, and can be understood and tested independently.
- Can someone understand what a unit does without reading its internals? Can its internals change
  without breaking its consumers? If not, the boundaries need work.
- Smaller, well-bounded units are also easier for agents to work with. They reason better about code
  they can hold in context at once, and their edits are more reliable when files are focused.

Working in the existing codebase:

- Follow the patterns the discovery found.
- Existing code may have problems that affect the feature, like a unit over the project's limits,
  unclear boundaries, or tangled responsibilities. Include targeted improvements in the design, the
  way a good developer improves code they work in
  ([extract, don't grow](code-quality.md#extract-dont-grow)).
- Do not propose unrelated refactoring. Stay focused on what serves the feature.

## Edge cases and success criteria

**Edge cases** are the inputs and situations at the boundary, each with what happens. For example,
an empty field, a month end, a failed save, or an existing action that meets the feature (undo,
delete, edit). An error the user sees is an edge case, with its exact text. The discovery's **The
proposal's path and existing actions** section is a starting list. They form a table, most important
first:

```markdown
| Importance | Situation                  | What happens                         |
| ---------- | -------------------------- | ------------------------------------ |
| High       | A save fails on completion | the task keeps its previous due date |
```

Rate each one: high when it can lose data or mislead the user, niche when few users meet it, normal
otherwise. `ura check` reports any other importance as `edges.importance`. The web UI folds the
niche ones.

**Success criteria** are measurable outcomes, each one checkable by a test or a benchmark. Write
"Setting a preset repeat takes two clicks from the open task", not "Setting a repeat is easy". Each
is an item, its id in bold, then its measure in a few words in parentheses, optional:

```markdown
- **SC-001** (two clicks): Setting a preset repeat takes two clicks from the open task.
```

## What the human weighs

- **Assumptions**: a sentence linking the points settled in the clarifications, which hold as
  written there. It names only those an answer or a note changed. Then "Settled while writing this
  spec:", and what you settled yourself, so the human can object. An assumption that changes what
  users get is also an item of the `> [!IMPORTANT]` block.
- **Unverified**: a story that relies on outside behaviour nobody has checked yet, as the
  [discovery](discovery.md#investigate-in-depth) found it, is marked unverified in the block. The
  block gives what the plan's first task checks and what happens to the story if the check fails.
- **Relaxed guards**: a design that loosens a security rule, an origin check, a permission, or a
  sandbox says so in the block. The block says what an attacker could then do, in one sentence, not
  as a mechanism.
- **Constitution check**: a one-row table, one column per principle, all of them: principles always
  apply. Each cell is ✅, or ⚠️ for a tension. Then one line per tension, saying what it costs.
  Decisions are not part of it. A conflict goes back to the human as a new round of questions,
  following [Discovery](discovery.md). A decision that must give way changes on the branch once the
  human answered for it. A constitution exception the human accepted is named here and spelled out
  in the plan.
- **Risk tier**: see below.
- **History**: on a revision, the records of the earlier reviews, newest first. See
  [Revising](#revising).

```markdown
| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ⚠️                | ✅               |
```

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

## Data model

Write `data-model.md` next to the spec, from
[its template](../assets/templates/specs/YYYY-MM-DD-feature-slug/data-model.md), whenever the
feature adds or changes stored data or a file format, at any size. The human reviews it with the
spec, and the web UI shows it after the stories as "Data". Types internal to the code are the
plan's.

- **One section per entity, file, or format**, `## <Entity>`.
- **A table of its fields**: the field, its type, its meaning, and its change: new, changed,
  removed, or empty when unchanged.
- **A Mermaid diagram** only for relationships between three or more entities, or for state
  transitions.

## Tests

The spec names no test: its scenarios, edge cases, and success criteria are what the tests check.
The plan's `## Test map` maps each main scenario, `high` edge case, and success criterion to its
test, and the other edge cases to lines of tests that exist: see [Plan](plan.md). How the tests are
written is [writing tests](code-quality.md#writing-tests).

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
3. **Consistency**: no section contradicts another, and every UI change has a mockup. The
   architecture's units deliver every user story. The data model supports every edge case, over two
   consecutive occurrences when it repeats.
4. **Scope**: the spec fits a single plan, within [the split rule](writing.md#a-spec). If it does
   not, start a new round, following [Discovery](discovery.md), with a question proposing the split,
   the recommended split as option A. Answered rounds are never edited.
5. **Ambiguity**: a requirement that can be read two ways is rewritten to say one.
6. **Linear reading**: nothing is referred to before it is introduced, the block names subjects, and
   each rule is stated once.
7. **Decisions**: each one listed comes from an answer or a review comment, and a new one passes the
   four tests. Each reads intent first, its rules strongest first, one sentence each, with how it is
   checked.
8. **Risks**: every unverified outside behaviour and every relaxed guard is in the block, a guard as
   what an attacker could do.

## Red flags

| Thought                                                       | Reality                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| "I'll list the options, the human picks during review"        | The questions are over. Decide the design, and state what you settled as assumptions.               |
| "The plan will figure out the behaviour"                      | The plan argues from the spec. A behaviour the spec leaves vague, a later agent decides alone.      |
| "Next week is close enough for a scenario"                    | Scenarios carry exact values: the tests copy them as written.                                       |
| "This answer could mean two things, I'll take the likely one" | Pick it only if the readings differ little, and say so in the block. Otherwise, ask in a new round. |
| "This choice deserves a decision"                             | Only an answer or a review comment creates one. Ask the human in a new round.                       |
| "The spec should list the components and tests"               | Those are the plan's. The spec keeps the units, the data model, and what users get.                 |
| "The decision should say how we got here"                     | The decision states its intent and rules. The history stays in the feature's record.                |
| "The decision should name the flag, the timeout, the file"    | Those are values the code holds. The rule states the intent, unless the human chose the value.      |

## Revising

The spec is amended in place: it stays the single source of truth for the implementation.

- **`changes-requested`**: read `spec-review.md`, its comments and its summary; each line comment
  quotes the lines it is about, as they were at the review's `commit`. A comment can point into a
  decision the spec lists, by its file and lines: see [Review files](conventions.md#review-files).
  If the feedback asks for more options or raises a new question, start a new round, following
  [Discovery](discovery.md). Otherwise, apply the feedback, and edit the decisions it affects on the
  branch. Leave the review file as it is: the next review replaces it.
- **A newer round is answered**: read its answers, write the decisions they ask for, and amend the
  spec.

On a revision after a review, `## Your review` answers each comment of that review, one item each:

```markdown
- **C2** (undo too short): done. The undo stays 5 seconds.
- **C3** (a sync option): declined. The app stays local-only, as you chose.
```

The parentheses name the comment in a few words, so the reader never needs its number alone. Then
"done" or "declined", and what was done, or why not. The previous block becomes a record of the
request, as described in [Coming back to the human](../SKILL.md#coming-back-to-the-human). It moves
to the top of `## History`, above the earlier records. The new `> [!IMPORTANT]` block says what
changed since the last review.

Increase `revision`, set `clarifications` to the latest round, and set `status: awaiting-human`
again.

With `ura`, run `ura check` on the feature's folder before committing.

## Commit

Commit the spec, its data model, and its decisions together: `spec(<slug>): <feature name>`, or what
changed when revising. The commit message body is the first line of the block, for example "Spec to
review, about 15 minutes." Then stop at the gate.
