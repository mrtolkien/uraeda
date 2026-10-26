---
status: proposed
approved-by:
icon: flask-conical
---

# Testing

Tests check that the code behaves as the decisions and the approved spec say, and never override
them. How much is tested follows the project's stage, now `[early, growing, or stable]`: [what it
tests, from the stages below]. [The tests the UI keeps: the bar a UI test must pass.]

[The stages, to pick from and then delete:

- `early`: only what is costly to get wrong and rarely changes: stored formats, git and other
  writes, security, the contracts between the project's parts, pure logic with many cases, and the
  reproduction of each bug fixed.
- `growing`: the same, and the main scenario of each user story, through the real app.
- `stable`: the same, and every scenario and edge case of a spec.]

## Rules

- A test MUST give way to the approved spec, the decisions, and the human's requests: a test that
  guards behaviour they replace is rewritten or removed in the task that changes the behaviour,
  never kept by bending the code. Checked by review.
- A spec that replaces behaviour MUST list it with the tests that guard it, so its approval covers
  their removal, and the record MUST name them. Checked by review.
- A test MUST assert what a caller or a user observes, never how the code does it. Checked by
  review.
- At the [stage], a feature MUST test [what that stage tests, from the list above]. Checked by
  review.
- [A test of the UI MUST guard behaviour that is costly to lose and that using the UI would not
  show, such as unsaved text or a git write, and everything else is left to the human's review. Or,
  for a stage that tests the UI: what it is tested by, and how.] Checked by review.
- The stage MUST be set by the human, and moves only when they say so. Checked by review.

## Why

[Why the human wants this much testing at this stage: what a test costs the project today, and what
a regression costs. Links to the clarification question and the discovery topic.]

## Alternatives considered

- [Optional: another stage, or another bar for UI tests, when it was a close call]

## Consequences

- [What goes unchecked at this stage, and what the human reviews instead]
- [What the next stage will need to decide]

## Applies to

- [Every feature and change, and the folders of the tests]

## Revisit when

[The human says the project is no longer at this stage.]
