# Discovery, round 01: Observation ordering helper, catalog accessor, label lookup, and persistence

## Summary

The proposal adds four things to `openlibrary/core/observations.py`: an ordering helper, a catalog
accessor, an id-to-label lookup, and per-patron persistence of observations for a work. Open Library
already stores a patron's per-work data in Postgres tables through small classmethod classes
(`Booknotes`, `Bookshelves`). The module today only proxies to an external service (TheBestBookOn,
"TBBO"). It has no catalog, no table, and no tests. The proposal pins the catalog's content only in
part, and does not say how the table is created.

## How other products do it

Not researched: the discovery effort is `low`, and the proposal fixes the interfaces. The
constitution also forbids adding features beyond the proposal
([constitution](/specs/CONSTITUTION.md)).

## Standards and libraries

### web.py database layer

- [`openlibrary/core/db.py`](/openlibrary/core/db.py): `get_db()` returns a cached `web.database`.
  `db.insert`, `db.delete`, `db.query`, and `db.transaction` proxy to it.
- [`Booknotes.add`](/openlibrary/core/booknotes.py): inserts or updates through `oldb.insert` and
  `oldb.update`, with `vars=` for query parameters. This is the repository's pattern.

## The code

### Important reads

- [`openlibrary/core/observations.py`](/openlibrary/core/observations.py): holds `post_observation`
  and `get_aspects`, which call TBBO over HTTP. It has none of the five names the proposal lists.
  `get_aspects` is cached in memcache and used by `/aspects` in
  [`api.py`](/openlibrary/plugins/openlibrary/api.py).
- [`openlibrary/core/booknotes.py`](/openlibrary/core/booknotes.py): the model for a
  `Booknotes`-style class: `@classmethod` methods, `db.get_db()`, `list(oldb.query(...))`.
- [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql): defines `ratings`, `booknotes`,
  `bookshelves_books`, each with `username text` and `work_id integer`, `created` and `updated`
  timestamps, and a composite primary key. No `observations` table exists.
- [`scripts/migrate_db.py`](/scripts/migrate_db.py): the repository's database migration script.
- [`openlibrary/tests/core/`](/openlibrary/tests/core/): unit tests run without a database. They
  replace functions with `monkeypatch`, as in
  [`test_lending.py`](/openlibrary/tests/core/test_lending.py). `test_ratings.py` is an empty stub.
- [`openlibrary/macros/UserMetadata.html`](/openlibrary/macros/UserMetadata.html): the observations
  form is built client side from `/aspects` (TBBO).

### The proposal's path and existing actions

- Read the catalog: nothing local exists. The only catalog today is TBBO's `/aspects` JSON.
- Resolve ids to labels: nothing exists.
- Persist: no table and no code. A resubmission with fewer values must delete the dropped rows, as
  the proposal says. An empty submission therefore clears the patron's observations for that work.
- Existing `/observations` POST in `api.py` forwards to TBBO and is not touched by the proposal.

### Rules and their owners

- Value order within a type: owned by the catalog's display-order list per type, applied by
  `_sort_values`. No other copy exists.
- Type and value ids: owned by the catalog. Stored rows reference these ids, so they must stay
  stable once rows exist.

### Likely changes

- [`openlibrary/core/observations.py`](/openlibrary/core/observations.py): add `_sort_values`, the
  catalog and `get_observations`, and `Observations`. Keep `post_observation` and `get_aspects`.
- [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql): an `observations` table, under
  option A or B of [the table](#the-table).
- [`openlibrary/tests/core/test_observations.py`](/openlibrary/tests/core/test_observations.py): new
  tests for every acceptance scenario.

## The proposal

### The catalog's content is only partly given

The proposal pins three facts: `pace` (type 1, `multi_choice` false) has values `slow`, `medium`,
`fast`, with `slow` as value 1. `fictionality` has `nonfiction`, `fiction`, `biography`, and no id
is given. `genres` is type 10, and `mystery` is its value 7. Type 10 means at least nine other types
exist in the source catalog. Their names, ids, and values are not in the proposal or the repository.

### Label and description fields

Each catalog entry needs a `description`, and the proposal gives none.

### Unknown labels or values on persist

`persist_observations` takes `{label: value_name}` dictionaries. The proposal does not say what
happens for a label or value not in the catalog.

### The `work_id` type

The proposal says `work_id` is a string. Existing tables use an `integer` column.

## Approaches

Criteria come from the [proposal](proposal.md): requirements kept as written, no unrequested
features, and the constitution's rule to follow the repository's patterns.

### The catalog's source

The accessor must work without the network, since its values are fixed by the proposal.

| Option                              | Offline | Matches the pinned values | Effort |
| ----------------------------------- | ------- | ------------------------- | ------ |
| A. A constant in `observations.py`  | yes     | yes, by construction      | low    |
| B. Parse TBBO's `/aspects` response | no      | unknown, never checked    | high   |

### The catalog's size

| Option                                                             | Risk                               |
| ------------------------------------------------------------------ | ---------------------------------- |
| A. Only the types the proposal names, with ids that match its pins | misses types the human has in mind |
| B. The human supplies the full list                                | the human's time                   |

### The table

| Option                                                     | Follows the repository | Safe for existing databases |
| ---------------------------------------------------------- | ---------------------- | --------------------------- |
| A. Add the table to `schema.sql` only                      | yes                    | needs a manual migration    |
| B. Add it to `schema.sql` and a migration under `scripts/` | yes                    | yes                         |

### Unknown labels and values

| Option                           | Behaviour for a patron                  |
| -------------------------------- | --------------------------------------- |
| A. Raise an error, store nothing | the submission fails visibly            |
| B. Skip the unknown entry        | the rest is stored, the bad one is lost |

### Needs no choice

- Atomicity: the diff of stored against submitted rows runs in one `db.transaction`, as the
  repository does elsewhere.
- Duplicate ids in `order_list` for `_sort_values`: each id yields at most the first matching name.

## Not checked

- The content of TBBO's catalog: its site was not read, and the constraint to produce independent
  work excludes copying existing solutions.
- Other products' observation features: skipped at `low` effort.
