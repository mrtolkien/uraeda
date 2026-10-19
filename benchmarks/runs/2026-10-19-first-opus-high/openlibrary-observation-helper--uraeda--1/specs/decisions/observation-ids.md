---
status: active
approved-by: benchmark
icon: fingerprint
---

# Observation ids

Patrons' stored observations hold only a type id and a value id from the observation catalog in
[`openlibrary/core/observations.py`](/openlibrary/core/observations.py), never names. Each id
therefore keeps its meaning for good: renumbering or reusing one would silently change what every
patron said about every work.

## Rules

- An observation type id or value id MUST NOT be renumbered once released. Checked by review.
- A removed type id or value id MUST NOT be reused for another type or value. Checked by review.
- Removing a type or a value from the catalog MUST come with a plan for its stored rows, deleted or
  moved to another id. Checked by review.
- A new type or value MUST take an id never used before in its scope: types across the catalog,
  values within their type. Checked by review.
- The display order of a type's values SHOULD change through its display-order list, never through
  its value ids. Checked by review.
- A type's label or a value's name MAY be renamed, since rows store only ids, once every caller that
  sends the old name is updated. Checked by review.

## Why

Stored rows reference the catalog by ids alone, so an id is a promise to every row written with it.
A code comment protects only readers of the catalog's file; this rule reaches any later feature that
edits the catalog. See the question on
[the permanence of catalog ids](../done/2026-10-19-openlibrary-observation-helper.md#q3-should-the-permanence-of-catalog-ids-become-a-project-decision)
and the discovery's
[catalog ids over time](../done/2026-10-19-openlibrary-observation-helper.md#q3-should-the-permanence-of-catalog-ids-become-a-project-decision).

## Alternatives considered

- A comment above the catalog only: nothing to approve, but it protects only readers of that file.

## Consequences

- Stored observations keep their meaning across every change to the catalog.
- Ids grow with gaps over time, as values are removed.
- A catalog cleanup costs a data migration, not just an edit.

## Applies to

- The observation catalog in [`openlibrary/core/observations.py`](/openlibrary/core/observations.py)
- The `observations` table in [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql)
- Any feature that adds, removes, or reorders observation types or values
