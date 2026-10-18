---
kind: change
finished: 2026-10-19
pull-request: https://github.com/mrtolkien/uraeda/pull/40
---

# Record: Decision review fixes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-19, in [its pull request](https://github.com/mrtolkien/uraeda/pull/40). Its full files are
> in git: `git log -- specs/changes/2026-10-18-decision-review-fixes/`.

## What and why

The review of [the specs redesign](2026-10-17-redesign-specs.md) found flaws in how decisions are
compared, commented on, checked, and sent live. This change fixes them, with a test for each.

## Behaviour

- The comparison reads code blocks, tables, quotes, callouts, and nested items as parts, and an
  unlisted decision whose title or frontmatter alone changed shows a card listing the fields that
  differ, as `status: active → proposed`. A card with only field changes says "No part changed".
- A rule's "Checked by" sentence is split by the core, not the web, as `check` on the part.
- A review's decision name may not hold a space, comma, slash, backslash, or a leading dot, in the
  writer and the parser. The bad-anchor message lists every form, single-line and removed ones.
- Approving or requesting changes refuses a pending review that comments on a decision changed since
  its commit, and the web view marks such a review stale. A removed part's lines are the merge
  base's, so it never goes stale.
- A decision link with an anchor keeps it when the branch has no such decision, and the decisions
  page scrolls to it.
- A spec's reviewed words count a link's text, so a decision's title counts. Code spans and images
  still count for nothing.
- `decision.unapproved` counts from the last approval of a spec: one reopened and approved again at
  the same revision approves the edits between. `ura check` on one decision file reports it too.
- A decision a branch changes, committed or not, is sent live to the spec's file and the decision's
  page.

## Design

Root causes and code, by area:

- **Comparison**: `version()` kept only top-level paragraphs and list items. The cutting into parts
  moved to [`parts.rs`](/crates/core/src/decisions/parts.rs), walking every block, and
  [`change.rs`](/crates/core/src/decisions/change.rs) gained `fields` and `split_check`. The branch
  skips the parse of an unlisted decision with the same text on both sides
  ([`branch.rs`](/crates/core/src/decisions/branch.rs)).
- **Review comments**: `is_decision_name` in [`review.rs`](/crates/core/src/files/review.rs), and
  `comments_current` in the [review actions](/crates/core/src/actions/review/decision.rs), which
  `pending()` and the web's stale flag in [`api.rs`](/crates/core/src/api.rs) both use. The verdict
  code moved out of `actions/review.rs` into
  [`verdict.rs`](/crates/core/src/actions/review/verdict.rs).
- **Checks**: [`spec.rs`](/crates/core/src/check/spec.rs) counts link text; `approval_commit` in
  [`log.rs`](/crates/core/src/git/log.rs) returns the first commit of the last approved run; a file
  of `specs/decisions/` runs the folder's check in [`mod.rs`](/crates/core/src/check/mod.rs).
- **Live**: `Changes.branch_decisions` in [`watch.rs`](/crates/core/src/watch.rs), sent by
  [`live.ts`](/packages/server/src/live.ts).
- **Bench**: SC-003's fixture now holds 20 decisions, 5 changed; the spec opens in 54 ms on average.

## Questions

### Round 01

#### Q1: Reorder two decisions so `ura check` stops warning?

**Answer:** A: approve both reorders. `compatibility.md` and `diagrams.md` keep every rule, with the
MAY rule and the SHOULD rule moved to the end.

## Decisions

- [Compatibility](../decisions/compatibility.md) and [Diagrams](../decisions/diagrams.md): rules
  reordered by strength, no word changed.

## Changes after approval

None.

## Follow-ups

Deferred in the inbox: `###` headings and loose items in the comparison, multi-line frontmatter
values in fields, `ura check specs/decisions` and features under `specs/changes/`, a test for the
skipped parse, the watch's cost per branch, and a check word split across runs.
