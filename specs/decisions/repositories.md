---
icon: folder-git-2
---

# Repositories

> "Repositories are not config but data. I think a repositories.json is nice and this way it can
> easily be edited by a human or coding agent."

The repositories are the git repositories the human added to Uraeda. One server works on all of
them. Their list is kept outside any of them, in Uraeda's data folder: the folder of the machine
where Uraeda keeps what is not in a repository.

## Rules

- The list of repositories is data: one plain-text file in Uraeda's data folder, which a human or an
  agent reads and edits by hand. It is never a setting, and never in a cache that can be lost. _So:_
  `ura add` in a terminal and the app's form write the same file, and a running server shows the new
  repository within a second.
- One server serves every repository on the list. _So:_ a scheduled job names the repositories it
  runs in, and adding a repository never starts a second server.
- Two repositories never mix: every page, link, and live update carries its repository, under a name
  a human can read. _So:_ an address reads `/r/uraeda/inbox`, never an opaque ID, and a change in
  one repository refreshes no page of another.

## Why

The human runs several projects from one place, often from a phone, and adds one from a terminal or
from the app. A list that both write, and that a human can fix by hand, is data, kept where it
survives a lost cache. A page that showed one repository's features under another's name would make
the human approve the wrong thing. So the repository travels with everything, under a name they can
read and share. History: [Multi-repo server](../done/2026-10-13-multi-repo-server.md).

## Alternatives considered

- The config folder, beside the settings: where the system's conventions put a user's list, but the
  human sees the list as data, and it is one more folder to know.
- An opaque ID in addresses: it survives a rename, but nobody can read the link.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/cli/`](/crates/cli/), and
  [`crates/server/`](/crates/server/), and every feature that keeps something outside a repository
- [`app/`](/app/), and every feature that adds a page, a link, or a live update
