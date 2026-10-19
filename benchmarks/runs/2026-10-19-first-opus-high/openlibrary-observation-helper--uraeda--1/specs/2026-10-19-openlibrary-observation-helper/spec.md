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
> - You approve an observations module with a catalog of 13 types, and a lookup from stored ids to
>   names. It stores each patron's latest observations per work in a new `observations` table. The
>   beta form and its endpoints stay as they are.
> - Two new decisions: observation ids are never renumbered or reused, and new Python code keeps
>   flake8's limits of 88 characters and complexity 10.
> - The catalog in the [data model](data-model.md) is the agent's, from the 2020 form. Its ids
>   become permanent: check its names, and genres numbered around mystery at 7.
> - Unverified: the storage calls were checked on SQLite only. The plan's first task runs them on
>   the project's PostgreSQL in docker; if one fails, the SQL changes, not the behaviour.
> - A submission with a label or value the catalog does not know is refused whole, with an error,
>   and nothing stored changes.
> - Production needs a manual `CREATE TABLE`, given in the pull request.
> - Risk tier `medium`, for the new table: the plan does not wait for your review.

The observations module, [`openlibrary/core/observations.py`](/openlibrary/core/observations.py),
gets what the [proposal](proposal.md) asks for. Observations are values patrons pick from fixed
lists to describe a work, like its pace or genres. The module gains a catalog of observation types
and their values, and a lookup from stored ids to names. It stores each patron's observations per
work. It also gains the helper that orders a type's value names. Today it only forwards to an
outside service whose catalog is gone. Nothing in the product calls the new functions yet. You chose
to keep this feature to the module, and to move the beta form in a later one. See the
[discovery](discovery-01.md) and [clarifications](clarifications-01.md).

## Decisions

- **New: [Observation ids](../decisions/observation-ids.md)**. Observation type and value ids are
  never renumbered or reused, and removing one comes with a plan for its stored rows.
- **New: [Code quality](../decisions/code-quality.md)**. New and changed Python code keeps lines
  within 88 characters and functions within a complexity of 10, as flake8 already checks.

No active decision applies: the ledger was empty before this spec.

## User stories

### US1: Read the observation catalog (P1)

A caller, like a future form, asks `get_observations()` for every observation type. Each comes with
its label, its description, whether it takes several values, and its value names in display order.

Key scenarios:

