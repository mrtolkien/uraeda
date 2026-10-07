# Principles

## Put git and plain text first

- Store information as text in git. Justify exceptions.
- Record decisions and design changes in git for traceability.
- Keep workflow artifacts readable and editable without uraeda tools.

## Keep humans in control

- Keep agents within human-approved scope and decisions.
- Require explicit human resolution of conflicts.
- Never silently override prior decisions.

## Make consequential choices easy to review

- Help humans express their needs and understand tradeoffs.
- Match review effort to the impact of the change.
- Delegate implementation details within the approved design.

## Support work across interruptions and agent changes

- Recover durable workflow state from the repository.
- Resume without the original chat session or agent.
- Keep only temporary chat state and caches in memory.

## Make software tools optional

- Make the workflow discoverable in every uraeda-using repository.
- Support any agent, with or without a CLI, web UI, or remote workers.
- Document formats, locations, and conventions in `$repo_root/design/README.md`.
- Make tools enforce the same rules humans and agents can follow unaided.
- Recognize that agents without the right skills may produce poor artifacts.

## Create high-quality, maintainable code

- Deliver code that is easy to understand and maintain.
