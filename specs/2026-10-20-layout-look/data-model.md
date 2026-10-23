# Data model: Layout and look and feel

The stored data that [the spec](spec.md) changes: two preferences kept in the browser. No workflow
file, setting, or server data changes. Internal types are the plan's.

## The colour scheme, `uraeda.theme` in the browser's storage

| Field | Type                                      | Meaning                           | Change  |
| ----- | ----------------------------------------- | --------------------------------- | ------- |
| value | `"mocha"` or `"latte"`, absent for System | the scheme picked on this browser | Changed |

- An earlier `"dark"` reads as `"mocha"`, and `"light"` as `"latte"`, and is rewritten at the next
  pick. Absent, or any other value, means System, as today.

## The sidebar's width, `uraeda.nav` in the browser's storage

| Field | Type   | Meaning                                          | Change  |
| ----- | ------ | ------------------------------------------------ | ------- |
| width | pixels | the column's width on wide screens, once dragged | Changed |

- Kept from 220 to 480 px, as today's range is 200 to 480. A stored width outside it is brought to
  the nearest end. Never dragged, the column takes 14% of the window, from 256 to 340 px.
