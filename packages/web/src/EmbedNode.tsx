// A paragraph that embeds a story or an HTML mockup, as `Blocks` draws it: its live window, then
// what follows the block in a review, like its pending comments. The window is not selected as
// lines are: a story's comments come from its own controls, a mockup's from its page.
import { useContext } from "react";
import type { Block } from "uraeda-binding";
import type { BlockContext } from "./Blocks.tsx";
import { MockupEmbed } from "./MockupEmbed.tsx";
import { After } from "./Selection.tsx";
import { StoryEmbed } from "./StoryEmbed.tsx";
import { embedComment, StoryContext, storyEmbedId, useMockupAt, useStoryAt } from "./stories.tsx";

/** The story or the HTML mockup a paragraph embeds, then what follows the block. */
export function EmbedNode({ block, context }: { block: Block; context: BlockContext }) {
  const stories = useContext(StoryContext)!;
  const story = useStoryAt(block);
  const mockup = useMockupAt(block);
  const after = context.selection?.after?.(block);
  return (
    <>
      {story ? (
        <StoryEmbed
          comment={embedComment(stories, story, block)}
          folder={stories.folder}
          id={storyEmbedId(block.id)}
          key={`${stories.folder}:${story.path}#${story.export}`}
          removed={stories.removed}
          story={story}
        />
      ) : (
        mockup && (
          <MockupEmbed
            folder={stories.folder}
            id={storyEmbedId(block.id)}
            key={`${stories.folder}:${mockup.path}`}
            mockup={mockup}
          />
        )
      )}
      {after && <After>{after}</After>}
    </>
  );
}
