// A story linked inside a sentence, on a page of its own: the crumbs, then the story in a live
// window, as a document shows it. Reading the story is a view of the checkout's Storybook, which the
// window asks for again every 5 minutes, so a story left open is not stopped.
import type { StoryTarget } from "uraeda-binding";
import { Crumbs } from "./Crumbs.tsx";
import { MAIN_CHECKOUT } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { StoryEmbed } from "./StoryEmbed.tsx";

/** A checkout's story, by its folder, `main` for the main checkout, in a window named by its export. */
export function StoryPage({ folder, story }: { folder: string; story: StoryTarget }) {
  return (
    <Page kind="panes">
      <Crumbs current="Story" folder={folder === MAIN_CHECKOUT ? undefined : folder} />
      <StoryEmbed
        folder={folder}
        key={`${story.path}#${story.export}`}
        story={{ ...story, label: story.export }}
      />
    </Page>
  );
}
