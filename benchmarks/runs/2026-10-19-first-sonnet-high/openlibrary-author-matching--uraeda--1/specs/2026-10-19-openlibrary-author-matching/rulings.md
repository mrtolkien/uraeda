# Rulings: Match authors on alternate names and surname with birth and death dates

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Production case-insensitivity is checked by reading, not by a test

- **Decision**: task 1's outside check reads the vendored operator: `~` becomes `LIKE`
  ([`dbstore.py` lines 293-295](/vendor/infogami/infogami/infobase/dbstore.py)), with no `ILIKE`.
  Production case-insensitivity is therefore not provided by this repository.
- **Rationale**: a test through the real library needs a PostgreSQL server the repository's tests do
  not use. The human accepted the gap in Q3, option A, so the check does not stop the build.
- **Alternatives considered**: changing the submodule (Q3 option B), not chosen by the human.
- **If wrong**: casings differ on the live site until infogami changes.
- **Where**: task 1, step 1.

## R2: `walk_redirects` moves to module level

- **Decision**: `walk_redirects` is a module-level function in `load_book.py`, used by
  `find_authors_like`, instead of a closure inside `find_author`.
- **Rationale**: `find_author` now takes the import dictionary and delegates each search to
  `find_authors_like`; the redirect walk belongs to that helper.
- **Alternatives considered**: keeping the closure inside the helper: no gain.
- **If wrong**: move it back; no behaviour changes.
- **Where**: task 3.
