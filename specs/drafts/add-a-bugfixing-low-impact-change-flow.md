---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Add a bugfixing/low impact change flow

## What

Add a bugfixing/low impact change flow: it should be shorter and simpler than the full feature flow,
but still follow the same core principles: code quality, maintainability, ...

It might for example forego the back and forth if unnecessary and not run the full review process.

I need you to help me define the right structure for this.

## Why

When running into a bug, we just want to pass the information to the system and let it work on a
fix. By default there should be no need for clarifications or specs: since it's a bug, it goes
against _existing_ specs.

In the same vein, sometimes a change is too small for the full uraeda flow. This could be a small UI
change, a small behaviour change, ... I had the issue with superpowers that _any_ change turned into
1+ hours of working with an agent. It was too much structure, when agents are great for small and
nimble work.

We could also have a dedicated UI flow that focuses on iterating the UI _only_: I often have issues
with agent-created code where it's mostly good but the UI needs a lot of small, targeted fixes, and
visual feedback. This could be its own dedicated flow with a flow that's more visual instead of
textual, with small mockups in the page and A/B/C selection from visual elements?

## Notes

- Make sure you review how other systems do it (Openspec, spec kit, superpowers, ...)
- This should NOT have a negative impact on code quality: the difficulty is finding the right
  balance
- The flow should likely _itself_ be able to ask the user to upgrade it to a full feature: if the
  agent analyses the request and thinks the change is too big, it should offer to upgrade it to a
  draft/proposal.
