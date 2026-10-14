# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Look and feel pass](drafts/look-and-feel.md)

- [Add a bugfixing/low impact change flow](drafts/add-a-bugfixing-low-impact-change-flow.md)
- Add a "scratchpad" concept: quick notes about the system, small issues, ...

- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Setup with agent (checks project and creates relevant files)
- Make sure agents are resumable!

- [Run the web UI with npx](drafts/run-the-web-ui-with-npx.md)
- [Testing review](/specs/2026-10-14-testing-review/proposal.md)

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

- Monorepo support: multiple `specs` folders, principles per package, ...
- Codex runtime
- Adversarial review flow with a secondary model

- Nix + Docker based execution environments
- References (docs) querying and storing workflow -> our own local context8

- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable

## Later

> [!NOTE]

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
- Add a repository from the web UI by running `git init` in a folder outside git, or by cloning a
  URL

## Blocked

## Scratchpad

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
