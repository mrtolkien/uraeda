# Discovery and questions

Investigates a human proposal in depth, in the code and outside it, then asks the human, in one
file, the questions only they can answer.

- **Runs when**: a spec folder has a `proposal.md` and no `clarifications-01.md` (round 01), or
  another step needs the human to decide something new (the next round, see
  [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions))
- **Writes**: `discovery-NN.md` and `clarifications-NN.md`, with the round's number: `01`, `02`, ...
- **Ends at**: a human gate, `clarifications-NN.md` with `status: awaiting-human`

Read this file in full before starting. This step explores the project context, understands the
intent behind the proposal, finds two or three approaches with their tradeoffs, and asks the human
what only they can answer. The human is not in a conversation with you: you explore alone, and then
ask everything at once, in a file they read when they have time.

**Take the time.** A design conversation can go straight to the point, because the human is there to
fill the gaps as it goes. An asynchronous workflow does the opposite: the whole point is to give the
agent as much time as it needs to research, before the human is involved at all. Nobody is waiting
on you. Your discovery must be **much deeper and broader** than a design conversation: broad,
complete, leaving no stone unturned, until you understand the problem better than the proposal does.

## Overview

Two files come out of this step, for two different readers:

- **`discovery-NN.md` is the feature's knowledge base, for agents.** What this kind of feature
  usually looks like, how established products and standards handle it, what the code has today, and
  the approaches to each topic, every fact with its source. The questions link to its sections, the
  spec builds its behaviour and design on it, and the plan reuses its map of the code. The human
  does not read it by default: they follow a question's links when they want more.
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
problem, so the human can choose a small scope knowingly, not by accident.

## Discovery effort

The proposal's `discovery` frontmatter field tells how far the human wants the research to go, for
every round of the feature. Without the field, or with another value, the effort is `high`.

- **`low`**: the feature is small and its direction clear. Read the code, the project's decisions
  and docs, and the documentation of the dependencies involved, to verify how they behave. Do not
  compare products or look for alternatives online. Each topic has one or two approaches, often
  "reuse what exists".
- **`medium`**: also look online for how two or three established products or libraries solve the
  problem, from their official documentation, with a source or two per topic. Stop at what the
  approaches need: no community sentiment, no benchmarks.
- **`high`**: everything this file describes, until new sources stop adding: products, standards,
  libraries, community sentiment and known pitfalls, and benchmarks where performance is a
  criterion.

The level is the human's expectation of how much new work the feature holds, not a cap. It scales
the research, never the rules: every fact still has its source, every gap in the proposal is still a
question, and every question still has a recommendation. When the feature turns out bigger than the
level suggests, like a topic that could become a decision, raise the effort for that topic or the
whole feature, and say so in the `> [!IMPORTANT]` block. Leave the proposal's field as the human
wrote it.

## Read first

1. `proposal.md`: the human's words. Read it for its intent as much as for its requests.
2. Earlier rounds, if any: their discovery files, questions, and answers. Build on them, and never
   edit them: a round is a record of what the human was asked and answered.
3. The review file of `spec.md`, `spec-review.md`, when the spec's changes requested led here, or
   the reason given by the plan or implementation step, if one sent the workflow back here.
4. The constitution, and the active decisions whose **Applies to** covers the feature.
5. Other features in flight: list the open feature branches (`git branch -a`), and read the specs,
   proposed decisions, and data changes of those that touch the same code, stored data, or decisions
   (`git show <branch>:specs/...`). Two features upgrading the same database, or one changing a
   decision the other relies on, is a finding.

## Scope check

Before investigating details, assess the proposal's scope. If it describes several independent
subsystems ("reminders, sharing, and a calendar view"), do not refine all of them at once. Make the
split the first question of the round: the independent pieces, how they relate, the order to build
them, with the recommended split as option A. Investigate the first piece in depth, and leave the
others for their own features.

## Investigate in depth

Build a full understanding of the problem, beyond the current project and beyond what you already
know:

- **Beyond the project.** The codebase shows what exists, not what the feature should be. How
  established products solve the problem, what standards say, what users of those products complain
  about, what went wrong for others: none of it is in the repository.
- **Beyond your own knowledge.** Treat what you know about a product, a library, a browser, or a
  standard as a lead to verify, not a fact: it may be outdated, incomplete, or wrong. Every fact in
  the discovery comes from a source you read in this session, with its link.
- **Broad before deep.** First map the whole problem: every part of the feature, every product worth
  comparing, every standard and dependency involved, every existing action the feature meets. Then
  go deep on each part. A topic you never listed is a topic you never researched.
- **Until new sources stop adding.** Keep researching a topic until the last sources you read only
  confirmed what you already had. One source per topic is a lead, not research.
- **Cover the dimensions the proposal does not mention**, when they apply: accessibility, languages
  and locales, time zones and dates, performance at scale, security and privacy, offline and errors,
  data that users already have, migration, and how the feature is removed or turned off.

If your harness can run agents in parallel, use them: give each topic, product, or dimension its own
agent, have each read its sources in full, and merge their findings into one file. Go deep on all
three sides below.

