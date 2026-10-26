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

## Why

Many times the implementation made bad changes, breaking the specs, due to forcing itself to pass
old tests that should now be obsolete.

It seems that at the moment:

- There are _too many_ tests, many not pulling their weight. This is particularly true for frontend,
  where specs and requirements can change fast.
- For example, some tests/decisions record exact pixel values: this is pointless, this is exactly
  the kind of "light" requirement that's bound to evolve and be broken

## Notes

Search in depth for good frontend testing practices, and see if they are even needed. Right now the
frontend testing is slow, clumsy, and makes iteration complex.

Another option would be to scale testing effort with feature maturity. I feel like tests get more
useful the more stable an application is, but in early stage development it's undue inertia.
