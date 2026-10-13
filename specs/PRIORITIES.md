# Priorities

## Now

- [Chat in the web UI: ask about a step without committing, see actual message that goes with the commit and push, ...](/specs/2026-10-13-chat-in-the-web-ui/proposal.md)

- Chats, proposals, and reviews should accept images (drag and drop in the page, still show a
  dedicated button)
- Look and feel pass: components style, logo, favicon, ...
  - Generally, the happy path should look good: parsed frontmatter should not appear in the edit
    box, we should have color and hierarchy for specs and plans, ...
- Clean server code that can open any folder on the host + be run easily with node -> make the tool
  multi-repos

## Next

- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Setup with agent (checks project and creates relevant files)

- Benchmarks (harness, model, ...): blocked until the harness and the Claude Code integration are
  ready, see [backlog](backlog/benchmarks/proposal.md), with a discovery round and partial answers.

- CLI auto-expand in fish and ?zsh?
- Ping user when input is needed
- Git listener process

## Later

- Monorepo support: multiple `specs` folders, principles per package, ...
- Codex runtime

- Nix + Docker based execution environments
- References (docs) querying and storing workflow -> our own local context8
- Code quality and style guides, workflow improvements

- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable

- Use Jev-like model (Clef) for one-shot classification of decisions: "Is this decision relevant to
  this proposal?", "Is this a valuable decision?", "Is this code change in line with the
  constitution?", ...
- Optional embeddings for code and docs search with Gemma Embeddings 2

- Public documentation maintenance / hooks?
- Non-technical users: a technical level in the proposal, adapting the spec's contents (plain
  language behaviour, design summarized or hidden, mockups) and the questions asked

- ?Slack integration?
- [Nice TUI](drafts/cli-tuis.md)

## Blocked

## Scratchpad

- Tools path in the agent run view should be stripped and only show path from the repo root
- Rename "Start and continue": all buttons starting an agent should be EXTREMELY CLEAR
- Need icons for different harnesses (claude code, codex, pi, ...)
- Better URLs for the navigation, right now it's a bit messy
  (/f/2026-10-13-chat-in-the-web-ui/clarifications-01.md)
