---
from: agent
project: todo
feature: 2026-10-06-recurring-tasks
---

# Completing a task rewrites all 5,000 tasks in IndexedDB, in 300 ms

Found while building recurring tasks: the task store writes the whole list on every change
(`src/store/tasks.ts`, `saveAll`). Measured with the list benchmark's 5,000 tasks, on Firefox 131.
