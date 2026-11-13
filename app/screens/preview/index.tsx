// The previews: a story of a checkout's Storybook and a feature's HTML mockup, each live in the
// main stack, with its facts and its feature's other stories or mockups in the side stack. A
// workflow file draws a story or a mockup linked alone in its paragraph with `StoryEmbed` and
// `MockupEmbed`, from here.
import { route } from "../../store";
import { definePlace } from "../../ui/layout";
import { mockupPane, mockupsPane } from "./MockupPage";
import { storiesPane, storyPane } from "./StoryPage";

export { MockupEmbed } from "./MockupPage";
export { StoryEmbed } from "./StoryPage";

/** The repository of the page shown: every route of a repository's pages names one. */
const repoOf = (shown: { repo?: string }) => shown.repo ?? route().repo ?? "";

definePlace("storybook", (shown) => {
  const of = { folder: shown.folder, repo: repoOf(shown), story: shown.story };
  return [storyPane(of), storiesPane(of)];
});
definePlace("mockup", (shown) => {
  const of = { folder: shown.folder, name: shown.name, repo: repoOf(shown) };
  return [mockupPane(of), mockupsPane(of)];
});
