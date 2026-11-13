---
icon: flask-conical
---

# Testing

> "[What the human said about how much to test, in their own words.]"

The project's stage is `[early, growing, or stable]`: [what it tests, from the stages below].

[The stages, to pick from and then delete:

- `early`: only what is costly to get wrong and rarely changes: stored formats, git and other
  writes, security, the contracts between the project's parts, pure logic with many cases, and the
  reproduction of each bug fixed.
- `growing`: the same, and the main scenario of each user story, through the real product.
- `stable`: the same, and every scenario and edge case of a spec.]

## Rules

- A test gives way to the approved spec, the decisions, and the human's requests. _So:_ a test of
  behaviour a spec replaces is rewritten or removed with that behaviour, never kept by bending the
  code.
- A test asserts what a user or a caller observes. _So:_ [a case from this project].
- The stage is the human's, and moves only when they say so. _So:_ [what no feature adds on its
  own].
- [Optional: what a test of the UI must guard to be worth keeping.] _So:_ [a case].

## Why

[Why the human wants this much testing at this stage: what a test costs the project today, and what
a regression costs.]

## Alternatives considered

- [Optional: another stage, when an agent could propose it again]

## Applies to

- [Every feature and change, and the folders of the tests]

## Revisit when

[The human says the project is no longer at this stage.]
