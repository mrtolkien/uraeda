---
kind: change
finished: 2026-10-18
pull-request: https://github.com/mrtolkien/uraeda/pull/36
---

# Record: Priorities and decisions pages fixes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-18, in [its pull request](https://github.com/mrtolkien/uraeda/pull/36). Its full files are
> in git: `git log -- specs/changes/2026-10-18-priorities-decisions-fixes/`.

## What and why

Three flaws of the priorities and decisions pages: a valid decision link could read as broken,
Discard kept a priority's draft when its children had changed, and the decisions page ran one
`git log` per decision while the watch read every decision on each pass.

## Behaviour

- With the default branch checked out nowhere, a decision's links are checked against the default
  branch's tree, files, folders, headings, and wikilinks included. With a checkout, they resolve on
  disk as before.
- Discard deletes the draft of a priority whose children changed since the last commit, as long as
  the draft's title and sections are untouched. A text typed in a section keeps the draft.
- A decision's date is the date of the last commit touching it, as before, including through a merge
  and for a file name with non-ASCII characters.

## Design

- **Links**: [`check_folder_texts`](/crates/core/src/check/mod.rs) takes the tip whose tree links
  resolve against, and [`links.rs`](/crates/core/src/check/links.rs) reads files, folders, and
  anchors from it. [`read_ledger`](/crates/core/src/api/ledger.rs) passes the tip only when no
  checkout has the default branch.
- **Dates and watch**: [`Git::last_changes`](/crates/core/src/git/log.rs) reads every decision's
  date from one `git log --name-only`. `ledger_hash` stamps the checkout's files by size and
  modification time, and the tip by the ids of its decisions folder and constitution, instead of
  reading them.
- **Discard**: `draft_entry` writes the children as they are when drafting, but Discard rebuilt them
  from the last commit. [`written_by_move`](/crates/core/src/actions/changes/drafts.rs) now reads
  them out of the draft: any list lines between the title and the next section.

## Questions

### Round 01

#### Q1: What may Discard delete from a draft whose line's children changed?

**Answer:** A. Delete the draft when its title and sections are untouched, whatever list lines
follow the title.

## Follow-ups

- A note moved out of the inbox has the same rebuild from the last commit in `written_from`.
- A merge commit that resolves a conflict in a decision gets no date from itself: the date falls
  back to the older commit that touched the file.
- The watch hash covers only the decisions and the constitution, so a commit that only adds or
  removes a linked file elsewhere leaves link problems stale until something else changes.
- A link to a symlink in the default branch's tree reads as a missing file.
