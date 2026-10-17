// TEMPORARY: task 11 of the specs redesign rewrites the story card, with its key scenarios as
// Given, When, and Then rows and the others behind "N more scenarios". Until then, a story's card
// draws its blocks as the document page does, its more scenarios folded.
import { Badge } from "@astryxdesign/core/Badge";
import type { MockupLink } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Panel } from "./Panel.tsx";
import { GROUPS, type PartProps, type SpecItems, storyId } from "./parts.ts";

/** What a story's card draws: the page's context, the story, and the mockup it links, if any. */
export type StoryCardProps = PartProps & {
  /** The story or HTML mockup its `story.mockup` block links, from the spec's `mockups`. */
  mockup: MockupLink | undefined;
  story: SpecItems["stories"][number];
};

/** A user story as a card: its id and priority, its title, then its blocks. */
export function StoryCard({ document, folds, selection, story }: StoryCardProps) {
  return (
    <Panel
      badges={
        <>
          <Badge label={story.id} variant="neutral" />
          <Badge label={story.priority} variant={story.priority === "P1" ? "info" : "neutral"} />
        </>
      }
      crumbs={[GROUPS.stories.title]}
      id={storyId(story.id)}
      title={story.title}
    >
      <Blocks document={document} folds={folds} ids={story.blocks} selection={selection} />
    </Panel>
  );
}
