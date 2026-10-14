# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Code quality and maintainability through the skill](drafts/code-quality-in-the-skill.md)

- Look and feel pass: components style, logo, favicon, ...
  - Generally, the happy path should look good: parsed frontmatter should not appear in the edit
    box, we should have color and hierarchy for specs and plans, ...

- Add a bugfixing/low impact change flow
- Add a "scratchpad" concept: quick notes about the system, small issues, ...

- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Setup with agent (checks project and creates relevant files)
- [Chats, proposals, and reviews should accept images (drag and drop in the page, still show a dedicated button)](/specs/2026-10-13-image-attachments/proposal.md)
- [Clean server code that can open any folder on the host + be run easily with node -> make the tool multi-repos](/specs/2026-10-13-multi-repo-server/proposal.md)

## Next

> [!NOTE]
>
> Nice to have post-release

- Benchmarks (harness, model, ...): blocked until the harness and the Claude Code integration are
  ready, see [backlog](backlog/benchmarks/proposal.md), with a discovery round and partial answers.
- Auth and login for basic security

- CLI auto-expand in fish and ?zsh?
- Ping user when input is needed
- Git listener process

- Monorepo support: multiple `specs` folders, principles per package, ...
- Codex runtime
- Adversarial review flow with a secondary model

- Nix + Docker based execution environments
- References (docs) querying and storing workflow -> our own local context8

- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable

## Later

> [!NOTE]
>
> Might get dropped, low prio features

- Use Jev-like model (Clef) for one-shot classification of decisions: "Is this decision relevant to
  this proposal?", "Is this a valuable decision?", "Is this code change in line with the
  constitution?", ...
- Optional embeddings for code and docs search with Gemma Embeddings 2

- Public documentation maintenance / hooks?
- Non-technical users: a technical level in the proposal, adapting the spec's contents (plain
  language behaviour, design summarized or hidden, mockups) and the questions asked

- Offer nvim install during `ura install` if detected
- ?Slack integration?
- [Nice TUI](drafts/cli-tuis.md)

## Blocked

## Scratchpad

- Tools path in the agent run view should be stripped and only show path from the repo root
- Rename "Start and continue": all buttons starting an agent should be EXTREMELY CLEAR
- Need icons for different harnesses (claude code, codex, pi, ...)
- Better URLs for the navigation, right now it's a bit messy
  (/f/2026-10-13-chat-in-the-web-ui/clarifications-01.md)
- Add an "open priorities" shortcut to the nvim plugin
- In a "done" feature, we should have a nice view of all its info, not just a dirty link to the
  report
- Only true uraeda flows should show up in the UI -> `review-findings` is in the UI despite not
  having used the flow
- Text fields still behave poorly: in the clarifications the "Notes" still sometimes "eats" some of
  my letters + the text is also shown in the "body" of the page which makes no sense. All text input
  fields should be align to only save with a button.
