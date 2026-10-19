---
status: answered
---

# Clarifications, round 01: Observation ordering helper, catalog accessor, label lookup, and persistence

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed, because it is small and relies on nothing new.
> - Catalog source and content: the proposal gives only three facts, and the ids you pick become
>   stored data.
> - Unknown labels and values: refused, not ignored. Check that this matches what you want.
> - Single-choice types: stored as submitted, without a one-value guard.
> - Database checks: no Postgres runs here, so persistence tests fake the database.

## Context

### Goal

Give `openlibrary/core/observations.py` a value ordering helper, a catalog of observation types, an
id-to-label lookup, and storage of each patron's observations per work, as the proposal's
requirements describe.

### Today

The module [`observations.py`](/openlibrary/core/observations.py) only forwards to a remote service,
TheBestBookOn ("TBBO"). It has no catalog and no storage. The database schema in
[`schema.sql`](/openlibrary/core/schema.sql) has no table for observations. Existing models such as
[`booknotes.py`](/openlibrary/core/booknotes.py) show the pattern to follow.

### Scope

Covers the five names the proposal lists, the table they store into, and their tests. Leaves out the
web pages and the existing `/observations` and `/aspects` endpoints, which stay unchanged.

### Sources

- The code: `observations.py`, `api.py`, `schema.sql`, `booknotes.py`, `ratings.py`, `db.py`, and
  the core tests.
- The installed `web.py` 0.62 database API. No web research: the task forbids looking up existing
  solutions.
- The full investigation is in [discovery](discovery-01.md).

## Q1: Where does the observation catalog come from?

`get_observations()` must return types such as `pace` with ordered value names. The proposal does
not say where that data lives. The module already fetches TBBO's catalog over the network in
`get_aspects`, but its response shape is not documented anywhere in the repository, and tests could
not read it offline. More in [discovery](discovery-01.md#catalog-source).

Why it matters: it decides whether the helper works offline and in tests, and whether the ids are
ours or a remote service's.

- **A (recommended). Keep the catalog as static data in the module, and build each type's value
  names with `_sort_values`.**
  - [pro] works offline, tests are exact, and the proposal's `pace` and `fictionality` values are
    guaranteed.
  - [con] a catalog change needs a code change.
  - Why recommended: the proposal's exact values cannot be checked against a remote response.
- **B. Fetch the catalog from TBBO's aspects endpoint, and reshape it.**
  - [pro] the catalog stays in sync with the remote service.
  - [con] needs a network fake in tests, and the response shape is unverified.

**Answer:** A. Your call; static data in the module.

## Q2: Which observation types does the static catalog hold?

Only with option A in the previous question. The proposal fixes `pace` (id 1: `slow`, `medium`,
`fast`, single choice), `fictionality` (`nonfiction`, `fiction`, `biography`), and `genres` (type id
10, value id 7 is `mystery`). It gives no id for `fictionality`, and no other types or descriptions.
Ten type ids are implied, but nine are unknown. Ids are stored with each patron's data, so they
cannot change later without a migration. More in [discovery](discovery-01.md#catalog-content).

Why it matters: it sets permanent ids, and whether the feature stays inside the proposal's scope.

- **A (recommended). Hold only the three named types, with `pace` as id 1, `genres` as id 10 with
  `mystery` as value 7, and `fictionality` as id 2. Descriptions and the other `genres` values are
  written by me, and shown in the spec for you to check.**
  - [pro] adds nothing the proposal does not ask for.
  - [con] the ids and the other genre names are my choice, not yours.
  - Why recommended: the constitution forbids features the proposal does not ask for.
- **B. Use a full list of types, ids, values, and descriptions that you write in your answer.**
  - [pro] the stored ids match your real data from the start.
  - [con] needs you to supply the list.

**Answer:** A. Your call; only the three named types.

## Q3: Does the table need more than `schema.sql`?

The new `observations` table goes into `schema.sql`, which creates fresh installs. Existing
databases do not rerun it, and the developer database dump,
[`dev_db.pg_dump`](/scripts/dev-instance/dev_db.pg_dump), is a separate file. More in
[discovery](discovery-01.md#migration-and-dev-data).

Why it matters: it decides whether the change touches a 7,000-line dump, and who creates the table
on existing databases.

- **A (recommended). Add the table to `schema.sql` only, and leave existing databases to be altered
  by hand.**
  - [pro] the smallest change, in the file all setup scripts load.
  - [con] the dev dump lacks the table until it is regenerated.
  - Why recommended: the proposal names no migration or dump.
- **B. Also add the table to the developer dump.**
  - [pro] a dev instance restored from the dump works at once.
  - [con] edits a large generated file.

**Answer:** A. Your call; the proposal names no migration or dump.

## Settled without the human

### Check these

- **Unknown labels and values in a submission** make `persist_observations` raise `ValueError`
  before it changes anything, instead of skipping them. Skipping would break "the stored set equals
  the submitted set". See
  [discovery](discovery-01.md#behaviour-for-ids-and-labels-outside-the-catalog).
- **Single-choice types** (`pace`) are not enforced on storage: two `pace` values are stored if
  submitted. The proposal asks for equality with the submission, not a one-value guard. See
  [discovery](discovery-01.md#single-choice-types).
- **Persistence tests fake the database**, because no Postgres runs here. SQL semantics are
  therefore unverified until run on a real server. See
  [discovery](discovery-01.md#worth-it-and-feasibility).

### Behaviour

- **An empty submission** removes all of the patron's stored values for that work, and leaves other
  works and patrons alone.
- **An unknown id in `get_key_value_pair`** returns `None` instead of raising, so a retired value
  cannot break a page. See
  [discovery](discovery-01.md#behaviour-for-ids-and-labels-outside-the-catalog).
- **Duplicate ids in `_sort_values`** yield each name once: the first occurrence in `order_list`
  wins, and the first entry in `values_list` for an id wins. See
  [discovery](discovery-01.md#partial-alignment-of-_sort_values).

### Under the hood

- **The existing TBBO functions and endpoints** `post_observation`, `get_aspects`, `/observations`,
  `/aspects` stay unchanged. See [discovery](discovery-01.md#important-reads).
- **The table** is `observations` with `observation_type`, `observation_value`, `username`,
  `work_id` (integer, like `ratings`), and a primary key over all four, so a value cannot be stored
  twice. See [discovery](discovery-01.md#important-reads).
- **Persistence** runs the diff in one `db.transaction()`, using the pattern of `Booknotes`, and
  `get_patron_observations` aliases the columns to `type` and `value`. `get_key_value_pair` returns
  a `namedtuple` of `key` and `value`.

**Notes:**
