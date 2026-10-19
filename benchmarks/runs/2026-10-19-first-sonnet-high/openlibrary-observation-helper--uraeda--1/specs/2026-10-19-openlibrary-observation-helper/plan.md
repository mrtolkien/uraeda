---
status: auto-approved
spec-revision: 1
---

# Plan: Observation ordering helper, catalog accessor, label lookup, and persistence

**Goal:** Give `openlibrary/core/observations.py` a static catalog of observation types, the helper
and accessors that read it, and per-patron storage of observations in a new `observations` table.

**Architecture:** The catalog is one module-level list, the only home of type and value ids.
`_sort_values` owns the alignment rule between an order list and a value list, and builds each
`values` list. `get_observations` and `Observations.get_key_value_pair` only read the catalog.
`Observations.persist_observations` is the only writer: it validates every label and value name
first, then diffs inside one `db.transaction()`. Storage follows the `Booknotes` classmethod
pattern. See the spec's [Architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md), with [data-model.md](data-model.md).

## Review focus

- A submission with one valid and one unknown label (`[{'pace': 'slow'}, {'speed': 'fast'}]`):
  `ValueError` before the transaction opens, so no delete or insert runs. Task 2.
- A submission whose valid items come after an invalid one, with rows already stored: the stored
  rows are not deleted. Task 2.
- `_sort_values` with an id repeated in both lists: the name appears once. Task 1.

## Global constraints

- `get_observations()` returns `{'observations': [...]}`, each entry with `label`, `description`,
  `multi_choice`, `values` (value names, in display order). `pace` is `multi_choice` `False` with
  `['slow', 'medium', 'fast']`; `fictionality` has `['nonfiction', 'fiction', 'biography']`.
- Catalog ids: `pace` is 1 (`slow` 1, `medium` 2, `fast` 3); `fictionality` is 2 (`nonfiction` 1,
  `fiction` 2, `biography` 3); `genres` is 10, multiple choice (`adventure` 1, `comedy` 2, `fantasy`
  3, `historical` 4, `horror` 5, `romance` 6, `mystery` 7, `science fiction` 8, `thriller` 9). Value
  ids are local to their type. Ids never change meaning once stored.
- `get_key_value_pair` returns a `namedtuple` with `key` and `value`, or `None` for an unknown type
  id or value id.
- Stored rows use the keys `observation_type`, `observation_value`, `username`, `work_id`. The
  primary key covers all four, with no timestamps.
- An unknown label or value name raises `ValueError` before anything is stored or removed. Single
  choice is not enforced. `work_id` is passed through as a string.
- `post_observation`, `get_aspects`, and the `/observations` and `/aspects` endpoints stay
  unchanged.
- The table goes in `schema.sql` only: no migration, no dev dump change.

## Code read

- [`openlibrary/core/observations.py`](/openlibrary/core/observations.py): 26 lines,
  `post_observation` and `get_aspects` forward to a remote service. Importing it works in tests.
- [`openlibrary/core/booknotes.py`](/openlibrary/core/booknotes.py): classmethods using
  `db.get_db()` and `oldb.query(..., vars=...)` with `$var` placeholders.
- [`openlibrary/core/db.py`](/openlibrary/core/db.py): `get_db()` returns a web.py database, which
  has `query`, `delete`, `multiple_insert`, and `transaction`.
- [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql): `booknotes` and `ratings` tables,
  where `observations` goes.
- Tests: `openlibrary/tests/core/test_*.py`, plain pytest with `monkeypatch`. No Postgres runs, so
  storage tests fake the database. Validation: `python -m pytest openlibrary/tests/core`. No other
  readers or writers of `observations`, since it is new.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

| What                                           | Why                                                                             | Simpler alternative rejected         |
| ---------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| `FakeDB` test helper in `test_observations.py` | Three storage tests share a fake of `get_db()` that records deletes and inserts | Mocks per test repeat the same setup |

## Test map

Tests are plain pytest in `openlibrary/tests/core/test_observations.py`. Storage tests replace
`observations.db.get_db` with `FakeDB`, an in-memory table with a recording `transaction()`.

