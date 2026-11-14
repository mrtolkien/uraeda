# Discovery and questions

Researches a proposal in depth, in the code and outside it, settles what the human's goals already
settle, and asks the human, in one file, what only they can answer.

- **Runs when**: a folder has a `proposal.md` and no `clarifications-01.md` (round 01), or another
  step needs the human to decide something new (the next round, see
  [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions))
- **Writes**: `discovery-NN.md` and `clarifications-NN.md`, with the round's number; in the human's
  notes, the round's research report and the wiki's notes it adds or corrects
- **Ends at**: a human gate, `clarifications-NN.md` with `status: awaiting-human`

Three things come out of this step, for three readers:

- **`clarifications-NN.md` is the round, for the human**: how you read their proposal, the few
  questions only they can answer, and what you settled that they may object to.
- **`discovery-NN.md` is what the later steps rely on, in git**: the findings the round's questions
  and settled points rest on, each with its source, and the map of the code. The spec builds on it,
  the plan and every implementer reuse its map, and any agent can resume from it. The human opens it
  only through a question's link.
- **The research report is the long version, in the human's notes**: how established products and
  standards handle this kind of feature, the libraries involved, and the approaches to each topic
  compared, every fact with its source. What outlasts the feature also goes into the wiki. See
  [Notes](notes.md#research-reports). Without notes, the report's content that a question or a later
  step needs goes into `discovery-NN.md`, and the rest is not written.

Nobody waits on you, and nobody will notice what you skipped until it is expensive: a shallow
discovery turns into wrong questions, a spec sent back, and fixes after the merge. Spend the time on
understanding the problem better than the proposal does. Then spend the human's time on almost none
of it.

## Discovery effort

The proposal's `discovery` field says how far the human wants the research to go. Without the field,
the effort is `high`.

- **`low`**: the feature is small and its direction clear. Read the code, the decisions, the guides,
  and the documentation of the dependencies involved. Do not compare products or search for
  alternatives: a topic's approach is often "reuse what exists".
- **`medium`**: also read how a few established products or libraries solve the problem, from their
  official documentation.
- **`high`**: everything this file describes: products, standards, libraries, known pitfalls, and
  benchmarks where performance is a criterion.

The level scales the research, never the rules: every fact still has its source, and every question
still has a recommendation. When a topic turns out bigger than the level suggests, go deeper on it,
and say so in the block. Leave the proposal's field as the human wrote it.

## Read first

1. `proposal.md`: the human's words. Read it for its intent as much as for its requests, note any
   product it names as its model, and open every image it links.
2. Earlier rounds, if any, and what sent the workflow back here: a review file, or a step's reason.
3. The constitution, the decisions whose **Applies to** covers the feature, and the project's guides
   for the area. The records in `specs/done/` of the features this one touches.
4. The human's notes about the area, when they have notes: the inbox's notes on it, and the wiki's
   notes on the products, libraries, and standards you are about to research. They save searches;
   their facts are leads, read again at their source before a question relies on one. See
   [the wiki](notes.md#reading-it).
5. Other features in flight: list the open feature branches, and read the specs, mockups, proposed
   decisions, and data changes of those that touch the same code, views, or decisions
   (`git show <branch>:specs/...`). Two features changing the same data or the same decision is a
   finding. So are two that draw the same thing in two ways.

## Scope check

A feature is the whole proposal. Propose a split only when building one part changes how the next is
designed, as [the split rule](writing.md#a-spec) says: an offline mode whose design depends on how
the sync it builds on turns out. Then the split is the first question of the round, with the
recommended split as option A, and you research the first piece in depth.

Several independent pieces, "reminders, sharing, and a calendar view", stay in one feature. When
they share a look or components, say in the discovery which piece builds the shared parts first:
views built side by side, each on its own, drift apart.

## Investigate in depth

- **Beyond the project.** The code shows what exists, not what the feature should be. How
  established products solve the problem, what standards say, and what went wrong for others are not
  in the repository.
- **Beyond your own knowledge.** What you know about a product, a library, or a browser is a lead to
  verify. Every fact in the discovery comes from a source you read in this session, with its link.
- **Broad before deep.** First list every part of the feature, every product worth comparing, every
  dependency involved, and every existing action the feature meets. A topic you never listed is one
  you never researched.
- **Until another source would not change a choice.** One source per topic is a lead. Stop when the
  last ones only confirmed what you had.
- **The dimensions the proposal does not mention**, when they apply: the narrowest screen, the
  keyboard, accessibility, languages, time zones, scale, security, offline and errors, the data
  users already have, and how the feature is turned off.

If your harness can run agents in parallel, give each topic or product its own, and merge their
findings.

**The code**

- Read the code the feature touches, down to the data it stores and the interfaces it exposes. List
  every place that reads or writes data the feature may change.
- Trace the proposal's path through the code, step by step. Then trace every existing action that
  meets the feature: undo, delete, edit, an empty field, a narrow screen. Each one that behaves
  differently with the feature is a finding.
- List who owns each rule the feature touches, and where it is copied:
  [one home per rule](code-quality.md#one-home-per-rule).
- Find the patterns the feature should follow, and what is in the way, like a unit over the
  project's limits, which a task must split first
  ([extract, don't grow](code-quality.md#extract-dont-grow)).
- List the files the feature will likely change, under every option, and the tests that guard
  behaviour it changes, by file and name, for the spec's
  [replaced behaviour](spec.md#replaced-behaviour).
- Check recent commits on the files you read: they explain choices the code does not.

A problem you meet outside the feature is dropped, unless it passes the two tests of
[agents' notes](notes.md#agents-notes).

**Outside the code**

- Learn what this kind of feature usually looks like, from the official documentation of established
  products. Look for what their users expect that the proposal does not mention: editing one
  occurrence of a recurring event, undoing a bulk action.
- **When the proposal names a product as its model, study that one first and closest.** The human
  will review the spec against it.
- Read the standards and the documentation of the dependencies involved, for the versions the
  project uses.
- From all this, find the genuinely different approaches to each topic. Include "do nothing" and
  "reuse what exists" when they are real.

**Is it worth it, and can it work?**

- **Worth it**: weigh what the feature gives against what the human must then read, learn, and keep:
  concepts, settings, dependencies, maintenance. Your own effort is not a cost: never recommend the
  smaller build because it is less work for you. A deadline or a budget the human stated is theirs,
  and counts. When the evidence says the feature costs them more than it gives, say so, and make
  dropping or shrinking it the first question's recommended option.
- **Outside behaviour it relies on**: when a feature depends on how a library, a browser, or another
  tool behaves, and its documentation does not settle it, check it now. Read the dependency's
  source, run its tests, or write a throwaway experiment outside the repository. An experiment that
  takes an hour is cheaper than a question built on a guess. "Unverified" is a last resort, for what
  no experiment in reach can settle, like a paid service without an account. It then says why, the
  spec names it, and the plan's first task checks it.
- **Guards it relaxes**: an option that loosens a security rule, a permission, or a sandbox says
  what an attacker could then do, in a sentence a non-specialist understands: "any website open in
  your browser could read the project's code".

**Sources**: cite only pages you read. A fact seen only in a search result's summary is marked as
such where it is used. What you could not find or reach goes under **Not checked**, which is never
for work skipped.

**Later rounds** start from what triggered them, research only what is new, and link to earlier
rounds rather than repeating them.

## The research report

Write the long report first, in the human's notes, from
[the template](../assets/templates/notes/research.md), as
[research reports](notes.md#research-reports) says, with its sections in the template's order:
knowledge first, approaches last.

- **How other products do it**: one section per product, then **What they have in common**: what
  users may expect, whether or not the proposal mentions it.
- **Standards and libraries**: what matters for this feature, and the pitfalls, with versions.
- **Approaches**: one section per topic the feature has to settle, comparing its options against the
  same criteria. Every capability of **What they have in common** gets a topic, or a line in **Needs
  no choice**, which also holds the code-only choices.

Then put what outlasts the feature into the wiki: a product's behaviour into its `apps/` note, a
library's surprise into a gotcha, how a kind of feature works across products into its `topics/`
note. Link them from the report.

## The discovery file

Then write the round's file in git, from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/discovery-01.md). It is short: what
a later agent, without the notes, needs to check the round and build on it.

- **Why this round**: later rounds only.
- **Summary**: the feature in a few sentences, for an agent who reads nothing else, and a link to
  the research report.
- **Findings**: one section per finding a question or a settled point rests on, its heading what a
  question links to: what was found, in a few lines, with its source, never the wiki. A comparison
  of products a question needs is a table here.
- **The code**: the important reads, the proposal's path and the existing actions it meets, the
  rules and their owners, and the likely changes with the tests that guard them.
- **The proposal**: one section per constraint that cannot be met as written, ambiguity, or gap.
- **Worth it and feasibility**: left out when the feature is small and relies on nothing new.
- **Not checked**.

Every fact links to its source, and your own judgements are marked as such. Do not recommend or
choose here: recommendations go with the questions, and what you settle goes in the round.

## What to ask, and what to settle

A question costs the human a card to read and weigh. A point under **Check these** costs them a
line, and only if they object. So settle, and ask little.

**Always ask for authority the human has not given**, however sure you are of the answer:

- a change to what a decision says, or a conflict with the constitution;
- a relaxed guard, a new dependency the human must then trust, or a change to data users already
  have;
- a limit, a refusal, or a gate the proposal does not ask for;
- dropping or shrinking the feature, or cutting part of what the proposal asks.

**Within what they asked for, ask only when the answer changes what the human will see or live with,
and their goals do not choose between the options.** That is usually:

- what the feature is for, and where its scope ends, when the proposal leaves it open;
- a tradeoff between two things the human wants;
- a look, shown as variants: see [visual questions](#visual-questions);
- a default the user meets every day, where both ways are reasonable: what is on unless turned off,
  what happens when something was missed.

**Settle everything else**, within the constitution, the decisions, and the guides, and from the
product the proposal names as its model. Mechanisms the user never sees are yours: which library
call, where a value is stored, how a process restarts. So is where a rule is written down: an
existing decision first, as [the spec step](spec.md#new-decision-or-change) says. Put each settled
point in the round, as [settled without the human](writing.md#settled-without-the-human) describes:
what the human may object to under **Check these**, said as what happens to them.

Four limits on settling:

- **Never add a limit, a refusal, or a gate nobody asked for.** "`start` refuses a proposal without
  a Why" is not a detail: it is a question, or it is left out.
- **Being sure is not being allowed.** What needs the human's authority is asked, with your
  recommendation first.
- **Never settle against the human's words.** Where the proposal, a note, or an earlier answer
  speaks, it holds.
- **Never ask two rounds where one would do.** Anticipate what an answer would raise, and ask it
  now, as a follow-up.

If nothing needs an answer, the round has a single question confirming your reading: "A
(recommended). Go ahead with the scope above".

A project without a code-quality, a testing, or, for UI work, a preview decision is asked once
whether to adopt one: see [setting up a project](projects.md#setting-up-a-project).

## The questions file

Write it from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md), with
`status: awaiting-human`, as [a round of questions](writing.md#a-round-of-questions) describes: the
block with its verdict, the Context with your reading of the proposal first, **Check these**, the
questions sorted by impact, the other settled points, and `**Notes:**`.

The verdict comes from the discovery's **Worth it and feasibility**: "not as proposed" when the
feature costs more than it gives, "worth building, with changes" when the proposal cannot be met as
written.

## Question structure

```markdown
## Q2: When does the next occurrence appear?

Example: "Water the plants" repeats every Monday. You complete it on Monday 5 October.

The app cannot create tasks while it is closed. Todoist keeps a single task and moves its due date
on completion. This choice also decides what editing, deleting, and undoing mean for a repeating
task. More in [discovery](discovery-01.md#generating-occurrences).

Why it matters: it decides whether future tasks show, whether completed ones stay as a history, and
whether the app needs a notion of series.

- **A (recommended). Create the next occurrence as a new task when the current one is completed.
  Editing a task changes that task only.**
  - Example: a new "Water the plants" due Monday 12 October appears, and the completed one stays.
  - [pro] completed tasks stay in the list as a history; no notion of series to learn.
  - [con] the list grows by one task per completion.
  - Why recommended: it keeps the history with the simplest model.
- **B. Create the next 4 occurrences in advance, so they are always visible.**
  - Example: the tasks due 12, 19, and 26 October and 2 November are in the list from the start.
  - [pro] users can plan ahead.
  - [con] four times more repeating tasks in the list, and editing one occurrence needs the
    follow-up question below.

**Answer:**

### Q2.B: What does editing one occurrence change?

Only if you picked B in Q2. [...]
```

[Questions](writing.md#questions) and [options](writing.md#options) say how each part is written.
Number questions from Q1 in each round, and leave each `**Answer:**` empty.

**A conflict** with a decision is a question: change the proposal, or change the decision, which can
be narrowed, or given a case where it does not apply. A conflict with the constitution names the
principle and recommends changing the proposal. An exception holds only if the human accepts it in
their answer: it is then spelled out in the plan, which waits for their review.

## Visual questions

**A question whose options differ in how something looks or moves shows each option.** The human
cannot pick a layout, a control, or a motion from words, and will ask to see it. When the project's
preview cannot show it, use a [prototype](#prototypes). A small visual detail you cannot show is
settled, and the spec's mockup carries it; a direction for a whole view is never settled unseen. A
label's wording stays in words.

- **A few variants**, distinct: if two could swap their text unnoticed, drop one.
- **Drawn in the project's own look**, with its components, after reading its guides. A variant in
  another style is judged on its style.
- **For a view that exists, the variant is the real view, changed**, not a drawing of it: what the
  human picks is then what gets built.
- **Each option links its variant** in a paragraph of its own, under the option's sentence, then
  gives its `[pro]` and `[con]`.

```markdown
- **A (recommended). A thin line, which thickens under the pointer.**

  [Thin line](/src/SidebarHandle.stories.tsx#ThinLine)

  - [pro] nothing new to see until the pointer is there.
  - [con] harder to find.
  - Why recommended: it keeps the sidebar quiet.
```

With an active preview decision, variants are stories, written where the decision puts them. Before
linking one, set the worktree up as the project asks, start the preview with the decision's
`preview-command`, and look at each variant, at the narrowest and the widest width the project
serves: a story that renders can still read badly. The human may answer with a mix, "A, with B's
grip". Commit the variants with the round. The spec keeps the picked one, as
[mockups](spec.md#mockups) describes.

### Prototypes

A round may also compare looks as throwaway prototypes, in any format: HTML pages, SVGs, generated
images. Use them when building each look with the real components costs too much, like a whole
layout or a colour scheme. They go in the feature's `mockups/` folder, each option linking its own.
They are not the spec's mockups: the [plan step](plan.md#delete-the-prototypes) deletes them, and
git keeps them.

## Self-review

Before committing, read both files again, and fix what you find:

1. **Your reading**: `### Goal` says what the human asked, in their words, with the product they
   named. Nothing in the round goes against the proposal.
2. **Each question**: the answer changes what the human sees or lives with, and you would not bet on
   your recommendation. Otherwise it is a settled point. A look is shown.
3. **Each settled point**: it adds no limit or refusal nobody asked for, and one the human may
   object to is under **Check these**, said as what happens to them.
4. **Coverage**: every topic of the report's **Approaches**, or of your research without notes, and
   of the discovery's **The proposal** ends up in one question or one settled point, or stays in
   **Needs no choice**. Every finding a question links is in the discovery file, with its source.
5. **Evidence**: every claim rests on a source you read. Outside behaviour the feature relies on is
   checked, or says why no experiment in reach could check it.
6. **The writing**: the [writing self-review](writing.md#self-review).

With `ura`, run `ura check` on the folder last.

## Commit

Commit both files: `discovery(<slug>): <feature name>`, or what the new round is about, with the
block's first line as the body. The report and the wiki's notes are in the human's notes, never
committed. Then stop at the gate.

**A round asked in the session**, when the human asks for it, writes the discovery file and the
report the same way, then asks the questions in the session, as
[In a session](conventions.md#in-a-session-with-the-human) says. Commit the discovery file alone,
then write the spec in the same session, whatever the human's settings cut: until the spec is
committed, the answers exist only in the session. Its `clarifications` field is the round's number.
