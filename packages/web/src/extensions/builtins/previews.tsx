// Previews, a built-in extension: Storybook's previews and HTML mockups in specs, rounds, and
// sessions. Its server part, the warming of a feature's Storybook as its turn ends, is the server's
// (`extensions/builtins.ts`). On the page it draws no place, pane, or key of its own, so it
// registers nothing here: while it is off here, an embed is drawn as the link it is written as
// (`Blocks.tsx`, `AgentStories.tsx`), and the story and mockup pages say it is off (`routes.tsx`).
export {};
