# [Project] Constitution

Principles are listed by priority: when two principles conflict, the higher one wins.

## Core Principles

### I. [Principle name]

- [Rule written with MUST, MUST NOT, or SHOULD]
- [Rule]

Rationale: [why this principle exists, to help with cases the rules don't cover]

### II. [Principle name]

- [Rule]

Rationale: [why]

### III. Code is checked and stays maintainable

- Implementations MUST include tests covering the spec's acceptance scenarios.
- Code SHOULD stay explicit and simple. New abstractions MUST be justified in the plan's complexity
  tracking.
- Each rule MUST live in one place. A copy in another layer or language MUST be justified in the
  plan's complexity tracking.
- Warnings, size, complexity, and duplication measured by the project's checks MUST NOT go up. An
  exception MUST be approved by a human in the plan.

Rationale: "high-quality code" cannot be checked, but acceptance tests, justified complexity, and
checks that never go back can. Agents grow and copy code feature after feature unless something
measured stops them.

## Governance

- Only humans amend this constitution. Each amendment is a commit explaining why it was made.
- Versions follow semantic versioning: MAJOR when a principle is removed or redefined, MINOR when a
  principle is added or expanded, PATCH for wording changes.
- Specs and plans MUST include a constitution check. Exceptions MUST be listed in the plan's
  complexity tracking and approved by a human.

**Version**: 1.0.0 | **Ratified**: [YYYY-MM-DD] | **Last Amended**: [YYYY-MM-DD]
