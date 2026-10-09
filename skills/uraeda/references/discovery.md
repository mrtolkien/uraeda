# Discovery and questions

Investigates a human proposal in depth, in the code and outside it, then asks the human what only
they can decide.

- **Runs when**: a spec folder has a `proposal.md` and no `clarifications.md`, or another step sends
  the workflow back to discovery
- **Writes**: `discovery.md`, `clarifications.md`
- **Ends at**: a human gate, `clarifications.md` with `status: awaiting-human`

`discovery.md` is the evidence behind the questions, and the working notes of every later step: the
spec builds its design on it, the plan reuses its map of the code, and a different agent can resume
without redoing the work. It holds findings and options, never decisions: decisions come from the
human's answers.

## Read first

1. `proposal.md`
2. Earlier sessions of `discovery.md` and `clarifications.md`, if any: build on them
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
- Find the existing patterns the feature should follow, and the problems in the way.
- List the files the feature will likely change or add.

**Outside the code**

- Read the documentation of the dependencies involved, for the versions the project uses: local
  docs, then official online docs.
- Search the web for how established products and libraries solve the same problem, for libraries
  that could do the work, and for known pitfalls.
- Find at least two or three genuinely different approaches, not variations of one, including "do
  nothing" or "reuse what exists" when they are real options.

Scale the depth to the impact: a topic that could become a [decision](spec.md#what-is-a-decision)
deserves several sources, a minor topic a quick check. Every topic still gets both the code and an
outside source. If you cannot search the web or read a source, say so in **Not checked** rather than
writing from memory.

## Write `discovery.md`

Add a `## Session YYYY-MM-DD` section at the end of the file, from
[the template](../assets/templates/specs/000-feature-name/discovery.md):

- **Code**: the important reads, each with what it showed, and the likely changes, each with why
- **One section per topic**: what needs deciding, the findings with their sources, and the options,
  evaluated against criteria taken from the constitution, active decisions, and the proposal. Use
  the same criteria for every option of a topic.
- **Not checked**: what you searched for and did not find, or could not check

Every finding links to its source: a file, a documentation page, a URL. Do not recommend in
`discovery.md`: recommendations go with the questions.

## Write `clarifications.md`

Add a `## Session YYYY-MM-DD` section at the end of the file, from
[the template](../assets/templates/specs/000-feature-name/clarifications.md), and set
`status: awaiting-human`.

Ask only what only the human can decide: product direction, scope boundaries, tradeoffs between
their goals, visual direction, and any choice that would become a
[decision](spec.md#what-is-a-decision). Settle everything else yourself, within the constitution and
active decisions: it goes in the spec's assumptions, where the human can object.

Ask everything in this round: anticipate the questions their answers would raise, and ask them now,
so the human answers once.

The human reads the file from top to bottom, once, without the discovery open next to it. Write it
so it reads linearly, with every piece of context they need at the point they need it:

- **Never refer to something before it is introduced.** The `> [!IMPORTANT]` block names subjects,
  not question numbers: the reader has not seen "Q4" yet. Open the session with the block described
  in [Coming back to the human](../SKILL.md#coming-back-to-the-human): how many questions, how long
  they take to think through, the choices that last beyond the feature, and the questions that work
  together.
- **Then a short Context section**: what the proposal asks for, and what exists today, with links to
  the code. On a later session, what changed since the last one.
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
- Number them across sessions: if the last session ended at Q7, start at Q8.
- When the proposal conflicts with the constitution or an active decision, say so and ask whether to
  change the proposal or change the decision. The constitution can only be amended by a human,
  outside this workflow.
- Leave each **Answer** empty.

If nothing needs a human answer, write a session with a single question confirming the scope, with
"yes" as the recommended answer. The human still sets `answered`.

## Commit

Commit both files: `discovery(<number>): <feature name>`, or what the new session is about. The
commit message body is the first line of the block, for example "12 questions, about 30 minutes."
Then stop at the gate.
