---
icon: database
---

# Task storage

> "My tasks stay on my device, and an update never loses them."

## Rules

- Task data lives in the browser's IndexedDB, behind the store module, and nowhere else. _So:_ a
  component never opens the database, and sync between devices changes this decision first.
- A change to stored data comes with an upgrade, tested on data saved by the previous version. _So:_
  a new field on a task ships with the code that fills it for the tasks users already have.

## Why

The constitution keeps tasks on the user's device, and the app fast with thousands of them. Users
cannot be asked to export and import their tasks after an update, so stored data is upgraded in
place, from one place.

## Alternatives considered

- `localStorage`: synchronous, and limited to about 5 MB, which blocks the list with thousands of
  tasks.

## Applies to

- [The store](/src/store/), and any feature that adds or changes stored data
