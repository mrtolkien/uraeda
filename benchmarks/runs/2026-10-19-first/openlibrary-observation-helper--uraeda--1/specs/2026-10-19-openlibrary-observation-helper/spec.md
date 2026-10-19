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
> - You approve a local catalog of three observation types, an id-to-label lookup, and a new
>   `observations` table that always equals a patron's latest submission for a work.
> - **Catalog ids and values I chose**: only `pace` (1), `genres` (10, `mystery` is 7), and the
>   three named types exist. Stored ids cannot change later without a data migration.
> - **Unknown input**: a label or value outside the catalog raises `ValueError`, and nothing is
>   stored.
> - **Migration**: a new table plus a migration script, so deployed databases need that script run.
> - **Risk tier** is `medium`: a new table, no UI, no change for patrons. The plan does not wait for
>   your review.

[`observations.py`](/openlibrary/core/observations.py) today only forwards to an external service.
This feature gives patrons' reader observations a local home: a fixed catalog, an id-to-label
lookup, an ordering helper, and storage. It follows the [proposal](proposal.md), the
[discovery](discovery-01.md), and the [clarifications](clarifications-01.md).

## Decisions

No decision is created, changed, or removed. No answer outlives the feature in a way code does not
already record.

Relied on: none. `specs/decisions/` is empty.

## User stories

### US1: Read the catalog (P1)

A caller reads the observation types, each with its value names in display order, with no network.

Key scenarios:

1. **Given** the catalog, **When** `get_observations()` is called, **Then** it returns a dictionary
   whose `observations` list is non-empty, each entry having `label`, `description`, `multi_choice`,
   and `values`.
2. **Given** the entry labeled `pace`, **When** it is read, **Then** `multi_choice` is `False` and
   `values` is `['slow', 'medium', 'fast']`.
3. **Given** the entry labeled `fictionality`, **When** it is read, **Then** `values` is
   `['nonfiction', 'fiction', 'biography']`.

### US2: Resolve ids to labels (P1)

A caller turns a stored type id and value id back into the type's label and the value's name.

Key scenarios:

1. **Given** type 1 and value 1, **When** `Observations.get_key_value_pair(1, 1)` is called,
   **Then** `key` is `'pace'` and `value` is `'slow'`.
2. **Given** type 10 and value 7, **When** it is called, **Then** `key` is `'genres'` and `value` is
   `'mystery'`.
3. **Given** the result, **When** it is unpacked as `key, value = result`, **Then** it gives the
   same pair.

### US3: Persist a patron's observations (P1)

A patron's stored observations for a work equal their latest submission. Other works and other
patrons are untouched.

Key scenarios:

1. **Given** patron `alice` has stored `pace: slow` for work `100`, **When** she submits
   `[{'pace': 'fast'}]`, **Then** `slow` is removed and `fast` is inserted.
2. **Given** `alice` has stored `pace: slow` and `genres: mystery` for work `100`, **When** she
   submits `[{'pace': 'slow'}]`, **Then** `pace: slow` remains once and `genres: mystery` is
   removed.
3. **Given** `alice` has stored observations for works `100` and `200`, **When** she submits `[]`
   for work `100`, **Then** all her rows for `100` are removed and those for `200` remain.

More scenarios:

1. **Given** `bob` has stored `pace: slow` for work `100`, **When** `alice` submits
   `[{'pace': 'fast'}]` for `100`, **Then** `bob`'s row is unchanged.
2. **Given** a submission `[{'pace': 'slow'}, {'color': 'red'}]`, **When** it is persisted, **Then**
   `ValueError` is raised and nothing is stored or removed.
3. **Given** a submission `[{'pace': 'quick'}]`, **When** it is persisted, **Then** `ValueError` is
   raised and nothing is stored or removed.
4. **Given** `work_id` is `'100'`, **When** rows are stored, **Then** they are stored for work
   `100`.

### US4: Read a patron's observations (P2)

A caller reads back what a patron stored for a work.

Key scenarios:

1. **Given** `alice` stored `pace: slow` for work `100`, **When**
   `get_patron_observations('alice', '100')` is called, **Then** it returns one record whose
   `record['type']` is `1` and `record['value']` is `1`.
