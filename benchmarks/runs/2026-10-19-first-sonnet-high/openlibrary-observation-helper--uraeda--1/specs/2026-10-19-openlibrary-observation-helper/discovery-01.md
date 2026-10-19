# Discovery, round 01: Observation ordering helper, catalog accessor, label lookup, and persistence

## Summary

Observations are patron-given descriptors of a book, such as `pace: slow`. Each descriptor is a type
(`pace`) with one value (`slow`) and a numeric id for both. The proposal asks
`openlibrary/core/observations.py` for four things: a value ordering helper, a catalog accessor, an
id-to-label lookup, and per-patron storage for a work. Today the module only forwards to a remote
service (TheBestBookOn, "TBBO"): it has no catalog data, no table, and none of the five names the
proposal lists. The proposal fixes only three catalog facts: `pace`, `fictionality`, and one
`genres` value. The repository has no table for observations, and no Postgres runs in this
environment.

## How other products do it

Not researched. The proposal names exact interfaces, and the task forbids looking up existing
solutions, so no product or online solution was consulted.

### What they have in common

No product was read: nothing to report.

## Standards and libraries

### web.py database layer

- Installed `web.py` 0.62 (read by inspecting the installed package, `web/db.py`):
  `DB.multiple_insert(tablename, values, seqname=None, _test=False)`,
  `DB.delete(table, where, using=None, vars=None, _test=False)`, and `DB.transaction()`.
- [`openlibrary/core/db.py`](/openlibrary/core/db.py) wraps `get_db()` and exposes `insert`,
  `delete`, `query`, `transaction`. Existing models call `db.get_db()` then `oldb.query(...)`.

## The code

### Important reads

- [`openlibrary/core/observations.py`](/openlibrary/core/observations.py): 26 lines.
  `post_observation` POSTs to `TBBO_URL + '/api/observations'` with S3 keys. `get_aspects` GETs
  `TBBO_URL + '/api/aspects'`, memoized in memcache. Neither holds a catalog.
- [`openlibrary/plugins/openlibrary/api.py`](/openlibrary/plugins/openlibrary/api.py) lines 22 and
  427-455: imports both functions and serves `/observations` (POST) and `/aspects` (GET). Both stay
  as they are unless a question says otherwise.
- [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql): tables `ratings`, `booknotes`,
  `bookshelves*`, all keyed by `username text` and `work_id integer`, with `created` and `updated`
  timestamps. No `observations` table. It is loaded by
  [`docker/ol-db-init.sh`](/docker/ol-db-init.sh) and `scripts/2018/10/bootstrap.sh`, so an existing
  database needs the table created by hand.
- [`openlibrary/core/booknotes.py`](/openlibrary/core/booknotes.py) and
  [`ratings.py`](/openlibrary/core/ratings.py): the pattern to follow. Classes of `@classmethod`s,
  `oldb = db.get_db()`, raw SQL with `$var` placeholders, `list(oldb.query(...))`.
- [`openlibrary/tests/core/test_ratings.py`](/openlibrary/tests/core/test_ratings.py): a placeholder
  test. Other core tests (`test_waitinglist.py`, `test_fulltext.py`) use `monkeypatch` or
  `unittest.mock`. No core test touches Postgres.
- Environment: Python 3.9, `psql` present, `pg_isready` reports no server. A test against real
  Postgres cannot run here.

### The proposal's path and existing actions

- Catalog read: nothing exists to read; the three known facts are `pace` (id 1, values `slow`,
  `medium`, `fast`, single choice), `fictionality` (values `nonfiction`, `fiction`, `biography`),
  and `genres` (type id 10, value id 7 is `mystery`).
- Persist: nothing to meet today. The nearest existing action is `Booknotes.add`, which reads, then
  inserts or updates a row.
- Re-submit and delete: the proposal makes the latest submission the truth, so a changed submission
  removes values the patron dropped, and an empty submission removes all of the patron's values for
  that work.

