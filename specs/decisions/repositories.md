---
icon: folder-git-2
---

# Repositories

> "Repositories are not config but data. I think a repositories.json is nice and this way it can
> easily be edited by a human or coding agent."

The repositories are the git repositories whose features `ura serve` shows. One `ura serve` works on
all of them. Their list is a plain-text line of the settings file, `[serve] repositories` in
`config.toml`, which a human or an agent edits by hand.

## Rules

- The list of repositories is one plain-text list, which a human or an agent reads and edits by
  hand, outside every repository. _So:_ `ura serve` reads `[serve] repositories` of `config.toml`,
  and serves the repository it starts in when the list is empty.
- One `ura serve` serves every repository on the list. _So:_ the page of what waits lists every
  repository's rounds, specs, and plans, and the vault holds one `projects/<repository>/` for each.
- Two repositories never mix: every page and link carries its repository, under a name a human can
  read. _So:_ a round's address reads `/<token>/uraeda/<folder>/round`, never an opaque ID.

## Why

The human runs several projects from one place, often from a phone. A list a human can fix by hand
survives a lost cache. A page that showed one repository's features under another's name would make
the human approve the wrong thing. So the repository travels with everything, under a name they can
read and share. History: [Multi-repo server](../done/2026-10-13-multi-repo-server.md).

## Alternatives considered

- `repositories.json` in Uraeda's data folder, the 2.x way and the human's words above: data, apart
  from the settings, written by `ura add` and the app's form. Uraeda light has neither, and its one
  list is written by hand, beside the other settings of `ura serve`.
- An opaque ID in addresses: it survives a rename, but nobody can read the link.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/serve/`](/crates/serve/), and
  [`crates/vault/`](/crates/vault/), and every feature that adds a page or a link, or keeps
  something per repository