1. **Given** the catalog of the [data model](data-model.md#observation-catalog), **When**
   `get_observations()` is called, **Then** it returns `{'observations': [...]}`. It holds 13
   entries, ordered by type id from `pace` to `mood`. Each entry has exactly the keys `label`,
   `description`, `multi_choice`, and `values`.
2. **Given** the catalog, **When** `get_observations()` is called, **Then** the `pace` entry has
   `description` `'What is the pace of this book?'`, `multi_choice` `False`, and `values`
   `['slow', 'medium', 'fast']`.
3. **Given** the catalog, **When** `get_observations()` is called, **Then** the `fictionality` entry
   has `values` `['nonfiction', 'fiction', 'biography']`.

More scenarios:

1. **Given** the catalog, **When** `get_observations()` is called, **Then** the `genres` entry has
   `multi_choice` `True`, and 24 values starting `['biographical', 'textbook', 'reference']`.
   `'mystery'` is 18th, though its id is 7.

### US2: Resolve stored ids to names (P1)

A caller holding a stored row's type id and value id gets back the type's label and the value's
name, with `Observations.get_key_value_pair(type_id, value_id)`. The result reads as `.key` and
`.value`, or unpacks as a pair.

Key scenarios:

1. **Given** the catalog, **When** `get_key_value_pair(1, 1)` is called, **Then** its `key` is
   `'pace'`, its `value` is `'slow'`, and `key, value = result` gives `'pace'` and `'slow'`.
2. **Given** the catalog, **When** `get_key_value_pair(10, 7)` is called, **Then** its `key` is
   `'genres'` and its `value` is `'mystery'`.

More scenarios:

1. **Given** the catalog, **When** `get_key_value_pair(1, 4)` is called, **Then** it raises
   `ValueError('Unknown observation ids: type 1, value 4')`.
2. **Given** the catalog, **When** `get_key_value_pair(99, 1)` is called, **Then** it raises
   `ValueError('Unknown observation ids: type 99, value 1')`.

### US3: Store and read a patron's observations for a work (P1)

`Observations.persist_observations(username, work_id, observations)` makes the patron's stored set
for the work equal their latest submission.
`Observations.get_patron_observations(username, work_id)` returns it as records with
`record['type']` and `record['value']`. A submission is a list of single-entry `{label: value_name}`
dictionaries, as the beta form posts them. `work_id` is the work's numeric id as a string, like
`'123'` for `OL123W`.

Key scenarios:

1. **Given** patron `alice` has nothing stored for work `'123'`, **When** `alice` submits
   `[{'pace': 'slow'}, {'genres': 'mystery'}]`, **Then** `get_patron_observations('alice', '123')`
   returns two records. They are type 1 with value 1, then type 10 with value 7.
2. **Given** `alice` has `pace` `slow` and `genres` `mystery` on `'123'`, **When** `alice` submits
   `[{'pace': 'fast'}, {'genres': 'mystery'}]`, **Then** the records for `'123'` are type 1 with
   value 3, and type 10 with value 7. Each appears once. The `slow` row is deleted, and the
   `mystery` row is left in place.
3. **Given** `alice` has `pace` `slow` on works `'123'` and `'456'`, and `bob` has `pace` `slow` on
   `'123'`, **When** `alice` submits `[]` for `'123'`, **Then** `alice` has no records for `'123'`.
   The record of `alice` on `'456'`, and that of `bob` on `'123'`, are unchanged.

More scenarios:

1. **Given** `alice` has `pace` `slow` on `'123'`, **When** `alice` submits
   `[{'pace': 'slow'}, {'pace': 'very slow'}]`, **Then** it raises
   `ValueError('Unknown observation: pace: very slow')`. The only record is still type 1 with
   value 1.
2. **Given** `alice` has nothing on `'123'`, **When** `alice` submits
   `[{'genres': 'mystery'}, {'genres': 'mystery'}]`, **Then** there is one record, type 10 with
   value 7.
3. **Given** `alice` has nothing on `'123'`, **When** `alice` submits
   `[{'pace': 'slow'}, {'pace': 'fast'}]`, **Then** both are stored: type 1 with value 1, and type 1
   with value 3.
4. **Given** `alice` submitted `[{'pace': 'slow'}]` for `'123'`, **When** the `observations` table
   is read, **Then** its row has `observation_type` 1, `observation_value` 1, `username` `'alice'`,
   and `work_id` 123.
5. **Given** `alice` has nothing stored, **When** `get_patron_observations('alice', '123')` is
   called, **Then** it returns `[]`.

### US4: Order value names by a display-order list (P2)

A caller passes `_sort_values(order_list, values_list)` a list of value ids in display order, and a
list of `{id, name}` values. It gets back the names of the listed values, in the list's order.

Why this priority: the catalog accessor already returns ordered names through it. This story pins
the helper's own rule when the two lists are not aligned, which the proposal requires.

Key scenarios:

1. **Given** values
   `[{'id': 1, 'name': 'slow'}, {'id': 2, 'name': 'medium'}, {'id': 3, 'name': 'fast'}]`, **When**
   `_sort_values([3, 1, 2], values)` is called, **Then** it returns `['fast', 'slow', 'medium']`.
2. **Given** the same values, **When** `_sort_values([2, 9, 1], values)` is called, **Then** it
   returns `['medium', 'slow']`. Id 9 has no value and is absorbed; `fast` is not listed and is left
   out.

More scenarios:

1. **Given** the same values, **When** `_sort_values([], values)` is called, **Then** it returns
   `[]`.
2. **Given** no values, **When** `_sort_values([1, 2], [])` is called, **Then** it returns `[]`.

## Architecture

The catalog is a Python constant in the module, so reading it and resolving ids need no database
([where the catalog lives](discovery-01.md#needs-no-choice)). Storage follows
[`booknotes.py`](/openlibrary/core/booknotes.py) and [`ratings.py`](/openlibrary/core/ratings.py): a
class of classmethods calling web.py's `query`, `multiple_insert`, and `delete` on `db.get_db()`.
The existing `post_observation` and `get_aspects` stay untouched, as do the endpoints and the form
that call them.

- **The catalog** holds each type's id, label, description, multiple-choice flag, values with their
  ids, and display-order list. It owns which ids exist, under
  [Observation ids](../decisions/observation-ids.md).
- **The ordering helper**, `_sort_values`, owns the rule for misaligned lists: unknown ids are
  absorbed, unlisted values left out.
- **The catalog accessor**, `get_observations`, turns the catalog into the public shape, ordering
  each type's names with the helper.
- **The label lookup**, `Observations.get_key_value_pair`, owns the mapping from ids to names, and
  the error for unknown ids. Its result is a named tuple with `key` and `value`.
- **The persistence**, `Observations.persist_observations` and `get_patron_observations`, owns the
  mapping from names to ids, the error for unknown names, and the replacement rule. It resolves the
  whole submission first, then inserts the missing rows and deletes the absent ones in one
  transaction. Records come back ordered by type id, then value id.
- **The `observations` table**, in [`schema.sql`](/openlibrary/core/schema.sql), as the
  [data model](data-model.md#observations) describes.

Tradeoffs:

- Nothing in the product uses the storage until a later feature moves the beta form onto it.
- The catalog lives in code: changing it takes a deployment, not an admin edit.
- The single-choice flag is not enforced on the server: two paces are stored if submitted.

## Edge cases

| Importance | Situation                                                     | What happens                                                                   |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| High       | A submission holds a label or value the catalog does not know | `ValueError('Unknown observation: <label>: <value>')`, raised before any write |
| High       | The database fails during a submission                        | the transaction rolls back, and the patron keeps their previous set            |
| High       | A submission for one work                                     | other works of the patron, and other patrons, are never touched                |
| Normal     | An empty submission                                           | every observation of the patron for that work is deleted                       |
| Normal     | The same value submitted twice                                | it is stored once                                                              |
| Normal     | Several values for a single-choice type                       | they are stored as submitted                                                   |
| Normal     | `get_key_value_pair` with an id the catalog does not know     | `ValueError('Unknown observation ids: type <type_id>, value <value_id>')`      |
| Niche      | `work_id` given as an OLID, like `'OL123W'`                   | PostgreSQL rejects it for the integer column, and nothing is written           |
| Niche      | An id appears twice in a display-order list                   | its name appears once per occurrence                                           |

## Success criteria

- **SC-001** (pinned values): `get_observations()` and `get_key_value_pair` return every value the
  proposal pins: `pace`, `fictionality`, and genres' `mystery`.
- **SC-002** (consistent catalog): type ids are unique, and value ids are unique within their type.
  Each display-order list holds exactly its type's value ids.
- **SC-003** (no database for reads of the catalog): `get_observations()` and `get_key_value_pair`
  run with no database configured.
- **SC-004** (one transaction): a submission's inserts and deletes either all apply or none do.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- The second type is labelled `entertainment`, where the 2020 form named it `entertain`, to read as
  a noun like the others ([the 2020 catalog](discovery-01.md#the-2020-catalog-in-git-history)).
- Value names are all lowercase: the 2020 form's capitalized audiences, like `General audiences`,
  become `general audiences`.
- `get_observations()` entries hold exactly the four keys the proposal names, without ids: nothing
  asks for them.
- The error messages are those of the edge cases above, so callers and tests can match them.
- The table has a `created` column only, since its rows are never updated.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: a new table, with no change to existing data or interfaces.
