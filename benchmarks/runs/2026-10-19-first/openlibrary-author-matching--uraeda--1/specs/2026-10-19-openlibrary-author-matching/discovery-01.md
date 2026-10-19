# Discovery, round 01: Match authors on alternate_names/surname with birth/death date

## Summary

The import path resolves an incoming author to an existing Open Library author in `find_entity`.
Today it searches by exact name only, then filters by dates. The proposal turns this into a
three-step search: name, then `alternate_names`, then surname, each with birth and death dates. All
steps are case-insensitive and support `*` wildcards. The mock site needs a matching `regex_ilike`
method. The installed infogami query operator is case-sensitive, so production behaviour must be
checked.

## How other products do it

Not researched. The task forbids looking up outside solutions or workarounds, so this round reads
the code only. See [Not checked](#not-checked).

## Standards and libraries

### Infogami query operator `~`

- [`dbstore.py`](/infogami/infobase/dbstore.py) turns `~` into SQL `LIKE`, replaces `*` with `%`,
  and escapes `_` as `\_`. This is case-sensitive, and `_` stays a literal.
- The proposal says production uses ILIKE, and that the mock ignores `_`. The code here shows
  neither.
- infogami is a git submodule (`vendor/infogami`) that is not edited in this repository.

## The code

### Important reads

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py): `find_author(name)` queries
  `{'type': '/type/author', 'name': name}` and follows redirects. `find_entity(author)` calls it,
  adds the flipped name for "Last, First", skips candidates when only one side has `birth_date`,
  then applies `author_dates_match`. It picks the lowest key with `pick_from_matches`.
- [`catalog/utils/__init__.py`](/openlibrary/catalog/utils/__init__.py): `author_dates_match`
  returns True when a date is missing on either side, and accepts prefix matches before comparing
  years. `key_int` gives numeric key order.
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): `MockSite.things` and `filter_index`.
  The `~` operation is a case-sensitive prefix match. There is no ILIKE and no `regex_ilike`.
- [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py) monkeypatches
  `find_entity` to `None`.
  [`test_add_book.py`](/openlibrary/catalog/add_book/tests/test_add_book.py) `test_extra_author`
  already saves an author with `alternate_names`.
- [`marc/parse.py`](/openlibrary/catalog/marc/parse.py) sets `alternate_names` on parsed authors.

### The proposal's path and existing actions

- `build_query` and `add_book/__init__.py` call `import_author`, which calls `find_entity`. The only
  caller of `find_author` is `find_entity`.
- Non-person `entity_type` authors return the first name match with no date checks.
- An import author with no `birth_date` is rejected today when the record has one. The proposal's
  name-only fallback reverses this.
- A name with `, ` is also searched flipped.
- The author type has no `surname` field, only `personal_name`.

### Rules and their owners

- Date comparison: `author_dates_match` owns it. `find_entity` adds its own birth-date presence
  check.
- Candidate choice: `pick_from_matches` owns it, ordered by `key_int`.

### Likely changes

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py): `find_author(author: dict)` runs the
  three searches, and `find_entity` delegates to it.
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): `regex_ilike`, used by `filter_index`.
- Tests in `test_load_book.py`, plus a mock test.

## The proposal

### Case-insensitivity depends on infogami

The pinned infogami uses case-sensitive `LIKE`. The proposal assumes production ILIKE. Making
production case-insensitive may need an infogami change outside this repository.

### Name-only fallback against existing date checks

"When either date is absent, fall back to name matching alone" conflicts with the current rule that
rejects a dated record for an undated import. It also leaves open whether dates the input does have
still reject a mismatch.

### "Surname" has no stored field

The surname path must match a surname, but authors store `name`, `personal_name`, and
`alternate_names`. The surname must be derived from the input name, and the query shape is not
given.

### `find_entity` returns a candidate or `None`

One requirement says `find_entity` returns an existing record or `None`. Another says a new author
candidate dictionary is returned when nothing matches. `import_author` already builds candidates.

### `_` is ignored in mock patterns

Production escapes `_` as a literal. The proposal asks the mock to ignore it.

## Approaches

Criteria come from the proposal and the constitution's
[requirements principle](/specs/CONSTITUTION.md): keep every requirement as written, add no feature.

### Case-insensitive search in production

| Option                                        | Matches proposal | Scope              |
| --------------------------------------------- | ---------------- | ------------------ |
| A. Query with `~`, assume ILIKE in production | yes              | this repository    |
| B. Also bump the infogami submodule           | yes              | adds a dependency  |
| C. Filter case-insensitively in Python        | partly           | misses cased names |

### Dates when one is missing

| Option                                | Matches proposal | Data risk                |
| ------------------------------------- | ---------------- | ------------------------ |
| A. Name only, ignore all dates        | literal reading  | may merge unlike authors |
| B. Name, still reject year mismatches | partly           | fewer wrong merges       |

### What the surname path searches

| Option                                         | Matches proposal | Result                            |
| ---------------------------------------------- | ---------------- | --------------------------------- |
| A. Last word of the name, pattern `*<surname>` | yes              | finds "John Smith" for "J. Smith" |
| B. Records named exactly the surname           | yes              | rarely finds anything             |

### Needs no choice

- Returning `None` from `find_entity`: `import_author` already builds the candidate.
- `_` in mock patterns: follows the proposal.

## Not checked

- Other products and web sources: the task forbids outside solutions.
- Whether production infogami uses ILIKE: the submodule is not checked out here.
- How the mock indexes list values for `alternate_names`: the plan's first task checks it.
