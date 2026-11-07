---
verdict: changes-requested
commit: 1f03799
---

# Review: Spec, Color themes

## C1: Lines 94–95, under "US2: Try themes from the keyboard (P2)"

> 1. **Given** Catppuccin Mocha in use in dark mode, **When** you open `Space u t` and move to Nord,
>    **Then** the app is drawn in Nord; Escape draws it in Mocha again.

It’s good: make the picker 90% transparent after 1s on a theme, and make sure the app is very
visible

Also the picker should not have a right pane since the preview is the app itself

## C2: General

The theme preview picker needs a bit of work. If my suggestion is bad you are free to suggest
another behavior. But what matters is easy preview before committing.
