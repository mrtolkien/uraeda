---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Review uraeda init and skill install flow

## What

Remove the skill portion of `ura init`: ura init is now just about setting up the current repo for
uraeda, without the skills.

Add `ura install` which installs the skill files. Use ratatui to have two pickers:

- repo or user-level?
- `.agent/skills` or `.claude/skills`?

## Why

I don't like the skill living in all repos, it's inelegant. uraeda init should offer to install the
skill for the active user, not in the repo.

## Notes

Quickly check online how spec kit/openspec do it
