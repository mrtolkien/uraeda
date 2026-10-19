---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Observation ordering helper, catalog accessor, label lookup, and persistence

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve a static catalog of three observation types, an `observations` table, and the five
>   names of the proposal in `openlibrary/core/observations.py`.
> - The ids are my choice: `fictionality` is type 2, and `genres` has nine values written by me.
>   They become stored data, so check them in [the catalog](#architecture).
> - An unknown label or value in a submission raises `ValueError` before anything is stored. An
>   unknown id in a lookup returns `None`.
> - Two `pace` values are stored if submitted: single choice is not enforced.
> - Unverified: the delete and insert inside one transaction cannot run here, because no Postgres
>   runs. The tests fake the database. If a real server disagrees, the plan's SQL changes, not the
>   behaviour.
> - Migration cost: existing databases need the table created by hand, and the developer dump is not
>   updated.
> - Risk tier `medium`, for the new table. The plan does not wait for your review.

Patrons describe a book with observations such as `pace: slow`. Today
[`observations.py`](/openlibrary/core/observations.py) only forwards to a remote service. This
feature gives it a catalog of types and values, a lookup from stored ids back to labels, and storage
of each patron's observations per work. The [proposal](proposal.md) fixes the names, the
[discovery](discovery-01.md) found the code, and the [clarifications](clarifications-01.md) settled
the catalog source and scope.

## Decisions

No decision is created, changed, or removed. The answers were choices of this feature, and none
outlives it.

Relied on: no decision is active.

## User stories

### US1: Read the catalog and order its values (P1)

A caller asks for the observation types and gets each one with its description, its choice mode, and
its value names in display order.

Key scenarios:

1. **Given** the catalog, **When** `get_observations()` is called, **Then** it returns a dictionary
   whose `observations` list is not empty, each entry having `label`, `description`, `multi_choice`,
   and `values`.
2. **Given** the catalog, **When** the entry labeled `pace` is read, **Then** `multi_choice` is
   `False` and `values` is `['slow', 'medium', 'fast']`.
3. **Given** the catalog, **When** the entry labeled `fictionality` is read, **Then** `values` is
   `['nonfiction', 'fiction', 'biography']`.
4. **Given** `order_list` `[3, 1, 2]` and `values_list`
   `[{id: 1, name: 'a'}, {id: 2, name: 'b'}, {id: 3, name: 'c'}]`, **When** `_sort_values` runs,
   **Then** it returns `['c', 'a', 'b']`.

More scenarios:

1. **Given** `order_list` `[2, 9, 1]` and the same values, **When** `_sort_values` runs, **Then** it
   returns `['b', 'a']`: id 9 has no value and is absorbed.
2. **Given** `order_list` `[1]` and the same values, **When** `_sort_values` runs, **Then** it
   returns `['a']`: ids 2 and 3 are not in the order and are excluded.
3. **Given** `order_list` `[1, 1]` and `values_list` with id 1 twice, named `a` then `z`, **When**
   `_sort_values` runs, **Then** it returns `['a']`.

### US2: Resolve stored ids to labels (P1)

A page that reads stored ids turns a type id and a value id back into the type label and the value
name.

Key scenarios:

1. **Given** the catalog, **When** `get_key_value_pair(1, 1)` is called, **Then** `key` is `'pace'`
   and `value` is `'slow'`.
2. **Given** the catalog, **When** `get_key_value_pair(10, 7)` is called, **Then** `key` is
   `'genres'` and `value` is `'mystery'`.
3. **Given** the result of `get_key_value_pair(1, 1)`, **When** it is unpacked as `key, value`,
   **Then** it gives `'pace'` and `'slow'`.
4. **Given** the catalog, **When** `get_key_value_pair(99, 1)` or `get_key_value_pair(1, 99)` is
   called, **Then** it returns `None`.

### US3: Keep a patron's observations equal to their latest submission (P1)

A patron submits their observations for a work. The stored set for that patron and work then equals
the submission, and nothing else changes.

Key scenarios:

1. **Given** patron `mek` has stored nothing for work `123`, **When** they submit
   `[{'pace': 'slow'}, {'genres': 'mystery'}]`, **Then** two rows are inserted: type 1 value 1, and
   type 10 value 7.
2. **Given** `mek` stored type 1 value 1 and type 10 value 7 for work `123`, **When** they submit
   `[{'pace': 'slow'}, {'fictionality': 'fiction'}]`, **Then** type 10 value 7 is removed, type 2
   value 2 is inserted, and type 1 value 1 stays once.
3. **Given** `mek` stored type 1 value 1 for work `123`, **When** they submit `[]`, **Then** that
   row is removed.
4. **Given** another patron's rows and `mek`'s rows for work `456`, **When** `mek` submits for work
   `123`, **Then** those rows are untouched.
5. **Given** a stored row, **When** `get_patron_observations('mek', '123')` is called, **Then** it
   returns records where `record['type']` is the type id and `record['value']` is the value id.

More scenarios:

1. **Given** a submission of `[{'pace': 'slow'}, {'speed': 'fast'}]`, **When**
   `persist_observations` is called, **Then** it raises `ValueError` and stores and removes nothing.
2. **Given** a submission of `[{'pace': 'sluggish'}]`, **When** `persist_observations` is called,
   **Then** it raises `ValueError` and stores and removes nothing.
3. **Given** a submission of `[{'pace': 'slow'}, {'pace': 'fast'}]`, **When** `persist_observations`
   is called, **Then** both rows are stored.
4. **Given** a submission listing `{'pace': 'slow'}` twice, **When** `persist_observations` is
   called, **Then** one row is stored.

## Architecture

The catalog is static data in the module, as you chose, and every other unit reads it. Storage
follows the `Booknotes` pattern in [`booknotes.py`](/openlibrary/core/booknotes.py): classmethods,
`db.get_db()`, and raw SQL with `$var` placeholders. The existing `post_observation`, `get_aspects`,
and the `/observations` and `/aspects` endpoints stay unchanged.

The catalog holds three types. Ids and descriptions marked mine are my choice:

| Type id | Label          | Single or multiple | Values, by value id                                                                                                             |
| ------- | -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1       | `pace`         | single             | 1 `slow`, 2 `medium`, 3 `fast`                                                                                                  |
| 2       | `fictionality` | single             | 1 `nonfiction`, 2 `fiction`, 3 `biography`                                                                                      |
| 10      | `genres`       | multiple           | 1 `adventure`, 2 `comedy`, 3 `fantasy`, 4 `historical`, 5 `horror`, 6 `romance`, 7 `mystery`, 8 `science fiction`, 9 `thriller` |

Descriptions are one short sentence each, such as "How fast the story moves", written by me. Only
`pace` (1, with `slow` as 1), `genres` (10, with `mystery` as 7), and the value names of `pace` and
`fictionality` come from the proposal.

- **The value ordering helper** `_sort_values` returns the names of the values whose id is in
  `order_list`, in that order. It owns the alignment rule: absent ids are absorbed or excluded, and
  duplicates count once.
- **The catalog** holds each type's id, label, description, `multi_choice`, an order list, and its
  `{id, name}` values. It is the only home of ids, and builds each `values` list with
  `_sort_values`.
- **`get_observations`** returns the catalog as `{'observations': [...]}`, each entry with `label`,
  `description`, `multi_choice`, and `values` as names.
- **`Observations.get_key_value_pair`** finds the type, then the value, in the catalog, and returns
  a `namedtuple` of `key` and `value`, or `None`.
- **`Observations.persist_observations`** maps each submitted `{label: value_name}` to ids, raising
  `ValueError` first for any unknown label or name. In one `db.transaction()`, it reads the stored
  set, deletes what the submission lacks, and inserts what the table lacks.
- **`Observations.get_patron_observations`** selects `observation_type as type` and
  `observation_value as value` for the patron and work.
- **The `observations` table** is described in [the data model](data-model.md), and added to
  `schema.sql` only.

Tradeoffs:

- A catalog change needs a code change.
- The proposal fixes no ids for `fictionality` or the other genres, so mine become permanent once
  patrons save data.
- Existing databases stay without the table until someone creates it.

## Edge cases

| Importance | Situation                                               | What happens                                                |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| High       | A submission has an unknown label or value name         | `ValueError` is raised, and the stored set is unchanged     |
| High       | The submission is empty                                 | All of the patron's rows for the work are removed           |
| High       | The patron submits for one work                         | Other works and other patrons keep their rows               |
| Normal     | A lookup id is not in the catalog                       | `get_key_value_pair` returns `None`                         |
| Normal     | A submitted value is already stored                     | It stays, once                                              |
| Normal     | The same value is submitted twice                       | One row is stored                                           |
| Normal     | Two values of a single-choice type are submitted        | Both are stored                                             |
| Normal     | `order_list` or `values_list` holds ids the other lacks | Ids with no value are absorbed, ids not ordered are dropped |
| Niche      | `order_list` or `values_list` repeats an id             | The first of each wins, and the name appears once           |

## Success criteria

- **SC-001** (exact catalog): `get_observations()` returns `['slow', 'medium', 'fast']` for `pace`
  and `['nonfiction', 'fiction', 'biography']` for `fictionality`.
- **SC-002** (round trip): after any submission, `get_patron_observations` returns exactly the
  submitted set as ids.
- **SC-003** (no partial write): a submission with an unknown label or value changes no row.
- **SC-004** (every scenario tested): each scenario above has a test, with the database faked.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- **Value ids** are local to their type, since the proposal pairs type 10 with value 7 and type 1
  with value 1.
- **The caller passes `work_id`** as the work's number written as a string, such as `'123'`. The
  query passes it through, and Postgres casts it to the integer column. No key parsing is added.
- **No order** is promised for the records of `get_patron_observations`.
- **The catalog's order lists** are written in the display order of the table above.
- **Rows have no timestamps**, since a row is never edited.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: a new table and new stored ids, but no security change and no change to data patrons
already have.
