# Research and questions

Turns a human proposal into documented findings and questions for the human.

- **Runs when**: a spec folder has a `proposal.md` and no `clarifications.md`, or another step sends
  the workflow back to research.
- **Writes**: `research.md`, `clarifications.md`
- **Ends at**: a human gate, `clarifications.md` with `status: awaiting-human`

## Read

1. `proposal.md`
2. Earlier sessions of `research.md` and `clarifications.md`, if any: do not redo that work
3. The `## Review` section of `spec.md` or the reason given by the plan step, if one sent the
   workflow back here
4. The code the feature touches, and local references: docs folders, READMEs, configuration
5. Online sources, when the proposal depends on libraries, services, or practices you need to check

## Write `research.md`

Add a `## Session YYYY-MM-DD` section at the end of the file, from
[the template](../assets/templates/specs/000-feature-name/research.md). For each topic:

- What you found, in the code and in references
- The options you considered, each with its pros and cons
- Your sources: file links and URLs

Research holds findings and options, never decisions. Decisions come from the human's answers.

## Write `clarifications.md`

Add a `## Session YYYY-MM-DD` section at the end of the file, from
[the template](../assets/templates/specs/000-feature-name/clarifications.md), and set
`status: awaiting-human`.

Ask about what needs a human: behaviour, scope boundaries, visual direction, data that users keep,
dependencies, how reusable the code must be. Do not ask about details you can settle within the
constitution and active decisions.

- Sort questions by impact, most important first. There is no limit on their number.
- Number them across sessions: if the last session ended at Q7, start at Q8.
- Each question has a "Why it matters" sentence, a **Recommended** answer with its reason, and its
  options in a table. Link to the research topic behind it.
- When the proposal conflicts with the constitution or an active decision, say so and ask whether to
  change the proposal or override the decision. The constitution can only be amended by a human,
  outside this workflow.
- Leave each **Answer** empty.

If nothing needs a human answer, write a session with a single question confirming the scope, with
"yes" as the recommended answer. The human still sets `answered`.

## Commit

Commit both files: `research(<number>): <feature name>`, or what the new session is about. Then stop
at the gate.