| Spec item                           | Task | Test                                                                                                                        |
| ----------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| US1.1, SC-001                       | 1    | `test_get_observations_entries_have_the_expected_keys`, `test_pace_values_in_order`, `test_fictionality_values_in_order`    |
| US1.4                               | 1    | `test_sort_values_follows_order_list`                                                                                       |
| US1 more 1, 2, 3                    | 1    | `test_sort_values_absorbs_missing_value`, `test_sort_values_excludes_unordered`, `test_sort_values_repeated_id_counts_once` |
| US2.1-3                             | 1    | `test_get_key_value_pair`, `test_get_key_value_pair_unpacks`                                                                |
| US2.4                               | 1    | `test_get_key_value_pair_unknown_returns_none`                                                                              |
| US3.1                               | 2    | `test_persist_inserts_new_rows`                                                                                             |
| US3.2, SC-002                       | 2    | `test_persist_replaces_stored_set`                                                                                          |
| US3.3                               | 2    | `test_persist_empty_removes_all`                                                                                            |
| US3.4                               | 2    | `test_persist_leaves_other_works_and_patrons`                                                                               |
| US3.5                               | 2    | `test_get_patron_observations_records`                                                                                      |
| US3 more 1, 2, SC-003, Review focus | 2    | `test_persist_unknown_label_changes_nothing`, `test_persist_unknown_value_changes_nothing`                                  |
| US3 more 3                          | 2    | `test_persist_two_single_choice_values_stored`                                                                              |
| US3 more 4                          | 2    | `test_persist_duplicate_submission_stores_once`                                                                             |

## Waves

- Wave 1: Task 1 (catalog and readers).
- Wave 2: Task 2 (storage), which consumes the catalog and edits the same files.

---

## Task 1: Catalog, `_sort_values`, `get_observations`, `get_key_value_pair`

**Files:**

- Modify: `openlibrary/core/observations.py`
- Create: `openlibrary/tests/core/test_observations.py`

**Interfaces:**

- Consumes: nothing.
- Produces: module-level `_sort_values(order_list, values_list) -> list[str]`;
  `get_observations() -> dict`; `Observations.get_key_value_pair(type_id, value_id)`; a module-level
  catalog `OBSERVATIONS` (list of dicts with `id`, `label`, `description`, `multi_choice`, `order`,
  `values` as `{id, name}`) that Task 2 reads.

- [x] **Step 1: Write the failing tests**

In `test_observations.py`, tests named in the Test map for Task 1. Examples of the pinned values:

```python
VALUES = [{'id': 1, 'name': 'a'}, {'id': 2, 'name': 'b'}, {'id': 3, 'name': 'c'}]

def test_sort_values_follows_order_list():
    assert observations._sort_values([3, 1, 2], VALUES) == ['c', 'a', 'b']

def test_sort_values_repeated_id_counts_once():
    values = [{'id': 1, 'name': 'a'}, {'id': 1, 'name': 'z'}]
    assert observations._sort_values([1, 1], values) == ['a']

def test_get_key_value_pair():
    key, value = observations.Observations.get_key_value_pair(10, 7)
    assert (key, value) == ('genres', 'mystery')
```

Also `[2, 9, 1]` gives `['b', 'a']`, `[1]` gives `['a']`, `(99, 1)` and `(1, 99)` give `None`,
`pace` is `multi_choice` `False`.

The break each test catches:

