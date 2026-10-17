---
status: proposed
approved-by:
icon: database
---

# Task storage

All task data lives in the browser's IndexedDB, behind the store module in `src/store/`. UI code
never touches the database directly, and every change to stored data comes with a versioned upgrade,
so users never lose their tasks when the app updates.

## Rules

- Data MUST be stored in IndexedDB, only through `src/store/`: components never reach the database
  themselves. Checked by ESLint's `no-restricted-imports` in `src/components/`.
- A change to stored data MUST come with a versioned upgrade in `src/store/upgrades.ts`, tested on
  data saved by every earlier version. Checked by the upgrade's own test.
- An upgrade that cannot read a saved value MUST clear it and log it, and MUST NOT delete a task.
  Checked by the upgrade's test on corrupted data.

## Why

The constitution requires tasks to stay on the user's device, and the app to stay fast with
thousands of tasks. Users cannot be asked to export and import their tasks after an update, so data
changes must be upgraded in place, from one place.

## Consequences

- Stored data is tested in one place, and components stay free of storage code.
- Every feature that changes stored data needs an upgrade and its test.
- A corrupted value costs the user that value, never the task.

## Applies to

- [The store](/src/store/), and any feature that adds or changes stored data
