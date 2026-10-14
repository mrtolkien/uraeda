---
status: active
approved-by: mrtolkien
---

# Repositories

One Uraeda server serves every repository the human added, from a plain-text list in Uraeda's data
folder that the CLI and the server both read and write through the core. Each repository's pages,
files, and live updates live under its own URL prefix, `/r/<name>/`, so two repositories never mix.

## Rules

- The list of repositories MUST be stored in `repositories.json`, in Uraeda's data folder for the
  user, the folder the [agents](agents.md) decision names. It MUST be JSON with a top-level
  `"version"`, readable and editable by hand. It MUST NOT be stored in a repository, or in
  `runner.sqlite`.
- Reading and writing the list, and finding the data folder, MUST live in the Rust core,
  [`crates/core`](/crates/core/). The CLI and the server, through the binding, MUST NOT read or
  write `repositories.json` any other way.
- A write MUST replace the file whole, through a temporary file renamed over it, so a reader never
  sees half a file.
- Each entry MUST be the main checkout of a git repository, by absolute path, listed once, with a
  name unique in the list, made of letters, digits, `.`, `_`, and `-`.
- A folder outside git MUST be refused. Removing a repository from the list MUST NOT change its
  files, or its sessions in the cache.
- One server process MUST serve every listed repository. Every UI page and server route that reads
  or writes a repository's data MUST start with `/r/<name>/`, its name in the list.
- Each repository MUST have its own fate endpoint and its own live updates: a change in one
  repository MUST NOT send an update to the views of another.

## Why

The human wants Uraeda to manage several repositories from one web UI, and a packaged Uraeda needs a
way to pick its first repository anyway ([proposal](../done/2026-10-13-multi-repo-server.md)). They
chose a plain `repositories.json` in the data folder, since "repositories are not config but data",
and a file "can easily be edited by a human or coding agent"
([Q8](../done/2026-10-13-multi-repo-server.md#q8-where-does-the-server-keep-the-list-of-repositories)).
They asked for `ura add`, adding the current folder from the CLI, which needs the list in a place
both tools know
([Q4](../done/2026-10-13-multi-repo-server.md#q4-how-do-you-name-a-folder-from-the-browser)): the
core owns it, as the [stack](stack.md) decision wants for logic shared by the CLI and the server.
URLs carry a readable name, not the machine's paths
([Q6](../done/2026-10-13-multi-repo-server.md#q6-how-do-urls-name-the-repository),
[the repository in the URL](../done/2026-10-13-multi-repo-server.md#q6-how-do-urls-name-the-repository)).
Only git repositories can be added, since every call into the core needs one
([Q3](../done/2026-10-13-multi-repo-server.md#q3-which-folders-can-be-added)).

## Alternatives considered

- `~/.config/uraeda/`, where XDG puts user settings: a second folder to know, for a list the human
  sees as data.
- An opaque ID in URLs, like Vibe Kanban: stable, but unreadable links.
- One fate endpoint, with the repository in every record's ID: one client in the UI, but every
  source, mutation, and view reworked to carry it.

## Consequences

- `ura add`, the web UI, and a hand edit all change the same list; a running server sees each
  change.
- A name stays as it was added, so links keep working; renaming is a hand edit of the file, which
  breaks the links using the old name.
- The UI holds one fate client per repository, and every link it builds starts with the repository.
- The server watches every listed repository, so its cost grows with the list.
- Anyone who reaches the server can add any repository of the machine and run agents in it: the
  `Host` and `Origin` check of the stack decision is the only protection, until a security feature
  adds more.
- Two writes at the same moment, from the CLI and the server, can lose one of them: the last write
  wins.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/cli/`](/crates/cli/), and
  [`packages/server/`](/packages/server/), and every feature that reads or writes Uraeda's data
  folder
- [`packages/web/`](/packages/web/), and every feature that adds a page, a link, or a file route
