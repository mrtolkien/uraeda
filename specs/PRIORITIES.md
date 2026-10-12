# Priorities

## Now

- "Finish feature"

## Next

- Claude Code runner (triggered manually): https://code.claude.com/docs/en/headless
- Git listener process
- Ping user when input is needed
- WebUI for _editing_ files related to the workflow
- Small onboarding explanation (what to read and in which order)
- Nvim plugin

## Later

- Nix + Docker based execution environments
- References (docs) querying and storing workflow -> our own local context8
- Code quality and style guides, workflow improvements
- Use Jev-like model (Clef) for one-shot classification of decisions: "Is this decision relevant to
  this proposal?", "Is this a valuable decision?", "Is this code change in line with the
  constitution?", ...
- Optional embeddings for code and docs search with Gemma Embeddings 2
- Public documentation maintenance / hooks?
- Setup with agent (checks project and creates relevant files)
- Non-technical users: a technical level in the proposal, adapting the spec's contents (plain
  language behaviour, design summarized or hidden, mockups) and the questions asked
- Monorepo support: multiple `specs` folders, principles per package, ...
- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable
- ?Slack integration?
- [Nice TUI](drafts/cli-tuis.md)
- CLI auto-expand in fish

## Blocked

- Benchmarks (harness, model, ...): blocked until the harness and the Claude Code integration are
  ready, see [backlog](backlog/benchmarks/proposal.md), with a discovery round and partial answers.
