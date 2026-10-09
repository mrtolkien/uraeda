# Web UI for the workflow files

Captured from a review session: notes for when the web UI is built.

## Rendering

- Render the workflow files with the Markdown flavour the skill defines (see "Markdown" in
  [the skill](../../skills/uraeda/SKILL.md)): callouts, typed bullets (`[pro]`, `[con]`, ...), list
  callouts, tables.
- Use the structured items to render more than Markdown: a clear hierarchy between a user story's
  description and its acceptance scenarios, options with their pros and cons, follow-up questions
  shown under their parent.
- Reference look: Obsidian with the Border theme, Minimal Theme Settings, Advanced Tables, Dataview,
  List Callouts, Multi Properties, and Task Collector.

## Workflow actions

- Answering, approving, and requesting changes happen in the UI: it sets the `status` fields and
  commits, so the documents never explain how to do it.
- On an answer or an approval, the UI turns the `> [!IMPORTANT]` block into a `> [!NOTE]` record,
  with the outcome and its date.
