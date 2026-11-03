---
agent: true
about: tasks-reappear
category: Storage
---

# Completing a task rewrites all 5,000 tasks in IndexedDB, in 300 ms

Found while building recurring tasks: the task store writes the whole list on every change.
