# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Proposal naming](/specs/changes/2026-10-28-proposal-naming/proposal.md)

- [Full interactive UI pass: manual small fixes](proposals/full-interactive-ui-pass-manual-small-fixes.md)
- Write down our UI decisions and strategy based on the "UI fixes" worktree
- [Phone bottom bars on more pages](proposals/phone-bottom-bars.md)
- Amend the latest commits if the commits only touch workflow files
- Add `?` in status, after leader, for shortcuts
- Cooler home view: logo, progress, gauges, ...
- Performance pass: the UI feels sluggish
- Empty inbox
- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Easy to read human guide
  - Setup with agent (checks project and creates relevant files)

## Next

> [!NOTE]
>
> Goals once I'm happy with the core feature set

- References (docs) querying and storing workflow -> our own local context8?
  - Issue faced: I'm using Astryx which is pretty new, and the agents did make errors with it
  - Where is this information saved? Not evergreen enough for AGENTS.md, not human-approved so not a
    decision?
  - This is early because it will help us develop the rest

- [Worker lifecycle](proposals/worker-lifecycle.md): runs survive server restarts, usage limits, and
  their own background work, and go on to the next human gate without a "Continue"
- Heartbeat/cron jobs

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
