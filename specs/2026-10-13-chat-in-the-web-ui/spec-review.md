---
verdict: approved
commit: 2354850
---

# Review: Spec, Chat in the web UI

## C1: Lines 90–92, under "US1: Chat with a feature's session (P1)"

> 7. **Given** a session whose last turn ended 15 minutes ago, **When** the 15 minutes pass,
>    **Then** its process is closed. **When** you send a message afterwards, **Then** the agent
>    answers with the session's earlier context.

Can it use Claude’s resume feature? That’s the cleanest to guarantee cache hits imo

## C2: Lines 108–115, under "US2: Read the workflow's message before handing over (P1)"

> 1. **Given** a round of questions you answered, **When** you press "Commit and continue" on its
>    page, **Then**:
>    - the answers are committed;
>    - the feature's session opens with the composer holding these three lines: "/uraeda:uraeda
>      Continue the feature specs/2026-10-13-chat/, on branch 2026-10-13-chat.", "The human answered
>      clarifications-01.md of the questions.", and "Its next step is spec: follow
>      skills/uraeda/references/spec.md.";
>    - nothing is sent yet.

We need to rename it from “xxx and continue” to “xxx and start an agent” or something similar
(continue the session, start a session, …)

“Continue” is not very clear language here
