# Priorities

## Now

> [!NOTE]
>
> Still wanted for my personal usage

- [In vim mode, visual mode seems to be working properly... except selected text…](/specs/changes/2026-11-04-vim-mode/proposal.md)
- [Reading long responses is not comfortable because the composer always stays…](/specs/changes/2026-11-04-reading-long/proposal.md)
- [Basic git UI in the web ui (pull, see diffs, ...)](/specs/2026-11-04-basic-git/proposal.md)
- [Some stuff is weirdly left-aligned, like sections titles, headers, and graphs.](/specs/changes/2026-11-04-some-stuff/proposal.md)
- [There shouldn't be a limit of 6 user stories in a feature.](/specs/changes/2026-11-04-6-stories/proposal.md)

- Review the UI guidelines properly

- Global undo
- Keyboard nav in questions and specs

## Next

> [!NOTE]
>
> Features for public release

- Color themes
  - The classic open source ones

- Extensions system
  - claude integration could become an extension
  - Needs both core extenstions (WASM?), server extensions (TS?), and UI extensions
  - same for the references system which is more of a skill tbh
- Nix / Docker based execution environments
  - Make it _safer_ to run agents in YOLO mode

- References (docs) querying and storing workflow -> our own local context8?
  - Issue faced: I'm using Astryx which is pretty new, and the agents did make errors with it
  - Where is this information saved? Not evergreen enough for AGENTS.md, not human-approved so not a
    decision?
  - This is early because it will help us develop the rest

- Git listener process?

- Proper security: Passkeys to sign in, on top of the access key of basic security
- Monorepo support: multiple `specs` folders, principles per package, ...
- Multi-repo projects: an agent/project aware of multiple repos, for projects spanning multiple
  repos and not in a monorepo
  - Cross repo notes would be nice!

- Codex runtime + model settings
- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable

- Cooler home view: logo, progress, gauges, ...
  - Needs more features/extensions

- Dedicated docs website
  - Explain the concepts and the controls
  - Make sure docs stay up-to-date with agents instructions
  - Needs multiple agents and full features

- Agents fix merge conflicts on open pull requests on their own, after Worker lifecycle

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
- eink mode?

## Blocked

- [Run options](/specs/proposals/run-options.md): one session per feature or per step, model and
  effort per step, review options, global defaults with per-feature overrides
- [Scheduled jobs](/specs/proposals/scheduled-jobs.md): agent runs on a schedule, like a daily
  dependencies upgrade and performance pass
