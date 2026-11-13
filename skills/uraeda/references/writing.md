# Writing for the human

How every file the human reads is written: a round of questions, the inbox triage, the decisions
check, a spec, a decision, a plan to review, and a pull request. The steps link here instead of
repeating it.

The human reads a file once, top to bottom, when they have time, often days after the step that
wrote it, and often with three other features in their head. They have not read the discovery, the
code, or your session. Their time goes into deciding, not into searching or decoding.

With `ura`, `ura check` measures what this file can count: it reports a missing or misplaced part as
an error, and a limit passed as a warning. A file waiting for the human should have neither.

## Every document

1. **Write in the order the reader reads.** Never refer to something before it is introduced, and
   give each part the context it needs where it is needed.
2. **Short sentences.** A sentence holds one idea. Past 25 words it usually holds two: split it, or
   make it a list. `ura check` warns on a longer one, outside quotes, tables, and code.
3. **Plain words, and the human's own.** Use the words of the proposal and of the product. A word
   you coined, for a mechanism, an option, or a state, is replaced by plain words, or defined with
   an example where it first appears. A name from the code is linked to it.
4. **Never an ID the reader has not seen.** A ruling "R7", a comment "C3" of an old review, or
   "option B of Q2" means nothing days later. Say the subject: "with a single task whose due date
   moves (B in Q2)".
5. **One way to show each kind of content.** Tables carry comparisons. Quotes carry what a source
   says, with its link. Mermaid diagrams carry flows, sequences, and states that a list would make
   hard to follow. Prose carries the rest.
6. **No padding.** A sentence that changes nothing the reader decides or checks is cut: restating
   the heading, announcing what follows, thanking, hedging. Length comes from content.
7. **Each thing said once.** A rule or a behaviour lives in one place of the file, and the rest
   links to it. When you change it, search the file for its old wording: a stale sentence left
   behind is read as the truth.

## The block

Every file waiting for the human opens with a `> [!IMPORTANT]` block, right after its title. It
orients them: the details stay in the file.

- **The first line says what is asked, and the time it takes**: "7 questions and 1 follow-up, about
  20 minutes.", "Spec to review, about 15 minutes." Counts are in digits, and `ura check` compares
  them with the file.
- **Then what most needs their attention, one line each, most important first**, each named by its
  subject, never by a number the reader has not met. First come the choices you made for them that
  change what they get. Then what lasts beyond the feature, a risk, a cost, and what is not verified
  yet. A guard you relaxed is said as what an attacker could then do.
- **A handful of items.** Past 7, the reader skims and misses the line that mattered, and
  `ura check` warns. The number is there to keep the block sharp, never to hide a choice: group
  related items, and when more than 7 still deserve a line, keep them all and let the warning stand.
- **No chores.** A rewritten file, a merge, or a rebase is no choice to weigh.
- **On a revision**: what changed since their last review.

**The time is computed, not guessed**, so the human can trust it. Count the words the human reviews
at 250 a minute, for a spec everything but the "More scenarios" lists and `## History`, add a minute
per question, follow-up, mockup, or changed decision, and round up to the next 5 minutes. A round of
2,400 words with 7 questions and 1 follow-up is 9.6 plus 8, about 20 minutes. On a revision, count
only what changed, and `## Your review`. A round without follow-ups leaves them out of its first
line.

**Once the human has answered or reviewed, the block becomes a note**: `> [!NOTE]`, its first line
the outcome and its date, "Answered on 2026-10-08", "Approved on 2026-10-09", "Changes requested on
2026-10-09" with their feedback in one line. Its items stay as they were. An answered round keeps
the human's answers and notes word for word: this note, a format rewrite, and a repaired link are
the only edits it takes. A revised spec moves it to the top of its `## History`, and a revised plan
keeps it under the new block.

## A round of questions

