# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [UI iteration flow](/specs/2026-10-15-ui-iteration/proposal.md)

- Redesign sidebars and global interface
- [Redesign + reword clarifications](drafts/redesign-clarifications/proposal.md)
- Redesign + reword specs
- Redesign session
- Redesign priorities
- [Settings page with selection of agent runner, config values, other run values](drafts/settings-page-with-selection-of-agent-runner.md)
  - For example: does each step start with a new context or continues a "master session"? Should be
    a config flag, and able to toggle it per feature
  - Same for subagents in implementation, or review settings (command, model, count, ...)

- [Look and feel pass](drafts/look-and-feel.md)

- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Easy to read human guide
  - Setup with agent (checks project and creates relevant files)
- [Auth and login for basic security](/specs/2026-10-16-basic-security/proposal.md)

## Next

> [!NOTE]
>
> Goals once I'm happy with the core feature set

- Benchmarks (harness, model, ...): blocked until the harness and the Claude Code integration are
  ready, see [backlog](backlog/benchmarks/proposal.md), with a discovery round and partial answers.
  - Speed up the process: iteration speed is too slow atm
  - This only doable once we have a good benchmark!

- CLI auto-expand in fish and ?zsh?
- Ping user when input is needed
- Git listener process

- Neovim plugin: an "open priorities" shortcut, and review its shortcuts, they are very bad atm
- Review moving the UI tests to Storybook's test format, once the UI iteration flow brings Storybook
  in

- Monorepo support: multiple `specs` folders, principles per package, ...
- Codex runtime + model settings
- Adversarial review flow with a secondary model + review settings

- Nix + Docker based execution environments
- References (docs) querying and storing workflow -> our own local context8

- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable
- Extensions system: of course!
- Basic git UI in the web ui (pull, see diffs, ...)

## Later

> [!NOTE]

> Might get dropped, low prio features

- Use Jev-like model (Clef) for one-shot classification of decisions: "Is this decision relevant to
  this proposal?", "Is this a valuable decision?", "Is this code change in line with the
  constitution?", ...
- Optional embeddings for code and docs search with Gemma Embeddings 2
- Mutation testing of the Rust code with cargo-mutants, on demand, to find code no test checks
  (asked in the testing review)

- Public documentation maintenance / hooks?
- Non-technical users: a technical level in the proposal, adapting the spec's contents (plain
  language behaviour, design summarized or hidden, mockups) and the questions asked

- Offer nvim install during `ura install` if detected
- ?Slack integration?
- [Nice TUI](drafts/cli-tuis.md)
- Add a repository from the web UI by running `git init` in a folder outside git, or by cloning a
  URL

## Blocked
