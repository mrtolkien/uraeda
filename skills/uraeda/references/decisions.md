# Decisions

Turns the human's answers into proposed decisions, then decides whether the scope is clear.

- **Runs when**: `clarifications.md` is `answered` and newer than `spec.md`, or there is no
  `spec.md`
- **Writes**: `specs/decisions/NNNN-slug.md` files
- **Ends at**: the [spec](spec.md) step, or a new [research](research.md) round

## Read the answers

Read the latest session of `clarifications.md`. An answer can be:

- An option letter
- `yes`: the recommended answer
- Free text: the human's own answer. When it is ambiguous, ask again in the next session, with your
  reading of it as the recommended answer.
- Empty: the question is still open

## Propose decisions

Write a decision for each answer that future work could break: technical choices, data formats,
dependencies, look and feel, scope boundaries. Answers that only matter inside this feature go in
the spec, not in the ledger.

Use [the template](../assets/templates/specs/decisions/0000-decision-title.md):

- File name: a 4-digit number and a short slug, `0004-reminders-use-local-notifications.md`. Numbers
  are never reused: take the highest ever used, including deleted decisions, plus one.
- Frontmatter: `status: proposed`, `spec` set to the spec folder, `date` set to today, and
  `approved-by` and `overridden-by` empty
- The decision itself first, as MUST, SHOULD, and MUST NOT rules that a spec or plan can be checked
  against
- A short `## Context`, linking to the question and the research topic. The options considered stay
  in `research.md`.

When the human chose to override an active decision, the new decision says which one it overrides in
its context. Leave the old decision unchanged: it is only marked `overridden` when the spec is
approved.

Never set a decision to `active` in this step.

## Is the scope clear?

Go back to [research](research.md) when questions are still open, when an answer raises a new
unknown, or when the human asked for more options. Otherwise, continue to the [spec](spec.md).

## Commit

Commit the decisions: `decision(<number>): propose <summary>`. Then run the next step.
