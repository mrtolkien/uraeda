import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import type { MockupLink, StoryLink } from "uraeda-binding";
import { navigate, useRepoPath } from "./routes.tsx";
import { storybookHref, storyEmbedId } from "./stories.tsx";

/**
 * Scrolls to the embed of a story the file shows, a little below the top bar: whether it is there,
 * since a file without a preview decision embeds none.
 */
function scrollToEmbed(stories: ReadonlyArray<StoryLink>, mockup: MockupLink): boolean {
  const { story } = mockup;
  const embed = stories.find((link) => link.path === story?.path && link.export === story.export);
  const element = embed && document.getElementById(storyEmbedId(embed.block));
  if (!element) {
    return false;
  }
  element.scrollIntoView({ block: "start" });
  const bar = document.querySelector('[role="banner"]')?.getBoundingClientRect();
  window.scrollBy(0, -Math.max(bar?.bottom ?? 0, 0) - 16);
  return true;
}

/**
 * The spec's mockups, at the top of its review: the easiest part of a spec to check, one large
 * button per mockup its Mockups section links, each opening the mockup's page, or scrolling to the
 * embed of a story, else opening the story in the Storybook page. Nothing without mockups.
 */
export function ReviewMockups({
  folder,
  mockups,
  stories,
  wide,
}: {
  folder: string;
  mockups: ReadonlyArray<MockupLink> | undefined;
  stories: ReadonlyArray<StoryLink>;
  wide: boolean;
}) {
  const here = useRepoPath();
  if (!mockups?.length) {
    return undefined;
  }
  const open = (mockup: MockupLink) => {
    if (!mockup.story) {
      navigate(here(`/f/${folder}/${mockup.path}`));
    } else if (!scrollToEmbed(stories, mockup)) {
      navigate(here(storybookHref(folder, mockup.story)));
    }
  };
  return (
    <HStack aria-label="Mockups" as="section" gap={2} wrap="wrap">
      {mockups.map((mockup) => (
        <Button
          key={`${mockup.path}-${mockup.block}`}
          label={`Open the mockup: ${mockup.label}`}
          onClick={() => open(mockup)}
          size="lg"
          variant="primary"
          width={wide ? undefined : "100%"}
        />
      ))}
    </HStack>
  );
}
