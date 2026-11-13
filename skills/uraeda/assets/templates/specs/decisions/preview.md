---
icon:
preview-folder: [the folder the preview runs in, from the repository's top level, or .]
preview-command: [the command that starts it, with {port} and --host 127.0.0.1]
---

# Preview

> "[What the human said about seeing planned UI before it is built, in their own words.]"

[Where mockups live and what shows them: the project's own Storybook, a small mockups Storybook, or
the preview the project already has. The frontmatter holds its folder and its command. For a project
that declines a preview: say it has none, leave out both preview fields, and give a date in Revisit
when. Its mockups stay HTML.]

## Rules

- [A mockup is a story of the real components, one export per state.] _So:_ [the picked mockup is
  the code that ships.]
- [Optional: where stories get their data.] _So:_ [a story shows what the product would.]

## Why

[Why the human wants planned UI live in the spec, and why this preview. How it is set up, its
builder, its pinned versions, and the skill's two helper files, is in its own folder, not here.]

## Alternatives considered

- [Optional: HTML mockups in each feature's `mockups/` folder, when an agent could propose them
  again]

## Applies to

- [The UI's folder, the preview's folder, and any feature with UI work]

## Revisit when

[Optional: for a project that declines a preview, the date to ask again.]
