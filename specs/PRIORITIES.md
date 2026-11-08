# Priorities

## Now

> [!NOTE]
>
> Still wanted for my personal usage

- [Extensions system](/specs/2026-11-08-extensions-system/proposal.md)
- [Pressing enter on a keyboard-focused row in the "clarifications" step opened…](/specs/changes/2026-11-08-pressing-enter/proposal.md)
- [We should be able to dismiss an inbox triage and recreate a new one.](/specs/changes/2026-11-08-triage/proposal.md)
- [Postponing a feature makes a proposal](/specs/changes/2026-11-08-postpone-proposal/proposal.md)

- Spec comments: suggestion vs change needed
- Review the UI guidelines properly

- Review and improve personas: describe workflows, habits, ...

## Next

> [!NOTE]
>
> Features for public release

- Codex runtime + model settings
- Cooler home view: logo, progress, gauges, ...
  - Needs more features/extensions
- Dedicated docs website
  - Explain the concepts and the controls
  - Make sure docs stay up-to-date with agents instructions
  - Needs multiple agents and full features
- Video intro: show core features, look and feel, ...
- Agents fix merge conflicts on open pull requests on their own, after Worker lifecycle
- References (docs) querying and storing workflow -> our own local context8?
  - Issue faced: I'm using Astryx which is pretty new, and the agents did make errors with it
  - Where is this information saved? Not evergreen enough for AGENTS.md, not human-approved so not a
    decision?
  - This is early because it will help us develop the rest

- Proper security: Passkeys to sign in, on top of the access key of basic security
- [Run options](/specs/proposals/run-options.md): one session per feature or per step, model and
  effort per step, review options, global defaults with per-feature overrides
- [Scheduled jobs](/specs/proposals/scheduled-jobs.md): agent runs on a schedule, like a daily
  dependencies upgrade and performance pass
- Monorepo support: multiple `specs` folders, principles per package, ...
- Multi-repo projects: an agent/project aware of multiple repos, for projects spanning multiple
  repos and not in a monorepo
  - Cross repo notes would be nice!

- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable
  - Model settings -> allow for local models and Synthetic, at least

- [Docker Sandboxes for agents](/specs/proposals/docker-sandboxes.md)

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
