# Rulings: Observation ordering helper, catalog accessor, label lookup, and persistence

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A dict with several items is read item by item

- **Decision**: each `{label: value_name}` entry contributes every item of the dict.
- **Rationale**: the proposal says single-entry dicts; reading all items is the simplest total
  behaviour.
- **Alternatives considered**: rejecting such dicts; this adds an unrequested rule.
- **If wrong**: change one loop in `persist_observations`.
- **Where**: task 2.

## R2: The migration is a standalone SQL file

- **Decision**: `scripts/migrations/create_observations_table.sql`, not an edit of `migrate_db.py`.
- **Rationale**: `migrate_db.py` is a versioned upgrader of the 2010 core schema, and later tables
  such as `booknotes` were never added to it.
- **Alternatives considered**: a new `upgrade_015` step, which would run against the wrong schema.
- **If wrong**: move the statement into another script.
- **Where**: task 2.
