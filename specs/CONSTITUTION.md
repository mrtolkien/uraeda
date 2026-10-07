# Uraeda Constitution

Principles are listed by priority: when two principles conflict, the higher one wins.

## Core Principles

### I. Humans stay in control

- Agents MUST stay within the scope and decisions a human approved.
- Agents MUST NOT activate a decision or override an active decision: only a human can.
- Conflicts with active decisions or with this constitution MUST be resolved explicitly by a human.

Rationale: Uraeda exists so agents cannot make consequential choices without the human knowing.

### II. Git and plain text first

- Workflow state, decisions, and design changes MUST be stored as plain text in git. Exceptions MUST
  be justified in a decision.
- Workflow artifacts MUST stay readable and editable without uraeda tools.

Rationale: git gives history, review, and traceability for free, and plain text works with every
agent and editor.

### III. Asynchronous by default

- Every workflow step MUST be completable with a git commit, without a live chat session.
- Durable workflow state MUST be recoverable from the repository alone. Only temporary chat state
  and caches MAY live in memory.
- Work MUST be resumable by a different agent or session than the one that started it.

Rationale: humans answer when they have time and agents run when triggered. Neither should wait for
the other.

### IV. Review effort matches impact

- Documents written for human review MUST explain needs and tradeoffs in terms the reader
  understands.
- Every question asked to a human MUST come with a recommended answer.
- The amount of human review MUST scale with the risk tier of the change.
- Agents SHOULD settle implementation details within the approved spec without asking.

Rationale: human attention is the scarcest resource in the workflow.

### V. Tools are optional

- The workflow MUST be discoverable in every uraeda-using repository.
- The workflow MUST work with any agent, with or without the uraeda CLI, web UI, or remote workers.
- Tools MUST only enforce rules that humans and agents can follow unaided.
- Uraeda MUST ship a template or skill for every artifact, and tools MUST validate artifacts
  whatever produced them.

Rationale: the workflow is the product. Tools make it faster and safer, but must never be the only
way to follow it.

### VI. Code is checked against the spec

- Implementations MUST include tests covering the spec's acceptance scenarios.
- Code SHOULD stay explicit and simple. New abstractions MUST be justified in the plan's complexity
  tracking.

Rationale: "high-quality code" cannot be checked, but acceptance tests and justified complexity can.

## Governance

- Only humans amend this constitution. Each amendment is a commit explaining why it was made.
- Versions follow semantic versioning: MAJOR when a principle is removed or redefined, MINOR when a
  principle is added or expanded, PATCH for wording changes.
- Specs and plans MUST include a constitution check. Exceptions MUST be listed in the plan's
  complexity tracking and approved by a human.

**Version**: 1.0.0 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-07
