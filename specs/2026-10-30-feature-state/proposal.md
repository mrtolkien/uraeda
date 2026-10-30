---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Feature state pass

## What

Feature state pass

- [testing-communication] A stopped session marks the feature as "needing attention" even if another
  session is running
- After approving a spec the feature stayed in "needs you" until I ran a full refresh
- Many, many issues with the "state" of a run: if a PR is up, it's "done" even if I restarted the
  session
  - If a session is running, it should always be visible in the sidebar/card/feature page
  - Generally we need better handling of "corner cases" of feature state/session state
- A session is always marked as "warning" if it was stopped by an error (server crash), and there's
  no way to remove that status.

## Why

Right now when I do some manual changes to files it's often all fucked up.

Or an agent is working on task 16 but it still show task 13 in the UI.

Overall it's all very faulty, laggy, and sometimes just wrong.

## Notes

### Changes were started but still showed up in "Now"

![pasted image](images/pasted-20261029-225652.webp)
