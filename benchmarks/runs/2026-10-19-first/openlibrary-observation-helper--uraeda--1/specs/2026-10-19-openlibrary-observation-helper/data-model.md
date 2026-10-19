# Data model: Observation ordering helper, catalog accessor, label lookup, and persistence

The stored data that [the spec](spec.md) adds. Internal types are the plan's.

## observations

One row per value a patron chose for a work. The table is new, in
[`schema.sql`](/openlibrary/core/schema.sql), with a migration under
[`scripts/`](/scripts/migrate_db.py) for existing databases. The four id columns together are the
primary key, so a value cannot be stored twice.

| Field               | Type      | Meaning                                     | Change |
| ------------------- | --------- | ------------------------------------------- | ------ |
| `username`          | text      | The patron who made the observation         | New    |
| `work_id`           | integer   | The work observed, coerced from a string    | New    |
| `observation_type`  | integer   | The catalog's type id, such as 1 for `pace` | New    |
| `observation_value` | integer   | The catalog's value id within that type     | New    |
| `created`           | timestamp | When the row was stored, defaulting to now  | New    |
