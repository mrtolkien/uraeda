# Writing for the human

The writing rules of every document written for the human. They cover a round of questions, the
inbox triage, the decisions check, a spec, a decision, a plan to review, and a pull request. Each
rule says why it exists, and the limit it sets. The steps link here instead of repeating the rules.

The human reads a document once, top to bottom, when they have time, often days after the step that
wrote it. They have not read the discovery, the code, or the agent's session. Every rule below
serves that reader: their time goes into deciding, not into searching or decoding.

With `ura`, `ura check` measures some of these rules as warnings:

- on a file waiting for the human (`status: awaiting-human`): `block.count`, `block.items`, and
  `writing.sentence`, and on a spec, `spec.length`;
- on every decision: `decision.rules` and `decision.order`;
- on a decision edited on a branch after its spec's approval: `decision.unapproved`.

Warnings do not fail the check, but a waiting file should have none. The parts are errors:

- `sections.missing` for a missing Context part, `sections.unknown` for a heading the template does
  not have, and `sections.order` for one out of order;
- `settled.group` for a settled point outside a group;
- `edges.importance` for an edge case's importance other than high, normal, or niche;
- `review.answer` for an item of `## Your review` that is not a bold `**C<n>**`, its comment in
  parentheses, and `done` or `declined`;
- `decisions.item` for an item of `## Decisions` that is not a bold `New:` or `Changed:` with a link
  to the decision's file, or a bold `Removed:` with its file's name in code.

See [The `ura` CLI](cli.md).

## Every document

1. **Write in the order the reader reads.** Never refer to something before it is introduced, and
   give each part the context it needs where it is needed. The reader cannot go back to a part they
   have not read yet.
2. **Sentences of at most 25 words.** A longer sentence holds two ideas, and the reader keeps the
   first in mind while parsing the second. Split it, or turn it into a list. `writing.sentence`
   warns on a sentence over 25 words, outside quotes, tables, and code; a link's text and inline
   code do not count.
3. **Define a term at its first use.** A term the proposal, the project's UI, or a common dictionary
   does not use gets a definition in the sentence that first uses it. A name from the code is linked
   to it. The reader learns the term once, where it appears, instead of guessing.
4. **Never an ID from a file the reader has not seen.** A ruling "R7", a discovery topic, a comment
   "C3" of an old review, or an approach's code name means nothing. The reader never opened that
   file. Name the subject instead, and link the file for more.
5. **Never cite an answer by its number alone.** "With B in Q2" makes the reader scroll back to find
   what B was. Say what it chose: "with a single task whose due date moves (B in Q2)".
6. **One way to show each kind of content.** Tables carry comparisons, across products or options.
   Quotes carry what a source says, in its words, with its link. Diagrams carry flows, sequences,
   and states. Prose carries the rest. The reader recognizes the kind at a glance.
