---
status: active
approved-by: mrtolkien
overridden-by:
spec: 001-recurring-tasks
date: 2026-10-07
---

# 0004. The next occurrence is created when a task is completed

Completing a recurring task MUST create its next occurrence as a new task. The app MUST NOT create
occurrences in advance.

## Context

Keeps the list short, and avoids a background job. See
[Q2](../001-recurring-tasks/clarifications.md#q2-when-does-the-next-occurrence-appear) and the
[research](../001-recurring-tasks/research.md#generating-occurrences).
