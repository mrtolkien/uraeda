---
status: active
approved-by: mrtolkien
overridden-by:
spec:
date: 2026-09-01
---

# 0001. Tasks are stored in IndexedDB

Tasks MUST be stored in the browser's IndexedDB. The app MUST NOT require a server to store or read
tasks.

## Context

Follows the constitution's local first principle. IndexedDB keeps thousands of tasks without the
size limits of `localStorage`. Decided when the project started, before the Uraeda workflow.
