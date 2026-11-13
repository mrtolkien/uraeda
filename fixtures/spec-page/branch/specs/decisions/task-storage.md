---
icon: database
---

# Task storage

> "My tasks stay on my device, and an update never loses them."

## Rules

- Task data lives in IndexedDB, behind the store module, and nowhere else. _So:_ a component never
  opens the database.
- A change to stored data comes with an upgrade, tested on data saved by every earlier version.
  _So:_ a new field ships with the code that fills it for the tasks users already have.
- An upgrade that cannot read a saved value clears it and logs it, and never deletes a task. _So:_
  a corrupted value costs the user that value, never the task.

## Why

The constitution keeps tasks on the user's device, and the app fast with thousands of them. Users
cannot be asked to export and import their tasks after an update, so stored data is upgraded in
place, from one place.

## Applies to

- [The store](/src/store/), and any feature that adds or changes stored data