2. **Given** `alice` stored nothing for work `300`, **When** it is called for `300`, **Then** it
   returns an empty list.

### US5: Order value names (P2)

A caller orders value names from a display-order list, even when the value list does not align with
it.

Key scenarios:

1. **Given** `order_list` `[3, 1, 2]` and values `1: a`, `2: b`, `3: c`, **When** `_sort_values` is
   called, **Then** it returns `['c', 'a', 'b']`.
2. **Given** `order_list` `[3, 9, 1]` and values `1: a`, `3: c`, **When** it is called, **Then** id
   9 is absorbed and the result is `['c', 'a']`.
3. **Given** `order_list` `[1]` and values `1: a`, `2: b`, **When** it is called, **Then** id 2 is
   excluded and the result is `['a']`.

More scenarios:

1. **Given** `order_list` `[1, 1]` and values `1: a`, **When** it is called, **Then** the result is
   `['a']`, with no duplicate.

## Architecture

The catalog is a constant in `observations.py`, since the pinned values must work offline. Storage
follows the repository's `Booknotes` pattern: a classmethod class over a Postgres table. See the
[discovery](discovery-01.md#approaches) for the options weighed. The external service functions
`post_observation` and `get_aspects`, the endpoints, and the form stay untouched.

- **The catalog** holds each type's id, `label`, `description`, `multi_choice`, its value ids with
  names, and a display-order list of value ids. It owns type and value ids.
- **`_sort_values`** turns an order list and a value list into value names in order. It owns the
  display-order rule, and the absorb-and-exclude rule for misaligned lists.
- **`get_observations`** exposes the catalog as `{'observations': [...]}`, with `values` as names
  ordered by `_sort_values`.
- **`Observations.get_key_value_pair`** resolves ids to a `(key, value)` result with attributes
  `key` and `value`.
- **`Observations.persist_observations`** validates every entry first, then, in one transaction,
  deletes dropped rows and inserts new ones. It owns the equals-latest-submission rule.
- **`Observations.get_patron_observations`** reads a patron's rows for a work as records with `type`
  and `value`.
- **The `observations` table and its migration** store the rows: see the
  [data model](data-model.md).

Tradeoffs:

- Ids 2 to 9 of types stay unused until real types arrive.
- The new storage has no caller until a later feature.
- One invalid entry blocks a whole submission.

## Edge cases

| Importance | Situation                                 | What happens                                    |
| ---------- | ----------------------------------------- | ----------------------------------------------- |
| High       | A label or value is not in the catalog    | `ValueError`, and nothing is stored or removed  |
| High       | The insert fails after the delete         | The transaction rolls back, the old set remains |
| Normal     | An empty submission                       | All the patron's rows for that work are removed |
| Normal     | A value in both stored and submitted sets | It stays, never duplicated                      |
| Normal     | `work_id` given as a string               | The database coerces it to an integer           |
| Niche      | The same entry twice in one submission    | It is stored once                               |
| Niche      | An id absent from the catalog on lookup   | The lookup raises `KeyError`                    |

## Success criteria

- **SC-001** (offline): `get_observations()` and `get_key_value_pair` work with no network or
  database.
- **SC-002** (equal sets): after any valid submission, the stored set for that work equals the
  submitted set.
- **SC-003** (all scenarios): every scenario above has a unit test, with the database replaced.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there, and every answer was the recommended one. Settled while writing this spec:

- **Type ids**: `pace` is 1, `fictionality` is 2, and `genres` is 10. Ids 3 to 9 are unused.
- **Value ids**: `slow`, `medium`, `fast` are 1, 2, 3. `nonfiction`, `fiction`, `biography` are 1,
  2, 3. `genres` has nine values I chose, with `mystery` as 7.
- **`multi_choice`**: `False` for `pace` and `fictionality`, `True` for `genres`. Descriptions are
  short sentences I wrote.
- **Unknown ids on lookup** raise `KeyError`: the proposal does not say.
- **Display order** of each type is its value ids ascending.
- **Record shape**: `get_key_value_pair` returns a named tuple, and `get_patron_observations`
  returns query rows aliasing `observation_type` as `type` and `observation_value` as `value`.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: a new table and a migration, with no UI and no change for patrons.
