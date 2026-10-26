---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Testing strategy review

## What

Review the testing strategy of Uraeda, particularly for UI/frontend.

There are two steps:

- Review how testing is approached in the uraeda skill itself, particularly frontend tests. We
  should have clear testing guidelines that explain what a good test is and how to write it. It
  needs to stay high level and conceptual, and applicable to all stacks and programming languages.
  Look for existing popular coding agent skills, research papers, ...
- Review the existing tests inside uraeda and rewrite them to follow the new approach

Decisions content could also be extended/rewrote if it helps. A decision is enforced by checks/tests
at the moment, but maybe it does not need to be the case. Decisions should be _structural_, not
_specifics_.

We also need to review the PR, ruling, and record formats, which are linked to the same concept:
validation of changes and storing of user intention:

- The PR body should just be the record: they both should explain the same thing, which is what was
  changed, how, and why (human intent). The goal of a record is to save IMPORTANT INFORMATION for
  future agent runs. Not to create random noise.
- The agent should be allowed to edit old records to add links to newer ones if they were
  superseeded by newer changes
- This sounds a bit similar decisions, because it is: the decisions folder is storing core
  architectural decisions and their current state, records save the human intent _per feature_, as
  it was at the time of the feature.
  - Records help understand past decisions.
- I need your opinion: should records also save information about issues faced during
  implementation? Stuff like a library not behaving as expected, or other issues that are currently
  buried in rulings

## Why

Many times the implementation made bad changes, breaking the specs, due to forcing itself to pass
old tests that should now be obsolete.

It seems that at the moment:

- There are _too many_ tests, many not pulling their weight. This is particularly true for frontend,
  where specs and requirements can change fast.
- For example, some tests/decisions record exact pixel values: this is pointless, this is exactly
  the kind of "light" requirement that's bound to evolve and be broken

## Notes

- Search in depth for good frontend testing practices, and see if they are even needed. Right now
  the frontend testing is slow, clumsy, and makes iteration complex.

- Setup a small benchmark or evaluation: it should run uraeda on features (we already have a
  benchmark of this type), then it should evaluate the quality of tests created: usefulness,
  complexity, execution speed, ...
  - Use Claude Code with Sonnet to run the evaluation
  - No need to make it too complex: focus on one feature and evaluate the generated tests yourself.
    Use it to tune our skill's wording and instructions.

- Another option would be to scale testing effort with feature maturity. I feel like tests get more
  useful the more stable an application is, but in early stage development it's undue inertia.
