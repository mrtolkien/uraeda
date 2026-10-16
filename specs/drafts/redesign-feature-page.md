---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Redesign feature and change pages

## What

A full pass on the feature page, and the change pages: the feature page is horrendous at the moment.

- In a "done" feature, we should have a nice view of all its info, not just a dirty link to the
  report
- Show the PR URL
- Need a small "look at PR comments" button in features that restarts the agent and pushes it to
  check the comments + make sure it's part of the workflow (post-PR step)
- "Commit and start the agent" took many seconds for me in the bugfixing flow...
- There's two buttons that lead to the session page (open session + continue), but they don't behave
  the same
  - Open just opens and you can send anything
  - Continue only supports the pre-sent message and stops sending if it's "not needed"
  - We should have an "Open Session" button that opens the session, with an option to select the
    pre-filled message for the step -> Simpler, clearer, more polyvalent

## Why

The feature page is where the human follows a feature from proposal to PR: it should show where the
feature is, what's next, and what it produced.
