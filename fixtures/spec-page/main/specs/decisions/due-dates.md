---
status: active
approved-by: mrtolkien
icon: calendar-clock
---

# Due dates

Due dates are calendar days, like `2026-10-12`, without a time or a timezone.

## Rules

- Due dates MUST be stored as `YYYY-MM-DD` strings. Checked by the `CalendarDay` type.
- Date arithmetic MUST go through `src/lib/dates.ts`. Checked by review.
