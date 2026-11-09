---
reviewed: branch
commits: 5e3a466b..9bd1e6f4
---

# Findings: Run options, the branch

## Second reviewer

- **Important**: `packages/server/src/runner/sub-sessions.ts:174-175`. A pending implementer can
  start after its parent is stopped: when Stop comes while `#runAgent` awaits its worktree's check,
  `stopAll` aborts the call's halt signal, which the callback ignores, and the implementer starts
  after Stop listed the sub-sessions. Pass the halt signal on, and check it before the sub-session
  is created or started.
- **Important**: `packages/web/src/ComposerPicker.tsx:116-118`. When a session's agent is off or
  unavailable but the next workflow step runs on another agent, the composer still checks the old
  session's agent and disables Send, though the server sends the message to the next step's session.
  Check a workflow message's availability on its destination's pick, and a chat message's on the
  session's.
