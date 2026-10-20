# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Fix testing -> it's flaky and does not actually help](/specs/2026-10-19-fix-testing/proposal.md)
- [Merge chats and changes](/specs/2026-10-20-merge-chats/proposal.md)
- [Stable dev environment for UI review](/specs/2026-10-20-ui-sandbox/proposal.md)

- [Layout and look and feel](drafts/layout-and-look/proposal.md): the information architecture
  first, then 3 to 5 prototyped directions to pick from

- Empty inbox
- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Easy to read human guide
  - Setup with agent (checks project and creates relevant files)

## Next

> [!NOTE]
>
> Goals once I'm happy with the core feature set

- Neovim plugin: an "open priorities/inbox" shortcut, and review its shortcuts, they are very bad
  atm -> overall a small review as I've used it for a bit now
  - Would be nice to be able to connect to a running server to start steps?
  - Small change so let's do it
  - Offer nvim install during `ura install` if detected

- References (docs) querying and storing workflow -> our own local context8?
  - Issue faced: I'm using Astryx which is pretty new, and the agents did make errors with it
  - Where is this information saved? Not evergreen enough for AGENTS.md, not human-approved so not a
    decision?
  - This is early because it will help us develop the rest

- [Worker lifecycle](drafts/worker-lifecycle.md): runs survive server restarts, usage limits, and
  their own background work, and go on to the next human gate without a "Continue"

- Keyboard navigation in web UI
  - Leader-key inspired nav and/or vimium for extra links
  - ?Vim mode in text editing? -> depends on how much complexity it adds

- Run options
  - Master session vs one session per step
  - Review options: command, prompt, depth, ...
  - Can set global defaults and override per-feature

- Nix + Docker based execution environments
- Passkeys to sign in, on top of the access key of basic security

- Extensions system: claude integration could become an extension?

- Git listener process?

- Monorepo support: multiple `specs` folders, principles per package, ...
- Multi-repo projects: an agent/project aware of multiple repos, for projects spanning multiple
  repos and not in a monorepo
- Adversarial review flow with a secondary model + review settings

- Codex runtime + model settings

- Basic git UI in the web ui (pull, see diffs, ...)

- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable
  - This is v2.0

## Later

> [!NOTE]

> Might get dropped, low prio features

- Use Jev-like model (Clef) for one-shot classification of decisions: "Is this decision relevant to
  this proposal?", "Is this a valuable decision?", "Is this code change in line with the
  constitution?", ...
- Optional embeddings for code and docs search with Gemma Embeddings 2

- Non-technical users: a technical level in the proposal, adapting the spec's contents (plain
  language behaviour, design summarized or hidden, mockups) and the questions asked
  - Generally more user-level customization, with good presets

- ?Slack integration?
- Add a repository from the web UI by running `git init` in a folder outside git, or by cloning a
  URL
- Multi-users management

- Lightly integrate deployment tools to add preview environments and/or deploy status

- Mutation testing of the Rust code with cargo-mutants, on demand, to find code no test checks

## Blocked