- Order test: sorting by value id instead of by `order_list`.
- Absorbed id: raising `KeyError` for id 9.
- Repeated id: listing `a` twice, or the later duplicate winning.
- Unknown id: raising instead of returning `None`.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/tests/core/test_observations.py`
- Expected: FAIL,
  `AttributeError: module 'openlibrary.core.observations' has no attribute '_sort_values'`

- [x] **Step 3: Implement the catalog and readers in `observations.py`**

`_sort_values`: index `values_list` by id keeping the first entry of each id, then walk `order_list`
once per distinct id, keeping names that exist. Define `OBSERVATIONS` with the ids of Global
constraints and a one-sentence description each. `get_observations` builds each entry's `values`
with `_sort_values(order, values)`. `Observations` is a class with `get_key_value_pair` returning
`KeyValuePair = namedtuple('KeyValuePair', 'key value')`, or `None`. Leave the existing functions
untouched.

- [x] **Step 4: Run the project's validation**

- Run: `python -m pytest openlibrary/tests/core`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add openlibrary/core/observations.py openlibrary/tests/core/test_observations.py
git commit -m "feat(openlibrary-observation-helper): catalog, ordering helper, and label lookup"
```

## Task 2: Storage of a patron's observations

**Risky:** Writes a new table and stores catalog ids permanently, in a delete-and-insert
transaction.

**Files:**

- Modify: `openlibrary/core/schema.sql` (add `observations` after `booknotes`)
- Modify: `openlibrary/core/observations.py`
- Modify: `openlibrary/tests/core/test_observations.py`

**Interfaces:**

- Consumes: `OBSERVATIONS` from Task 1.
- Produces: `Observations.persist_observations(username, work_id, observations) -> None` and
  `Observations.get_patron_observations(username, work_id) -> list` of records with `record['type']`
  and `record['value']`.

- [x] **Step 1: Write the failing tests, and `FakeDB`**

`FakeDB` holds rows as dicts, has `query(sql, vars)` returning the patron's rows for the work as
`type`/`value` records, `delete(table, where, vars)`, `multiple_insert(table, rows)`, and
`transaction()` as a context manager that records entry. Each test monkeypatches
`observations.db.get_db` to return it, seeded with rows. Tests are the Task 2 rows of the Test map.
Pinned expectations:

```python
def test_persist_replaces_stored_set(fake_db):
    fake_db.seed('mek', 123, [(1, 1), (10, 7)])
    Observations.persist_observations('mek', '123', [{'pace': 'slow'}, {'fictionality': 'fiction'}])
    assert fake_db.rows_of('mek', 123) == {(1, 1), (2, 2)}

def test_persist_unknown_label_changes_nothing(fake_db):
    fake_db.seed('mek', 123, [(1, 1)])
    with pytest.raises(ValueError):
        Observations.persist_observations('mek', '123', [{'pace': 'slow'}, {'speed': 'fast'}])
    assert fake_db.rows_of('mek', 123) == {(1, 1)}
    assert not fake_db.transactions
```

Inserted rows carry exactly `observation_type`, `observation_value`, `username`, `work_id`. The
break each test catches:

- Replace: deleting all and reinserting (type 1 value 1 would be inserted twice in the log), or
  never deleting.
- Unknown label: validating while writing, so `pace: slow` is written before the error.
- Other works and patrons: a delete not filtered by username and work.
- Duplicate submission: inserting `pace: slow` twice and hitting the primary key.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/tests/core/test_observations.py`
- Expected: FAIL,
  `AttributeError: type object 'Observations' has no attribute 'persist_observations'`

- [x] **Step 3: Implement storage and the table**

Add the table to `schema.sql` as in [data-model.md](data-model.md): the four columns, `NOT NULL`,
primary key over all four. Import `db` in `observations.py`. `persist_observations` converts each
`{label: name}` to a `(type_id, value_id)` using the catalog, raising `ValueError` for an unknown
label or name before any database call, then takes a set. Inside `with oldb.transaction():` it reads
the stored set, deletes the stored pairs that the submission lacks (always filtered by `username`
and `work_id`), and inserts the missing pairs with `multiple_insert` when there are any.
`get_patron_observations` selects `observation_type as type, observation_value as value` for the
username and work id, and returns a list.

- [x] **Step 4: Run the project's validation**

- Run: `python -m pytest openlibrary/tests/core`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add openlibrary/core/schema.sql openlibrary/core/observations.py openlibrary/tests/core/test_observations.py
git commit -m "feat(openlibrary-observation-helper): store a patron's observations per work"
```
