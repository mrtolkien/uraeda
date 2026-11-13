---
icon: folder-git-2
---

# Repositories

> "One server for all my projects, and two never mix."

## Rules

- The list of repositories is data in Uraeda's data folder, read and written only by the Rust core.
  _So:_ `ura add` and the web UI change one list.
- Each entry is a git repository's main checkout, listed once, under a unique readable name. _So:_
  an address reads `/r/todo/`, never a path.
- Removing a repository from the list never changes its files or its cached sessions. _So:_ adding
  it back finds everything.
- Every page and route that touches a repository's data is scoped to it by name. _So:_ two
  repositories never show on one feature's page.

## Why

One web UI serves several repositories, and the list is data a human or an agent edits by hand.
Addresses carry a readable name rather than the machine's paths, so links can be read and shared.
History: [Multi-repo server](../done/2026-10-13-multi-repo-server.md).

## Alternatives considered

- An opaque ID in addresses: stable, but unreadable links.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/cli/`](/crates/cli/), and
  [`packages/server/`](/packages/server/), and every feature that reads or writes Uraeda's data
  folder
- [`packages/web/`](/packages/web/), and every feature that adds a page, a link, or a file route
