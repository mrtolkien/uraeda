---
description:
  Adding 24 hours to a JavaScript Date is not adding a day when daylight saving time changes
checked: 2026-10-07
sources:
  - https://www.golinuxcloud.com/javascript-add-days-to-date/
---

# A day is not 24 hours in a JavaScript Date

A local day lasts 23 or 25 hours when daylight saving time changes. A timestamp at local midnight,
plus 7 × 24 hours, lands on 23:00 the day before across the autumn change, so the date is wrong, and
on 01:00 the right day across the spring change
([guide](https://www.golinuxcloud.com/javascript-add-days-to-date/)).

Instead: store a calendar day as text, `2026-10-05`, and add days and months to it with a calendar
function, as [[date-fns]]'s `addDays` and `addMonths` do on a `Date` made from it.
