# Data model: Observation ordering helper, catalog accessor, label lookup, and persistence

The stored data that [the spec](spec.md) adds. Internal types are the plan's.

## observations

One row is one value a patron gave to a work. The table sits in
[`schema.sql`](/openlibrary/core/schema.sql), beside `ratings` and `booknotes`.

| Field               | Type    | Meaning                                                   | Change |
| ------------------- | ------- | --------------------------------------------------------- | ------ |
| `username`          | text    | The patron who gave the value, as in `ratings`            | New    |
| `work_id`           | integer | The work described, as in `ratings`                       | New    |
| `observation_type`  | integer | The catalog id of the type, such as 1 for `pace`          | New    |
| `observation_value` | integer | The id of the value inside its type, such as 1 for `slow` | New    |

The primary key covers all four fields, so a patron cannot store the same value twice for a work.
There are no `created` or `updated` columns: a row is inserted or removed, never edited.

The catalog's ids are never stored in the table's definition: they live in the module, and stored
rows keep them. An id, once saved, never changes meaning.
