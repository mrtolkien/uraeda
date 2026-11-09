---
reviewed: wave 1
commits: 4e1b7c2..a93d0f5
---

# Findings: Recurring tasks, wave 1

## Claude Code · Opus

- **Important**: `renderApp` sets `process.env.TZ` and restores it only when it was set before
  (`tests/helpers/app.tsx:41`). When it was unset, every later test file runs in UTC, so a timezone
  bug in tasks 2 to 5 passes on a machine west of UTC.
- **Minor**: `weekStart` reads like the locale's first day of the week, but always returns the
  Monday (`src/lib/dates.ts:58`). A doc comment saying so is enough.

## Codex · GPT-6.1-Sol

- **Important**: clearing the edit panel's date input saves `""` as the due date, not `null`
  (`src/components/EditPanel.tsx:73`). The task then sorts first in the list, and the next upgrade
  logs it as "not a date".
- **Minor**: the upgrade's warning logs the raw value without the task's title
  (`src/store/upgrades.ts:22`), so a user's report cannot say which task lost its date.
