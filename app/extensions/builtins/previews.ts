// Previews, a built-in extension: Storybook's previews and HTML mockups in specs, rounds, and
// sessions. It draws no place, pane, or key of its own: it owns the story's and the mockup's pages,
// which say it is off where it is. Its server part, the warming of the previews that wait for the
// human, is the server's (`crates/server/src/preview/warm.rs`).
import { builtIn } from "./declare";

export const previews = builtIn({
  name: "previews",
  pages: ["storybook", "mockup"],
  title: "Previews",
});
