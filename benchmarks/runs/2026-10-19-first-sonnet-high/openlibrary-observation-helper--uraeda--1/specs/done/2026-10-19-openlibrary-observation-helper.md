---
kind: feature
finished: 2026-10-19
---

# Record: Observation ordering helper, catalog accessor, label lookup, and persistence

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, on the branch `2026-10-19-openlibrary-observation-helper`. Its full files are in git:
> `git log -- specs/2026-10-19-openlibrary-observation-helper/`.

## What and why

Patrons describe a book with observations such as `pace: slow`. `openlibrary/core/observations.py`
only forwarded to a remote service. It now has a catalog of observation types and values, a lookup
from stored ids back to labels, and storage of each patron's observations per work.

## Behaviour

- **Catalog**: `get_observations()` returns `{'observations': [...]}`, each entry with `label`,
  `description`, `multi_choice`, and `values` as names in display order. `pace` is
  `['slow', 'medium', 'fast']`, single choice; `fictionality` is
  `['nonfiction', 'fiction', 'biography']`.
- **Ordering**: `_sort_values(order_list, values_list)` returns names in `order_list` order. An id
  with no value is absorbed, a value not in the order is excluded, and a repeated id counts once,
  the first winning.
- **Lookup**: `Observations.get_key_value_pair(type_id, value_id)` returns a `namedtuple`
  `(key, value)`, or `None` for an unknown id. `(1, 1)` is `pace`, `slow`; `(10, 7)` is `genres`,
  `mystery`.
- **Persistence**: `persist_observations(username, work_id, observations)` makes the patron's stored
  set for the work equal the submission, in one transaction, leaving other works and patrons alone.
  An unknown label or value raises `ValueError` before any database call. Single choice is not
  enforced, and a duplicated value is stored once.
- **Reading**: `get_patron_observations(username, work_id)` returns records with `type` and `value`
  ids, in no promised order.

## Design

The catalog is static data in [`observations.py`](/openlibrary/core/observations.py), the only home
of ids: `pace` is type 1, `fictionality` 2, `genres` 10 (nine values, `mystery` is 7), with value
ids local to their type. These ids are stored data and never change meaning. Storage follows the
`Booknotes` pattern. The table is in [`schema.sql`](/openlibrary/core/schema.sql), with a primary
key over all four fields and no timestamps. Tests, with a faked database, are in
[`test_observations.py`](/openlibrary/tests/core/test_observations.py). The existing
`post_observation`, `get_aspects`, and endpoints are unchanged.

## Questions

### Round 01

#### Q1: Where does the observation catalog come from?

**Answer:** A. Static data in the module.

#### Q2: Which observation types does the static catalog hold?

**Answer:** A. Only the three named types.

#### Q3: Does the table need more than `schema.sql`?

**Answer:** A. `schema.sql` only; existing databases are altered by hand.

## Follow-ups

- The delete and insert in one transaction was never run against a real Postgres: the tests fake the
  database.
- Existing databases need the `observations` table created by hand, and the developer dump lacks it.
