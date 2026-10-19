---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Decisions pass

## What

- We need a "check decisions coherence" option, like "inbox triage"
  - It should read constitution and all decisions and raise if some of them are competing, and
    explain the options clearly (what are the 2 options to keep it clean)
- Decisions are hard to read and too long, will need a pass -> that was mostly fixed in the "Spec
  redesign" spec, but in the latest features the decision propositions were too specific

Decisions should include HIGHER ORDER INFORMATION. Specifics are rarely meaningful decisions: they
are the code. What matters is understanding the human intent and goal, and properly saving it.

Stack decisions or approaches are meaningful because they bind the rest and required work to define,
and will drive future development.

They also need to be easy to review for humans.

## Why

The decisions were compressed already but the latest propositions still read too specific and too
narrow. For example I got a suggested decision in the benchmark worktree that forced harnesses to
not use cli flags and... I don't give a fuck? It's not a meaningful decision in any way or form?

## Notes

We also need to show the MUST/MUST NOT and other info like we do it in the spec page, it should be
coherent.

That's an example of an important decision: UI coherence. I dislike when the same information is
presented in different ways in different pages, without an extremely good reason. I want re-use of
components and a globally coherent application. You see why that's a decisison, and it does not
require specifics nor an extremely long article?
