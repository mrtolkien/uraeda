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

Patrons describe a work by picking values from fixed lists, like its pace or genres. The
observations module only forwarded them to an outside service, TheBestBookOn, whose catalog endpoint
now answers "Not Found", so the beta "My book notes" form cannot load. The proposal asked the module
itself for a catalog of observation types, a lookup from stored ids to names, storage of each
patron's latest observations per work, and a helper ordering value names by a display-order list.

## Behaviour

- **Ordering helper**: `_sort_values(order_list, values_list)` returns the names of the values whose
  ids are listed, in the list's order; an id with no value is skipped, a value not listed is left
  out, and an id listed twice gives its name twice.
- **Catalog accessor**: `get_observations()` returns `{'observations': [...]}`, 13 entries in type
  id order from `pace` to `mood`, each with exactly `label`, `description`, `multi_choice`, and
  `values`, the value names in display order. It needs no database.
- **Label lookup**: `Observations.get_key_value_pair(type_id, value_id)` returns a named tuple with
  `key` (the type's label) and `value` (the value's name), which unpacks as a pair; `(1, 1)` is
  `pace`, `slow`, and `(10, 7)` is `genres`, `mystery`. Unknown ids raise
  `ValueError('Unknown observation ids: type <type_id>, value <value_id>')`. It needs no database.
- **Persistence**: `Observations.persist_observations(username, work_id, observations)` takes a list
  of single-entry `{label: value_name}` dicts and makes the patron's stored set for that work equal
  to it: missing values are inserted, absent ones deleted, kept ones left in place, duplicates
  stored once, and an empty list clears the work. Other works and patrons are never touched. Every
  name is resolved before any write: an unknown label, or a value unknown within its own type,
  raises `ValueError('Unknown observation: <label>: <value>')` and changes nothing. The writes run
  in one transaction, so a database failure keeps the previous set. Several values of a
  single-choice type are stored as submitted.
- **Reading**: `Observations.get_patron_observations(username, work_id)` returns records with
  `record['type']` and `record['value']` ids, ordered by type id, then value id; `[]` when none.
- **`work_id`** is the numeric part of the work's OLID as a string, like `'123'` for `OL123W`; an
  OLID is rejected by PostgreSQL's integer column.

## Design

The [observations module](/openlibrary/core/observations.py) holds the catalog as a Python constant,
`OBSERVATION_CATALOG`, built entry by entry from `(value id, name)` pairs in display order, so
reading it needs no database. Storage follows [`booknotes.py`](/openlibrary/core/booknotes.py): a
class of classmethods on `db.get_db()`, with web.py's `query`, `multiple_insert`, and `delete`
inside `transaction()`. `post_observation`, `get_aspects`, their endpoints, and the beta form are
unchanged: nothing in the product calls the new functions yet.

- **The catalog**: 13 types, ids 1 to 13 (`pace`, `entertainment`, `clarity`, `jargon`,
  `originality`, `difficulty`, `usefulness`, `coverage`, `objectivity`, `genres`, `fictionality`,
  `audience`, `mood`), from the beta form of 2020 without its "N/A" values, with `biography` added
  to fictionality. Value ids count from 1 in display order, except genres, where `mystery` is 7 and
  18th. Value names are lowercase. Its ids are permanent: see
  [Observation ids](../decisions/observation-ids.md).
- **The `observations` table**, in [`schema.sql`](/openlibrary/core/schema.sql): `work_id integer`,
  `username text`, `observation_type integer`, `observation_value integer`, all `NOT NULL`, and
  `created` defaulting to UTC now; primary key (`work_id`, `username`, `observation_type`,
  `observation_value`). Rows are inserted and deleted, never updated. Production needs it created by
  hand: `schema.sql` runs only on a fresh database.
- **Tests**, in [`test_observations.py`](/openlibrary/tests/core/test_observations.py): the storage
  tests run on in-memory SQLite, and again on PostgreSQL when `OL_TEST_POSTGRES_DB` names a
  database, creating the table from `schema.sql`'s own statement.

## Questions

### Round 01

#### Q1: Should this feature also move the beta form and its endpoints onto the new module?

**Answer:** A: build the module, its table, and its tests only; "The proposal names the module
only."

#### Q2: What should the catalog hold beyond the entries the proposal pins?

**Answer:** A, the agent's call: the 13 types of the 2020 form, without "N/A", with biography added
to fictionality and value ids assigned around the pinned ones.

#### Q3: Should the permanence of catalog ids become a project decision?

**Answer:** A, the agent's call: a decision that ids are never renumbered or reused.

#### Q4: Should the project record code-quality limits?

**Answer:** A, the agent's call: a decision recording flake8's limits, complexity 10 and lines of 88
characters, for new and changed code.

## Decisions

- [Observation ids](../decisions/observation-ids.md): observation type and value ids are never
  renumbered or reused, and removing one comes with a plan for its stored rows.
- [Code quality](../decisions/code-quality.md): new and changed Python code keeps lines within 88
  characters and functions within a complexity of 10.

## Changes after approval

- The spec asked to run the storage calls on the project's PostgreSQL first. The environment that
  built the feature had neither Docker nor a PostgreSQL server, so the PostgreSQL test cases exist
  but were skipped; their behaviour on PostgreSQL was reasoned from web.py's source only.

## Follow-ups

- Run the test suite once with `OL_TEST_POSTGRES_DB` set, against the project's PostgreSQL.
- The catalog tests pin only the proposal's values: a snapshot of the whole catalog would guard its
  permanent ids (in the inbox).
- `persist_observations` takes no lock: simultaneous submissions by one patron for one work can fail
  on the primary key or store both sets (in the inbox).
- `get_key_value_pair` and `_get_ids` repeat the same catalog search (in the inbox).
- Moving the beta form and its endpoints onto the module, in a later feature.
