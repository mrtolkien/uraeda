# Inbox

## Quickfixes

- Fix " ├╴ Link to non-existent document '/specs/2026-10-13-image-attachments/proposal.md' Marksman
  (2)"
  - Happens when there's a feature in a worktree: we should not link from main to worktree-only
    files
  - There's no simple fix atm, because the file is only in the worktree: we should likely change the
    commit/worktree flow a bit

## UI

- In clarifications the card with two columns + questions on the right felt a bit cramped, the card
  should be a bit wider + the left part should be bigger + the right column should be right-aligned
- "Why it matters" should be a question callout
- "drafting a priority" is ass btw. It should be "Turn a priority into a draft".
- In clarifications of inbox triage, most notes were cut -> very hard to read

## Prompts

## Deferred fixes

- [agent] [redesign-feature] Runner: a workflow message queued on a feature merged before it starts
  fails with "This feature has no branch left"
- [agent] [decision-review-fixes] Watch: each burst reads every decision of every branch to hash it,
  about 40 blob reads per feature: measure it, and hash blob ids instead of texts
- [agent] [redesign-feature] Feature page: a done feature's figures start one thread per diff and
  per decision on every read, about 20 for a feature that rewrote every decision
- [agent] [decisions-pass] Rules drawn on the decisions page lose the links of their text: the
  core's comparison keeps plain words, so a rule linking another decision is no longer a link
- [agent] [decisions-pass] An option of a decisions check that removes a decision (half of a merge)
  is drawn with no candidate card
