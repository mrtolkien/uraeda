---
status: auto-approved
spec-revision: 1
---

# Plan: Observation ordering helper, catalog accessor, label lookup, and persistence

**Goal:** Add `_sort_values`, `get_observations`, and an `Observations` class (lookup, persistence,
read-back) to `openlibrary/core/observations.py`, with an `observations` table and its migration.

**Architecture:** The catalog is a module constant owning type and value ids. `_sort_values` owns
display order. `Observations` is a classmethod class over Postgres, like `Booknotes`, and
`persist_observations` owns the equals-latest-submission rule. See the spec's
[architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md)

## Review focus

- A submission with one valid and one invalid entry, as the _first_ entry invalid or the _last_:
  nothing is deleted or inserted. Task 2 tests the invalid entry last, after a valid one.
- A value id present twice in `order_list`: no duplicate name. Task 1.
- A multi-entry dict, such as `[{'pace': 'slow', 'genres': 'mystery'}]`, is not specified. It is
  handled by reading every item of each dict (ruling R1); Task 2 tests it.

## Global constraints

- Keep `post_observation`, `get_aspects`, the endpoints, and the form untouched.
- Unknown label or value on persist: `ValueError`, nothing stored or removed. Unknown id on lookup:
  `KeyError`.
- Catalog ids: `pace` 1 (`slow`, `medium`, `fast` = 1, 2, 3), `fictionality` 2 (`nonfiction`,
  `fiction`, `biography` = 1, 2, 3), `genres` 10 (nine values, `mystery` = 7). `multi_choice` is
  `False`, `False`, `True`.
- Stored rows use the keys `observation_type`, `observation_value`, `username`, `work_id`.
- Follow the `Booknotes` pattern: `db.get_db()`, `vars=`, classmethods.
- Constitution: tests cover every acceptance scenario; no feature beyond the proposal.

## Code read

- [`observations.py`](/openlibrary/core/observations.py): only `post_observation` and `get_aspects`.
- [`booknotes.py`](/openlibrary/core/booknotes.py): the classmethod and `oldb.query(..., vars=)`
  pattern.
- [`db.py`](/openlibrary/core/db.py): `get_db()` returns a `web.database`; tests replace it with an
  in-memory sqlite `web.database` through `monkeypatch`, since unit tests run without Postgres.
- [`schema.sql`](/openlibrary/core/schema.sql): `booknotes` is the table model.
- [`scripts/migrate_db.py`](/scripts/migrate_db.py): a versioned upgrader for the 2010 core schema,
  not used for the later tables, so it is left alone (R2).
- Tests: `openlibrary/tests/core/`, run with `pytest openlibrary/tests/core/test_observations.py`.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

None.

## Test map

Tests call the module directly; storage tests run on an in-memory sqlite `web.database` patched in
for `db.get_db`.

| Spec item                       | Task | Test                                                                     |
| ------------------------------- | ---- | ------------------------------------------------------------------------ |
| US1 scenarios 1-3, SC-001       | 1    | `test_get_observations_*`                                                |
| US2 scenarios 1-3               | 1    | `test_get_key_value_pair_*`                                              |
| US5 scenarios 1-3 and duplicate | 1    | `test_sort_values_*`                                                     |
| Unknown id on lookup            | 1    | `test_get_key_value_pair_unknown_id`                                     |
| US3 scenarios 1-3, SC-002       | 2    | `test_persist_replaces_value`, `_drops_other_type`, `_empty_clears_work` |
| US3 more 1 (other patron)       | 2    | `test_persist_leaves_other_patron`                                       |
| US3 more 2-3, invalid edge case | 2    | `test_persist_invalid_*_stores_nothing`                                  |
| US3 more 4 (string work_id)     | 2    | `test_persist_string_work_id`                                            |
| Same entry twice                | 2    | `test_persist_duplicate_entry_once`                                      |
| Transaction rollback            | 2    | `test_persist_rolls_back_on_insert_failure`                              |
| US4 scenarios 1-2               | 2    | `test_get_patron_observations_*`                                         |
| Review focus: multi-entry dict  | 2    | `test_persist_reads_every_item_of_an_entry`                              |

## Waves

1. Task 1.
2. Task 2 (edits the same file as task 1 and consumes its catalog).