7. **Diagrams are Mermaid code blocks.** Draw a flow, a sequence, or states that a list would make
   hard to follow in a fenced code block whose language is `mermaid`. Use a `flowchart`, a
   `sequenceDiagram`, or a `stateDiagram-v2`. It reads as text in any editor, and renders on GitHub
   and in Uraeda. A diagram never repeats as a list what the text around it says. See
   [Markdown](conventions.md#markdown).
8. **No padding.** A sentence that changes nothing the reader decides or checks is cut: restating
   the heading, announcing what follows, thanking, or hedging. Length comes from content, never from
   filler.

## A round of questions

A round, `clarifications-NN.md`, is written from
[its template](../assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md). The
[example's round](../assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md) shows a
first round, kept as a record once answered. The
[example change's round](../assets/example/specs/changes/2026-10-14-tasks-reappear/clarifications-01.md)
shows a change's round waiting for the human. In order, a round holds:

- the `> [!IMPORTANT]` block, right after the title;
- `## Context`, with its parts under `###` sub-headings;
- the questions, `## Q1: ...`, each followed by its follow-ups, `### Q1.B: ...`;
- `## Settled without the human`, with its points under `###` groups;
- the line `**Notes:**`, left empty for the human.

The inbox triage and [the decisions check](decisions-check.md) follow the same rules, with two
exceptions. Their Context is free text without parts. They have no settled points.

### The notes

A comment on one settled point is a bullet at the end of the notes, starting with that point's bold
subject. Its further lines are indented by two spaces. The web UI writes comments on settled points
this way, and a human can write them by hand.

### The block

9. **The first line counts, in digits, and gives the time.** "7 questions and 1 follow-up, about 35
   minutes." The human decides from it whether to start now. Digits are what `block.count` reads: it
   warns when the counts differ from the round's questions and follow-ups. A round without
   follow-ups leaves them out: "2 questions, about 5 minutes."
10. **The verdict is the first item.** It starts "Verdict:", then one of three phrases: "worth
    building as proposed", "worth building, with changes", or "not as proposed". Then, in a
    sentence, why. The human learns first whether their proposal holds, before any question. It
    comes from the discovery's **Worth it and feasibility**, and for a change from the
    investigation. The verdict stays when the block becomes a record.
11. **Then what matters most, by subject.** One line each, most important first:
    - the choices that last beyond the feature;
    - the questions that work together;
    - the gaps in the proposal;
    - a risk;
    - a relaxed guard, said as what an attacker could do;
    - the settled points to check.

    Each names a subject, never a question number: the reader has not seen "Q4" yet.

12. **At most 7 items, the verdict included.** A longer block stops orienting: the reader skims it,
    and misses the line that mattered. The details stay in the file. `block.items` warns on an
    eighth item.

### The time estimate

13. **The time is computed, not guessed.** Count the words of the file, the block to the notes, at
    250 a minute. Add a minute per question and per follow-up. Round up to the next 5 minutes. A
    round of 2,400 words with 7 questions and 1 follow-up is 9.6 plus 8, about 20 minutes. The same
    formula gives the same time to every agent, so the human can trust it.

### The Context

14. **The Context has four parts, under fixed sub-headings, in this order.** The human finds each
    fact where every round puts it. A missing part fails `ura check`.
    - `### Goal`: what the proposal asks for, and for whom, in a sentence or two, in the human's
      terms. The human sees at once whether you read their intent right.
    - `### Today`: what exists today, with links to the code. A table when products or approaches
      compare.
    - `### Scope`: what the feature or change covers, and what it leaves out.
    - `### Sources`: the code, the products, and the documentation read. In a feature's round, a
      last bullet links the discovery file, whose topics each question links. A change has no
      discovery file: its Sources link the code and documentation directly.
15. **From round 02, "Since the last round" comes first.** `### Since the last round` says what
    happened since the last round, and why new questions came up, with a link to that round. The
    human returns to a feature after days away, and needs the thread before the goal.

### Questions

16. **Each question is a card the human decides from alone.** Its heading is the question, as a full
    sentence ending with a question mark. Then its example when it has one, its context, a paragraph
    starting "Why it matters:", its options, and `**Answer:**`, left empty.
17. **An abstract choice opens with an example, and each option gives its outcome.** When the
    options are rules or behaviours that are hard to picture, a line starting "Example:" sets one
    concrete case, with real names and values: "'Water the plants' repeats every Monday. You
    complete it on Monday 5 October." Each option then says, in one line, what happens in that case.
    The human compares outcomes they can picture, instead of abstract rules. A question whose
    options are already concrete, such as a library or a name, needs no example.
18. **"Why it matters" says what the choice decides, and what it costs later.** One or two
    sentences, after the context and before the options. It tells the human how much thought the
    question deserves.
19. **Short, adequate context.** A question's context holds what deciding it needs, without the
    discovery open. That is what exists today, how others do it, the sources linked or quoted, and
    what each answer leads to. The human answers from the card, and opens a link only to dig deeper.
    - It stays short: the example carries the stakes, so the context adds only what the example does
      not show. A comparison gets a table, a flow a diagram, and the rest stays in the discovery,
      linked.
    - It has no padding: a sentence that changes no option's weight is cut.
    - Dependencies on other questions are said in both: "Where the choice appears is Q6".
    - It links the discovery topic it relies on, for a reader who wants more.

### Options

20. **Each option is a self-contained sentence, in bold.** "Create the next occurrence as a new task
    when the current one is completed", not "On completion". The human reads options side by side,
    without the context above. Name every detail that matters, like the field a rule is typed in.
21. **The recommended option comes first, as A.** It is labelled "A (recommended)", with a "Why
    recommended:" line under its pros and cons. The human sees the agent's reading of the evidence
    first, and can disagree with it.
22. **Under each option, a `[pro]` line and a `[con]` line.** One fact each, short enough to compare
    across options at a glance.
23. **A point that depends on an answer goes into that option.** "Undo restores the previous due
    date" belongs under the option that moves due dates, not among the settled points. The human
    weighs it with the choice it follows from.

### Settled without the human

24. **Settled points sit in three groups, in this order, each left out when empty.** The human
    checks the first group closely, reads the second, and skims the third. Every point sits in one
    group: a point outside a group fails `ura check`.
    - `### Check these`: what the human would want to object to. A scope cut, a choice beyond the
      proposal, an assumption that could be wrong.
    - `### Behaviour`: what users will notice, settled within the constitution and the decisions.
    - `### Under the hood`: choices in the code only, which users never see.
25. **A settled point starts with its bold subject**, continued by what was chosen and why, then a
    link to its source: `- **Undoing a completion** puts back what completing changed. See ...`.
    Subjects are unique in the round: the human comments on a point by its subject.

## A spec

A spec, `spec.md`, is written from
[its template](../assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md), in the order
[Spec and decisions](spec.md#spec-document) gives. The human approves it in one sitting, without
opening anything else, so each rule below keeps it short and whole.

26. **The block's first item starts "You approve".** It says in one sentence what approving commits
    to. The human knows what is at stake before any detail. The first line still gives the time.
27. **At most 7 items, "You approve" included.** Then what most needs attention, most important
    first, as for a round. `block.items` warns on an eighth item.
28. **The time counts the reviewed part.** The reviewed part is every section but the "More
    scenarios" lists and `## History`. Count its words at 250 a minute. Add a minute per mockup and
    per changed decision. Round up to the next 5 minutes. A reviewed part of 1,800 words with 2
    mockups and 1 changed decision is 7.2 plus 3, about 15 minutes. On a revision, count only what
    changed since the last review, and `## Your review`: the human reads the rest again only if they
    want to.
29. **Answers paraphrased, never cited by number.** The block and the spec say what the human chose,
    in words: "the due date moves", not "A in Q2". A review comment is named by its subject, never
    "C1" alone. The human reads the spec days after the round, without it open.
30. **Git chores stay out of the block.** A rewritten file, a merge, or a rebase is no choice to
    approve: the commits record it. An item spent on one hides an item that mattered.
31. **Each rule stated once.** A rule lives in one part of the spec, or in a decision, and every
    other mention links to it. Two copies drift, and the human reviews the same rule twice.
32. **The reviewed part aims at 2,000 words.** Length goes to what the human decides. The build's
    details are the plan's, and the rarer scenarios go under "More scenarios". `spec.length` warns
    past 2,500 words on a spec waiting for review.
33. **The split rule: past 6 stories, 30 scenarios, or 2 changed decisions, the discovery proposes a
    split.** A larger spec cannot be approved in one sitting. The split is a question of the round,
    with the recommended split as option A.

## A decision

A decision, in `specs/decisions/`, is written from
[its template](../assets/templates/specs/decisions/decision-topic.md), as
[writing a decision](spec.md#writing-a-decision) describes. Agents read it before every task it
applies to, and the human approves each of its lines.

34. **The intent first.** Two or three sentences before `## Rules`: the choice and what it protects.
    A reader who stops there knows what the decision is for. A decision states intent, not
    mechanism: see [what is a decision](spec.md#what-is-a-decision).
35. **One sentence per rule**, then how it is checked: "Checked by review." A rule holding two ideas
    is two rules, or one too detailed.
36. **Strongest first.** A rule's strength is its first RFC 2119 keyword. MUST and MUST NOT come
    first, then SHOULD and SHOULD NOT, then MAY, the most important first within a strength.
    `decision.order` warns on a rule stronger than the one before it.
37. **At most 10 rules.** Past 10, merge rules by concept, or split the topic into two decisions.
    `decision.rules` warns on an eleventh rule.
38. **The history stays in the record.** How the choice came about, and the investigation behind it,
    stay in the feature's record, linked from **Why**. The decision says what holds now.

## Self-review

Before committing a document for the human, read it again as its reader, and fix what you find:

1. **Each question's card alone.** Read each question, its context, "Why it matters", and its
   options, as if nothing else were on the page. Can it be answered from that card? If not, the
   missing fact goes into the card, not into a link.
2. **The block.** The counts match the round, and the time follows the formula. The verdict comes
   first with one of its three phrases, and every item names a subject. At most 7 items.
3. **Sentences.** None over 25 words, no term undefined at its first use, no ID from an unseen file,
   no answer cited by its number alone.
4. **Padding.** Every sentence changes how the reader decides or what they check.
5. **The parts.** The Context has its four parts, "Since the last round" first from round 02, and
   every settled point sits in its group.

With `ura`, run `ura check` last: it reports the parts that are missing as errors, and what drifts
from the limits as warnings.
