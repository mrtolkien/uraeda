# Rulings: Observation ordering helper, catalog accessor, label lookup, and persistence

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The PostgreSQL check runs when a database is given

- **Decision**: every storage test runs on in-memory SQLite, and again on PostgreSQL when
  `OL_TEST_POSTGRES_DB` names a database; the PostgreSQL run creates the table from `schema.sql`'s
  own statement. The environment that built this feature has no Docker and no PostgreSQL server, so
  the PostgreSQL cases were skipped there.
- **Rationale**: the spec asks the first task to run the storage calls on the project's PostgreSQL.
  Without a server, the check can only be made ready to run; the pull request says it did not run.
- **Alternatives considered**: stopping the build for a database, which only an environment change
  gives; checking SQLite only, which would leave the check out of the repository.
- **If wrong**: a SQL difference shows on the first run with a database; per the spec, the SQL
  changes, not the behaviour.
- **Where**: task 1, `openlibrary/tests/core/test_observations.py`

## R2: SQLite tests create the table with their own statement

- **Decision**: the SQLite fixture creates `observations` with the same columns and primary key, but
  a plain `created timestamp` column.
- **Rationale**: `schema.sql`'s default, `current_timestamp at time zone 'utc'`, is PostgreSQL only.
- **Alternatives considered**: rewriting the statement from `schema.sql` for SQLite, which is
  fragile text surgery for a column no test reads.
- **If wrong**: a column drift between the two statements; the PostgreSQL run catches it.
- **Where**: task 1, `openlibrary/tests/core/test_observations.py`
