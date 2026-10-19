# Discovery and questions

Investigates a human proposal in depth, in the code and outside it, then asks the human, in one
file, the questions only they can answer.

- **Runs when**: a spec folder has a `proposal.md` and no `clarifications-01.md` (round 01), or
  another step needs the human to decide something new (the next round, see
  [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions))
- **Writes**: `discovery-NN.md` and `clarifications-NN.md`, with the round's number: `01`, `02`, ...
- **Ends at**: a human gate, `clarifications-NN.md` with `status: awaiting-human`

Read this file in full before starting. This step explores the project context and understands the
intent behind the proposal. It then finds two or three approaches with their tradeoffs, and asks the
human what only they can answer. The human is not in a conversation with you: you explore alone.
Then you ask everything at once, in a file they read when they have time.

**Take the time.** A design conversation can go straight to the point, because the human is there to
fill the gaps as it goes. An asynchronous workflow does the opposite: the whole point is to give the
agent as much time as it needs to research. This happens before the human is involved at all. Nobody
is waiting on you. Your discovery must be **much deeper and broader** than a design conversation:
broad, complete, leaving no stone unturned. Keep going until you understand the problem better than
the proposal does.

## Overview

Two files come out of this step, for two different readers:

- **`discovery-NN.md` is the feature's knowledge base, for agents.** It holds what this kind of
  feature usually looks like, how established products and standards handle it, and what the code
  has today. It also holds the approaches to each topic, every fact with its source. The questions
  link to its sections, the spec builds its behaviour and design on it, and the plan reuses its map
  of the code. The human does not read it by default: they follow a question's links when they want
  more.
- **`clarifications-NN.md` is the questions, for the human.** Only what only they can decide, each
  question self-contained, with options, pros and cons, and a recommendation, read once, top to
  bottom. Then the points you settled without them, so they can object.

The goal is an understanding the human can recognize and correct, grounded in what they want to
accomplish. Find the intent behind the proposal: the outcome, who it is for, and what success looks
like. Keep what the human said apart from what you assume. Then turn the gap between the two into
the fewest, clearest questions.

Discovery is the cheapest moment to find the right approach: a shallow discovery turns into bad
questions, a weak spec, and rework. Nobody will ask you to go deeper, and nobody will notice what
you skipped until it is expensive. A question you could have answered yourself, or a capability you
did not know users expect, costs the human far more than a longer discovery. Spend the time, as far
as the proposal's [discovery effort](#discovery-effort) asks.

YAGNI still applies to the feature, not to the research: depth and breadth go into understanding the
problem. The human can then choose a small scope knowingly, not by accident.

## Discovery effort

The proposal's `discovery` frontmatter field tells how far the human wants the research to go, for
every round of the feature. Without the field, or with another value, the effort is `high`.

- **`low`**: the feature is small and its direction clear. Read the code, the project's decisions
  and docs, and the documentation of the dependencies involved, to verify how they behave. Do not
  compare products or look for alternatives online. Each topic has one or two approaches, often
  "reuse what exists".
- **`medium`**: also look online for how two or three established products or libraries solve the
  problem, from their official documentation. Use a source or two per topic. Stop at what the
  approaches need: no community sentiment, no benchmarks.
- **`high`**: everything this file describes, until new sources stop adding: products, standards,
  libraries, community sentiment and known pitfalls, and benchmarks where performance is a
  criterion.

The level is the human's expectation of how much new work the feature holds, not a cap. It scales
the research, never the rules. Every fact still has its source, every gap in the proposal is still a
question, and every question still has a recommendation. When the feature turns out bigger than the
level suggests, raise the effort for that topic or the whole feature. An example is a topic that
could become a decision. Say so in the `> [!IMPORTANT]` block. Leave the proposal's field as the
human wrote it.

## Read first

1. `proposal.md`: the human's words. Read it for its intent as much as for its requests.
2. Earlier rounds, if any: their discovery files, questions, and answers. Build on them, and never
   edit them: a round is a record of what the human was asked and answered.
