---
status: auto-approved
spec-revision: 1
---

# Plan: Observation ordering helper, catalog accessor, label lookup, and persistence

**Goal:** Give `openlibrary/core/observations.py` a catalog of 13 observation types, the ordering
helper, the catalog accessor, the id-to-name lookup, and the storage of each patron's latest
observations per work in a new `observations` table.

**Architecture:** As the [spec's architecture](spec.md#architecture) says. The catalog is a module
constant and owns which ids exist; `_sort_values` owns the misaligned-list rule;
`Observations.get_key_value_pair` owns ids to names; `Observations.persist_observations` owns names
to ids, the unknown-name error, and the replacement rule, in one transaction on `db.get_db()`. The
table is in [`schema.sql`](/openlibrary/core/schema.sql). `post_observation`, `get_aspects`, the
endpoints, and the form are untouched.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A failure after the inserts, before the deletes** leaves the patron's previous set as it was:
   the transaction rolls back the inserts too. Task 3.
2. **A submission that is only partly unknown**, `[{'pace': 'fast'}, {'pace': 'very slow'}]` over a
   stored `slow`: nothing is inserted or deleted, since names are resolved before any write. Task 3.
3. **A label known in one type used with a value of another**, `{'pace': 'mystery'}`: refused as
   unknown, since value names resolve within their type only. Task 3.

## Global constraints

- From [Observation ids](../decisions/observation-ids.md): "An observation type id or value id MUST
  NOT be renumbered once released." "A new type or value MUST take an id never used before in its
  scope: types across the catalog, values within their type." "The display order of a type's values
  SHOULD change through its display-order list, never through its value ids."
- From [Code quality](../decisions/code-quality.md): "New and changed Python lines MUST NOT be
  longer than 88 characters." "New and changed Python functions MUST NOT have a cyclomatic
  complexity over 10."
- The catalog is exactly the [data model's](data-model.md#observation-catalog): labels,
  descriptions, multiple-choice flags, value names, value ids, and display order, word for word.
- The table is exactly the [data model's](data-model.md#observations) `observations` table.
- Error messages, exactly: `Unknown observation: <label>: <value>` and
  `Unknown observation ids: type <type_id>, value <value_id>`, both `ValueError`.
- `post_observation`, `get_aspects`, their endpoints in
  [`api.py`](/openlibrary/plugins/openlibrary/api.py), and the form stay unchanged.
- `get_observations` and `get_key_value_pair` never touch the database (SC-003).

## Code read

- [`openlibrary/core/observations.py`](/openlibrary/core/observations.py): 27 lines,
  `post_observation` and `get_aspects`, imported by `api.py` only. Importing it needs no database.
- [`openlibrary/core/booknotes.py`](/openlibrary/core/booknotes.py): the class-of-classmethods
  pattern, each calling `db.get_db()` and web.py's `query`, `insert`, `delete` with `$name` vars.
- [`openlibrary/core/db.py`](/openlibrary/core/db.py): `get_db()` returns a memoized
  `web.database(**web.config.db_parameters)`. Tests replace it with `monkeypatch`.
- [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql): `ratings` and `booknotes`, the
  model for the new table; its `created` default, `current_timestamp at time zone 'utc'`, is
  PostgreSQL only, so SQLite tests create the table with their own DDL.
- [`openlibrary/plugins/upstream/tests/test_merge_authors.py`](/openlibrary/plugins/upstream/tests/test_merge_authors.py):
  uses `dbn="sqlite", db=":memory:"` in tests.
- Tests: `pytest`, in `openlibrary/tests/core/`; no core test uses a database. Baseline
  `python -m pytest openlibrary/tests/core -q`: 78 passed, 3 xfailed, 1 xpassed.
- Lint: `python -m flake8 --max-line-length=88 --max-complexity=10` on the changed files, the limits
  of the decision; `make lint-diff` diffs against `master`, which this repository does not have.
- No Docker and no PostgreSQL server in this environment: only the `psql` client and `psycopg2`. See
  [R1](rulings.md#r1-the-postgresql-check-runs-when-a-database-is-given).

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

| Abstraction or exception                     | Why it is needed                                                | Simpler alternative rejected because                           |
| -------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `OBSERVATION_CATALOG` module constant        | the spec's catalog; read by the accessor, lookup, and storage   | none simpler: a table would need a database for reads (SC-003) |
| `ObservationKeyValue` named tuple            | the lookup's result reads as `.key`, `.value`, and unpacks      | a plain tuple has no `.key`; a class needs `__iter__` by hand  |
| `observations_db` test fixture, two backends | every storage test runs on SQLite, and on PostgreSQL when given | SQLite only leaves the spec's unverified check undone          |

## Test map

The tests are in `openlibrary/tests/core/test_observations.py`. Catalog tests call the module
directly, with no database. Storage tests use the `observations_db` fixture: a fresh web.py database
with the `observations` table, which `db.get_db` is patched to return. It runs on in-memory SQLite,
and again on PostgreSQL when `OL_TEST_POSTGRES_DB` names a database (connection from the standard
`PG*` variables), creating the table from `schema.sql`'s own statement and dropping it after.

| Spec                                                            | Task | Test                                                                       |
| --------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| US1 1, SC-002                                                   | 2    | `test_catalog_has_13_types_in_id_order`, `test_catalog_ids_are_consistent` |
| US1 2, 3; SC-001                                                | 2    | `test_pace_entry`, `test_fictionality_values`                              |
| US1 more 1                                                      | 2    | `test_genres_entry`                                                        |
| US2 1, 2; SC-001                                                | 2    | `test_key_value_pair_pace_slow`, `test_key_value_pair_genres_mystery`      |
| US2 more 1, 2; edge: unknown ids                                | 2    | `test_key_value_pair_unknown_ids`                                          |
| SC-003                                                          | 2    | `test_catalog_reads_need_no_database`                                      |
| US4 1, 2, more 1, 2; edge: duplicate id in a display order      | 2    | `test_sort_values_*`                                                       |
| Data model: table DDL; edge: OLID `work_id` on PostgreSQL       | 1    | `test_table_*`, `test_olid_work_id_is_rejected` (PostgreSQL only)          |
| US3 1, more 4, 5                                                | 3    | `test_persist_then_read`, `test_stored_row`, `test_nothing_stored`         |
| US3 2                                                           | 3    | `test_resubmission_replaces_the_set`                                       |
| US3 3; edge: other works and patrons                            | 3    | `test_empty_submission_clears_only_that_work`                              |
| US3 more 1; edge: unknown label or value; Review focus 2, 3     | 3    | `test_unknown_observation_changes_nothing`                                 |
| US3 more 2, 3; edges: duplicate value, two single-choice values | 3    | `test_duplicate_value_stored_once`, `test_two_paces_are_stored`            |
| Edge: database failure; SC-004; Review focus 1                  | 3    | `test_failure_rolls_back`                                                  |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1 and 2: the table and its test fixture, and the pure catalog functions. Different source
   files; each adds its own tests to `test_observations.py`.
2. Task 3: the persistence, which needs the table and fixture of task 1 and the catalog of task 2.

---

## Task 1: The `observations` table, checked on the real database

**Risky:** it adds a stored-data format, and checks the web.py calls the spec marks unverified on
PostgreSQL.

**Files:**

- Modify: `openlibrary/core/schema.sql` (after `booknotes`)
- Test: `openlibrary/tests/core/test_observations.py` (create)

**Interfaces:**

- Produces: the `observations` table of the [data model](data-model.md#observations), and the pytest
  fixture `observations_db`, parametrized `sqlite` and `postgres`, which yields a web.py database
  with an empty `observations` table and patches `openlibrary.core.db.get_db` to return it.
  `postgres` is skipped unless `OL_TEST_POSTGRES_DB` is set.

- [x] **Step 1: Write the failing tests, and the fixture**

On the fixture's database, inside `with db.transaction():`, `multiple_insert` two rows with
`work_id='123'`, then `delete` one with a `where` on all four key columns and `vars`. Then:

- `test_table_round_trip`:
  `SELECT observation_type AS type, observation_value AS value ... ORDER BY` gives one row, readable
  as `row['type']` and `row['value']`, with `work_id` stored as `123`.
- `test_table_primary_key`: inserting the same four keys twice raises.
- `test_olid_work_id_is_rejected` (PostgreSQL only): inserting `work_id='OL123W'` raises, and no row
  is stored.

The break each test catches:

- Round trip: a DDL that names a column differently from the data model, or a `delete` whose `where`
  is not filled from `vars`.
- Primary key: a table without the composite primary key, which would let a value be stored twice.
- OLID: a `work_id` column typed `text`.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/tests/core/test_observations.py -q`
- Expected: on SQLite, the tests pass against the fixture's own DDL; the fixture fails first on
  PostgreSQL, if given, with `could not find CREATE TABLE observations in schema.sql`.

- [x] **Step 3: Add the table to `schema.sql`**

As the data model's table: `work_id integer NOT NULL`, `username text NOT NULL`,
`observation_type integer NOT NULL`, `observation_value integer NOT NULL`,
`created timestamp without time zone default (current_timestamp at time zone 'utc')`, primary key
`(work_id, username, observation_type, observation_value)`.

- [x] **Step 4: Run the project's validation**

- Run: `python -m pytest openlibrary/tests/core -q`, and
  `python -m flake8 --max-line-length=88 --max-complexity=10 openlibrary/tests/core/test_observations.py`
- Expected: PASS, the PostgreSQL cases skipped unless a database is given.

- [x] **Step 5: Commit**

```bash
git add openlibrary/core/schema.sql openlibrary/tests/core/test_observations.py
git commit -m "feat(openlibrary-observation-helper): observations table"
```

## Task 2: The catalog, the ordering helper, the accessor, and the lookup

**Files:**

- Modify: `openlibrary/core/observations.py`
- Test: `openlibrary/tests/core/test_observations.py`

**Interfaces:**

- Produces:
  - `OBSERVATION_CATALOG`: a list of dicts in type id order, each with `id`, `label`, `description`,
    `multi_choice`, `values` (a list of `{'id': int, 'name': str}`), and `order` (the value ids in
    display order). Exactly the data model's catalog.
  - `_sort_values(order_list, values_list) -> list[str]`.
  - `get_observations() -> {'observations': [{'label', 'description', 'multi_choice', 'values'}]}`.
  - `ObservationKeyValue = namedtuple('ObservationKeyValue', ['key', 'value'])`.
  - `class Observations` with
    `@classmethod get_key_value_pair(type_id, value_id) -> ObservationKeyValue`.

- [x] **Step 1: Write the failing tests**

```python
def test_sort_values_misaligned():
    assert _sort_values([2, 9, 1], VALUES) == ['medium', 'slow']

def test_key_value_pair_genres_mystery():
    key, value = Observations.get_key_value_pair(10, 7)
    assert (key, value) == ('genres', 'mystery')
```

With the spec's exact values: US1 1 to 3 and more 1 (13 entries, `pace` to `mood`, exactly four keys
each; `genres` with 24 values, `mystery` 18th); US2 1, 2, more 1, 2 with their exact messages; US4
1, 2, more 1, 2, and `_sort_values([1, 1], VALUES) == ['slow', 'slow']`. SC-002: type ids unique,
value ids unique per type, each `order` a permutation of its value ids. SC-003: patch
`openlibrary.core.db.get_db` to raise, then call both functions.

The break each test catches:

- Sort: a helper that iterates the values instead of the order list, or raises on id 9.
- Catalog entries: a key added to the public shape, such as `id`; a `genres` order by value id.
- Lookup: `get_key_value_pair` indexing lists by position, so `(10, 7)` gives `how-to`.
- Unknown ids: a lookup that returns `None`, or raises `KeyError`.
- SC-002: a mistyped id in the catalog, or a value missing from its display order.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/tests/core/test_observations.py -q`
- Expected: FAIL, `ImportError: cannot import name 'OBSERVATION_CATALOG'`, the first name imported.

- [x] **Step 3: Implement**

In `observations.py`, below the existing functions: the catalog, as the data model lists it, value
names lowercase, `entertainment` for type 2. `_sort_values` maps ids to names, then reads the order
list, skipping unknown ids. `get_observations` builds each entry from the catalog, `values` through
`_sort_values(type['order'], type['values'])`. `get_key_value_pair` finds the type by id and the
value by id within it, else raises the spec's `ValueError`.

- [x] **Step 4: Run the project's validation**

- Run: `python -m pytest openlibrary/tests/core -q`, and
  `python -m flake8 --max-line-length=88 --max-complexity=10` on the two files
- Expected: PASS; flake8 reports nothing on new lines.

- [x] **Step 5: Commit**

```bash
git add openlibrary/core/observations.py openlibrary/tests/core/test_observations.py
git commit -m "feat(openlibrary-observation-helper): observation catalog and lookup"
```

## Task 3: Storing and reading a patron's observations

**Risky:** it writes patron data, replacing a set in one transaction.

**Files:**

- Modify: `openlibrary/core/observations.py` (`Observations`)
- Test: `openlibrary/tests/core/test_observations.py`

**Interfaces:**

- Consumes: `observations_db` (task 1), `OBSERVATION_CATALOG` and `Observations` (task 2).
- Produces: `Observations.persist_observations(username, work_id, observations) -> None`, and
  `Observations.get_patron_observations(username, work_id) -> list` of rows with `['type']` and
  `['value']`, ordered by type id, then value id.

- [x] **Step 1: Write the failing tests**

```python
def test_resubmission_replaces_the_set(observations_db):
    persist('alice', '123', [{'pace': 'slow'}, {'genres': 'mystery'}])

    persist('alice', '123', [{'pace': 'fast'}, {'genres': 'mystery'}])

    assert pairs('alice', '123') == [(1, 3), (10, 7)]
```

`pairs` reads `get_patron_observations` as `(record['type'], record['value'])` tuples. One test per
row of the test map for task 3, with the spec's exact values. `test_failure_rolls_back` stores
`slow`, then makes the database's `delete` raise, submits `[{'pace': 'fast'}]`, expects the error,
and reads `[(1, 1)]`. `test_unknown_observation_changes_nothing` checks
`[{'pace': 'fast'}, {'pace': 'very slow'}]` and `[{'pace': 'mystery'}]` both raise the spec's
message and leave `[(1, 1)]`.

The break each test catches:

- Replacement: inserting without deleting, or deleting all and reinserting, which a mistyped `where`
  turns into deleting other patrons' rows (`test_empty_submission_clears_only_that_work`).
- Duplicates: inserting the same pair twice hits the primary key.
- Rollback: writes outside `transaction()`, so the inserted `fast` survives a failed delete.
- Unknown: resolving names one by one while writing.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/tests/core/test_observations.py -q`
- Expected: FAIL,
  `AttributeError: type object 'Observations' has no attribute 'persist_observations'`.

- [x] **Step 3: Implement**

`persist_observations` resolves every `{label: value}` to a `(type_id, value_id)` pair first, a set,
raising `ValueError('Unknown observation: <label>: <value>')` on the first unknown one. Then, in
`with oldb.transaction():`, it reads the stored pairs for `username` and `work_id`, inserts the
missing ones with `multiple_insert` (only when there are some), and deletes the absent ones by all
four key columns. `get_patron_observations` selects
`observation_type AS type, observation_value AS value` for `username` and `work_id`, ordered by
both, as a list.

- [x] **Step 4: Run the project's validation**

- Run: `python -m pytest openlibrary/tests/core -q`, and
  `python -m flake8 --max-line-length=88 --max-complexity=10` on the two files
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add openlibrary/core/observations.py openlibrary/tests/core/test_observations.py
git commit -m "feat(openlibrary-observation-helper): store a patron's observations"
```
