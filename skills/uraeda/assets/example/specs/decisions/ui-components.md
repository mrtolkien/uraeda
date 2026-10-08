---
status: active
approved-by: mrtolkien
---

# UI components

The UI is built from the project's own React components and CSS modules, without a component
library. Screens stay light, and the app looks like itself rather than like a framework's demo.

## Rules

- Components MUST be written in the project, in `src/components/`.
- Styles MUST use CSS modules, with the variables in `src/styles/theme.css`.
- Code MUST NOT add a UI component library (MUI, Chakra, shadcn/ui, ...) or a CSS framework.

## Why

The constitution asks for a lightweight UI for non-technical users. Component libraries bring dense,
technical-looking controls and a large bundle, while the app needs about ten controls.

## Consequences

- The bundle stays small, and every control matches the app's look.
- Accessible controls, like menus and date pickers, must be built and tested in the project.

## Applies to

- [Components](/src/components/), [styles](/src/styles/), and any feature with UI
