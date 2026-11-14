# Uraeda Constitution

Principles are listed by priority: when two principles conflict, the higher one wins.

## Core Principles

### I. Humans stay in control

- Agents MUST stay within the scope and decisions a human approved.
- A decision MUST take effect only when a human approves the spec or the round that changes it, or
  asks for the change directly. Only a human can override a decision.
- Conflicts with a decision or with this constitution MUST be resolved explicitly by a human.

Rationale: Uraeda exists so agents cannot make consequential choices without the human knowing.

### II. Git and plain text first

- Workflow state, decisions, and design changes MUST be stored as plain text in git. Ideas, the
  inbox, priorities, proposals not yet started, and research notes MAY live in the human's notes,
  outside git, as plain text: nothing in git depends on them. Other exceptions MUST be justified in
  a decision.
- Workflow artifacts MUST stay readable and editable without uraeda tools.

Rationale: git gives history, review, and traceability for free, and plain text works with every
agent and editor.

### III. Asynchronous by default

- Every agent step MUST end with a git commit, without a live chat session. A human's answers or
  review MAY wait uncommitted in the feature's checkout: the next agent step MUST commit them first,
  unchanged, as a commit of their own.
- Durable workflow state MUST be recoverable from the repository alone. Only temporary chat state
  and caches MAY live in memory.
- Work MUST be resumable by a different agent or session than the one that started it.

Rationale: humans answer when they have time and agents run when triggered. Neither should wait for
the other.

### IV. Review effort matches impact

- Documents written for human review MUST explain needs and tradeoffs in terms the reader
  understands.
- Every question asked to a human MUST come with a recommended answer.
- Agents SHOULD settle implementation details within the approved spec without asking.

Rationale: human attention is the scarcest resource in the workflow.

### V. Tools are optional

- A coding agent with no uraeda-specific instructions MUST be able to navigate the `specs/` folder
  through clear file names and contents. `specs/README.md` MUST explain the folder layout, say what
  lives outside git, and link to the Uraeda skill.
- The workflow MUST work with any agent, with or without the uraeda CLI, its pages, a notes app, or
  a session host.
- Tools MUST only enforce rules that humans and agents can follow unaided.
- Uraeda MUST ship a template or skill for every artifact, and tools MUST validate artifacts
  whatever produced them.

Rationale: the workflow is the product. Tools make it faster and safer, but must never be the only
way to follow it.

## Governance

- Only humans amend this constitution. Each amendment is a commit explaining why it was made.
- Versions follow semantic versioning: MAJOR when a principle is removed or redefined, MINOR when a
  principle is added or expanded, PATCH for wording changes.
- Specs and plans MUST include a constitution check. Exceptions MUST be listed in the plan's
  complexity tracking and approved by a human.

**Version**: 3.0.0 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-11-14
