# Discovery and questions

Investigates a human proposal in depth, in the code and outside it, then asks the human what only
they can decide.

- **Runs when**: a spec folder has a `proposal.md` and no `clarifications-01.md` (round 01), or
  another step needs the human to decide something new (the next round, see
  [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions))
- **Writes**: `discovery-NN.md` and `clarifications-NN.md`, with the round's number: `01`, `02`, ...
- **Ends at**: a human gate, `clarifications-NN.md` with `status: awaiting-human`

`discovery-NN.md` is the knowledge base of the feature: what this kind of feature usually looks
like, how established products and standards handle it, and what the code has today, every fact with
its source. Later steps build on it: the questions link to its paragraphs, the spec builds its
behaviour and design on it, and the plan reuses its map of the code. The human does not read it by
default: they follow the questions' links when they want more.

## Read first

1. `proposal.md`
2. Earlier rounds, if any: their discovery files, questions, and answers. Build on them, and never
   edit them: a round is a record of what the human was asked and answered.
3. The `## Review` section of `spec.md`, or the reason given by the plan or implementation step, if
   one sent the workflow back here
4. The constitution, and the active decisions whose **Applies to** covers the feature

## Investigate in depth

Discovery is the cheapest moment to find the right approach: a shallow discovery turns into bad
questions, a weak spec, and rework. This is where the hard work happens, without the human: nobody
will ask you to go deeper, so decide yourself what each topic deserves. A question you could have
answered yourself costs the human far more than a longer discovery.

If your harness can run agents in parallel, give each topic its own agent, and merge their findings
into one file. Go deep on both sides.

**The code**

- Read the code the feature touches, and follow it to the data it stores and the interfaces it
  exposes.
- Trace the proposal's user path through the code, step by step, then every existing action that
  meets the new feature: undo, delete, uncheck, edit, empty fields. Each one that behaves
  differently with the feature is a finding.
- Find the existing patterns the feature should follow, and the problems in the way.
- List the files the feature will likely change or add, under every option: never assume an option
  the human has not chosen.

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
- From all this, find at least two or three genuinely different approaches per topic, not variations
  of one, including "do nothing" or "reuse what exists" when they are real options.

**The proposal itself**

- Check the proposal against what you found: constraints that cannot be met as written, ambiguous
  wording, gaps. A proposal is a human's first draft, not a specification. Do not interpret it
  silently: each point becomes a finding, and a question for the human.

Scale the depth to the impact: a topic that could become a [decision](spec.md#what-is-a-decision)
deserves several sources, a minor topic a quick check. Every topic still gets both the code and an
outside source. If you cannot search the web or read a source, say so in **Not checked** rather than
writing from memory. **Not checked** is for what could not be found or reached, never for work
skipped.

**Later rounds** start from what triggered them: an answer that raised a new unknown, a spec review
asking for options, a blocked plan. They research new information, for example the UI patterns an
answer calls for, and link to earlier rounds' sections rather than repeating them.

## Write `discovery-NN.md`

Write a new file for the round, from
[the template](../assets/templates/specs/000-feature-name/discovery-01.md). Knowledge comes first,
approaches last:

- **Why this round**: later rounds only, what triggered the round
- **Summary**: what this kind of feature usually looks like, where products differ, what the
  proposal asks for within that range, and what the code has today
- **How other products do it**: one section per product, then what they have in common: the
  capabilities users may expect
- **Standards and libraries**: the standards, libraries, and documentation that matter, and their
  pitfalls
- **The code**: the important reads, each with what it showed; the proposal's path and the existing
  actions that meet the feature; and the likely changes, each with the options it depends on
- **The proposal**: the constraints that cannot be met as written, the ambiguities, and the gaps
- **Approaches**: one section per topic the feature has to settle, each linking to the knowledge
  above it relies on, with its options evaluated against criteria from the proposal, the
  constitution, and active decisions. Use the same criteria for every option of a topic. Every
  capability from **What they have in common** gets a topic, or a line saying why it needs no
  choice.
- **Not checked**: what you searched for and could not find or reach

Give a heading to anything the questions may link to: in Markdown, only headings can be linked to.
Every fact links to its source: a file, a documentation page, a URL. Mark your own judgements as
judgements. Do not recommend in the discovery file: recommendations go with the questions.

## Write `clarifications-NN.md`

Write a new file for the round, from
[the template](../assets/templates/specs/000-feature-name/clarifications-01.md), and set
`status: awaiting-human`. The human answers every question in a single commit: the workflow does not
move on until they have.

Ask only what only the human can decide: product direction, scope boundaries, tradeoffs between
their goals, visual direction, and any choice that would become a
[decision](spec.md#what-is-a-decision). Settle everything else yourself, within the constitution and
active decisions, and list it under **Settled without the human** in the questions file: the topic,
the option, and why. The human sees it when answering, and can object. The spec copies it into its
assumptions.

Ask everything at once: anticipate the questions their answers would raise, and ask them now, so the
human answers once.

The human reads the file from top to bottom, once, without the discovery open next to it. Write it
so it reads linearly, with every piece of context they need at the point they need it:

- **Never refer to something before it is introduced.** The `> [!IMPORTANT]` block names subjects,
  not question numbers: the reader has not seen "Q4" yet. Open the file with the block described in
  [Coming back to the human](../SKILL.md#coming-back-to-the-human): how many questions, how long
  they take to think through, the choices that last beyond the feature, and the questions that work
  together.
- **Then a short Context section**: what the proposal asks for, and what exists today, with links to
  the code. In a later round, what happened since the last one, and why new questions came up.
- **Each question is self-contained.** It explains what the reader needs to answer it: the current
  code, the documentation, how others solve the problem, every fact with a link to its source. Then
  a "Why it matters" sentence, and a link to its discovery topic for more.
- **Options are bullets, not a table.** Each says what the option is in practice, when to pick it,
  and what it costs or rules out, so the reader can weigh them without opening the discovery.
- **The recommendation comes after the options**, with its reason, so the reader forms their own
  view first. It is your best reading of the evidence, not an answer to rubber-stamp: the questions
  exist because they need the human's judgement.

Ordering and numbering:

- Sort questions by impact, most important first. There is no limit on their number: early in a
  project, dozens of questions are normal.
- Number questions from Q1 in each round. Refer to an earlier round's question by file and number:
  "Q2 of [round 01](clarifications-01.md#q2-...)".
- When the proposal conflicts with an active decision, say so and ask whether to change the proposal
  or the decision: narrow it, soften a MUST into a SHOULD, or add a case where it does not apply.
- When the proposal conflicts with the constitution, say which principle, and recommend changing the
  proposal. An exception is possible only if the human explicitly accepts it in their answer: it is
  then spelled out in the plan, and the plan waits for their review.
- Leave each **Answer** empty.

If nothing needs a human answer, write a file with a single question confirming the scope, with
"yes" as the recommended answer. The human still sets `answered`.

## Commit

Commit both files: `discovery(<number>): <feature name>`, or what the new round is about. The commit
message body is the first line of the block, for example "12 questions, about 30 minutes." Then stop
at the gate.
