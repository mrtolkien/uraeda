# Inbox

## Quickfixes

## UI

- Home does not use the same icons as the sidebar: this is clearly AGAINST the ui coherence decision
  - Fix home by taking inspiration from the sidebar looks
  - Make sure the ui decision is well written and would trigger on similar specs in the future
- In clarifications the card with two columns + questions on the right felt a bit cramped, the card
  should be a bit wider + the left part should be bigger + the right column should be right-aligned
- "Why it matters" should be a question callout
- "drafting a priority" is ass btw. It should be "Turn a priority into a draft".
- In clarifications of inbox triage, most notes were cut -> very hard to read
- Need more space between the last card and "settle without you" in questions

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
- [agent] [fix-testing] Skill template: skills/uraeda/assets/templates/specs/CONSTITUTION.md rule VI
  still says "tests covering the spec's acceptance scenarios", so a new project's constitution
  forbids what the testing rules now ask: needs the human's wording
- [agent] [fix-testing] Server error page: "Try again" on "Could not reach the Uraeda server" does
  not recover once the server is back, since the fate client keeps the failed read; only a reload
  does
- [agent] [fix-testing] Priorities list: after Enter on a row, focus goes to the page body while the
  inbox keeps it on the row, so the two lists do not share one keyboard behaviour; a click on a row
  on a wide screen drops focus the same way
- [agent] [fix-testing] Phone navigation: the drawer is not a history entry, so Back leaves the page
  where a sheet's Back closes the sheet
