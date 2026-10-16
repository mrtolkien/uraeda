---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Worker lifecycle

## What

Agent runs survive what happens around them, and keep going until the next human gate.

- **Restarts**: restarting the Uraeda server kills the agent sessions it hosts. On 2026-10-15 three
  features were hit at once ("Continue, sorry" in each), and on 2026-10-16 settings-page lost a
  17-minute agent and redesign-interface's orchestrator went on to build 11 tasks itself. Sessions
  should outlive a server restart, or be resumed by it, from their commits.
- **Limits and logins**: a usage limit paused ui-iteration for 5 h 15 min, and a "Not logged in"
  error killed a task of redesign-priorities. A run stopped by a limit resumes once the limit
  resets, and says so in the session.
- **Stopping early**: agents stopped before implementing an auto-approved plan (session-view,
  testing-review), and one session ended while its implementer ran in the background
  (code-quality-in-the-skill, stalled 75 min). An auto-approved plan goes straight on to the
  implementation, and a run never ends while its subagents still work.
- **Waiting**: agents start work in the background and poll it in loops (240 polling commands, 154
  min, on 2026-10-15 and 2026-10-16), or set wakeups that fire after the work is done. Background
  work notifies the session when it ends instead.
- **After a crash**: one button that restarts every stopped agent, sending "continue" to each (from
  the inbox).

## Why

About 6.5 hours of stalls and 1.5 hours of redone work on 2026-10-15 and 2026-10-16 alone, and a
"Continue" typed by the human after every interruption: the workflow is asynchronous, but its runs
still need a human to restart them.