**The code**

- Read the code the feature touches, and follow it to the data it stores and the interfaces it
  exposes. List every place that reads or writes data the feature may change.
- Trace the proposal's user path through the code, step by step, then every existing action that
  meets the new feature: undo, delete, uncheck, edit, empty fields. Each one that behaves
  differently with the feature is a finding.
- Find the existing patterns the feature should follow, and the problems in the way: a file that
  grew too large, a responsibility tangled with another.
- List the files the feature will likely change or add, under every option: never assume an option
  the human has not chosen.
- Check recent commits on the files you read (`git log`): they explain choices the code does not.

**Outside the code**

- Learn what this kind of feature usually looks like: how established products implement it, from
  their official documentation and help pages first, and third-party guides only where those are
  silent. Look for the capabilities users of those products expect, especially the ones the proposal
  does not mention: editing one occurrence of a recurring event, undoing a bulk action, ending a
  subscription. The proposal describes what the human thought of, not everything the feature
  involves.
- Read the standards and the documentation of the dependencies involved, for the versions the
  project uses: local docs, then official online docs.
- Search the web for libraries that could do the work, and for known pitfalls.
- From all this, find two or three genuinely different approaches per topic, not variations of one,
  including "do nothing" or "reuse what exists" when they are real options.

**The proposal itself**

Check the proposal against what you found: constraints that cannot be met as written, ambiguous
wording, gaps. A proposal is a human's first draft, not a specification. Do not interpret it
silently: each point becomes a finding, then a question for the human, or a settled point when the
constitution and active decisions already answer it. A gap about scope, what the feature includes or
leaves out, is always a question.

**Depth and sources**

