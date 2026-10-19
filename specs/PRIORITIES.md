# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Redesign session](/specs/2026-10-19-redesign-session/proposal.md)
- [Benchmarks (harness, model, ...): blocked until the harness and the Claude Code integration are ready, see backlog, with a discovery round and partial answers.](/specs/2026-10-19-benchmarks/proposal.md)

- [Some layout reviews](drafts/some-layout-reviews/proposal.md)

- Empty inbox

- [Decisions pass](drafts/decisions-pass.md)

- [Later questions resume the current step](drafts/later-questions-resume-the-current-step.md)
- [Review the overall flow of all user stories](drafts/flow-review.md)
- [Look and feel pass](drafts/look-and-feel/proposal.md)
- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Easy to read human guide
  - Setup with agent (checks project and creates relevant files)

## Next

> [!NOTE]
>
> Goals once I'm happy with the core feature set

- [Worker lifecycle](drafts/worker-lifecycle.md): runs survive server restarts, usage limits, and
  their own background work, and go on to the next human gate without a "Continue"

- Run options
  - Master session vs one session per step
  - Review options: command, prompt, depth, ...
  - Can set global defaults and override per-feature

- CLI auto-expand in fish and ?zsh?
- Git listener process

- Neovim plugin: an "open priorities" shortcut, and review its shortcuts, they are very bad atm

- Monorepo support: multiple `specs` folders, principles per package, ...
- Multi-repo projects: an agent/project aware of multiple repos, for projects spanning multiple
  repos and not in a monorepo
- Codex runtime + model settings
- Adversarial review flow with a secondary model + review settings

- Nix + Docker based execution environments
- References (docs) querying and storing workflow -> our own local context8

- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable
- Extensions system: of course!
- Basic git UI in the web ui (pull, see diffs, ...)

- Passkeys to sign in, on top of the access key of basic security
- Keyboard navigation of the lists, and how users discover it: the ↑ ↓ / j k keys of the priorities,
  inbox, and decisions lists, without a hint taking room (from the redesign of the priorities' spec
  review)

- [Stable dev environment for UI review](drafts/stable-dev-environment-for-ui-review.md)

- [Chat's right column](drafts/chat-right-column.md)

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
- Several users signing in to one Uraeda server, after basic security's single owner

- Lightly integrate deployment tools to add preview environments and/or deploy status

- Ask the agent in a side column: the session opens beside a round of questions or a spec, rather
  than leaving the page, which decides what the right sidebar holds on every page. Needs a change to
  the [layout decision](decisions/ui-layout.md), and saves wait while the agent replies (from Q1 of
  the clarifications redesign)

## Blocked
