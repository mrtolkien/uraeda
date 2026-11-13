---
icon: eye
preview-folder: packages/web
preview-command: pnpm exec storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}
---

# Preview

> "A mockup should be the code that ships."

The planned UI and the states of its views are Storybook stories, which Uraeda embeds live in specs,
questions, and sessions. The frontmatter holds where Storybook runs, and the command that starts it.

## Rules

- A spec's mockups, and the named states of views, are stories written with the real components,
  next to them. _So:_ no HTML copy of a view is drawn beside it.
- Storybook runs Uraeda's real server over fixture data, never faking its responses. _So:_ a story
  shows what the app shows.
- A page's layout, or a sketch no component holds yet, may be an HTML page in the feature's
  `mockups/` folder, linked from its story. _So:_ a new page is sketched before its components.
- An investigation may compare throwaway prototypes in any format, which the spec's approval
  deletes. _So:_ three looks are compared before one is built.

## Why

Real, interactive mockups inside the spec remove the drift between mockups and code. Running the
real server keeps [Stack](stack.md)'s rule that data comes only from the server. History:
[UI iteration](../done/2026-10-15-ui-iteration.md).

## Alternatives considered

- A task serving the whole app over fixtures: no new dependency, but pages only, and no place for
  variants.

## Applies to

- [`packages/web/`](/packages/web/), its Storybook configuration, and every feature with UI work
