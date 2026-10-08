# Todo Constitution

Principles are listed by priority: when two principles conflict, the higher one wins.

## Core Principles

### I. Simple for non-technical users

- The UI MUST stay lightweight: a feature SHOULD add at most one new screen.
- User-facing text MUST NOT use technical jargon.

Rationale: the app is for people who find other todo apps too complicated.

### II. Local first

- Tasks MUST be stored on the user's device.
- The app MUST NOT send user data to an external service without explicit human approval.

Rationale: users trust the app with personal lists, and it must work offline.

### III. Fast with thousands of tasks

- List rendering MUST be benchmarked.
- Performance regressions MUST NOT be merged without human approval.

Rationale: some users never delete completed tasks.

## Governance

- Only humans amend this constitution. Each amendment is a commit explaining why it was made.
- Versions follow semantic versioning: MAJOR when a principle is removed or redefined, MINOR when a
  principle is added or expanded, PATCH for wording changes.
- Specs and plans MUST include a constitution check. Exceptions MUST be listed in the plan's
  complexity tracking and approved by a human.

**Version**: 1.0.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-01
