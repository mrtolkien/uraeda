# Benchmark Constitution

Principles are listed by priority: when two principles conflict, the higher one wins. This file is
the constitution every benchmark case's project gets: the case's own repository has none.

## Core Principles

### I. Humans stay in control

- The agent MUST NOT change what a task's text forbids, or go beyond what it asks for.
- The agent MUST ask only what the human can decide, with a recommended answer for each question.

Rationale: the human owns the product's direction, and their time is the scarce resource.

### II. Requirements come from the task

- The spec MUST keep every requirement of the proposal, and every interface it names, as written.
- The spec MUST NOT add a feature the proposal does not ask for.

Rationale: the proposal is the human's whole statement of what they want.

### III. Code is checked and stays maintainable

- Implementations MUST include tests covering the spec's acceptance scenarios.
- Code SHOULD stay explicit and simple, and follow the repository's own patterns.

Rationale: the repository's own tests are how anyone can tell the work is done.
