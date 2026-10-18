---
status: answered
---

# Clarifications, round 01: Priorities and decisions pages fixes

> [!NOTE]
>
> Answered on 2026-10-18. 1 question, about 5 minutes.
>
> - Verdict: worth building as proposed: the first and third items are done and committed, and the
>   second needs one choice only you can make.
> - Discard deleting a draft means choosing which typed text it may lose: a bullet list typed right
>   under the title, before any other text, would go with the draft.
> - The same flaw exists for a note moved out of the inbox. It is left out of this change, and named
>   in the pull request: check it.

## Context

### Goal

The [proposal](proposal.md) lists three fixes. The decisions page now checks a decision's links
against the default branch's tree, and reads every decision's date from one `git log`, with a watch
that no longer reads each decision: both are committed, with tests. The third fix is the second
item, about Discard.

### Today

Drafting a priority writes `specs/drafts/<slug>.md` with the line and its children, and links the
line to it, in [`draft_entry`](/crates/core/src/actions/draft.rs). Discard deletes that draft only
while it still holds what the move wrote, so a draft the human typed in is never lost.

To know what the move wrote, [`never_committed`](/crates/core/src/actions/changes/drafts.rs)
rebuilds it from the line's children at the last commit. When the children changed since, the draft
was written from the new ones, the two differ, and Discard takes the draft for typed-in text and
keeps it. The test
[`discard_deletes_the_draft_of_a_line_whose_children_changed`](/crates/core/tests/priorities.rs)
shows it: it fails today.

The children as they were when drafting exist only inside the draft. Recording them elsewhere would
change the files users already have, which is a feature, not a change.

### Scope

Discard of a priority's draft. Discard of a note's draft has the same flaw, and stays as it is.

### Sources

- [`discard`](/crates/core/src/actions/changes.rs) and
  [`remove_written`](/crates/core/src/actions/draft.rs), which decide what Discard deletes.
- The [priorities tests](/crates/core/tests/priorities.rs) of Discard.

## Q1: What may Discard delete from a draft whose line's children changed?

The draft holds the title, then the children under it, then the proposal's other sections. Reading
the children out of the draft itself makes the check exact for the title and the sections, and loose
only for the children: whatever list lines sit under the title count as the children.

Why it matters: it decides whether a draft can be lost, against a stale file Discard leaves behind.

- **A (recommended). Delete the draft when its title and sections are untouched, whatever list lines
  follow the title.**
  - [pro] Discard takes back every draft a move made, children edited or not, and leaves no stray
    file.
  - [con] a bullet list typed right under the title, before any other text, is deleted with the
    draft. Text typed anywhere else keeps the draft.
  - Why recommended: that bullet list is the one place a typed line looks like a child, and a
    discarded draft is one the human has not committed.
- **B. Keep the draft, as today.**
  - [pro] a draft is never lost.
  - [con] the draft stays on disk, linked from nothing, each time children changed before drafting.

**Answer:** A

## Settled without the human

### Check these

- **The link check** reads the default branch's tree, files, folders, headings, and wikilinks
  included, when no checkout has it. With a checkout, links resolve on disk as before.
- **The watch** hashes the checkout's decision files by size and modification time instead of their
  text, and the default branch by the ids of its decisions folder and constitution. An edit that
  keeps both the size and the modification time is not seen.

### Behaviour

- **A decision's date** is the same as before, through a merge: the new test pins it.

### Under the hood

- **The decisions' dates** come from one `git log --name-only`, instead of one `git log` per
  decision.
- **The note's draft** has the same rebuild from the last commit in
  [`written_from`](/crates/core/src/actions/changes/drafts.rs). It is out of the proposal, and named
  in the pull request.

**Notes:**
