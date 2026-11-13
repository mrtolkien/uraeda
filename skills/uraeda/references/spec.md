# Spec and decisions

Turns the human's answers into a spec: what the feature does, and the big picture of how it is
built. The human approves it, with the decisions it changes.

- **Runs when**: the latest round is `answered`, and there is no `spec.md` or its `clarifications`
  field is lower than the round; or `spec.md` is `changes-requested`
- **Writes**: `spec.md`; `data-model.md` when the feature changes stored data or a file format; and
  decisions in `specs/decisions/`, new or edited in place on the branch
- **Ends at**: a human gate, `spec.md` with `status: awaiting-human`, or a new
  [discovery](discovery.md) round

The spec is the main review of the workflow. Once it is approved, most features reach the pull
request without the human. Anything it leaves vague, a later agent decides alone. Anything it gets
wrong, the human finds in the built feature, when it costs the most.

Decide the design: do not list possibilities. The round settled what needed the human, and the rest
is yours to settle and to state, so they can object. Every part of the design serves a user story or
an answer.

## Read the human's words

The spec is built on everything the human wrote for this feature, not on the answers alone:

- **The proposal**, and the product it names as its model, if any.
- **Every round**: its answers, the latest last, since later answers win, and its **Notes:**, which
  often carry requirements no question asked. A note starting with a settled point's bold subject
  answers that point. See [answers](writing.md#answers) for letters, own words, and follow-ups.
- **Review comments** on this feature, from this review and the earlier ones.
- **What they wrote in the session**, when there was one.

When an answer can be read more than one way and the readings differ a lot, start a new round, with
your reading as the recommended option. When they differ little, pick one, and give the block an
item the human flips in a word: "Read as X. The other reading, Y, would [cost]."

Turn the answered round's block into a note, as [the block](writing.md#the-block) says, in the
spec's commit.

## Is the scope clear?

Start a new round, following [Discovery](discovery.md), when an answer raises a new unknown that
only the human can settle, or when they asked for more options. A folder that came from a
[change made a feature](change.md#upgrading) has rounds that settled the change, not the feature:
start a new round for it. Otherwise, write the decisions the answers ask for, then the spec.

## Propose decisions

### What is a decision

**Most features produce no decision.** A decision is a boundary or a direction the human set, that
work outside this feature must respect: what the code is built on, what a tool may never do, how the
product should feel. "Tools never lose the user's work." "One kind of information is drawn by one
shared component on every page." Each is a sentence the human would repeat to every future agent.

Everything else has another home:

- **What this feature does**, however long it lasts, is its spec, then its record.
- **How an area is designed**, its keys, its layouts, its formats, its wording, is the project's
  guide for that area, like `specs/ui/`. Guides are free form, and you edit them with the feature.
- **What only the code needs to know**, and enforces with a type, a schema, a lint, or a test, is
  the code's. A boundary the human set stays a decision when a test also guards it.
- **A choice made while building** is a ruling.

Test a rule before writing it:

1. **Would it still be true, word for word, if the code it governs were rewritten?** A flag, a
   timeout, a file name, a component's name, a list of keys: those are the code's, and change
   without the human. A value stays only when it is the human's own, like "a session lasts 30 days".
2. **Would the human check a plan against it?** If any agent would do it anyway, it is noise.
3. **Did the human say it?** Every rule comes from their words: an answer, a note, a comment, the
   proposal. It says no more than they said. A rule drawn from your own reading, or from a point you
   settled, is an assumption of the spec, not a rule of the project.

The reverse also holds: an answer that forbids something across the product, "no commit without the
commit page", is a decision even when its question was narrower. Lose it, and the next feature
proposes it again.

A decision is never edited to describe the code. When the code and a decision disagree, the code
changes, or the question goes to the human.

### New decision or change

**Extend an existing decision before writing a new one**, and cut or merge its weakest rules to make
room. A new file is the last resort, for a topic no decision covers. Which file holds a rule is
yours to settle: do not ask the human where a rule lives.

Decisions are named after the question they answer, not the answer: `due-dates.md`, not
`due-dates-are-calendar-days.md`.

- **A new one**: write it from
  [the template](../assets/templates/specs/decisions/decision-topic.md).
- **One that exists**: edit it in place, on the feature's branch, as it should read after the
  change. The default branch keeps its text until this branch merges. A change that reverses an
  earlier choice lists that choice under **Alternatives considered**, with why it was abandoned.
- **To remove one**: delete its file on the branch.

The human sees each change as the difference between the decision on the branch and on the default
branch, and approves it with the spec: nothing else activates it, and the merge brings it to the
default branch. A decision edited again after the spec's approval needs their approval again: say so
in the pull request's "Look at".

A pass over all the decisions, when the human asks for one, is a [change](change.md): propose the
merges and cuts as edits on its branch, and ask one question per merge or removal.

### Writing a decision

Write for an agent that reads the decision alone, before a task, and for a human who approves each
line. [A decision](writing.md#a-decision) gives the shape: the intent first, few rules, SHOULD by
default, a short Why in the present tense.

- **Rules** are sentences a spec, a plan, or code can be checked against. Each stands on its own,
  since plans copy it word for word. A rule a tool already checks may end with how, "Checked by" a
  lint or a test: see [rules enforced by tools](code-quality.md#rules-enforced-by-tools).
- **Why**: the reason, so an agent can apply a rule to a case it does not name. Until the feature is
  [finished](finish.md#rewrite-the-links), its one link points to the spec, then to the record.
- **Consequences**: the costs the human accepted, and what a later feature must do.
- **Applies to**: the folders and kinds of features it governs.
- **Alternatives considered** and **Revisit when** are optional: the rejected options an agent could
  propose again, and the condition or date that ends a temporary decision.

## Spec document

Use [the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md): its frontmatter and
its sections, in its order. `## Your review` is left out at revision 1, and `## History` until a
revision has an earlier review to keep. Write it as [Writing for the human](writing.md) says, and as
[a spec](writing.md#a-spec) adds.

In order, the human reads:

- **The block**: the time it takes, "You approve", and what you chose for them.
- **Their last review, answered**, on a revision.
- **The decisions**: they outlive the feature, so they come first.
- **The user stories**: what users get, each with its mockup and its key scenarios.
- **The behaviour it replaces**, when it replaces some.
- **How it is built, and its limits**: the architecture's units, the edge cases, the success
  criteria, and the assumptions.
- **The constitution check and the risk tier**, then the history of earlier reviews.

Components, error handling, tests, and file-by-file changes are the plan's.

## The block

[The block](writing.md#the-block) opens with the review's time, then "You approve" and what
approving commits to. Then, most important first:

- every answer you read one way among several, written to be flipped in a word;
- **every default and assumption that changes what users get**, said as what happens to them: what
  is on unless turned off, what happens when something was missed, what a save does;
- each difference from the product the proposal names as its model;
- the new, changed, and removed decisions;
- outside behaviour not verified yet, with what the plan's first task checks and what happens to the
  story if the check fails;
- a relaxed guard, as what an attacker could then do;
- the risk tier, and whether the plan waits for their review;
- a tension with the constitution, a cost, or a migration.

A behaviour the human did not ask for is never left to the scenarios or the assumptions alone.
There, they find it on the third read, or in the product.

## The spec's decisions

`## Decisions` lists the decisions this spec creates, changes, or removes, one item each:

```markdown
- **New: [Due dates](../decisions/due-dates.md)**. Due dates are calendar days, without a time.
- **Changed: [Task storage](../decisions/task-storage.md)**. An upgrade keeps every earlier version.
- **Removed: Sync** (`sync.md`). The app stays local-only, as you chose.
```

The sentence gives the rule itself, in the decision's words, for a new or changed one, and why for a
removed one: the human approves rules, not a summary of them. Only these items count as listed: they
are what the human approves.

Then the paragraph "Relied on:", and a two-column table of the active decisions the spec follows:
the decision, linked, and what it means for this spec.

## User stories

Stories are ranked by priority (P1, P2, ...). Each is a slice a user gets value from on its own. A
story holds, in order:

- **Its journey**: the user's path, in plain language, in one or two sentences.
- **Its mockup**: for a story with UI work, alone in its paragraph. See [Mockups](#mockups).
- **"Why this priority:"**: only when the order is not obvious.
- **"Key scenarios:"**: the two or three scenarios that show the story best.
- **"More scenarios:"**: optional, the others. They do not count in the reviewed part.

Scenarios are **Given** / **When** / **Then**, with exact values: "a weekly task due Monday the
5th", never "the next week", in at most 4 steps. **A scenario's Then is what the user came for**:
the text is selected, the field takes the next key, the column is wider. A label, a count, or a
mode's name is a sign of it, and a feature can show the sign without working. Every answer that
changes behaviour shows up in a scenario.

## Mockups

Any UI work requires mockups: a new screen, a new control, or a visible change to one. The human
approves what users will see, and looks at mockups before anything else in the spec.

- **Read first**: the project's guides and look decisions, and what the human said about earlier
  mockups, in the records of `specs/done/`. A taste they already stated is not taught twice.
- **Draw in the project's own look**, with its components. For a view that exists, the mockup is the
  real view, changed.
- **Show each view as its user meets it, not only at its best**: at the narrowest width the project
  serves, with nothing in it, and with more than fits. A state without a mockup is still described,
  in the edge cases.
- **Look at each one, as a picture, at each width**, before linking it. A mockup that renders can
  still be one grey block with no hierarchy.
- **Check each answer against the mockup that shows it.** The human reads the mockup, and a mockup
  that contradicts their answer is what they remember.

The spec's text stays the reference for behaviour, and wins when the two disagree.

**With an active preview decision**, `specs/decisions/preview.md`, mockups are stories, written
where the decision says, one export per state, each embedded by a
[story link](conventions.md#markdown) alone in its paragraph:

```markdown
[Repeat menu, open](/src/tasks/RepeatMenu.stories.tsx#Open)
```

Set the worktree up as the project asks, and start the preview with the decision's
`preview-command`, to look at them. After a [visual question](discovery.md#visual-questions), the
spec's commit keeps the picked variant's export and deletes the others. A discovery's
[prototypes](discovery.md#prototypes) are not mockups: rebuild a picked one as stories.

**Without one**, put the mockups in `mockups/`, next to the spec, in the format that shows the
change best: an HTML page, an SVG, an image, or a small component in the project's own stack. The
spec's links name its mockups: the approval deletes the other files.

## Replaced behaviour

Optional, between the stories and the architecture. It lists the behaviour of today that the feature
removes or changes, each with the tests that guard it, which the discovery found:

```markdown
- **A completed task gets no next date.** Guarded by `tests/tasks/complete-a-task.test.tsx`.
```

The human's approval covers removing or rewriting these tests: see
[when a test goes](code-quality.md#when-a-test-goes). A test that guards replaced behaviour and is
not listed here costs a ruling later: read the discovery's list again.

## Architecture

What the human approves of the build: the big picture, never the components' details. It opens with
the chosen approach and why, in a few sentences. Then one item per unit, its name in bold, saying
what it does and the rules it owns ([one home per rule](code-quality.md#one-home-per-rule)):

```markdown
- **The repeat rule** computes the next due date from a pattern. It owns the month-end rule.
```

Then the paragraph "Tradeoffs:", and one item per cost the approach accepts. Follow the patterns the
discovery found, and include the targeted improvement a unit in the way needs
([extract, don't grow](code-quality.md#extract-dont-grow)), never unrelated refactoring.

## Edge cases and success criteria

**Edge cases** are the situations at the boundary, each with what happens, in a table, most
important first. They are not only data: an empty list, a text too long for its place, the narrowest
screen, where the focus goes after an act, how the user backs out, a failed save, an existing action
that meets the feature. An error the user sees comes with its exact text. Rate each one `High` when
it can lose data or mislead the user, `Niche` when few users meet it, `Normal` otherwise.

```markdown
| Importance | Situation                  | What happens                         |
| ---------- | -------------------------- | ------------------------------------ |
| High       | A save fails on completion | the task keeps its previous due date |
```

**Success criteria** are measurable outcomes: "Setting a preset repeat takes two clicks from the
open task", not "Setting a repeat is easy". A criterion on speed or size is measured on real data
from the project, and says which: made-up data hides the real case.

```markdown
- **SC-001** (two clicks): Setting a preset repeat takes two clicks from the open task.
```

## What the human weighs last

- **Assumptions**: a sentence linking the points settled in the round, which hold as written there,
  naming only those an answer or a note changed. Then "Settled while writing this spec:", and what
  you settled yourself. One that changes what users get is also an item of the block.
- **Constitution check**: a one-row table, one column per principle, each ✅ or ⚠️, then one line
  per tension. A conflict goes back to the human as a new round.
- **Risk tier**: `low` with no data format change and no new interface, `medium` for small data
  changes, `high` for security changes or new data structures and services. When unsure, the higher
  one: a change to the format of data users already have is at least `medium`, and converting every
  saved record is `high`. Propose it in the frontmatter, with its reason in a line. `plan-review` is
  `false` unless the human turns it on when approving.
- **History**: on a revision, the notes of the earlier reviews, newest first.

`data-model.md` is written from
[its template](../assets/templates/specs/YYYY-MM-DD-feature-slug/data-model.md) whenever the feature
adds or changes stored data or a file format: one section per entity, a table of its fields, and a
diagram only for relationships between three or more entities. The human reviews it with the spec.

## Self-review

Before committing, read the spec again, and fix what you find:

1. **The human's words**: read the proposal, every answer and note, the review comments, and the
   session again. Nothing in the spec contradicts one, mockups included. Where the proposal names a
   product as its model, each difference from it is in the block.
2. **What you chose for them**: every default, limit, and behaviour they did not ask for is in the
   block, said as what happens to them.
3. **Acts and states**: every act a story adds has a scenario whose Then is its effect. Every view
   is shown or described at its narrowest, empty, and overfull.
4. **Decisions**: none, unless a rule passes the three tests. Each rule says no more than the human
   said, and is a MUST only as [a decision](writing.md#a-decision) allows.
5. **One reading**: no placeholder, no requirement that reads two ways, no section that contradicts
   another, each thing said once.
6. **Risks**: every unverified outside behaviour and every relaxed guard is in the block.

With `ura`, run `ura check` on the folder.

## Revising

The spec is amended in place: it stays the single source of truth.

- **`changes-requested`**: read `spec-review.md`: each comment quotes the lines it is about, as they
  were at the review's `commit`, and can point into a decision. If the feedback raises a question
  only the human can settle, start a new round. Otherwise:
  - **Make the smallest change that satisfies each comment.** A comment on one view changes that
    view. When a comment could reach further than the lines it is on, say in the block how far you
    took it.
  - **Then remove the old behaviour everywhere**: search the block, the stories, the scenarios, the
    mockups, the assumptions, and the decisions for what you replaced. One stale sentence is read as
    "the opposite of what I asked".
  - **A comment that states a taste beyond this view**, "nothing round", "no layout shift", goes
    into the project's guide for that area in the same commit. A review file is replaced by the next
    one, and the taste would be taught again.
- **A newer round is answered**: read its answers, and amend the spec and its decisions.

`## Your review` answers each comment of the last review, one item each, the comment named in a few
words:

```markdown
- **C2** (undo too short): done. The undo stays 5 seconds.
- **C3** (a sync option): declined. The app stays local-only, as you chose.
```

The previous block becomes a note of the request and moves to the top of `## History`. The new block
says what changed since the last review. Increase `revision`, set `clarifications` to the latest
round, and set `status: awaiting-human` again.

**Approved with comments**: the approved spec is not changed. The plan carries each comment out, and
the comment wins over the clause it changes: see [Plan](plan.md#read-first).

## Commit

Commit the spec, its data model, its mockups, and its decisions together:
`spec(<slug>): <feature name>`, or what changed when revising, with the block's first line as the
body. Then stop at the gate.
