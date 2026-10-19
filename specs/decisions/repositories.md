---
status: proposed
approved-by:
icon: folder-git-2
---

# Repositories

One Uraeda server serves every repository the human added, and two repositories never mix. The list
of repositories is data the human can read and edit by hand, shared by the CLI and the server
through the core.

## Rules

- The list MUST be data in the data folder, never in a repository or the session cache, and only the
  Rust core MUST read or write it. Checked by the core's tests and review.
- Each entry MUST be a git repository's main checkout, listed once, under a unique readable name.
  Checked by the core's tests.
- Removing a repository from the list MUST NOT change its files or its cached sessions. Checked by
  the core's tests.
- One server MUST serve every listed repository, and every page and route that touches a
  repository's data MUST be scoped to it by name, never mixing two. Checked by the server's tests.
- Each repository MUST have its own data endpoint and live updates; only a global one MAY span every
  repository. Checked by the server's tests.
- An entry MAY hold UI presentation, which workflow rules MUST NOT read. Checked by the core's tests
  and review.

## Why

The human wants one web UI for several repositories, and sees the list as data a human or an agent
can edit
([where the list of repositories lives](../done/2026-10-13-multi-repo-server.md#q8-where-does-the-server-keep-the-list-of-repositories)).
`ura add` and the server both write it, so the core owns it. URLs carry a readable name, not the
machine's paths
([how URLs name the repository](../done/2026-10-13-multi-repo-server.md#q6-how-do-urls-name-the-repository)).

## Alternatives considered

- `~/.config/uraeda/`, where XDG puts settings: a second folder, for a list the human sees as data.
- An opaque ID in URLs: stable, but unreadable links.
- One fate endpoint, with the repository in every record's ID: every source and view reworked.

## Consequences

- `ura add`, the web UI, and hand edits change one list a running server follows; two writes at once
  can lose one.
- A name stays as it was added, so links keep working; renaming by hand breaks them.
- Anyone signed in can add any repository of the machine and run agents in it.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/cli/`](/crates/cli/), and
  [`packages/server/`](/packages/server/), and every feature that reads or writes Uraeda's data
  folder
- [`packages/web/`](/packages/web/), and every feature that adds a page, a link, or a file route
