# Priorities

## Now

> [!NOTE]
>
> Features for v1.0.0

- [Full interactive UI pass: manual small fixes](drafts/full-interactive-ui-pass-manual-small-fixes.md)
  - Write down our UI decisions and strategy based on the "UI fixes" worktree

- Decisions needs to be understandable with _no context_. Often agents just read the decisions, they
  can't be expected to search for extra info in records.
- Amend the latest commit if the commit touches only workflow files (proposals/notes)
- Add `?` in status, after leader. It should show all shortcuts of the page and be searchable
  - It'll be an overlay so use the glassy look, but also darken the rest of the page (modal-like)

- Performance pass: the UI feels sluggish
  - needs optimistic UI _everywhere_
  - needs caching of almost all values ahead of time
  - ideally locally no page takes more than 100ms to load
  - Moving a draft to a feature takes upwards of 10s with many page changes and no clear feedback

- Feature state pass
  - [testing-communication] A stopped session marks the feature as "needing attention" even if
    another session is running
  - After approving a spec the feature stayed in "needs you" until I ran a full refresh
  - Many, many issues with the "state" of a run: if a PR is up, it's "done" even if I restarted the
    session
    - If a session is running, it should always be visible in the sidebar/card/feature page
    - Generally we need better handling of "corner cases" of feature state/session state

- Review the UI guidelines properly
- Empty inbox

- Onboarding + README pass: claude setup, what to read and in which order, what to install, ...
  - Easy to read human guide
  - Onboarding/docs in the UI
  - Setup with agent (checks project and creates relevant files)

## Next

> [!NOTE]
>
> Goals once I'm happy with the core feature set

- Vim in text edit mode

- [Worker lifecycle](drafts/worker-lifecycle.md): runs survive server restarts, usage limits, and
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
