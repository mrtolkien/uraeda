---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Decision review fixes

## What

- Decision comparison: code blocks, tables, quotes, and nested items are not parts, so a change only
  there shows no change; untested paths (a section only at the merge base, crossing pairs,
  duplicates, empty input); compare runs on every decision of the branch, changed or not, and the
  SC-003 bench has only 5 decisions; an unlisted change to only the title or another frontmatter
  field shows no card; "Checked by" is split in the web (R80); decision changes are not sent live.
- Decision comments: the anchor parser accepts names the writer refuses (a/b, ../x); the BadAnchor
  message names neither "line N" nor " removed"; approve and request_changes check freshness on the
  spec only; R50's removed-part short-circuit is untested; R85's redirect drops the anchor;
  actions/review.rs is at 489 lines.
- Checks: the reviewed words leave out links' text (R41), so decision titles count nothing; no test
  of a keyword-less rule between a MAY and a MUST; a spec approved, reopened, and approved again at
  the same revision keeps its first approval; ura check on a single decision file never reports
  decision.unapproved; the plan's complexity row says the editor and web see decision.unapproved,
  and neither does; compatibility.md and diagrams.md warn decision.order (a rule mixing SHOULD and
  MUST NOT ranks by its first keyword).
- A spec's decision changes, and a branch's decision page, are not sent live when only a decision of
  `specs/decisions/` changes on the branch: the watch updates the feature, not its `spec.md` or the
  `BranchDecision`, and an uncommitted edit of a decision not at all

## Why

## Notes
