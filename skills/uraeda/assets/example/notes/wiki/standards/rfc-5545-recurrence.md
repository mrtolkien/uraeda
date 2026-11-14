---
description: iCalendar's recurrence rules (RFC 5545): a rule, plus exceptions for edited or removed occurrences
checked: 2026-10-07
sources:
  - https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10
  - https://icalendar.org/iCalendar-RFC-5545/3-8-4-4-recurrence-id.html
  - https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.5.1
---

# iCalendar recurrence (RFC 5545)

How calendars describe repetition, and the model behind "this event, this and following, or all".

## Facts

- A repetition is a rule, `RRULE`
  ([RFC 5545, 3.3.10](https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10)).
- An edited occurrence is an override pointing to its original date, `RECURRENCE-ID`. With
  `RANGE=THISANDFUTURE`, the change applies to that occurrence and all later ones
  ([3.8.4.4](https://icalendar.org/iCalendar-RFC-5545/3-8-4-4-recurrence-id.html)).
- A removed occurrence is listed in `EXDATE`
  ([3.8.5.1](https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.5.1)).
- The [`rrule`](https://github.com/jkbrzt/rrule) library implements it in JavaScript.

## Related

- [[recurring-dates]]
