---
description: date-fns, JavaScript date functions on Date: month arithmetic and formatting
checked: 2026-10-07
version: 4
sources:
  - https://date-fns.org/docs/addMonths
---

# date-fns

Functions over JavaScript's `Date`, one per import: formatting, parsing, and arithmetic.

## Facts

- `addMonths` clamps to the month's last day: January 31 plus one month is the last day of February
  ([date-fns docs](https://date-fns.org/docs/addMonths)), where `Date.setMonth` overflows into
  March.
- It works on `Date`, so a timestamp's timezone still applies: it has no calendar date type of its
  own.

## Gotchas

- [[javascript-date-24-hours-is-not-a-day]]

## Related

- Used by [[2026-10-06-recurring-tasks-01]].
