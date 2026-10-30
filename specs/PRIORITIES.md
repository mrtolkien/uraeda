# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Run the server on a release build of the core](/specs/changes/2026-10-30-release-binding/proposal.md)

- [Decisions needs to be understandable with no context. Often agents just read the decisions, they can't be expected to search for extra info in records.](/specs/2026-10-29-decisions-needs/proposal.md)

- [Performance pass: the UI feels sluggish](/specs/2026-10-29-performance-pass/proposal.md)

- [Feature state pass](proposals/feature-state-pass/proposal.md)

- Empty inbox

- [Phone bottom bars on more pages](proposals/phone-bottom-bars.md)
- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Easy to read human guide
  - Onboarding/docs in the UI
  - Setup with agent (checks project and creates relevant files)

## Next

> [!NOTE]
>
> Goals once I'm happy with the core feature set

- Review the UI guidelines properly

- Vim in text edit mode

- [Worker lifecycle](proposals/worker-lifecycle.md): runs survive server restarts, usage limits, and
  their own background work, and go on to the next human gate without a "Continue"

- Basic git UI in the web ui (pull, see diffs, ...)
  - Pretty much web lazygit?

- Run options
  - Master session vs one session per step
  - Review options: model, command, prompt, depth, ...
  - Can set global defaults and override per-feature

- Heartbeat/cron jobs
- Global undo
- Keyboard nav in questions and specs

- Color themes
  - The classic open source ones
- Cooler home view: logo, progress, gauges, ...
- eink mode?

- References (docs) querying and storing workflow -> our own local context8?
  - Issue faced: I'm using Astryx which is pretty new, and the agents did make errors with it
  - Where is this information saved? Not evergreen enough for AGENTS.md, not human-approved so not a
    decision?
  - This is early because it will help us develop the rest

- Extensions system
  - claude integration could become an extension
  - Needs both core extenstions (WASM?), server extensions (TS?), and UI extensions
  - same for the references system which is more of a skill tbh

- Nix + Docker based execution environments

- Dedicated docs website
  - Explain the concepts and the controls
  - Make sure docs stay up-to-date with agents instructions

- Git listener process?

- Proper security: Passkeys to sign in, on top of the access key of basic security
- Monorepo support: multiple `specs` folders, principles per package, ...
- Multi-repo projects: an agent/project aware of multiple repos, for projects spanning multiple
  repos and not in a monorepo

- Codex runtime + model settings
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
