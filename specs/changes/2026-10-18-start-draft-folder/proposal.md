---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Start a draft folder from its proposal

## What

- Starting a draft folder from its proposal.md (specs/drafts/<slug>/proposal.md) starts it as a file
  draft: only proposal.md moves, and its images/ stay behind, breaking the proposal's image links
  (crates/core/src/actions/start/plan.rs, draft_files)

## Why

## Notes
