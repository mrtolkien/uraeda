# Priorities

## Now

> [!NOTE]
>
> Required for personal usage

Human reviews:

- [Scheduled jobs](/specs/2026-11-10-scheduled-jobs/proposal.md)

- Review the UI guidelines properly
- Once CRON jobs exist: daily persona run, performance run, code quality run, ...

- Multi-accounts management: auto rotation between multiple claude logins
  - Niche but would make it easier for me...
- Better settings: they're long now, need better navigation

## Next

> [!NOTE]
>
> Features for public release

- Break the components in their own library I can re-use in other places
  - Check if full Rust (Dioxus, or GPUI), is doable

- Cooler home view: logo, progress, gauges, ...
  - Home should be an extension or have widgets
- Dedicated docs website
  - Explain the concepts and the controls
  - Make sure docs stay up-to-date with agents instructions
  - Needs multiple agents and full features
- Video intro: show core features, look and feel, ...
- References (docs) querying and storing workflow -> our own local context8?
  - Issue faced: I'm using Astryx which is pretty new, and the agents did make errors with it
  - Where is this information saved? Not evergreen enough for AGENTS.md, not human-approved so not a
    decision?
  - This is early because it will help us develop the rest

- Proper security: Passkeys to sign in, on top of the access key of basic security

- [Docker Sandboxes for agents](/specs/proposals/docker-sandboxes.md)
- Dedicated Pi-durable runtime with basic tooling
  - Web tools in pi-durable -> "pi web access"
  - Model settings -> allow for local models and Synthetic, at least
- Monorepo support: multiple `specs` folders, principles per package, ...

## Later

> [!NOTE]

> Might get dropped, low prio features

- Workflow extensions: features, changes, and new workflows as WASM extensions that `ura` and the
  web UI both run, with hooks inside workflows. Postponed from the
  [Extensions system](/specs/2026-11-08-extensions-system/spec.md).

- [Markdown extensions](/specs/proposals/markdown-extensions.md): extensions draw blocks and inline
  patterns, mermaid as a built-in; maybe the grammar itself
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
- Multi-repo projects: an agent/project aware of multiple repos, for projects spanning multiple
  repos and not in a monorepo
  - Cross repo notes would be nice!

## Blocked
