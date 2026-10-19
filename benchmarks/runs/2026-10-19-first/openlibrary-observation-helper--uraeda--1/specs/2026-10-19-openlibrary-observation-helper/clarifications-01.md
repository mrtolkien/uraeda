---
status: answered
---

# Clarifications, round 01: Observation ordering helper, catalog accessor, label lookup, and persistence

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes: the catalog's content and the table are not fully
>   specified.
> - Catalog content: only three types are pinned, and ids are known for two of them.
> - Failed submissions: what happens to a label or value the catalog does not know.
> - Database table: how existing databases get the new table.
> - Settled points to check: the table's column types and the external service left alone.

## Context

### Goal

Give patrons' reader observations a local home: a fixed catalog, an id-to-label lookup, an ordering
helper, and storage where a patron's observations for a work always equal their latest submission.

### Today

[`observations.py`](/openlibrary/core/observations.py) only forwards observations to an external
service, TheBestBookOn (TBBO). It has no catalog and no table. Other per-patron data, like
[`Booknotes`](/openlibrary/core/booknotes.py), lives in Postgres tables defined in
[`schema.sql`](/openlibrary/core/schema.sql), and unit tests there run without a database.

### Scope

Covers the five names in the proposal, a table for storage, and tests. It leaves out the web
endpoints, the form, and TBBO's `post_observation` and `get_aspects`.

### Sources

- [`observations.py`](/openlibrary/core/observations.py),
  [`booknotes.py`](/openlibrary/core/booknotes.py), [`schema.sql`](/openlibrary/core/schema.sql),
  [`db.py`](/openlibrary/core/db.py), [`migrate_db.py`](/scripts/migrate_db.py).
- The full investigation is in [discovery](discovery-01.md).

## Q1: Which observation types does the catalog hold?

The proposal pins three types: `pace` (id 1: `slow`, `medium`, `fast`), `fictionality`
(`nonfiction`, `fiction`, `biography`), and `genres` (id 10, with `mystery` as value 7). Id 10
implies other types exist, but neither the proposal nor the repository lists them. The catalog is a
constant inside the module, not read from the network. More in
[discovery](discovery-01.md#the-catalogs-size).

Why it matters: stored rows keep these ids forever, so changing them later needs a data migration.

- **A (recommended). Include only the three named types, with `pace` as id 1, and `genres` as id 10
  with `mystery` as its value 7. I pick the other ids and `genres` values around the pinned ones.**
  - [pro] keeps to the proposal: no invented types.
  - [con] ids 2 to 9 stay unused until real types arrive, and `genres` lists only values I choose.
  - Why recommended: the constitution forbids adding what the proposal does not ask for.
- **B. I supply the full list of types, ids, descriptions, and values in my answer.**
  - [pro] the catalog matches what you intend from the start.
  - [con] it costs you time now.

**Answer:** A. Your call; recommended.

## Q2: What happens when a submission has a label or value the catalog does not know?

`persist_observations` receives `{label: value_name}` entries. A typo or an outdated form could send
one the catalog lacks. More in [discovery](discovery-01.md#unknown-labels-and-values).

Why it matters: it decides whether bad input is visible or silently lost, and whether a partly valid
submission still changes the stored set.

- **A (recommended). Raise a `ValueError` and store nothing, so the stored set is never half
  updated.**
  - [pro] errors are visible, and the stored set stays equal to a full, valid submission.
  - [con] one bad entry blocks the whole submission.
  - Why recommended: it keeps the rule that stored data equals the latest submission.
- **B. Skip the unknown entry, and store the rest.**
  - [pro] a patron's valid answers are never lost.
  - [con] the stored set silently differs from what was submitted.

**Answer:** A. Your call; recommended.

## Q3: How do existing databases get the new table?

Storage needs a new `observations` table. The repository defines tables in `schema.sql`, which only
runs on a fresh database, and has a migration script. More in
[discovery](discovery-01.md#the-table).

Why it matters: without a migration, a deployed database fails on the first persist.

- **A (recommended). Add the table to `schema.sql` and a migration under `scripts/`.**
  - [pro] fresh and existing databases both work.
  - [con] one more file to review.
  - Why recommended: it avoids a failure in a deployed database.
- **B. Add it to `schema.sql` only, and leave the migration to the maintainers.**
  - [pro] the smallest change.
  - [con] deployed databases break until someone writes the migration.

**Answer:** A. Your call; recommended.

## Q4: Should the observation endpoints change as part of this work?

The `/observations` and `/aspects` endpoints forward to TBBO. The proposal names only the module's
functions, and the form reads its catalog from `/aspects`. More in
[discovery](discovery-01.md#the-code).

Why it matters: wiring the new storage into the endpoints changes what patrons see, and is a feature
of its own.

- **A (recommended). Leave the endpoints and the form untouched.**
  - [pro] matches the proposal, and nothing changes for patrons.
  - [con] the new storage has no caller until a later feature.
  - Why recommended: the constitution forbids features the proposal does not ask for.
- **B. Also store a patron's submission locally from the `/observations` endpoint.**
  - [pro] the storage is used at once.
  - [con] it changes behaviour the proposal does not mention, and needs the work id and form
    changes.

**Answer:** A. Proposal names only the module's functions.

## Settled without the human

### Check these

- **The table's columns** are `username text`, `work_id integer`, `observation_type integer`,
  `observation_value integer`, and `created`, with all four id columns as the primary key. This
  follows the other tables. A string `work_id` is accepted, as the database coerces it. See
  [discovery](discovery-01.md#the-workid-type).
- **The external service** (`post_observation`, `get_aspects`) stays unchanged and in the module.

### Behaviour

- **An empty submission** removes all the patron's stored observations for that work, since the
  stored set must equal the submitted one.
- **A value present in both** the stored and submitted sets is left alone, never duplicated.

### Under the hood

- **Persistence** runs the delete of dropped rows and the insert of new rows in one transaction.
- **`_sort_values`** returns the name of the first matching entry for each id of `order_list`, so a
  repeated id adds no duplicate. See [discovery](discovery-01.md#needs-no-choice).
- **Tests** replace the database with `monkeypatch`, as in
  [`test_lending.py`](/openlibrary/tests/core/test_lending.py), since unit tests have no database.

**Notes:**