- Scale the depth to the impact: a topic that could become a [decision](spec.md#what-is-a-decision)
  deserves several sources, a minor topic a quick check. Every topic still gets both the code and an
  outside source, a dependency's documentation at least, whatever the
  [discovery effort](#discovery-effort).
- Cite only pages you actually read. A fact seen only in a search result's snippet or summary is
  marked as such where it is used, and its page goes in **Not checked**.
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

### Likely changes

## The proposal

### [Constraint, ambiguity, or gap]

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
- **The code**: the important reads, each with what it showed; the proposal's path and the existing
  actions that meet the feature; the overlaps with other features in flight; and the likely changes,
  each with the options it depends on.
- **The proposal**: one section per constraint that cannot be met as written, ambiguity, or gap.
- **Approaches**: one section per topic the feature has to settle. Each says what the topic is about
  in one sentence, links to the knowledge above it relies on, and compares its options against the
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
- Do not recommend, and do not choose, in the discovery file: recommendations go with the questions,
  and choices you settle go under **Settled without the human** in the questions file.

## What to ask, and what to settle

Ask only what only the human can decide:

- Product direction, and what success looks like.
- Scope boundaries: what the feature includes, and what it leaves out.
- Tradeoffs between their goals, like simplicity against coverage.
- Visual direction.
- Any choice that would become a [decision](spec.md#what-is-a-decision), including adding a
  dependency.
- A conflict with an active decision or with the constitution.

Settle everything else yourself, within the constitution and active decisions: reusing what exists,
writing a small module rather than adding a dependency, the behaviour of an edge case the proposal's
intent already decides. List each settled point under **Settled without the human**, at the end of
the questions file: what you chose, and why. The human sees it when answering, and can object. The
spec copies it into its assumptions.

Ask everything at once: anticipate the questions their answers would raise, and ask them now, as
follow-ups, so the human answers once. There is no limit on the number of questions: early in a
project, dozens are normal.

## The questions file

Write a new file for the round, from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md), and set
`status: awaiting-human`. The human answers every question in a single commit: the workflow does not
move on until they have.

The human reads the file once, from top to bottom, without the discovery open next to it. Write it
so it reads linearly, with every piece of context they need at the point they need it:

1. **The `> [!IMPORTANT]` block**, as described in
   [Coming back to the human](../SKILL.md#coming-back-to-the-human). It names subjects, not question
   numbers: the reader has not seen "Q4" yet. Its first line gives the number of questions and an
   honest time to think them through: count two to five minutes per question, depending on its
   weight, and say "about". Then, one line each: the choices that last beyond the feature, the
   questions that work together, the gaps found in the proposal, and how many points you settled.
2. **A short Context section**: what the proposal asks for, and what exists today, with links to the
   code. It writes back your understanding: the human can see at once if you misread their intent.
   In a later round, what happened since the last one, and why new questions came up.
3. **The questions**, sorted by impact, most important first, each followed by its follow-ups.
4. **Settled without the human**, at the end, then the line `**Notes:**`, left empty for the human's
   notes on the settled points.

## Question structure

Every question follows this structure:

```markdown
## Q2: When does the next occurrence appear?

The app cannot create tasks while it is closed. Todoist keeps a single task and moves its due date
on completion. This choice also decides what editing, deleting, and undoing mean for a repeating
task. More in [discovery](discovery-01.md#generating-occurrences).

Why it matters: it decides whether users see future tasks, whether completed ones stay as a history,
and whether the app needs a notion of series.

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

The rules behind it:

- **Context, two or three sentences**: what exists today and how others do it, with links to the
  sources and to the discovery topic for more. Then one "Why it matters" sentence. Keep the depth in
  the discovery file.
- **Each option is a self-contained sentence**, readable without the context: "Create the next
  occurrence as a new task when the current one is completed", not "On completion". Name every
  detail that matters, like the field a rule is typed in. Under it, a `[pro]` line and a `[con]`
  line.
- **The recommended option comes first, as A**, labelled "A (recommended)", with a "Why recommended"
  line under its pros and cons. It is your best reading of the evidence, not an answer to
  rubber-stamp: the questions exist because they need the human's judgement. When the best answer is
  a combination of options that combine, the "Why recommended" line names it: "A, with C on top".
- **Options exclude each other**, unless the question says which ones combine, before the options:
  "C can come on top of A or B".
- **Questions that depend on each other say so**, in the context of both: "Where the choice appears
  is Q6", "With A or C in Q3, ...".
- **A question that only matters for one answer is a follow-up**, right after its parent, numbered
  by the answer it depends on: `Q2.B`, starting with "Only if you picked B in Q2". When it depends
  on several answers, number it by the first and list them all: `Q1.B`, "Only if you picked B or C
  in Q1". Never ask a separate question that an earlier answer already decides.
- **Number questions from Q1 in each round.** Refer to an earlier round's question by file and
  number: "Q2 of [round 01](clarifications-01.md)".
- **Conflicts**: when the proposal conflicts with an active decision, say so, and ask whether to
  change the proposal or the decision: narrow it, soften a MUST into a SHOULD, or add a case where
  it does not apply. When it conflicts with the constitution, say which principle, and recommend
  changing the proposal. An exception is possible only if the human explicitly accepts it in their
  answer: it is then spelled out in the plan, and the plan waits for their review.
- **Leave each `**Answer:**` empty.** The human answers with one or more option letters, or their
  own words.
- **Settled points** say what was chosen and why, with a link to their discovery section. A point
  that depends on an answer says so: "with A in Q2, ...".

If nothing needs a human answer, write a file with a single question confirming the scope: "A
(recommended). Go ahead with the scope above". The human still sets `answered`.

## Self-review

Before committing, read both files again with fresh eyes, and fix what you find inline:

1. **Breadth and depth**: every part of the feature, every product worth comparing, every standard
   and dependency involved, and every dimension that applies (accessibility, locales, time, scale,
   security, offline, existing data, removal) was researched as far as the
   [discovery effort](#discovery-effort) asks: at `high`, each until new sources stopped adding.
   Every fact comes from a source read in this session, not from memory.
2. **Coverage**: every topic of the discovery's **Approaches** and **The proposal** sections ends up
   in exactly one question or settled point.
3. **Sources**: every claim in the questions is backed by the discovery or a linked source, and
   every link resolves to an existing heading.
4. **Linear reading**: nothing is referred to before it is introduced, and each question can be
   answered without opening the discovery.
5. **Options**: each one is a self-contained sentence; the recommended one is first; combinations
   and dependencies are stated; no question is decided by an earlier answer.
6. **What is asked**: no question you could have settled, and no settled point that only the human
   can decide, like a scope boundary or a new dependency.
7. **The block**: the time estimate is honest, and every item names a subject, not a number.

## Red flags

| Thought                                                   | Reality                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "I know this kind of feature, I can skip the research"    | Products differ exactly where the proposal is silent. Read how they do it, and cite them.        |
| "I remember how this library or browser behaves"          | Your knowledge may be outdated. Verify it in today's documentation, and cite it.                 |
| "Two products and one standard is enough research"        | Keep going until new sources stop adding. Breadth first: list every part before going deep.      |
| "This would take a long time, the human is waiting"       | Nobody is waiting: the workflow is asynchronous. Depth now saves rounds of questions later.      |
| "I'll ask, the human knows the codebase better"           | The code is there to read. Ask only what the code, the docs, and the decisions cannot answer.    |
| "The proposal says X, so X it is"                         | A proposal is a first draft. Check it against what you found, and turn each gap into a question. |
| "I'll ask this one now and the follow-up in a next round" | Every round costs the human a context switch. Anticipate, and ask the follow-up now.             |
| "The options are clear enough as short labels"            | The human reads each option without the context. Write each as a full sentence.                  |
| "I'll recommend in the discovery, it saves time"          | Discovery holds evidence. Recommendations go with the questions, where the human weighs them.    |
| "Nobody will notice I didn't read that page"              | The next agent builds on your sources. Cite what you read; list the rest under **Not checked**.  |

With `ura`, run `ura check` on the feature's folder last: it verifies the files' structure, the
questions' numbering and answer lines, and their links.

## Commit

Commit both files: `discovery(<slug>): <feature name>`, or what the new round is about. The commit
message body is the first line of the block, for example "12 questions, about 30 minutes." Then stop
at the gate.
