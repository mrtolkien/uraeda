---
discovery: low
---

# Ctrl+Enter sends every composer

## What

Enter should not start a change or send a chat message: Ctrl+Enter (or Cmd+Enter) sends, in every
composer, as the field of a Save already does. Enter adds a new line.

This follows [UI coherence](/specs/decisions/ui-coherence.md): all composers have the same rule.

The button that sends, "Start the change" or the chat's and a feature session's Send, shows the
modifier and Enter icon, as "Add and commit" shows its Enter key.
