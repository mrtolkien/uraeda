---
agent: true
about: codex-runtime
category: Deferred fixes
---

# A Codex or Claude Code session started on the agent's default model checks its effort changes against the agent's current default: if the configured default changes while the session runs, the effort picker and its check follow the new model, not the one the session runs on. Store the resolved model for such sessions.
