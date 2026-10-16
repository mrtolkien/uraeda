# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Redesign + reword clarifications](drafts/redesign-clarifications/proposal.md)
- [Redesign + reword specs](drafts/redesign-specs.md)
- [Redesign feature and change pages](drafts/redesign-feature-page.md)
- [Redesign session](drafts/redesign-session.md)

- [Review the overall flow of all user stories](drafts/flow-review.md)

- Storybook's full interface inside Uraeda: its page lists stories but renders none, since
  Storybook's dev mode pins its messages to an origin the sandboxed frame lacks
  (`security.insecureIframeMessaging`). Look at it as a change, see round 04 of the UI iteration
  flow

- [Look and feel pass](drafts/look-and-feel.md)

- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Easy to read human guide
  - Setup with agent (checks project and creates relevant files)

## Next

> [!NOTE]
>
> Goals once I'm happy with the core feature set

- Benchmarks (harness, model, ...): blocked until the harness and the Claude Code integration are
  ready, see [backlog](backlog/benchmarks/proposal.md), with a discovery round and partial answers.
  - Speed up the process: iteration speed is too slow atm
  - This only doable once we have a good benchmark!

- [Worker lifecycle](drafts/worker-lifecycle.md): runs survive server restarts, usage limits, and
  their own background work, and go on to the next human gate without a "Continue"

- Run options
  - Master session vs one session per step
  - Review options: command, prompt, depth, ...
  - Can set global defaults and override per-feature

- CLI auto-expand in fish and ?zsh?
- Git listener process

- Neovim plugin: an "open priorities" shortcut, and review its shortcuts, they are very bad atm
- Review moving the UI tests to Storybook's test format, once the UI iteration flow brings Storybook
  in

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

## Blocked