A round, `clarifications-NN.md`, is written from
[its template](../assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md). The
[example's round](../assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md) shows
one, and the
[example change's round](../assets/example/specs/changes/2026-10-14-tasks-reappear/clarifications-01.md)
a change's. In order, a round holds:

- the block;
- `## Context`, with its parts under `###` sub-headings;
- `## Check these`, the points you settled that the human may object to, left out when empty;
- the questions, `## Q1: ...`, each followed by its follow-ups, `### Q1.B: ...`;
- `## Settled without the human`, the other settled points, left out when empty;
- the line `**Notes:**`, left empty for the human.

The inbox triage and the decisions check follow the same rules, with a free Context and no settled
points.

### The round's block

Its first item is the verdict on the proposal. It starts "Verdict:", then "worth building as
proposed", "worth building, with changes", or "not as proposed", then why, in a sentence. A change's
verdict comes from its investigation. The human learns whether their proposal holds before any
question. Then the items: the choices that last beyond the feature, the questions that work
together, the gaps in the proposal, a risk, and the points to check.

### The Context

Four parts, under fixed sub-headings, in this order: a missing one fails `ura check`.

- `### Goal`: how you read the proposal, in the human's own words, in a sentence or two: what it
  asks for, for whom, and what success looks like. **This is the first thing they check.** When the
  proposal names a product as its model, "pretty much web lazygit", say so here: that product's
  behaviour, in the area the proposal is about, is the default for what the round does not ask, and
  each place you depart from it is named. A wrong reading caught here costs one line. Caught after
  nine questions built on it, it costs the round.
- `### Today`: what exists today, with links to the code. A table when products or approaches
  compare.
- `### Scope`: what the feature covers, and what you left out.
- `### Sources`: the code, the products, and the documentation read, and a link to the discovery
  file. A change has no discovery file: its Sources link the code and documentation directly.

From round 02, `### Since the last round` comes first: what happened since, and why new questions
came up. The human returns after days away, and needs the thread before the goal.

### Questions

- **Each question is a card the human decides from alone.** Its heading is the question, as a full
  sentence. Then its context, a paragraph starting "Why it matters:", its options, and
  `**Answer:**`, left empty.
- **The context holds what deciding needs**, without the discovery open: what exists today, how
  others do it, the sources linked or quoted, and what each answer leads to. Give it as much as
  deciding needs, and nothing that weighs on no option. A comparison gets a table.
- **A choice that is hard to picture opens with an example.** A line starting "Example:" sets one
  concrete case with real names and values: "'Water the plants' repeats every Monday. You complete
  it on Monday 5 October." Each option then says what happens in that case. A question whose options
  are already concrete, a library or a name, needs none.
- **A choice about a look is shown**, each option with its variant or prototype: see
  [visual questions](discovery.md#visual-questions).
- **"Why it matters" says what the choice decides, and what it costs later**, in a sentence or two.
  It tells the human how much thought the question deserves.
- **Questions that depend on each other say so**, in both: "Where the choice appears is Q6".
- **A question that only matters for one answer is a follow-up**, `### Q2.B: ...`, right after its
  parent, starting "Only if you picked B in Q2". Never a separate question an earlier answer
  decides. Each option that needs one gets its own, `Q1.B` and `Q1.C`, never one shared by both. An
  earlier round's question is cited by file and number.

### Options

- **Each option is a full sentence, in bold**, that reads without the context above: "Create the
  next occurrence as a new task when the current one is completed", not "On completion".
- **The recommended option comes first, as A**, labelled "A (recommended)", with a "Why
  recommended:" line. The human reads your view of the evidence first, and argues with it.
- **Each option has a `[pro]` and a `[con]` line**, one fact each, short enough to compare.
- **A consequence the human will meet is said as what happens to them**, not as a property of the
  option. "Opening an old project starts every run it missed" is weighed. "Missed runs are caught
  up" is skimmed, and reversed at the spec.
- **Options exclude each other**, unless the question says which combine. When the best answer is a
  combination, the "Why recommended" line names it: "A, with C on top".
- **When the options are ways to build something the proposal did not ask for, one option is not to
  build it.**

### Answers

The human answers with one or more option letters, their own words, or both. Their words win over
the option's wording. An answer without a letter answers the question, and closes its follow-ups. A
follow-up needs an answer only when its parent's answer starts with its letter. Letters of options
that exclude each other, "A and C", are ambiguous: ask again in a new round.

The workflow moves on only when every question that applies is answered. If a round is `answered`
with questions left blank, set its status back to `awaiting-human`, name the blank questions in the
block's first line, "2 questions still need an answer: Q3 and Q5", and commit.

### Settled without the human

A settled point starts with its bold subject, then what was chosen and why, then a link to its
source: `- **Undoing a completion** puts back what completing changed. See ...`. Subjects are unique
in the round: the human comments on a point by its subject. A point that depends on an answer goes
into that answer's option instead.

- `## Check these`, between the Context and Q1: what the human may want to object to. A choice
  beyond the proposal, a default they will meet every day, an assumption that could be wrong, each
  said as what happens to them. This is where their objections land, at the cost of one line each.
- `### Behaviour`, under `## Settled without the human`: what users will notice, that the proposal,
  the constitution, and the decisions already settle.
- `### Under the hood`, under the same heading: rare. A code-only choice the human would want to
  know of. The rest of the code's choices stay in the discovery: the human does not read them here.

### The notes

Under `**Notes:**`, the human writes what no question asked. A comment on a settled point is a
bullet starting with that point's bold subject:
`- **Undoing a completion**: Keep the undo, but say what it restored.` Notes are read like answers:
they often carry a requirement, and a spec that misses one is sent back.

## A spec

A spec is written from [its template](../assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md), in
the order [Spec](spec.md#spec-document) gives. The human approves it in one sitting, with nothing
else open.

- **The block's first item starts "You approve"**, and says in one sentence what approving commits
  to.
- **Then what you chose for them**: each answer you read one way among several, and each default or
  assumption that changes what users get. Write each so one word flips it: "Read as X. The other
  reading, Y, would [cost]."
- **Answers are paraphrased, never cited by number**: "the due date moves", not "A in Q2".
- **Length goes to what the human decides.** The part they review, everything but the "More
  scenarios" lists and `## History`, aims at 2,000 words, and `ura check` warns past 2,500. A longer
  spec moves the build's details to the plan and the rarer scenarios under "More scenarios".
- **The split rule: a feature is split only when building one part changes how the next is
  designed.** The next part is then specified once the first is built. Size is never a reason: no
  count of stories, scenarios, or decisions makes a spec too large. A split is a question of the
  round, with the recommended split as option A.

## A decision

A decision is written from [its template](../assets/templates/specs/decisions/decision-topic.md), as
[writing a decision](spec.md#writing-a-decision) describes. An agent reads it alone, before a task,
without the feature that made it. The human approves each of its lines.

- **The intent first**, in two or three sentences before `## Rules`: the choice, and what it
  protects.
- **Few rules.** Each added rule lowers how well the others are followed. A decision that needs many
  is holding a feature's spec: cut what any agent would do anyway, and what the code already holds.
  `ura check` warns past 10 rules, and its message offers a split: cut or merge rules first. The
  room under that number is not there to be filled, and a second decision is the last resort.
- **One keyword per rule, and SHOULD by default.** A rule is a MUST only when the human said always
  or never, or when breaking it loses work or opens the system. What the human prefers is a SHOULD.
  MUST rules come first, then SHOULD, then MAY.
- **The Why gives the reason, in the present tense, in a few sentences.** An agent applies a rule to
  a case it does not name from its reason. No history: who asked what, and when, is the record's. It
  quotes the human only when their words are the reason. It ends with at most one link, to the
  feature's record. `ura check` warns past 80 words.
- **Alternatives and consequences are short lists**: the options an agent could propose again, with
  why they lose, and the costs the human accepted, with no code facts. `ura check` warns past 3
  alternatives and 4 consequences.
- **Terms are defined in the decision**, since it is read alone.
- **Applies to names folders and kinds of features**, never the files inside a folder.

## Self-review

Before committing a file for the human, read it again as they will, and fix what you find:

1. **The Goal, or "You approve"**: would the human recognise their request in it, in their words?
2. **Each question alone**: can it be answered from its card? Is it theirs to answer?
3. **The block**: the counts match, the time follows the formula, and everything you chose for them
   that changes what they get is there.
4. **The words**: no term of yours undefined, no ID from a file they have not seen, no sentence that
   decides nothing, no old wording left from an earlier draft.

With `ura`, run `ura check` last.
