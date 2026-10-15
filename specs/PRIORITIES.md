# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Look and feel pass](drafts/look-and-feel.md)

- [Add a "scratchpad" concept: quick notes about the system, small issues, ...](/specs/2026-10-15-add-scratchpad/proposal.md)

- Settings page with selection of agent runner, config values, other run values
  - For example: does each step start with a new context or continues a "master session"? Should be
    a config flag, and able to toggle it per feature
  - Same for subagents in implementation, or review settings (command, model, count, ...)
- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Easy to read human guide
  - Setup with agent (checks project and creates relevant files)
- [UI iteration flow](/specs/2026-10-15-ui-iteration/proposal.md)
- Specs, clarifications, and related files should be on main. It will be easier to see what’s
  actually ongoing, and if there’s no code changes there should be no issue
- When adding a priority from home screen on mobile we need to go to the priorities page manually to
  commit…

## Next

> [!NOTE]
>
> Goals once I'm happy with the core feature set

- Benchmarks (harness, model, ...): blocked until the harness and the Claude Code integration are
  ready, see [backlog](backlog/benchmarks/proposal.md), with a discovery round and partial answers.
  - Speed up the process: iteration speed is too slow atm
  - This only doable once we have a good benchmark!
- Auth and login for basic security

- CLI auto-expand in fish and ?zsh?
- Ping user when input is needed
- Git listener process

- Neovim plugin: an "open priorities" shortcut, and review its shortcuts, they are very bad atm
- Review moving the UI tests to Storybook's test format, once the UI iteration flow brings Storybook
  in

- Monorepo support: multiple `specs` folders, principles per package, ...
- Codex runtime
- Adversarial review flow with a secondary model

- Nix + Docker based execution environments
- References (docs) querying and storing workflow -> our own local context8

- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable
- Extensions system: of course!

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

## Scratchpad

- Add notifications when there's a user action available
- Specs are still way too long and hard to read, with tens of bullet points (examples: "run ui")
- Allow no selection in responses (after a warning)
- Only true uraeda flows should show up in the UI -> `review-findings` was in the UI despite not
  having used the flow
- We can likely drop the nvim plugin and LSP... The WebUI is turning out just as good and working
  with worktrees in nvim is pretty hard. I like it for writing proposals though.
- Fix " ├╴ Link to non-existent document '/specs/2026-10-13-image-attachments/proposal.md' Marksman
  (2)"
  - Happens when there's a feature in a worktree: we should not link from main to worktree-only
    files
- Draft to proposal on mobile went 404
- We need a home icon/logo that goes back to the project root
- For UI work we need a few mock environments with fixed content. Once the environments exist, they
  can be used for reviews.
- We'll need a model selector for each step
- Make sure agents are resumable! -> highlight crashed/stopped sessions
- In failures the `x` is is not centered in the circle
- When the agent was blocked due to auto mode in claude code, there was no way to know except
  visiting the session page
- Text input still feels a bit laggy on sessions page, might be due to the huge page height
- We should have a way to have an agent be aware of multiple repos, for project spanning multiple
  repos and not in a monorepo