### Rules and their owners

- Value order: only `_sort_values` owns it. The order list comes from the catalog data, the value
  list from the same data.
- Type and value ids: not defined anywhere in the repository. They become stored data once
  persisted.

### Likely changes

- [`openlibrary/core/observations.py`](/openlibrary/core/observations.py): add `_sort_values`,
  `get_observations`, `Observations`. With option B of [catalog source](#catalog-source), also a
  network call.
- [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql): add the `observations` table. With
  option B of [migration and dev data](#migration-and-dev-data), also
  `scripts/dev-instance/dev_db.pg_dump`.
- [`openlibrary/tests/core/test_observations.py`](/openlibrary/tests/core/test_observations.py):
  new, with the database faked.

## The proposal

### The catalog's content and source are not given

The proposal states what `get_observations()` returns but not where the data comes from, nor the
full list of types, ids, and descriptions. `get_key_value_pair(10, 7)` implies at least ten type
ids, and only `pace` (1) and `genres` (10) have ids. `fictionality` has no id. Stored rows keep ids,
so the numbering is permanent once data is saved.

### Behaviour for ids and labels outside the catalog

`get_key_value_pair` and `persist_observations` get no rule for an unknown id, label, or value name.

### Single-choice types

`pace` has `multi_choice` equal to `False`, but the proposal says the stored set equals the
submitted set and does not say a second `pace` value is refused.

### Partial alignment of `_sort_values`

"Well-defined" is given for an id missing from either list. Duplicate ids in either list are not
covered.

## Worth it and feasibility

Small feature, no new dependency. Outside behaviour relied on: Postgres semantics of `DELETE` and
`INSERT` inside one transaction, which cannot be checked here because no server runs. It is
unverified; the plan's first task should check it when a server is available, or the tests fake the
database. No security guard is relaxed.

## Approaches

Criteria come from the [proposal](proposal.md), the [constitution](/specs/CONSTITUTION.md)
(requirements kept as written, no extra feature, tests for every scenario, the repository's own
patterns). No decisions are active.

### Catalog source

How the catalog data reaches `get_observations()`. Relies on [the code](#important-reads).

| Option                           | Tests without a network | Matches the proposal's exact values | Moving parts                               |
| -------------------------------- | ----------------------- | ----------------------------------- | ------------------------------------------ |
| A. Static data in the module     | yes                     | yes, we write them                  | none                                       |
| B. Fetch from TBBO `get_aspects` | needs a fake            | unverified: response shape unknown  | a network call, memcache, a remote service |

### Catalog content

Which types, ids, and descriptions the static catalog holds. Only with option A of
[catalog source](#catalog-source).

| Option                                                                  | Proposal-conformant | Ids stable   | Extra scope      |
| ----------------------------------------------------------------------- | ------------------- | ------------ | ---------------- |
| A. Only the three types the proposal names, ids chosen to fit its pairs | yes                 | by choice    | none             |
| B. A fuller set of types supplied by the human                          | yes                 | by the human | the human's list |

### Migration and dev data

What accompanies the new table. Relies on [schema.sql](#important-reads).

| Option                                | Fresh installs work | Existing databases work | Files touched |
| ------------------------------------- | ------------------- | ----------------------- | ------------- |
| A. Add the table to `schema.sql` only | yes                 | by hand                 | 1             |
| B. Also add it to `dev_db.pg_dump`    | yes                 | dev only                | 2             |

### Needs no choice

- Unknown ids and labels, single-choice types, and duplicate ids in `_sort_values`: the proposal's
  intent decides them. See the settled points in
  [the questions](clarifications-01.md#settled-without-the-human).

## Not checked

- No web search: the task forbids looking up existing solutions, so products and online
  documentation were not read.
- The TBBO `/api/aspects` response shape: no network access was tried, and no local sample exists.
- Real Postgres behaviour: no server runs here.