3. The review file of `spec.md`, `spec-review.md`, when the spec's changes requested led here. If
   the plan or implementation step sent the workflow back here, the reason it gave.
4. The constitution, and the active decisions whose **Applies to** covers the feature.
5. Other features in flight: list the open feature branches (`git branch -a`). Read the specs,
   proposed decisions, and data changes of those that touch the same code, stored data, or decisions
   (`git show <branch>:specs/...`). Two features upgrading the same database, or one changing a
   decision the other relies on, is a finding.

## Scope check

Before investigating details, assess the proposal's scope. If it describes several independent
subsystems ("reminders, sharing, and a calendar view"), do not refine all of them at once. Make the
split the first question of the round, with the recommended split as option A. It covers the
independent pieces, how they relate, and the order to build them. Investigate the first piece in
depth, and leave the others for their own features.

A proposal can also be one subsystem too large for one spec. When the spec it leads to would pass
[the split rule](writing.md#a-spec), past 6 stories, 30 scenarios, or 2 changed decisions, propose a
split the same way.

## Investigate in depth

Build a full understanding of the problem, beyond the current project and beyond what you already
know:

- **Beyond the project.** The codebase shows what exists, not what the feature should be. How
  established products solve the problem, what standards say, what users of those products complain
  about, what went wrong for others. None of it is in the repository.
- **Beyond your own knowledge.** Treat what you know about a product, a library, a browser, or a
  standard as a lead to verify, not a fact. It may be outdated, incomplete, or wrong. Every fact in
  the discovery comes from a source you read in this session, with its link.
- **Broad before deep.** First map the whole problem: every part of the feature, every product worth
  comparing, every standard and dependency involved, every existing action the feature meets. Then
  go deep on each part. A topic you never listed is a topic you never researched.
- **Until new sources stop adding.** Keep researching a topic until the last sources you read only
  confirmed what you already had. One source per topic is a lead, not research.
- **Cover the dimensions the proposal does not mention**, when they apply: accessibility, languages
  and locales, time zones and dates, performance at scale. Also security and privacy, offline and
  errors, data that users already have, migration, and how the feature is removed or turned off.

If your harness can run agents in parallel, use them. Give each topic, product, or dimension its own
agent, have each read its sources in full, and merge their findings into one file. Go deep on all
three sides below.

**The code**

- Read the code the feature touches, and follow it to the data it stores and the interfaces it
  exposes. List every place that reads or writes data the feature may change.
- Trace the proposal's user path through the code, step by step. Then trace every existing action
  that meets the new feature: undo, delete, uncheck, edit, empty fields. Each one that behaves
  differently with the feature is a finding. A problem you meet outside the feature, like a slow
  page, is not a finding: note it in the inbox, as [agents' notes](inbox.md#agents-notes) says.
- List who owns each rule the feature touches, and where it is copied: see
  [one home per rule](code-quality.md#one-home-per-rule).
- Find the existing patterns the feature should follow, and the problems in the way. Examples are a
  function or file over the project's limits, which a task must split first
  ([extract, don't grow](code-quality.md#extract-dont-grow)), and a responsibility tangled with
  another.
- List the files the feature will likely change or add, under every option: never assume an option
  the human has not chosen.
- Check recent commits on the files you read (`git log`): they explain choices the code does not.

**Outside the code**

- Learn what this kind of feature usually looks like: how established products implement it. Read
  their official documentation and help pages first, and third-party guides only where those are
  silent. Look for the capabilities users of those products expect. Look especially for the ones the
  proposal does not mention: editing one occurrence of a recurring event, undoing a bulk action,
  ending a subscription. The proposal describes what the human thought of, not everything the
  feature involves.
- Read the standards and the documentation of the dependencies involved, for the versions the
  project uses: local docs, then official online docs.
- Search the web for libraries that could do the work, and for known pitfalls.
- From all this, find two or three genuinely different approaches per topic, not variations of one.
  Include "do nothing" or "reuse what exists" when they are real options.

**The proposal itself**

Check the proposal against what you found: constraints that cannot be met as written, ambiguous
wording, gaps. A proposal is a human's first draft, not a specification. Do not interpret it
silently. Each point becomes a finding, then a question for the human, or a settled point when the
constitution and active decisions already answer it. A gap about scope, what the feature includes or
leaves out, is always a question.

**Is it worth it, and can it work?**

- **Worth it**: weigh what the feature gives against what it costs, from what you found. Count the
  work, the dependencies, the maintenance, and what existing features already cover. When the
  evidence says the cost outweighs the gain, say so, and make dropping or shrinking the feature the
  first question's recommended option. Never recommend going ahead only because the proposal asks
  for it.
- **Outside behaviour it relies on**: a feature may depend on how a library, a browser, a protocol,
  or another tool behaves. When its documentation does not settle it (embedding a page in a
  sandboxed frame, a protocol's undocumented messages), check it now. Use a small throwaway
  experiment when one is cheap, run outside the repository and never committed. When it cannot be
  checked, the discovery says so: it becomes an unverified assumption, which the spec names and the
  plan's first task checks.
- **Guards it relaxes**: an option that loosens a security rule, an origin check, a permission, a
  sandbox, says what an attacker could then do. Say it in one sentence a non-specialist understands,
  not as a mechanism. Write "any website open in your browser could read the project's code", not
  "the `Origin` rule is laxer on those paths".

**Depth and sources**

- Scale the depth to the impact: a topic that could become a [decision](spec.md#what-is-a-decision)
  deserves several sources, a minor topic a quick check. Every topic still gets both the code and an
  outside source, a dependency's documentation at least, whatever the
  [discovery effort](#discovery-effort).
- Cite only pages you actually read. A fact seen only in a search result's snippet or summary is
  marked as such where it is used. Its page goes in **Not checked**.
- If you cannot search the web or read a source, say so in **Not checked** rather than writing from
  memory. **Not checked** is for what could not be found or reached, never for work skipped.

**Later rounds** start from what triggered them: an answer that raised a new unknown, a spec review
asking for options, a blocked plan. They research new information, for example the UI patterns an
answer calls for, and link to earlier rounds' sections rather than repeating them.

## The discovery file

Write a new file for the round, from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/discovery-01.md). Knowledge comes
first, approaches last, in this order:

```markdown
# Discovery, round [NN]: [Feature name]

## Why this round

[Later rounds only: what triggered this round, with a link to it.]

## Summary

[What this kind of feature usually looks like, where products differ, what the proposal asks for
within that range, and what the code has today.]

## How other products do it

### [Product]

### What they have in common

## Standards and libraries

### [Standard, library, or documentation]

## The code

### Important reads

### The proposal's path and existing actions

### Rules and their owners

### Likely changes

## The proposal

### [Constraint, ambiguity, or gap]

## Worth it and feasibility

## Approaches

### [Topic]

### Needs no choice

## Not checked
```

What goes in each section:

- **Summary**: the feature in a few sentences, for an agent who reads nothing else.
- **How other products do it**: one section per product, each fact with its source. Then **What they
  have in common**: the capabilities users may expect, whether or not the proposal mentions them.
- **Standards and libraries**: what matters for this feature, and the pitfalls, with versions.
- **The code**: the important reads, each with what it showed and what is in the way. Then the
  proposal's path and the existing actions that meet the feature, and the overlaps with other
  features in flight. Then each rule the feature touches, with the code that owns it and every copy,
  when it touches one. Last, the likely changes, each with the options it depends on.
- **The proposal**: one section per constraint that cannot be met as written, ambiguity, or gap.
- **Worth it and feasibility**, left out when the feature is small and relies on nothing new: the
  feature's cost against its gain. Then the outside behaviour it relies on, each checked or named as
  unverified. Then what each relaxed guard would let an attacker do, as
  [investigate in depth](#investigate-in-depth) asks.
- **Approaches**: one section per topic the feature has to settle. Each says what the topic is about
  in one sentence and links to the knowledge above it relies on. It compares its options against the
  same criteria for every option. Criteria come from the proposal, the constitution, active
  decisions, and the standards the project must meet, such as an accessibility guideline, marked as
  such. When a topic only matters with one option of another topic, say so on its first line: "Only
  with option A of [generating occurrences](#generating-occurrences)". Every capability from **What
  they have in common** gets a topic, or a line in **Needs no choice** saying why it leaves nothing
  to decide.
- **Not checked**: what you searched for and could not find or reach.

Rules for the whole file:

- Give a heading to anything the questions may link to: in Markdown, only headings can be linked to.
- Every fact links to its source: a file, a documentation page, a URL. Mark your own judgements as
  judgements.
- Do not recommend, and do not choose, in the discovery file. Recommendations go with the questions,
  and choices you settle go under **Settled without the human** in the questions file.

## What to ask, and what to settle

Ask only what only the human can decide:

- Product direction, and what success looks like.
- Scope boundaries: what the feature includes, and what it leaves out.
- Tradeoffs between their goals, like simplicity against coverage.
- Visual direction.
- Any choice that would become a [decision](spec.md#what-is-a-decision), which states the human's
  intent and not a value the code holds, including adding a dependency, or a change to an active
  one. The spec step creates or changes a decision only from an answer, so a choice not asked here
  cannot become one.
- A conflict with an active decision or with the constitution.
- Loosening a security guard, said as what an attacker could then do.
- Dropping or shrinking the feature, when the evidence says its cost outweighs its gain.

Settle everything else yourself, within the constitution and active decisions. Examples: reusing
what exists, writing a small module rather than adding a dependency, the behaviour of an edge case
the proposal's intent already decides. List each settled point under **Settled without the human**,
at the end of the questions file: what you chose, and why. The human sees it when answering, and can
object. The spec copies it into its assumptions.

**A project without code-quality checks.** When the project has no
`specs/decisions/code-quality.md`, the round asks whether to adopt one. The recommended option names
the limits for the project's own linters, as [setting up checks](code-quality.md#setting-up-checks)
describes. It is asked once: a "no" becomes that decision, saying the project has no limits, with a
date in its **Revisit when**. Before that date, no round asks again.

**A project with a UI and no preview decision.** When a round is about UI work and the project has
no `specs/decisions/preview.md`, the round asks once whether to adopt one, from
[the template](../assets/templates/specs/decisions/preview.md), as
[setting up a project](projects.md#setting-up-a-project) describes. A "no" becomes that decision,
saying the project has no preview, without its two preview fields, and with a date in its **Revisit
when**. Its mockups stay HTML, and no round asks again before that date.

Ask everything at once: anticipate the questions their answers would raise, and ask them now, as
follow-ups, so the human answers once. There is no limit on the number of questions: early in a
project, dozens are normal.

## The questions file

Write a new file for the round, from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md), and set
`status: awaiting-human`. The human answers every question in a single commit: the workflow does not
move on until they have.

The human reads the file once, from top to bottom, without the discovery open next to it. Write it
as [Writing for the human](writing.md) says. Its rules for every document, and for a round of
questions, set the block, the Context's parts, and each question's card. They also set the settled
groups and the time estimate. In order:

1. **The `> [!IMPORTANT]` block**, as [the block](writing.md#the-block) describes. Its verdict comes
   from the discovery's **Worth it and feasibility**: "not as proposed" when the evidence says the
   cost outweighs the gain. It is "worth building, with changes" when the proposal cannot be met as
   written. Its time follows [the time estimate](writing.md#the-time-estimate).
2. **The Context section**, its four parts as [the Context](writing.md#the-context) describes. In a
   later round, `### Since the last round` first.
3. **The questions**, sorted by impact, most important first, each followed by its follow-ups.
4. **Settled without the human**, its points in the three groups of
   [settled without the human](writing.md#settled-without-the-human), then the line `**Notes:**`,
   left empty for the human's notes on the settled points.

## Question structure

Every question follows this structure:

```markdown
## Q2: When does the next occurrence appear?

The app cannot create tasks while it is closed. Todoist keeps a single task and moves its due date
on completion. This choice also decides what editing, deleting, and undoing mean for a repeating
task. More in [discovery](discovery-01.md#generating-occurrences).

Why it matters: it decides whether future tasks show, whether completed ones stay as a history, and
whether the app needs a notion of series.

- **A (recommended). Create the next occurrence as a new task when the current one is completed.
  Editing a task changes that task only.**
  - [pro] completed tasks stay in the list as a history; no notion of series to learn.
  - [con] the list grows by one task per completion.
  - Why recommended: it keeps the history with the simplest model.
- **B. Create the next 4 occurrences in advance, so they are always visible.**
  - [pro] users can plan ahead.
  - [con] four times more repeating tasks in the list, and editing one occurrence needs the
    follow-up question below.
- **C. Keep a single task, and move its due date to the next occurrence when it is completed, like
  Todoist. Editing the task changes the whole repetition.**
  - [pro] the list never grows.
  - [con] completed occurrences disappear, and one occurrence can never differ from the others.

**Answer:**

### Q2.B: What does editing one occurrence change?

Only if you picked B in Q2. [...]
```

The card's parts, its context, "Why it matters", and its options, follow
[questions](writing.md#questions) and [options](writing.md#options). They ask for as much context as
deciding needs, self-contained option sentences, and the recommended one first. The asking rules:

- **Options exclude each other**, unless the question says which ones combine, before the options:
  "C can come on top of A or B". When the best answer is a combination, the "Why recommended" line
  names it: "A, with C on top".
- **Questions that depend on each other say so**, in the context of both. For example, "Where the
  choice appears is Q6", "With a due date counted from the previous one (A in Q3), ...".
- **A question that only matters for one answer is a follow-up**, right after its parent. Number it
  by the answer it depends on: `Q2.B`, starting with "Only if you picked B in Q2". Ask it under
  every option that needs one, each its own follow-up: `Q1.B` and `Q1.C`, never one shared by both.
  Never ask a separate question that an earlier answer already decides.
- **Number questions from Q1 in each round.** Refer to an earlier round's question by file and
  number: "Q2 of [round 01](clarifications-01.md)".
- **Conflicts**: when the proposal conflicts with an active decision, say so. Ask whether to change
  the proposal or the decision. The decision can be narrowed, softened from a MUST into a SHOULD, or
  given a case where it does not apply. When it conflicts with the constitution, say which
  principle, and recommend changing the proposal. An exception is possible only if the human
  explicitly accepts it in their answer. It is then spelled out in the plan, and the plan waits for
  their review.
- **Leave each `**Answer:**` empty.** The human answers with one or more option letters, or their
  own words. An answer without a letter answers the question, and its follow-ups then do not apply.
- **Settled points** say what was chosen and why, with a link to their discovery section, in their
  group. A point that depends on an answer goes into that answer's option instead.

If nothing needs a human answer, write a file with a single question confirming the scope: "A
(recommended). Go ahead with the scope above". The human still sets `answered`.

## Visual questions

With an active preview decision, a question about a look or a behaviour can offer its options as
stories. The human then tries each one live before picking. Ask one only when seeing helps more than
reading: a layout, a control, a motion, not a label's wording.

- **Two to four variants**, each a story export written where the decision puts stories, all made by
  the session that writes the round.
- **Distinct**: if two could swap their text unnoticed, they are too alike. Drop one, or make it
  differ.
- **Each option links its variant** in a paragraph of its own, under the option's sentence, then
  gives a one-line tradeoff as its `[pro]` and `[con]`. The recommended one comes first, as A.

```markdown
- **A (recommended). A thin line, which thickens under the pointer.**

  [Thin line](/src/SidebarHandle.stories.tsx#ThinLine)

  - [pro] nothing new to see until the pointer is there.
  - [con] harder to find.
  - Why recommended: it keeps the sidebar quiet.
```

Before linking a story, set the worktree up as the project's git decision asks, like its install. A
new worktree has none of its dependencies, and its Storybook does not start without them. Then check
that each story you link renders, in Uraeda or with the decision's `preview-command`.

The human may answer with a mix, "A, with B's grip". Commit the variants with the round. The spec
keeps the picked one, as [mockups](spec.md#mockups) describes.

## Self-review

Before committing, read both files again with fresh eyes, and fix what you find inline:

1. **Breadth and depth**: every part of the feature, every product worth comparing, and every
   standard and dependency involved was researched as far as the
   [discovery effort](#discovery-effort) asks. At `high`, each was researched until new sources
   stopped adding. So was every dimension that applies (accessibility, locales, time, scale,
   security, offline, existing data, removal). Every fact comes from a source read in this session,
   not from memory.
2. **Coverage**: every topic of the discovery's **Approaches** and **The proposal** sections ends up
   in exactly one question or settled point.
3. **Sources**: every claim in the questions is backed by the discovery or a linked source, and
   every link resolves to an existing heading.
4. **Each card alone**: the [writing self-review](writing.md#self-review): each question's card read
   alone can be answered, and the sentences, the block, and the parts hold to their rules.
5. **Options**: the recommended one is first, and combinations and dependencies are stated. No
   question is decided by an earlier answer, and a follow-up sits under every option that needs one.
6. **What is asked**: no question you could have settled. No settled point is one that only the
   human can decide, like a scope boundary or a new dependency.
7. **Worth it and feasible**: the cost of the feature is weighed against its gain. The outside
   behaviour it relies on is checked or named as unverified, and each relaxed guard says what an
   attacker could do.
8. **The block**: its verdict follows the discovery's **Worth it and feasibility**.

## Red flags

| Thought                                                   | Reality                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| "I know this kind of feature, I can skip the research"    | Products differ exactly where the proposal is silent. Read how they do it, and cite them.         |
| "I remember how this library or browser behaves"          | Your knowledge may be outdated. Verify it in today's documentation, and cite it.                  |
| "Two products and one standard is enough research"        | Keep going until new sources stop adding. Breadth first: list every part before going deep.       |
| "This would take a long time, the human is waiting"       | Nobody is waiting: the workflow is asynchronous. Depth now saves rounds of questions later.       |
| "I'll ask, the human knows the codebase better"           | The code is there to read. Ask only what the code, the docs, and the decisions cannot answer.     |
| "The proposal says X, so X it is"                         | A proposal is a first draft. Check it against what you found, and turn each gap into a question.  |
| "The proposal asks for it, so I'll recommend it"          | Weigh its cost against its gain. Recommending a drop is a valid answer when the evidence says so. |
| "The library surely supports this"                        | Check it with a small experiment, or name it as unverified so the plan checks it first.           |
| "I'll ask this one now and the follow-up in a next round" | Every round costs the human a context switch. Anticipate, and ask the follow-up now.              |
| "The options are clear enough as short labels"            | The human reads each option without the context. Write each as a full sentence.                   |
| "Three sentences of context will do"                      | Context has no length limit: give the card what deciding needs, and cut what weighs no option.    |
| "I'll recommend in the discovery, it saves time"          | Discovery holds evidence. Recommendations go with the questions, where the human weighs them.     |
| "Nobody will notice I didn't read that page"              | The next agent builds on your sources. Cite what you read; list the rest under **Not checked**.   |

With `ura`, run `ura check` on the feature's folder last: it verifies the files' structure, the
questions' numbering and answer lines, and their links.

## Commit

Commit both files: `discovery(<slug>): <feature name>`, or what the new round is about. The commit
message body is the first line of the block, for example "12 questions, about 30 minutes." Then stop
at the gate.
