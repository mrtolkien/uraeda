# Principles

`uraeda`:

- is git and full-text first
  - Information stored outside of text files in git needs to have a strong justification.
  - Decisions and design changes must be recorded in git for traceability.
  - Workflow artifacts must be plain text, readable and editable without uraeda tooling.
- keeps humans in control of consequential decisions
  - Agents work within human-approved scope and decisions.
  - Conflicts require explicit human resolution; agents cannot silently override prior decisions.
- helps humans express their needs and review consequential choices
  - Make consequential decisions and their tradeoffs understandable to the human.
  - Keep review effort proportional to the impact of the change.
  - Delegate implementation details within the approved design so work can proceed efficiently.
- supports asynchronous work across interruptions and agent changes
  - Durable workflow state must be recoverable from the repository.
  - Resuming work must not require the original chat session or agent.
  - Workers may keep temporary chat state and caches in memory.
- has _optional_ software tools (CLI, web UI, remote workers)
  - The workflow needs to work with any agent and be easily discoverable from inside any
    uraeda-using repository.
  - The workflow is self-documenting through its bundled `$repo_root/design/README.md`, which
    describes file formats, locations, and workflow conventions.
  - Tools enforce the same documented rules that humans and agents can follow without them, albeit
    an agent without the proper skills might create low quality artifacts.
- focuses on creating high quality, maintainable code
