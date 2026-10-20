---
discovery: low
---

# Fix agent -> inbox flow, it creates way too much noise at the moment

## What

Fix agent -> inbox flow, it creates way too much noise at the moment

- The implement step creates WAY TOO MANY inbox notes: inbox notes should be _meaningful_ issues
  that require human attention. If it's random bullshit why is it here, if it's important why isn't
  it done.

It's pretty simple: either the inbox line is meaningful and should be part of the PR, or it's not
and should not be in the inbox.

An agent writing to the inbox should be EXCEPTIONAL, for IMPORTANT ISSUES THAT WILL NEED HUMAN INPUT
AND CLEARLY FALL OUTSIDE OF THE CURRENT FEATURE.
