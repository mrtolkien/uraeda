---
icon: component
---

# UI components

> "It should look like itself, not like a framework's demo."

## Rules

- The UI is built from the project's own components, without a component library or a CSS framework.
  _So:_ a date picker is written here, and adding MUI or Tailwind changes this decision first.

## Why

The constitution asks for a lightweight UI for non-technical users. Component libraries bring dense,
technical-looking controls and a large bundle, while the app needs about ten controls.

## Applies to

- [Components](/src/components/), [styles](/src/styles/), and any feature with UI
