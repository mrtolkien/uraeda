---
status: active
approved-by: mrtolkien
icon: folder-git-2
---

# Repositories

One Uraeda server serves every repository the human added, and two repositories never mix. The list
of repositories is data the human can read and edit by hand, shared by the CLI and the server
through the Rust core.

## Rules

- The list of repositories MUST be data in Uraeda's data folder, never in a repository or the
  session cache. Checked by the core's tests.
- The Rust core MUST be the only code that reads or writes the list. Checked by review.
- Each entry MUST be a git repository's main checkout, listed once, under a unique readable name.
  Checked by the core's tests.
- Removing a repository from the list MUST NOT change its files or its cached sessions. Checked by
  the core's tests.
- One server MUST serve every listed repository. Checked by the server's tests.
- Every page and route that touches a repository's data MUST be scoped to it by name, never mixing
  two. Checked by the server's tests.
- Each repository MUST have its own data endpoint and live updates, apart from one global endpoint
  for what spans them all. Checked by the server's tests.
- Workflow rules MUST NOT read an entry's presentation, such as its colour. Checked by the core's
  tests and review.

## Why

One web UI serves several repositories, and the list is data a human or an agent edits by hand. The
CLI's `ura add` and the server both write it, so the core owns it. Addresses carry a readable name
rather than the machine's paths, so links can be read and shared. History:
[Multi-repo server](../done/2026-10-13-multi-repo-server.md).

## Alternatives considered

- The config folder, where settings live: a second folder, for a list the human sees as data.
- An opaque ID in addresses: stable, but unreadable links.
- One data endpoint, with the repository in every record's ID: every source and view reworked.

## Consequences

- `ura add`, the web UI, and hand edits change one list a running server follows; two writes at once
  can lose one.
- A name stays as it was added, so links keep working; renaming by hand breaks them.
- Anyone signed in can add any repository of the machine, and run agents in it.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/cli/`](/crates/cli/), and
  [`packages/server/`](/packages/server/), and every feature that reads or writes Uraeda's data
  folder
- [`packages/web/`](/packages/web/), and every feature that adds a page, a link, or a file route
