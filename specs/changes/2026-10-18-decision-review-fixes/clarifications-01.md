---
status: awaiting-human
---

# Clarifications, round 01: Decision review fixes

> [!IMPORTANT]
>
> 1 question, about 5 minutes.
>
> - Verdict: worth building as proposed. Every fix is made and tested, bar two edits to active
>   decisions that only you can approve.
> - Two active decisions reorder their rules, with no word changed, so `ura check` stops warning.
> - The comparison now reads code blocks, tables, quotes, and nested items, and shows a title or
>   frontmatter change. A frontmatter-only change of a decision now shows a card.
> - A link's text now counts in a spec's reviewed words, so long specs warn a little sooner.
> - The plan's complexity row about the editor and the web seeing `decision.unapproved` is left
>   alone: that plan is gone, and its record says nothing of it.

## Context

### Goal

The [proposal](proposal.md) lists the flaws found in the review of the specs redesign. They touch
the decision comparison, the review comments on decisions, the checks, and the live updates.

### Today

All the fixes are committed on this branch, each with its tests. One of them cannot be: `ura check`
warns `decision.order` on two active decisions.

- [Compatibility](../../decisions/compatibility.md) puts a MAY rule, "Files on other branches in
  flight MAY fail", before three MUST rules.
- [Diagrams](../../decisions/diagrams.md) puts a rule that opens with SHOULD before three MUST
  rules. The check ranks a rule by its first keyword, as the
  [rule's code](/crates/core/src/check/decision.rs) says.

Both orders break the rule the [decision check](/crates/core/src/check/decision.rs) enforces: the
strongest rules come first. Only a human changes an active decision, so both edits wait on your yes.

### Scope

Only the order of the rules of the two decisions. No word of any rule changes.

### Sources

- The [specs redesign record](../../done/2026-10-17-redesign-specs.md), which made `decision.order`
  a warning.
- The two decisions above, and the check's [code](/crates/core/src/check/decision.rs).

## Q1: Reorder two decisions so `ura check` stops warning?

Both edits are already on the branch, as proposed decisions. A rule moves to the end of its list in
each, and nothing else changes.

Why it matters: the warning shows on every `ura check` of the repository, and teaches agents to
ignore warnings.

- **A (recommended). Approve both reorders.**
  - [pro] `ura check` reports no warning, and the decisions keep every rule as written.
  - [con] two active decisions change on this branch, though only in order.
  - Why recommended: the rule that the check enforces is yours, and the files break it today.
- **B. Keep both decisions as they are.**
  - [pro] no active decision changes.
  - [con] the two warnings stay, and the check keeps reporting a problem nobody will fix.

**Answer:**

## Settled without the human

### Check these

- **A link's text counts as reviewed words.** A decision's title is a link in the spec's list of
  decisions, so it counted for nothing in `spec.length` and in the review's time. Code spans and
  images still count for nothing.
- **A decision file named alone** now reports `decision.unapproved`, for the features of its
  `specs/` folder, as the folder's check does.
- **Re-approval at the same revision** counts from the last approval. A spec reopened and approved
  again at the same revision approves the decision edits made in between.

### Behaviour

- **A title or a frontmatter change alone** shows a card for an unlisted decision. Its card lists
  the fields that differ, as `status: active → proposed`.
- **A decision's name in a review's heading** may not hold a slash, a backslash, or a leading dot.
  The writer already refused a space and a comma.
- **A verdict checks the decisions a review comments on**, as a comment already did. A removed
  part's lines are the merge base's, so it never goes stale.
- **A decision link with an anchor** keeps it when the branch has no such decision, and the
  decisions page scrolls to it.

### Under the hood

- **The "Checked by" split** moves from the web to the core, which tests it.
- **The comparison skips an unlisted decision** whose text is the same on both sides, so opening a
  spec parses only the decisions that differ. The SC-003 bench now holds 20 decisions, 5 changed.
- **A decision changed on a branch** is sent live to its spec and its page, committed or not.

**Notes:**