---

## Task 1: Catalog, ordering, accessor, and lookup

**Files:**

- Modify: `openlibrary/core/observations.py`
- Test: `openlibrary/tests/core/test_observations.py`

**Interfaces:**

- Produces: `OBSERVATIONS` (catalog constant), `_sort_values(order_list, values_list) -> list[str]`,
  `get_observations() -> dict`, `Observations.get_key_value_pair(type_id, value_id)` returning a
  `namedtuple('KeyValuePair', 'key value')`.

- [x] **Step 1: Write the failing tests** for the rows marked Task 1 in the test map, including
      `_sort_values([3,1,2], …) == ['c','a','b']`, `[3,9,1]` absorbing 9, `[1]` excluding 2, `[1,1]`
      giving `['a']`, `get_key_value_pair(1,1) == ('pace','slow')`,
      `(10,7) == ('genres','mystery')`, and `KeyError` for type 99.

  Breaks caught: ordering by value id instead of `order_list`; duplicate names; mixed up ids.

- [x] **Step 2: Run them to check they fail**
  - Run: `pytest openlibrary/tests/core/test_observations.py`
  - Expected: FAIL, `ImportError: cannot import name '_sort_values'`

- [x] **Step 3: Implement** the catalog (each type: `id`, `label`, `description`, `multi_choice`,
      `values` as `{id, name}` dicts, `order` as ids ascending), `_sort_values`, `get_observations`
      (values as names ordered by `_sort_values`), and `Observations.get_key_value_pair`.

- [x] **Step 4: Run the validation**
  - Run:
    `pytest openlibrary/tests/core/test_observations.py && python -m flake8 openlibrary/core/observations.py --select=E9,F63,F7,F82`
  - Expected: PASS

- [x] **Step 5: Commit**

```bash
git add openlibrary/core/observations.py openlibrary/tests/core/test_observations.py specs/2026-10-19-openlibrary-observation-helper/plan.md
git commit -m "feat(openlibrary-observation-helper): observation catalog, ordering, and lookup"
```

## Task 2: Table, migration, persistence, and read-back

**Risky:** a new stored-data format and its migration, and a delete-then-insert that must be atomic.

**Files:**

- Modify: `openlibrary/core/schema.sql`, `openlibrary/core/observations.py`
- Create: `scripts/migrations/create_observations_table.sql`
- Test: `openlibrary/tests/core/test_observations.py`

**Interfaces:**

- Consumes: `OBSERVATIONS` and its type/value ids from task 1.
- Produces: `Observations.persist_observations(username, work_id, observations) -> None` and
  `Observations.get_patron_observations(username, work_id) -> list` of rows with `type` and `value`.

- [x] **Step 1: Write the failing tests** for the Task 2 rows of the test map, with a fixture that
      patches `db.get_db` to an in-memory sqlite database holding an `observations` table with the
      data model's columns and primary key. The rollback test makes the insert raise and asserts the
      old set remains.

  Breaks caught: deleting before validating; touching other works or patrons; duplicates; a
  non-atomic replace.

- [x] **Step 2: Run them to check they fail**
  - Run: `pytest openlibrary/tests/core/test_observations.py`
  - Expected: FAIL,
    `AttributeError: type object 'Observations' has no attribute 'persist_observations'`

- [x] **Step 3: Implement** the table in `schema.sql` (columns and composite primary key from the
      [data model](data-model.md); `created` defaults to now, UTC, like `booknotes`) and the same
      `CREATE TABLE` in the migration file. `persist_observations` resolves every entry to
      `(type_id, value_id)` first (raising `ValueError`), de-duplicates, then in one
      `oldb.transaction()` deletes this patron's rows for the work not in the set and inserts those
      missing. `get_patron_observations` selects
      `observation_type as type, observation_value as value`.

- [x] **Step 4: Run the validation**
  - Run:
    `pytest openlibrary/tests/core && python -m flake8 openlibrary/core/observations.py --select=E9,F63,F7,F82`
  - Expected: PASS

- [x] **Step 5: Commit**

```bash
git add openlibrary/core openlibrary/tests/core/test_observations.py scripts/migrations specs/2026-10-19-openlibrary-observation-helper
git commit -m "feat(openlibrary-observation-helper): persist and read patron observations"
```
